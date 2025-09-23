/**
 * Log Masking Utility - Prevents sensitive information from appearing in logs
 */
export interface MaskingRule {
    pattern: RegExp;
    replacement: string;
    description: string;
}
/**
 * Default masking rules for common sensitive data patterns
 */
export declare const DEFAULT_MASKING_RULES: MaskingRule[];
/**
 * Log masking utility class
 */
export declare class LogMasker {
    private rules;
    constructor(customRules?: MaskingRule[]);
    /**
     * Mask sensitive information in a string
     */
    mask(input: string): string;
    /**
     * Mask sensitive information in an object
     */
    maskObject(obj: any): any;
    /**
     * Add a custom masking rule
     */
    addRule(rule: MaskingRule): void;
    /**
     * Remove a masking rule by description
     */
    removeRule(description: string): boolean;
    /**
     * Get all masking rules
     */
    getRules(): MaskingRule[];
    /**
     * Test if a string contains sensitive information
     */
    containsSensitiveData(input: string): boolean;
    /**
     * Get details about what sensitive data was found
     */
    analyzeSensitiveData(input: string): {
        found: boolean;
        types: string[];
    };
}
/**
 * Initialize the global log masker
 */
export declare function initializeLogMasker(customRules?: MaskingRule[]): LogMasker;
/**
 * Get the global log masker instance
 */
export declare function getLogMasker(): LogMasker;
/**
 * Convenience function to mask a string
 */
export declare function maskSensitiveData(input: string): string;
/**
 * Convenience function to mask an object
 */
export declare function maskSensitiveObject(obj: any): any;
/**
 * Enhanced console methods that automatically mask sensitive data
 */
export declare const secureconsole: {
    log: (...args: any[]) => void;
    error: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    info: (...args: any[]) => void;
    debug: (...args: any[]) => void;
};
/**
 * Middleware for Express to mask sensitive data in request/response logs
 */
export declare function createLogMaskingMiddleware(): (req: any, res: any, next: any) => void;
//# sourceMappingURL=logMasking.d.ts.map