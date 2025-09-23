/**
 * Log Masking Utility - Prevents sensitive information from appearing in logs
 */
/**
 * Default masking rules for common sensitive data patterns
 */
export const DEFAULT_MASKING_RULES = [
    // API Keys
    {
        pattern: /sk-[a-zA-Z0-9-_]{43,}/g,
        replacement: "sk-***MASKED_API_KEY***",
        description: "Anthropic API Keys",
    },
    {
        pattern: /sk-[a-zA-Z0-9]{20}T3BlbkFJ[a-zA-Z0-9]{20}/g,
        replacement: "sk-***MASKED_OPENAI_KEY***",
        description: "OpenAI API Keys",
    },
    {
        pattern: /AIza[a-zA-Z0-9_-]{35}/g,
        replacement: "AIza***MASKED_GOOGLE_KEY***",
        description: "Google API Keys",
    },
    // Database Passwords
    {
        pattern: /password['":\s=]+['"]*([^'"\s,}]+)['"]*,?/gi,
        replacement: 'password: "***MASKED_PASSWORD***"',
        description: "Database Passwords",
    },
    // JWT Tokens
    {
        pattern: /eyJ[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]*/g,
        replacement: "eyJ***MASKED_JWT_TOKEN***",
        description: "JWT Tokens",
    },
    // Credit Card Numbers
    {
        pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
        replacement: "****-****-****-****",
        description: "Credit Card Numbers",
    },
    // Email Addresses (partial masking)
    {
        pattern: /\b([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g,
        replacement: "***@$2",
        description: "Email Addresses",
    },
    // Phone Numbers
    {
        pattern: /\b\+?1?[-.\s]?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
        replacement: "+1-***-***-****",
        description: "Phone Numbers",
    },
    // Social Security Numbers
    {
        pattern: /\b\d{3}-?\d{2}-?\d{4}\b/g,
        replacement: "***-**-****",
        description: "Social Security Numbers",
    },
    // AWS Access Keys
    {
        pattern: /AKIA[0-9A-Z]{16}/g,
        replacement: "AKIA***MASKED_AWS_KEY***",
        description: "AWS Access Keys",
    },
    // Generic Secret Patterns
    {
        pattern: /(['"]?(?:api[_-]?key|secret|token|password|pass)['":\s=]+['"]?)([^'"\s,}]+)(['"]?)/gi,
        replacement: "$1***MASKED_SECRET***$3",
        description: "Generic Secrets",
    },
];
/**
 * Log masking utility class
 */
export class LogMasker {
    rules;
    constructor(customRules = []) {
        this.rules = [...DEFAULT_MASKING_RULES, ...customRules];
    }
    /**
     * Mask sensitive information in a string
     */
    mask(input) {
        if (!input || typeof input !== "string") {
            return input;
        }
        let masked = input;
        for (const rule of this.rules) {
            if (typeof rule.replacement === "function") {
                masked = masked.replace(rule.pattern, rule.replacement);
            }
            else {
                masked = masked.replace(rule.pattern, rule.replacement);
            }
        }
        return masked;
    }
    /**
     * Mask sensitive information in an object
     */
    maskObject(obj) {
        if (!obj)
            return obj;
        if (typeof obj === "string") {
            return this.mask(obj);
        }
        if (Array.isArray(obj)) {
            return obj.map((item) => this.maskObject(item));
        }
        if (typeof obj === "object") {
            const masked = {};
            for (const [key, value] of Object.entries(obj)) {
                // Mask key if it contains sensitive words
                const sensitiveKeyPattern = /^(password|secret|token|key|auth|credential|pass)$/i;
                if (sensitiveKeyPattern.test(key)) {
                    masked[key] = "***MASKED***";
                }
                else {
                    masked[key] = this.maskObject(value);
                }
            }
            return masked;
        }
        return obj;
    }
    /**
     * Add a custom masking rule
     */
    addRule(rule) {
        this.rules.push(rule);
    }
    /**
     * Remove a masking rule by description
     */
    removeRule(description) {
        const index = this.rules.findIndex((rule) => rule.description === description);
        if (index >= 0) {
            this.rules.splice(index, 1);
            return true;
        }
        return false;
    }
    /**
     * Get all masking rules
     */
    getRules() {
        return [...this.rules];
    }
    /**
     * Test if a string contains sensitive information
     */
    containsSensitiveData(input) {
        if (!input || typeof input !== "string") {
            return false;
        }
        for (const rule of this.rules) {
            if (rule.pattern.test(input)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Get details about what sensitive data was found
     */
    analyzeSensitiveData(input) {
        if (!input || typeof input !== "string") {
            return { found: false, types: [] };
        }
        const types = [];
        for (const rule of this.rules) {
            if (rule.pattern.test(input)) {
                types.push(rule.description);
            }
        }
        return {
            found: types.length > 0,
            types,
        };
    }
}
/**
 * Global log masker instance
 */
let globalMasker;
/**
 * Initialize the global log masker
 */
export function initializeLogMasker(customRules = []) {
    globalMasker = new LogMasker(customRules);
    return globalMasker;
}
/**
 * Get the global log masker instance
 */
export function getLogMasker() {
    if (!globalMasker) {
        globalMasker = new LogMasker();
    }
    return globalMasker;
}
/**
 * Convenience function to mask a string
 */
export function maskSensitiveData(input) {
    return getLogMasker().mask(input);
}
/**
 * Convenience function to mask an object
 */
export function maskSensitiveObject(obj) {
    return getLogMasker().maskObject(obj);
}
/**
 * Enhanced console methods that automatically mask sensitive data
 */
export const secureconsole = {
    log: (...args) => {
        const maskedArgs = args.map((arg) => typeof arg === "string"
            ? maskSensitiveData(arg)
            : maskSensitiveObject(arg));
        console.log(...maskedArgs);
    },
    error: (...args) => {
        const maskedArgs = args.map((arg) => typeof arg === "string"
            ? maskSensitiveData(arg)
            : maskSensitiveObject(arg));
        console.error(...maskedArgs);
    },
    warn: (...args) => {
        const maskedArgs = args.map((arg) => typeof arg === "string"
            ? maskSensitiveData(arg)
            : maskSensitiveObject(arg));
        console.warn(...maskedArgs);
    },
    info: (...args) => {
        const maskedArgs = args.map((arg) => typeof arg === "string"
            ? maskSensitiveData(arg)
            : maskSensitiveObject(arg));
        console.info(...maskedArgs);
    },
    debug: (...args) => {
        const maskedArgs = args.map((arg) => typeof arg === "string"
            ? maskSensitiveData(arg)
            : maskSensitiveObject(arg));
        console.debug(...maskedArgs);
    },
};
/**
 * Middleware for Express to mask sensitive data in request/response logs
 */
export function createLogMaskingMiddleware() {
    return (req, res, next) => {
        // Mask request headers
        const originalHeaders = req.headers;
        req.headers = maskSensitiveObject(originalHeaders);
        // Mask request body if it contains sensitive data
        if (req.body) {
            req.body = maskSensitiveObject(req.body);
        }
        next();
    };
}
//# sourceMappingURL=logMasking.js.map