/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Snapshot Schema - System State Capture
 *
 * Purpose:
 * - Capture system state before/after operations
 * - Detect unexpected changes
 * - Enable rollback if needed
 *
 * Design:
 * - File hashes for integrity verification
 * - Package.json dependencies tracking
 * - Git commit tracking
 * - Environment variables snapshot
 */

export interface SystemSnapshot {
  /** Unique identifier for this snapshot */
  id: string;

  /** ISO 8601 timestamp */
  timestamp: string;

  /** Git commit hash at snapshot time */
  gitCommit: string;

  /** Git branch name */
  gitBranch: string;

  /** Files with their hashes */
  files: Record<string, FileSnapshot>;

  /** Package.json metadata */
  packageJson: PackageSnapshot;

  /** Environment variables (non-sensitive) */
  environmentVariables: string[];

  /** Operation context (optional) */
  context?: {
    operationId: string;
    operationName: string;
    phase: "before" | "after";
  };
}

export interface FileSnapshot {
  /** SHA-256 hash of file content */
  hash: string;

  /** File size in bytes */
  size: number;

  /** Last modified timestamp */
  mtime: string;

  /** Relative path from project root */
  path: string;

  /** File content (for complete rollback) */
  content?: string;
}

export interface PackageSnapshot {
  /** Package version */
  version: string;

  /** Production dependencies */
  dependencies: Record<string, string>;

  /** Development dependencies */
  devDependencies: Record<string, string>;

  /** Package name */
  name: string;

  /** Node engine requirement */
  engines?: {
    node?: string;
    npm?: string;
  };
}

export interface SnapshotDiff {
  /** Files that were added */
  filesAdded: string[];

  /** Files that were modified */
  filesModified: Array<{
    path: string;
    beforeHash: string;
    afterHash: string;
  }>;

  /** Files that were deleted */
  filesDeleted: string[];

  /** Dependencies that changed */
  dependenciesChanged: Array<{
    name: string;
    before: string;
    after: string;
    type: "dependency" | "devDependency";
  }>;

  /** Unexpected changes (not in allowed paths) */
  unexpectedChanges: Array<{
    path: string;
    reason: string;
    severity: "critical" | "high" | "medium" | "low";
  }>;

  /** Summary statistics */
  summary: {
    totalFilesChanged: number;
    totalDependenciesChanged: number;
    hasUnexpectedChanges: boolean;
    riskLevel: "critical" | "high" | "medium" | "low" | "none";
  };
}

export interface SnapshotCompareOptions {
  /** Paths to ignore in comparison */
  ignorePaths?: string[];

  /** Whether to treat all changes as unexpected */
  strictMode?: boolean;

  /** Custom risk assessment function */
  riskAssessor?: (
    diff: SnapshotDiff,
  ) => "critical" | "high" | "medium" | "low" | "none";
}

/**
 * Snapshot validation result
 */
export interface SnapshotValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  snapshot?: SystemSnapshot;
}
