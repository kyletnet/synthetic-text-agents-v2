/**
 * Input Validation and Sanitization
 * Protects against malicious input and ensures data integrity
 */
import { z } from "zod";
/**
 * Input validator class
 */
export class InputValidator {
  config;
  constructor(config = {}) {
    this.config = {
      enableSanitization: true,
      enableXSSProtection: true,
      enableSQLInjectionProtection: true,
      maxStringLength: 10000,
      maxArrayLength: 1000,
      maxObjectDepth: 10,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedFileTypes: [
        "image/jpeg",
        "image/png",
        "image/gif",
        "text/plain",
        "application/pdf",
      ],
      ...config,
    };
  }
  /**
   * Validate input against a Zod schema with additional security checks
   */
  async validate(schema, input, options = {}) {
    try {
      // Pre-validation security checks
      const securityCheck = this.performSecurityChecks(
        input,
        options.fieldName || "input",
      );
      if (!securityCheck.success) {
        return {
          success: false,
          errors: securityCheck.errors,
        };
      }
      // Sanitize input if enabled
      let processedInput = input;
      if (options.sanitize !== false && this.config.enableSanitization) {
        processedInput = this.sanitizeInput(input);
      }
      // Validate with Zod schema
      const result = schema.safeParse(processedInput);
      if (result.success) {
        return {
          success: true,
          data: result.data,
          sanitized: processedInput,
        };
      }
      // Convert Zod errors to our format
      const errors = result.error.errors.map((err) => ({
        field: err.path.join(".") || "root",
        message: err.message,
        code: err.code,
        value: err.input,
      }));
      return {
        success: false,
        errors,
      };
    } catch (error) {
      return {
        success: false,
        errors: [
          {
            field: "validation",
            message: `Validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            code: "VALIDATION_ERROR",
          },
        ],
      };
    }
  }
  /**
   * Sanitize string input
   */
  sanitizeString(
    input,
    options = {
      removeHTML: true,
      escapeHTML: true,
      removeDangerousChars: true,
      normalizeWhitespace: true,
    },
  ) {
    let sanitized = input;
    // Remove HTML tags if requested
    if (options.removeHTML) {
      sanitized = sanitized.replace(/<[^>]*>/g, "");
    }
    // Escape HTML entities if requested
    if (options.escapeHTML) {
      sanitized = this.escapeHTML(sanitized);
    }
    // Remove dangerous characters
    if (options.removeDangerousChars) {
      sanitized = this.removeDangerousCharacters(sanitized);
    }
    // Normalize whitespace
    if (options.normalizeWhitespace) {
      sanitized = sanitized.replace(/\s+/g, " ").trim();
    }
    // Enforce length limit
    if (options.maxLength && sanitized.length > options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
    }
    return sanitized;
  }
  /**
   * Validate file upload
   */
  validateFile(file) {
    const errors = [];
    // Check file size
    if (this.config.maxFileSize && file.size > this.config.maxFileSize) {
      errors.push({
        field: "file.size",
        message: `File size exceeds maximum allowed size of ${this.config.maxFileSize} bytes`,
        code: "FILE_TOO_LARGE",
        value: file.size,
      });
    }
    // Check file type
    if (
      this.config.allowedFileTypes &&
      !this.config.allowedFileTypes.includes(file.type)
    ) {
      errors.push({
        field: "file.type",
        message: `File type not allowed. Allowed types: ${this.config.allowedFileTypes.join(", ")}`,
        code: "INVALID_FILE_TYPE",
        value: file.type,
      });
    }
    // Check filename for dangerous patterns
    if (this.containsDangerousFilePattern(file.name)) {
      errors.push({
        field: "file.name",
        message: "Filename contains potentially dangerous patterns",
        code: "DANGEROUS_FILENAME",
        value: file.name,
      });
    }
    // Scan file content if available
    if (file.content) {
      const contentCheck = this.scanFileContent(file.content, file.type);
      if (!contentCheck.safe) {
        errors.push({
          field: "file.content",
          message:
            contentCheck.reason || "File content appears to be malicious",
          code: "MALICIOUS_CONTENT",
        });
      }
    }
    return {
      success: errors.length === 0,
      data: errors.length === 0 ? file : undefined,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
  /**
   * Validate API key format
   */
  validateAPIKey(key) {
    const errors = [];
    // Check basic format
    if (!key || typeof key !== "string") {
      errors.push({
        field: "apiKey",
        message: "API key must be a non-empty string",
        code: "INVALID_API_KEY_FORMAT",
      });
    } else {
      // Check for common API key patterns
      const anthropicPattern = /^sk-ant-[a-zA-Z0-9-_]{40,}$/;
      const openaiPattern = /^sk-[a-zA-Z0-9]{48,}$/;
      if (!anthropicPattern.test(key) && !openaiPattern.test(key)) {
        errors.push({
          field: "apiKey",
          message: "API key format is not recognized",
          code: "UNRECOGNIZED_API_KEY_FORMAT",
        });
      }
      // Check for placeholder values
      if (
        key.includes("your_") ||
        key.includes("placeholder") ||
        key.includes("example")
      ) {
        errors.push({
          field: "apiKey",
          message: "API key appears to be a placeholder value",
          code: "PLACEHOLDER_API_KEY",
        });
      }
    }
    return {
      success: errors.length === 0,
      data: errors.length === 0 ? key : undefined,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
  /**
   * Perform security checks on input
   */
  performSecurityChecks(input, fieldName) {
    const errors = [];
    // Check for XSS attempts
    if (this.config.enableXSSProtection && this.containsXSS(input)) {
      errors.push({
        field: fieldName,
        message: "Input contains potential XSS payload",
        code: "XSS_DETECTED",
        value: input,
      });
    }
    // Check for SQL injection attempts
    if (
      this.config.enableSQLInjectionProtection &&
      this.containsSQLInjection(input)
    ) {
      errors.push({
        field: fieldName,
        message: "Input contains potential SQL injection payload",
        code: "SQL_INJECTION_DETECTED",
        value: input,
      });
    }
    // Check object depth
    if (typeof input === "object" && input !== null) {
      const depth = this.calculateObjectDepth(input);
      if (depth > this.config.maxObjectDepth) {
        errors.push({
          field: fieldName,
          message: `Object depth exceeds maximum allowed depth of ${this.config.maxObjectDepth}`,
          code: "OBJECT_TOO_DEEP",
          value: depth,
        });
      }
    }
    // Check array length
    if (Array.isArray(input) && input.length > this.config.maxArrayLength) {
      errors.push({
        field: fieldName,
        message: `Array length exceeds maximum allowed length of ${this.config.maxArrayLength}`,
        code: "ARRAY_TOO_LONG",
        value: input.length,
      });
    }
    // Check string length
    if (
      typeof input === "string" &&
      input.length > this.config.maxStringLength
    ) {
      errors.push({
        field: fieldName,
        message: `String length exceeds maximum allowed length of ${this.config.maxStringLength}`,
        code: "STRING_TOO_LONG",
        value: input.length,
      });
    }
    return {
      success: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
  /**
   * Sanitize input recursively
   */
  sanitizeInput(input) {
    if (typeof input === "string") {
      return this.sanitizeString(input);
    }
    if (Array.isArray(input)) {
      return input.map((item) => this.sanitizeInput(item));
    }
    if (typeof input === "object" && input !== null) {
      const sanitized = {};
      for (const [key, value] of Object.entries(input)) {
        sanitized[key] = this.sanitizeInput(value);
      }
      return sanitized;
    }
    return input;
  }
  /**
   * Escape HTML entities
   */
  escapeHTML(input) {
    const escapeMap = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#x27;",
      "/": "&#x2F;",
    };
    return input.replace(/[&<>"'/]/g, (char) => escapeMap[char]);
  }
  /**
   * Remove dangerous characters
   */
  removeDangerousCharacters(input) {
    // Remove null bytes and other control characters
    // eslint-disable-next-line no-control-regex
    return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  }
  /**
   * Check for XSS patterns
   */
  containsXSS(input) {
    if (typeof input !== "string") {
      if (typeof input === "object") {
        return JSON.stringify(input).match(this.getXSSPatterns()) !== null;
      }
      return false;
    }
    return this.getXSSPatterns().test(input.toLowerCase());
  }
  /**
   * Get XSS detection patterns
   */
  getXSSPatterns() {
    return /<script|javascript:|onload=|onclick=|onerror=|eval\(|expression\(|vbscript:|data:text\/html/i;
  }
  /**
   * Check for SQL injection patterns
   */
  containsSQLInjection(input) {
    if (typeof input !== "string") {
      if (typeof input === "object") {
        return (
          JSON.stringify(input).match(this.getSQLInjectionPatterns()) !== null
        );
      }
      return false;
    }
    return this.getSQLInjectionPatterns().test(input.toLowerCase());
  }
  /**
   * Get SQL injection detection patterns
   */
  getSQLInjectionPatterns() {
    return /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b|--|\/\*|\*\/|;|\bor\b.*=.*=|\band\b.*=.*=)/i;
  }
  /**
   * Calculate object depth
   */
  calculateObjectDepth(obj, currentDepth = 0) {
    if (currentDepth > this.config.maxObjectDepth) {
      return currentDepth;
    }
    if (typeof obj !== "object" || obj === null) {
      return currentDepth;
    }
    let maxDepth = currentDepth;
    for (const value of Object.values(obj)) {
      if (typeof value === "object" && value !== null) {
        const depth = this.calculateObjectDepth(value, currentDepth + 1);
        maxDepth = Math.max(maxDepth, depth);
      }
    }
    return maxDepth;
  }
  /**
   * Check for dangerous file patterns
   */
  containsDangerousFilePattern(filename) {
    const dangerousPatterns = [
      /\.(php|asp|aspx|jsp|js|vbs|bat|cmd|com|exe|scr)$/i,
      /\.\.\//, // Directory traversal
      /^\./, // Hidden files
      /[<>:"|?*]/, // Invalid filename characters
    ];
    return dangerousPatterns.some((pattern) => pattern.test(filename));
  }
  /**
   * Scan file content for malicious patterns
   */
  scanFileContent(content, mimeType) {
    const contentString = content.toString(
      "utf8",
      0,
      Math.min(content.length, 1024),
    );
    // Check for script tags in images
    if (mimeType.startsWith("image/") && /<script/i.test(contentString)) {
      return { safe: false, reason: "Script tag found in image file" };
    }
    // Check for executable signatures
    const executableSignatures = [
      "MZ", // Windows executable
      "#!/bin/", // Unix script
      "<?php", // PHP script
    ];
    for (const signature of executableSignatures) {
      if (contentString.startsWith(signature)) {
        return {
          safe: false,
          reason: `Executable signature detected: ${signature}`,
        };
      }
    }
    return { safe: true };
  }
}
/**
 * Common validation schemas
 */
export const CommonSchemas = {
  /**
   * Email validation
   */
  email: z.string().email().max(255),
  /**
   * Password validation
   */
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  /**
   * API key validation
   */
  apiKey: z
    .string()
    .min(20, "API key too short")
    .max(200, "API key too long")
    .regex(/^[a-zA-Z0-9\-_]+$/, "API key contains invalid characters"),
  /**
   * Safe string (no HTML, limited length)
   */
  safeString: z
    .string()
    .max(1000, "String too long")
    .regex(/^[^<>]*$/, "String cannot contain HTML tags"),
  /**
   * Prompt text validation
   */
  promptText: z
    .string()
    .min(1, "Prompt cannot be empty")
    .max(10000, "Prompt too long")
    .transform((str) => str.trim()),
  /**
   * File upload validation
   */
  fileUpload: z.object({
    name: z.string().max(255),
    size: z
      .number()
      .positive()
      .max(10 * 1024 * 1024), // 10MB
    type: z.string().regex(/^[a-zA-Z0-9/+-]+$/),
  }),
};
/**
 * Global validator instance
 */
let globalValidator;
/**
 * Initialize global validator
 */
export function initializeValidator(config) {
  globalValidator = new InputValidator(config);
  return globalValidator;
}
/**
 * Get global validator instance
 */
export function getValidator() {
  if (!globalValidator) {
    globalValidator = new InputValidator();
  }
  return globalValidator;
}
/**
 * Convenience validation functions
 */
export async function validateInput(schema, input, options) {
  return getValidator().validate(schema, input, options);
}
export function sanitizeString(input, options) {
  return getValidator().sanitizeString(input, options);
}
export function validateFile(file) {
  return getValidator().validateFile(file);
}
//# sourceMappingURL=inputValidation.js.map
