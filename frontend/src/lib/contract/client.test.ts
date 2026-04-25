import { describe, expect, it, vi } from "vitest";
import { createJobServerClient } from "./client";
import { ContractValidationError, JobServerHttpError } from "./errors";

describe("createJobServerClient", () => {
  it("returns validated health response", async () => {
    const fetchImpl: typeof fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            status: "ok",
            service: "job-server",
            api_version: "v1",
            schema_version: "1.0.0",
            time: "2026-04-25T11:22:33Z",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
    ) as typeof fetch;

    const client = createJobServerClient({
      baseUrl: "https://jobserver.example.io",
      token: "token",
      fetchImpl,
    });

    const response = await client.getHealth();
    expect(response.status).toBe("ok");
  });

  it("throws validation error for schema-invalid success payload", async () => {
    const fetchImpl: typeof fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ status: "not-ok" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    ) as typeof fetch;

    const client = createJobServerClient({
      baseUrl: "https://jobserver.example.io",
      token: "token",
      fetchImpl,
    });

    await expect(client.getHealth()).rejects.toBeInstanceOf(
      ContractValidationError,
    );
  });

  it("throws http error for non-2xx responses", async () => {
    const fetchImpl: typeof fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: {
              code: "unauthorized",
              message: "token missing",
            },
          }),
          {
            status: 401,
            headers: { "content-type": "application/json" },
          },
        ),
    ) as typeof fetch;

    const client = createJobServerClient({
      baseUrl: "https://jobserver.example.io",
      token: "token",
      fetchImpl,
    });

    await expect(client.getHealth()).rejects.toBeInstanceOf(JobServerHttpError);
  });
});
