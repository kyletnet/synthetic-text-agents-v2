import { describe, it, expect } from "vitest";
import { PromptArchitect } from "../src/agents/promptArchitect";

describe("PromptArchitect", () => {
  it("should create instance correctly", () => {
    const agent = new PromptArchitect();
    expect(agent).toBeDefined();
    expect(agent.id).toBe("prompt-architect");
  });

  it("should have prompt engineering capabilities", () => {
    const agent = new PromptArchitect();
    expect(agent.tags).toContain("prompt-engineering");
  });

  it("should have correct specialization", () => {
    const agent = new PromptArchitect();
    expect(agent.specialization).toBe("PromptArchitect");
  });
});
