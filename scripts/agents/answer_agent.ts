/**
 * Answer Agent
 * Second stage in Evidence → Answer → Audit chain
 * Generates answers based on evidence from Evidence Agent
 */

import { BaseAgent, AgentContext, AgentResult } from "./base_agent";
import { callAnthropic } from "../clients/anthropic_adapter";
import { EvidenceOutput } from "./evidence_agent";
import { calculateAlignment } from "../lib/contrastive-alignment.js";

export interface AnswerInput {
  question: string;
  evidence: EvidenceOutput;
  answer_style?: "comprehensive" | "focused" | "conservative";
  max_answer_length?: number;
  include_citations?: boolean;
}

export interface AnswerOutput {
  answer: {
    text: string;
    confidence_score: number;
    answer_type: "direct" | "inferred" | "partial" | "uncertain";
    citations: Array<{
      source: string;
      relevance: number;
      quote: string;
      // NEW: Enhanced citation tracking
      evidence_idx?: number; // Index in evidence array
      alignment_score?: number; // Semantic similarity score
      span_in_answer?: string; // Actual text span that uses this citation
    }>;
  };
  reasoning: {
    evidence_used: number;
    evidence_quality: "high" | "medium" | "low";
    logical_chain: string[];
    gaps_identified: string[];
  };
  metadata: {
    generation_strategy: string;
    fallback_applied: boolean;
    answer_length: number;
    processing_notes: string[];
    // NEW: Citation quality metrics
    citation_coverage?: number; // % of answer backed by citations
    avg_alignment_score?: number; // Average semantic alignment
  };
}

export class AnswerAgent extends BaseAgent {
  constructor(context: AgentContext) {
    super(context);
  }

  async execute(input: AnswerInput): Promise<AgentResult> {
    const validation = this.validateInput(input);
    if (!validation.valid) {
      return this.createResult({
        success: false,
        error: {
          type: "invalid_input",
          message: validation.error!,
          retryable: false,
        },
        cost_usd: 0,
      });
    }

    try {
      // Determine generation strategy based on evidence quality and hints
      const strategy = this.determineGenerationStrategy(input);

      // Generate answer using the selected strategy
      const answerResult = await this.generateAnswer(input, strategy);

      // Validate and enhance the generated answer
      const enhancedAnswer = await this.enhanceAnswer(
        input.question,
        answerResult,
        input.evidence,
      );

      const output: AnswerOutput = {
        answer: enhancedAnswer.answer,
        reasoning: enhancedAnswer.reasoning,
        metadata: {
          generation_strategy: strategy.name,
          fallback_applied: false,
          answer_length: enhancedAnswer.answer.text.length,
          processing_notes: strategy.notes,
        },
      };

      return this.createResult({
        success: true,
        data: output,
        cost_usd: answerResult.cost + (enhancedAnswer.enhancement_cost || 0),
        tokens_used: {
          input: answerResult.tokens_used.input,
          output: answerResult.tokens_used.output,
        },
        checkpoint: {
          stage: "answer_complete",
          progress: 1.0,
          resumable_state: {
            strategy: strategy.name,
            answer_length: enhancedAnswer.answer.text.length,
          },
        },
      });
    } catch (error) {
      return this.createResult({
        success: false,
        error: {
          type: "answer_generation_failed",
          message: String(error),
          retryable: true,
        },
        cost_usd: 0,
      });
    }
  }

  async executeFallback(input: AnswerInput): Promise<AgentResult> {
    try {
      // Simple template-based answer generation
      const fallbackAnswer = this.generateFallbackAnswer(input);

      const output: AnswerOutput = {
        answer: {
          text: fallbackAnswer.text,
          confidence_score: 0.6, // Lower confidence for fallback
          answer_type: "uncertain",
          citations: fallbackAnswer.citations,
        },
        reasoning: {
          evidence_used: Math.min(3, input.evidence.evidence_items.length),
          evidence_quality: "medium",
          logical_chain: [
            "Template-based generation due to budget constraints",
          ],
          gaps_identified: ["Limited LLM processing due to fallback mode"],
        },
        metadata: {
          generation_strategy: "template_fallback",
          fallback_applied: true,
          answer_length: fallbackAnswer.text.length,
          processing_notes: ["Fallback mode: template-based answer generation"],
        },
      };

      return this.createResult({
        success: true,
        data: output,
        cost_usd: 0, // No LLM calls in fallback
        fallback_used: true,
        checkpoint: {
          stage: "answer_fallback_complete",
          progress: 1.0,
        },
      });
    } catch (error) {
      return this.createResult({
        success: false,
        error: {
          type: "fallback_failed",
          message: String(error),
          retryable: true,
        },
        cost_usd: 0,
        fallback_used: true,
      });
    }
  }

  private determineGenerationStrategy(input: AnswerInput): {
    name: string;
    approach: string;
    evidence_threshold: number;
    max_tokens: number;
    notes: string[];
  } {
    const evidenceQuality = input.evidence.search_summary.search_confidence;
    const evidenceCount = input.evidence.evidence_items.length;
    const suggestedStrategy =
      input.evidence.next_stage_hints.answer_generation_strategy;

    const notes: string[] = [];

    // Choose strategy based on evidence quality and hints
    if (suggestedStrategy === "comprehensive" && evidenceQuality > 0.8) {
      notes.push(
        "High-quality evidence available, using comprehensive approach",
      );
      return {
        name: "comprehensive",
        approach: "multi_perspective",
        evidence_threshold: 0.6,
        max_tokens: 800,
        notes,
      };
    } else if (suggestedStrategy === "focused" || evidenceQuality > 0.6) {
      notes.push("Moderate evidence quality, using focused approach");
      return {
        name: "focused",
        approach: "best_evidence",
        evidence_threshold: 0.7,
        max_tokens: 500,
        notes,
      };
    } else {
      notes.push("Limited evidence quality, using conservative approach");
      return {
        name: "conservative",
        approach: "cautious_inference",
        evidence_threshold: 0.5,
        max_tokens: 300,
        notes,
      };
    }
  }

  private async generateAnswer(
    input: AnswerInput,
    strategy: any,
  ): Promise<{
    text: string;
    cost: number;
    tokens_used: { input: number; output: number };
    raw_confidence: number;
  }> {
    // Filter evidence based on strategy threshold
    const relevantEvidence = input.evidence.evidence_items.filter(
      (e) => e.relevance_score >= strategy.evidence_threshold,
    );

    // Build context from evidence
    const evidenceContext = relevantEvidence
      .map(
        (e, idx) =>
          `[Evidence ${idx + 1}] ${e.text} (Source: ${e.source}, Relevance: ${e.relevance_score.toFixed(2)})`,
      )
      .join("\n\n");

    const systemPrompt = this.buildSystemPrompt(strategy);
    const userPrompt = `Question: ${input.question}

Available Evidence:
${evidenceContext}

CRITICAL REQUIREMENTS:
1. You MUST reference at least 1-2 pieces of evidence in your answer
2. Each major claim MUST be directly traceable to specific evidence
3. You MUST indicate which evidence number supports each claim (e.g., "According to Evidence 1...")
4. Use specific quotes or close paraphrases from the evidence

QUALITY EXPECTATIONS:
- Answers without clear evidence references will be rejected
- Each evidence reference must be semantically aligned with your claim
- If combining multiple evidence sources, make the connection explicit
- Maintain high confidence only when evidence strongly supports your conclusions

Provide a well-structured, evidence-based answer with clear citations.`;

    const result = await callAnthropic(
      {
        model: "claude-3-5-sonnet-latest",
        max_tokens: strategy.max_tokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        temperature: 0.1, // Low temperature for factual accuracy
      },
      {
        runId: this.context.run_id,
        itemId: this.context.item_id,
        agentRole: "answer",
      },
    );

    if (!result.success || !result.data) {
      throw new Error("Failed to generate answer via LLM");
    }

    return {
      text: result.data.content[0].text,
      cost: result.cost || 0.02,
      tokens_used: result.data.usage
        ? {
            input: result.data.usage.input_tokens,
            output: result.data.usage.output_tokens,
          }
        : { input: 400, output: 200 },
      raw_confidence: this.estimateConfidenceFromText(
        result.data.content[0].text,
      ),
    };
  }

  private buildSystemPrompt(strategy: any): string {
    const basePrompt = `You are an expert analyst providing accurate, evidence-based answers.`;

    switch (strategy.name) {
      case "comprehensive":
        return `${basePrompt}

Instructions:
- Provide a thorough analysis considering multiple perspectives
- Use all relevant evidence to build a complete picture
- Address potential counterarguments or limitations
- Maintain high confidence only when evidence strongly supports conclusions
- Structure your response with clear reasoning chains`;

      case "focused":
        return `${basePrompt}

Instructions:
- Focus on the strongest evidence available
- Provide a clear, direct answer supported by the best evidence
- Acknowledge any significant limitations or uncertainties
- Cite specific evidence for each major claim
- Keep the response focused and well-structured`;

      case "conservative":
        return `${basePrompt}

Instructions:
- Be cautious in drawing conclusions from limited evidence
- Clearly distinguish between what the evidence supports vs. speculation
- Acknowledge uncertainties and gaps in the evidence
- Provide qualified answers that reflect the strength of available evidence
- Avoid overstating confidence beyond what evidence supports`;

      default:
        return basePrompt;
    }
  }

  private async enhanceAnswer(
    _question: string,
    answerResult: any,
    evidence: EvidenceOutput,
  ): Promise<{
    answer: AnswerOutput["answer"];
    reasoning: AnswerOutput["reasoning"];
    enhancement_cost?: number;
  }> {
    // Extract citations using semantic alignment (async)
    const citations = await this.extractCitations(
      answerResult.text,
      evidence.evidence_items,
    );

    const confidenceScore = this.calculateConfidenceScore(
      answerResult.raw_confidence,
      evidence,
    );
    const answerType = this.determineAnswerType(
      confidenceScore,
      citations.length,
    );

    // Calculate citation quality metrics
    const citationCoverage = this.calculateCitationCoverage(
      answerResult.text,
      citations,
    );
    const avgAlignmentScore =
      citations.length > 0
        ? citations.reduce((sum, c) => sum + (c.alignment_score || 0), 0) /
          citations.length
        : 0;

    // Analyze reasoning chain
    const reasoning = await this.analyzeReasoning(answerResult.text, evidence);

    // Store metrics in enhanced answer
    (reasoning as any).citation_coverage = citationCoverage;
    (reasoning as any).avg_alignment_score = avgAlignmentScore;

    return {
      answer: {
        text: answerResult.text,
        confidence_score: confidenceScore,
        answer_type: answerType,
        citations: citations,
      },
      reasoning: reasoning,
      enhancement_cost: 0.005, // Small cost for reasoning analysis
    };
  }

  /**
   * Calculate what % of answer is covered by citations
   */
  private calculateCitationCoverage(
    answerText: string,
    citations: AnswerOutput["answer"]["citations"],
  ): number {
    if (citations.length === 0) return 0;

    const answerWords = new Set(
      answerText
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3),
    );

    const citedWords = new Set<string>();
    citations.forEach((citation) => {
      if (citation.span_in_answer) {
        const words = citation.span_in_answer
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 3);
        words.forEach((w) => citedWords.add(w));
      }
    });

    return answerWords.size > 0 ? citedWords.size / answerWords.size : 0;
  }

  private async extractCitations(
    answerText: string,
    evidenceItems: EvidenceOutput["evidence_items"],
  ): Promise<AnswerOutput["answer"]["citations"]> {
    const citations: AnswerOutput["answer"]["citations"] = [];

    // Use contrastive alignment for semantic citation matching
    for (let idx = 0; idx < evidenceItems.length; idx++) {
      const evidence = evidenceItems[idx];

      // Calculate semantic similarity between answer and evidence
      const alignmentResult = await calculateAlignment(
        answerText,
        evidence.text,
      );

      // Threshold: Include citation if alignment score > 0.3
      if (alignmentResult.score > 0.3) {
        citations.push({
          source: evidence.source,
          relevance: evidence.relevance_score,
          quote:
            evidence.text.substring(0, 100) +
            (evidence.text.length > 100 ? "..." : ""),
          // Enhanced fields
          evidence_idx: idx,
          alignment_score: alignmentResult.score,
          span_in_answer: this.extractRelevantSpan(answerText, evidence.text),
        });
      }
    }

    // Sort by alignment score (best first)
    citations.sort(
      (a, b) => (b.alignment_score || 0) - (a.alignment_score || 0),
    );

    return citations.slice(0, 5); // Limit to top 5 citations
  }

  /**
   * Extract the most relevant span from answer that corresponds to evidence
   */
  private extractRelevantSpan(
    answerText: string,
    evidenceText: string,
  ): string {
    // Find sentences in answer that overlap most with evidence
    const sentences = answerText
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);

    let bestSentence = "";
    let bestSimilarity = 0;

    for (const sentence of sentences) {
      const similarity = this.findTextSimilarity(sentence, evidenceText);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestSentence = sentence;
      }
    }

    return bestSentence || answerText.substring(0, 100);
  }

  private calculateConfidenceScore(
    rawConfidence: number,
    evidence: EvidenceOutput,
  ): number {
    const evidenceQuality = evidence.search_summary.search_confidence;
    const evidenceCount = evidence.evidence_items.length;
    const highQualityEvidence = evidence.evidence_items.filter(
      (e) => e.relevance_score > 0.7,
    ).length;

    // Combine factors to determine overall confidence
    const evidenceFactor = Math.min(evidenceCount / 5, 1.0) * 0.3;
    const qualityFactor = evidenceQuality * 0.4;
    const highQualityFactor = Math.min(highQualityEvidence / 3, 1.0) * 0.3;

    return Math.min(
      rawConfidence * (evidenceFactor + qualityFactor + highQualityFactor),
      1.0,
    );
  }

  private determineAnswerType(
    confidenceScore: number,
    citationCount: number,
  ): AnswerOutput["answer"]["answer_type"] {
    if (confidenceScore > 0.8 && citationCount >= 2) return "direct";
    if (confidenceScore > 0.6 && citationCount >= 1) return "inferred";
    if (confidenceScore > 0.4) return "partial";
    return "uncertain";
  }

  private async analyzeReasoning(
    answer: string,
    evidence: EvidenceOutput,
  ): Promise<AnswerOutput["reasoning"]> {
    // Analyze which evidence was used and identify reasoning gaps
    const usedEvidence = evidence.evidence_items.filter(
      (e) => this.findTextSimilarity(answer, e.text) > 0.2,
    );

    const evidenceQuality =
      usedEvidence.length > 0
        ? usedEvidence.reduce((sum, e) => sum + e.relevance_score, 0) /
            usedEvidence.length >
          0.7
          ? "high"
          : usedEvidence.reduce((sum, e) => sum + e.relevance_score, 0) /
                usedEvidence.length >
              0.5
            ? "medium"
            : "low"
        : "low";

    const logicalChain = this.identifyLogicalChain(answer);
    const gaps = evidence.next_stage_hints.potential_gaps || [];

    return {
      evidence_used: usedEvidence.length,
      evidence_quality: evidenceQuality as "high" | "medium" | "low",
      logical_chain: logicalChain,
      gaps_identified: gaps,
    };
  }

  private generateFallbackAnswer(input: AnswerInput): {
    text: string;
    citations: AnswerOutput["answer"]["citations"];
  } {
    const topEvidence = input.evidence.evidence_items
      .filter((e) => e.relevance_score > 0.4)
      .slice(0, 3);

    let answerText = `Based on the available evidence, regarding the question "${input.question}":\n\n`;

    if (topEvidence.length > 0) {
      answerText += topEvidence
        .map((e, idx) => `${idx + 1}. ${e.text.substring(0, 200)}...`)
        .join("\n\n");

      answerText +=
        "\n\nThis response is generated using available evidence, though with limited processing due to resource constraints.";
    } else {
      answerText +=
        "I apologize, but I cannot provide a comprehensive answer based on the available evidence.";
    }

    const citations = topEvidence.map((e) => ({
      source: e.source,
      relevance: e.relevance_score,
      quote: e.text.substring(0, 100) + "...",
    }));

    return { text: answerText, citations };
  }

  private estimateConfidenceFromText(text: string): number {
    // Simple heuristic to estimate confidence from generated text
    const confidenceIndicators = [
      "clearly",
      "definitely",
      "certainly",
      "without doubt",
      "evidence shows",
      "data indicates",
      "research confirms",
    ];
    const uncertaintyIndicators = [
      "might",
      "could",
      "possibly",
      "uncertain",
      "unclear",
      "appears to",
      "seems to",
      "may indicate",
    ];

    const lowerText = text.toLowerCase();
    const confidenceCount = confidenceIndicators.filter((indicator) =>
      lowerText.includes(indicator),
    ).length;
    const uncertaintyCount = uncertaintyIndicators.filter((indicator) =>
      lowerText.includes(indicator),
    ).length;

    return Math.max(
      0.3,
      Math.min(0.9, 0.6 + confidenceCount * 0.1 - uncertaintyCount * 0.1),
    );
  }

  private findTextSimilarity(text1: string, text2: string): number {
    // Simple word overlap similarity
    const words1 = new Set(
      text1
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3),
    );
    const words2 = new Set(
      text2
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3),
    );

    const intersection = new Set([...words1].filter((w) => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private identifyLogicalChain(answer: string): string[] {
    // Extract logical flow from answer text
    const sentences = answer
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 10);
    return sentences
      .slice(0, 3)
      .map((s, idx) => `Step ${idx + 1}: ${s.trim()}`);
  }

  protected getVersion(): string {
    return "1.0.0-answer";
  }
}
