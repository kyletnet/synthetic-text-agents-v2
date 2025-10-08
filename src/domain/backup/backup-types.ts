/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Backup Domain Types
 * Core type definitions for backup system
 */

export type BackupType = "full" | "incremental" | "differential";

export type BackupStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type VerificationStatus = "pending" | "passed" | "failed";

export type CompressionAlgorithm = "gzip" | "brotli" | "lz4";

export type EncryptionAlgorithm = "aes-256-gcm" | "chacha20-poly1305";

export type ChecksumAlgorithm = "sha256" | "sha512" | "blake3";

export interface BackupFileInfo {
  path: string;
  size: number;
  modifiedTime: Date;
  checksum: string;
  compressed: boolean;
  encrypted: boolean;
}

export interface BackupMetadata {
  id: string;
  jobName?: string; // Job name for grouping backups
  strategy: string;
  type: BackupType;
  timestamp: Date;
  startTime: Date;
  endTime?: Date;
  status: BackupStatus;
  size: number;
  compressedSize?: number;
  checksums: Record<string, string>;
  files: BackupFileInfo[];
  parentBackupId?: string; // For incremental/differential
  errorMessage?: string;
  verificationStatus?: VerificationStatus;
  backupPath?: string; // Actual path where backup is stored
}

export interface BackupConfig {
  enabled: boolean;
  compression: {
    enabled: boolean;
    algorithm: CompressionAlgorithm;
    level: number;
  };
  encryption: {
    enabled: boolean;
    algorithm: EncryptionAlgorithm;
    keyId: string;
  };
  verification: {
    enabled: boolean;
    checksumAlgorithm: ChecksumAlgorithm;
    testRestore: boolean;
  };
}

export interface BackupResult {
  success: boolean;
  backupId: string;
  metadata: BackupMetadata;
  duration: number;
}

export interface RestoreRequest {
  backupId: string;
  targetPath: string;
  files?: string[]; // Specific files to restore, if not provided restore all
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

export interface BackupFilters {
  include?: string[];
  exclude?: string[];
}
