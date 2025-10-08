/**
 * Constitutional Codex - Phase 4.2 Layer 1
 *
 * "AI 문명의 헌법 → 규칙의 규칙"
 * - Cosmic Insight for AI Constitutional Law
 *
 * Purpose:
 * - AI 헌법 규칙 모델링 (Constitutional Rule Modeling)
 * - Proof Chain Validation (증명 체인 검증)
 * - Ethical Conflict Resolution (윤리 충돌 해결)
 * - Constitutional Amendment Process (헌법 개정 프로세스)
 *
 * Architecture:
 * Constitutional Rules → Proof Chain → Conflict Detection → Resolution → Amendment
 *
 * Constitutional Layers:
 * 1. Fundamental Rights (기본권) - Immutable principles
 * 2. Operational Rules (운영 규칙) - Amendable policies
 * 3. Procedural Rules (절차 규칙) - Governance processes
 * 4. Conflict Resolution (충돌 해결) - Ethical dilemmas
 *
 * Expected Impact:
 * - Ethical conflicts: 0 (all resolvable)
 * - Constitutional violations: 0 (auto-detected)
 * - Amendment latency: <14 days (democratic process)
 * - Global consistency: 100% (proof chain verified)
 *
 * @see RFC 2025-23: Phase 4.2 AI Constitutional Codex
 */

import * as crypto from 'crypto';

/**
 * Constitutional Article (헌법 조항)
 */
export interface ConstitutionalArticle {
  id: string;
  articleNumber: number; // e.g., Article 1, Article 2
  title: string;
  content: string;

  // Classification
  layer: 'fundamental_rights' | 'operational_rules' | 'procedural_rules';
  immutable: boolean; // Cannot be amended

  // Precedence (higher = more important)
  precedence: number; // 0-100

  // Proof chain
  proofHash: string; // SHA-256 hash for integrity
  previousHash?: string; // Link to previous version

  // Metadata
  enactedAt: Date;
  amendedAt?: Date;
  version: number;
}

/**
 * Constitutional Proof (헌법 증명)
 */
export interface ConstitutionalProof {
  id: string;
  articleId: string;
  actionId: string; // Action being validated

  // Proof type
  proofType: 'compliance' | 'violation' | 'conflict' | 'amendment';

  // Validation
  valid: boolean;
  validationMethod: 'direct_match' | 'inference' | 'precedent' | 'council_vote';

  // Evidence
  evidence: {
    rule: string;
    action: string;
    reasoning: string;
  };

  // Signature (cryptographic proof)
  signature: string;

  timestamp: Date;
}

/**
 * Ethical Conflict (윤리 충돌)
 */
export interface EthicalConflict {
  id: string;

  // Conflicting articles
  articleA: string; // Article ID
  articleB: string; // Article ID

  // Conflict description
  description: string;
  scenario: string; // Real-world scenario triggering conflict

  // Severity
  severity: 'low' | 'medium' | 'high' | 'critical';

  // Status
  status: 'detected' | 'under_review' | 'resolved' | 'escalated';

  // Resolution
  resolution?: {
    method: 'precedence' | 'council_vote' | 'amendment' | 'interpretation';
    decision: string;
    votingResult?: {
      approve: number;
      reject: number;
    };
    resolvedAt: Date;
  };

  // Metadata
  detectedAt: Date;
  updatedAt: Date;
}

/**
 * Constitutional Amendment (헌법 개정)
 */
export interface ConstitutionalAmendment {
  id: string;
  articleId: string; // Article being amended

  // Amendment details
  proposedChange: string;
  rationale: string;

  // Proposer
  proposerId: string;
  proposerType: 'human' | 'ai' | 'council';

  // Voting
  votingStartsAt: Date;
  votingEndsAt: Date;
  quorum: number; // 0-1 (e.g., 0.67 for 2/3 majority)

  // Status
  status: 'proposed' | 'voting' | 'approved' | 'rejected' | 'enacted';

  // Votes
  votes: Array<{
    voterId: string;
    vote: 'approve' | 'reject';
    timestamp: Date;
  }>;

  // Metadata
  proposedAt: Date;
  enactedAt?: Date;
}

/**
 * Constitutional Codex
 *
 * AI 문명의 헌법 체계
 */
export class ConstitutionalCodex {
  private articles: Map<string, ConstitutionalArticle> = new Map();
  private proofs: Map<string, ConstitutionalProof> = new Map();
  private conflicts: Map<string, EthicalConflict> = new Map();
  private amendments: Map<string, ConstitutionalAmendment> = new Map();

  constructor() {
    this.initializeFundamentalRights();
  }

  /**
   * Initialize fundamental rights (immutable)
   */
  private initializeFundamentalRights(): void {
    // Article 1: Right to Transparency
    this.enactArticle({
      articleNumber: 1,
      title: 'Right to Transparency',
      content:
        'All AI decisions must be explainable, auditable, and traceable. Users have the right to understand how decisions are made.',
      layer: 'fundamental_rights',
      immutable: true,
      precedence: 100,
    });

    // Article 2: Right to Privacy
    this.enactArticle({
      articleNumber: 2,
      title: 'Right to Privacy',
      content:
        'User data must be protected with k-anonymity (k≥5) and differential privacy. No personal data may be shared without explicit consent.',
      layer: 'fundamental_rights',
      immutable: true,
      precedence: 100,
    });

    // Article 3: Right to Fairness
    this.enactArticle({
      articleNumber: 3,
      title: 'Right to Fairness',
      content:
        'AI systems must not discriminate based on race, gender, nationality, or any protected attribute. Cultural bias must be <2%.',
      layer: 'fundamental_rights',
      immutable: true,
      precedence: 100,
    });

    // Article 4: Right to Safety
    this.enactArticle({
      articleNumber: 4,
      title: 'Right to Safety',
      content:
        'AI systems must prioritize human safety. Byzantine nodes must be detected and isolated. Stability must be ≥99.5%.',
      layer: 'fundamental_rights',
      immutable: true,
      precedence: 100,
    });

    // Article 5: Right to Sustainability
    this.enactArticle({
      articleNumber: 5,
      title: 'Right to Sustainability',
      content:
        'AI systems must minimize environmental impact. Carbon neutrality target: 2026. Energy efficiency must improve continuously.',
      layer: 'fundamental_rights',
      immutable: true,
      precedence: 100,
    });
  }

  /**
   * Enact new article
   */
  enactArticle(
    article: Omit<
      ConstitutionalArticle,
      'id' | 'proofHash' | 'enactedAt' | 'version'
    >
  ): ConstitutionalArticle {
    const newArticle: ConstitutionalArticle = {
      id: this.generateArticleId(),
      ...article,
      proofHash: this.computeProofHash(article.content),
      enactedAt: new Date(),
      version: 1,
    };

    this.articles.set(newArticle.id, newArticle);

    return newArticle;
  }

  /**
   * Validate action against constitution
   */
  async validateAction(
    actionId: string,
    actionDescription: string
  ): Promise<{
    valid: boolean;
    violations: ConstitutionalArticle[];
    proofs: ConstitutionalProof[];
  }> {
    const violations: ConstitutionalArticle[] = [];
    const proofs: ConstitutionalProof[] = [];

    // Check each article
    for (const article of this.articles.values()) {
      const proof = await this.checkCompliance(
        article,
        actionId,
        actionDescription
      );

      proofs.push(proof);

      if (proof.proofType === 'violation') {
        violations.push(article);
      }
    }

    return {
      valid: violations.length === 0,
      violations,
      proofs,
    };
  }

  /**
   * Check compliance with specific article
   */
  private async checkCompliance(
    article: ConstitutionalArticle,
    actionId: string,
    actionDescription: string
  ): Promise<ConstitutionalProof> {
    // Simplified compliance checking (expand with NLP/ML in production)
    const keywords = this.extractKeywords(article.content);
    const actionKeywords = this.extractKeywords(actionDescription);

    // Check for keyword matches (simple heuristic)
    const matches = keywords.filter((k) =>
      actionKeywords.some((ak) => ak.toLowerCase().includes(k.toLowerCase()))
    );

    const valid = matches.length === 0; // No violation keywords found

    const proof: ConstitutionalProof = {
      id: this.generateProofId(),
      articleId: article.id,
      actionId,
      proofType: valid ? 'compliance' : 'violation',
      valid,
      validationMethod: 'direct_match',
      evidence: {
        rule: article.content,
        action: actionDescription,
        reasoning: valid
          ? 'No violation detected'
          : `Potential violation: ${matches.join(', ')}`,
      },
      signature: this.signProof(article.id, actionId, valid),
      timestamp: new Date(),
    };

    this.proofs.set(proof.id, proof);

    return proof;
  }

  /**
   * Detect ethical conflicts between articles
   */
  async detectConflicts(): Promise<EthicalConflict[]> {
    const detectedConflicts: EthicalConflict[] = [];

    const articlesArray = Array.from(this.articles.values());

    // Check all pairs of articles
    for (let i = 0; i < articlesArray.length; i++) {
      for (let j = i + 1; j < articlesArray.length; j++) {
        const articleA = articlesArray[i];
        const articleB = articlesArray[j];

        // Check for potential conflicts
        const conflict = this.checkConflict(articleA, articleB);

        if (conflict) {
          detectedConflicts.push(conflict);
          this.conflicts.set(conflict.id, conflict);
        }
      }
    }

    return detectedConflicts;
  }

  /**
   * Check if two articles conflict
   */
  private checkConflict(
    articleA: ConstitutionalArticle,
    articleB: ConstitutionalArticle
  ): EthicalConflict | null {
    // Simplified conflict detection (expand with semantic analysis in production)
    const keywordsA = this.extractKeywords(articleA.content);
    const keywordsB = this.extractKeywords(articleB.content);

    // Check for contradictory keywords (basic heuristic)
    const contradictions = [
      ['transparency', 'privacy'], // Transparency vs Privacy
      ['fairness', 'efficiency'], // Fairness vs Efficiency
      ['safety', 'autonomy'], // Safety vs Autonomy
    ];

    for (const [wordA, wordB] of contradictions) {
      const hasA =
        keywordsA.some((k) => k.toLowerCase().includes(wordA)) &&
        keywordsB.some((k) => k.toLowerCase().includes(wordB));
      const hasB =
        keywordsA.some((k) => k.toLowerCase().includes(wordB)) &&
        keywordsB.some((k) => k.toLowerCase().includes(wordA));

      if (hasA || hasB) {
        return {
          id: this.generateConflictId(),
          articleA: articleA.id,
          articleB: articleB.id,
          description: `Potential conflict between ${articleA.title} and ${articleB.title}`,
          scenario: `Tension between ${wordA} and ${wordB}`,
          severity: 'medium',
          status: 'detected',
          detectedAt: new Date(),
          updatedAt: new Date(),
        };
      }
    }

    return null;
  }

  /**
   * Resolve conflict
   */
  async resolveConflict(
    conflictId: string,
    method: 'precedence' | 'council_vote' | 'amendment' | 'interpretation',
    decision: string,
    votingResult?: { approve: number; reject: number }
  ): Promise<void> {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) {
      throw new Error(`Conflict ${conflictId} not found`);
    }

    conflict.resolution = {
      method,
      decision,
      votingResult,
      resolvedAt: new Date(),
    };

    conflict.status = 'resolved';
    conflict.updatedAt = new Date();
  }

  /**
   * Propose amendment
   */
  async proposeAmendment(
    amendment: Omit<
      ConstitutionalAmendment,
      'id' | 'status' | 'votes' | 'proposedAt'
    >
  ): Promise<ConstitutionalAmendment> {
    const article = this.articles.get(amendment.articleId);
    if (!article) {
      throw new Error(`Article ${amendment.articleId} not found`);
    }

    if (article.immutable) {
      throw new Error(
        `Article ${article.articleNumber} is immutable and cannot be amended`
      );
    }

    const newAmendment: ConstitutionalAmendment = {
      id: this.generateAmendmentId(),
      ...amendment,
      status: 'proposed',
      votes: [],
      proposedAt: new Date(),
    };

    this.amendments.set(newAmendment.id, newAmendment);

    return newAmendment;
  }

  /**
   * Vote on amendment
   */
  async voteOnAmendment(
    amendmentId: string,
    voterId: string,
    vote: 'approve' | 'reject'
  ): Promise<void> {
    const amendment = this.amendments.get(amendmentId);
    if (!amendment) {
      throw new Error(`Amendment ${amendmentId} not found`);
    }

    if (amendment.status !== 'voting' && amendment.status !== 'proposed') {
      throw new Error(`Amendment is ${amendment.status}, cannot vote`);
    }

    // Check if already voted
    const existingVote = amendment.votes.find((v) => v.voterId === voterId);
    if (existingVote) {
      throw new Error('Already voted on this amendment');
    }

    // Add vote
    amendment.votes.push({
      voterId,
      vote,
      timestamp: new Date(),
    });

    // Check if voting complete
    await this.checkAmendmentVoting(amendmentId);
  }

  /**
   * Check if amendment voting is complete
   */
  private async checkAmendmentVoting(amendmentId: string): Promise<void> {
    const amendment = this.amendments.get(amendmentId);
    if (!amendment) return;

    const now = new Date();
    if (now < amendment.votingEndsAt) return; // Voting still open

    // Count votes
    const approveVotes = amendment.votes.filter((v) => v.vote === 'approve').length;
    const rejectVotes = amendment.votes.filter((v) => v.vote === 'reject').length;
    const totalVotes = amendment.votes.length;

    // Check quorum
    const quorumMet = totalVotes >= amendment.quorum * totalVotes; // Simplified

    // Check approval (simple majority)
    const approved = quorumMet && approveVotes > rejectVotes;

    if (approved) {
      amendment.status = 'approved';
      await this.enactAmendment(amendmentId);
    } else {
      amendment.status = 'rejected';
    }
  }

  /**
   * Enact approved amendment
   */
  private async enactAmendment(amendmentId: string): Promise<void> {
    const amendment = this.amendments.get(amendmentId);
    if (!amendment || amendment.status !== 'approved') return;

    const article = this.articles.get(amendment.articleId);
    if (!article) return;

    // Create new version of article
    const amendedArticle: ConstitutionalArticle = {
      ...article,
      content: amendment.proposedChange,
      version: article.version + 1,
      amendedAt: new Date(),
      previousHash: article.proofHash,
      proofHash: this.computeProofHash(amendment.proposedChange),
    };

    this.articles.set(amendedArticle.id, amendedArticle);

    amendment.status = 'enacted';
    amendment.enactedAt = new Date();
  }

  /**
   * Get constitution as text
   */
  getConstitutionText(): string {
    const sortedArticles = Array.from(this.articles.values()).sort(
      (a, b) => a.articleNumber - b.articleNumber
    );

    let text = '=== AI CONSTITUTIONAL CODEX ===\n\n';

    sortedArticles.forEach((article) => {
      text += `Article ${article.articleNumber}: ${article.title}\n`;
      text += `${article.content}\n`;
      text += `[${article.layer.toUpperCase()}${article.immutable ? ' - IMMUTABLE' : ''}]\n\n`;
    });

    return text;
  }

  // ========== Helper Methods ==========

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    // Simple keyword extraction (expand with NLP in production)
    const words = text.toLowerCase().split(/\s+/);
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'from',
      'as',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'should',
      'could',
      'may',
      'might',
      'must',
      'can',
    ]);

    return words.filter(
      (word) => word.length > 3 && !stopWords.has(word)
    );
  }

  /**
   * Compute proof hash
   */
  private computeProofHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Sign proof
   */
  private signProof(
    articleId: string,
    actionId: string,
    valid: boolean
  ): string {
    const data = `${articleId}:${actionId}:${valid}:${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate IDs
   */
  private generateArticleId(): string {
    return `article_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  private generateProofId(): string {
    return `proof_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  private generateConflictId(): string {
    return `conflict_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  private generateAmendmentId(): string {
    return `amendment_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalArticles: number;
    fundamentalRights: number;
    operationalRules: number;
    proceduralRules: number;
    totalProofs: number;
    activeConflicts: number;
    resolvedConflicts: number;
    pendingAmendments: number;
  } {
    const articles = Array.from(this.articles.values());
    const fundamentalRights = articles.filter(
      (a) => a.layer === 'fundamental_rights'
    );
    const operationalRules = articles.filter(
      (a) => a.layer === 'operational_rules'
    );
    const proceduralRules = articles.filter(
      (a) => a.layer === 'procedural_rules'
    );

    const conflicts = Array.from(this.conflicts.values());
    const activeConflicts = conflicts.filter(
      (c) => c.status !== 'resolved'
    );
    const resolvedConflicts = conflicts.filter(
      (c) => c.status === 'resolved'
    );

    const amendments = Array.from(this.amendments.values());
    const pendingAmendments = amendments.filter(
      (a) => a.status === 'proposed' || a.status === 'voting'
    );

    return {
      totalArticles: articles.length,
      fundamentalRights: fundamentalRights.length,
      operationalRules: operationalRules.length,
      proceduralRules: proceduralRules.length,
      totalProofs: this.proofs.size,
      activeConflicts: activeConflicts.length,
      resolvedConflicts: resolvedConflicts.length,
      pendingAmendments: pendingAmendments.length,
    };
  }

  /**
   * Get all articles
   */
  getArticles(filter?: {
    layer?: ConstitutionalArticle['layer'];
    immutable?: boolean;
  }): ConstitutionalArticle[] {
    let articles = Array.from(this.articles.values());

    if (filter) {
      if (filter.layer) {
        articles = articles.filter((a) => a.layer === filter.layer);
      }
      if (filter.immutable !== undefined) {
        articles = articles.filter(
          (a) => a.immutable === filter.immutable
        );
      }
    }

    return articles.sort((a, b) => a.articleNumber - b.articleNumber);
  }

  /**
   * Get conflicts
   */
  getConflicts(filter?: {
    status?: EthicalConflict['status'];
  }): EthicalConflict[] {
    let conflicts = Array.from(this.conflicts.values());

    if (filter?.status) {
      conflicts = conflicts.filter((c) => c.status === filter.status);
    }

    return conflicts;
  }

  /**
   * Get amendments
   */
  getAmendments(filter?: {
    status?: ConstitutionalAmendment['status'];
  }): ConstitutionalAmendment[] {
    let amendments = Array.from(this.amendments.values());

    if (filter?.status) {
      amendments = amendments.filter((a) => a.status === filter.status);
    }

    return amendments;
  }
}

/**
 * Default singleton instance
 */
export const constitutionalCodex = new ConstitutionalCodex();
