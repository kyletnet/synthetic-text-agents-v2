/**
 * Input Validation and Sanitization
 * Protects against malicious input and ensures data integrity
 */
import { z } from "zod";
export interface ValidationConfig {
  enableSanitization: boolean;
  enableXSSProtection: boolean;
  enableSQLInjectionProtection: boolean;
  maxStringLength: number;
  maxArrayLength: number;
  maxObjectDepth: number;
  allowedFileTypes?: string[];
  maxFileSize?: number;
}
export interface ValidationResult<T = any> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
  sanitized?: T;
}
export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}
export interface SanitizationOptions {
  removeHTML: boolean;
  escapeHTML: boolean;
  removeDangerousChars: boolean;
  normalizeWhitespace: boolean;
  maxLength?: number;
}
/**
 * Input validator class
 */
export declare class InputValidator {
  private config;
  constructor(config?: Partial<ValidationConfig>);
  /**
   * Validate input against a Zod schema with additional security checks
   */
  validate<T>(
    schema: z.ZodSchema<T>,
    input: unknown,
    options?: {
      sanitize?: boolean;
      fieldName?: string;
    },
  ): Promise<ValidationResult<T>>;
  /**
   * Sanitize string input
   */
  sanitizeString(input: string, options?: SanitizationOptions): string;
  /**
   * Validate file upload
   */
  validateFile(file: {
    name: string;
    size: number;
    type: string;
    content?: Buffer;
  }): ValidationResult<typeof file>;
  /**
   * Validate API key format
   */
  validateAPIKey(key: string): ValidationResult<string>;
  /**
   * Perform security checks on input
   */
  private performSecurityChecks;
  /**
   * Sanitize input recursively
   */
  private sanitizeInput;
  /**
   * Escape HTML entities
   */
  private escapeHTML;
  /**
   * Remove dangerous characters
   */
  private removeDangerousCharacters;
  /**
   * Check for XSS patterns
   */
  private containsXSS;
  /**
   * Get XSS detection patterns
   */
  private getXSSPatterns;
  /**
   * Check for SQL injection patterns
   */
  private containsSQLInjection;
  /**
   * Get SQL injection detection patterns
   */
  private getSQLInjectionPatterns;
  /**
   * Calculate object depth
   */
  private calculateObjectDepth;
  /**
   * Check for dangerous file patterns
   */
  private containsDangerousFilePattern;
  /**
   * Scan file content for malicious patterns
   */
  private scanFileContent;
}
/**
 * Common validation schemas
 */
export declare const CommonSchemas: {
  /**
   * Email validation
   */
  email: z.ZodString;
  /**
   * Password validation
   */
  password: z.ZodString;
  /**
   * API key validation
   */
  apiKey: z.ZodString;
  /**
   * Safe string (no HTML, limited length)
   */
  safeString: z.ZodString;
  /**
   * Prompt text validation
   */
  promptText: z.ZodEffects<z.ZodString, string, string>;
  /**
   * File upload validation
   */
  fileUpload: z.ZodObject<
    {
      name: z.ZodString;
      size: z.ZodNumber;
      type: z.ZodString;
    },
    "strip",
    z.ZodTypeAny,
    {
      type: string;
      name: string;
      size: number;
    },
    {
      type: string;
      name: string;
      size: number;
    }
  >;
};
/**
 * Initialize global validator
 */
export declare function initializeValidator(
  config?: Partial<ValidationConfig>,
): InputValidator;
/**
 * Get global validator instance
 */
export declare function getValidator(): InputValidator;
/**
 * Convenience validation functions
 */
export declare function validateInput<T>(
  schema: z.ZodSchema<T>,
  input: unknown,
  options?: {
    sanitize?: boolean;
    fieldName?: string;
  },
): Promise<ValidationResult<T>>;
export declare function sanitizeString(
  input: string,
  options?: SanitizationOptions,
): string;
export declare function validateFile(file: {
  name: string;
  size: number;
  type: string;
  content?: Buffer;
}): ValidationResult<typeof file>;
//# sourceMappingURL=inputValidation.d.ts.map
