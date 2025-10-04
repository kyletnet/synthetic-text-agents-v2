import { describe, it, expect, vi } from "vitest";
import {
  ErrorCode,
  AgentSystemError,
  AgentExecutionError,
  ValidationError,
  isAgentSystemError,
  createErrorContext,
  getErrorMessage,
  withRetry,
} from "../../src/shared/errors";

describe("Error System - Smoke Tests", () => {
  describe("ErrorCode Enum", () => {
    it("should have all error codes defined", () => {
      expect(ErrorCode.AGENT_NOT_FOUND).toBe("AGENT_NOT_FOUND");
      expect(ErrorCode.AGENT_EXECUTION_FAILED).toBe("AGENT_EXECUTION_FAILED");
      expect(ErrorCode.AGENT_TIMEOUT).toBe("AGENT_TIMEOUT");
      expect(ErrorCode.INITIALIZATION_FAILED).toBe("INITIALIZATION_FAILED");
      expect(ErrorCode.CONFIGURATION_ERROR).toBe("CONFIGURATION_ERROR");
      expect(ErrorCode.RESOURCE_EXHAUSTED).toBe("RESOURCE_EXHAUSTED");
      expect(ErrorCode.INVALID_INPUT).toBe("INVALID_INPUT");
      expect(ErrorCode.VALIDATION_FAILED).toBe("VALIDATION_FAILED");
      expect(ErrorCode.OUTPUT_GENERATION_FAILED).toBe(
        "OUTPUT_GENERATION_FAILED",
      );
      expect(ErrorCode.API_ERROR).toBe("API_ERROR");
      expect(ErrorCode.NETWORK_ERROR).toBe("NETWORK_ERROR");
      expect(ErrorCode.RATE_LIMIT_EXCEEDED).toBe("RATE_LIMIT_EXCEEDED");
    });
  });

  describe("AgentSystemError", () => {
    it("should create an AgentSystemError", () => {
      const error = new AgentSystemError(
        ErrorCode.AGENT_NOT_FOUND,
        "Agent not found",
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AgentSystemError);
      expect(error.name).toBe("AgentSystemError");
      expect(error.code).toBe(ErrorCode.AGENT_NOT_FOUND);
      expect(error.message).toBe("Agent not found");
    });

    it("should create error with agentId", () => {
      const error = new AgentSystemError(
        ErrorCode.AGENT_EXECUTION_FAILED,
        "Execution failed",
        { agentId: "test-agent" },
      );

      expect(error.agentId).toBe("test-agent");
    });

    it("should create error with context", () => {
      const error = new AgentSystemError(
        ErrorCode.API_ERROR,
        "API request failed",
        { context: { statusCode: 500, endpoint: "/api/test" } },
      );

      expect(error.context).toEqual({ statusCode: 500, endpoint: "/api/test" });
    });

    it("should create error with cause", () => {
      const cause = new Error("Original error");
      const error = new AgentSystemError(
        ErrorCode.NETWORK_ERROR,
        "Network failed",
        { cause },
      );

      expect(error.cause).toBe(cause);
    });

    it("should have timestamp", () => {
      const error = new AgentSystemError(
        ErrorCode.CONFIGURATION_ERROR,
        "Config error",
      );

      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it("should serialize to JSON", () => {
      const error = new AgentSystemError(
        ErrorCode.INVALID_INPUT,
        "Invalid input",
        {
          agentId: "test-agent",
          context: { field: "name" },
        },
      );

      const json = error.toJSON();

      expect(json.name).toBe("AgentSystemError");
      expect(json.code).toBe(ErrorCode.INVALID_INPUT);
      expect(json.message).toBe("Invalid input");
      expect(json.agentId).toBe("test-agent");
      expect(json.context).toEqual({ field: "name" });
      expect(json.timestamp).toBeDefined();
      expect(json.stack).toBeDefined();
    });
  });

  describe("AgentExecutionError", () => {
    it("should create an AgentExecutionError", () => {
      const error = new AgentExecutionError("test-agent", "Execution failed");

      expect(error).toBeInstanceOf(AgentSystemError);
      expect(error).toBeInstanceOf(AgentExecutionError);
      expect(error.name).toBe("AgentExecutionError");
      expect(error.code).toBe(ErrorCode.AGENT_EXECUTION_FAILED);
      expect(error.agentId).toBe("test-agent");
      expect(error.message).toBe("Execution failed");
    });

    it("should create error with context", () => {
      const error = new AgentExecutionError("test-agent", "Failed", {
        context: { reason: "timeout" },
      });

      expect(error.context).toEqual({ reason: "timeout" });
    });

    it("should create error with cause", () => {
      const cause = new Error("Original error");
      const error = new AgentExecutionError("test-agent", "Failed", {
        cause,
      });

      expect(error.cause).toBe(cause);
    });
  });

  describe("ValidationError", () => {
    it("should create a ValidationError", () => {
      const error = new ValidationError(
        "username",
        "must be at least 3 characters",
      );

      expect(error).toBeInstanceOf(AgentSystemError);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.name).toBe("ValidationError");
      expect(error.code).toBe(ErrorCode.VALIDATION_FAILED);
      expect(error.message).toBe(
        "Validation failed for username: must be at least 3 characters",
      );
    });

    it("should create error with context", () => {
      const error = new ValidationError("email", "invalid format", {
        context: { providedValue: "not-an-email" },
      });

      expect(error.context).toEqual({ providedValue: "not-an-email" });
    });
  });

  describe("isAgentSystemError", () => {
    it("should identify AgentSystemError", () => {
      const error = new AgentSystemError(ErrorCode.API_ERROR, "API error");
      expect(isAgentSystemError(error)).toBe(true);
    });

    it("should identify AgentExecutionError", () => {
      const error = new AgentExecutionError("test-agent", "Failed");
      expect(isAgentSystemError(error)).toBe(true);
    });

    it("should identify ValidationError", () => {
      const error = new ValidationError("field", "invalid");
      expect(isAgentSystemError(error)).toBe(true);
    });

    it("should return false for regular Error", () => {
      const error = new Error("Regular error");
      expect(isAgentSystemError(error)).toBe(false);
    });

    it("should return false for non-error values", () => {
      expect(isAgentSystemError("string")).toBe(false);
      expect(isAgentSystemError(123)).toBe(false);
      expect(isAgentSystemError(null)).toBe(false);
      expect(isAgentSystemError(undefined)).toBe(false);
    });
  });

  describe("createErrorContext", () => {
    it("should create error context with timestamp", () => {
      const context = createErrorContext({ userId: "123", action: "login" });

      expect(context.userId).toBe("123");
      expect(context.action).toBe("login");
      expect(context.timestamp).toBeDefined();
      expect(typeof context.timestamp).toBe("string");
    });

    it("should handle empty data", () => {
      const context = createErrorContext({});

      expect(context.timestamp).toBeDefined();
    });
  });

  describe("getErrorMessage", () => {
    it("should extract message from Error", () => {
      const error = new Error("Test error");
      expect(getErrorMessage(error)).toBe("Test error");
    });

    it("should extract message from AgentSystemError", () => {
      const error = new AgentSystemError(ErrorCode.API_ERROR, "API failed");
      expect(getErrorMessage(error)).toBe("API failed");
    });

    it("should handle string errors", () => {
      expect(getErrorMessage("String error")).toBe("String error");
    });

    it("should handle unknown errors", () => {
      expect(getErrorMessage(123)).toBe("Unknown error occurred");
      expect(getErrorMessage(null)).toBe("Unknown error occurred");
      expect(getErrorMessage(undefined)).toBe("Unknown error occurred");
      expect(getErrorMessage({})).toBe("Unknown error occurred");
    });
  });

  describe("withRetry", () => {
    it("should succeed on first attempt", async () => {
      const operation = vi.fn().mockResolvedValue("success");

      const result = await withRetry(operation);

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should retry on failure and eventually succeed", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error("Fail 1"))
        .mockRejectedValueOnce(new Error("Fail 2"))
        .mockResolvedValue("success");

      const result = await withRetry(operation);

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it("should throw after max retries", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("Always fails"));

      await expect(withRetry(operation, { maxRetries: 2 })).rejects.toThrow(
        "Always fails",
      );

      expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it("should respect shouldRetry option", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("Fatal error"));
      const shouldRetry = vi.fn().mockReturnValue(false);

      await expect(withRetry(operation, { shouldRetry })).rejects.toThrow(
        "Fatal error",
      );

      expect(operation).toHaveBeenCalledTimes(1); // No retries
      expect(shouldRetry).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should use custom retry delays", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error("Fail"))
        .mockResolvedValue("success");

      const result = await withRetry(operation, {
        baseDelay: 10,
        maxDelay: 100,
      });

      expect(result).toBe("success");
    });
  });
});
