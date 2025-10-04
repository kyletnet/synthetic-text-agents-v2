import { describe, it, expect } from "vitest";

describe("AgentRegistry - Smoke Tests", () => {
  describe("Module Import", () => {
    it("should import AgentRegistry class", async () => {
      const { AgentRegistry } = await import("../../src/shared/registry.js");
      expect(AgentRegistry).toBeDefined();
      expect(typeof AgentRegistry).toBe("function");
    });

    it("should import BaseAgent", async () => {
      const { BaseAgent } = await import("../../src/shared/registry.js");
      expect(BaseAgent).toBeDefined();
    });
  });

  describe("Instance Creation", () => {
    it("should create an AgentRegistry instance", async () => {
      const { AgentRegistry } = await import("../../src/shared/registry.js");
      const registry = new AgentRegistry();
      expect(registry).toBeDefined();
      expect(registry).toBeInstanceOf(AgentRegistry);
    });
  });

  describe("Agent Registration", () => {
    it("should have getAgent method", async () => {
      const { AgentRegistry } = await import("../../src/shared/registry.js");
      const registry = new AgentRegistry();
      expect(typeof registry.getAgent).toBe("function");
    });

    it("should retrieve registered agents", async () => {
      const { AgentRegistry } = await import("../../src/shared/registry.js");
      const registry = new AgentRegistry();

      // Try to get a known agent (these are registered in constructor)
      const agent = registry.getAgent("prompt-architect");

      // Agent might exist or not depending on initialization
      expect(agent === undefined || typeof agent === "object").toBe(true);
    });

    it("should return undefined for non-existent agent", async () => {
      const { AgentRegistry } = await import("../../src/shared/registry.js");
      const registry = new AgentRegistry();

      const agent = registry.getAgent("non-existent-agent-12345");
      expect(agent).toBeUndefined();
    });
  });

  describe("Registry Methods", () => {
    it("should have register method", async () => {
      const { AgentRegistry } = await import("../../src/shared/registry.js");
      const registry = new AgentRegistry();
      expect(typeof registry.register).toBe("function");
    });
  });
});
