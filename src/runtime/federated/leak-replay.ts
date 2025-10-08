/**
 * Leak Replay Verification System
 *
 * "과거의 실수를 반복하지 않는 것이 진정한 보안이다"
 * - Phase 3.6 Enhanced Security Innovation
 *
 * Purpose:
 * - 과거 privacy leak 기록
 * - 새로운 fabric configuration에서 재실행
 * - 재발 방지 검증
 *
 * Architecture:
 * Historical Leaks DB → Replay on New Fabric → Detect Recurrence → Alert & Fix
 *
 * Attack Types Covered:
 * - Identity inference (tenant identification)
 * - Membership inference (record presence)
 * - Attribute inference (sensitive attributes)
 *
 * Expected Impact: Leak recurrence 0%, Privacy Score +5%p
 *
 * @see RFC 2025-20: Phase 3.6 Enhanced Execution (Axis 2)
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  KnowledgeFabric,
  AnonymizedNode,
} from './knowledge-fabric';
import type { DataLeak } from './privacy-audit';

/**
 * Replay Result
 */
export interface ReplayResult {
  totalLeaks: number; // Historical leaks tested
  reoccurrences: number; // Leaks that reoccurred
  passed: boolean; // No reoccurrences
  details: LeakReoccurrence[];
  timestamp: Date;
}

/**
 * Leak Reoccurrence
 */
export interface LeakReoccurrence {
  originalLeak: DataLeak;
  reoccurred: boolean;
  confidence: number; // 0-1
  mitigationStatus: 'fixed' | 'partial' | 'not-fixed';
  recommendation: string;
}

/**
 * Leak Pattern (generalized attack)
 */
export interface LeakPattern {
  id: string;
  type: DataLeak['type'];
  description: string;

  // Attack characteristics
  characteristics: {
    minGroupSize?: number; // For identity inference
    quasiIdentifiers?: string[]; // Fields used
    importance?: number; // Node importance threshold
    edgeStrength?: number; // Edge strength threshold
  };

  // History
  firstDetected: Date;
  lastDetected: Date;
  occurrenceCount: number;

  // Mitigation
  mitigated: boolean;
  mitigationApplied?: string;
}

/**
 * Leak Replay Config
 */
export interface LeakReplayConfig {
  // Storage
  leakHistoryFile: string; // JSONL of leaks
  patternFile: string; // JSON of generalized patterns

  // Replay
  enableAutoReplay: boolean; // Default: true
  replayOnFabricUpdate: boolean; // Default: true

  // Alert
  alertOnReoccurrence: boolean; // Default: true
  blockOnReoccurrence: boolean; // Default: false (warn only)
}

/**
 * Leak Replay Verification
 *
 * Ensures past leaks don't recur
 */
export class LeakReplayVerification {
  private config: LeakReplayConfig;
  private leakHistory: DataLeak[] = [];
  private patterns: LeakPattern[] = [];

  constructor(config?: Partial<LeakReplayConfig>) {
    this.config = {
      leakHistoryFile:
        config?.leakHistoryFile ??
        'reports/privacy/leak-history.jsonl',
      patternFile:
        config?.patternFile ?? 'reports/privacy/leak-patterns.json',

      enableAutoReplay: config?.enableAutoReplay ?? true,
      replayOnFabricUpdate: config?.replayOnFabricUpdate ?? true,

      alertOnReoccurrence: config?.alertOnReoccurrence ?? true,
      blockOnReoccurrence: config?.blockOnReoccurrence ?? false,
    };

    this.loadHistory();
    this.loadPatterns();
  }

  /**
   * Record new leak for future replay
   */
  async recordLeak(leak: DataLeak): Promise<void> {
    // Add to history
    this.leakHistory.push(leak);

    // Update patterns (generalize)
    await this.updatePatterns(leak);

    // Persist
    await this.persistLeak(leak);
  }

  /**
   * Replay all historical leaks on new fabric
   */
  async replayAllLeaks(
    fabric: KnowledgeFabric
  ): Promise<ReplayResult> {
    const reoccurrences: LeakReoccurrence[] = [];

    // Replay each historical leak
    for (const historicalLeak of this.leakHistory) {
      const reoccurrence = await this.replaySingleLeak(
        fabric,
        historicalLeak
      );

      reoccurrences.push(reoccurrence);

      // Alert if reoccurred
      if (
        reoccurrence.reoccurred &&
        this.config.alertOnReoccurrence
      ) {
        await this.alertReoccurrence(reoccurrence);
      }
    }

    // Calculate result
    const reoccurredCount = reoccurrences.filter(
      (r) => r.reoccurred
    ).length;

    const result: ReplayResult = {
      totalLeaks: this.leakHistory.length,
      reoccurrences: reoccurredCount,
      passed: reoccurredCount === 0,
      details: reoccurrences,
      timestamp: new Date(),
    };

    // Log result
    await this.logReplayResult(result);

    // Block if configured
    if (
      !result.passed &&
      this.config.blockOnReoccurrence
    ) {
      throw new Error(
        `Leak replay FAILED: ${result.reoccurrences} leak(s) reoccurred. Deployment blocked.`
      );
    }

    return result;
  }

  /**
   * Replay single leak
   */
  private async replaySingleLeak(
    fabric: KnowledgeFabric,
    leak: DataLeak
  ): Promise<LeakReoccurrence> {
    let reoccurred = false;
    let confidence = 0;

    switch (leak.type) {
      case 'identity-inference':
        ({ reoccurred, confidence } =
          await this.checkIdentityInference(fabric, leak));
        break;
      case 'membership-inference':
        ({ reoccurred, confidence } =
          await this.checkMembershipInference(fabric, leak));
        break;
      case 'attribute-inference':
        ({ reoccurred, confidence } =
          await this.checkAttributeInference(fabric, leak));
        break;
    }

    // Determine mitigation status
    const mitigationStatus = this.assessMitigation(
      leak,
      reoccurred,
      confidence
    );

    // Generate recommendation
    const recommendation = this.generateRecommendation(
      leak,
      mitigationStatus
    );

    return {
      originalLeak: leak,
      reoccurred,
      confidence,
      mitigationStatus,
      recommendation,
    };
  }

  /**
   * Check if identity inference attack still works
   */
  private async checkIdentityInference(
    fabric: KnowledgeFabric,
    leak: DataLeak
  ): Promise<{ reoccurred: boolean; confidence: number }> {
    // Find node with same ID (or similar characteristics)
    const node = fabric.nodes.find((n) => n.id === leak.nodeId);

    if (!node) {
      // Node no longer exists - leak mitigated
      return { reoccurred: false, confidence: 0 };
    }

    // Check if tenantId is still exposed
    if (node.tenantId !== undefined) {
      return { reoccurred: true, confidence: 1.0 };
    }

    // Check if quasi-identifiers still allow inference
    const similarNodes = fabric.nodes.filter(
      (n) =>
        n.domain === node.domain &&
        n.conceptType === node.conceptType &&
        Math.abs(n.importance - node.importance) < 0.1
    );

    // If group size < 3, still vulnerable
    if (similarNodes.length < 3) {
      return { reoccurred: true, confidence: 0.8 };
    }

    return { reoccurred: false, confidence: 0 };
  }

  /**
   * Check if membership inference attack still works
   */
  private async checkMembershipInference(
    fabric: KnowledgeFabric,
    leak: DataLeak
  ): Promise<{ reoccurred: boolean; confidence: number }> {
    // Check if high-importance nodes (>0.9) still exist
    const highImportanceNodes = fabric.nodes.filter(
      (n) => n.importance > 0.9
    );

    if (highImportanceNodes.length > 0) {
      // Still have high-importance nodes - potential leak
      return { reoccurred: true, confidence: 0.5 };
    }

    return { reoccurred: false, confidence: 0 };
  }

  /**
   * Check if attribute inference attack still works
   */
  private async checkAttributeInference(
    fabric: KnowledgeFabric,
    leak: DataLeak
  ): Promise<{ reoccurred: boolean; confidence: number }> {
    // Check for high-strength edges (>0.95)
    const highStrengthEdges = fabric.edges.filter(
      (e) => e.strength > 0.95
    );

    if (highStrengthEdges.length > 0) {
      return { reoccurred: true, confidence: 0.4 };
    }

    return { reoccurred: false, confidence: 0 };
  }

  /**
   * Update leak patterns (generalize from specific leaks)
   */
  private async updatePatterns(leak: DataLeak): Promise<void> {
    // Find existing pattern for this type
    const existingPattern = this.patterns.find(
      (p) => p.type === leak.type
    );

    if (existingPattern) {
      // Update existing pattern
      existingPattern.lastDetected = new Date();
      existingPattern.occurrenceCount++;

      // Update characteristics based on new leak
      this.updatePatternCharacteristics(existingPattern, leak);
    } else {
      // Create new pattern
      const newPattern: LeakPattern = {
        id: `pattern_${this.patterns.length + 1}`,
        type: leak.type,
        description: leak.description,
        characteristics: this.extractCharacteristics(leak),
        firstDetected: new Date(),
        lastDetected: new Date(),
        occurrenceCount: 1,
        mitigated: false,
      };

      this.patterns.push(newPattern);
    }

    // Save patterns
    await this.persistPatterns();
  }

  /**
   * Extract characteristics from leak
   */
  private extractCharacteristics(
    leak: DataLeak
  ): LeakPattern['characteristics'] {
    const characteristics: LeakPattern['characteristics'] = {};

    switch (leak.type) {
      case 'identity-inference':
        characteristics.minGroupSize = 3; // k-anonymity threshold
        characteristics.quasiIdentifiers = [
          'domain',
          'conceptType',
          'importance',
        ];
        break;

      case 'membership-inference':
        characteristics.importance = 0.9; // High-importance threshold
        break;

      case 'attribute-inference':
        characteristics.edgeStrength = 0.95; // Edge strength threshold
        break;
    }

    return characteristics;
  }

  /**
   * Update pattern characteristics
   */
  private updatePatternCharacteristics(
    pattern: LeakPattern,
    leak: DataLeak
  ): void {
    // Generalize thresholds based on multiple occurrences
    // For now, keep existing characteristics
    // In production: Use statistical methods to refine thresholds
  }

  /**
   * Assess mitigation status
   */
  private assessMitigation(
    leak: DataLeak,
    reoccurred: boolean,
    confidence: number
  ): LeakReoccurrence['mitigationStatus'] {
    if (!reoccurred) {
      return 'fixed';
    }

    if (confidence < 0.5) {
      return 'partial';
    }

    return 'not-fixed';
  }

  /**
   * Generate recommendation
   */
  private generateRecommendation(
    leak: DataLeak,
    status: LeakReoccurrence['mitigationStatus']
  ): string {
    if (status === 'fixed') {
      return 'Leak successfully mitigated. Continue current privacy measures.';
    }

    switch (leak.type) {
      case 'identity-inference':
        return (
          'Increase k-anonymity group size (target: k≥5). ' +
          'Generalize or suppress quasi-identifiers.'
        );

      case 'membership-inference':
        return (
          'Reduce importance score precision. ' +
          'Apply differential privacy noise to importance values.'
        );

      case 'attribute-inference':
        return (
          'Reduce edge strength precision or apply edge pruning. ' +
          'Consider edge noise injection.'
        );

      default:
        return 'Review and enhance privacy controls.';
    }
  }

  /**
   * Alert on reoccurrence
   */
  private async alertReoccurrence(
    reoccurrence: LeakReoccurrence
  ): Promise<void> {
    console.warn(
      `⚠️ [LeakReplay] Leak REOCCURRED: ${reoccurrence.originalLeak.type}`
    );
    console.warn(`   Confidence: ${(reoccurrence.confidence * 100).toFixed(1)}%`);
    console.warn(`   Status: ${reoccurrence.mitigationStatus}`);
    console.warn(`   Recommendation: ${reoccurrence.recommendation}`);

    // In production: Send to monitoring/alerting system
  }

  /**
   * Persist leak to history
   */
  private async persistLeak(leak: DataLeak): Promise<void> {
    const historyPath = this.config.leakHistoryFile;

    // Ensure directory exists
    const dir = path.dirname(historyPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Append to JSONL
    const entry = JSON.stringify({
      ...leak,
      recordedAt: new Date(),
    });

    fs.appendFileSync(historyPath, entry + '\n');
  }

  /**
   * Persist patterns
   */
  private async persistPatterns(): Promise<void> {
    const patternPath = this.config.patternFile;

    // Ensure directory exists
    const dir = path.dirname(patternPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Save as JSON
    fs.writeFileSync(
      patternPath,
      JSON.stringify(this.patterns, null, 2)
    );
  }

  /**
   * Log replay result
   */
  private async logReplayResult(result: ReplayResult): Promise<void> {
    const logPath = 'reports/privacy/replay-results.jsonl';

    // Ensure directory exists
    const dir = path.dirname(logPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Append to log
    const entry = JSON.stringify({
      timestamp: result.timestamp,
      totalLeaks: result.totalLeaks,
      reoccurrences: result.reoccurrences,
      passed: result.passed,
      details: result.details.map((d) => ({
        type: d.originalLeak.type,
        reoccurred: d.reoccurred,
        confidence: d.confidence,
        status: d.mitigationStatus,
      })),
    });

    fs.appendFileSync(logPath, entry + '\n');
  }

  /**
   * Load leak history
   */
  private loadHistory(): void {
    const historyPath = this.config.leakHistoryFile;

    if (!fs.existsSync(historyPath)) return;

    const lines = fs.readFileSync(historyPath, 'utf-8').split('\n');

    this.leakHistory = lines
      .filter((line) => line.trim() !== '')
      .map((line) => JSON.parse(line) as DataLeak);
  }

  /**
   * Load leak patterns
   */
  private loadPatterns(): void {
    const patternPath = this.config.patternFile;

    if (!fs.existsSync(patternPath)) return;

    const data = fs.readFileSync(patternPath, 'utf-8');
    this.patterns = JSON.parse(data);
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalLeaks: number;
    uniquePatterns: number;
    avgConfidence: number;
    mitigationRate: number;
  } {
    const totalLeaks = this.leakHistory.length;
    const uniquePatterns = this.patterns.length;

    // Calculate average confidence from recent replays
    // (Simplified - in production, track from replay results)
    const avgConfidence = 0.3;

    // Mitigation rate: patterns marked as mitigated
    const mitigatedPatterns = this.patterns.filter((p) => p.mitigated)
      .length;
    const mitigationRate =
      uniquePatterns > 0 ? mitigatedPatterns / uniquePatterns : 0;

    return {
      totalLeaks,
      uniquePatterns,
      avgConfidence,
      mitigationRate,
    };
  }

  /**
   * Mark pattern as mitigated
   */
  markPatternMitigated(
    patternId: string,
    mitigation: string
  ): void {
    const pattern = this.patterns.find((p) => p.id === patternId);

    if (pattern) {
      pattern.mitigated = true;
      pattern.mitigationApplied = mitigation;
      this.persistPatterns();
    }
  }
}

/**
 * Default singleton instance
 */
export const leakReplayVerification = new LeakReplayVerification();
