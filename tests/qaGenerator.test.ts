import { describe, it, expect, vi } from "vitest";
import { QAGenerator } from "../src/agents/qaGenerator.js";

// Mock logger to avoid dependencies
const mockLogger = {
  trace: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
} as any;

// We call the protected handle via 'any' to keep the scaffold simple.
const run = async (input: string) => {
  const agent = new QAGenerator(mockLogger) as any;
  const res = await agent.handle(input, {}); // content/context kept minimal
  return res;
};

describe("QAGenerator", () => {
  it("accepts JSON prompt and returns a QA pair", async () => {
    const json = JSON.stringify({ goal: "Improve reliability" });
    const res = await run(json);
    expect(typeof res).toBe("object");
    expect(res.result).toBeDefined();
    expect(Array.isArray(res.result)).toBe(true);
    expect(res.result[0].question).toBeTypeOf("string");
    expect(res.result[0].answer).toBeTypeOf("string");
  });

  it("accepts plain text prompt and still returns a QA pair", async () => {
    const res = await run("Generate a QA about principles");
    expect(typeof res).toBe("object");
    expect(res.result).toBeDefined();
    expect(Array.isArray(res.result)).toBe(true);
    expect(res.result[0].answer.length).toBeGreaterThan(0);
    expect(res.result[0].question.length).toBeGreaterThan(0);
  });

  it("handles empty input gracefully", async () => {
    const res = await run("");
    expect(typeof res).toBe("object");
    expect(res.result).toBeDefined();
    expect(Array.isArray(res.result)).toBe(true);
    expect(res.result[0].question).toBeTypeOf("string");
    expect(res.result[0].answer).toBeTypeOf("string");
  });
});