#!/usr/bin/env tsx

/**
 * Smart Refactor State Management
 * Handles state, rollback, context recovery for the hybrid refactor system
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

interface FixRecord {
  id: string;
  type: string;
  description: string;
  files: string[];
  appliedAt: Date;
  rollbackData: any;
  safety: SafetyScore;
  criteria: string[];
}

interface ConfirmItem {
  id: string;
  category: string;
  title: string;
  description: string;
  files: string[];
  impact: ImpactScore;
  previewCommand?: string;
  risk: "low" | "medium" | "high";
}

interface SafetyScore {
  fileCount: number;
  crossModule: boolean;
  buildImpact: boolean;
  testCoverage: number;
  rollbackDifficulty: number;
  autoSafe: boolean;
}

interface ImpactScore {
  fileCount: number;
  crossModuleImpact: boolean;
  buildImpact: boolean;
  testCoverage: number;
  rollbackDifficulty: number;
}

interface RefactorState {
  lastAudit: Date;
  autoFixed: FixRecord[];
  pendingConfirm: ConfirmItem[];
  completedConfirm: FixRecord[];
  rollbackStack: RollbackPoint[];
  confirmSession?: {
    items: ConfirmItem[];
    currentIndex: number;
    timestamp: Date;
  };
  learnedCriteria: LearnedCriteria;
}

interface RollbackPoint {
  id: string;
  timestamp: Date;
  description: string;
  affectedFiles: string[];
  changes: FileChange[];
}

interface FileChange {
  path: string;
  before: string;
  after: string;
}

interface LearnedCriteria {
  fileCountThresholds: Record<string, number>;
  categoryRiskAdjustments: Record<string, number>;
  userApprovalHistory: Array<{
    item: ConfirmItem;
    approved: boolean;
    timestamp: Date;
  }>;
}

export class SmartRefactorStateManager {
  private stateDir: string;
  private statePath: string;
  private state!: RefactorState;

  constructor(rootDir: string = process.cwd()) {
    this.stateDir = join(rootDir, ".refactor");
    this.statePath = join(this.stateDir, "state.json");
    this.ensureStateDir();
    this.loadState();
  }

  private ensureStateDir(): void {
    if (!existsSync(this.stateDir)) {
      mkdirSync(this.stateDir, { recursive: true });
    }

    // Create logs directory
    const logsDir = join(this.stateDir, "logs");
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }
  }

  private loadState(): void {
    if (existsSync(this.statePath)) {
      try {
        const content = readFileSync(this.statePath, "utf-8");
        this.state = JSON.parse(content, this.dateReviver);
      } catch {
        this.state = this.getDefaultState();
      }
    } else {
      this.state = this.getDefaultState();
    }
  }

  private dateReviver(key: string, value: any): any {
    if (
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)
    ) {
      return new Date(value);
    }
    return value;
  }

  private getDefaultState(): RefactorState {
    return {
      lastAudit: new Date(0),
      autoFixed: [],
      pendingConfirm: [],
      completedConfirm: [],
      rollbackStack: [],
      learnedCriteria: {
        fileCountThresholds: {
          "import-cleanup": 5,
          "export-duplication": 3,
          "doc-formatting": 10,
        },
        categoryRiskAdjustments: {},
        userApprovalHistory: [],
      },
    };
  }

  saveState(): void {
    this.cleanup();
    writeFileSync(this.statePath, JSON.stringify(this.state, null, 2));
  }

  // Context Recovery
  hasIncompleteSession(): boolean {
    if (!this.state.confirmSession) return false;

    const session = this.state.confirmSession;
    const isRecent =
      Date.now() - session.timestamp.getTime() < 24 * 60 * 60 * 1000; // 24 hours
    const hasRemaining = session.currentIndex < session.items.length;

    return isRecent && hasRemaining;
  }

  getIncompleteSession(): ConfirmItem[] | null {
    if (!this.hasIncompleteSession()) return null;

    const session = this.state.confirmSession!;
    return session.items.slice(session.currentIndex);
  }

  saveConfirmSession(items: ConfirmItem[], currentIndex: number): void {
    this.state.confirmSession = {
      items,
      currentIndex,
      timestamp: new Date(),
    };
    this.saveState();
  }

  clearConfirmSession(): void {
    delete this.state.confirmSession;
    this.saveState();
  }

  // Auto-fix Management
  addAutoFix(fix: FixRecord): void {
    this.state.autoFixed.push(fix);
    this.createRollbackPoint(fix);
    this.saveState();
  }

  // Confirmation Management
  setPendingConfirmations(items: ConfirmItem[]): void {
    this.state.pendingConfirm = items;
    this.saveState();
  }

  getPendingConfirmations(): ConfirmItem[] {
    return this.state.pendingConfirm;
  }

  confirmItem(item: ConfirmItem, approved: boolean): void {
    // Record decision for learning
    this.state.learnedCriteria.userApprovalHistory.push({
      item,
      approved,
      timestamp: new Date(),
    });

    if (approved) {
      const fixRecord: FixRecord = {
        id: item.id,
        type: item.category,
        description: item.description,
        files: item.files,
        appliedAt: new Date(),
        rollbackData: {}, // Will be filled by actual fix implementation
        safety: this.convertImpactToSafety(item.impact),
        criteria: [`user-confirmed-${item.risk}-risk`],
      };
      this.state.completedConfirm.push(fixRecord);
    }

    // Remove from pending
    this.state.pendingConfirm = this.state.pendingConfirm.filter(
      (p) => p.id !== item.id,
    );
    this.saveState();
  }

  private convertImpactToSafety(impact: ImpactScore): SafetyScore {
    return {
      fileCount: impact.fileCount,
      crossModule: impact.crossModuleImpact,
      buildImpact: impact.buildImpact,
      testCoverage: impact.testCoverage,
      rollbackDifficulty: impact.rollbackDifficulty,
      autoSafe: false, // User confirmation required
    };
  }

  // Rollback System
  private createRollbackPoint(fix: FixRecord): void {
    const rollbackPoint: RollbackPoint = {
      id: `rollback-${Date.now()}`,
      timestamp: new Date(),
      description: `Before: ${fix.description}`,
      affectedFiles: fix.files,
      changes: [], // Will be populated by actual fix implementation
    };

    this.state.rollbackStack.push(rollbackPoint);

    // Keep only last 5 rollback points
    if (this.state.rollbackStack.length > 5) {
      this.state.rollbackStack.shift();
    }
  }

  getLatestRollbackPoint(): RollbackPoint | null {
    return (
      this.state.rollbackStack[this.state.rollbackStack.length - 1] || null
    );
  }

  getRollbackPreview(pointId?: string): {
    point: RollbackPoint;
    conflicts: string[];
    safe: boolean;
  } | null {
    let point: RollbackPoint | null = null;

    if (pointId) {
      point = this.state.rollbackStack.find((p) => p.id === pointId) || null;
    } else {
      point = this.getLatestRollbackPoint();
    }

    if (!point) return null;

    // Detect conflicts (simplified)
    const conflicts = point.affectedFiles.filter((file) => {
      // Check if file was modified after rollback point
      try {
        const stats = require("fs").statSync(file);
        return stats.mtime > point!.timestamp;
      } catch {
        return false; // File doesn't exist, no conflict
      }
    });

    return {
      point,
      conflicts,
      safe: conflicts.length === 0,
    };
  }

  // Learning System
  updateLearnedCriteria(): void {
    const history = this.state.learnedCriteria.userApprovalHistory;
    if (history.length < 5) return; // Need some data

    // Analyze patterns
    const recentHistory = history.slice(-10); // Last 10 decisions

    for (const category of [
      "import-cleanup",
      "export-duplication",
      "doc-formatting",
    ]) {
      const categoryDecisions = recentHistory.filter(
        (h) => h.item.category === category,
      );
      if (categoryDecisions.length >= 3) {
        const approvalRate =
          categoryDecisions.filter((d) => d.approved).length /
          categoryDecisions.length;

        if (approvalRate > 0.8) {
          // Increase threshold (more items can be auto-fixed)
          const current =
            this.state.learnedCriteria.fileCountThresholds[category] || 3;
          this.state.learnedCriteria.fileCountThresholds[category] = Math.min(
            current + 1,
            10,
          );
        } else if (approvalRate < 0.3) {
          // Decrease threshold (be more conservative)
          const current =
            this.state.learnedCriteria.fileCountThresholds[category] || 3;
          this.state.learnedCriteria.fileCountThresholds[category] = Math.max(
            current - 1,
            1,
          );
        }
      }
    }
  }

  getLearnedCriteriaSummary(): string[] {
    const summary: string[] = [];
    const thresholds = this.state.learnedCriteria.fileCountThresholds;

    for (const [category, threshold] of Object.entries(thresholds)) {
      summary.push(`${category}: max ${threshold} files for auto-fix`);
    }

    const adjustments = this.state.learnedCriteria.categoryRiskAdjustments;
    for (const [category, adjustment] of Object.entries(adjustments)) {
      summary.push(
        `${category}: risk adjusted by ${
          adjustment > 0 ? "+" : ""
        }${adjustment}`,
      );
    }

    return summary;
  }

  resetLearnedCriteria(): void {
    this.state.learnedCriteria = this.getDefaultState().learnedCriteria;
    this.saveState();
  }

  // State Synchronization
  detectOutOfSyncChanges(): {
    modifiedFiles: string[];
    deletedFiles: string[];
    summary: string;
  } {
    const allTrackedFiles = new Set<string>();

    // Collect all files we've touched
    [...this.state.autoFixed, ...this.state.completedConfirm].forEach((fix) => {
      fix.files.forEach((file) => allTrackedFiles.add(file));
    });

    const modifiedFiles: string[] = [];
    const deletedFiles: string[] = [];

    for (const file of allTrackedFiles) {
      if (!existsSync(file)) {
        deletedFiles.push(file);
      } else {
        // Check if modified after our last touch (simplified)
        try {
          const stats = require("fs").statSync(file);
          const lastAudit = this.state.lastAudit;
          if (stats.mtime > lastAudit) {
            modifiedFiles.push(file);
          }
        } catch {
          // File access error, skip
        }
      }
    }

    return {
      modifiedFiles,
      deletedFiles,
      summary: `${modifiedFiles.length} modified, ${deletedFiles.length} deleted since last audit`,
    };
  }

  syncState(): void {
    // Simple sync: just update lastAudit to mark we're aware of current state
    this.state.lastAudit = new Date();
    this.saveState();
  }

  // Utility Methods
  getSummary(): {
    autoFixedCount: number;
    pendingConfirmCount: number;
    rollbackPointsCount: number;
    hasIncompleteSession: boolean;
  } {
    return {
      autoFixedCount: this.state.autoFixed.length,
      pendingConfirmCount: this.state.pendingConfirm.length,
      rollbackPointsCount: this.state.rollbackStack.length,
      hasIncompleteSession: this.hasIncompleteSession(),
    };
  }

  getNextAction(): string {
    if (this.hasIncompleteSession()) {
      return "Resume incomplete confirmation session with /refactor-confirm";
    }

    if (this.state.pendingConfirm.length > 0) {
      return `Review ${this.state.pendingConfirm.length} items needing confirmation with /refactor-confirm`;
    }

    const timeSinceLastAudit = Date.now() - this.state.lastAudit.getTime();
    const hours = Math.floor(timeSinceLastAudit / (1000 * 60 * 60));

    if (hours > 24) {
      return "Run /refactor-audit to check for new issues";
    }

    return "No immediate refactor actions needed";
  }

  private cleanup(): void {
    // Remove old entries (keep last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    this.state.autoFixed = this.state.autoFixed.filter(
      (fix) => fix.appliedAt > thirtyDaysAgo,
    );
    this.state.completedConfirm = this.state.completedConfirm.filter(
      (fix) => fix.appliedAt > thirtyDaysAgo,
    );

    // Keep only recent learning history
    const history = this.state.learnedCriteria.userApprovalHistory;
    this.state.learnedCriteria.userApprovalHistory = history
      .filter((entry) => entry.timestamp > thirtyDaysAgo)
      .slice(-50); // Keep last 50 decisions max
  }

  // Export current state for debugging
  exportState(): RefactorState {
    return { ...this.state };
  }
}
