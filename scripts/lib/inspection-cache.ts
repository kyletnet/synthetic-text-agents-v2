/**
 * Inspection Cache Manager
 * Enforces 30-minute TTL and validates cache integrity
 *
 * Design:
 * - Single Source of Truth: reports/inspection-results.json
 * - TTL: 30 minutes (1800 seconds) - long enough for /inspect → /maintain → /fix workflow
 * - Strict validation before use
 */

import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  unlinkSync,
} from "fs";
import { join, dirname } from "path";
import type {
  InspectionResults,
  CacheValidation,
} from "./inspection-schema.js";

const CACHE_FILE = "reports/inspection-results.json";
const TTL_SECONDS = 1800; // 30 minutes (was 5 min, too short for slow /inspect)

export class InspectionCache {
  private cachePath: string;

  constructor(projectRoot: string = process.cwd()) {
    this.cachePath = join(projectRoot, CACHE_FILE);
  }

  /**
   * Validate cache and return results if valid
   * GPT Advice: "Respect TTL (30 min) for inspection cache"
   */
  validateCache(): CacheValidation {
    // 1. Check file existence
    if (!existsSync(this.cachePath)) {
      return { valid: false, reason: "missing" };
    }

    try {
      // 2. Parse JSON
      const content = readFileSync(this.cachePath, "utf8");
      const results = JSON.parse(content) as InspectionResults;

      // 3. Validate schema version
      if (results.schemaVersion !== "2025-10-inspect-v1") {
        return { valid: false, reason: "corrupted" };
      }

      // 4. Check TTL
      const now = Date.now();
      const inspectionTime = new Date(results.timestamp).getTime();
      const ageSeconds = Math.floor((now - inspectionTime) / 1000);

      if (ageSeconds > results.ttl) {
        return {
          valid: false,
          reason: "expired",
          ageSeconds,
        };
      }

      // 5. Valid!
      return {
        valid: true,
        ageSeconds,
        results,
      };
    } catch (error) {
      return { valid: false, reason: "corrupted" };
    }
  }

  /**
   * Save inspection results with timestamp and TTL
   */
  saveResults(results: Omit<InspectionResults, "timestamp" | "ttl">): void {
    const fullResults: InspectionResults = {
      ...results,
      timestamp: new Date().toISOString(),
      ttl: TTL_SECONDS,
    };

    // Ensure reports directory exists
    const dir = dirname(this.cachePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(this.cachePath, JSON.stringify(fullResults, null, 2), "utf8");
  }

  /**
   * Delete expired cache
   */
  clearCache(): void {
    if (existsSync(this.cachePath)) {
      unlinkSync(this.cachePath);
    }
  }

  /**
   * Get cache age in human-readable format
   */
  getCacheAge(): string | null {
    const validation = this.validateCache();
    if (!validation.ageSeconds) return null;

    const age = validation.ageSeconds;
    if (age < 60) return `${age}초 전`;
    if (age < 3600) return `${Math.floor(age / 60)}분 전`;
    return `${Math.floor(age / 3600)}시간 전`;
  }

  /**
   * Enforce workflow order: must run /inspect first
   * GPT Advice: "Never auto-trigger fallback inspection inside /fix"
   */
  enforceInspectFirst(commandName: string): void {
    const validation = this.validateCache();

    if (!validation.valid) {
      let message = `\n⚠️  ${commandName}를 실행하기 전에 /inspect를 먼저 실행하세요\n`;

      if (validation.reason === "missing") {
        message += `\n📋 진단 결과가 없습니다.\n`;
      } else if (validation.reason === "expired") {
        const age = validation.ageSeconds || 0;
        message += `\n⏰ 진단 결과가 오래되었습니다 (${Math.floor(age / 60)}분 전)\n`;
      } else {
        message += `\n❌ 진단 결과가 손상되었습니다.\n`;
      }

      message += `\n✅ 올바른 순서: npm run status → npm run ${commandName}\n`;

      console.error(message);
      process.exit(1);
    }
  }

  /**
   * Display cache status
   */
  displayCacheStatus(): void {
    const validation = this.validateCache();

    if (validation.valid && validation.results) {
      const age = this.getCacheAge();
      console.log(`\n📋 Inspection Results (${age})`);
      console.log(
        `   Health Score: ${validation.results.summary.healthScore}/100`,
      );
      console.log(
        `   Auto-fixable: ${validation.results.summary.autoFixableCount}개`,
      );
      console.log(
        `   Needs Approval: ${validation.results.summary.manualApprovalCount}개`,
      );
    } else {
      console.log(`\n⚠️  No valid inspection results`);
      console.log(`   Run: npm run status`);
    }
  }
}

/**
 * Global singleton instance
 */
export const inspectionCache = new InspectionCache();

/**
 * Helper: Check if cache is valid (for quick checks)
 */
export function hasValidInspectionCache(): boolean {
  return inspectionCache.validateCache().valid;
}

/**
 * Helper: Get cached results (throws if invalid)
 */
export function getCachedInspectionResults(): InspectionResults {
  const validation = inspectionCache.validateCache();
  if (!validation.valid || !validation.results) {
    throw new Error("No valid inspection cache");
  }
  return validation.results;
}
