/**
 * Digest Summarizer (Genius Insight #3)
 *
 * "성능은 측정 구조의 함수다" - ChatGPT Master Insight
 *
 * 핵심 통찰:
 * - Technical metrics → Business insights transformation
 * - Policy changes → Natural language explanations
 * - Evidence chains → User-friendly narratives
 * - Measurement structure drives improvement
 *
 * Architecture:
 * This is NOT just summarization - it's MEASUREMENT-TO-INSIGHT
 * TRANSFORMATION that enables Human-in-the-Loop (HIL) decision making.
 *
 * 3-Layer Transformation:
 * 1. Technical → Business: Metrics → KPI insights
 * 2. Policy → Natural: Rule changes → Plain language
 * 3. Evidence → Narrative: Source chains → Coherent stories
 *
 * Expected Gain: HIL readiness, Decision confidence ↑, Trust visibility
 *
 * @see ChatGPT Master Directive: "Measurement Structure = Performance Function"
 */

import type { ProvenanceMetadata } from '../provenance-tracker';
import type { UserIntent, SystemParameters } from '../types';

/**
 * Digest configuration
 */
export interface DigestConfig {
  style: 'executive' | 'technical' | 'legal' | 'user-friendly';
  maxLength: number; // Max character length
  includeEvidence: boolean;
  includeMetrics: boolean;
  includeRecommendations: boolean;
}

const DEFAULT_CONFIG: DigestConfig = {
  style: 'executive',
  maxLength: 1000,
  includeEvidence: true,
  includeMetrics: true,
  includeRecommendations: true,
};

/**
 * Digest output
 */
export interface Digest {
  summary: string;
  keyInsights: string[];
  evidenceNarrative?: string;
  metricsSnapshot?: Record<string, string>;
  recommendations?: string[];
  metadata: {
    generatedAt: Date;
    style: string;
    confidence: number;
  };
}

/**
 * Policy change digest
 */
export interface PolicyChangeDigest {
  before: string; // Natural language description of old policy
  after: string; // Natural language description of new policy
  rationale: string; // Why the change was made
  impact: string; // Expected impact
  confidence: number;
}

/**
 * Evidence digest
 */
export interface EvidenceDigest {
  narrative: string; // Coherent story from evidence chain
  sources: Array<{
    name: string;
    trustScore: number;
    contribution: string;
  }>;
  confidence: number;
}

/**
 * Digest Summarizer
 *
 * Transforms technical data into human-readable insights.
 */
export class DigestSummarizer {
  private config: DigestConfig;

  constructor(config: Partial<DigestConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate complete digest from provenance
   *
   * GENIUS INSIGHT: Measurement → Insight transformation
   */
  async generateDigest(
    provenance: ProvenanceMetadata,
    content: string,
    systemParams?: SystemParameters
  ): Promise<Digest> {
    // Layer 1: Technical → Business
    const keyInsights = this.extractKeyInsights(provenance, systemParams);

    // Layer 2: Build summary
    const summary = this.buildSummary(provenance, content, keyInsights);

    // Layer 3: Evidence narrative
    const evidenceNarrative = this.config.includeEvidence
      ? await this.buildEvidenceNarrative(provenance)
      : undefined;

    // Layer 4: Metrics snapshot
    const metricsSnapshot = this.config.includeMetrics
      ? this.buildMetricsSnapshot(provenance)
      : undefined;

    // Layer 5: Recommendations
    const recommendations = this.config.includeRecommendations
      ? this.generateRecommendations(provenance, systemParams)
      : undefined;

    return {
      summary,
      keyInsights,
      evidenceNarrative,
      metricsSnapshot,
      recommendations,
      metadata: {
        generatedAt: new Date(),
        style: this.config.style,
        confidence: this.computeOverallConfidence(provenance),
      },
    };
  }

  /**
   * Layer 1: Extract key insights (Technical → Business)
   *
   * Transforms technical metrics into actionable business insights.
   */
  private extractKeyInsights(
    provenance: ProvenanceMetadata,
    systemParams?: SystemParameters
  ): string[] {
    const insights: string[] = [];

    // Insight 1: Evidence quality
    const avgTrustScore =
      provenance.trustScores.reduce((sum, s) => sum + s, 0) / provenance.trustScores.length || 0;

    if (avgTrustScore >= 0.8) {
      insights.push(
        `High-quality evidence (${(avgTrustScore * 100).toFixed(0)}% trust score) from ${provenance.evidenceIds.length} sources`
      );
    } else if (avgTrustScore >= 0.6) {
      insights.push(
        `Moderate evidence quality (${(avgTrustScore * 100).toFixed(0)}% trust) - recommend additional sources`
      );
    } else {
      insights.push(
        `Low evidence quality (${(avgTrustScore * 100).toFixed(0)}% trust) - verification required`
      );
    }

    // Insight 2: Verification status
    if (provenance.nliVerified) {
      insights.push('All claims verified against evidence (NLI entailment check passed)');
    } else {
      insights.push('Verification incomplete - some claims may lack evidence support');
    }

    // Insight 3: Citation density
    const citationDensity = provenance.citationCount / (provenance.evidenceIds.length || 1);
    if (citationDensity >= 0.8) {
      insights.push('Comprehensive citations (high traceability)');
    } else if (citationDensity >= 0.5) {
      insights.push('Moderate citation coverage');
    } else {
      insights.push('Limited citations - consider adding more references');
    }

    // Insight 4: Intent-driven adjustments
    if (systemParams?.retrieval) {
      insights.push(
        `Retrieval tuned for "${provenance.intent || 'general'}" intent (α=${systemParams.retrieval.alpha?.toFixed(2)})`
      );
    }

    return insights;
  }

  /**
   * Layer 2: Build summary based on style
   */
  private buildSummary(
    provenance: ProvenanceMetadata,
    content: string,
    keyInsights: string[]
  ): string {
    switch (this.config.style) {
      case 'executive':
        return this.buildExecutiveSummary(provenance, keyInsights);

      case 'technical':
        return this.buildTechnicalSummary(provenance, content);

      case 'legal':
        return this.buildLegalSummary(provenance);

      case 'user-friendly':
      default:
        return this.buildUserFriendlySummary(provenance, keyInsights);
    }
  }

  /**
   * Executive summary (for business stakeholders)
   */
  private buildExecutiveSummary(
    provenance: ProvenanceMetadata,
    keyInsights: string[]
  ): string {
    const avgTrust =
      provenance.trustScores.reduce((sum, s) => sum + s, 0) / provenance.trustScores.length || 0;

    return `Generated with ${(avgTrust * 100).toFixed(0)}% confidence from ${provenance.evidenceIds.length} trusted sources. ${provenance.nliVerified ? 'All claims verified.' : 'Partial verification.'} ${keyInsights[0] || ''}`;
  }

  /**
   * Technical summary (for engineers/analysts)
   */
  private buildTechnicalSummary(provenance: ProvenanceMetadata, content: string): string {
    return `Run ID: ${provenance.runId}
Evidence: ${provenance.evidenceIds.length} sources (avg trust: ${(provenance.trustScores.reduce((sum, s) => sum + s, 0) / provenance.trustScores.length).toFixed(3)})
Citations: ${provenance.citationCount}
NLI Verified: ${provenance.nliVerified ? 'Yes' : 'No'}
Timestamp: ${provenance.timestamp.toISOString()}`;
  }

  /**
   * Legal summary (for compliance/audit)
   */
  private buildLegalSummary(provenance: ProvenanceMetadata): string {
    return `AUDIT TRAIL - Run ${provenance.runId} at ${provenance.timestamp.toISOString()}.
Evidence chain: ${provenance.evidenceHashes.length} SHA-256 hashes verified.
${provenance.trustToken ? `Trust token: ${provenance.trustToken.substring(0, 50)}...` : 'No trust token'}
${provenance.snapshotId ? `Snapshot ID: ${provenance.snapshotId}` : 'No snapshot'}
Policy version: ${provenance.policyVersion || 'N/A'}`;
  }

  /**
   * User-friendly summary (for end users)
   */
  private buildUserFriendlySummary(
    provenance: ProvenanceMetadata,
    keyInsights: string[]
  ): string {
    const trustLevel =
      provenance.trustScores.reduce((sum, s) => sum + s, 0) / provenance.trustScores.length || 0;

    const trustLabel = trustLevel >= 0.8 ? 'high' : trustLevel >= 0.6 ? 'moderate' : 'low';

    return `This answer is based on ${provenance.evidenceIds.length} ${trustLabel}-confidence sources. ${keyInsights.slice(0, 2).join('. ')}.`;
  }

  /**
   * Layer 3: Build evidence narrative
   *
   * Transforms evidence chain into coherent story.
   */
  private async buildEvidenceNarrative(provenance: ProvenanceMetadata): Promise<string> {
    if (provenance.evidenceIds.length === 0) {
      return 'No evidence sources available.';
    }

    const sourceCount = provenance.evidenceIds.length;
    const avgTrust =
      provenance.trustScores.reduce((sum, s) => sum + s, 0) / provenance.trustScores.length;

    const narrative = `Drawing from ${sourceCount} source${sourceCount > 1 ? 's' : ''} with ${(avgTrust * 100).toFixed(0)}% average trust score, this response synthesizes ${provenance.citationCount} citation${provenance.citationCount !== 1 ? 's' : ''}. ${provenance.nliVerified ? 'All statements are verified to be entailed by the evidence.' : 'Some statements may require additional verification.'}`;

    return narrative;
  }

  /**
   * Layer 4: Build metrics snapshot
   */
  private buildMetricsSnapshot(provenance: ProvenanceMetadata): Record<string, string> {
    const avgTrust =
      provenance.trustScores.reduce((sum, s) => sum + s, 0) / provenance.trustScores.length || 0;

    return {
      'Run ID': provenance.runId,
      'Evidence Sources': provenance.evidenceIds.length.toString(),
      'Average Trust Score': `${(avgTrust * 100).toFixed(1)}%`,
      'Citations': provenance.citationCount.toString(),
      'NLI Verified': provenance.nliVerified ? 'Yes' : 'No',
      'Intent Confidence': provenance.intentConfidence
        ? `${(provenance.intentConfidence * 100).toFixed(0)}%`
        : 'N/A',
      Timestamp: provenance.timestamp.toISOString(),
    };
  }

  /**
   * Layer 5: Generate recommendations
   */
  private generateRecommendations(
    provenance: ProvenanceMetadata,
    systemParams?: SystemParameters
  ): string[] {
    const recommendations: string[] = [];

    // Recommendation 1: Trust score improvement
    const avgTrust =
      provenance.trustScores.reduce((sum, s) => sum + s, 0) / provenance.trustScores.length || 0;

    if (avgTrust < 0.7) {
      recommendations.push(
        'Consider adding higher-quality sources to improve trust score (current: ' +
          (avgTrust * 100).toFixed(0) +
          '%)'
      );
    }

    // Recommendation 2: NLI verification
    if (!provenance.nliVerified) {
      recommendations.push('Enable NLI verification to ensure all claims are evidence-backed');
    }

    // Recommendation 3: Citation density
    const citationDensity = provenance.citationCount / (provenance.evidenceIds.length || 1);
    if (citationDensity < 0.5) {
      recommendations.push('Increase citation density for better traceability');
    }

    // Recommendation 4: Evidence diversity
    if (provenance.evidenceIds.length < 3) {
      recommendations.push('Add more diverse sources to improve coverage and reduce bias');
    }

    return recommendations;
  }

  /**
   * Compute overall confidence
   */
  private computeOverallConfidence(provenance: ProvenanceMetadata): number {
    const avgTrust =
      provenance.trustScores.reduce((sum, s) => sum + s, 0) / provenance.trustScores.length || 0;
    const nliBonus = provenance.nliVerified ? 0.1 : 0;
    const citationBonus =
      provenance.citationCount / (provenance.evidenceIds.length || 1) >= 0.8 ? 0.05 : 0;

    return Math.min(1.0, avgTrust + nliBonus + citationBonus);
  }

  /**
   * Generate policy change digest
   *
   * GENIUS INSIGHT: Policy → Natural language transformation
   */
  async generatePolicyChangeDigest(
    beforeParams: SystemParameters,
    afterParams: SystemParameters,
    intent: UserIntent,
    confidence: number
  ): Promise<PolicyChangeDigest> {
    // Build before description
    const before = this.describeSystemParameters(beforeParams);

    // Build after description
    const after = this.describeSystemParameters(afterParams);

    // Build rationale
    const rationale = this.buildRationale(intent, confidence);

    // Build impact
    const impact = this.buildImpact(beforeParams, afterParams);

    return {
      before,
      after,
      rationale,
      impact,
      confidence,
    };
  }

  /**
   * Describe system parameters in natural language
   */
  private describeSystemParameters(params: SystemParameters): string {
    const parts: string[] = [];

    if (params.retrieval) {
      parts.push(
        `Retrieval: ${(params.retrieval.alpha ?? 0.6) * 100}% BM25, ${(params.retrieval.beta ?? 0.4) * 100}% vector, top-${params.retrieval.topK ?? 10} results`
      );
    }

    if (params.operators && params.operators.length > 0) {
      parts.push(`Operators: ${params.operators.join(', ')}`);
    }

    if (params.gcg) {
      const constraints: string[] = [];
      if (params.gcg.citationMandatory) constraints.push('citations required');
      if (params.gcg.structureFormat) constraints.push(`${params.gcg.structureFormat} format`);
      if (constraints.length > 0) {
        parts.push(`Constraints: ${constraints.join(', ')}`);
      }
    }

    return parts.join('; ') || 'Default settings';
  }

  /**
   * Build rationale for policy change
   */
  private buildRationale(intent: UserIntent, confidence: number): string {
    const intentDescriptions: Record<UserIntent, string> = {
      incorrect: 'User reported factual incorrectness requiring higher trust sources',
      insufficient: 'User requested more detailed information and context',
      evidence: 'User requested more sources and citations',
      brevity: 'User requested shorter, more concise response',
      contrast: 'User requested alternative perspectives and contrasts',
      lexicon: 'User reported incorrect terminology or jargon',
      structure: 'User requested different structure or format',
      coverage: 'User reported missing aspects or incomplete coverage',
      tone: 'User reported inappropriate tone or style',
      other: 'User provided general feedback',
    };

    return `${intentDescriptions[intent] || 'User feedback received'} (confidence: ${(confidence * 100).toFixed(0)}%)`;
  }

  /**
   * Build impact statement
   */
  private buildImpact(beforeParams: SystemParameters, afterParams: SystemParameters): string {
    const impacts: string[] = [];

    // Retrieval impact
    if (beforeParams.retrieval && afterParams.retrieval) {
      const alphaDelta = (afterParams.retrieval.alpha ?? 0.6) - (beforeParams.retrieval.alpha ?? 0.6);
      if (Math.abs(alphaDelta) > 0.05) {
        impacts.push(
          alphaDelta > 0
            ? 'Increased emphasis on keyword matching'
            : 'Increased emphasis on semantic similarity'
        );
      }
    }

    // Operator impact
    if (afterParams.operators && afterParams.operators.length > 0) {
      impacts.push(`Activated ${afterParams.operators.length} quality operators`);
    }

    // Constraint impact
    if (afterParams.gcg?.citationMandatory && !beforeParams.gcg?.citationMandatory) {
      impacts.push('Enforced mandatory citations for traceability');
    }

    return impacts.length > 0
      ? `Expected impact: ${impacts.join('; ')}`
      : 'Minimal parameter changes';
  }

  /**
   * Get configuration
   */
  getConfig(): DigestConfig {
    return this.config;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<DigestConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Default singleton instance
 */
export const digestSummarizer = new DigestSummarizer();
