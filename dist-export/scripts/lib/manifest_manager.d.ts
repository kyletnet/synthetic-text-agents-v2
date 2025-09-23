/**
 * Manifest Manager
 * Handles data freeze, checksums, and reproducibility tracking
 * Ensures ±5% reproducibility for baseline runs
 */
export interface FileManifestEntry {
    path: string;
    relative_path: string;
    size_bytes: number;
    checksum_sha256: string;
    last_modified: string;
    content_type: string;
}
export interface DataManifest {
    manifest_id: string;
    created_timestamp: string;
    description: string;
    base_directory: string;
    freeze_enabled: boolean;
    input_files: FileManifestEntry[];
    input_total_size: number;
    input_checksum: string;
    gold_files: FileManifestEntry[];
    gold_total_size: number;
    gold_checksum: string;
    config_files: FileManifestEntry[];
    config_checksum: string;
    file_count: number;
    total_size_bytes: number;
    manifest_checksum: string;
    seed_value: number;
    reproducibility_target_pct: number;
    comparison_window_days: number;
}
export interface ReproducibilityCheck {
    manifest_id: string;
    baseline_run_id: string;
    comparison_run_id: string;
    check_timestamp: string;
    metrics_comparison: {
        [metric: string]: {
            baseline_value: number;
            comparison_value: number;
            delta_pct: number;
            within_tolerance: boolean;
        };
    };
    overall_delta_pct: number;
    within_target: boolean;
    target_pct: number;
    significant_changes: string[];
    recommendations: string[];
}
export declare class ManifestManager {
    private manifestDir;
    private baseDir;
    constructor(baseDir?: string);
    private ensureDirectoryExists;
    /**
     * Create a new data manifest with freeze capability
     */
    createManifest(description: string, inputPatterns: string[], goldPatterns?: string[], configPatterns?: string[], freezeEnabled?: boolean, seedValue?: number): Promise<DataManifest>;
    /**
     * Load existing manifest
     */
    loadManifest(manifestId: string): DataManifest | null;
    /**
     * Validate manifest integrity
     */
    validateManifest(manifestId: string): Promise<{
        valid: boolean;
        issues: string[];
        missing_files: string[];
        modified_files: string[];
    }>;
    /**
     * Get the latest manifest for a pattern
     */
    getLatestManifest(descriptionPattern?: string): DataManifest | null;
    /**
     * Check reproducibility between two runs
     */
    checkReproducibility(manifestId: string, baselineMetrics: any, comparisonMetrics: any, baselineRunId: string, comparisonRunId: string): ReproducibilityCheck;
    /**
     * Collect files matching patterns
     */
    private collectFiles;
    /**
     * Calculate file checksum
     */
    private calculateFileChecksum;
    /**
     * Calculate group checksum from file entries
     */
    private calculateGroupChecksum;
    /**
     * Calculate manifest checksum
     */
    private calculateManifestChecksum;
    /**
     * Generate unique manifest ID
     */
    private generateManifestId;
    /**
     * Generate random seed
     */
    private generateSeed;
    /**
     * Get content type based on file extension
     */
    private getContentType;
    /**
     * Extract metric value from metrics object
     */
    private extractMetricValue;
    /**
     * Get nested value from object using dot notation
     */
    private getNestedValue;
    /**
     * Save manifest to file
     */
    private saveManifest;
    /**
     * Save reproducibility check
     */
    private saveReproducibilityCheck;
    /**
     * List all manifests
     */
    listManifests(): {
        id: string;
        description: string;
        created: string;
        file_count: number;
    }[];
}
/**
 * Factory function to create manifest manager
 */
export declare function createManifestManager(baseDir?: string): ManifestManager;
/**
 * Default patterns for different environments
 */
export declare const DEFAULT_PATTERNS: {
    input: string[];
    gold: string[];
    config: string[];
};
//# sourceMappingURL=manifest_manager.d.ts.map