/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Phase State Machine - Quality Phase Orchestration
 *
 * Purpose:
 * - Manage quality assessment phases (0-4)
 * - Enforce phase transitions based on gate results
 * - Track phase history
 * - Integrate with Quality Ledger
 *
 * Design Philosophy:
 * - Strict state machine (no skipping phases)
 * - Gate-based transitions (PASS/WARN/PARTIAL/FAIL)
 * - Audit trail (all transitions logged)
 */

import { getQualityLedger, QualityLedgerEntry } from "./quality-ledger.js";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
} from "fs";
import { join, dirname } from "path";

/**
 * Quality phase definition
 */
export type QualityPhase =
  | "Phase 0"
  | "Phase 1"
  | "Phase 2"
  | "Phase 3"
  | "Phase 4";

/**
 * Gate result
 */
export type GateResult = "PASS" | "WARN" | "PARTIAL" | "FAIL";

/**
 * Phase state
 */
export interface PhaseState {
  currentPhase: QualityPhase;
  timestamp: string;
  sessionId: string;
  metrics: {
    guideline_compliance: number | null;
    retrieval_quality_score: number | null;
    semantic_quality: number | null;
  };
  gateResult: GateResult;
  nextPhase: string | null;
}

/**
 * Transition result
 */
export interface TransitionResult {
  success: boolean;
  from: QualityPhase;
  to: QualityPhase | null;
  reason: string;
  gateResult: GateResult;
  ledgerHash?: string;
}

/**
 * Phase State Machine
 */
export class PhaseStateMachine {
  private projectRoot: string;
  private statePath: string;
  private ledger = getQualityLedger();

  // Phase transition rules
  private readonly transitions: Record<
    QualityPhase,
    Record<GateResult, QualityPhase | null>
  > = {
    "Phase 0": {
      PASS: "Phase 1",
      WARN: "Phase 1",
      PARTIAL: "Phase 0", // Retry
      FAIL: null, // Block
    },
    "Phase 1": {
      PASS: "Phase 2",
      WARN: "Phase 2",
      PARTIAL: "Phase 1",
      FAIL: "Phase 0", // Rollback
    },
    "Phase 2": {
      PASS: "Phase 3",
      WARN: "Phase 3",
      PARTIAL: "Phase 2",
      FAIL: "Phase 1",
    },
    "Phase 3": {
      PASS: "Phase 4",
      WARN: "Phase 4",
      PARTIAL: "Phase 3",
      FAIL: "Phase 2",
    },
    "Phase 4": {
      PASS: null, // Complete
      WARN: null, // Complete
      PARTIAL: "Phase 4",
      FAIL: "Phase 3",
    },
  };

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.statePath = join(projectRoot, "reports", "phase-state.json");
  }

  /**
   * Get current phase state
   */
  getCurrentState(): PhaseState | null {
    if (!existsSync(this.statePath)) {
      return null;
    }

    try {
      return JSON.parse(readFileSync(this.statePath, "utf8"));
    } catch {
      return null;
    }
  }

  /**
   * Initialize new session
   */
  initialize(sessionId: string): PhaseState {
    const state: PhaseState = {
      currentPhase: "Phase 0",
      timestamp: new Date().toISOString(),
      sessionId,
      metrics: {
        guideline_compliance: null,
        retrieval_quality_score: null,
        semantic_quality: null,
      },
      gateResult: "PARTIAL",
      nextPhase: null,
    };

    this.saveState(state);
    return state;
  }

  /**
   * Attempt phase transition
   *
   * Algorithm:
   * 1. Validate current state
   * 2. Check gate result
   * 3. Determine next phase
   * 4. Append to ledger
   * 5. Update state
   */
  async transition(
    gateResult: GateResult,
    metrics: {
      guideline_compliance: number | null;
      retrieval_quality_score: number | null;
      semantic_quality: number | null;
    },
    configVersion: string = "v1.0",
  ): Promise<TransitionResult> {
    // 1. Get current state
    let state = this.getCurrentState();
    if (!state) {
      state = this.initialize(`session-${Date.now()}`);
    }

    const currentPhase = state.currentPhase;

    // 2. Determine next phase
    const nextPhase = this.transitions[currentPhase][gateResult];

    // 3. Create ledger entry
    const ledgerEntry: Omit<QualityLedgerEntry, "hash"> = {
      timestamp: new Date().toISOString(),
      phase: currentPhase,
      metrics,
      gate_result: gateResult,
      next_phase: nextPhase,
      session_id: state.sessionId,
      config_version: configVersion,
    };

    // 4. Append to ledger
    const ledgerResult = await this.ledger.append(ledgerEntry);

    if (!ledgerResult.success) {
      return {
        success: false,
        from: currentPhase,
        to: null,
        reason: `Failed to append to ledger: ${ledgerResult.error}`,
        gateResult,
      };
    }

    // 5. Update state
    const newState: PhaseState = {
      currentPhase: nextPhase || currentPhase,
      timestamp: new Date().toISOString(),
      sessionId: state.sessionId,
      metrics,
      gateResult,
      nextPhase: nextPhase,
    };

    this.saveState(newState);

    // 6. Build result
    const reason = this.getTransitionReason(
      currentPhase,
      nextPhase,
      gateResult,
    );

    return {
      success: true,
      from: currentPhase,
      to: nextPhase,
      reason,
      gateResult,
      ledgerHash: ledgerResult.entryHash,
    };
  }

  /**
   * Get transition reason (human-readable)
   */
  private getTransitionReason(
    from: QualityPhase,
    to: QualityPhase | null,
    gateResult: GateResult,
  ): string {
    if (to === null) {
      if (gateResult === "FAIL") {
        return `Blocked at ${from} due to gate failure`;
      }
      return `Completed at ${from}`;
    }

    if (to === from) {
      return `Retry ${from} (${gateResult})`;
    }

    const direction =
      this.getPhaseNumber(to) > this.getPhaseNumber(from)
        ? "Advanced"
        : "Rolled back";

    return `${direction} from ${from} to ${to} (${gateResult})`;
  }

  /**
   * Get phase number (for comparison)
   */
  private getPhaseNumber(phase: QualityPhase): number {
    return parseInt(phase.replace("Phase ", ""), 10);
  }

  /**
   * Save state to disk
   */
  private saveState(state: PhaseState): void {
    const dir = dirname(this.statePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(this.statePath, JSON.stringify(state, null, 2), "utf8");
  }

  /**
   * Get phase statistics from ledger
   */
  async getPhaseStats(): Promise<{
    totalTransitions: number;
    byPhase: Record<QualityPhase, number>;
    byResult: Record<GateResult, number>;
    averageMetrics: {
      guideline_compliance: number;
      retrieval_quality_score: number;
      semantic_quality: number;
    };
  }> {
    const entries = this.ledger.readLedger();

    const byPhase: Record<QualityPhase, number> = {
      "Phase 0": 0,
      "Phase 1": 0,
      "Phase 2": 0,
      "Phase 3": 0,
      "Phase 4": 0,
    };

    const byResult: Record<GateResult, number> = {
      PASS: 0,
      WARN: 0,
      PARTIAL: 0,
      FAIL: 0,
    };

    let totalGuideline = 0;
    let totalRetrieval = 0;
    let totalSemantic = 0;
    let countGuideline = 0;
    let countRetrieval = 0;
    let countSemantic = 0;

    for (const entry of entries) {
      byPhase[entry.phase]++;
      byResult[entry.gate_result]++;

      if (entry.metrics.guideline_compliance !== null) {
        totalGuideline += entry.metrics.guideline_compliance;
        countGuideline++;
      }

      if (entry.metrics.retrieval_quality_score !== null) {
        totalRetrieval += entry.metrics.retrieval_quality_score;
        countRetrieval++;
      }

      if (entry.metrics.semantic_quality !== null) {
        totalSemantic += entry.metrics.semantic_quality;
        countSemantic++;
      }
    }

    return {
      totalTransitions: entries.length,
      byPhase,
      byResult,
      averageMetrics: {
        guideline_compliance:
          countGuideline > 0 ? totalGuideline / countGuideline : 0,
        retrieval_quality_score:
          countRetrieval > 0 ? totalRetrieval / countRetrieval : 0,
        semantic_quality: countSemantic > 0 ? totalSemantic / countSemantic : 0,
      },
    };
  }

  /**
   * Reset state (for testing)
   */
  reset(): void {
    if (existsSync(this.statePath)) {
      unlinkSync(this.statePath);
    }
  }
}

/**
 * Global singleton
 */
let globalMachine: PhaseStateMachine | null = null;

export function getPhaseStateMachine(projectRoot?: string): PhaseStateMachine {
  if (!globalMachine) {
    globalMachine = new PhaseStateMachine(projectRoot);
  }
  return globalMachine;
}
