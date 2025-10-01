/**
 * Loop Detector - Infinite loop detection
 *
 * Purpose:
 * - Detect infinite loops in system operations
 * - Distinguish intentional retries from runaway loops
 * - Profile loop behavior for analysis
 *
 * Design:
 * - Rate-based detection (iterations/second)
 * - Count-based detection (total iterations)
 * - Whitelist for intentional loops
 * - Loop profiling for forensics
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { InfiniteLoopError, type GovernanceRulesConfig } from "./governance-types.js";
import { NotificationSystem } from "./notification-system.js";

export interface LoopProfile {
  operationId: string;
  iterations: number;
  ratePerSecond: number;
  duration: number;
  timestamp: string;
  whitelisted: boolean;
}

export class LoopDetector {
  private projectRoot: string;
  private iterations = new Map<string, number>();
  private timestamps = new Map<string, number[]>();
  private notificationSystem: NotificationSystem;
  private rules: GovernanceRulesConfig | null = null;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.notificationSystem = new NotificationSystem(projectRoot);
  }

  /**
   * Check loop iteration (call this on each loop iteration)
   */
  checkpoint(operationId: string, maxIterations?: number): void {
    const rules = this.loadRules();
    const config = rules.loopDetection;

    // Increment iteration count
    const count = (this.iterations.get(operationId) || 0) + 1;
    this.iterations.set(operationId, count);

    // Record timestamp
    const now = Date.now();
    const times = this.timestamps.get(operationId) || [];
    times.push(now);
    this.timestamps.set(operationId, times);

    // Check if whitelisted
    if (config.whitelist.includes(operationId)) {
      return; // Intentional loop, allow
    }

    // 1. Count-based check
    const maxIter = maxIterations || config.maxIterations;
    if (count > maxIter) {
      const duration = (now - times[0]) / 1000;
      const error = new InfiniteLoopError(operationId, count, duration);

      // Notify
      this.notificationSystem.notifyInfiniteLoop({
        operationId,
        iterations: count,
        duration,
      });

      // Profile
      if (config.profileEnabled) {
        this.recordProfile({
          operationId,
          iterations: count,
          ratePerSecond: this.calculateRate(times, now),
          duration,
          timestamp: new Date().toISOString(),
          whitelisted: false,
        });
      }

      throw error;
    }

    // 2. Rate-based check (recent 1 second)
    const recentTimes = times.filter((t) => now - t < 1000);
    const ratePerSecond = recentTimes.length;

    if (ratePerSecond > config.maxRatePerSecond) {
      console.warn(`⚠️  Suspicious loop detected: ${operationId}`);
      console.warn(`   Rate: ${ratePerSecond} iterations/second`);
      console.warn(`   Total: ${count} iterations`);
      console.warn(`   Duration: ${((now - times[0]) / 1000).toFixed(1)}s`);

      // Profile suspicious loop
      if (config.profileEnabled) {
        this.recordProfile({
          operationId,
          iterations: count,
          ratePerSecond,
          duration: (now - times[0]) / 1000,
          timestamp: new Date().toISOString(),
          whitelisted: false,
        });
      }

      // Alert threshold check
      if (count > config.alertThreshold.iterations) {
        this.notificationSystem.notifyInfiniteLoop({
          operationId,
          iterations: count,
          duration: (now - times[0]) / 1000,
        });
      }
    }
  }

  /**
   * Reset loop detection for operation
   */
  reset(operationId: string): void {
    this.iterations.delete(operationId);
    this.timestamps.delete(operationId);
  }

  /**
   * Get current iteration count
   */
  getIterations(operationId: string): number {
    return this.iterations.get(operationId) || 0;
  }

  /**
   * Get current rate (iterations/second)
   */
  getRate(operationId: string): number {
    const times = this.timestamps.get(operationId);
    if (!times || times.length === 0) return 0;

    const now = Date.now();
    return this.calculateRate(times, now);
  }

  /**
   * Check if operation is whitelisted
   */
  isWhitelisted(operationId: string): boolean {
    const rules = this.loadRules();
    return rules.loopDetection.whitelist.includes(operationId);
  }

  /**
   * Add to whitelist (for intentional retry loops)
   */
  addToWhitelist(operationId: string): void {
    const rules = this.loadRules();
    if (!rules.loopDetection.whitelist.includes(operationId)) {
      rules.loopDetection.whitelist.push(operationId);
      this.saveRules(rules);
    }
  }

  /**
   * Calculate current rate
   */
  private calculateRate(times: number[], now: number): number {
    const recentTimes = times.filter((t) => now - t < 1000);
    return recentTimes.length;
  }

  /**
   * Record loop profile
   */
  private recordProfile(profile: LoopProfile): void {
    const rules = this.loadRules();
    const profilePath = join(this.projectRoot, rules.loopDetection.profilePath);

    // Ensure directory exists
    const dir = join(this.projectRoot, "reports");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Load existing profiles
    let profiles: LoopProfile[] = [];
    if (existsSync(profilePath)) {
      const content = readFileSync(profilePath, "utf8");
      profiles = JSON.parse(content) as LoopProfile[];
    }

    // Add new profile
    profiles.push(profile);

    // Keep last 100 profiles
    if (profiles.length > 100) {
      profiles = profiles.slice(-100);
    }

    // Save
    writeFileSync(profilePath, JSON.stringify(profiles, null, 2), "utf8");
  }

  /**
   * Load governance rules
   */
  private loadRules(): GovernanceRulesConfig {
    if (this.rules) return this.rules;

    const rulesPath = join(this.projectRoot, "governance-rules.json");
    if (!existsSync(rulesPath)) {
      throw new Error(
        `governance-rules.json not found at ${rulesPath}`,
      );
    }

    const content = readFileSync(rulesPath, "utf8");
    this.rules = JSON.parse(content) as GovernanceRulesConfig;
    return this.rules;
  }

  /**
   * Save governance rules
   */
  private saveRules(rules: GovernanceRulesConfig): void {
    const rulesPath = join(this.projectRoot, "governance-rules.json");
    writeFileSync(rulesPath, JSON.stringify(rules, null, 2), "utf8");
    this.rules = rules;
  }

  /**
   * Get loop statistics
   */
  getStatistics(): {
    activeLoops: number;
    totalIterations: number;
    highestRate: number;
  } {
    let totalIterations = 0;
    let highestRate = 0;

    for (const [operationId, count] of this.iterations.entries()) {
      totalIterations += count;
      const rate = this.getRate(operationId);
      if (rate > highestRate) {
        highestRate = rate;
      }
    }

    return {
      activeLoops: this.iterations.size,
      totalIterations,
      highestRate,
    };
  }

  /**
   * Display statistics
   */
  displayStatistics(): void {
    const stats = this.getStatistics();

    console.log("\n📊 Loop Detection Statistics:");
    console.log(`   Active loops: ${stats.activeLoops}`);
    console.log(`   Total iterations: ${stats.totalIterations}`);
    console.log(`   Highest rate: ${stats.highestRate}/sec\n`);
  }
}

/**
 * Global singleton instance
 */
let globalLoopDetector: LoopDetector | null = null;

export function getLoopDetector(projectRoot?: string): LoopDetector {
  if (!globalLoopDetector) {
    globalLoopDetector = new LoopDetector(projectRoot);
  }
  return globalLoopDetector;
}
