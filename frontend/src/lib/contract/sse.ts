import { SSE_SCHEMA_PATHS, REST_SCHEMA_PATHS } from "./schema-paths";
import { ContractValidationError, JobServerHttpError } from "./errors";
import type { ErrorResponse, JobStatus, StreamEvent } from "./types";
import { validateSchema, validateSseEvent } from "./validators";

const textDecoder = new TextDecoder();

export type SseFrame = {
  id?: string;
  event?: string;
  data?: string;
};

export type StreamFilter = {
  jobIds?: string[];
  statuses?: JobStatus[];
};

export type StreamHandlers = {
  onOpen?: () => void;
  onEvent: (event: StreamEvent, frame: SseFrame) => void;
  onError?: (error: unknown) => void;
  onClose?: () => void;
};

export type StreamOptions = {
  baseUrl: string;
  token: string;
  filter?: StreamFilter;
  signal?: AbortSignal;
  reconnectBaseDelayMs?: number;
  reconnectMaxDelayMs?: number;
};

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function buildStreamUrl(baseUrl: string, filter?: StreamFilter) {
  const url = new URL(`${normalizeBaseUrl(baseUrl)}/v1/stream`);

  for (const jobId of filter?.jobIds ?? []) {
    url.searchParams.append("job_id", jobId);
  }

  for (const status of filter?.statuses ?? []) {
    url.searchParams.append("status", status);
  }

  return url;
}

function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);

    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

function parseFrame(rawFrame: string): SseFrame | null {
  const lines = rawFrame.split("\n");
  const frame: SseFrame = {};
  const dataLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line || line.startsWith(":")) {
      continue;
    }

    const separatorIndex = line.indexOf(":");
    const field = separatorIndex === -1 ? line : line.slice(0, separatorIndex);
    const value =
      separatorIndex === -1 ? "" : line.slice(separatorIndex + 1).trimStart();

    if (field === "id") {
      frame.id = value;
    } else if (field === "event") {
      frame.event = value;
    } else if (field === "data") {
      dataLines.push(value);
    }
  }

  if (dataLines.length > 0) {
    frame.data = dataLines.join("\n");
  }

  if (!frame.id && !frame.event && !frame.data) {
    return null;
  }

  return frame;
}

export function parseSseChunk(buffer: string): {
  frames: SseFrame[];
  remainder: string;
} {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const chunks = normalized.split("\n\n");
  const remainder = chunks.pop() ?? "";
  const frames: SseFrame[] = [];

  for (const rawFrame of chunks) {
    const parsed = parseFrame(rawFrame);
    if (parsed) {
      frames.push(parsed);
    }
  }

  return { frames, remainder };
}

async function maybeParseErrorResponse(
  response: Response,
): Promise<ErrorResponse | undefined> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return undefined;
  }

  const payload = await response.json();
  const result = validateSchema<ErrorResponse>(
    REST_SCHEMA_PATHS.errorResponse,
    payload,
  );
  return result.ok ? result.data : undefined;
}

async function consumeSseBody(
  body: ReadableStream<Uint8Array>,
  onFrame: (frame: SseFrame) => void,
  signal?: AbortSignal,
) {
  const reader = body.getReader();
  let remainder = "";

  while (true) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const { done, value } = await reader.read();
    if (done) {
      return;
    }

    remainder += textDecoder.decode(value, { stream: true });
    const parsed = parseSseChunk(remainder);
    remainder = parsed.remainder;

    for (const frame of parsed.frames) {
      onFrame(frame);
    }
  }
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export function openValidatedEventStream(
  options: StreamOptions,
  handlers: StreamHandlers,
) {
  const reconnectBaseDelayMs = options.reconnectBaseDelayMs ?? 1_000;
  const reconnectMaxDelayMs = options.reconnectMaxDelayMs ?? 15_000;
  const abortController = new AbortController();

  const externalSignal = options.signal;
  externalSignal?.addEventListener("abort", () => abortController.abort(), {
    once: true,
  });

  const internalSignal = abortController.signal;
  let lastEventId: string | undefined;

  const run = async () => {
    let reconnectAttempt = 0;

    while (!internalSignal.aborted) {
      try {
        const streamUrl = buildStreamUrl(options.baseUrl, options.filter);
        const response = await fetch(streamUrl, {
          method: "GET",
          headers: {
            Accept: "text/event-stream",
            Authorization: `Bearer ${options.token}`,
            ...(lastEventId ? { "Last-Event-ID": lastEventId } : {}),
          },
          signal: internalSignal,
        });

        if (!response.ok) {
          const details = await maybeParseErrorResponse(response);
          throw new JobServerHttpError(
            response.status,
            streamUrl.toString(),
            details,
          );
        }

        if (!response.body) {
          throw new Error("SSE response did not include a readable body");
        }

        reconnectAttempt = 0;
        handlers.onOpen?.();

        await consumeSseBody(
          response.body,
          (frame) => {
            if (frame.id) {
              lastEventId = frame.id;
            }

            if (!frame.data) {
              return;
            }

            let payload: unknown;
            try {
              payload = JSON.parse(frame.data);
            } catch (error) {
              handlers.onError?.(error);
              return;
            }

            const validation = validateSseEvent<StreamEvent>(payload);
            if (validation.ok === false) {
              handlers.onError?.(
                new ContractValidationError(
                  SSE_SCHEMA_PATHS.streamEvent,
                  validation.errors,
                  payload,
                ),
              );
              return;
            }

            handlers.onEvent(validation.data, frame);
          },
          internalSignal,
        );
      } catch (error) {
        if (isAbortError(error) || internalSignal.aborted) {
          break;
        }

        handlers.onError?.(error);
        reconnectAttempt += 1;
        const backoff = Math.min(
          reconnectMaxDelayMs,
          reconnectBaseDelayMs * 2 ** (reconnectAttempt - 1),
        );
        await delay(backoff, internalSignal);
      }
    }

    handlers.onClose?.();
  };

  void run();

  return {
    close() {
      abortController.abort();
    },
  };
}
