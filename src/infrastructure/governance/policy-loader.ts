/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Policy Loader - Version-Safe Policy Document Loading
 *
 * Purpose:
 * - Prevent version mismatch during Parser/Interpreter development
 * - Hash-based consistency check for policy documents
 * - Atomic loading with rollback on failure
 *
 * Phase 2C: Safe external policy integration
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { createHash } from "crypto";
import pLimit from "p-limit";
import type { Logger } from "../../shared/logger.js";

/**
 * Policy document metadata
 */
export interface PolicyMetadata {
  name: string;
  version: string;
  hash: string; // SHA-256 hash of content
  loadedAt: string; // ISO timestamp
  source: "file" | "external" | "inline";
  contentType: "yaml" | "json" | "markdown" | "text";
}

/**
 * Policy load result
 */
export interface PolicyLoadResult {
  success: boolean;
  policy?: LoadedPolicy;
  error?: string;
  consistencyCheck: {
    hashMatch: boolean;
    versionMatch: boolean;
  };
}

/**
 * Loaded policy with metadata
 */
export interface LoadedPolicy {
  name: string;
  version: string;
  content: string;
  metadata: PolicyMetadata;
}

/**
 * Policy version lock (prevents concurrent modification)
 */
export interface PolicyVersionLock {
  name: string;
  version: string;
  hash: string;
  lockedAt: string;
  lockedBy: string; // Process ID or session ID
}

/**
 * Policy Loader - Safe policy document loading with version control
 *
 * Features:
 * - Hash-based consistency check (SHA-256)
 * - Version locking (prevents concurrent modification)
 * - Atomic loading (all-or-nothing)
 * - Rollback on failure
 */
export class PolicyLoader {
  private readonly logger: Logger;
  private readonly projectRoot: string;
  private readonly versionLocks: Map<string, PolicyVersionLock> = new Map();
  private readonly loadedPolicies: Map<string, LoadedPolicy> = new Map();
  private readonly loadLimit = pLimit(2); // Phase 2C: I/O Throttle (max 2 concurrent loads)

  constructor(logger: Logger, projectRoot?: string) {
    this.logger = logger;
    this.projectRoot = projectRoot || process.cwd();
  }

  /**
   * Load policy document with hash consistency check
   *
   * Algorithm:
   * 1. Read policy file
   * 2. Calculate content hash (SHA-256)
   * 3. Check version lock (if exists)
   * 4. Verify hash matches locked version
   * 5. Load if consistent, reject otherwise
   */
  async loadPolicy(
    filePath: string,
    expectedVersion?: string,
  ): Promise<PolicyLoadResult> {
    this.logger.info("Loading policy document", { filePath, expectedVersion });

    try {
      // 1. Check if file exists
      if (!existsSync(filePath)) {
        return {
          success: false,
          error: `Policy file not found: ${filePath}`,
          consistencyCheck: {
            hashMatch: false,
            versionMatch: false,
          },
        };
      }

      // 2. Read policy content
      const content = readFileSync(filePath, "utf8");

      // 3. Calculate hash
      const hash = this.calculateHash(content);

      // 4. Parse metadata (extract name, version from content)
      const metadata = this.parseMetadata(content, filePath);

      // 5. Check version lock
      const lock = this.versionLocks.get(metadata.name);
      let hashMatch = true;
      let versionMatch = true;

      if (lock) {
        // Verify hash matches locked version
        hashMatch = lock.hash === hash;
        versionMatch = lock.version === metadata.version;

        if (!hashMatch || !versionMatch) {
          this.logger.warn("Policy version mismatch detected", {
            policy: metadata.name,
            expectedHash: lock.hash,
            actualHash: hash,
            expectedVersion: lock.version,
            actualVersion: metadata.version,
          });

          return {
            success: false,
            error: `Version mismatch: ${metadata.name} (expected: ${lock.version}, actual: ${metadata.version})`,
            consistencyCheck: {
              hashMatch,
              versionMatch,
            },
          };
        }
      }

      // 6. Check expected version (if provided)
      if (expectedVersion && metadata.version !== expectedVersion) {
        return {
          success: false,
          error: `Version mismatch: expected ${expectedVersion}, got ${metadata.version}`,
          consistencyCheck: {
            hashMatch: true,
            versionMatch: false,
          },
        };
      }

      // 7. Create loaded policy
      const loadedPolicy: LoadedPolicy = {
        name: metadata.name,
        version: metadata.version,
        content,
        metadata: {
          ...metadata,
          hash,
          loadedAt: new Date().toISOString(),
        },
      };

      // 8. Store in cache
      this.loadedPolicies.set(metadata.name, loadedPolicy);

      this.logger.info("Policy loaded successfully", {
        name: metadata.name,
        version: metadata.version,
        hash,
      });

      return {
        success: true,
        policy: loadedPolicy,
        consistencyCheck: {
          hashMatch,
          versionMatch,
        },
      };
    } catch (error) {
      this.logger.error("Failed to load policy", { filePath, error });
      return {
        success: false,
        error: String(error),
        consistencyCheck: {
          hashMatch: false,
          versionMatch: false,
        },
      };
    }
  }

  /**
   * Lock policy version (prevents concurrent modification)
   *
   * This creates a version lock to ensure no other process
   * modifies the policy while it's being processed.
   */
  lockVersion(name: string, version: string, hash: string): void {
    const lock: PolicyVersionLock = {
      name,
      version,
      hash,
      lockedAt: new Date().toISOString(),
      lockedBy: process.pid.toString(),
    };

    this.versionLocks.set(name, lock);

    this.logger.info("Policy version locked", {
      name,
      version,
      hash,
      lockedBy: lock.lockedBy,
    });
  }

  /**
   * Unlock policy version
   */
  unlockVersion(name: string): void {
    this.versionLocks.delete(name);
    this.logger.info("Policy version unlocked", { name });
  }

  /**
   * Get locked version info
   */
  getLock(name: string): PolicyVersionLock | undefined {
    return this.versionLocks.get(name);
  }

  /**
   * Check if policy is locked
   */
  isLocked(name: string): boolean {
    return this.versionLocks.has(name);
  }

  /**
   * Calculate SHA-256 hash of content
   */
  private calculateHash(content: string): string {
    return createHash("sha256").update(content).digest("hex");
  }

  /**
   * Parse metadata from policy content
   *
   * Supports:
   * - YAML: name, version from frontmatter
   * - JSON: name, version from root fields
   * - Markdown: name, version from frontmatter
   * - Text: Extract from first lines
   */
  private parseMetadata(
    content: string,
    filePath: string,
  ): Omit<PolicyMetadata, "hash" | "loadedAt"> {
    // Detect content type
    const contentType = this.detectContentType(content, filePath);

    // Extract name and version based on content type
    let name = "unknown-policy";
    let version = "1.0.0";

    if (contentType === "yaml" || contentType === "markdown") {
      // Extract from YAML frontmatter
      const nameMatch = content.match(/^name:\s*"?([^"\n]+)"?/m);
      const versionMatch = content.match(/^version:\s*"?([^"\n]+)"?/m);

      if (nameMatch) name = nameMatch[1].trim();
      if (versionMatch) version = versionMatch[1].trim();
    } else if (contentType === "json") {
      // Extract from JSON
      try {
        const parsed = JSON.parse(content);
        name = parsed.policy?.name || parsed.name || name;
        version = parsed.policy?.version || parsed.version || version;
      } catch {
        // Keep defaults
      }
    }

    return {
      name,
      version,
      source: "file",
      contentType,
    };
  }

  /**
   * Detect content type from content and file extension
   */
  private detectContentType(
    content: string,
    filePath: string,
  ): "yaml" | "json" | "markdown" | "text" {
    const ext = filePath.split(".").pop()?.toLowerCase();

    if (ext === "yaml" || ext === "yml") return "yaml";
    if (ext === "json") return "json";
    if (ext === "md") return "markdown";

    // Auto-detect from content
    if (content.trim().startsWith("{")) return "json";
    if (content.includes("---") || content.match(/^\w+:\s/m)) return "yaml";
    if (content.includes("#")) return "markdown";

    return "text";
  }

  /**
   * Get loaded policy from cache
   */
  getLoadedPolicy(name: string): LoadedPolicy | undefined {
    return this.loadedPolicies.get(name);
  }

  /**
   * Get all loaded policies
   */
  getAllLoadedPolicies(): LoadedPolicy[] {
    return Array.from(this.loadedPolicies.values());
  }

  /**
   * Clear loaded policies cache
   */
  clearCache(): void {
    this.loadedPolicies.clear();
    this.logger.info("Policy cache cleared");
  }

  /**
   * Atomic load multiple policies
   *
   * All-or-nothing: If any policy fails, all are rolled back.
   * Phase 2C: Uses I/O throttle (pLimit) to prevent CPU spikes.
   */
  async loadPoliciesBatch(
    filePaths: string[],
  ): Promise<{ success: boolean; loaded: LoadedPolicy[]; errors: string[] }> {
    this.logger.info("Loading policy batch with I/O throttle", {
      count: filePaths.length,
      maxConcurrent: 2,
    });

    const loaded: LoadedPolicy[] = [];
    const errors: string[] = [];

    // Try to load all policies with throttle (max 2 concurrent)
    const results = await Promise.all(
      filePaths.map((filePath) =>
        this.loadLimit(() => this.loadPolicy(filePath)),
      ),
    );

    // Process results
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const filePath = filePaths[i];

      if (result.success && result.policy) {
        loaded.push(result.policy);
      } else {
        errors.push(result.error || `Failed to load: ${filePath}`);
      }
    }

    // Check if all succeeded
    const allSucceeded = errors.length === 0;

    if (!allSucceeded) {
      // Rollback: Clear all loaded policies from this batch
      this.logger.warn("Policy batch load failed, rolling back", {
        errors,
      });

      for (const policy of loaded) {
        this.loadedPolicies.delete(policy.name);
      }

      return {
        success: false,
        loaded: [],
        errors,
      };
    }

    this.logger.info("Policy batch loaded successfully", {
      count: loaded.length,
    });

    return {
      success: true,
      loaded,
      errors: [],
    };
  }

  /**
   * Export version lock state (for persistence)
   */
  exportLocks(): PolicyVersionLock[] {
    return Array.from(this.versionLocks.values());
  }

  /**
   * Import version lock state (from persistence)
   */
  importLocks(locks: PolicyVersionLock[]): void {
    for (const lock of locks) {
      this.versionLocks.set(lock.name, lock);
    }

    this.logger.info("Policy locks imported", { count: locks.length });
  }

  /**
   * Save locks to file (persistence)
   */
  async saveLocks(filePath: string): Promise<void> {
    const locks = this.exportLocks();
    writeFileSync(filePath, JSON.stringify(locks, null, 2), "utf8");

    this.logger.info("Policy locks saved", { filePath, count: locks.length });
  }

  /**
   * Load locks from file (persistence)
   */
  async loadLocks(filePath: string): Promise<void> {
    if (!existsSync(filePath)) {
      this.logger.warn("Policy locks file not found", { filePath });
      return;
    }

    const content = readFileSync(filePath, "utf8");
    const locks: PolicyVersionLock[] = JSON.parse(content);

    this.importLocks(locks);
  }
}

/**
 * Create default policy loader
 */
export function createPolicyLoader(logger: Logger): PolicyLoader {
  return new PolicyLoader(logger);
}
