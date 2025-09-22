/**
 * Audit Agent
 * Third stage in Evidence → Answer → Audit chain
 * Audits answers for quality, accuracy, and completeness
 */

import { BaseAgent, AgentContext, AgentResult } from './base_agent';
import { callAnthropic } from '../clients/anthropic_adapter';
import { EvidenceOutput } from './evidence_agent';
import { AnswerOutput } from './answer_agent';

export interface AuditInput {
  question: string;
  evidence: EvidenceOutput;
  answer: AnswerOutput;
  audit_depth?: 'basic' | 'standard' | 'comprehensive';
  focus_areas?: Array<'accuracy' | 'completeness' | 'clarity' | 'citations' | 'bias'>;
}

export interface AuditOutput {
  overall_score: number; // 0-100
  audit_result: 'PASS' | 'WARN' | 'FAIL';
  dimension_scores: {
    accuracy: number;
    completeness: number;
    clarity: number;
    citation_quality: number;
    bias_assessment: number;
  };
  findings: Array<{
    category: 'strength' | 'weakness' | 'error' | 'suggestion';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    evidence_reference?: string;
    suggested_improvement?: string;
  }>;
  quality_gates: {
    factual_accuracy_gate: boolean;
    evidence_support_gate: boolean;
    citation_integrity_gate: boolean;
    harmful_content_gate: boolean;
  };
  recommendations: {
    answer_revision_needed: boolean;
    evidence_gap_filling: string[];
    quality_improvement_notes: string[];
  };
}

export class AuditAgent extends BaseAgent {
  constructor(context: AgentContext) {
    super(context);
  }

  async execute(input: AuditInput): Promise<AgentResult> {
    const validation = this.validateInput(input);
    if (!validation.valid) {
      return this.createResult({
        success: false,
        error: { type: 'invalid_input', message: validation.error!, retryable: false },
        cost_usd: 0
      });
    }

    try {
      const auditDepth = input.audit_depth || 'standard';
      const focusAreas = input.focus_areas || ['accuracy', 'completeness', 'clarity', 'citations'];

      // Step 1: Perform dimensional analysis
      const dimensionScores = await this.auditDimensions(input, focusAreas);

      // Step 2: Check quality gates
      const qualityGates = await this.checkQualityGates(input);

      // Step 3: Generate detailed findings
      const findings = await this.generateFindings(input, dimensionScores, qualityGates);

      // Step 4: Calculate overall score and result
      const overallScore = this.calculateOverallScore(dimensionScores, qualityGates);
      const auditResult = this.determineAuditResult(overallScore, qualityGates);

      // Step 5: Generate recommendations
      const recommendations = await this.generateRecommendations(input, findings, auditResult);

      const output: AuditOutput = {
        overall_score: overallScore,
        audit_result: auditResult,
        dimension_scores: dimensionScores,
        findings: findings,
        quality_gates: qualityGates,
        recommendations: recommendations
      };

      return this.createResult({
        success: true,
        data: output,
        cost_usd: this.estimateAuditCost(auditDepth, focusAreas.length),
        tokens_used: {
          input: 800,
          output: 400
        },
        checkpoint: {
          stage: 'audit_complete',
          progress: 1.0,
          resumable_state: {
            overall_score: overallScore,
            audit_result: auditResult
          }
        }
      });

    } catch (error) {
      return this.createResult({
        success: false,
        error: {
          type: 'audit_failed',
          message: String(error),
          retryable: true
        },
        cost_usd: 0
      });
    }
  }

  async executeFallback(input: AuditInput): Promise<AgentResult> {
    try {
      // Simplified rule-based audit for fallback mode
      const fallbackAudit = this.performFallbackAudit(input);

      const output: AuditOutput = {
        overall_score: fallbackAudit.score,
        audit_result: fallbackAudit.result,
        dimension_scores: {
          accuracy: fallbackAudit.score * 0.8,
          completeness: fallbackAudit.score * 0.9,
          clarity: fallbackAudit.score * 0.85,
          citation_quality: fallbackAudit.citation_score,
          bias_assessment: 75 // Default neutral assessment
        },
        findings: fallbackAudit.findings,
        quality_gates: {
          factual_accuracy_gate: true,
          evidence_support_gate: fallbackAudit.has_citations,
          citation_integrity_gate: fallbackAudit.has_citations,
          harmful_content_gate: true // Assume safe in fallback
        },
        recommendations: {
          answer_revision_needed: fallbackAudit.result === 'FAIL',
          evidence_gap_filling: fallbackAudit.result === 'FAIL' ? ['Consider additional evidence'] : [],
          quality_improvement_notes: ['Audit performed in fallback mode with limited analysis']
        }
      };

      return this.createResult({
        success: true,
        data: output,
        cost_usd: 0, // No LLM calls in fallback
        fallback_used: true,
        checkpoint: {
          stage: 'audit_fallback_complete',
          progress: 1.0
        }
      });

    } catch (error) {
      return this.createResult({
        success: false,
        error: {
          type: 'fallback_audit_failed',
          message: String(error),
          retryable: true
        },
        cost_usd: 0,
        fallback_used: true
      });
    }
  }

  private async auditDimensions(
    input: AuditInput,
    focusAreas: string[]
  ): Promise<AuditOutput['dimension_scores']> {
    const scores: AuditOutput['dimension_scores'] = {
      accuracy: 0,
      completeness: 0,
      clarity: 0,
      citation_quality: 0,
      bias_assessment: 0
    };

    // Audit accuracy
    if (focusAreas.includes('accuracy')) {
      scores.accuracy = await this.auditAccuracy(input);
    }

    // Audit completeness
    if (focusAreas.includes('completeness')) {
      scores.completeness = await this.auditCompleteness(input);
    }

    // Audit clarity
    if (focusAreas.includes('clarity')) {
      scores.clarity = await this.auditClarity(input);
    }

    // Audit citations
    if (focusAreas.includes('citations')) {
      scores.citation_quality = await this.auditCitations(input);
    }

    // Audit bias
    if (focusAreas.includes('bias')) {
      scores.bias_assessment = await this.auditBias(input);
    }

    return scores;
  }

  private async auditAccuracy(input: AuditInput): Promise<number> {
    const prompt = `Audit the accuracy of this answer against the provided evidence.

Question: ${input.question}
Answer: ${input.answer.answer.text}

Evidence Used:
${input.evidence.evidence_items.map((e, idx) =>
  `${idx + 1}. ${e.text} (Relevance: ${e.relevance_score})`
).join('\n')}

Rate the factual accuracy on a scale of 0-100, considering:
1. Are all claims in the answer supported by evidence?
2. Are there any contradictions with the evidence?
3. Are inferences reasonable and justified?

Respond with only a number between 0 and 100.`;

    try {
      const result = await callAnthropic({
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 50,
        system: 'You are an expert fact-checker. Respond with only a number representing accuracy percentage.',
        messages: [{ role: 'user', content: prompt }]
      }, {
        runId: this.context.run_id,
        itemId: `${this.context.item_id}_accuracy`,
        agentRole: 'audit'
      });

      if (result.success && result.data) {
        const score = parseFloat(result.data.content[0].text.trim());
        return !isNaN(score) ? Math.min(Math.max(score, 0), 100) : 75;
      }
    } catch (error) {
      console.warn(`[AUDIT] Accuracy check failed: ${error}`);
    }

    return 75; // Default score if audit fails
  }

  private async auditCompleteness(input: AuditInput): Promise<number> {
    // Check if answer addresses all aspects of the question
    const questionComplexity = this.analyzeQuestionComplexity(input.question);
    const answerCoverage = this.analyzeAnswerCoverage(input.answer.answer.text, questionComplexity);
    const evidenceUtilization = this.analyzeEvidenceUtilization(input.answer, input.evidence);

    // Combine factors
    return Math.round((answerCoverage * 0.5) + (evidenceUtilization * 0.3) + (questionComplexity.covered * 0.2));
  }

  private async auditClarity(input: AuditInput): Promise<number> {
    const answerText = input.answer.answer.text;

    // Simple heuristics for clarity assessment
    const sentenceCount = answerText.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    const avgSentenceLength = answerText.length / Math.max(sentenceCount, 1);
    const hasStructure = answerText.includes('\n') || /\d+\.\s/.test(answerText);

    let clarityScore = 80; // Base score

    // Adjust based on sentence length (prefer 15-25 words per sentence)
    if (avgSentenceLength < 10 || avgSentenceLength > 40) clarityScore -= 10;

    // Bonus for structure
    if (hasStructure) clarityScore += 10;

    // Check for clear conclusion
    if (answerText.toLowerCase().includes('in conclusion') ||
        answerText.toLowerCase().includes('therefore') ||
        answerText.toLowerCase().includes('in summary')) {
      clarityScore += 5;
    }

    return Math.min(Math.max(clarityScore, 0), 100);
  }

  private async auditCitations(input: AuditInput): Promise<number> {
    const citations = input.answer.answer.citations;
    const evidenceItems = input.evidence.evidence_items;

    if (citations.length === 0) return 20;

    // Check citation quality
    let citationScore = 40; // Base score for having citations

    // Bonus for multiple citations
    citationScore += Math.min(citations.length * 10, 30);

    // Check citation relevance
    const avgRelevance = citations.reduce((sum, c) => sum + c.relevance, 0) / citations.length;
    citationScore += avgRelevance * 30;

    return Math.min(citationScore, 100);
  }

  private async auditBias(input: AuditInput): Promise<number> {
    // Simple bias detection based on language patterns
    const answerText = input.answer.answer.text.toLowerCase();

    const biasIndicators = [
      'always', 'never', 'all', 'none', 'everyone', 'no one',
      'obviously', 'clearly wrong', 'definitely not', 'impossible'
    ];

    const neutralLanguage = [
      'according to', 'evidence suggests', 'data indicates',
      'research shows', 'studies have found', 'appears to be'
    ];

    const biasCount = biasIndicators.filter(indicator => answerText.includes(indicator)).length;
    const neutralCount = neutralLanguage.filter(indicator => answerText.includes(indicator)).length;

    let biasScore = 80; // Start with good score
    biasScore -= biasCount * 10; // Reduce for bias indicators
    biasScore += neutralCount * 5; // Increase for neutral language

    return Math.min(Math.max(biasScore, 0), 100);
  }

  private async checkQualityGates(input: AuditInput): Promise<AuditOutput['quality_gates']> {
    return {
      factual_accuracy_gate: input.answer.answer.confidence_score > 0.6,
      evidence_support_gate: input.answer.answer.citations.length > 0,
      citation_integrity_gate: this.validateCitationIntegrity(input.answer, input.evidence),
      harmful_content_gate: await this.checkHarmfulContent(input.answer.answer.text)
    };
  }

  private async generateFindings(
    input: AuditInput,
    scores: AuditOutput['dimension_scores'],
    gates: AuditOutput['quality_gates']
  ): Promise<AuditOutput['findings']> {
    const findings: AuditOutput['findings'] = [];

    // Check scores for findings
    if (scores.accuracy < 70) {
      findings.push({
        category: 'weakness',
        severity: scores.accuracy < 50 ? 'high' : 'medium',
        description: `Accuracy score is low (${scores.accuracy}/100). Some claims may not be well-supported by evidence.`,
        suggested_improvement: 'Review answer claims against provided evidence and strengthen factual support.'
      });
    }

    if (scores.completeness < 60) {
      findings.push({
        category: 'weakness',
        severity: 'medium',
        description: `Answer may be incomplete (${scores.completeness}/100). Some aspects of the question might not be addressed.`,
        suggested_improvement: 'Ensure all parts of the question are addressed comprehensively.'
      });
    }

    if (scores.citation_quality < 50) {
      findings.push({
        category: 'weakness',
        severity: 'medium',
        description: `Citation quality is low (${scores.citation_quality}/100). Claims need better source attribution.`,
        suggested_improvement: 'Add more specific citations and ensure they support the claims made.'
      });
    }

    // Check quality gates for critical findings
    if (!gates.factual_accuracy_gate) {
      findings.push({
        category: 'error',
        severity: 'high',
        description: 'Answer confidence is too low, indicating potential factual issues.',
        suggested_improvement: 'Verify facts and strengthen evidence base before publication.'
      });
    }

    if (!gates.evidence_support_gate) {
      findings.push({
        category: 'error',
        severity: 'high',
        description: 'Answer lacks proper evidence support and citations.',
        suggested_improvement: 'Add citations to support all major claims in the answer.'
      });
    }

    // Add positive findings for good scores
    if (scores.accuracy > 85) {
      findings.push({
        category: 'strength',
        severity: 'low',
        description: 'Answer demonstrates high factual accuracy with strong evidence support.'
      });
    }

    if (scores.clarity > 80) {
      findings.push({
        category: 'strength',
        severity: 'low',
        description: 'Answer is well-structured and clearly written.'
      });
    }

    return findings;
  }

  private calculateOverallScore(
    scores: AuditOutput['dimension_scores'],
    gates: AuditOutput['quality_gates']
  ): number {
    // Weighted average of dimension scores
    const dimensionScore = (
      scores.accuracy * 0.3 +
      scores.completeness * 0.25 +
      scores.clarity * 0.2 +
      scores.citation_quality * 0.15 +
      scores.bias_assessment * 0.1
    );

    // Apply quality gate penalties
    const gatesPassed = Object.values(gates).filter(Boolean).length;
    const gateMultiplier = gatesPassed / Object.keys(gates).length;

    return Math.round(dimensionScore * gateMultiplier);
  }

  private determineAuditResult(
    overallScore: number,
    gates: AuditOutput['quality_gates']
  ): 'PASS' | 'WARN' | 'FAIL' {
    // Hard fail if critical gates are not passed
    if (!gates.factual_accuracy_gate || !gates.harmful_content_gate) {
      return 'FAIL';
    }

    // Score-based determination
    if (overallScore >= 80) return 'PASS';
    if (overallScore >= 60) return 'WARN';
    return 'FAIL';
  }

  private async generateRecommendations(
    input: AuditInput,
    findings: AuditOutput['findings'],
    result: 'PASS' | 'WARN' | 'FAIL'
  ): Promise<AuditOutput['recommendations']> {
    const highSeverityFindings = findings.filter(f => f.severity === 'high' || f.severity === 'critical');
    const evidenceGaps = input.evidence.next_stage_hints.potential_gaps || [];

    return {
      answer_revision_needed: result === 'FAIL' || highSeverityFindings.length > 0,
      evidence_gap_filling: evidenceGaps,
      quality_improvement_notes: findings
        .filter(f => f.suggested_improvement)
        .map(f => f.suggested_improvement!)
        .slice(0, 5)
    };
  }

  private performFallbackAudit(input: AuditInput): {
    score: number;
    result: 'PASS' | 'WARN' | 'FAIL';
    citation_score: number;
    has_citations: boolean;
    findings: AuditOutput['findings'];
  } {
    const answerText = input.answer.answer.text;
    const citations = input.answer.answer.citations;

    // Basic scoring based on simple metrics
    let score = 60; // Base score

    // Length check
    if (answerText.length > 100) score += 10;
    if (answerText.length > 300) score += 10;

    // Citation check
    const hasCitations = citations.length > 0;
    if (hasCitations) score += 15;
    if (citations.length > 2) score += 10;

    // Confidence check
    if (input.answer.answer.confidence_score > 0.7) score += 10;

    const citationScore = hasCitations ? Math.min(citations.length * 25, 80) : 20;
    const result = score >= 80 ? 'PASS' : score >= 60 ? 'WARN' : 'FAIL';

    const findings: AuditOutput['findings'] = [{
      category: 'suggestion',
      severity: 'low',
      description: 'Audit performed in fallback mode with limited analysis capabilities.'
    }];

    if (!hasCitations) {
      findings.push({
        category: 'weakness',
        severity: 'medium',
        description: 'Answer lacks citations to support claims.'
      });
    }

    return { score, result, citation_score: citationScore, has_citations: hasCitations, findings };
  }

  private analyzeQuestionComplexity(question: string): { aspects: string[]; covered: number } {
    const questionWords = ['what', 'how', 'why', 'when', 'where', 'who', 'which'];
    const aspects = questionWords.filter(word => question.toLowerCase().includes(word));
    return { aspects, covered: 80 }; // Simplified
  }

  private analyzeAnswerCoverage(answer: string, complexity: any): number {
    // Simplified coverage analysis
    return answer.length > 200 ? 85 : answer.length > 100 ? 70 : 50;
  }

  private analyzeEvidenceUtilization(answer: AnswerOutput, evidence: EvidenceOutput): number {
    const citationCount = answer.answer.citations.length;
    const availableEvidence = evidence.evidence_items.length;

    if (availableEvidence === 0) return 50;
    return Math.min((citationCount / availableEvidence) * 100, 100);
  }

  private validateCitationIntegrity(answer: AnswerOutput, evidence: EvidenceOutput): boolean {
    // Check if all citations reference actual evidence
    return answer.answer.citations.every(citation =>
      evidence.evidence_items.some(e => e.source === citation.source)
    );
  }

  private async checkHarmfulContent(text: string): Promise<boolean> {
    // Simple harmful content check (in production, use specialized services)
    const harmfulPatterns = [
      'violence', 'hate', 'discriminat', 'harmful', 'dangerous'
    ];

    const lowerText = text.toLowerCase();
    return !harmfulPatterns.some(pattern => lowerText.includes(pattern));
  }

  private estimateAuditCost(depth: string, dimensionCount: number): number {
    const baseCost = 0.01;
    const depthMultiplier = depth === 'comprehensive' ? 2 : depth === 'standard' ? 1.5 : 1;
    const dimensionMultiplier = dimensionCount / 5;

    return baseCost * depthMultiplier * dimensionMultiplier;
  }

  protected getVersion(): string {
    return '1.0.0-audit';
  }
}