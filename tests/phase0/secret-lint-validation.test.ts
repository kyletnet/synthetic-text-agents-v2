/**
 * Phase 0 Validation: Secret Lint Test
 *
 * Purpose: Verify secret-lint.ts actually blocks secrets
 */

import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

describe("Phase 0: Secret Lint Validation", () => {
  const testDir = join(process.cwd(), "demo-ui", "public", "test-secrets");
  const testFile = join(testDir, "test.ts");

  beforeEach(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    try {
      if (existsSync(testFile)) {
        unlinkSync(testFile);
      }
    } catch (e) {
      // ignore
    }
  });

  it("should detect high-entropy API key", () => {
    // Write test file with secret (high entropy, random-looking)
    writeFileSync(
      testFile,
      'const key = "sk-aB3dEfGh1JkLmN0pQrStUvWxYz9AbCdEf1234567890XyZ";'
    );

    // Run secret lint
    try {
      execSync("npm run secret:lint", {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: "pipe",
      });

      // If no error, secret was NOT detected (FAIL)
      expect(false).toBe(true); // Should not reach here
    } catch (error: any) {
      // Exit code 1 = violations found (PASS)
      expect(error.status).toBe(1);
      expect(error.stdout || error.stderr).toContain("violation");
    }
  });

  it("should detect AWS access key", () => {
    writeFileSync(testFile, 'const aws = "AKIAIOSFODNN7EXAMPLE";');

    try {
      execSync("npm run secret:lint", {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: "pipe",
      });
      expect(false).toBe(true);
    } catch (error: any) {
      expect(error.status).toBe(1);
    }
  });

  it("should detect database connection string", () => {
    writeFileSync(
      testFile,
      'const db = "mongodb://user:pass123456789@host/db";'
    );

    try {
      execSync("npm run secret:lint", {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: "pipe",
      });
      expect(false).toBe(true);
    } catch (error: any) {
      expect(error.status).toBe(1);
    }
  });
});
