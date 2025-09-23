/**
 * session_report_validator.ts — Validate session reports against JSON schemas
 */
interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    schema?: any;
    data?: any;
}
export declare class SessionReportValidator {
    private ajv;
    constructor();
    validateReport(reportPath: string, schemaPath: string): Promise<ValidationResult>;
    private parseReportData;
    private extractDataFromMarkdown;
    private extractFromMarkdownPatterns;
    private extractValue;
    private extractNumber;
    private extractArray;
    private formatValidationError;
    private isWarningLevel;
    validateWithBuiltinSchema(reportPath: string, schemaType: "session_report" | "baseline_report"): Promise<ValidationResult>;
    validateBatch(reportPaths: string[], schemaPath: string): Promise<Array<{
        path: string;
        result: ValidationResult;
    }>>;
    generateValidationSummary(results: Array<{
        path: string;
        result: ValidationResult;
    }>): {
        total: number;
        valid: number;
        invalid: number;
        warnings: number;
        details: Array<{
            path: string;
            status: "valid" | "invalid" | "warnings";
            errorCount: number;
            warningCount: number;
        }>;
    };
}
export {};
//# sourceMappingURL=session_report_validator.d.ts.map