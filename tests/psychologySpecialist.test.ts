import { describe, it, expect } from "vitest";
import { PsychologySpecialist } from "../src/agents/psychologySpecialist";
import { Logger } from "../src/shared/logger";

describe("PsychologySpecialist", () => {
  it("should create instance correctly", () => {
    const logger = new Logger();
    const agent = new PsychologySpecialist(logger);
    expect(agent).toBeDefined();
    expect(agent.id).toBe("psychology-specialist");
  });

  it("should have psychology capabilities", () => {
    const logger = new Logger();
    const agent = new PsychologySpecialist(logger);
    expect(agent.tags).toContain("psychology");
  });

  it("should have correct specialization", () => {
    const logger = new Logger();
    const agent = new PsychologySpecialist(logger);
    expect(agent.specialization).toBe("user_psychology_communication_strategy");
  });
});
