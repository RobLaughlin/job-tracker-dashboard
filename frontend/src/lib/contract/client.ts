import { REST_SCHEMA_PATHS } from "./schema-paths";
import { ContractValidationError, JobServerHttpError } from "./errors";
import {
  openValidatedEventStream,
  type StreamFilter,
  type StreamHandlers,
} from "./sse";
import type {
  ErrorResponse,
  HealthResponse,
  JobDetailResponse,
  JobsListResponse,
  JobStatus,
  JobTasksResponse,
} from "./types";
import { validateSchema } from "./validators";

export type JobServerClientConfig = {
  baseUrl: string;
  token: string;
  fetchImpl?: typeof fetch;
};

export type ListJobsParams = {
  limit?: number;
  cursor?: string;
  statuses?: JobStatus[];
};

export type OpenStreamParams = {
  filter?: StreamFilter;
  signal?: AbortSignal;
};

export type JobServerClient = {
  getHealth: () => Promise<HealthResponse>;
  listJobs: (params?: ListJobsParams) => Promise<JobsListResponse>;
  getJob: (jobId: string) => Promise<JobDetailResponse>;
  getTasks: (jobId: string) => Promise<JobTasksResponse>;
  openStream: (
    params: OpenStreamParams,
    handlers: StreamHandlers,
  ) => { close: () => void };
};

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function buildUrl(baseUrl: string, pathname: string, query?: URLSearchParams) {
  const url = new URL(`${normalizeBaseUrl(baseUrl)}${pathname}`);
  if (query) {
    url.search = query.toString();
  }
  return url;
}

async function parseErrorResponse(
  payload: unknown,
): Promise<ErrorResponse | undefined> {
  const validation = validateSchema<ErrorResponse>(
    REST_SCHEMA_PATHS.errorResponse,
    payload,
  );
  return validation.ok ? validation.data : undefined;
}

export function createJobServerClient(
  config: JobServerClientConfig,
): JobServerClient {
  const fetchImpl = config.fetchImpl ?? fetch;

  async function requestJson<T>(
    pathname: string,
    schemaPath: (typeof REST_SCHEMA_PATHS)[keyof typeof REST_SCHEMA_PATHS],
    query?: URLSearchParams,
  ): Promise<T> {
    const url = buildUrl(config.baseUrl, pathname, query);
    const response = await fetchImpl(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${config.token}`,
      },
    });

    const contentType = response.headers.get("content-type") ?? "";
    const isJson = contentType.includes("application/json");
    const payload = isJson ? await response.json() : undefined;

    if (!response.ok) {
      const details = await parseErrorResponse(payload);
      throw new JobServerHttpError(response.status, url.toString(), details);
    }

    const validation = validateSchema<T>(schemaPath, payload);
    if (validation.ok === false) {
      throw new ContractValidationError(schemaPath, validation.errors, payload);
    }

    return validation.data;
  }

  return {
    getHealth: () =>
      requestJson("/v1/health", REST_SCHEMA_PATHS.healthResponse),
    listJobs: (params) => {
      const query = new URLSearchParams();
      if (params?.limit !== undefined) {
        query.set("limit", String(params.limit));
      }
      if (params?.cursor) {
        query.set("cursor", params.cursor);
      }
      for (const status of params?.statuses ?? []) {
        query.append("status", status);
      }
      return requestJson("/v1/jobs", REST_SCHEMA_PATHS.jobsListResponse, query);
    },
    getJob: (jobId) =>
      requestJson(
        `/v1/jobs/${encodeURIComponent(jobId)}`,
        REST_SCHEMA_PATHS.jobDetailResponse,
      ),
    getTasks: (jobId) =>
      requestJson(
        `/v1/jobs/${encodeURIComponent(jobId)}/tasks`,
        REST_SCHEMA_PATHS.jobTasksResponse,
      ),
    openStream: ({ filter, signal }, handlers) =>
      openValidatedEventStream(
        {
          baseUrl: config.baseUrl,
          token: config.token,
          filter,
          signal,
        },
        handlers,
      ),
  };
}
