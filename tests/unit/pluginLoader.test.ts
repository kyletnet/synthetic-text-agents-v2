import { describe, it, expect } from "vitest";

describe("PluginLoader - Smoke Tests", () => {
  describe("Module Import", () => {
    it("should import module successfully", async () => {
      const module = await import("../../src/shared/pluginLoader.js");
      expect(module).toBeDefined();
    });
  });
});
