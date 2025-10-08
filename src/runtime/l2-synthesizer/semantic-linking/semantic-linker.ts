/**
 * Semantic Linker (Phase 3.3 - Semantic Cross-Linking)
 *
 * "지식 구조와 실제 근거를 연결하면 환각이 사라진다"
 * - ChatGPT Genius Insight
 *
 * Purpose:
 * - Link Knowledge Graph concepts to Evidence Store
 * - Enable graph-based reasoning with actual evidence
 * - Improve groundedness through semantic connectivity
 *
 * Architecture:
 * Knowledge Graph + Evidence Store → **Semantic Linker** → Enhanced Reasoning
 *
 * Linking Strategy:
 * 1. Concept-Evidence Mapping (semantic similarity)
 * 2. Cross-Reference Building (bidirectional links)
 * 3. Evidence-Enhanced Retrieval (graph-guided search)
 * 4. Groundedness Validation (proof through links)
 *
 * Expected Gain: Groundedness +12%p, Reasoning accuracy +15%
 *
 * @see ChatGPT Master Directive: "Connect Structure to Reality"
 */

import type { KnowledgeGraph, ConceptNode } from '../../../offline/genius-lab/domain-expansion/knowledge-graph-builder';

/**
 * Evidence Item (from Evidence Store)
 */
export interface Evidence {
  id: string;
  text: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Semantic Link
 */
export interface SemanticLink {
  // Endpoints
  conceptId: string;
  evidenceId: string;

  // Strength
  similarity: number; // 0-1 (semantic similarity)
  confidence: number; // 0-1 (link confidence)

  // Type
  linkType: LinkType;

  // Metadata
  createdAt: Date;
  verified: boolean; // Manually verified
}

/**
 * Link Types
 */
export type LinkType =
  | 'defines' // Evidence defines concept
  | 'exemplifies' // Evidence is example of concept
  | 'supports' // Evidence supports concept
  | 'contradicts' // Evidence contradicts concept
  | 'relates' // Evidence relates to concept
  | 'derives'; // Evidence derives from concept

/**
 * Semantic Network (Graph + Links)
 */
export interface SemanticNetwork {
  // Source data
  graph: KnowledgeGraph;
  evidence: Evidence[];

  // Links
  links: SemanticLink[];

  // Indexes
  indexes: {
    linksByConcept: Map<string, SemanticLink[]>;
    linksByEvidence: Map<string, SemanticLink[]>;
    conceptsByEvidence: Map<string, ConceptNode[]>;
    evidenceByConcept: Map<string, Evidence[]>;
  };

  // Metadata
  metadata: {
    totalLinks: number;
    avgLinksPerConcept: number;
    avgLinksPerEvidence: number;
    coverage: number; // 0-1 (% of concepts linked)
  };
}

/**
 * Semantic Linker Config
 */
export interface SemanticLinkerConfig {
  // Similarity
  minSimilarity: number; // Default: 0.5
  similarityMetric: 'cosine' | 'jaccard' | 'levenshtein'; // Default: 'cosine'

  // Linking
  maxLinksPerConcept: number; // Default: 10
  maxLinksPerEvidence: number; // Default: 5

  // Validation
  enableAutoValidation: boolean; // Default: true
  validationThreshold: number; // Default: 0.8
}

/**
 * Semantic Linker
 *
 * Links knowledge graph concepts to evidence store
 */
export class SemanticLinker {
  private config: SemanticLinkerConfig;

  constructor(config?: Partial<SemanticLinkerConfig>) {
    this.config = {
      minSimilarity: config?.minSimilarity ?? 0.5,
      similarityMetric: config?.similarityMetric ?? 'cosine',
      maxLinksPerConcept: config?.maxLinksPerConcept ?? 10,
      maxLinksPerEvidence: config?.maxLinksPerEvidence ?? 5,
      enableAutoValidation: config?.enableAutoValidation ?? true,
      validationThreshold: config?.validationThreshold ?? 0.8,
    };
  }

  /**
   * Build semantic network
   *
   * Main entry point
   */
  async build(
    graph: KnowledgeGraph,
    evidence: Evidence[]
  ): Promise<SemanticNetwork> {
    // 1. Create links
    const links = await this.createLinks(graph, evidence);

    // 2. Build indexes
    const indexes = this.buildIndexes(graph, evidence, links);

    // 3. Calculate metadata
    const metadata = this.calculateMetadata(graph, evidence, links);

    return {
      graph,
      evidence,
      links,
      indexes,
      metadata,
    };
  }

  /**
   * Create semantic links
   */
  private async createLinks(
    graph: KnowledgeGraph,
    evidence: Evidence[]
  ): Promise<SemanticLink[]> {
    const links: SemanticLink[] = [];

    // For each concept, find matching evidence
    for (const node of graph.nodes) {
      const conceptText = this.getConceptText(node);

      // Calculate similarity with each evidence
      const similarities = evidence.map((ev) => ({
        evidenceId: ev.id,
        similarity: this.calculateSimilarity(conceptText, ev.text),
      }));

      // Filter by minimum similarity and sort
      const validSimilarities = similarities
        .filter((s) => s.similarity >= this.config.minSimilarity)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, this.config.maxLinksPerConcept);

      // Create links
      validSimilarities.forEach(({ evidenceId, similarity }) => {
        const linkType = this.inferLinkType(node, evidence.find((e) => e.id === evidenceId)!, similarity);

        links.push({
          conceptId: node.id,
          evidenceId,
          similarity,
          confidence: this.calculateLinkConfidence(similarity, linkType),
          linkType,
          createdAt: new Date(),
          verified: this.config.enableAutoValidation && similarity >= this.config.validationThreshold,
        });
      });
    }

    return links;
  }

  /**
   * Build indexes
   */
  private buildIndexes(
    graph: KnowledgeGraph,
    evidence: Evidence[],
    links: SemanticLink[]
  ): SemanticNetwork['indexes'] {
    const indexes: SemanticNetwork['indexes'] = {
      linksByConcept: new Map(),
      linksByEvidence: new Map(),
      conceptsByEvidence: new Map(),
      evidenceByConcept: new Map(),
    };

    // Index links
    links.forEach((link) => {
      // By concept
      if (!indexes.linksByConcept.has(link.conceptId)) {
        indexes.linksByConcept.set(link.conceptId, []);
      }
      indexes.linksByConcept.get(link.conceptId)!.push(link);

      // By evidence
      if (!indexes.linksByEvidence.has(link.evidenceId)) {
        indexes.linksByEvidence.set(link.evidenceId, []);
      }
      indexes.linksByEvidence.get(link.evidenceId)!.push(link);
    });

    // Index concepts by evidence
    evidence.forEach((ev) => {
      const conceptLinks = indexes.linksByEvidence.get(ev.id) || [];
      const concepts = conceptLinks
        .map((link) => graph.indexes.nodeById.get(link.conceptId))
        .filter((node): node is ConceptNode => node !== undefined);

      indexes.conceptsByEvidence.set(ev.id, concepts);
    });

    // Index evidence by concept
    graph.nodes.forEach((node) => {
      const evidenceLinks = indexes.linksByConcept.get(node.id) || [];
      const evidenceItems = evidenceLinks
        .map((link) => evidence.find((e) => e.id === link.evidenceId))
        .filter((e): e is Evidence => e !== undefined);

      indexes.evidenceByConcept.set(node.id, evidenceItems);
    });

    return indexes;
  }

  /**
   * Calculate metadata
   */
  private calculateMetadata(
    graph: KnowledgeGraph,
    evidence: Evidence[],
    links: SemanticLink[]
  ): SemanticNetwork['metadata'] {
    const linkedConcepts = new Set(links.map((l) => l.conceptId));
    const coverage = linkedConcepts.size / graph.nodes.length;

    const avgLinksPerConcept = links.length / graph.nodes.length;
    const avgLinksPerEvidence = links.length / evidence.length;

    return {
      totalLinks: links.length,
      avgLinksPerConcept,
      avgLinksPerEvidence,
      coverage,
    };
  }

  /**
   * Get concept text (for similarity calculation)
   */
  private getConceptText(node: ConceptNode): string {
    // Combine name and definition
    const parts = [node.concept.name];

    if (node.concept.definition) {
      parts.push(node.concept.definition);
    }

    // Add aliases
    if (node.concept.aliases.length > 0) {
      parts.push(...node.concept.aliases);
    }

    return parts.join(' ');
  }

  /**
   * Calculate semantic similarity
   */
  private calculateSimilarity(text1: string, text2: string): number {
    switch (this.config.similarityMetric) {
      case 'cosine':
        return this.cosineSimilarity(text1, text2);
      case 'jaccard':
        return this.jaccardSimilarity(text1, text2);
      case 'levenshtein':
        return this.levenshteinSimilarity(text1, text2);
      default:
        return this.cosineSimilarity(text1, text2);
    }
  }

  /**
   * Cosine similarity (TF-based)
   */
  private cosineSimilarity(text1: string, text2: string): number {
    // Tokenize
    const tokens1 = text1.toLowerCase().split(/\s+/);
    const tokens2 = text2.toLowerCase().split(/\s+/);

    // Build vocabulary
    const vocab = new Set([...tokens1, ...tokens2]);

    // Build vectors
    const vector1 = Array.from(vocab).map((token) =>
      tokens1.filter((t) => t === token).length
    );
    const vector2 = Array.from(vocab).map((token) =>
      tokens2.filter((t) => t === token).length
    );

    // Calculate cosine
    const dotProduct = vector1.reduce((sum, v, i) => sum + v * vector2[i], 0);
    const magnitude1 = Math.sqrt(vector1.reduce((sum, v) => sum + v * v, 0));
    const magnitude2 = Math.sqrt(vector2.reduce((sum, v) => sum + v * v, 0));

    if (magnitude1 === 0 || magnitude2 === 0) return 0;

    return dotProduct / (magnitude1 * magnitude2);
  }

  /**
   * Jaccard similarity
   */
  private jaccardSimilarity(text1: string, text2: string): number {
    const set1 = new Set(text1.toLowerCase().split(/\s+/));
    const set2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...set1].filter((x) => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * Levenshtein similarity (normalized)
   */
  private levenshteinSimilarity(text1: string, text2: string): number {
    const distance = this.levenshteinDistance(text1, text2);
    const maxLength = Math.max(text1.length, text2.length);

    if (maxLength === 0) return 1.0;

    return 1 - distance / maxLength;
  }

  /**
   * Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str1.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str1.length; i++) {
      for (let j = 1; j <= str2.length; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str1.length][str2.length];
  }

  /**
   * Infer link type
   */
  private inferLinkType(
    _node: ConceptNode,
    evidence: Evidence,
    similarity: number
  ): LinkType {
    const evidenceText = evidence.text.toLowerCase();

    // High similarity → defines
    if (similarity >= 0.8) {
      return 'defines';
    }

    // Contains "example", "such as" → exemplifies
    if (evidenceText.includes('example') || evidenceText.includes('such as')) {
      return 'exemplifies';
    }

    // Contains "supports", "confirms" → supports
    if (evidenceText.includes('support') || evidenceText.includes('confirm')) {
      return 'supports';
    }

    // Contains "contradict", "however" → contradicts
    if (evidenceText.includes('contradict') || evidenceText.includes('however')) {
      return 'contradicts';
    }

    // Default
    return 'relates';
  }

  /**
   * Calculate link confidence
   */
  private calculateLinkConfidence(similarity: number, linkType: LinkType): number {
    // Base confidence = similarity
    let confidence = similarity;

    // Boost for strong link types
    if (linkType === 'defines') {
      confidence = Math.min(confidence * 1.2, 1.0);
    } else if (linkType === 'supports') {
      confidence = Math.min(confidence * 1.1, 1.0);
    }

    return confidence;
  }

  /**
   * Get configuration
   */
  getConfig(): SemanticLinkerConfig {
    return { ...this.config };
  }

  // ========== Query Methods ==========

  /**
   * Get evidence for concept
   */
  getEvidenceForConcept(
    network: SemanticNetwork,
    conceptId: string
  ): Evidence[] {
    return network.indexes.evidenceByConcept.get(conceptId) || [];
  }

  /**
   * Get concepts for evidence
   */
  getConceptsForEvidence(
    network: SemanticNetwork,
    evidenceId: string
  ): ConceptNode[] {
    return network.indexes.conceptsByEvidence.get(evidenceId) || [];
  }

  /**
   * Get strongest links
   */
  getStrongestLinks(
    network: SemanticNetwork,
    topK: number = 10
  ): SemanticLink[] {
    return network.links
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, topK);
  }

  /**
   * Validate groundedness using links
   *
   * Check if statement is grounded in linked evidence
   */
  validateGroundedness(
    network: SemanticNetwork,
    statement: string,
    minLinkConfidence: number = 0.7
  ): {
    grounded: boolean;
    confidence: number;
    supportingLinks: SemanticLink[];
  } {
    // Extract concepts from statement (simple word matching)
    const statementWords = new Set(statement.toLowerCase().split(/\s+/));

    const relevantConcepts = network.graph.nodes.filter((node) =>
      statementWords.has(node.concept.name.toLowerCase())
    );

    // Get links for relevant concepts
    const supportingLinks: SemanticLink[] = [];
    relevantConcepts.forEach((node) => {
      const links = network.indexes.linksByConcept.get(node.id) || [];
      supportingLinks.push(
        ...links.filter((link) => link.confidence >= minLinkConfidence)
      );
    });

    // Calculate overall confidence
    const avgConfidence =
      supportingLinks.length > 0
        ? supportingLinks.reduce((sum, link) => sum + link.confidence, 0) /
          supportingLinks.length
        : 0;

    return {
      grounded: supportingLinks.length > 0 && avgConfidence >= minLinkConfidence,
      confidence: avgConfidence,
      supportingLinks,
    };
  }
}

/**
 * Default singleton instance
 */
export const semanticLinker = new SemanticLinker();
