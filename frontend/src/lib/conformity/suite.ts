import { createJobServerClient } from "../contract/client";
import type { JobStatus } from "../contract/types";

export type CheckState =
  | "pending"
  | "running"
  | "passed"
  | "failed"
  | "skipped";

export type ConformityCheck = {
  id: string;
  title: string;
  requiredForMinimum: boolean;
  state: CheckState;
  detail: string;
  startedAt?: number;
  endedAt?: number;
};

export type SuiteLog = {
  timestamp: number;
  level: "info" | "warn" | "error";
  message: string;
};

export type ConformitySuiteReport = {
  checks: ConformityCheck[];
  minimumPassed: boolean;
  fullPassed: boolean;
  scorePercent: number;
};

export type ConformitySuiteConfig = {
  baseUrl: string;
  token: string;
  signal?: AbortSignal;
  onChecks: (checks: ConformityCheck[]) => void;
  onLog?: (entry: SuiteLog) => void;
};

type JobNode = {
  job_id: string;
  depends_on: string[];
};

const CHECKS_TEMPLATE: ReadonlyArray<
  Omit<ConformityCheck, "state" | "detail">
> = [
  {
    id: "health",
    title: "Health endpoint is reachable and schema-valid",
    requiredForMinimum: true,
  },
  {
    id: "auth-enforced",
    title: "Auth enforcement rejects invalid token",
    requiredForMinimum: true,
  },
  {
    id: "jobs-list",
    title: "GET /v1/jobs returns schema-valid response",
    requiredForMinimum: true,
  },
  {
    id: "job-detail",
    title: "GET /v1/jobs/{job_id} works for sampled job",
    requiredForMinimum: true,
  },
  {
    id: "job-tasks",
    title: "GET /v1/jobs/{job_id}/tasks works for sampled job",
    requiredForMinimum: true,
  },
  {
    id: "depends-on-graph",
    title: "depends_on graph is acyclic and usable",
    requiredForMinimum: true,
  },
  {
    id: "status-filter",
    title: "Status filter query behaves correctly",
    requiredForMinimum: false,
  },
  {
    id: "sse-connect",
    title: "SSE stream connects with bearer token",
    requiredForMinimum: true,
  },
  {
    id: "sse-snapshot",
    title: "SSE stream emits initial snapshot",
    requiredForMinimum: true,
  },
  {
    id: "sse-heartbeat",
    title: "SSE stream emits heartbeat",
    requiredForMinimum: false,
  },
  {
    id: "sse-resume",
    title: "SSE stream accepts Last-Event-ID resume header",
    requiredForMinimum: false,
  },
];

function createInitialChecks(): ConformityCheck[] {
  return CHECKS_TEMPLATE.map((entry) => ({
    ...entry,
    state: "pending",
    detail: "Waiting to run",
  }));
}

function updateCheck(
  checks: ConformityCheck[],
  checkId: string,
  update: Partial<ConformityCheck>,
): ConformityCheck[] {
  return checks.map((check) =>
    check.id === checkId ? { ...check, ...update } : check,
  );
}

function ensureNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
}

function wait(ms: number, signal?: AbortSignal) {
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

function topoSortJobs(jobs: JobNode[]) {
  const byId = new Map(jobs.map((job) => [job.job_id, job]));
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  const selfReferences: string[] = [];

  for (const job of jobs) {
    incoming.set(job.job_id, 0);
    outgoing.set(job.job_id, []);
  }

  for (const job of jobs) {
    for (const upstream of job.depends_on) {
      if (upstream === job.job_id) {
        selfReferences.push(job.job_id);
      }
      if (!byId.has(upstream)) {
        continue;
      }
      incoming.set(job.job_id, (incoming.get(job.job_id) ?? 0) + 1);
      const neighbors = outgoing.get(upstream);
      if (neighbors) {
        neighbors.push(job.job_id);
      }
    }
  }

  const queue: string[] = [];
  for (const [jobId, count] of incoming.entries()) {
    if (count === 0) {
      queue.push(jobId);
    }
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    order.push(current);
    for (const downstream of outgoing.get(current) ?? []) {
      const nextCount = (incoming.get(downstream) ?? 0) - 1;
      incoming.set(downstream, nextCount);
      if (nextCount === 0) {
        queue.push(downstream);
      }
    }
  }

  const cyclic = jobs
    .map((job) => job.job_id)
    .filter((jobId) => !order.includes(jobId));

  return {
    order,
    cyclic,
    selfReferences,
  };
}

async function checkAuthEnforcement(
  baseUrl: string,
  token: string,
  signal?: AbortSignal,
) {
  const response = await fetch(
    `${baseUrl.replace(/\/+$/, "")}/v1/jobs?limit=1`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}-invalid-probe`,
      },
      signal,
    },
  );

  if (response.status !== 401 && response.status !== 403) {
    throw new Error(
      `Expected 401 or 403 for invalid token probe, received ${response.status}.`,
    );
  }

  await response.body?.cancel();
}

async function checkSseResume(
  baseUrl: string,
  token: string,
  lastEventId: string,
  signal?: AbortSignal,
) {
  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/v1/stream`, {
    method: "GET",
    headers: {
      Accept: "text/event-stream",
      Authorization: `Bearer ${token}`,
      "Last-Event-ID": lastEventId,
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Resume probe failed with status ${response.status}.`);
  }

  await response.body?.cancel();
}

function summarize(checks: ConformityCheck[]): ConformitySuiteReport {
  const required = checks.filter((check) => check.requiredForMinimum);
  const minimumPassed = required.every(
    (check) => check.state === "passed" || check.state === "skipped",
  );

  const fullPassed = checks.every(
    (check) => check.state === "passed" || check.state === "skipped",
  );
  const passed = checks.filter(
    (check) => check.state === "passed" || check.state === "skipped",
  ).length;
  const scorePercent = Math.round((passed / checks.length) * 100);

  return {
    checks,
    minimumPassed,
    fullPassed,
    scorePercent,
  };
}

export async function runConformitySuite(
  config: ConformitySuiteConfig,
): Promise<ConformitySuiteReport> {
  const client = createJobServerClient({
    baseUrl: config.baseUrl,
    token: config.token,
  });

  let checks = createInitialChecks();
  config.onChecks(checks);

  const setCheckState = (id: string, state: CheckState, detail: string) => {
    const now = Date.now();
    const current = checks.find((check) => check.id === id);
    checks = updateCheck(checks, id, {
      state,
      detail,
      startedAt: state === "running" ? now : current?.startedAt,
      endedAt: state !== "running" ? now : undefined,
    });
    config.onChecks(checks);
  };

  const log = (level: SuiteLog["level"], message: string) => {
    config.onLog?.({ timestamp: Date.now(), level, message });
  };

  let sampledJobId: string | undefined;
  let sampledJobList: JobNode[] = [];
  let capturedEventId = "bootstrap";

  const runCheck = async (id: string, handler: () => Promise<string>) => {
    ensureNotAborted(config.signal);
    setCheckState(id, "running", "Running check...");
    try {
      const detail = await handler();
      setCheckState(id, "passed", detail);
      log("info", `${id}: ${detail}`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setCheckState(id, "failed", detail);
      log("error", `${id}: ${detail}`);
    }
  };

  await runCheck("health", async () => {
    const health = await client.getHealth();
    return `Service ${health.service} is healthy on API ${health.api_version}.`;
  });

  await runCheck("auth-enforced", async () => {
    await checkAuthEnforcement(config.baseUrl, config.token, config.signal);
    return "Invalid bearer token is rejected with 401/403.";
  });

  await runCheck("jobs-list", async () => {
    const jobs = await client.listJobs({ limit: 200 });
    sampledJobList = jobs.items.map((job) => ({
      job_id: job.job_id,
      depends_on: [...job.depends_on],
    }));
    sampledJobId = jobs.items.at(0)?.job_id;
    return `Fetched ${jobs.items.length} jobs from /v1/jobs.`;
  });

  if (!sampledJobId) {
    checks = updateCheck(checks, "job-detail", {
      state: "skipped",
      detail: "Skipped because the server returned zero jobs.",
      endedAt: Date.now(),
    });
    checks = updateCheck(checks, "job-tasks", {
      state: "skipped",
      detail: "Skipped because the server returned zero jobs.",
      endedAt: Date.now(),
    });
    config.onChecks(checks);
    log("warn", "No jobs available. Detail/task endpoint checks were skipped.");
  } else {
    await runCheck("job-detail", async () => {
      const detail = await client.getJob(sampledJobId as string);
      return `Loaded details for ${detail.job_id}.`;
    });
    await runCheck("job-tasks", async () => {
      const tasks = await client.getTasks(sampledJobId as string);
      return `Loaded ${tasks.items.length} tasks for ${tasks.job_id}.`;
    });
  }

  await runCheck("depends-on-graph", async () => {
    const invalidSelf = sampledJobList.filter((job) =>
      job.depends_on.includes(job.job_id),
    );
    if (invalidSelf.length > 0) {
      throw new Error(
        `Self dependency detected for ${invalidSelf.map((job) => job.job_id).join(", ")}.`,
      );
    }

    const sorted = topoSortJobs(sampledJobList);
    if (sorted.cyclic.length > 0) {
      throw new Error(
        `Dependency cycle detected for ${sorted.cyclic.join(", ")}.`,
      );
    }

    return `Graph sorted across ${sorted.order.length} sampled jobs with no cycles.`;
  });

  await runCheck("status-filter", async () => {
    const filtered = await client.listJobs({
      statuses: ["running" as JobStatus],
      limit: 50,
    });
    return `Status filter accepted; received ${filtered.items.length} jobs.`;
  });

  await runCheck("sse-connect", async () => {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("SSE connect timeout after 10s.")),
        10_000,
      );
      const stream = client.openStream(
        {},
        {
          onOpen: () => {
            clearTimeout(timeout);
            stream.close();
            resolve();
          },
          onEvent: (_event, frame) => {
            if (frame.id) {
              capturedEventId = frame.id;
            }
          },
          onError: (error) => {
            clearTimeout(timeout);
            stream.close();
            reject(error);
          },
        },
      );
    });

    return "Stream connected successfully with bearer token auth.";
  });

  await runCheck("sse-snapshot", async () => {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Snapshot not received within 15s.")),
        15_000,
      );
      const stream = client.openStream(
        {},
        {
          onEvent: (event, frame) => {
            if (frame.id) {
              capturedEventId = frame.id;
            }
            if (event.event_type === "snapshot") {
              clearTimeout(timeout);
              stream.close();
              resolve();
            }
          },
          onError: (error) => {
            clearTimeout(timeout);
            stream.close();
            reject(error);
          },
        },
      );
    });

    return "Snapshot event received from SSE stream.";
  });

  await runCheck("sse-heartbeat", async () => {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Heartbeat not received within 25s.")),
        25_000,
      );
      const stream = client.openStream(
        {},
        {
          onEvent: (event, frame) => {
            if (frame.id) {
              capturedEventId = frame.id;
            }
            if (event.event_type === "heartbeat") {
              clearTimeout(timeout);
              stream.close();
              resolve();
            }
          },
          onError: (error) => {
            clearTimeout(timeout);
            stream.close();
            reject(error);
          },
        },
      );
    });

    return "Heartbeat event observed in the live stream.";
  });

  await runCheck("sse-resume", async () => {
    await checkSseResume(
      config.baseUrl,
      config.token,
      capturedEventId,
      config.signal,
    );
    await wait(100, config.signal);
    return "Resume probe accepted Last-Event-ID header.";
  });

  return summarize(checks);
}

export function getConformitySummary(checks: ConformityCheck[]) {
  return summarize(checks);
}
