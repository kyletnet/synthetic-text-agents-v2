/**
 * Phase 0 Validation: Safe Imports Test
 *
 * Purpose: Verify safe-imports.ts blocks dangerous Node modules
 */

import { describe, it, expect } from "vitest";
import {
  validateImports,
  validateAgentCodeSecurity,
  BLOCKED_IMPORTS,
} from "../../src/infrastructure/governance/safe-imports.js";

describe("Phase 0: Safe Imports Validation", () => {
  it("should block fs import", () => {
    const code = `import fs from "fs";`;
    const result = validateImports(code);

    expect(result.valid).toBe(false);
    expect(result.violations).toContain('Blocked import: "fs" (security risk)');
  });

  it("should block node:fs import", () => {
    const code = `import fs from "node:fs";`;
    const result = validateImports(code);

    expect(result.valid).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it("should block child_process import", () => {
    const code = `const { exec } = require("child_process");`;
    const result = validateImports(code);

    expect(result.valid).toBe(false);
  });

  it("should block multiple dangerous imports", () => {
    const code = `
      import fs from "fs";
      import { exec } from "child_process";
      import net from "net";
    `;
    const result = validateImports(code);

    expect(result.valid).toBe(false);
    expect(result.violations.length).toBeGreaterThanOrEqual(3);
  });

  it("should allow safe imports", () => {
    const code = `
      import lodash from "lodash";
      import dayjs from "dayjs";
      import { z } from "zod";
    `;
    const result = validateImports(code);

    expect(result.valid).toBe(true);
    expect(result.violations.length).toBe(0);
  });

  it("should detect eval usage", () => {
    const code = `eval("console.log('dangerous')");`;
    const result = validateAgentCodeSecurity(code);

    expect(result.safe).toBe(false);
    expect(result.issues).toContain("eval() detected");
  });

  it("should detect Function constructor", () => {
    const code = `const fn = new Function("x", "return x * 2");`;
    const result = validateAgentCodeSecurity(code);

    expect(result.safe).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("should verify all Node built-ins are blocked", () => {
    const dangerousModules = [
      "fs",
      "node:fs",
      "child_process",
      "node:child_process",
      "net",
      "node:net",
      "os",
      "node:os",
      "vm",
      "node:vm",
      "worker_threads",
    ];

    for (const mod of dangerousModules) {
      expect(BLOCKED_IMPORTS).toContain(mod);
    }
  });
});
