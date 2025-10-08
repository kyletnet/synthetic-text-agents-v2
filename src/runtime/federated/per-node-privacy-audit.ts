/**
 * Per-Node Privacy Auditor
 *
 * "각 노드는 독립적으로 검증되어야 한다"
 * - Phase 3.6 Enhanced Privacy Strategy
 *
 * Purpose:
 * - 노드별 k-anonymity 독립 검증
 * - Tenant-specific privacy 정책 적용
 * - 악의적 노드 조기 감지
 *
 * Architecture:
 * For each Tenant → Independent k-Anonymity Audit → Alert Violations
 *
 * Key Innovation:
 * - Dynamic k based on tenant policy
 * - Per-tenant quasi-identifier selection
 * - Cross-tenant comparison (detect suspicious patterns)
 *
 * Expected Impact: Privacy Score +3%p, Malicious node detection +50%
 *
 * @see RFC 2025-20: Phase 3.6 Enhanced Execution (Axis 2)
 */

import type {
  KnowledgeFabric,
  AnonymizedNode,
  Tenant,
} from './knowledge-fabric';
import type {
  KAnonymityResult,
  KAnonymityViolation,
} from './privacy-audit';

/**
 * Per-Node Audit Result
 */
export interface PerNodeAuditResult {
  tenantId: string;
  kAnonymity: KAnonymityResult;
  suspicious: boolean; // If patterns indicate malicious behavior
  suspicionReasons: string[];
  recommendation: string;
}

/**
 * Multi-Tenant Audit Summary
 */
export interface MultiTenantAuditSummary {
  totalTenants: number;
  passedTenants: number;
  failedTenants: number;
  suspiciousTenants: number;

  // Results per tenant
  results: Map<string, PerNodeAuditResult>;

  // Overall score
  overallPrivacyScore: number; // 0-100

  // Timestamp
  timestamp: Date;
}

/**
 * Per-Node Privacy Auditor
 *
 * Audits each tenant independently
 */
export class PerNodePrivacyAuditor {
  /**
   * Audit all nodes in fabric (per-tenant)
   */
  async auditAllNodes(
    fabric: KnowledgeFabric
  ): Promise<MultiTenantAuditSummary> {
    const results = new Map<string, PerNodeAuditResult>();

    // Audit each tenant independently
    for (const tenant of fabric.tenants) {
      const result = await this.auditSingleTenant(fabric, tenant);
      results.set(tenant.id, result);

      // Alert if violations or suspicious
      if (!result.kAnonymity.passed || result.suspicious) {
        await this.alertViolation(tenant, result);
      }
    }

    // Calculate summary
    const passedTenants = Array.from(results.values()).filter(
      (r) => r.kAnonymity.passed
    ).length;
    const failedTenants = fabric.tenants.length - passedTenants;
    const suspiciousTenants = Array.from(results.values()).filter(
      (r) => r.suspicious
    ).length;

    // Calculate overall score
    const overallPrivacyScore = this.calculateOverallScore(results);

    return {
      totalTenants: fabric.tenants.length,
      passedTenants,
      failedTenants,
      suspiciousTenants,
      results,
      overallPrivacyScore,
      timestamp: new Date(),
    };
  }

  /**
   * Audit single tenant
   */
  async auditSingleTenant(
    fabric: KnowledgeFabric,
    tenant: Tenant
  ): Promise<PerNodeAuditResult> {
    // Get nodes from this tenant only
    const tenantNodes = fabric.nodes.filter(
      (n) => n.tenantId === tenant.id || this.belongsToTenant(n, tenant)
    );

    // Dynamic k based on tenant policy
    const k = this.calculateDynamicK(tenant);

    // Run k-anonymity audit
    const kAnonymity = await this.kAnonymityAudit(
      tenantNodes,
      tenant,
      k
    );

    // Check for suspicious patterns
    const { suspicious, reasons } = await this.detectSuspiciousPatterns(
      tenantNodes,
      tenant,
      fabric
    );

    // Generate recommendation
    const recommendation = this.generateRecommendation(
      kAnonymity,
      suspicious,
      reasons
    );

    return {
      tenantId: tenant.id,
      kAnonymity,
      suspicious,
      suspicionReasons: reasons,
      recommendation,
    };
  }

  /**
   * k-Anonymity audit for tenant
   */
  private async kAnonymityAudit(
    nodes: AnonymizedNode[],
    tenant: Tenant,
    k: number
  ): Promise<KAnonymityResult> {
    // Group nodes by quasi-identifiers (tenant-specific)
    const groups = this.groupByQuasiIdentifiers(nodes, tenant);

    const violations: KAnonymityViolation[] = [];

    // Check each group size
    for (const [identifier, groupNodes] of groups) {
      if (groupNodes.length < k) {
        violations.push({
          identifier,
          groupSize: groupNodes.length,
          minRequired: k,
          severity: this.assessViolationSeverity(
            groupNodes.length,
            k
          ),
          recommendation: this.getKAnonymityRecommendation(
            groupNodes.length,
            k,
            tenant
          ),
        });
      }
    }

    // Calculate privacy score
    const privacyScore = this.calculatePrivacyScore(groups, k);

    return {
      passed: violations.length === 0,
      k,
      totalGroups: groups.size,
      violations,
      privacyScore,
    };
  }

  /**
   * Calculate dynamic k based on tenant policy
   */
  private calculateDynamicK(tenant: Tenant): number {
    // Base k
    const baseK = 5;

    // Adjust based on privacy level
    switch (tenant.privacyLevel) {
      case 'public':
        return Math.max(3, baseK - 2);
      case 'anonymized':
        return baseK;
      case 'encrypted':
        return baseK + 2;
      case 'private':
        return baseK + 5;
      default:
        return baseK;
    }
  }

  /**
   * Group nodes by quasi-identifiers (tenant-specific)
   */
  private groupByQuasiIdentifiers(
    nodes: AnonymizedNode[],
    tenant: Tenant
  ): Map<string, AnonymizedNode[]> {
    const groups = new Map<string, AnonymizedNode[]>();

    nodes.forEach((node) => {
      // Compute quasi-identifier based on tenant policy
      const qi = this.computeQuasiIdentifier(node, tenant);

      if (!groups.has(qi)) {
        groups.set(qi, []);
      }
      groups.get(qi)!.push(node);
    });

    return groups;
  }

  /**
   * Compute quasi-identifier (tenant-specific)
   */
  private computeQuasiIdentifier(
    node: AnonymizedNode,
    tenant: Tenant
  ): string {
    // Default: domain + conceptType + importance range
    const importanceRange = Math.floor(node.importance * 10) / 10;

    let qi = `${node.domain}:${node.conceptType}:${importanceRange}`;

    // Add tenant-specific fields if sharing is enabled
    if (tenant.sharingPolicy.sharePatterns) {
      const termCountRange =
        Math.floor(node.properties.termCount / 5) * 5;
      qi += `:terms${termCountRange}`;
    }

    return qi;
  }

  /**
   * Detect suspicious patterns (malicious node detection)
   */
  private async detectSuspiciousPatterns(
    nodes: AnonymizedNode[],
    tenant: Tenant,
    fabric: KnowledgeFabric
  ): Promise<{ suspicious: boolean; reasons: string[] }> {
    const reasons: string[] = [];

    // Pattern 1: Too many high-importance nodes
    const highImportanceCount = nodes.filter(
      (n) => n.importance > 0.9
    ).length;
    const highImportanceRatio = highImportanceCount / nodes.length;

    if (highImportanceRatio > 0.3) {
      // >30% high-importance
      reasons.push(
        `Excessive high-importance nodes: ${(highImportanceRatio * 100).toFixed(1)}% (threshold: 30%)`
      );
    }

    // Pattern 2: Uniform importance distribution (fake data?)
    const importanceVariance = this.calculateVariance(
      nodes.map((n) => n.importance)
    );

    if (importanceVariance < 0.01) {
      // Very low variance
      reasons.push(
        `Suspiciously uniform importance distribution (variance: ${importanceVariance.toFixed(4)})`
      );
    }

    // Pattern 3: Too many nodes compared to other tenants
    const avgNodesPerTenant = fabric.stats.avgNodesPerTenant;
    if (nodes.length > avgNodesPerTenant * 3) {
      // >3x average
      reasons.push(
        `Excessive node count: ${nodes.length} (avg: ${avgNodesPerTenant.toFixed(0)})`
      );
    }

    // Pattern 4: Privacy level mismatch
    if (
      tenant.privacyLevel === 'private' &&
      tenant.sharingPolicy.shareKnowledgeGraph
    ) {
      reasons.push(
        `Privacy level mismatch: private tenant sharing knowledge`
      );
    }

    return {
      suspicious: reasons.length > 0,
      reasons,
    };
  }

  /**
   * Calculate variance (for distribution analysis)
   */
  private calculateVariance(values: number[]): number {
    const mean =
      values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
    return (
      squaredDiffs.reduce((sum, d) => sum + d, 0) / values.length
    );
  }

  /**
   * Calculate privacy score for tenant
   */
  private calculatePrivacyScore(
    groups: Map<string, AnonymizedNode[]>,
    k: number
  ): number {
    if (groups.size === 0) return 0;

    // Count compliant groups
    const compliantGroups = Array.from(groups.values()).filter(
      (nodes) => nodes.length >= k
    ).length;

    // Base score
    const baseScore = (compliantGroups / groups.size) * 100;

    // Penalty for violations
    const nonCompliantGroups = groups.size - compliantGroups;
    const penalty = nonCompliantGroups * 5; // -5 points per violation

    return Math.max(0, Math.min(100, baseScore - penalty));
  }

  /**
   * Calculate overall score across all tenants
   */
  private calculateOverallScore(
    results: Map<string, PerNodeAuditResult>
  ): number {
    if (results.size === 0) return 0;

    // Average of all tenant scores
    const scores = Array.from(results.values()).map(
      (r) => r.kAnonymity.privacyScore
    );

    const avgScore =
      scores.reduce((sum, s) => sum + s, 0) / scores.length;

    // Penalty for suspicious tenants
    const suspiciousCount = Array.from(results.values()).filter(
      (r) => r.suspicious
    ).length;
    const suspiciousPenalty = suspiciousCount * 10; // -10 points per suspicious

    return Math.max(0, Math.min(100, avgScore - suspiciousPenalty));
  }

  /**
   * Assess violation severity
   */
  private assessViolationSeverity(
    groupSize: number,
    k: number
  ): 'high' | 'medium' | 'low' {
    const ratio = groupSize / k;

    if (ratio < 0.4) return 'high'; // <40% of required
    if (ratio < 0.7) return 'medium'; // <70% of required
    return 'low';
  }

  /**
   * Get k-anonymity recommendation (tenant-specific)
   */
  private getKAnonymityRecommendation(
    groupSize: number,
    k: number,
    tenant: Tenant
  ): string {
    const deficit = k - groupSize;

    if (deficit <= 2) {
      return `Merge with similar groups (need ${deficit} more records) or suppress low-count quasi-identifiers`;
    }

    // Tenant-specific recommendations
    if (tenant.privacyLevel === 'public') {
      return 'Consider upgrading privacy level to "anonymized" or reduce shared data granularity';
    }

    return 'Generalize quasi-identifiers or reduce importance precision to increase group sizes';
  }

  /**
   * Generate overall recommendation
   */
  private generateRecommendation(
    kAnonymity: KAnonymityResult,
    suspicious: boolean,
    reasons: string[]
  ): string {
    if (kAnonymity.passed && !suspicious) {
      return 'Privacy compliance excellent. Continue current measures.';
    }

    const recommendations: string[] = [];

    // k-anonymity recommendations
    if (!kAnonymity.passed) {
      recommendations.push(
        `k-anonymity violations: ${kAnonymity.violations.length}. ${kAnonymity.violations[0]?.recommendation || 'Increase anonymization'}`
      );
    }

    // Suspicious pattern recommendations
    if (suspicious) {
      recommendations.push(
        `Suspicious patterns detected: ${reasons.join('; ')}. Review tenant data quality and privacy settings.`
      );
    }

    return recommendations.join(' | ');
  }

  /**
   * Alert violation
   */
  private async alertViolation(
    tenant: Tenant,
    result: PerNodeAuditResult
  ): Promise<void> {
    console.warn(
      `⚠️ [PerNodeAudit] Privacy violation for tenant: ${tenant.name} (${tenant.id})`
    );

    if (!result.kAnonymity.passed) {
      console.warn(
        `   k-anonymity: ${result.kAnonymity.violations.length} violation(s)`
      );
      console.warn(
        `   Privacy score: ${result.kAnonymity.privacyScore.toFixed(1)}`
      );
    }

    if (result.suspicious) {
      console.warn(
        `   Suspicious: ${result.suspicionReasons.join(', ')}`
      );
    }

    console.warn(`   Recommendation: ${result.recommendation}`);

    // In production: Send to monitoring/alerting system
  }

  /**
   * Check if node belongs to tenant (when tenantId not set)
   */
  private belongsToTenant(
    node: AnonymizedNode,
    tenant: Tenant
  ): boolean {
    // If tenantId is set, use it
    if (node.tenantId) {
      return node.tenantId === tenant.id;
    }

    // Otherwise, use domain matching (heuristic)
    return node.domain === tenant.domain;
  }
}

/**
 * Default singleton instance
 */
export const perNodePrivacyAuditor = new PerNodePrivacyAuditor();
