import { describe, expect, it } from "vitest";
import { getConformitySummary, runConformitySuite } from "./suite";

describe("conformity summary", () => {
  it("fails minimum if a required check fails", () => {
    const result = getConformitySummary([
      {
        id: "health",
        title: "health",
        requiredForMinimum: true,
        state: "failed",
        detail: "nope",
      },
      {
        id: "heartbeat",
        title: "heartbeat",
        requiredForMinimum: false,
        state: "failed",
        detail: "late",
      },
    ]);

    expect(result.minimumPassed).toBe(false);
    expect(result.fullPassed).toBe(false);
    expect(result.scorePercent).toBe(0);
  });

  it("passes minimum when required checks pass and optional checks fail", () => {
    const result = getConformitySummary([
      {
        id: "health",
        title: "health",
        requiredForMinimum: true,
        state: "passed",
        detail: "ok",
      },
      {
        id: "heartbeat",
        title: "heartbeat",
        requiredForMinimum: false,
        state: "failed",
        detail: "late",
      },
    ]);

    expect(result.minimumPassed).toBe(true);
    expect(result.fullPassed).toBe(false);
    expect(result.scorePercent).toBe(50);
  });
});

describe("conformity suite abort", () => {
  it("stops with abort signal", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      runConformitySuite({
        baseUrl: "http://localhost:8080",
        token: "token",
        signal: controller.signal,
        onChecks: () => {},
      }),
    ).rejects.toThrow();
  });
});
