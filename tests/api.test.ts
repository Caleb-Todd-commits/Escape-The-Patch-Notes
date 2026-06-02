import { afterEach, describe, expect, it, vi } from "vitest";
import handler from "../api/run";

interface MockResponse {
  statusCode: number;
  payload: unknown;
  ended: boolean;
  status(code: number): MockResponse;
  json(value: unknown): void;
  end(): void;
}

describe("/api/run", () => {
  const originalKey = process.env.OPENAI_API_KEY;

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it("returns fallback run when no server-side key is configured", async () => {
    delete process.env.OPENAI_API_KEY;
    const res = createMockResponse();

    await handler({ method: "POST", body: { seed: "api-test", difficulty: "normal" } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({
      seed: "api-test",
      source: "fallback",
      buildName: "Midnight Hotfix",
    });
  });

  it("rejects unsupported methods", async () => {
    const res = createMockResponse();

    await handler({ method: "GET" }, res);

    expect(res.statusCode).toBe(405);
    expect(res.payload).toEqual({ error: "Method not allowed" });
  });
});

function createMockResponse(): MockResponse {
  return {
    statusCode: 200,
    payload: undefined,
    ended: false,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(value: unknown) {
      this.payload = value;
    },
    end() {
      this.ended = true;
    },
  };
}
