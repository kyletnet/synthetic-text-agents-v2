/**
 * Evidence Agent
 * First stage in Evidence → Answer → Audit chain
 * Searches and retrieves relevant evidence for question answering
 */

import { BaseAgent, AgentContext, AgentResult } from './base_agent';
import { callAnthropic } from '../clients/anthropic_adapter';

export interface EvidenceInput {
  question: string;
  context_documents?: string[];
  search_depth?: 'shallow' | 'deep';
  max_evidence_items?: number;
}

export interface EvidenceOutput {
  evidence_items: Array<{
    text: string;
    source: string;
    relevance_score: number;
    evidence_type: 'direct' | 'contextual' | 'background';
  }>;
  search_summary: {
    total_sources_searched: number;
    evidence_items_found: number;
    search_depth_used: string;
    search_confidence: number;
  };
  next_stage_hints: {
    primary_evidence_focus: string;
    answer_generation_strategy: string;
    potential_gaps: string[];
  };
}

export class EvidenceAgent extends BaseAgent {
  constructor(context: AgentContext) {
    super(context);
  }

  async execute(input: EvidenceInput): Promise<AgentResult> {
    const validation = this.validateInput(input);
    if (!validation.valid) {
      return this.createResult({
        success: false,
        error: { type: 'invalid_input', message: validation.error!, retryable: false },
        cost_usd: 0
      });
    }

    try {
      // Deep search mode
      const searchDepth = input.search_depth || 'deep';
      const maxItems = input.max_evidence_items || 10;

      // Step 1: Analyze question to determine search strategy
      const searchStrategy = await this.analyzeSearchStrategy(input.question);

      // Step 2: Execute evidence search
      const evidenceItems = await this.searchEvidence(
        input.question,
        input.context_documents || [],
        searchStrategy,
        maxItems
      );

      // Step 3: Score and rank evidence
      const rankedEvidence = await this.scoreAndRankEvidence(input.question, evidenceItems);

      // Step 4: Generate hints for next stage
      const nextStageHints = this.generateAnswerHints(input.question, rankedEvidence);

      const output: EvidenceOutput = {
        evidence_items: rankedEvidence,
        search_summary: {
          total_sources_searched: input.context_documents?.length || 0,
          evidence_items_found: rankedEvidence.length,
          search_depth_used: searchDepth,
          search_confidence: this.calculateSearchConfidence(rankedEvidence)
        },
        next_stage_hints: nextStageHints
      };

      return this.createResult({
        success: true,
        data: output,
        cost_usd: searchStrategy.estimated_cost,
        tokens_used: searchStrategy.tokens_used,
        checkpoint: {
          stage: 'evidence_complete',
          progress: 1.0,
          resumable_state: { evidence_count: rankedEvidence.length }
        }
      });

    } catch (error) {
      return this.createResult({
        success: false,
        error: {
          type: 'evidence_search_failed',
          message: String(error),
          retryable: true
        },
        cost_usd: 0
      });
    }
  }

  async executeFallback(input: EvidenceInput): Promise<AgentResult> {
    // Simple fallback: basic keyword matching without LLM scoring
    try {
      const keywords = this.extractKeywords(input.question);
      const simpleEvidence = this.performKeywordSearch(
        keywords,
        input.context_documents || [],
        3 // Reduced item count for fallback
      );

      const output: EvidenceOutput = {
        evidence_items: simpleEvidence.map((item, idx) => ({
          text: item.text,
          source: item.source,
          relevance_score: 0.5 - (idx * 0.1), // Simple descending score
          evidence_type: 'contextual' as const
        })),
        search_summary: {
          total_sources_searched: input.context_documents?.length || 0,
          evidence_items_found: simpleEvidence.length,
          search_depth_used: 'shallow',
          search_confidence: 0.6 // Lower confidence for fallback
        },
        next_stage_hints: {
          primary_evidence_focus: keywords.join(', '),
          answer_generation_strategy: 'conservative',
          potential_gaps: ['Limited evidence depth due to fallback mode']
        }
      };

      return this.createResult({
        success: true,
        data: output,
        cost_usd: 0, // No LLM calls in fallback
        fallback_used: true,
        checkpoint: {
          stage: 'evidence_fallback_complete',
          progress: 1.0
        }
      });

    } catch (error) {
      return this.createResult({
        success: false,
        error: {
          type: 'fallback_failed',
          message: String(error),
          retryable: true
        },
        cost_usd: 0,
        fallback_used: true
      });
    }
  }

  private async analyzeSearchStrategy(question: string): Promise<{
    strategy: string;
    focus_areas: string[];
    estimated_cost: number;
    tokens_used: { input: number; output: number };
  }> {
    const prompt = `Analyze this question and determine the optimal evidence search strategy:

Question: "${question}"

Provide a JSON response with:
1. strategy: "broad_search", "targeted_search", or "multi_faceted_search"
2. focus_areas: Array of key areas to search for evidence
3. search_keywords: Most important keywords for evidence retrieval

Response format: {"strategy": "...", "focus_areas": [...], "search_keywords": [...]}`;

    const result = await callAnthropic({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: 300,
      system: 'You are an expert research strategist. Provide concise, actionable search strategies.',
      messages: [{ role: 'user', content: prompt }]
    }, {
      runId: this.context.run_id,
      itemId: this.context.item_id,
      agentRole: 'evidence'
    });

    if (result.success && result.data) {
      try {
        const strategy = JSON.parse(result.data.content[0].text);
        return {
          ...strategy,
          estimated_cost: result.cost || 0.01,
          tokens_used: result.data.usage ?
            { input: result.data.usage.input_tokens, output: result.data.usage.output_tokens } :
            { input: 100, output: 50 }
        };
      } catch (parseError) {
        // Fallback if JSON parsing fails
        return {
          strategy: 'broad_search',
          focus_areas: [question.split(' ').slice(0, 3).join(' ')],
          estimated_cost: result.cost || 0.01,
          tokens_used: result.data.usage ?
            { input: result.data.usage.input_tokens, output: result.data.usage.output_tokens } :
            { input: 100, output: 50 }
        };
      }
    }

    throw new Error('Failed to analyze search strategy');
  }

  private async searchEvidence(
    question: string,
    documents: string[],
    strategy: any,
    maxItems: number
  ): Promise<Array<{ text: string; source: string }>> {
    // Simple mock implementation for evidence search
    // In a real implementation, this would use vector search, BM25, or other retrieval methods

    const evidenceItems: Array<{ text: string; source: string }> = [];
    const focusAreas = strategy.focus_areas || [question];

    for (let i = 0; i < Math.min(maxItems, documents.length * 2); i++) {
      const sourceIdx = i % documents.length;
      const focusIdx = i % focusAreas.length;

      evidenceItems.push({
        text: `Evidence ${i + 1}: Content related to "${focusAreas[focusIdx]}" from source ${sourceIdx + 1}. This is simulated evidence for testing purposes.`,
        source: `document_${sourceIdx + 1}`
      });
    }

    return evidenceItems;
  }

  private async scoreAndRankEvidence(
    question: string,
    evidenceItems: Array<{ text: string; source: string }>
  ): Promise<EvidenceOutput['evidence_items']> {
    // Score evidence relevance using LLM
    const scoredItems: EvidenceOutput['evidence_items'] = [];

    for (const item of evidenceItems) {
      const prompt = `Rate the relevance of this evidence to the question on a scale of 0.0 to 1.0:

Question: "${question}"
Evidence: "${item.text}"

Provide only a number between 0.0 and 1.0 representing relevance.`;

      try {
        const result = await callAnthropic({
          model: 'claude-3-5-sonnet-latest',
          max_tokens: 50,
          system: 'You are an expert at evaluating evidence relevance. Respond with only a number.',
          messages: [{ role: 'user', content: prompt }]
        }, {
          runId: this.context.run_id,
          itemId: `${this.context.item_id}_evidence_scoring`,
          agentRole: 'evidence'
        });

        let relevanceScore = 0.5; // Default score
        if (result.success && result.data) {
          const scoreText = result.data.content[0].text.trim();
          const parsedScore = parseFloat(scoreText);
          if (!isNaN(parsedScore) && parsedScore >= 0 && parsedScore <= 1) {
            relevanceScore = parsedScore;
          }
        }

        scoredItems.push({
          text: item.text,
          source: item.source,
          relevance_score: relevanceScore,
          evidence_type: relevanceScore > 0.7 ? 'direct' :
                        relevanceScore > 0.4 ? 'contextual' : 'background'
        });

      } catch (error) {
        // Fallback scoring if LLM call fails
        scoredItems.push({
          text: item.text,
          source: item.source,
          relevance_score: 0.5,
          evidence_type: 'contextual'
        });
      }
    }

    // Sort by relevance score (highest first)
    return scoredItems.sort((a, b) => b.relevance_score - a.relevance_score);
  }

  private generateAnswerHints(
    question: string,
    evidence: EvidenceOutput['evidence_items']
  ): EvidenceOutput['next_stage_hints'] {
    const highQualityEvidence = evidence.filter(e => e.relevance_score > 0.6);
    const evidenceTypes = [...new Set(evidence.map(e => e.evidence_type))];

    return {
      primary_evidence_focus: highQualityEvidence.length > 0 ?
        `Focus on ${highQualityEvidence.length} high-relevance evidence items` :
        'Use available contextual evidence with caution',
      answer_generation_strategy: highQualityEvidence.length >= 3 ? 'comprehensive' :
                                 highQualityEvidence.length >= 1 ? 'focused' : 'conservative',
      potential_gaps: evidence.length < 3 ? ['Limited evidence available'] :
                     !evidenceTypes.includes('direct') ? ['No direct evidence found'] : []
    };
  }

  private calculateSearchConfidence(evidence: EvidenceOutput['evidence_items']): number {
    if (evidence.length === 0) return 0;

    const avgRelevance = evidence.reduce((sum, e) => sum + e.relevance_score, 0) / evidence.length;
    const highQualityCount = evidence.filter(e => e.relevance_score > 0.7).length;
    const diversityBonus = Math.min(evidence.length / 5, 0.2); // Bonus for diversity

    return Math.min(avgRelevance + (highQualityCount * 0.1) + diversityBonus, 1.0);
  }

  private extractKeywords(question: string): string[] {
    // Simple keyword extraction for fallback mode
    const stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'what', 'how', 'why', 'when', 'where']);
    return question.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 5);
  }

  private performKeywordSearch(
    keywords: string[],
    documents: string[],
    maxItems: number
  ): Array<{ text: string; source: string }> {
    const results: Array<{ text: string; source: string }> = [];

    for (let i = 0; i < Math.min(maxItems, documents.length); i++) {
      results.push({
        text: `Keyword-based evidence for "${keywords.join(', ')}" from document ${i + 1}`,
        source: `document_${i + 1}`
      });
    }

    return results;
  }

  protected getVersion(): string {
    return '1.0.0-evidence';
  }
}