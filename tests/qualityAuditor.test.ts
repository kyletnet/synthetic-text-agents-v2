import { describe, it, expect, vi } from "vitest";
import { QualityAuditor } from "../src/agents/qualityAuditor.js";

// Mock logger to avoid dependencies
const mockLogger = {
  trace: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
} as any;

const run = async (input: string) => {
  const agent = new QualityAuditor(mockLogger) as any;
  const res = await agent.handle(input, {});
  return res;
};

describe("QualityAuditor", () => {
  it("passes when answer exists (JSON input)", async () => {
    const res = await run(JSON.stringify({ answer: "Yes, this is a valid answer" }));
    expect(res.status).toBe("PASS");
    expect(res.auditComplete).toBe(true);
    expect(res.issues).toBeUndefined();
  });

  it("fails when answer is empty", async () => {
    const res = await run(JSON.stringify({ answer: "" }));
    expect(res.status).toBe("FAIL");
    expect(res.auditComplete).toBe(true);
    expect(res.issues).toBeDefined();
    expect(res.issues?.length).toBeGreaterThan(0);
  });

  it("handles plain text input as answer", async () => {
    const res = await run("This is a plain text answer");
    expect(res.status).toBe("PASS");
    expect(res.auditComplete).toBe(true);
  });

  it("fails on malformed input", async () => {
    const res = await run(JSON.stringify({}));
    expect(res.status).toBe("FAIL");
    expect(res.issues).toBeDefined();
  });
});