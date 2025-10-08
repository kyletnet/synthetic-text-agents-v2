/**
 * Audit Summary Generator (Phase 3.4 - Trust Digest Automation)
 *
 * "감사 데이터를 자동으로 요약하면 신뢰가 가시화된다"
 * - Master Directive
 *
 * Purpose:
 * - Aggregate audit data from multiple sources
 * - Generate trust digest (consolidated report)
 * - Automate compliance reporting
 *
 * Architecture:
 * Compliance Reports + Trust Logs + Gating Results → **Audit Summary Generator** → Trust Digest
 *
 * Summary Strategy:
 * 1. Data Collection (gather all audit sources)
 * 2. Aggregation (combine and deduplicate)
 * 3. Analysis (calculate trends and scores)
 * 4. Report Generation (create human-readable summary)
 *
 * Expected Gain: Audit automation 100%, Trust visibility ≥95%
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { ComplianceResult } from '../compliance/compliance-engine.js';
import type { GateRResult } from '../../domain/preflight/gate-r-regulatory-compliance.js';

/**
 * Audit Summary (Trust Digest)
 */
export interface AuditSummary {
  // Metadata
  generatedAt: Date;
  period: {
    start: Date;
    end: Date;
  };
  version: string;

  // Overall Status
  overallTrustScore: number; // 0-1 (weighted average)
  systemStatus: 'healthy' | 'warning' | 'critical';
  deploymentRecommendation: 'approved' | 'conditional' | 'blocked';

  // Compliance Summary
  compliance: {
    frameworks: string[]; // ["GDPR", "HIPAA", etc.]
    overallScore: number; // 0-1
    passedFrameworks: number;
    totalFrameworks: number;
    criticalViolations: number;
    violations: ComplianceViolationSummary[];
  };

  // Trust Infrastructure
  trust: {
    evidenceStoreHealth: number; // 0-1
    trustTokensIssued: number;
    provenanceRecords: number;
    gatingResults: GatingSummary;
  };

  // Performance Metrics
  performance: {
    averageLatency: number; // ms
    p95Latency: number; // ms
    errorRate: number; // 0-1
    uptime: number; // 0-1
  };

  // Trends
  trends: {
    trustScoreTrend: 'improving' | 'stable' | 'declining';
    complianceTrend: 'improving' | 'stable' | 'declining';
    performanceTrend: 'improving' | 'stable' | 'declining';
  };

  // Recommendations
  recommendations: string[];
  actionItems: ActionItem[];
}

/**
 * Compliance Violation Summary
 */
export interface ComplianceViolationSummary {
  framework: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  count: number;
  examples: string[]; // First 3 violations
}

/**
 * Gating Summary
 */
export interface GatingSummary {
  totalGates: number;
  passedGates: number;
  failedGates: number;
  gateResults: { [gateName: string]: { passed: boolean; score: number } };
}

/**
 * Action Item
 */
export interface ActionItem {
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  description: string;
  owner: string;
  deadline?: Date;
}

/**
 * Audit Data Sources
 */
export interface AuditDataSources {
  complianceReports: ComplianceResult[];
  gateRResults: GateRResult[];
  trustMetrics: {
    evidenceCount: number;
    trustTokenCount: number;
    provenanceRecordCount: number;
  };
  performanceMetrics: {
    latencies: number[];
    errors: number;
    totalRequests: number;
  };
}

/**
 * Audit Summary Generator Config
 */
export interface AuditSummaryGeneratorConfig {
  outputPath: string; // Default: "reports/audit/summary.json"
  version: string; // Default: "1.0.0"
  enableTrends: boolean; // Default: true
  enableRecommendations: boolean; // Default: true
}

/**
 * Audit Summary Generator
 *
 * Generates consolidated trust digest from audit data
 */
export class AuditSummaryGenerator {
  private config: AuditSummaryGeneratorConfig;

  constructor(config?: Partial<AuditSummaryGeneratorConfig>) {
    this.config = {
      outputPath: config?.outputPath ?? 'reports/audit/summary.json',
      version: config?.version ?? '1.0.0',
      enableTrends: config?.enableTrends ?? true,
      enableRecommendations: config?.enableRecommendations ?? true,
    };
  }

  /**
   * Generate Audit Summary
   *
   * Main entry point for summary generation
   */
  async generate(
    sources: AuditDataSources,
    period: { start: Date; end: Date }
  ): Promise<AuditSummary> {
    // 1. Aggregate compliance data
    const complianceSummary = this.aggregateCompliance(
      sources.complianceReports
    );

    // 2. Aggregate gate results
    const gatingSummary = this.aggregateGatingResults(sources.gateRResults);

    // 3. Calculate trust score
    const trustScore = this.calculateTrustScore(
      complianceSummary,
      gatingSummary,
      sources.trustMetrics
    );

    // 4. Calculate performance metrics
    const performanceMetrics = this.calculatePerformance(
      sources.performanceMetrics
    );

    // 5. Determine system status
    const systemStatus = this.determineSystemStatus(
      trustScore,
      complianceSummary.criticalViolations
    );

    // 6. Generate deployment recommendation
    const deploymentRecommendation = this.generateDeploymentRecommendation(
      systemStatus,
      complianceSummary,
      gatingSummary
    );

    // 7. Analyze trends (if enabled)
    const trends = this.config.enableTrends
      ? await this.analyzeTrends(period)
      : {
          trustScoreTrend: 'stable' as const,
          complianceTrend: 'stable' as const,
          performanceTrend: 'stable' as const,
        };

    // 8. Generate recommendations (if enabled)
    const recommendations = this.config.enableRecommendations
      ? this.generateRecommendations(complianceSummary, gatingSummary)
      : [];

    // 9. Create action items
    const actionItems = this.createActionItems(complianceSummary, gatingSummary);

    const summary: AuditSummary = {
      generatedAt: new Date(),
      period,
      version: this.config.version,
      overallTrustScore: trustScore,
      systemStatus,
      deploymentRecommendation,
      compliance: complianceSummary,
      trust: {
        evidenceStoreHealth: sources.trustMetrics.evidenceCount > 0 ? 0.95 : 0.5,
        trustTokensIssued: sources.trustMetrics.trustTokenCount,
        provenanceRecords: sources.trustMetrics.provenanceRecordCount,
        gatingResults: gatingSummary,
      },
      performance: performanceMetrics,
      trends,
      recommendations,
      actionItems,
    };

    return summary;
  }

  /**
   * Save Audit Summary to file
   */
  async save(summary: AuditSummary): Promise<void> {
    const outputDir = path.dirname(this.config.outputPath);
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(
      this.config.outputPath,
      JSON.stringify(summary, null, 2),
      'utf-8'
    );
  }

  /**
   * Aggregate Compliance Reports
   */
  private aggregateCompliance(reports: ComplianceResult[]): {
    frameworks: string[];
    overallScore: number;
    passedFrameworks: number;
    totalFrameworks: number;
    criticalViolations: number;
    violations: ComplianceViolationSummary[];
  } {
    if (reports.length === 0) {
      return {
        frameworks: [],
        overallScore: 1.0,
        passedFrameworks: 0,
        totalFrameworks: 0,
        criticalViolations: 0,
        violations: [],
      };
    }

    const frameworks = reports.map((r) => r.framework);
    const overallScore =
      reports.reduce((sum, r) => sum + r.score, 0) / reports.length;
    const passedFrameworks = reports.filter((r) => r.compliant).length;
    const criticalViolations = reports.reduce(
      (sum, r) => sum + r.criticalViolations,
      0
    );

    // Aggregate violations by category
    const violationMap = new Map<
      string,
      {
        framework: string;
        category: string;
        severity: 'critical' | 'high' | 'medium' | 'low';
        examples: string[];
      }
    >();

    for (const report of reports) {
      for (const violation of report.violations) {
        const key = `${report.framework}:${violation.category}:${violation.severity}`;
        const existing = violationMap.get(key);

        if (existing) {
          existing.examples.push(violation.requirement);
        } else {
          violationMap.set(key, {
            framework: report.framework,
            category: violation.category,
            severity: violation.severity,
            examples: [violation.requirement],
          });
        }
      }
    }

    // Convert to summary array
    const violations: ComplianceViolationSummary[] = Array.from(
      violationMap.values()
    ).map((v) => ({
      framework: v.framework,
      category: v.category,
      severity: v.severity,
      count: v.examples.length,
      examples: v.examples.slice(0, 3), // First 3
    }));

    return {
      frameworks,
      overallScore,
      passedFrameworks,
      totalFrameworks: reports.length,
      criticalViolations,
      violations,
    };
  }

  /**
   * Aggregate Gating Results
   */
  private aggregateGatingResults(results: GateRResult[]): GatingSummary {
    if (results.length === 0) {
      return {
        totalGates: 0,
        passedGates: 0,
        failedGates: 0,
        gateResults: {},
      };
    }

    const passedGates = results.filter((r) => r.passed).length;

    const gateResults: { [gateName: string]: { passed: boolean; score: number } } =
      {};
    for (const result of results) {
      gateResults[`Gate-R-${result.details.framework}`] = {
        passed: result.passed,
        score: result.score,
      };
    }

    return {
      totalGates: results.length,
      passedGates,
      failedGates: results.length - passedGates,
      gateResults,
    };
  }

  /**
   * Calculate Overall Trust Score
   */
  private calculateTrustScore(
    compliance: ReturnType<AuditSummaryGenerator['aggregateCompliance']>,
    gating: GatingSummary,
    trustMetrics: { evidenceCount: number; trustTokenCount: number; provenanceRecordCount: number }
  ): number {
    const complianceWeight = 0.5;
    const gatingWeight = 0.3;
    const trustInfraWeight = 0.2;

    const complianceScore = compliance.overallScore;
    const gatingScore =
      gating.totalGates > 0 ? gating.passedGates / gating.totalGates : 1.0;
    const trustInfraScore = Math.min(
      (trustMetrics.evidenceCount +
        trustMetrics.trustTokenCount +
        trustMetrics.provenanceRecordCount) /
        1000,
      1.0
    );

    return (
      complianceScore * complianceWeight +
      gatingScore * gatingWeight +
      trustInfraScore * trustInfraWeight
    );
  }

  /**
   * Calculate Performance Metrics
   */
  private calculatePerformance(metrics: {
    latencies: number[];
    errors: number;
    totalRequests: number;
  }): {
    averageLatency: number;
    p95Latency: number;
    errorRate: number;
    uptime: number;
  } {
    const latencies = metrics.latencies.sort((a, b) => a - b);
    const averageLatency =
      latencies.reduce((sum, l) => sum + l, 0) / latencies.length || 0;
    const p95Index = Math.floor(latencies.length * 0.95);
    const p95Latency = latencies[p95Index] || 0;

    const errorRate = metrics.totalRequests > 0
      ? metrics.errors / metrics.totalRequests
      : 0;
    const uptime = 1 - errorRate;

    return {
      averageLatency,
      p95Latency,
      errorRate,
      uptime,
    };
  }

  /**
   * Determine System Status
   */
  private determineSystemStatus(
    trustScore: number,
    criticalViolations: number
  ): 'healthy' | 'warning' | 'critical' {
    if (criticalViolations > 0 || trustScore < 0.7) {
      return 'critical';
    }
    if (trustScore < 0.85) {
      return 'warning';
    }
    return 'healthy';
  }

  /**
   * Generate Deployment Recommendation
   */
  private generateDeploymentRecommendation(
    status: 'healthy' | 'warning' | 'critical',
    compliance: ReturnType<AuditSummaryGenerator['aggregateCompliance']>,
    gating: GatingSummary
  ): 'approved' | 'conditional' | 'blocked' {
    if (status === 'critical') {
      return 'blocked';
    }

    if (compliance.criticalViolations > 0) {
      return 'blocked';
    }

    if (gating.failedGates > 0) {
      return 'conditional';
    }

    if (status === 'warning') {
      return 'conditional';
    }

    return 'approved';
  }

  /**
   * Analyze Trends
   */
  private async analyzeTrends(_period: {
    start: Date;
    end: Date;
  }): Promise<{
    trustScoreTrend: 'improving' | 'stable' | 'declining';
    complianceTrend: 'improving' | 'stable' | 'declining';
    performanceTrend: 'improving' | 'stable' | 'declining';
  }> {
    // TODO: Load historical data and compare
    // For now, return stable
    return {
      trustScoreTrend: 'stable',
      complianceTrend: 'stable',
      performanceTrend: 'stable',
    };
  }

  /**
   * Generate Recommendations
   */
  private generateRecommendations(
    compliance: ReturnType<AuditSummaryGenerator['aggregateCompliance']>,
    gating: GatingSummary
  ): string[] {
    const recommendations: string[] = [];

    if (compliance.criticalViolations > 0) {
      recommendations.push(
        `URGENT: Address ${compliance.criticalViolations} critical compliance violation(s)`
      );
    }

    if (compliance.passedFrameworks < compliance.totalFrameworks) {
      const failed = compliance.totalFrameworks - compliance.passedFrameworks;
      recommendations.push(
        `Improve compliance in ${failed} framework(s) to meet 95% threshold`
      );
    }

    if (gating.failedGates > 0) {
      recommendations.push(
        `Review and resolve ${gating.failedGates} failed gate(s) before deployment`
      );
    }

    if (compliance.overallScore < 0.95) {
      recommendations.push(
        'Enhance regulatory compliance measures to reach deployment threshold'
      );
    }

    return recommendations;
  }

  /**
   * Create Action Items
   */
  private createActionItems(
    compliance: ReturnType<AuditSummaryGenerator['aggregateCompliance']>,
    gating: GatingSummary
  ): ActionItem[] {
    const items: ActionItem[] = [];

    // Critical violations → Critical action items
    if (compliance.criticalViolations > 0) {
      items.push({
        priority: 'critical',
        category: 'compliance',
        description: `Resolve ${compliance.criticalViolations} critical compliance violations`,
        owner: 'Compliance Team',
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      });
    }

    // Failed gates → High priority
    if (gating.failedGates > 0) {
      items.push({
        priority: 'high',
        category: 'gating',
        description: `Fix ${gating.failedGates} failed regulatory gates`,
        owner: 'Engineering Team',
        deadline: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours
      });
    }

    return items;
  }
}

/**
 * Create Audit Summary Generator instance
 */
export function createAuditSummaryGenerator(
  config?: Partial<AuditSummaryGeneratorConfig>
): AuditSummaryGenerator {
  return new AuditSummaryGenerator(config);
}
