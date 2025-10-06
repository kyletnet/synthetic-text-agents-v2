/**
 * Quality Ledger - Append-only Quality History
 *
 * Purpose:
 * - Track all quality assessments over time
 * - Provide immutable audit trail
 * - Support trend analysis and regression detection
 * - Automatic rotation based on size/time
 *
 * Design Philosophy:
 * - Append-only (JSONL format)
 * - SHA256 integrity per entry
 * - Atomic writes with lock
 * - Daily rotation (configurable)
 */

import {
  existsSync,
  appendFileSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  statSync,
  renameSync,
} from "fs";
import { join, dirname } from "path";
import { createHash } from "crypto";

/**
 * Quality ledger entry (from governance schema)
 */
export interface QualityLedgerEntry {
  timestamp: string;
  phase: "Phase 0" | "Phase 1" | "Phase 2" | "Phase 3" | "Phase 4";
  metrics: {
    guideline_compliance: number | null;
    retrieval_quality_score: number | null;
    semantic_quality: number | null;
  };
  gate_result: "PASS" | "WARN" | "PARTIAL" | "FAIL";
  next_phase: string | null;
  session_id: string;
  config_version: string;
  hash?: string;
}

/**
 * Ledger append result
 */
export interface AppendResult {
  success: boolean;
  entryHash: string;
  ledgerPath: string;
  rotated: boolean;
  error?: string;
}

/**
 * Ledger rotation config (from governance-rules.json)
 */
interface RotationPolicy {
  maxSizeMB: number;
  retentionDays: number;
  autoRotate: boolean;
}

/**
 * Quality Ledger Manager
 */
export class QualityLedger {
  private projectRoot: string;
  private basePath: string;
  private lockPath: string;
  private rotationPolicy: RotationPolicy;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.basePath = join(projectRoot, "reports", "quality-history");
    this.lockPath = join(this.basePath, ".ledger.lock");

    // Load rotation policy from governance-rules.json
    this.rotationPolicy = this.loadRotationPolicy();

    // Ensure directory exists
    if (!existsSync(this.basePath)) {
      mkdirSync(this.basePath, { recursive: true });
    }
  }

  /**
   * Append entry to ledger (atomic operation)
   *
   * Algorithm:
   * 1. Acquire lock
   * 2. Calculate entry hash
   * 3. Check if rotation needed
   * 4. Append to current ledger
   * 5. Release lock
   */
  async append(entry: Omit<QualityLedgerEntry, "hash">): Promise<AppendResult> {
    // 1. Acquire lock
    if (!this.acquireLock()) {
      return {
        success: false,
        entryHash: "",
        ledgerPath: "",
        rotated: false,
        error: "Failed to acquire lock",
      };
    }

    try {
      // 2. Calculate entry hash
      const entryHash = this.calculateHash(entry);
      const fullEntry: QualityLedgerEntry = {
        ...entry,
        hash: entryHash,
      };

      // 3. Get current ledger path
      const ledgerPath = this.getCurrentLedgerPath();

      // 4. Check if rotation needed
      let rotated = false;
      if (this.rotationPolicy.autoRotate && this.needsRotation(ledgerPath)) {
        this.rotateLedger(ledgerPath);
        rotated = true;
      }

      // 5. Append to ledger (atomic)
      const ledgerLine = JSON.stringify(fullEntry) + "\n";
      appendFileSync(ledgerPath, ledgerLine, "utf8");

      return {
        success: true,
        entryHash,
        ledgerPath,
        rotated,
      };
    } catch (error) {
      return {
        success: false,
        entryHash: "",
        ledgerPath: "",
        rotated: false,
        error: String(error),
      };
    } finally {
      // 6. Always release lock
      this.releaseLock();
    }
  }

  /**
   * Calculate SHA256 hash for entry (excluding hash field)
   */
  private calculateHash(entry: Omit<QualityLedgerEntry, "hash">): string {
    // Canonical JSON (sorted keys)
    const canonical = JSON.stringify(entry, Object.keys(entry).sort());

    // SHA256
    return createHash("sha256").update(canonical, "utf8").digest("hex");
  }

  /**
   * Get current ledger file path (based on date)
   * Format: ledger-YYYY-MM-DD.jsonl
   */
  private getCurrentLedgerPath(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    const filename = `ledger-${year}-${month}-${day}.jsonl`;
    return join(this.basePath, filename);
  }

  /**
   * Check if ledger needs rotation
   */
  private needsRotation(ledgerPath: string): boolean {
    if (!existsSync(ledgerPath)) {
      return false;
    }

    try {
      const stats = statSync(ledgerPath);

      // Check size
      const sizeMB = stats.size / (1024 * 1024);
      if (sizeMB >= this.rotationPolicy.maxSizeMB) {
        return true;
      }

      // Check age
      const ageMs = Date.now() - stats.mtimeMs;
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      if (ageDays >= this.rotationPolicy.retentionDays) {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Rotate ledger file
   * Format: ledger-YYYY-MM-DD.jsonl → ledger-YYYY-MM-DD.001.jsonl
   */
  private rotateLedger(ledgerPath: string): void {
    let rotationIndex = 1;
    let rotatedPath = ledgerPath.replace(
      ".jsonl",
      `.${String(rotationIndex).padStart(3, "0")}.jsonl`,
    );

    // Find next available rotation index
    while (existsSync(rotatedPath)) {
      rotationIndex++;
      rotatedPath = ledgerPath.replace(
        ".jsonl",
        `.${String(rotationIndex).padStart(3, "0")}.jsonl`,
      );
    }

    // Rename current ledger
    renameSync(ledgerPath, rotatedPath);
  }

  /**
   * Load rotation policy from governance-rules.json
   */
  private loadRotationPolicy(): RotationPolicy {
    try {
      const rulesPath = join(this.projectRoot, "governance-rules.json");
      const rules = JSON.parse(readFileSync(rulesPath, "utf8"));

      const policy = rules.qualityLedger?.rotationPolicy;
      if (policy) {
        return {
          maxSizeMB: policy.maxSizeMB || 50,
          retentionDays: policy.retentionDays || 180,
          autoRotate: policy.autoRotate !== false,
        };
      }
    } catch {
      // Fallback to defaults
    }

    return {
      maxSizeMB: 50,
      retentionDays: 180,
      autoRotate: true,
    };
  }

  /**
   * Acquire exclusive lock
   */
  private acquireLock(): boolean {
    const maxRetries = 50; // 5 seconds (100ms * 50)
    let retries = 0;

    while (retries < maxRetries) {
      try {
        // Atomic lock creation
        writeFileSync(this.lockPath, Date.now().toString(), { flag: "wx" });
        return true;
      } catch {
        // Lock exists, check if stale
        try {
          const lockContent = readFileSync(this.lockPath, "utf8");
          const lockTime = parseInt(lockContent, 10);
          const ageMs = Date.now() - lockTime;

          // Remove stale locks (>5 minutes)
          if (ageMs > 5 * 60 * 1000) {
            try {
              // Remove stale lock
              const { unlinkSync } = require("fs");
              unlinkSync(this.lockPath);
              continue;
            } catch {
              // Another process removed it
            }
          }
        } catch {
          // Lock file corrupted, retry
        }

        // Wait 100ms
        retries++;
        const deadline = Date.now() + 100;
        while (Date.now() < deadline) {
          // Busy wait
        }
      }
    }

    return false;
  }

  /**
   * Release lock
   */
  private releaseLock(): void {
    try {
      const { unlinkSync } = require("fs");
      if (existsSync(this.lockPath)) {
        unlinkSync(this.lockPath);
      }
    } catch {
      // Ignore errors
    }
  }

  /**
   * Read ledger entries (for analysis)
   */
  readLedger(date?: Date): QualityLedgerEntry[] {
    const ledgerPath = date
      ? this.getLedgerPathForDate(date)
      : this.getCurrentLedgerPath();

    if (!existsSync(ledgerPath)) {
      return [];
    }

    try {
      const content = readFileSync(ledgerPath, "utf8");
      const lines = content.trim().split("\n").filter(Boolean);

      return lines.map((line) => JSON.parse(line) as QualityLedgerEntry);
    } catch {
      return [];
    }
  }

  /**
   * Get ledger path for specific date
   */
  private getLedgerPathForDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    const filename = `ledger-${year}-${month}-${day}.jsonl`;
    return join(this.basePath, filename);
  }

  /**
   * Get ledger statistics
   */
  getStats(): {
    totalEntries: number;
    totalFiles: number;
    oldestEntry: string | null;
    newestEntry: string | null;
  } {
    const { readdirSync } = require("fs");

    try {
      const files = readdirSync(this.basePath).filter((f: string) =>
        f.endsWith(".jsonl"),
      );

      let totalEntries = 0;
      let oldestEntry: string | null = null;
      let newestEntry: string | null = null;

      for (const file of files) {
        const filePath = join(this.basePath, file);
        const content = readFileSync(filePath, "utf8");
        const lines = content.trim().split("\n").filter(Boolean);

        totalEntries += lines.length;

        if (lines.length > 0) {
          const firstEntry = JSON.parse(lines[0]) as QualityLedgerEntry;
          const lastEntry = JSON.parse(
            lines[lines.length - 1],
          ) as QualityLedgerEntry;

          if (!oldestEntry || firstEntry.timestamp < oldestEntry) {
            oldestEntry = firstEntry.timestamp;
          }

          if (!newestEntry || lastEntry.timestamp > newestEntry) {
            newestEntry = lastEntry.timestamp;
          }
        }
      }

      return {
        totalEntries,
        totalFiles: files.length,
        oldestEntry,
        newestEntry,
      };
    } catch {
      return {
        totalEntries: 0,
        totalFiles: 0,
        oldestEntry: null,
        newestEntry: null,
      };
    }
  }
}

/**
 * Global singleton
 */
let globalLedger: QualityLedger | null = null;

export function getQualityLedger(projectRoot?: string): QualityLedger {
  if (!globalLedger) {
    globalLedger = new QualityLedger(projectRoot);
  }
  return globalLedger;
}
