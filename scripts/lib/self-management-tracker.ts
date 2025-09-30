#!/usr/bin/env tsx

/**
 * Self-Management Score Real-time Tracker
 * Implements comprehensive scoring system for system self-management capabilities
 * Based on GPT recommendations for clear criteria and real-time updates
 */

import { EventEmitter } from "events";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

export interface SystemEvent {
  timestamp: Date;
  type:
    | "integration"
    | "maintenance"
    | "resolution"
    | "optimization"
    | "failure";
  component: string;
  impact: "positive" | "negative" | "neutral";
  magnitude: number; // 0-1 scale
  metadata: Record<string, unknown>;
}

export interface ScoreCriteria {
  systemHealth: {
    weight: number;
    metrics: string[];
    target: number;
  };
  integrationCohesion: {
    weight: number;
    metrics: string[];
    target: number;
  };
  automationEffectiveness: {
    weight: number;
    metrics: string[];
    target: number;
  };
  technicalDebtReduction: {
    weight: number;
    metrics: string[];
    target: number;
  };
}

export interface ScoreTrend {
  timestamp: Date;
  overall: number;
  breakdown: {
    systemHealth: number;
    integrationCohesion: number;
    automationEffectiveness: number;
    technicalDebtReduction: number;
  };
  triggeredBy: string;
  context: Record<string, unknown>;
}

export interface SelfManagementScore {
  overall: number;
  breakdown: {
    systemHealth: number;
    integrationCohesion: number;
    automationEffectiveness: number;
    technicalDebtReduction: number;
  };
  trends: ScoreTrend[];
  recommendations: string[];
  lastUpdated: Date;
  updateCount: number;
}

/**
 * Self-Management Score Tracker
 * Continuously monitors and evaluates system self-management capabilities
 */
export class SelfManagementTracker extends EventEmitter {
  private projectRoot = process.cwd();
  private scoreHistory: ScoreTrend[] = [];
  private eventBuffer: SystemEvent[] = [];
  private scorePath = join(
    this.projectRoot,
    "reports",
    "self-management-scores.json",
  );
  private eventsPath = join(this.projectRoot, "reports", "system-events.json");

  // Default scoring criteria - can be updated dynamically
  private criteria: ScoreCriteria = {
    systemHealth: {
      weight: 0.3,
      metrics: ["uptime", "error_rate", "performance_variance"],
      target: 0.9,
    },
    integrationCohesion: {
      weight: 0.25,
      metrics: [
        "component_compatibility",
        "dependency_health",
        "interface_consistency",
      ],
      target: 0.85,
    },
    automationEffectiveness: {
      weight: 0.25,
      metrics: [
        "auto_resolution_rate",
        "manual_intervention_ratio",
        "workflow_efficiency",
      ],
      target: 0.8,
    },
    technicalDebtReduction: {
      weight: 0.2,
      metrics: [
        "workarounds_resolved",
        "code_quality_improvement",
        "refactoring_progress",
      ],
      target: 0.75,
    },
  };

  constructor() {
    super();
    this.setMaxListeners(50);

    this.loadHistoricalData();
    this.startRealTimeMonitoring();
    this.startPeriodicScoring();
  }

  /**
   * Calculate current self-management score
   */
  async calculateScore(): Promise<SelfManagementScore> {
    console.log("🎯 Calculating self-management score...");

    const systemHealth = await this.calculateSystemHealth();
    const integrationCohesion = await this.calculateIntegrationCohesion();
    const automationEffectiveness =
      await this.calculateAutomationEffectiveness();
    const technicalDebtReduction = await this.calculateTechnicalDebtReduction();

    const breakdown = {
      systemHealth,
      integrationCohesion,
      automationEffectiveness,
      technicalDebtReduction,
    };

    // Calculate weighted overall score
    const overall =
      systemHealth * this.criteria.systemHealth.weight +
      integrationCohesion * this.criteria.integrationCohesion.weight +
      automationEffectiveness * this.criteria.automationEffectiveness.weight +
      technicalDebtReduction * this.criteria.technicalDebtReduction.weight;

    const scoreTrend: ScoreTrend = {
      timestamp: new Date(),
      overall: Math.round(overall * 100) / 100,
      breakdown,
      triggeredBy: "scheduled_calculation",
      context: { eventCount: this.eventBuffer.length },
    };

    this.scoreHistory.push(scoreTrend);
    this.eventBuffer = []; // Clear processed events

    // Keep only last 100 score records
    if (this.scoreHistory.length > 100) {
      this.scoreHistory = this.scoreHistory.slice(-100);
    }

    const recommendations = this.generateRecommendations(breakdown);

    const score: SelfManagementScore = {
      overall: scoreTrend.overall,
      breakdown,
      trends: this.scoreHistory.slice(-10), // Last 10 trends
      recommendations,
      lastUpdated: new Date(),
      updateCount: this.scoreHistory.length,
    };

    await this.persistScore(score);

    console.log(
      `   Overall Score: ${score.overall} (${this.getScoreGrade(score.overall)})`,
    );
    console.log(`   System Health: ${systemHealth}`);
    console.log(`   Integration Cohesion: ${integrationCohesion}`);
    console.log(`   Automation Effectiveness: ${automationEffectiveness}`);
    console.log(`   Technical Debt Reduction: ${technicalDebtReduction}`);

    this.emit("score:calculated", score);
    return score;
  }

  /**
   * Record system event that affects self-management score
   */
  recordEvent(event: SystemEvent): void {
    this.eventBuffer.push(event);
    console.log(
      `📊 Recorded ${event.type} event: ${event.component} (${event.impact})`,
    );

    // Trigger immediate recalculation for high-impact events
    if (event.magnitude > 0.7) {
      console.log(
        "🚨 High-impact event detected, triggering immediate score update",
      );
      this.calculateScore().catch(console.error);
    }

    this.emit("event:recorded", event);
  }

  /**
   * Update scoring criteria weights
   */
  updateWeights(newCriteria: Partial<ScoreCriteria>): void {
    this.criteria = { ...this.criteria, ...newCriteria };
    console.log("⚖️ Updated scoring criteria weights");

    // Recalculate with new weights
    this.calculateScore().catch(console.error);

    this.emit("weights:updated", this.criteria);
  }

  /**
   * Get current scoring criteria
   */
  getCriteria(): ScoreCriteria {
    return this.criteria;
  }

  /**
   * Get score history and trends
   */
  getScoreHistory(): ScoreTrend[] {
    return this.scoreHistory.slice(); // Return copy
  }

  /**
   * Get recent system events
   */
  getRecentEvents(limit = 50): SystemEvent[] {
    return this.eventBuffer.slice(-limit);
  }

  private async calculateSystemHealth(): Promise<number> {
    let healthScore = 0.8; // Base score

    try {
      // Check if recent builds/tests are passing
      const hasRecentFailures =
        this.eventBuffer.filter(
          (e) =>
            e.type === "failure" &&
            e.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000),
        ).length > 0;

      if (!hasRecentFailures) {
        healthScore += 0.1;
      }

      // Check memory usage and performance
      const memUsage = process.memoryUsage();
      const memEfficiency = Math.max(
        0,
        1 - memUsage.heapUsed / memUsage.heapTotal,
      );
      healthScore = healthScore * 0.7 + memEfficiency * 0.3;

      // Check component registration status
      const positiveIntegrations = this.eventBuffer.filter(
        (e) => e.type === "integration" && e.impact === "positive",
      ).length;

      if (positiveIntegrations > 0) {
        healthScore += 0.05;
      }
    } catch (error) {
      console.warn("⚠️ Error calculating system health:", error);
      healthScore = 0.5; // Conservative fallback
    }

    return Math.min(1.0, Math.max(0.0, healthScore));
  }

  private async calculateIntegrationCohesion(): Promise<number> {
    let cohesionScore = 0.7; // Base score

    try {
      // Analyze integration success rate
      const integrationEvents = this.eventBuffer.filter(
        (e) => e.type === "integration",
      );
      if (integrationEvents.length > 0) {
        const successRate =
          integrationEvents.filter((e) => e.impact === "positive").length /
          integrationEvents.length;
        cohesionScore = cohesionScore * 0.5 + successRate * 0.5;
      }

      // Check for dependency conflicts or issues
      const conflictEvents = this.eventBuffer.filter(
        (e) => e.type === "failure" && e.metadata.category === "dependency",
      );

      if (conflictEvents.length === 0) {
        cohesionScore += 0.1;
      }

      // Analyze component communication patterns
      const maintenanceEvents = this.eventBuffer.filter(
        (e) => e.type === "maintenance" && e.impact === "positive",
      );

      if (maintenanceEvents.length > 0) {
        cohesionScore += 0.05;
      }
    } catch (error) {
      console.warn("⚠️ Error calculating integration cohesion:", error);
      cohesionScore = 0.5;
    }

    return Math.min(1.0, Math.max(0.0, cohesionScore));
  }

  private async calculateAutomationEffectiveness(): Promise<number> {
    let automationScore = 0.6; // Base score

    try {
      // Analyze resolution success rate
      const resolutionEvents = this.eventBuffer.filter(
        (e) => e.type === "resolution",
      );
      if (resolutionEvents.length > 0) {
        const autoSuccessRate =
          resolutionEvents.filter(
            (e) => e.impact === "positive" && e.metadata.automated === true,
          ).length / resolutionEvents.length;
        automationScore = automationScore * 0.6 + autoSuccessRate * 0.4;
      }

      // Check maintenance automation
      const maintenanceEvents = this.eventBuffer.filter(
        (e) => e.type === "maintenance",
      );
      const automatedMaintenance = maintenanceEvents.filter(
        (e) => e.metadata.manual_intervention === false,
      );

      if (maintenanceEvents.length > 0) {
        const automationRate =
          automatedMaintenance.length / maintenanceEvents.length;
        automationScore += automationRate * 0.2;
      }

      // Bonus for optimization events
      const optimizationEvents = this.eventBuffer.filter(
        (e) => e.type === "optimization" && e.impact === "positive",
      );

      if (optimizationEvents.length > 0) {
        automationScore += 0.1;
      }
    } catch (error) {
      console.warn("⚠️ Error calculating automation effectiveness:", error);
      automationScore = 0.4;
    }

    return Math.min(1.0, Math.max(0.0, automationScore));
  }

  private async calculateTechnicalDebtReduction(): Promise<number> {
    let debtScore = 0.5; // Base score

    try {
      // Check for workaround resolution activity
      const resolutionEvents = this.eventBuffer.filter(
        (e) => e.type === "resolution" && e.impact === "positive",
      );

      if (resolutionEvents.length > 0) {
        debtScore += Math.min(0.3, resolutionEvents.length * 0.05);
      }

      // Check for refactoring and optimization
      const optimizationEvents = this.eventBuffer.filter(
        (e) => e.type === "optimization",
      );

      if (optimizationEvents.length > 0) {
        const positiveOptimizations = optimizationEvents.filter(
          (e) => e.impact === "positive",
        ).length;
        debtScore += (positiveOptimizations / optimizationEvents.length) * 0.2;
      }

      // Penalty for new technical debt
      const debtEvents = this.eventBuffer.filter(
        (e) => e.metadata.technical_debt_added === true,
      );

      if (debtEvents.length > 0) {
        debtScore -= Math.min(0.2, debtEvents.length * 0.05);
      }
    } catch (error) {
      console.warn("⚠️ Error calculating technical debt reduction:", error);
      debtScore = 0.3;
    }

    return Math.min(1.0, Math.max(0.0, debtScore));
  }

  private generateRecommendations(breakdown: {
    systemHealth: number;
    integrationCohesion: number;
    automationEffectiveness: number;
    technicalDebtReduction: number;
  }): string[] {
    const recommendations: string[] = [];

    if (breakdown.systemHealth < this.criteria.systemHealth.target) {
      recommendations.push(
        "Investigate and resolve system health issues to improve stability",
      );
    }

    if (
      breakdown.integrationCohesion < this.criteria.integrationCohesion.target
    ) {
      recommendations.push(
        "Review component integration patterns and resolve compatibility issues",
      );
    }

    if (
      breakdown.automationEffectiveness <
      this.criteria.automationEffectiveness.target
    ) {
      recommendations.push(
        "Enhance automation capabilities and reduce manual intervention needs",
      );
    }

    if (
      breakdown.technicalDebtReduction <
      this.criteria.technicalDebtReduction.target
    ) {
      recommendations.push(
        "Accelerate technical debt resolution and workaround elimination",
      );
    }

    // Positive reinforcement
    const strongAreas = Object.entries(breakdown)
      .filter(
        ([key, value]) =>
          value >= this.criteria[key as keyof ScoreCriteria].target,
      )
      .map(([key]) => key);

    if (strongAreas.length > 0) {
      recommendations.push(
        `Continue excellent performance in: ${strongAreas.join(", ")}`,
      );
    }

    return recommendations;
  }

  private getScoreGrade(score: number): string {
    if (score >= 0.9) return "Excellent (A)";
    if (score >= 0.8) return "Good (B)";
    if (score >= 0.7) return "Fair (C)";
    if (score >= 0.6) return "Needs Improvement (D)";
    return "Critical (F)";
  }

  private loadHistoricalData(): void {
    try {
      if (existsSync(this.scorePath)) {
        const scoreData = readFileSync(this.scorePath, "utf8");
        const historicalScores = JSON.parse(scoreData);

        this.scoreHistory = historicalScores.map((s: any) => ({
          ...s,
          timestamp: new Date(s.timestamp),
        }));

        console.log(
          `📊 Loaded ${this.scoreHistory.length} historical score records`,
        );
      }
    } catch (error) {
      console.warn("⚠️ Could not load historical score data:", error);
    }
  }

  private async persistScore(score: SelfManagementScore): Promise<void> {
    try {
      writeFileSync(this.scorePath, JSON.stringify(this.scoreHistory, null, 2));

      // Also save current events for audit trail
      writeFileSync(this.eventsPath, JSON.stringify(this.eventBuffer, null, 2));
    } catch (error) {
      console.error("❌ Failed to persist score data:", error);
    }
  }

  private startRealTimeMonitoring(): void {
    console.log("📡 Starting real-time event monitoring...");

    // Monitor for system changes that affect scoring
    setInterval(() => {
      // Auto-record system health events
      const memUsage = process.memoryUsage();
      if (memUsage.heapUsed / memUsage.heapTotal > 0.9) {
        this.recordEvent({
          timestamp: new Date(),
          type: "failure",
          component: "memory_management",
          impact: "negative",
          magnitude: 0.6,
          metadata: {
            reason: "high_memory_usage",
            heapRatio: memUsage.heapUsed / memUsage.heapTotal,
          },
        });
      }
    }, 60000); // Check every minute
  }

  private startPeriodicScoring(): void {
    console.log("⏰ Starting periodic score calculation...");

    // Calculate scores every 10 minutes
    setInterval(
      () => {
        if (this.eventBuffer.length > 0) {
          console.log("📊 Periodic score recalculation triggered");
          this.calculateScore().catch(console.error);
        }
      },
      10 * 60 * 1000,
    ); // 10 minutes
  }
}

// Global instance for easy access
export const selfManagementTracker = new SelfManagementTracker();
export default SelfManagementTracker;
