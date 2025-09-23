/**
 * Backup and Disaster Recovery System
 * Provides automated backup, recovery, and disaster recovery capabilities
 */
import { EventEmitter } from "events";
export interface BackupConfig {
    enabled: boolean;
    strategies: BackupStrategy[];
    retention: RetentionPolicy;
    compression: {
        enabled: boolean;
        algorithm: "gzip" | "brotli" | "lz4";
        level: number;
    };
    encryption: {
        enabled: boolean;
        algorithm: "aes-256-gcm" | "chacha20-poly1305";
        keyId: string;
    };
    scheduling: {
        full: string;
        incremental: string;
        differential: string;
    };
    verification: {
        enabled: boolean;
        checksumAlgorithm: "sha256" | "sha512" | "blake3";
        testRestore: boolean;
    };
}
export interface BackupStrategy {
    name: string;
    type: "full" | "incremental" | "differential";
    source: BackupSource;
    destination: BackupDestination;
    enabled: boolean;
    priority: number;
    maxRetryAttempts: number;
    filters?: {
        include?: string[];
        exclude?: string[];
    };
}
export interface BackupSource {
    type: "filesystem" | "database" | "application_data" | "configuration";
    paths: string[];
    metadata?: Record<string, unknown>;
}
export interface BackupDestination {
    type: "local" | "s3" | "azure" | "gcp" | "sftp" | "rsync";
    location: string;
    credentials?: Record<string, string>;
    options?: Record<string, unknown>;
}
export interface RetentionPolicy {
    daily: number;
    weekly: number;
    monthly: number;
    yearly: number;
}
export interface BackupMetadata {
    id: string;
    strategy: string;
    type: "full" | "incremental" | "differential";
    timestamp: Date;
    startTime: Date;
    endTime?: Date;
    status: "pending" | "running" | "completed" | "failed" | "cancelled";
    size: number;
    compressedSize?: number;
    checksums: Record<string, string>;
    files: BackupFileInfo[];
    parentBackupId?: string;
    errorMessage?: string;
    verificationStatus?: "pending" | "passed" | "failed";
}
export interface BackupFileInfo {
    path: string;
    size: number;
    modifiedTime: Date;
    checksum: string;
    compressed: boolean;
    encrypted: boolean;
}
export interface RestoreRequest {
    backupId: string;
    targetPath: string;
    files?: string[];
    overwrite: boolean;
    preservePermissions: boolean;
    dryRun: boolean;
}
export interface RestoreResult {
    success: boolean;
    restoredFiles: number;
    totalFiles: number;
    skippedFiles: number;
    errors: string[];
    duration: number;
}
export interface DisasterRecoveryPlan {
    id: string;
    name: string;
    description: string;
    priority: "critical" | "high" | "medium" | "low";
    triggers: DisasterTrigger[];
    steps: RecoveryStep[];
    estimatedRTO: number;
    estimatedRPO: number;
    dependencies: string[];
}
export interface DisasterTrigger {
    type: "manual" | "health_check_failure" | "data_corruption" | "security_breach" | "system_failure";
    conditions: Record<string, unknown>;
}
export interface RecoveryStep {
    id: string;
    name: string;
    description: string;
    type: "backup_restore" | "service_restart" | "database_recovery" | "configuration_update" | "custom_script";
    configuration: Record<string, unknown>;
    timeout: number;
    retryAttempts: number;
    dependencies: string[];
}
export declare class BackupSystem extends EventEmitter {
    private config;
    private logger;
    private backups;
    private activeBackups;
    private scheduleTimers;
    private disasterRecoveryPlans;
    constructor(config: BackupConfig);
    /**
     * Create a backup using specified strategy
     */
    createBackup(strategyName: string, manual?: boolean): Promise<string>;
    /**
     * Restore from a backup
     */
    restore(request: RestoreRequest): Promise<RestoreResult>;
    /**
     * List available backups
     */
    listBackups(strategyName?: string): BackupMetadata[];
    /**
     * Get backup details
     */
    getBackup(backupId: string): BackupMetadata | null;
    /**
     * Delete a backup
     */
    deleteBackup(backupId: string): Promise<void>;
    /**
     * Apply retention policy
     */
    applyRetentionPolicy(): Promise<void>;
    /**
     * Register a disaster recovery plan
     */
    registerDisasterRecoveryPlan(plan: DisasterRecoveryPlan): void;
    /**
     * Execute disaster recovery plan
     */
    executeDisasterRecovery(planId: string, context?: Record<string, unknown>): Promise<void>;
    /**
     * Get system backup status
     */
    getSystemStatus(): {
        enabled: boolean;
        activeBackups: string[];
        totalBackups: number;
        totalSize: number;
        lastBackup: Date | null;
        lastSuccessfulBackup: Date | null;
        failedBackups: number;
    };
    /**
     * Shutdown the backup system
     */
    shutdown(): Promise<void>;
    private executeBackup;
    private executeRestore;
    private collectFiles;
    private collectFilesFromPath;
    private shouldIncludeFile;
    private matchesPattern;
    private filterChangedFiles;
    private backupFile;
    private restoreFile;
    private compressFile;
    private decompressFile;
    private calculateChecksum;
    private verifyBackup;
    private executeRecoveryStep;
    private executeBackupRestoreStep;
    private executeServiceRestartStep;
    private executeDatabaseRecoveryStep;
    private executeConfigurationUpdateStep;
    private executeCustomScriptStep;
    private shouldDeleteBackup;
    private scheduleBackups;
    private loadExistingBackups;
    private createBackupPath;
    private getBackupPath;
    private encodeFilePath;
    private saveBackupMetadata;
    private findLastBackup;
    private deleteBackupFiles;
    private generateBackupId;
}
export declare function initializeBackupSystem(config: BackupConfig): BackupSystem;
export declare function getBackupSystem(): BackupSystem | null;
//# sourceMappingURL=backupSystem.d.ts.map