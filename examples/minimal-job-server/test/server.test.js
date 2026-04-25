import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createMinimalJobServer } from "../server.js";

function parseSseFrames(buffer) {
  const chunks = buffer.replace(/\r\n/g, "\n").split("\n\n");
  const remainder = chunks.pop() ?? "";
  const frames = chunks.map((chunk) => {
    const frame = {};
    const lines = chunk.split("\n");
    const dataLines = [];
    for (const line of lines) {
      if (!line || line.startsWith(":")) {
        continue;
      }
      const separator = line.indexOf(":");
      const key = separator === -1 ? line : line.slice(0, separator);
      const value =
        separator === -1 ? "" : line.slice(separator + 1).trimStart();
      if (key === "id") {
        frame.id = value;
      } else if (key === "event") {
        frame.event = value;
      } else if (key === "data") {
        dataLines.push(value);
      }
    }
    if (dataLines.length > 0) {
      frame.data = JSON.parse(dataLines.join("\n"));
    }
    return frame;
  });

  return { frames, remainder };
}

async function collectSseEvents(response, matcher, timeoutMs = 12_000) {
  const reader = response.body.getReader();
  const started = Date.now();
  let buffer = "";
  const collected = [];

  while (Date.now() - started < timeoutMs) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += new TextDecoder().decode(value, { stream: true });
    const parsed = parseSseFrames(buffer);
    buffer = parsed.remainder;

    for (const frame of parsed.frames) {
      collected.push(frame);
      if (matcher(frame, collected)) {
        await reader.cancel();
        return collected;
      }
    }
  }

  await reader.cancel();
  throw new Error("Timed out while collecting SSE frames.");
}

describe("minimal job server example", () => {
  const token = "test-token";
  const minimalServer = createMinimalJobServer({
    token,
    heartbeatMs: 1_000,
    tickMs: 250,
    taskRuntimeMs: 350,
  });

  let baseUrl = "";

  beforeAll(async () => {
    await minimalServer.start(0);
    const address = minimalServer.server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await minimalServer.stop();
  });

  it("rejects /v1/jobs requests without valid bearer token", async () => {
    const response = await request(minimalServer.app).get("/v1/jobs");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("unauthorized");
  });

  it("serves jobs and details with depends_on", async () => {
    const list = await request(minimalServer.app)
      .get("/v1/jobs")
      .set("Authorization", `Bearer ${token}`)
      .set("Accept", "application/json");

    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.items)).toBe(true);
    expect(list.body.items.length).toBeGreaterThan(0);
    expect(Array.isArray(list.body.items[0].depends_on)).toBe(true);

    const sampleJobId = list.body.items[0].job_id;
    const detail = await request(minimalServer.app)
      .get(`/v1/jobs/${sampleJobId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("Accept", "application/json");

    expect(detail.status).toBe(200);
    expect(Array.isArray(detail.body.depends_on)).toBe(true);
    expect(detail.body.dependency_mode).toBe("all_of");
    expect(detail.body.required_task_summary).toBeDefined();
  });

  it("returns 400 for unsupported status filter values", async () => {
    const response = await request(minimalServer.app)
      .get("/v1/jobs?status=unknown")
      .set("Authorization", `Bearer ${token}`)
      .set("Accept", "application/json");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("validation_error");
  });

  it("supports CORS preflight and CORS headers for browser clients", async () => {
    const preflight = await request(minimalServer.app)
      .options("/v1/jobs")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "GET")
      .set("Access-Control-Request-Headers", "authorization,last-event-id");

    expect(preflight.status).toBe(204);
    expect(preflight.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );
    expect(preflight.headers["access-control-allow-methods"]).toContain("GET");
    expect(preflight.headers["access-control-allow-headers"]).toContain(
      "Last-Event-ID",
    );

    const list = await request(minimalServer.app)
      .get("/v1/jobs")
      .set("Origin", "http://localhost:5173")
      .set("Authorization", `Bearer ${token}`)
      .set("Accept", "application/json");

    expect(list.status).toBe(200);
    expect(list.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );
  });

  it("progresses jobs through a realistic lifecycle", async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 2_000);
    });

    const list = await request(minimalServer.app)
      .get("/v1/jobs")
      .set("Authorization", `Bearer ${token}`)
      .set("Accept", "application/json");

    expect(list.status).toBe(200);
    expect(list.body.items.some((job) => job.status === "succeeded")).toBe(
      true,
    );

    const reportJob = list.body.items.find(
      (job) => job.job_id === "job.report.001",
    );
    expect(reportJob).toBeDefined();
    expect([
      "waiting_dependency",
      "running",
      "succeeded",
      "completed",
    ]).toContain(reportJob.status);
  });

  it("streams snapshot and heartbeat events and accepts Last-Event-ID", async () => {
    const response = await fetch(`${baseUrl}/v1/stream`, {
      headers: {
        Accept: "text/event-stream",
        Authorization: `Bearer ${token}`,
      },
    });

    expect(response.status).toBe(200);

    const events = await collectSseEvents(
      response,
      (frame, all) =>
        frame.event === "heartbeat" &&
        all.some((item) => item.event === "snapshot"),
      12_000,
    );

    const snapshot = events.find((event) => event.event === "snapshot");
    const heartbeat = events.find((event) => event.event === "heartbeat");

    expect(snapshot).toBeDefined();
    expect(heartbeat).toBeDefined();
    expect(snapshot.data.event_type).toBe("snapshot");
    expect(heartbeat.data.event_type).toBe("heartbeat");
    expect(snapshot.data.payload.job.depends_on).toBeDefined();
    expect(Array.isArray(snapshot.data.payload.tasks)).toBe(true);

    const resumeResponse = await fetch(`${baseUrl}/v1/stream`, {
      headers: {
        Accept: "text/event-stream",
        Authorization: `Bearer ${token}`,
        "Last-Event-ID": heartbeat.id,
      },
    });

    expect(resumeResponse.status).toBe(200);
    if (resumeResponse.body) {
      await resumeResponse.body.cancel();
    }
  });
});
