/**
 * Guideline Version Manager - Content-based versioning
 *
 * Purpose:
 * - Track guideline changes with SHA256 hash
 * - Detect when guidelines are updated
 * - Invalidate cache when guidelines change
 * - Provide version history for audit
 *
 * Design Philosophy:
 * - Content-based versioning (not timestamp)
 * - Hash of all guideline files combined
 * - Automatic cache invalidation on change
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import { glob } from "glob";

/**
 * Guideline version info
 */
export interface GuidelineVersion {
  hash: string;
  timestamp: string;
  files: {
    path: string;
    hash: string;
    size: number;
  }[];
  totalFiles: number;
  combinedHash: string;
}

/**
 * Version history entry
 */
export interface VersionHistoryEntry {
  version: string;
  timestamp: string;
  hash: string;
  changedFiles: string[];
}

/**
 * Guideline Version Manager
 */
export class GuidelineVersionManager {
  private projectRoot: string;
  private guidelinePath: string;
  private versionCachePath: string;
  private historyPath: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.guidelinePath = join(projectRoot, "docs", "guidelines");
    this.versionCachePath = join(
      projectRoot,
      "reports",
      "guideline-version.json",
    );
    this.historyPath = join(
      projectRoot,
      "reports",
      "guideline-version-history.jsonl",
    );
  }

  /**
   * Get current guideline version
   *
   * Algorithm:
   * 1. Find all guideline files
   * 2. Hash each file individually
   * 3. Combine all hashes
   * 4. Generate version hash
   */
  getCurrentVersion(): GuidelineVersion {
    // 1. Find all guideline files
    const files = glob.sync("**/*.md", { cwd: this.guidelinePath });

    // 2. Hash each file
    const fileHashes = files.map((file) => {
      const fullPath = join(this.guidelinePath, file);
      const content = readFileSync(fullPath, "utf8");
      const hash = createHash("sha256").update(content, "utf8").digest("hex");
      const stats = require("fs").statSync(fullPath);

      return {
        path: file,
        hash,
        size: stats.size,
      };
    });

    // 3. Combine all hashes (sorted for consistency)
    const sortedHashes = fileHashes
      .map((f) => f.hash)
      .sort()
      .join("");

    // 4. Generate combined hash
    const combinedHash = createHash("sha256")
      .update(sortedHashes, "utf8")
      .digest("hex");

    return {
      hash: combinedHash.substring(0, 12), // Short version
      timestamp: new Date().toISOString(),
      files: fileHashes,
      totalFiles: files.length,
      combinedHash,
    };
  }

  /**
   * Check if guidelines have changed since last check
   */
  hasChanged(): boolean {
    const current = this.getCurrentVersion();
    const cached = this.getCachedVersion();

    if (!cached) {
      return true; // No cache, consider changed
    }

    return current.hash !== cached.hash;
  }

  /**
   * Get cached version
   */
  getCachedVersion(): GuidelineVersion | null {
    if (!existsSync(this.versionCachePath)) {
      return null;
    }

    try {
      return JSON.parse(readFileSync(this.versionCachePath, "utf8"));
    } catch {
      return null;
    }
  }

  /**
   * Update cached version
   */
  updateCache(): GuidelineVersion {
    const current = this.getCurrentVersion();

    // Ensure directory exists
    const dir = require("path").dirname(this.versionCachePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Save to cache
    writeFileSync(
      this.versionCachePath,
      JSON.stringify(current, null, 2),
      "utf8",
    );

    // Add to history
    this.addToHistory(current);

    return current;
  }

  /**
   * Add version to history
   */
  private addToHistory(version: GuidelineVersion): void {
    const cached = this.getCachedVersion();

    // Determine changed files
    const changedFiles: string[] = [];
    if (cached) {
      const cachedFileMap = new Map(cached.files.map((f) => [f.path, f.hash]));

      for (const file of version.files) {
        const cachedHash = cachedFileMap.get(file.path);
        if (!cachedHash || cachedHash !== file.hash) {
          changedFiles.push(file.path);
        }
      }
    } else {
      // No cache, all files are "new"
      changedFiles.push(...version.files.map((f) => f.path));
    }

    const historyEntry: VersionHistoryEntry = {
      version: version.hash,
      timestamp: version.timestamp,
      hash: version.combinedHash,
      changedFiles,
    };

    // Ensure directory exists
    const dir = require("path").dirname(this.historyPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Append to history (JSONL)
    const { appendFileSync } = require("fs");
    appendFileSync(
      this.historyPath,
      JSON.stringify(historyEntry) + "\n",
      "utf8",
    );
  }

  /**
   * Get version history
   */
  getHistory(limit: number = 10): VersionHistoryEntry[] {
    if (!existsSync(this.historyPath)) {
      return [];
    }

    try {
      const content = readFileSync(this.historyPath, "utf8");
      const lines = content.trim().split("\n").filter(Boolean);

      // Get last N entries
      const entries = lines
        .slice(-limit)
        .map((line) => JSON.parse(line) as VersionHistoryEntry);

      return entries.reverse(); // Most recent first
    } catch {
      return [];
    }
  }

  /**
   * Invalidate quality cache if guidelines changed
   */
  invalidateCacheIfNeeded(): boolean {
    if (this.hasChanged()) {
      const current = this.updateCache();

      console.log(`\n📝 Guideline version updated: ${current.hash}`);
      console.log(`   Changed files: ${current.files.length}`);

      // Invalidate quality cache (if exists)
      const qualityCachePath = join(
        this.projectRoot,
        "reports",
        "quality-cache.json",
      );

      if (existsSync(qualityCachePath)) {
        const { unlinkSync } = require("fs");
        unlinkSync(qualityCachePath);
        console.log("   ✅ Quality cache invalidated");
      }

      return true;
    }

    return false;
  }

  /**
   * Get version comparison
   */
  compareVersions(
    v1Hash: string,
    v2Hash: string,
  ): {
    same: boolean;
    addedFiles: string[];
    removedFiles: string[];
    modifiedFiles: string[];
  } {
    const history = this.getHistory(100);

    const v1Entry = history.find((h) => h.version === v1Hash);
    const v2Entry = history.find((h) => h.version === v2Hash);

    if (!v1Entry || !v2Entry) {
      return {
        same: false,
        addedFiles: [],
        removedFiles: [],
        modifiedFiles: [],
      };
    }

    // Simple comparison based on changed files
    // (Full implementation would need file-level diff)
    return {
      same: v1Entry.hash === v2Entry.hash,
      addedFiles: [],
      removedFiles: [],
      modifiedFiles: v2Entry.changedFiles,
    };
  }

  /**
   * Display version info
   */
  displayVersion(): void {
    const current = this.getCurrentVersion();
    const cached = this.getCachedVersion();

    console.log("\n📚 Guideline Version Info");
    console.log("═".repeat(60));
    console.log(`Current Version: ${current.hash}`);
    console.log(`Total Files: ${current.totalFiles}`);

    if (cached && cached.hash !== current.hash) {
      console.log(`\n⚠️  Version changed from: ${cached.hash}`);
      console.log("   Quality cache should be refreshed");
    } else if (cached) {
      console.log("\n✅ Version unchanged");
    } else {
      console.log("\n🆕 First version check");
    }

    console.log("\n📋 Files:");
    for (const file of current.files.slice(0, 10)) {
      console.log(`   • ${file.path} (${file.hash.substring(0, 8)}...)`);
    }

    if (current.files.length > 10) {
      console.log(`   ... and ${current.files.length - 10} more files`);
    }
  }
}

/**
 * Global singleton
 */
let globalManager: GuidelineVersionManager | null = null;

export function getGuidelineVersionManager(
  projectRoot?: string,
): GuidelineVersionManager {
  if (!globalManager) {
    globalManager = new GuidelineVersionManager(projectRoot);
  }
  return globalManager;
}

/**
 * Quick check: has guideline changed?
 */
export function hasGuidelineChanged(projectRoot?: string): boolean {
  const manager = getGuidelineVersionManager(projectRoot);
  return manager.hasChanged();
}

/**
 * Auto-invalidate cache on guideline change
 */
export function autoInvalidateOnGuidelineChange(projectRoot?: string): boolean {
  const manager = getGuidelineVersionManager(projectRoot);
  return manager.invalidateCacheIfNeeded();
}
