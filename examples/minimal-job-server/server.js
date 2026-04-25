import express from "express";
import http from "node:http";

const DEFAULT_TOKEN = process.env.JOB_SERVER_TOKEN ?? "dev-token";
const DEFAULT_PORT = Number(process.env.PORT ?? 8080);

function nowIso() {
  return new Date().toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createInitialState() {
  const createdAt = nowIso();

  const jobs = [
    {
      job_id: "job.prepare.001",
      name: "Prepare sources",
      status: "running",
      depends_on: [],
      created_at: createdAt,
      updated_at: createdAt,
    },
    {
      job_id: "job.import.001",
      name: "Import data",
      status: "waiting_dependency",
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
        status: "running",
        started_at: createdAt,
        finished_at: null,
      },
      {
        task_id: "notify-observers",
        name: "Notify observers",
        required: false,
        status: "queued",
        started_at: null,
        finished_at: null,
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
      },
      {
        task_id: "publish-analytics",
        name: "Publish analytics",
        required: false,
        status: "queued",
        started_at: null,
        finished_at: null,
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
      },
    ],
  };

  return {
    jobs,
    tasksByJobId,
  };
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

function errorEnvelope(code, message, details) {
  const response = {
    error: {
      code,
      message,
    },
  };

  if (details) {
    response.error.details = details;
  }

  return response;
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

function toJobDetail(job, tasks) {
  return {
    ...job,
    dependency_mode: "all_of",
    required_task_summary: computeRequiredTaskSummary(tasks),
  };
}

function createMinimalJobServer(options = {}) {
  const token = options.token ?? DEFAULT_TOKEN;
  const heartbeatMs = options.heartbeatMs ?? 15_000;
  const simulationMs = options.simulationMs ?? 8_000;
  const state = createInitialState();

  const app = express();
  const server = http.createServer(app);
  const clients = new Set();
  const eventHistory = [];
  const historyLimit = 200;
  let nextEventNumber = 1;
  let heartbeatTimer;
  let simulationTimer;
  let simulationStep = 0;

  function getJobById(jobId) {
    return state.jobs.find((job) => job.job_id === jobId);
  }

  function getTasksByJobId(jobId) {
    return state.tasksByJobId[jobId] ?? [];
  }

  function listJobsFiltered(filters = {}) {
    return state.jobs.filter((job) => {
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

  function sseFrame(eventId, eventType, payload) {
    return `id: ${eventId}\nevent: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
  }

  function shouldSendToClient(client, jobId) {
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
      const job = getJobById(jobId);
      if (!job) {
        return false;
      }
      return client.filters.statuses.includes(job.status);
    }

    return true;
  }

  function nextEventId() {
    const id = `evt_${String(nextEventNumber).padStart(6, "0")}`;
    nextEventNumber += 1;
    return id;
  }

  function writeEvent(eventType, jobId, payload) {
    const eventId = nextEventId();
    const eventPayload = {
      event_id: eventId,
      event_type: eventType,
      schema_version: "1.0.0",
      occurred_at: nowIso(),
      job_id: jobId,
      payload,
    };

    eventHistory.push({
      id: eventId,
      type: eventType,
      jobId,
      payload: clone(eventPayload),
    });

    if (eventHistory.length > historyLimit) {
      eventHistory.shift();
    }

    for (const client of clients) {
      if (shouldSendToClient(client, jobId)) {
        client.res.write(sseFrame(eventId, eventType, eventPayload));
      }
    }

    return eventId;
  }

  function updateJobStatus(jobId, status) {
    const job = getJobById(jobId);
    if (!job) {
      return;
    }
    job.status = status;
    job.updated_at = nowIso();
    writeEvent("job.updated", job.job_id, { status: job.status });
  }

  function updateTaskStatus(jobId, taskId, status) {
    const tasks = getTasksByJobId(jobId);
    const task = tasks.find((item) => item.task_id === taskId);
    if (!task) {
      return;
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
    writeEvent("task.updated", jobId, {
      task_id: task.task_id,
      required: task.required,
      status: task.status,
    });
  }

  function applySimulationStep() {
    simulationStep = (simulationStep + 1) % 5;

    if (simulationStep === 1) {
      updateTaskStatus("job.prepare.001", "fetch-source", "succeeded");
      updateTaskStatus("job.prepare.001", "notify-observers", "succeeded");
      updateJobStatus("job.prepare.001", "succeeded");
      updateJobStatus("job.import.001", "running");
      updateTaskStatus("job.import.001", "transform-records", "running");
      return;
    }

    if (simulationStep === 2) {
      updateTaskStatus("job.import.001", "transform-records", "failed");
      updateTaskStatus("job.import.001", "publish-analytics", "cancelled");
      updateJobStatus("job.import.001", "failed");
      updateJobStatus("job.report.001", "cancelled");
      return;
    }

    if (simulationStep === 3) {
      const reset = createInitialState();
      state.jobs.splice(0, state.jobs.length, ...reset.jobs);
      state.tasksByJobId = reset.tasksByJobId;
      writeEvent("job.updated", "job.prepare.001", { status: "running" });
      return;
    }

    if (simulationStep === 4) {
      updateTaskStatus("job.prepare.001", "fetch-source", "running");
    }
  }

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
    const limitValue = Number(req.query.limit ?? 50);
    const limit = Number.isFinite(limitValue)
      ? Math.min(Math.max(limitValue, 1), 200)
      : 50;

    const filtered = listJobsFiltered({ statuses }).slice(0, limit);
    res.json({
      items: filtered.map((job) => clone(job)),
      next_cursor: null,
    });
  });

  app.get("/v1/jobs/:job_id", authMiddleware, (req, res) => {
    const job = getJobById(req.params.job_id);
    if (!job) {
      res
        .status(404)
        .json(
          errorEnvelope("not_found", `Job ${req.params.job_id} was not found.`),
        );
      return;
    }

    const tasks = getTasksByJobId(job.job_id);
    res.json(toJobDetail(clone(job), clone(tasks)));
  });

  app.get("/v1/jobs/:job_id/tasks", authMiddleware, (req, res) => {
    const job = getJobById(req.params.job_id);
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
      items: clone(getTasksByJobId(job.job_id)),
    });
  });

  app.get("/v1/stream", authMiddleware, (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const filters = {
      jobIds: parseMultiValue(req.query.job_id),
      statuses: parseMultiValue(req.query.status),
    };

    const client = { res, filters };
    clients.add(client);

    const lastEventId = req.header("last-event-id");
    if (lastEventId) {
      const index = eventHistory.findIndex((entry) => entry.id === lastEventId);
      const replay = index >= 0 ? eventHistory.slice(index + 1) : [];
      for (const entry of replay) {
        if (shouldSendToClient(client, entry.jobId)) {
          res.write(sseFrame(entry.id, entry.type, entry.payload));
        }
      }
    } else {
      const jobs = listJobsFiltered({
        jobIds: filters.jobIds,
        statuses: filters.statuses,
      });

      for (const job of jobs) {
        const eventId = nextEventId();
        const payload = {
          event_id: eventId,
          event_type: "snapshot",
          schema_version: "1.0.0",
          occurred_at: nowIso(),
          job_id: job.job_id,
          payload: {
            job: clone(job),
            tasks: clone(getTasksByJobId(job.job_id)),
          },
        };

        eventHistory.push({
          id: eventId,
          type: "snapshot",
          jobId: job.job_id,
          payload: clone(payload),
        });
        if (eventHistory.length > historyLimit) {
          eventHistory.shift();
        }
        res.write(sseFrame(eventId, "snapshot", payload));
      }
    }

    req.on("close", () => {
      clients.delete(client);
    });
  });

  app.use((req, res) => {
    res
      .status(404)
      .json(errorEnvelope("not_found", `Route ${req.path} was not found.`));
  });

  function start(port = DEFAULT_PORT) {
    return new Promise((resolve) => {
      server.listen(port, () => {
        heartbeatTimer = setInterval(() => {
          const heartbeatJobId = "job.prepare.001";
          writeEvent("heartbeat", heartbeatJobId, {
            interval_seconds: Math.round(heartbeatMs / 1000),
          });
        }, heartbeatMs);

        simulationTimer = setInterval(applySimulationStep, simulationMs);
        resolve();
      });
    });
  }

  async function stop() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
    }
    if (simulationTimer) {
      clearInterval(simulationTimer);
    }

    for (const client of clients) {
      client.res.end();
    }
    clients.clear();

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
