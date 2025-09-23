import { describe, it, expect } from "vitest";
import { CognitiveScientist } from "../src/agents/cognitiveScientist";
import { Logger } from "../src/shared/logger";

describe("CognitiveScientist", () => {
  it("should create instance correctly", () => {
    const logger = new Logger();
    const agent = new CognitiveScientist(logger);
    expect(agent).toBeDefined();
    expect(agent.id).toBe("cognitive-scientist");
  });

  it("should have required capabilities", () => {
    const logger = new Logger();
    const agent = new CognitiveScientist(logger);
    expect(agent.tags).toContain("cognitive-modeling");
  });

  it("should have correct specialization", () => {
    const logger = new Logger();
    const agent = new CognitiveScientist(logger);
    expect(agent.specialization).toBe("expert_thinking_modeling");
  });
});
