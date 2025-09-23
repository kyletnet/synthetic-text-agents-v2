/**
 * Standardized error handling for the Synthetic Text Agents system
 */
export var ErrorCode;
(function (ErrorCode) {
    // Agent errors
    ErrorCode["AGENT_NOT_FOUND"] = "AGENT_NOT_FOUND";
    ErrorCode["AGENT_EXECUTION_FAILED"] = "AGENT_EXECUTION_FAILED";
    ErrorCode["AGENT_TIMEOUT"] = "AGENT_TIMEOUT";
    // System errors
    ErrorCode["INITIALIZATION_FAILED"] = "INITIALIZATION_FAILED";
    ErrorCode["CONFIGURATION_ERROR"] = "CONFIGURATION_ERROR";
    ErrorCode["RESOURCE_EXHAUSTED"] = "RESOURCE_EXHAUSTED";
    // Input/Output errors
    ErrorCode["INVALID_INPUT"] = "INVALID_INPUT";
    ErrorCode["VALIDATION_FAILED"] = "VALIDATION_FAILED";
    ErrorCode["OUTPUT_GENERATION_FAILED"] = "OUTPUT_GENERATION_FAILED";
    // External service errors
    ErrorCode["API_ERROR"] = "API_ERROR";
    ErrorCode["NETWORK_ERROR"] = "NETWORK_ERROR";
    ErrorCode["RATE_LIMIT_EXCEEDED"] = "RATE_LIMIT_EXCEEDED";
})(ErrorCode || (ErrorCode = {}));
export class AgentSystemError extends Error {
    code;
    agentId;
    context;
    timestamp;
    constructor(code, message, options) {
        super(message);
        this.name = "AgentSystemError";
        this.code = code;
        this.agentId = options?.agentId;
        this.context = options?.context;
        this.timestamp = new Date();
        // Maintain proper stack trace for V8
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AgentSystemError);
        }
        // Set the cause if provided
        if (options?.cause) {
            this.cause = options.cause;
        }
    }
    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            agentId: this.agentId,
            context: this.context,
            timestamp: this.timestamp.toISOString(),
            stack: this.stack,
        };
    }
}
export class AgentExecutionError extends AgentSystemError {
    constructor(agentId, message, options) {
        super(ErrorCode.AGENT_EXECUTION_FAILED, message, {
            ...options,
            agentId,
        });
        this.name = "AgentExecutionError";
    }
}
export class ValidationError extends AgentSystemError {
    constructor(field, message, options) {
        super(ErrorCode.VALIDATION_FAILED, `Validation failed for ${field}: ${message}`, options);
        this.name = "ValidationError";
    }
}
/**
 * Utility functions for error handling
 */
export function isAgentSystemError(error) {
    return error instanceof AgentSystemError;
}
export function createErrorContext(data) {
    return {
        ...data,
        timestamp: new Date().toISOString(),
    };
}
/**
 * Safe error message extraction
 */
export function getErrorMessage(error) {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === "string") {
        return error;
    }
    return "Unknown error occurred";
}
/**
 * Retry with exponential backoff
 */
export async function withRetry(operation, options = {}) {
    const { maxRetries = 3, baseDelay = 1000, maxDelay = 10000, shouldRetry = () => true, } = options;
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        }
        catch (error) {
            lastError = error;
            if (attempt === maxRetries || !shouldRetry(error)) {
                break;
            }
            const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
    throw lastError;
}
//# sourceMappingURL=errors.js.map