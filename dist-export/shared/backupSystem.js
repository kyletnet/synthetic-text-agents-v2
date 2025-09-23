/**
 * Backup and Disaster Recovery System
 * Provides automated backup, recovery, and disaster recovery capabilities
 */
import { EventEmitter } from "events";
import { Logger } from "./logger";
import * as fs from "fs/promises";
import * as path from "path";
import { createReadStream, createWriteStream } from "fs";
import { createGzip, createGunzip } from "zlib";
import { pipeline } from "stream/promises";
export class BackupSystem extends EventEmitter {
    config;
    logger;
    backups = new Map();
    activeBackups = new Set();
    scheduleTimers = new Map();
    disasterRecoveryPlans = new Map();
    constructor(config) {
        super();
        this.config = config;
        this.logger = new Logger({ level: "info" });
        if (config.enabled) {
            this.loadExistingBackups();
            this.scheduleBackups();
        }
    }
    /**
     * Create a backup using specified strategy
     */
    async createBackup(strategyName, manual = false) {
        const strategy = this.config.strategies.find((s) => s.name === strategyName);
        if (!strategy) {
            throw new Error(`Backup strategy '${strategyName}' not found`);
        }
        if (!strategy.enabled) {
            throw new Error(`Backup strategy '${strategyName}' is disabled`);
        }
        const backupId = this.generateBackupId(strategy);
        if (this.activeBackups.has(strategyName)) {
            throw new Error(`Backup for strategy '${strategyName}' is already running`);
        }
        const metadata = {
            id: backupId,
            strategy: strategyName,
            type: strategy.type,
            timestamp: new Date(),
            startTime: new Date(),
            status: "pending",
            size: 0,
            checksums: {},
            files: [],
        };
        if (strategy.type === "incremental" || strategy.type === "differential") {
            metadata.parentBackupId = await this.findLastBackup(strategyName, strategy.type);
        }
        this.backups.set(backupId, metadata);
        this.activeBackups.add(strategyName);
        try {
            await this.executeBackup(strategy, metadata);
            if (this.config.verification.enabled) {
                await this.verifyBackup(backupId);
            }
            this.emit("backup:completed", {
                backupId,
                strategy: strategyName,
                manual,
            });
            this.logger.info(`Backup completed successfully: ${backupId}`);
            return backupId;
        }
        catch (error) {
            metadata.status = "failed";
            metadata.errorMessage = error.message;
            metadata.endTime = new Date();
            this.emit("backup:failed", { backupId, strategy: strategyName, error });
            this.logger.error(`Backup failed: ${backupId}`, error);
            throw error;
        }
        finally {
            this.activeBackups.delete(strategyName);
        }
    }
    /**
     * Restore from a backup
     */
    async restore(request) {
        const backup = this.backups.get(request.backupId);
        if (!backup) {
            throw new Error(`Backup ${request.backupId} not found`);
        }
        if (backup.status !== "completed") {
            throw new Error(`Backup ${request.backupId} is not in completed state`);
        }
        this.logger.info(`Starting restore from backup: ${request.backupId}`);
        const startTime = Date.now();
        try {
            const result = await this.executeRestore(backup, request);
            this.emit("restore:completed", { backupId: request.backupId, result });
            this.logger.info(`Restore completed: ${request.backupId}`);
            return result;
        }
        catch (error) {
            this.emit("restore:failed", { backupId: request.backupId, error });
            this.logger.error(`Restore failed: ${request.backupId}`, error);
            throw error;
        }
    }
    /**
     * List available backups
     */
    listBackups(strategyName) {
        let backups = Array.from(this.backups.values());
        if (strategyName) {
            backups = backups.filter((b) => b.strategy === strategyName);
        }
        return backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    /**
     * Get backup details
     */
    getBackup(backupId) {
        return this.backups.get(backupId) || null;
    }
    /**
     * Delete a backup
     */
    async deleteBackup(backupId) {
        const backup = this.backups.get(backupId);
        if (!backup) {
            throw new Error(`Backup ${backupId} not found`);
        }
        try {
            await this.deleteBackupFiles(backup);
            this.backups.delete(backupId);
            this.emit("backup:deleted", { backupId });
            this.logger.info(`Backup deleted: ${backupId}`);
        }
        catch (error) {
            this.logger.error(`Failed to delete backup: ${backupId}`, error);
            throw error;
        }
    }
    /**
     * Apply retention policy
     */
    async applyRetentionPolicy() {
        const now = new Date();
        const deletedBackups = [];
        for (const backup of this.backups.values()) {
            if (this.shouldDeleteBackup(backup, now)) {
                try {
                    await this.deleteBackup(backup.id);
                    deletedBackups.push(backup.id);
                }
                catch (error) {
                    this.logger.error(`Failed to delete backup during retention: ${backup.id}`, error);
                }
            }
        }
        if (deletedBackups.length > 0) {
            this.logger.info(`Retention policy applied: ${deletedBackups.length} backups deleted`);
            this.emit("retention:applied", {
                deletedCount: deletedBackups.length,
                deletedBackups,
            });
        }
    }
    /**
     * Register a disaster recovery plan
     */
    registerDisasterRecoveryPlan(plan) {
        this.disasterRecoveryPlans.set(plan.id, plan);
        this.logger.info(`Disaster recovery plan registered: ${plan.id}`);
    }
    /**
     * Execute disaster recovery plan
     */
    async executeDisasterRecovery(planId, context) {
        const plan = this.disasterRecoveryPlans.get(planId);
        if (!plan) {
            throw new Error(`Disaster recovery plan '${planId}' not found`);
        }
        this.logger.warn(`Executing disaster recovery plan: ${planId}`);
        this.emit("disaster_recovery:started", { planId, plan });
        try {
            // Execute dependencies first
            for (const depPlanId of plan.dependencies) {
                await this.executeDisasterRecovery(depPlanId, context);
            }
            // Execute recovery steps
            for (const step of plan.steps) {
                await this.executeRecoveryStep(step, context);
            }
            this.emit("disaster_recovery:completed", { planId });
            this.logger.info(`Disaster recovery plan completed: ${planId}`);
        }
        catch (error) {
            this.emit("disaster_recovery:failed", { planId, error });
            this.logger.error(`Disaster recovery plan failed: ${planId}`, error);
            throw error;
        }
    }
    /**
     * Get system backup status
     */
    getSystemStatus() {
        const backups = Array.from(this.backups.values());
        const totalSize = backups.reduce((sum, b) => sum + b.size, 0);
        const failedBackups = backups.filter((b) => b.status === "failed").length;
        const lastBackup = backups.length > 0
            ? new Date(Math.max(...backups.map((b) => b.timestamp.getTime())))
            : null;
        const successfulBackups = backups.filter((b) => b.status === "completed");
        const lastSuccessfulBackup = successfulBackups.length > 0
            ? new Date(Math.max(...successfulBackups.map((b) => b.timestamp.getTime())))
            : null;
        return {
            enabled: this.config.enabled,
            activeBackups: Array.from(this.activeBackups),
            totalBackups: backups.length,
            totalSize,
            lastBackup,
            lastSuccessfulBackup,
            failedBackups,
        };
    }
    /**
     * Shutdown the backup system
     */
    async shutdown() {
        // Clear all scheduled timers
        for (const timer of this.scheduleTimers.values()) {
            clearTimeout(timer);
        }
        this.scheduleTimers.clear();
        // Cancel active backups (if any)
        for (const strategyName of this.activeBackups) {
            this.emit("backup:cancelled", { strategy: strategyName });
        }
        this.emit("shutdown");
    }
    async executeBackup(strategy, metadata) {
        metadata.status = "running";
        this.emit("backup:started", {
            backupId: metadata.id,
            strategy: strategy.name,
        });
        const backupPath = await this.createBackupPath(metadata);
        let totalSize = 0;
        const files = [];
        try {
            // Create backup directory
            await fs.mkdir(path.dirname(backupPath), { recursive: true });
            // Collect files to backup
            const filesToBackup = await this.collectFiles(strategy, metadata);
            // Process each file
            for (const sourceFile of filesToBackup) {
                const fileInfo = await this.backupFile(sourceFile, backupPath, strategy);
                files.push(fileInfo);
                totalSize += fileInfo.size;
                this.emit("backup:progress", {
                    backupId: metadata.id,
                    processed: files.length,
                    total: filesToBackup.length,
                    currentFile: sourceFile,
                });
            }
            // Calculate overall checksum
            metadata.checksums.backup = await this.calculateChecksum(backupPath);
            metadata.size = totalSize;
            metadata.files = files;
            metadata.status = "completed";
            metadata.endTime = new Date();
            // Save metadata
            await this.saveBackupMetadata(metadata);
        }
        catch (error) {
            metadata.status = "failed";
            metadata.errorMessage = error.message;
            metadata.endTime = new Date();
            throw error;
        }
    }
    async executeRestore(backup, request) {
        const result = {
            success: false,
            restoredFiles: 0,
            totalFiles: 0,
            skippedFiles: 0,
            errors: [],
            duration: 0,
        };
        const startTime = Date.now();
        try {
            const filesToRestore = request.files
                ? backup.files.filter((f) => request.files?.includes(f.path) ?? false)
                : backup.files;
            result.totalFiles = filesToRestore.length;
            if (request.dryRun) {
                this.logger.info(`Dry run restore: would restore ${filesToRestore.length} files`);
                result.success = true;
                return result;
            }
            // Ensure target directory exists
            await fs.mkdir(request.targetPath, { recursive: true });
            // Restore files
            for (const fileInfo of filesToRestore) {
                try {
                    const targetFile = path.join(request.targetPath, fileInfo.path);
                    const targetDir = path.dirname(targetFile);
                    // Check if file exists and handle overwrite
                    if (!request.overwrite) {
                        try {
                            await fs.access(targetFile);
                            result.skippedFiles++;
                            continue;
                        }
                        catch {
                            // File doesn't exist, continue with restore
                        }
                    }
                    // Create target directory
                    await fs.mkdir(targetDir, { recursive: true });
                    // Restore file
                    await this.restoreFile(backup, fileInfo, targetFile);
                    result.restoredFiles++;
                }
                catch (error) {
                    result.errors.push(`Failed to restore ${fileInfo.path}: ${error.message}`);
                }
            }
            result.success = result.errors.length === 0;
            result.duration = Date.now() - startTime;
            return result;
        }
        catch (error) {
            result.errors.push(error.message);
            result.duration = Date.now() - startTime;
            throw error;
        }
    }
    async collectFiles(strategy, metadata) {
        const files = [];
        for (const sourcePath of strategy.source.paths) {
            const pathFiles = await this.collectFilesFromPath(sourcePath, strategy.filters);
            files.push(...pathFiles);
        }
        // For incremental/differential backups, filter based on last backup
        if (metadata.parentBackupId &&
            (strategy.type === "incremental" || strategy.type === "differential")) {
            const parentBackup = this.backups.get(metadata.parentBackupId);
            if (parentBackup) {
                return this.filterChangedFiles(files, parentBackup, strategy.type);
            }
        }
        return files;
    }
    async collectFilesFromPath(sourcePath, filters) {
        const files = [];
        try {
            const stats = await fs.stat(sourcePath);
            if (stats.isFile()) {
                if (this.shouldIncludeFile(sourcePath, filters)) {
                    files.push(sourcePath);
                }
            }
            else if (stats.isDirectory()) {
                const entries = await fs.readdir(sourcePath, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(sourcePath, entry.name);
                    if (entry.isDirectory()) {
                        const subFiles = await this.collectFilesFromPath(fullPath, filters);
                        files.push(...subFiles);
                    }
                    else if (entry.isFile() &&
                        this.shouldIncludeFile(fullPath, filters)) {
                        files.push(fullPath);
                    }
                }
            }
        }
        catch (error) {
            this.logger.warn(`Failed to access path ${sourcePath}:`, error);
        }
        return files;
    }
    shouldIncludeFile(filePath, filters) {
        if (!filters)
            return true;
        // Check exclude patterns
        if (filters.exclude) {
            for (const pattern of filters.exclude) {
                if (this.matchesPattern(filePath, pattern)) {
                    return false;
                }
            }
        }
        // Check include patterns
        if (filters.include) {
            for (const pattern of filters.include) {
                if (this.matchesPattern(filePath, pattern)) {
                    return true;
                }
            }
            return false; // If include patterns exist, file must match at least one
        }
        return true;
    }
    matchesPattern(filePath, pattern) {
        // Simple glob-like pattern matching
        const regex = pattern.replace(/\*/g, ".*").replace(/\?/g, ".");
        return new RegExp(regex).test(filePath);
    }
    async filterChangedFiles(files, parentBackup, type) {
        const changedFiles = [];
        const parentFileMap = new Map(parentBackup.files.map((f) => [f.path, f]));
        for (const file of files) {
            try {
                const stats = await fs.stat(file);
                const parentFileInfo = parentFileMap.get(file);
                if (!parentFileInfo || stats.mtime > parentFileInfo.modifiedTime) {
                    changedFiles.push(file);
                }
            }
            catch (error) {
                // File may have been deleted, include it anyway
                changedFiles.push(file);
            }
        }
        return changedFiles;
    }
    async backupFile(sourceFile, backupPath, strategy) {
        const stats = await fs.stat(sourceFile);
        const checksum = await this.calculateChecksum(sourceFile);
        const fileInfo = {
            path: sourceFile,
            size: stats.size,
            modifiedTime: stats.mtime,
            checksum,
            compressed: this.config.compression.enabled,
            encrypted: this.config.encryption.enabled,
        };
        // For now, just copy the file (compression and encryption would be implemented here)
        const targetFile = path.join(backupPath, "files", this.encodeFilePath(sourceFile));
        await fs.mkdir(path.dirname(targetFile), { recursive: true });
        if (this.config.compression.enabled) {
            await this.compressFile(sourceFile, targetFile);
        }
        else {
            await fs.copyFile(sourceFile, targetFile);
        }
        return fileInfo;
    }
    async restoreFile(backup, fileInfo, targetFile) {
        const backupPath = await this.getBackupPath(backup);
        const sourceFile = path.join(backupPath, "files", this.encodeFilePath(fileInfo.path));
        if (fileInfo.compressed) {
            await this.decompressFile(sourceFile, targetFile);
        }
        else {
            await fs.copyFile(sourceFile, targetFile);
        }
    }
    async compressFile(sourceFile, targetFile) {
        const readStream = createReadStream(sourceFile);
        const writeStream = createWriteStream(targetFile);
        const gzipStream = createGzip();
        await pipeline(readStream, gzipStream, writeStream);
    }
    async decompressFile(sourceFile, targetFile) {
        const readStream = createReadStream(sourceFile);
        const writeStream = createWriteStream(targetFile);
        const gunzipStream = createGunzip();
        await pipeline(readStream, gunzipStream, writeStream);
    }
    async calculateChecksum(filePath) {
        const crypto = require("crypto");
        const hash = crypto.createHash(this.config.verification.checksumAlgorithm);
        const stream = createReadStream(filePath);
        for await (const chunk of stream) {
            hash.update(chunk);
        }
        return hash.digest("hex");
    }
    async verifyBackup(backupId) {
        const backup = this.backups.get(backupId);
        if (!backup)
            return;
        backup.verificationStatus = "pending";
        try {
            // Verify checksums of backup files
            const backupPath = await this.getBackupPath(backup);
            const actualChecksum = await this.calculateChecksum(backupPath);
            if (actualChecksum === backup.checksums.backup) {
                backup.verificationStatus = "passed";
                this.logger.info(`Backup verification passed: ${backupId}`);
            }
            else {
                backup.verificationStatus = "failed";
                this.logger.error(`Backup verification failed: ${backupId} (checksum mismatch)`);
            }
        }
        catch (error) {
            backup.verificationStatus = "failed";
            this.logger.error(`Backup verification failed: ${backupId}`, error);
        }
    }
    async executeRecoveryStep(step, context) {
        this.logger.info(`Executing recovery step: ${step.name}`);
        switch (step.type) {
            case "backup_restore":
                await this.executeBackupRestoreStep(step, context);
                break;
            case "service_restart":
                await this.executeServiceRestartStep(step, context);
                break;
            case "database_recovery":
                await this.executeDatabaseRecoveryStep(step, context);
                break;
            case "configuration_update":
                await this.executeConfigurationUpdateStep(step, context);
                break;
            case "custom_script":
                await this.executeCustomScriptStep(step, context);
                break;
            default:
                throw new Error(`Unknown recovery step type: ${step.type}`);
        }
        this.logger.info(`Recovery step completed: ${step.name}`);
    }
    async executeBackupRestoreStep(step, context) {
        const config = step.configuration;
        const backupId = config.backupId;
        const targetPath = config.targetPath;
        await this.restore({
            backupId,
            targetPath,
            overwrite: config.overwrite || true,
            preservePermissions: config.preservePermissions || true,
            dryRun: false,
        });
    }
    async executeServiceRestartStep(step, context) {
        // Service restart implementation would go here
        this.logger.info(`Service restart step: ${step.name}`);
    }
    async executeDatabaseRecoveryStep(step, context) {
        // Database recovery implementation would go here
        this.logger.info(`Database recovery step: ${step.name}`);
    }
    async executeConfigurationUpdateStep(step, context) {
        // Configuration update implementation would go here
        this.logger.info(`Configuration update step: ${step.name}`);
    }
    async executeCustomScriptStep(step, context) {
        // Custom script execution implementation would go here
        this.logger.info(`Custom script step: ${step.name}`);
    }
    shouldDeleteBackup(backup, now) {
        const ageInDays = (now.getTime() - backup.timestamp.getTime()) / (1000 * 60 * 60 * 24);
        // Apply retention policy based on backup age and type
        if (ageInDays <= this.config.retention.daily) {
            return false; // Keep all backups within daily retention
        }
        // More sophisticated retention logic would go here
        return false;
    }
    scheduleBackups() {
        // Backup scheduling implementation would go here
        this.logger.info("Backup scheduling initialized");
    }
    async loadExistingBackups() {
        // Load existing backup metadata from storage
        this.logger.info("Loading existing backup metadata");
    }
    async createBackupPath(metadata) {
        const timestamp = metadata.timestamp.toISOString().replace(/[:.]/g, "-");
        return path.join("/tmp/backups", metadata.strategy, `${metadata.type}-${timestamp}-${metadata.id}`);
    }
    async getBackupPath(backup) {
        const timestamp = backup.timestamp.toISOString().replace(/[:.]/g, "-");
        return path.join("/tmp/backups", backup.strategy, `${backup.type}-${timestamp}-${backup.id}`);
    }
    encodeFilePath(filePath) {
        return filePath.replace(/[/\\]/g, "_");
    }
    async saveBackupMetadata(metadata) {
        const backupPath = await this.getBackupPath(metadata);
        const metadataPath = path.join(backupPath, "metadata.json");
        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    }
    async findLastBackup(strategyName, type) {
        const strategyBackups = Array.from(this.backups.values())
            .filter((b) => b.strategy === strategyName && b.status === "completed")
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        if (type === "incremental") {
            // Find last backup of any type
            return strategyBackups[0]?.id;
        }
        else {
            // Find last full backup for differential
            const lastFull = strategyBackups.find((b) => b.type === "full");
            return lastFull?.id;
        }
    }
    async deleteBackupFiles(backup) {
        const backupPath = await this.getBackupPath(backup);
        await fs.rm(backupPath, { recursive: true, force: true });
    }
    generateBackupId(strategy) {
        return `backup_${strategy.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
// Global backup system instance
let globalBackupSystem = null;
export function initializeBackupSystem(config) {
    if (globalBackupSystem) {
        globalBackupSystem.shutdown();
    }
    globalBackupSystem = new BackupSystem(config);
    return globalBackupSystem;
}
export function getBackupSystem() {
    return globalBackupSystem;
}
//# sourceMappingURL=backupSystem.js.map