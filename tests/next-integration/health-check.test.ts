/**
 * Integration tests for health check endpoints
 */

import { describe, it, expect, beforeEach } from "vitest";
import { GET as healthHandler } from "../../apps/fe-web/app/api/health/route";
import { GET as readyHandler } from "../../apps/fe-web/app/api/ready/route";
import { TestUtils } from "../setup";

describe("Health Check Integration", () => {
  beforeEach(() => {
    // Reset environment for each test
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key-for-integration-tests";
    process.env.NODE_ENV = "test";
    process.env.ENVIRONMENT = "test";
  });

  describe("/api/health", () => {
    it("should return healthy status when all checks pass", async () => {
      const request = TestUtils.createMockRequest();
      const response = await healthHandler(request);

      expect(response.status).toBe(200);

      const healthData = await response.json();
      expect(healthData).toMatchObject({
        status: expect.stringMatching(/^(healthy|degraded)$/),
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        version: expect.any(String),
        environment: "test",
        checks: expect.any(Object),
        system: expect.any(Object),
      });

      // Verify required checks exist
      expect(healthData.checks).toHaveProperty("apiKey");
      expect(healthData.checks).toHaveProperty("database");
      expect(healthData.checks).toHaveProperty("externalServices");
      expect(healthData.checks).toHaveProperty("diskSpace");

      // Verify system metrics
      expect(healthData.system).toHaveProperty("memory");
      expect(healthData.system).toHaveProperty("cpu");
      expect(healthData.system).toHaveProperty("disk");
    });

    it("should return unhealthy status when API key is missing", async () => {
      delete process.env.ANTHROPIC_API_KEY;

      const request = TestUtils.createMockRequest();
      const response = await healthHandler(request);

      const healthData = await response.json();
      expect(healthData.status).toBe("unhealthy");
      expect(healthData.checks.apiKey.status).toBe("fail");
    });

    it("should include response time in health check", async () => {
      const request = TestUtils.createMockRequest();
      const response = await healthHandler(request);

      const healthData = await response.json();
      expect(healthData).toHaveProperty("responseTime");
      expect(healthData.responseTime).toBeGreaterThan(0);
    });

    it("should handle health check errors gracefully", async () => {
      // Mock a failure scenario
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = (() => {
        throw new Error("Memory check failed");
      }) as typeof process.memoryUsage;

      const request = TestUtils.createMockRequest();
      const response = await healthHandler(request);

      expect(response.status).toBe(503);

      const healthData = await response.json();
      expect(healthData.status).toBe("unhealthy");
      expect(healthData.error).toBe("Health check failed");

      // Restore original function
      process.memoryUsage = originalMemoryUsage;
    });
  });

  describe("/api/ready", () => {
    it("should return ready status when system is operational", async () => {
      const request = TestUtils.createMockRequest();
      const response = await readyHandler(request);

      expect(response.status).toBe(200);

      const readyData = await response.json();
      expect(readyData).toMatchObject({
        status: "ready",
        timestamp: expect.any(String),
        checks: expect.any(Object),
      });

      // Verify required readiness checks
      expect(readyData.checks).toHaveProperty("apiKey");
      expect(readyData.checks).toHaveProperty("services");
      expect(readyData.checks).toHaveProperty("configuration");
      expect(readyData.checks).toHaveProperty("database");
    });

    it("should return not-ready when API key is invalid", async () => {
      process.env.ANTHROPIC_API_KEY = "invalid-key";

      const request = TestUtils.createMockRequest();
      const response = await readyHandler(request);

      expect(response.status).toBe(503);

      const readyData = await response.json();
      expect(readyData.status).toBe("not-ready");
      expect(readyData.checks.apiKey.status).toBe("not-ready");
    });

    it("should handle production environment requirements", async () => {
      process.env.ENVIRONMENT = "production";
      process.env.NODE_ENV = "production";

      // Missing production requirements
      delete process.env.DB_PASSWORD;

      const request = TestUtils.createMockRequest();
      const response = await readyHandler(request);

      const readyData = await response.json();
      expect(readyData.checks.database.status).toBe("not-ready");
    });

    it("should be more strict than health check", async () => {
      // Set up a scenario where health might be degraded but ready should fail
      process.env.ANTHROPIC_API_KEY = "your_key_here"; // Placeholder

      const healthRequest = TestUtils.createMockRequest();
      const readyRequest = TestUtils.createMockRequest();

      const [_healthResponse, readyResponse] = await Promise.all([
        healthHandler(healthRequest),
        readyHandler(readyRequest),
      ]);

      const readyData = await readyResponse.json();

      // Ready should be stricter - not ready while health might be degraded
      expect(readyResponse.status).toBe(503);
      expect(readyData.status).toBe("not-ready");
    });
  });

  describe("Health Check Performance", () => {
    it("should complete health check within reasonable time", async () => {
      const start = Date.now();

      const request = TestUtils.createMockRequest();
      await healthHandler(request);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it("should complete readiness check within reasonable time", async () => {
      const start = Date.now();

      const request = TestUtils.createMockRequest();
      await readyHandler(request);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });

  describe("Health Check Consistency", () => {
    it("should return consistent results across multiple calls", async () => {
      const request = TestUtils.createMockRequest();

      const responses = await Promise.all([
        healthHandler(request),
        healthHandler(request),
        healthHandler(request),
      ]);

      const healthDataArray = await Promise.all(
        responses.map((response) => response.json()),
      );

      // All should have the same status (assuming stable environment)
      const statuses = healthDataArray.map((data) => data.status);
      expect(new Set(statuses).size).toBe(1);

      // All should have the same environment
      const environments = healthDataArray.map((data) => data.environment);
      expect(new Set(environments).size).toBe(1);
    });
  });
});
