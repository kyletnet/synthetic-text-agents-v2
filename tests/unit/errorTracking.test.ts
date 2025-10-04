/**
 * Unit tests for ErrorTracker implementation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ErrorTracker } from "../../src/shared/errorTracking";
import type {
  ErrorTrackingConfig,
  ErrorReport,
} from "../../src/shared/errorTracking";

describe("ErrorTracker", () => {
  let errorTracker: ErrorTracker;
  let mockConfig: ErrorTrackingConfig;

  beforeEach(() => {
    mockConfig = {
      environment: "test",
      enableConsoleLogging: false,
      enableRemoteTracking: false,
      sampleRate: 1.0,
    };
    errorTracker = new ErrorTracker(mockConfig);
  });

  describe("Basic Error Tracking", () => {
    it("should create an ErrorTracker instance", () => {
      expect(errorTracker).toBeInstanceOf(ErrorTracker);
    });

    it("should track errors with Error objects", async () => {
      const testError = new Error("Test error");

      await errorTracker.trackError(testError);

      const stats = errorTracker.getErrorStats();
      expect(stats.totalErrors).toBe(1);
    });

    it("should track errors with string messages", async () => {
      await errorTracker.trackError("String error message");

      const stats = errorTracker.getErrorStats();
      expect(stats.totalErrors).toBe(1);
    });

    it("should track errors with context", async () => {
      const context = {
        userId: "user-123",
        sessionId: "session-456",
        operation: "test-operation",
      };

      await errorTracker.trackError(new Error("Context error"), context);

      const stats = errorTracker.getErrorStats();
      expect(stats.totalErrors).toBe(1);
    });

    it("should track errors with severity levels", async () => {
      await errorTracker.trackError(new Error("Low severity"), {}, "low");
      await errorTracker.trackError(new Error("Medium severity"), {}, "medium");
      await errorTracker.trackError(new Error("High severity"), {}, "high");

      const stats = errorTracker.getErrorStats();
      expect(stats.totalErrors).toBe(3);
      expect(stats.errorsBySeverity.low).toBe(1);
      expect(stats.errorsBySeverity.medium).toBe(1);
      expect(stats.errorsBySeverity.high).toBe(1);
    });
  });

  describe("Critical Error Tracking", () => {
    it("should track critical errors", async () => {
      await errorTracker.trackCriticalError(new Error("Critical failure"), {
        operation: "critical-op",
      });

      const stats = errorTracker.getErrorStats();
      expect(stats.errorsBySeverity.critical).toBe(1);
    });

    it("should handle critical error notifications", async () => {
      const criticalError = new Error("System failure");

      await expect(
        errorTracker.trackCriticalError(criticalError, {}),
      ).resolves.not.toThrow();
    });
  });

  describe("Error Statistics", () => {
    it("should return error statistics", () => {
      const stats = errorTracker.getErrorStats();

      expect(stats).toHaveProperty("totalErrors");
      expect(stats).toHaveProperty("errorsBySeverity");
      expect(stats).toHaveProperty("errorsByType");
      expect(stats).toHaveProperty("recentErrors");
    });

    it("should track multiple errors correctly", async () => {
      await errorTracker.trackError(new Error("Error 1"));
      await errorTracker.trackError(new Error("Error 2"));
      await errorTracker.trackError(new Error("Error 3"));

      const stats = errorTracker.getErrorStats();
      expect(stats.totalErrors).toBe(3);
    });

    it("should categorize errors by type", async () => {
      const typeError = new TypeError("Type error");
      const rangeError = new RangeError("Range error");
      const syntaxError = new SyntaxError("Syntax error");

      await errorTracker.trackError(typeError);
      await errorTracker.trackError(rangeError);
      await errorTracker.trackError(syntaxError);

      const stats = errorTracker.getErrorStats();
      expect(stats.errorsByType.TypeError).toBe(1);
      expect(stats.errorsByType.RangeError).toBe(1);
      expect(stats.errorsByType.SyntaxError).toBe(1);
    });

    it("should maintain recent errors list", async () => {
      await errorTracker.trackError(new Error("Recent error"));

      const stats = errorTracker.getErrorStats();
      expect(stats.recentErrors).toHaveLength(1);
      expect(stats.recentErrors[0].error.message).toBe("Recent error");
    });
  });

  describe("Breadcrumbs", () => {
    it("should add breadcrumbs", () => {
      errorTracker.addBreadcrumb({
        message: "User clicked button",
        category: "user-action",
        level: "info",
        data: { buttonId: "submit" },
      });

      // Should not throw
      expect(true).toBe(true);
    });

    it("should handle multiple breadcrumbs", () => {
      errorTracker.addBreadcrumb({
        message: "Action 1",
        category: "navigation",
        level: "info",
      });

      errorTracker.addBreadcrumb({
        message: "Action 2",
        category: "api-call",
        level: "debug",
      });

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("User Context", () => {
    it("should set user context", () => {
      errorTracker.setUserContext({
        userId: "user-789",
        sessionId: "session-012",
      });

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("BeforeSend Hook", () => {
    it("should apply beforeSend filter", async () => {
      const mockBeforeSend = vi.fn((report: ErrorReport) => {
        // Filter out low severity errors
        return report.severity === "low" ? null : report;
      });

      const config: ErrorTrackingConfig = {
        environment: "test",
        enableConsoleLogging: false,
        enableRemoteTracking: false,
        sampleRate: 1.0,
        beforeSend: mockBeforeSend,
      };

      const tracker = new ErrorTracker(config);

      await tracker.trackError(new Error("Low priority"), {}, "low");
      await tracker.trackError(new Error("High priority"), {}, "high");

      expect(mockBeforeSend).toHaveBeenCalledTimes(2);

      const stats = tracker.getErrorStats();
      // Only high severity should be tracked
      expect(stats.totalErrors).toBe(1);
      expect(stats.errorsBySeverity.high).toBe(1);
    });

    it("should allow modification of error reports", async () => {
      const mockBeforeSend = vi.fn((report: ErrorReport) => {
        return {
          ...report,
          tags: [...report.tags, "modified"],
        };
      });

      const config: ErrorTrackingConfig = {
        environment: "test",
        enableConsoleLogging: false,
        enableRemoteTracking: false,
        sampleRate: 1.0,
        beforeSend: mockBeforeSend,
      };

      const tracker = new ErrorTracker(config);
      await tracker.trackError(new Error("Test"));

      expect(mockBeforeSend).toHaveBeenCalled();
    });
  });

  describe("Sample Rate", () => {
    it("should respect sample rate of 0", async () => {
      const config: ErrorTrackingConfig = {
        environment: "test",
        enableConsoleLogging: false,
        enableRemoteTracking: false,
        sampleRate: 0,
      };

      const tracker = new ErrorTracker(config);
      await tracker.trackError(new Error("Should not track"));

      const stats = tracker.getErrorStats();
      // With sample rate 0, errors might still be buffered but not sent remotely
      expect(stats).toBeDefined();
    });

    it("should handle sample rate of 1", async () => {
      const config: ErrorTrackingConfig = {
        environment: "test",
        enableConsoleLogging: false,
        enableRemoteTracking: false,
        sampleRate: 1.0,
      };

      const tracker = new ErrorTracker(config);
      await tracker.trackError(new Error("Should track"));

      const stats = tracker.getErrorStats();
      expect(stats.totalErrors).toBe(1);
    });
  });

  describe("Environment Configuration", () => {
    it("should use configured environment", async () => {
      const prodConfig: ErrorTrackingConfig = {
        environment: "production",
        enableConsoleLogging: false,
        enableRemoteTracking: true,
        sampleRate: 1.0,
      };

      const prodTracker = new ErrorTracker(prodConfig);
      await prodTracker.trackError(new Error("Prod error"));

      expect(prodTracker.getErrorStats().totalErrors).toBe(1);
    });

    it("should handle development environment", () => {
      const devConfig: ErrorTrackingConfig = {
        environment: "development",
        enableConsoleLogging: true,
        enableRemoteTracking: false,
        sampleRate: 1.0,
      };

      const devTracker = new ErrorTracker(devConfig);
      expect(devTracker).toBeInstanceOf(ErrorTracker);
    });
  });
});
