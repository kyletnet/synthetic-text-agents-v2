interface OpsBriefValidationResult {
    exists: boolean;
    hasRequiredHeadings: boolean;
    missingHeadings: string[];
    hasCurrentCommit: boolean;
    commitMatch: boolean;
    currentCommit: string | undefined;
    documentCommit: string | undefined;
    warnings: string[];
    errors: string[];
}
/**
 * Verifies the operations brief exists and has required structure
 */
export declare class OpsBriefVerifier {
    private readonly opsBriefPath;
    private readonly requiredHeadings;
    constructor(rootPath?: string);
    /**
     * Performs comprehensive validation of the ops brief
     */
    verify(): OpsBriefValidationResult;
    /**
     * Validates that all required headings are present
     */
    private validateHeadings;
    /**
     * Validates commit synchronization
     */
    private validateCommitSync;
    /**
     * Additional structure validation
     */
    private validateStructure;
    /**
     * Formats validation results for console output
     */
    formatResults(result: OpsBriefValidationResult): string;
}
export {};
//# sourceMappingURL=verify_ops_brief.d.ts.map