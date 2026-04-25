import express from "express";
import http from "node:http";

const JOB_STATUSES = new Set([
  "queued",
  "waiting_dependency",
  "running",
  "failed",
  "completed",
  "succeeded",
  "cancelled",
]);

const TASK_STATUSES = new Set([
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);

const TERMINAL_JOB_STATUSES = new Set([
  "failed",
  "completed",
  "succeeded",
  "cancelled",
]);

const DEFAULT_TOKEN = process.env.JOB_SERVER_TOKEN ?? "dev-token";
const DEFAULT_PORT = Number(process.env.PORT ?? 8080);
const DEFAULT_HEARTBEAT_MS = Number(process.env.HEARTBEAT_MS ?? 5_000);
const DEFAULT_TICK_MS = Number(process.env.RUNNER_TICK_MS ?? 1_500);
const DEFAULT_TASK_RUNTIME_MS = Number(process.env.TASK_RUNTIME_MS ?? 2_000);
const DEFAULT_ALLOWED_ORIGINS =
  process.env.CORS_ALLOWED_ORIGINS ?? "http://localhost:5173";

function nowIso() {
  return new Date().toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseMultiValue(queryValue) {
  if (Array.isArray(queryValue)) {
    return queryValue.filter((value) => typeof value === "string");
  }
  if (typeof queryValue === "string") {
    return [queryValue];
  }
  return [];
}

function parseInteger(raw, fallback, min, max) {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(Math.max(value, min), max);
}

function errorEnvelope(code, message, details) {
  const payload = {
    error: {
      code,
      message,
    },
  };

  if (details && details.length > 0) {
    payload.error.details = details;
  }

  return payload;
}

function parseAllowedOrigins(raw) {
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function applyCors(req, res, next, options) {
  const origin = req.header("origin");
  const isAllowed = Boolean(origin && options.allowedOrigins.includes(origin));

  if (isAllowed) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Vary", "Origin");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, Last-Event-ID",
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
}

function createInitialState() {
  const createdAt = nowIso();

  const jobs = [
    {
      job_id: "job.prepare.001",
      name: "Prepare sources",
      status: "queued",
      depends_on: [],
      created_at: createdAt,
      updated_at: createdAt,
    },
    {
      job_id: "job.import.001",
      name: "Import data",
      status: "queued",
      depends_on: ["job.prepare.001"],
      created_at: createdAt,
      updated_at: createdAt,
    },
    {
      job_id: "job.report.001",
      name: "Publish report",
      status: "queued",
      depends_on: ["job.import.001"],
      created_at: createdAt,
      updated_at: createdAt,
    },
  ];

  const tasksByJobId = {
    "job.prepare.001": [
      {
        task_id: "fetch-source",
        name: "Fetch source",
        required: true,
        status: "queued",
        started_at: null,
        finished_at: null,
        expected_terminal_status: "succeeded",
      },
      {
        task_id: "notify-observers",
        name: "Notify observers",
        required: false,
        status: "queued",
        started_at: null,
        finished_at: null,
        expected_terminal_status: "succeeded",
      },
    ],
    "job.import.001": [
      {
        task_id: "transform-records",
        name: "Transform records",
        required: true,
        status: "queued",
        started_at: null,
        finished_at: null,
        expected_terminal_status: "succeeded",
      },
      {
        task_id: "publish-analytics",
        name: "Publish analytics",
        required: false,
        status: "queued",
        started_at: null,
        finished_at: null,
        expected_terminal_status: "succeeded",
      },
    ],
    "job.report.001": [
      {
        task_id: "compile-report",
        name: "Compile report",
        required: true,
        status: "queued",
        started_at: null,
        finished_at: null,
        expected_terminal_status: "succeeded",
      },
    ],
  };

  return {
    jobs,
    tasksByJobId,
  };
}

function toTaskContract(task) {
  return {
    task_id: task.task_id,
    name: task.name,
    required: task.required,
    status: task.status,
    started_at: task.started_at,
    finished_at: task.finished_at,
  };
}

function computeRequiredTaskSummary(tasks) {
  const requiredTasks = tasks.filter((task) => task.required);
  return {
    total: requiredTasks.length,
    succeeded: requiredTasks.filter((task) => task.status === "succeeded")
      .length,
    failed: requiredTasks.filter((task) => task.status === "failed").length,
    cancelled: requiredTasks.filter((task) => task.status === "cancelled")
      .length,
  };
}

class InMemoryJobStore {
  constructor(initialState) {
    this.jobs = clone(initialState.jobs);
    this.tasksByJobId = clone(initialState.tasksByJobId);
  }

  listJobs(filters = {}) {
    return this.jobs.filter((job) => {
      if (
        filters.jobIds &&
        filters.jobIds.length > 0 &&
        !filters.jobIds.includes(job.job_id)
      ) {
        return false;
      }
      if (
        filters.statuses &&
        filters.statuses.length > 0 &&
        !filters.statuses.includes(job.status)
      ) {
        return false;
      }
      return true;
    });
  }

  getJob(jobId) {
    return this.jobs.find((job) => job.job_id === jobId);
  }

  getTasks(jobId) {
    return this.tasksByJobId[jobId] ?? [];
  }

  setJobStatus(jobId, status) {
    const job = this.getJob(jobId);
    if (!job || job.status === status) {
      return null;
    }

    job.status = status;
    job.updated_at = nowIso();
    return job;
  }

  setTaskStatus(jobId, taskId, status) {
    const tasks = this.getTasks(jobId);
    const task = tasks.find((entry) => entry.task_id === taskId);
    if (!task || task.status === status) {
      return null;
    }

    if (status === "running" && task.started_at === null) {
      task.started_at = nowIso();
    }
    if (
      (status === "succeeded" ||
        status === "failed" ||
        status === "cancelled") &&
      task.finished_at === null
    ) {
      task.finished_at = nowIso();
    }

    task.status = status;
    return task;
  }

  toJobDetail(jobId) {
    const job = this.getJob(jobId);
    if (!job) {
      return null;
    }

    const tasks = this.getTasks(jobId).map((task) => toTaskContract(task));
    return {
      ...clone(job),
      dependency_mode: "all_of",
      required_task_summary: computeRequiredTaskSummary(tasks),
    };
  }
}

class SseBroker {
  constructor(store, historyLimit = 300) {
    this.store = store;
    this.history = [];
    this.historyLimit = historyLimit;
    this.clients = new Set();
    this.nextEventNumber = 1;
  }

  createEvent(eventType, jobId, payload) {
    const eventId = `evt_${String(this.nextEventNumber).padStart(6, "0")}`;
    this.nextEventNumber += 1;

    return {
      id: eventId,
      event: eventType,
      data: {
        event_id: eventId,
        event_type: eventType,
        schema_version: "1.0.0",
        occurred_at: nowIso(),
        job_id: jobId,
        payload,
      },
      jobId,
    };
  }

  writeFrame(res, frame) {
    res.write(`id: ${frame.id}\n`);
    res.write(`event: ${frame.event}\n`);
    res.write(`data: ${JSON.stringify(frame.data)}\n\n`);
  }

  matchesFilter(client, jobId) {
    if (!jobId) {
      return true;
    }

    if (
      client.filters.jobIds.length > 0 &&
      !client.filters.jobIds.includes(jobId)
    ) {
      return false;
    }

    if (client.filters.statuses.length > 0) {
      const job = this.store.getJob(jobId);
      if (!job) {
        return false;
      }
      return client.filters.statuses.includes(job.status);
    }

    return true;
  }

  publish(eventType, jobId, payload) {
    const frame = this.createEvent(eventType, jobId, payload);

    this.history.push(frame);
    if (this.history.length > this.historyLimit) {
      this.history.shift();
    }

    for (const client of this.clients) {
      if (this.matchesFilter(client, frame.jobId)) {
        this.writeFrame(client.res, frame);
      }
    }

    return frame.id;
  }

  registerClient(req, res, filters) {
    const client = { res, filters };
    this.clients.add(client);

    req.on("close", () => {
      this.clients.delete(client);
    });

    return client;
  }

  sendSnapshot(client) {
    const jobs = this.store.listJobs({
      jobIds: client.filters.jobIds,
      statuses: client.filters.statuses,
    });

    for (const job of jobs) {
      const tasks = this.store
        .getTasks(job.job_id)
        .map((task) => toTaskContract(task));
      this.publish("snapshot", job.job_id, {
        job: clone(job),
        tasks: clone(tasks),
      });
    }
  }

  replayOrSnapshot(client, lastEventId) {
    if (!lastEventId) {
      this.sendSnapshot(client);
      return;
    }

    const index = this.history.findIndex((entry) => entry.id === lastEventId);
    if (index < 0) {
      this.sendSnapshot(client);
      return;
    }

    for (const frame of this.history.slice(index + 1)) {
      if (this.matchesFilter(client, frame.jobId)) {
        this.writeFrame(client.res, frame);
      }
    }
  }

  closeAll() {
    for (const client of this.clients) {
      client.res.end();
    }
    this.clients.clear();
  }
}

class JobRunner {
  constructor(store, broker, options) {
    this.store = store;
    this.broker = broker;
    this.tickMs = options.tickMs;
    this.taskRuntimeMs = options.taskRuntimeMs;
    this.timer = null;
  }

  start() {
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => {
      this.tick();
    }, this.tickMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  dependenciesSatisfied(job) {
    if (job.depends_on.length === 0) {
      return true;
    }

    return job.depends_on.every((upstreamJobId) => {
      const upstream = this.store.getJob(upstreamJobId);
      return upstream?.status === "succeeded";
    });
  }

  maybeTransitionWaitingDependency(job) {
    if (job.depends_on.length === 0) {
      return;
    }

    if (job.status === "queued" || job.status === "waiting_dependency") {
      if (!this.dependenciesSatisfied(job)) {
        const changed = this.store.setJobStatus(
          job.job_id,
          "waiting_dependency",
        );
        if (changed) {
          this.broker.publish("job.updated", job.job_id, {
            status: changed.status,
          });
        }
      }
    }
  }

  maybeStartJob(job) {
    if (TERMINAL_JOB_STATUSES.has(job.status)) {
      return;
    }

    if (!this.dependenciesSatisfied(job)) {
      return;
    }

    if (job.status === "queued" || job.status === "waiting_dependency") {
      const changed = this.store.setJobStatus(job.job_id, "running");
      if (changed) {
        this.broker.publish("job.updated", job.job_id, {
          status: changed.status,
        });
      }
    }
  }

  maybeFinishRunningTask(job) {
    if (job.status !== "running") {
      return false;
    }

    const tasks = this.store.getTasks(job.job_id);
    const runningTask = tasks.find((task) => task.status === "running");
    if (!runningTask || !runningTask.started_at) {
      return false;
    }

    const runningMs = Date.now() - new Date(runningTask.started_at).getTime();
    if (runningMs < this.taskRuntimeMs) {
      return false;
    }

    const terminalStatus = runningTask.expected_terminal_status;
    if (!TASK_STATUSES.has(terminalStatus)) {
      throw new Error(`Invalid task terminal status: ${terminalStatus}`);
    }

    const changed = this.store.setTaskStatus(
      job.job_id,
      runningTask.task_id,
      terminalStatus,
    );
    if (changed) {
      this.broker.publish("task.updated", job.job_id, {
        task_id: changed.task_id,
        required: changed.required,
        status: changed.status,
      });
      return true;
    }

    return false;
  }

  maybeStartNextTask(job) {
    if (job.status !== "running") {
      return false;
    }

    const tasks = this.store.getTasks(job.job_id);
    const runningTask = tasks.find((task) => task.status === "running");
    if (runningTask) {
      return false;
    }

    const nextTask = tasks.find((task) => task.status === "queued");
    if (!nextTask) {
      return false;
    }

    const changed = this.store.setTaskStatus(
      job.job_id,
      nextTask.task_id,
      "running",
    );
    if (changed) {
      this.broker.publish("task.updated", job.job_id, {
        task_id: changed.task_id,
        required: changed.required,
        status: changed.status,
      });
      return true;
    }

    return false;
  }

  maybeFinalizeJob(job) {
    if (job.status !== "running") {
      return;
    }

    const tasks = this.store.getTasks(job.job_id);
    const hasQueuedOrRunning = tasks.some(
      (task) => task.status === "queued" || task.status === "running",
    );
    if (hasQueuedOrRunning) {
      return;
    }

    const requiredTasks = tasks.filter((task) => task.required);
    const optionalTasks = tasks.filter((task) => !task.required);

    const requiredFailed = requiredTasks.some(
      (task) => task.status === "failed" || task.status === "cancelled",
    );

    const optionalDegraded = optionalTasks.some(
      (task) => task.status === "failed" || task.status === "cancelled",
    );

    let finalStatus = "succeeded";
    if (requiredFailed) {
      finalStatus = "failed";
    } else if (optionalDegraded) {
      finalStatus = "completed";
    }

    const changed = this.store.setJobStatus(job.job_id, finalStatus);
    if (changed) {
      this.broker.publish("job.updated", job.job_id, {
        status: changed.status,
      });
    }
  }

  tick() {
    const jobs = this.store.listJobs();

    for (const job of jobs) {
      this.maybeTransitionWaitingDependency(job);
      this.maybeStartJob(job);
      this.maybeFinishRunningTask(job);
      this.maybeStartNextTask(job);
      this.maybeFinalizeJob(job);
    }
  }
}

function validateStatusFilter(statuses) {
  const invalid = statuses.filter((status) => !JOB_STATUSES.has(status));
  if (invalid.length > 0) {
    return {
      ok: false,
      invalid,
    };
  }
  return { ok: true };
}

function createMinimalJobServer(options = {}) {
  const token = options.token ?? DEFAULT_TOKEN;
  const heartbeatMs = options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS;
  const tickMs = options.tickMs ?? DEFAULT_TICK_MS;
  const taskRuntimeMs = options.taskRuntimeMs ?? DEFAULT_TASK_RUNTIME_MS;
  const allowedOrigins =
    options.allowedOrigins ?? parseAllowedOrigins(DEFAULT_ALLOWED_ORIGINS);

  const store = new InMemoryJobStore(createInitialState());
  const broker = new SseBroker(store);
  const runner = new JobRunner(store, broker, {
    tickMs,
    taskRuntimeMs,
  });

  const app = express();
  const server = http.createServer(app);
  let heartbeatTimer = null;

  app.use((req, res, next) => {
    applyCors(req, res, next, {
      allowedOrigins,
    });
  });

  function authMiddleware(req, res, next) {
    const authHeader = req.header("authorization") ?? "";
    const expected = `Bearer ${token}`;
    if (authHeader !== expected) {
      res.status(401).json(
        errorEnvelope("unauthorized", "Missing or invalid bearer token.", [
          {
            field: "authorization",
            issue: "expected Authorization: Bearer <token>",
          },
        ]),
      );
      return;
    }
    next();
  }

  app.get("/v1/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "minimal-job-server",
      api_version: "v1",
      schema_version: "1.0.0",
      time: nowIso(),
    });
  });

  app.get("/v1/jobs", authMiddleware, (req, res) => {
    const statuses = parseMultiValue(req.query.status);
    const statusValidation = validateStatusFilter(statuses);
    if (!statusValidation.ok) {
      res.status(400).json(
        errorEnvelope("validation_error", "status contains unsupported value", [
          {
            field: "status",
            issue: `unsupported values: ${statusValidation.invalid.join(", ")}`,
          },
        ]),
      );
      return;
    }

    const limit = parseInteger(req.query.limit, 50, 1, 200);
    const jobs = store.listJobs({ statuses }).slice(0, limit);

    res.json({
      items: jobs.map((job) => clone(job)),
      next_cursor: null,
    });
  });

  app.get("/v1/jobs/:job_id", authMiddleware, (req, res) => {
    const detail = store.toJobDetail(req.params.job_id);
    if (!detail) {
      res
        .status(404)
        .json(
          errorEnvelope("not_found", `Job ${req.params.job_id} was not found.`),
        );
      return;
    }

    res.json(detail);
  });

  app.get("/v1/jobs/:job_id/tasks", authMiddleware, (req, res) => {
    const job = store.getJob(req.params.job_id);
    if (!job) {
      res
        .status(404)
        .json(
          errorEnvelope("not_found", `Job ${req.params.job_id} was not found.`),
        );
      return;
    }

    res.json({
      job_id: job.job_id,
      items: store.getTasks(job.job_id).map((task) => toTaskContract(task)),
    });
  });

  app.get("/v1/stream", authMiddleware, (req, res) => {
    const statuses = parseMultiValue(req.query.status);
    const statusValidation = validateStatusFilter(statuses);
    if (!statusValidation.ok) {
      res.status(400).json(
        errorEnvelope("validation_error", "status contains unsupported value", [
          {
            field: "status",
            issue: `unsupported values: ${statusValidation.invalid.join(", ")}`,
          },
        ]),
      );
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const filters = {
      jobIds: parseMultiValue(req.query.job_id),
      statuses,
    };

    const client = broker.registerClient(req, res, filters);
    const lastEventId = req.header("last-event-id");
    broker.replayOrSnapshot(client, lastEventId);
  });

  app.use((req, res) => {
    res
      .status(404)
      .json(errorEnvelope("not_found", `Route ${req.path} was not found.`));
  });

  function start(port = DEFAULT_PORT) {
    return new Promise((resolve) => {
      server.listen(port, () => {
        runner.start();
        heartbeatTimer = setInterval(() => {
          const heartbeatJob = store.listJobs()[0]?.job_id ?? "job.prepare.001";
          broker.publish("heartbeat", heartbeatJob, {
            interval_seconds: Math.round(heartbeatMs / 1000),
          });
        }, heartbeatMs);
        resolve();
      });
    });
  }

  async function stop() {
    runner.stop();
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }

    broker.closeAll();

    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  return {
    app,
    server,
    start,
    stop,
    token,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const minimalJobServer = createMinimalJobServer({
    token: DEFAULT_TOKEN,
  });

  minimalJobServer.start(DEFAULT_PORT).then(() => {
    console.log(
      `Minimal Job Server listening on http://localhost:${DEFAULT_PORT}`,
    );
    console.log(`Bearer token: ${DEFAULT_TOKEN}`);
  });
}

export { createMinimalJobServer };
