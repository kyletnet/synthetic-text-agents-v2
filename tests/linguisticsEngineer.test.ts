import { describe, it, expect } from "vitest";
import { LinguisticsEngineer } from "../src/agents/linguisticsEngineer";
import { Logger } from "../src/shared/logger";

describe("LinguisticsEngineer", () => {
  it("should create instance correctly", () => {
    const logger = new Logger();
    const agent = new LinguisticsEngineer(logger);
    expect(agent).toBeDefined();
    expect(agent.id).toBe("linguistics-engineer");
  });

  it("should have llm-optimization capabilities", () => {
    const logger = new Logger();
    const agent = new LinguisticsEngineer(logger);
    expect(agent.tags).toContain("llm-optimization");
  });

  it("should have correct specialization", () => {
    const logger = new Logger();
    const agent = new LinguisticsEngineer(logger);
    expect(agent.specialization).toBe("llm_optimization_language_structure");
  });
});
