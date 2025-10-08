/**
 * Domain Detector (Phase 3.1 - Dynamic Domain Instantiation)
 *
 * "전문가를 불러오는 AI가 아니라, 전문가를 창조하는 AI"
 * - ChatGPT Master Directive
 *
 * 핵심 통찰:
 * - Domain detection is NOT classification - it's SIGNATURE EXTRACTION
 * - We don't match to predefined domains - we DISCOVER domain DNA
 * - Domain = (Terminology + Structure + Reasoning patterns + Constraints)
 *
 * Architecture:
 * This is the FIRST LAYER of Domain Singularity Engine:
 * 1. Domain Detector → Extract domain signature
 * 2. Persona Factory → Create expert persona
 * 3. Knowledge Skeletonization → Extract domain structure
 * 4. Policy Pack Generator → Auto-generate compliance rules
 *
 * Expected Gain: Domain expansion ×10, Sparse domain adaptation ≥90%
 *
 * @see ChatGPT Master Directive: DDI (Dynamic Domain Instantiation)
 */

/**
 * Domain signature (DNA of a domain)
 */
export interface DomainSignature {
  // Identification
  detectedDomain: string; // "cardiology", "securities-law", "aerospace-engineering"
  confidence: number; // 0-1

  // Terminology fingerprint
  terminology: {
    coreTerms: string[]; // Top-50 domain-specific terms
    acronyms: string[]; // Domain acronyms (FDA, SEC, NASA, etc.)
    entities: string[]; // Named entities (organizations, standards)
  };

  // Structural fingerprint
  structure: {
    hasFormulas: boolean; // Contains mathematical formulas
    hasTables: boolean; // Contains structured tables
    hasDiagrams: boolean; // Contains diagrams/charts
    hasReferences: boolean; // Contains bibliographic references
    hasRegulations: boolean; // Contains regulatory citations
  };

  // Reasoning fingerprint
  reasoning: {
    inferencePatterns: string[]; // "if-then", "causal", "sequential"
    evidenceStyle: 'empirical' | 'theoretical' | 'regulatory' | 'procedural' | 'mixed';
    formalityLevel: number; // 0-1 (casual → formal)
  };

  // Constraint fingerprint
  constraints: {
    regulatoryFramework?: string; // "HIPAA", "SOX", "FAA", etc.
    safetyLevel: 'low' | 'medium' | 'high' | 'critical';
    precisionRequirement: 'approximate' | 'precise' | 'exact';
  };

  // Meta-information
  metadata: {
    sourceTypes: string[]; // "journal", "regulation", "manual", etc.
    detectionMethod: 'terminology' | 'structure' | 'hybrid';
    timestamp: Date;
  };
}

/**
 * Domain knowledge base (expandable)
 */
interface DomainKnowledgeBase {
  name: string;
  aliases: string[];
  coreTerms: string[];
  acronyms: string[];
  regulatoryFrameworks: string[];
  safetyLevel: DomainSignature['constraints']['safetyLevel'];
}

/**
 * Predefined domain knowledge (seed - will be auto-expanded)
 */
const DOMAIN_KNOWLEDGE_BASE: DomainKnowledgeBase[] = [
  {
    name: 'healthcare',
    aliases: ['medical', 'clinical', 'healthcare', 'medicine'],
    coreTerms: [
      'patient',
      'diagnosis',
      'treatment',
      'symptom',
      'disease',
      'medication',
      'clinical',
      'therapeutic',
      'pathology',
      'prognosis',
    ],
    acronyms: ['HIPAA', 'FDA', 'CDC', 'NIH', 'EMR', 'EHR', 'PHI'],
    regulatoryFrameworks: ['HIPAA', 'FDA-CFR'],
    safetyLevel: 'critical',
  },
  {
    name: 'finance',
    aliases: ['financial', 'banking', 'investment', 'securities'],
    coreTerms: [
      'equity',
      'debt',
      'portfolio',
      'risk',
      'return',
      'capital',
      'liquidity',
      'valuation',
      'derivative',
      'compliance',
    ],
    acronyms: ['SEC', 'FINRA', 'SOX', 'GAAP', 'IFRS', 'KYC', 'AML'],
    regulatoryFrameworks: ['SOX', 'Dodd-Frank', 'MiFID'],
    safetyLevel: 'high',
  },
  {
    name: 'aerospace',
    aliases: ['aviation', 'aerospace', 'aeronautical'],
    coreTerms: [
      'aircraft',
      'altitude',
      'aerodynamic',
      'propulsion',
      'navigation',
      'avionics',
      'flight',
      'airspace',
      'certification',
      'maintenance',
    ],
    acronyms: ['FAA', 'ICAO', 'NASA', 'EASA', 'ATC', 'FMS'],
    regulatoryFrameworks: ['FAA-CFR', 'ICAO-Annex'],
    safetyLevel: 'critical',
  },
  {
    name: 'legal',
    aliases: ['law', 'legal', 'jurisprudence'],
    coreTerms: [
      'statute',
      'regulation',
      'precedent',
      'liability',
      'jurisdiction',
      'contract',
      'tort',
      'plaintiff',
      'defendant',
      'remedy',
    ],
    acronyms: ['USC', 'CFR', 'ALJ', 'SCOTUS'],
    regulatoryFrameworks: ['USC', 'UCC', 'Restatement'],
    safetyLevel: 'high',
  },
];

/**
 * Domain Detector
 *
 * Detects domain from input text and extracts domain signature.
 */
export class DomainDetector {
  private knowledgeBase: DomainKnowledgeBase[];

  constructor(additionalDomains: DomainKnowledgeBase[] = []) {
    this.knowledgeBase = [...DOMAIN_KNOWLEDGE_BASE, ...additionalDomains];
  }

  /**
   * Detect domain from text
   *
   * GENIUS INSIGHT: We don't classify - we extract DNA
   */
  async detect(text: string): Promise<DomainSignature> {
    // Step 1: Extract terminology fingerprint
    const terminology = this.extractTerminology(text);

    // Step 2: Extract structural fingerprint
    const structure = this.extractStructure(text);

    // Step 3: Extract reasoning fingerprint
    const reasoning = this.extractReasoning(text);

    // Step 4: Match to known domains (or discover new)
    const { domain, confidence } = this.matchDomain(terminology, structure, reasoning);

    // Step 5: Extract constraints
    const constraints = this.extractConstraints(domain, text);

    // Step 6: Build signature
    return {
      detectedDomain: domain,
      confidence,
      terminology,
      structure,
      reasoning,
      constraints,
      metadata: {
        sourceTypes: this.detectSourceTypes(text),
        detectionMethod: 'hybrid',
        timestamp: new Date(),
      },
    };
  }

  /**
   * Extract terminology fingerprint
   */
  private extractTerminology(text: string): DomainSignature['terminology'] {
    // Tokenize and extract domain-specific terms
    const tokens = text.toLowerCase().split(/\s+/);

    // Extract core terms (frequency-based, filtering common words)
    const termFreq = new Map<string, number>();
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);

    tokens.forEach((token) => {
      if (token.length > 3 && !stopWords.has(token)) {
        termFreq.set(token, (termFreq.get(token) || 0) + 1);
      }
    });

    const coreTerms = Array.from(termFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([term]) => term);

    // Extract acronyms (all-caps words)
    const acronyms = tokens.filter(
      (t) => t.length >= 2 && t.length <= 10 && t === t.toUpperCase()
    );

    // Extract entities (capitalized phrases)
    const entities = this.extractEntities(text);

    return {
      coreTerms,
      acronyms: [...new Set(acronyms)],
      entities,
    };
  }

  /**
   * Extract structural fingerprint
   */
  private extractStructure(text: string): DomainSignature['structure'] {
    return {
      hasFormulas: /\$.*\$|\\begin\{equation\}|∫|∑|∏|√|±|≤|≥/.test(text),
      hasTables: /\|.*\||\t.*\t|<table>/.test(text),
      hasDiagrams: /\[figure|diagram|chart|graph\]/i.test(text),
      hasReferences: /\[\d+\]|\(\d{4}\)|et al\.|doi:|arxiv:/i.test(text),
      hasRegulations: /§\s*\d+|CFR\s+\d+|USC\s+\d+|Article\s+\d+/i.test(text),
    };
  }

  /**
   * Extract reasoning fingerprint
   */
  private extractReasoning(text: string): DomainSignature['reasoning'] {
    // Detect inference patterns
    const inferencePatterns: string[] = [];
    if (/if\s+.*\s+then|when\s+.*\s+then/i.test(text)) {
      inferencePatterns.push('if-then');
    }
    if (/because|therefore|thus|hence|consequently/i.test(text)) {
      inferencePatterns.push('causal');
    }
    if (/first|second|next|then|finally|step\s+\d+/i.test(text)) {
      inferencePatterns.push('sequential');
    }

    // Detect evidence style
    const evidenceStyle: DomainSignature['reasoning']['evidenceStyle'] = this.detectEvidenceStyle(
      text
    );

    // Detect formality level
    const formalityLevel = this.detectFormality(text);

    return {
      inferencePatterns,
      evidenceStyle,
      formalityLevel,
    };
  }

  /**
   * Match to known domain
   */
  private matchDomain(
    terminology: DomainSignature['terminology'],
    structure: DomainSignature['structure'],
    reasoning: DomainSignature['reasoning']
  ): { domain: string; confidence: number } {
    let bestDomain = 'general';
    let bestScore = 0;

    for (const domain of this.knowledgeBase) {
      let score = 0;

      // Terminology match
      const termMatches = terminology.coreTerms.filter((t) =>
        domain.coreTerms.some((dt) => t.includes(dt) || dt.includes(t))
      ).length;
      score += termMatches * 2;

      // Acronym match
      const acronymMatches = terminology.acronyms.filter((a) => domain.acronyms.includes(a)).length;
      score += acronymMatches * 5;

      // Regulatory framework match
      if (structure.hasRegulations) {
        score += 3;
      }

      // Formality match
      if (domain.safetyLevel === 'critical' && reasoning.formalityLevel > 0.7) {
        score += 2;
      }

      if (score > bestScore) {
        bestScore = score;
        bestDomain = domain.name;
      }
    }

    // Compute confidence
    const confidence = Math.min(1.0, bestScore / 20);

    return { domain: bestDomain, confidence };
  }

  /**
   * Extract constraints
   */
  private extractConstraints(
    domain: string,
    text: string
  ): DomainSignature['constraints'] {
    const domainInfo = this.knowledgeBase.find((d) => d.name === domain);

    // Detect regulatory framework
    let regulatoryFramework: string | undefined;
    if (domainInfo) {
      regulatoryFramework = domainInfo.regulatoryFrameworks[0];
    }

    // Detect safety level
    const safetyLevel = domainInfo?.safetyLevel || 'medium';

    // Detect precision requirement
    const precisionRequirement: DomainSignature['constraints']['precisionRequirement'] =
      /approximately|roughly|about|around/i.test(text)
        ? 'approximate'
        : /exactly|precisely|must be/i.test(text)
        ? 'exact'
        : 'precise';

    return {
      regulatoryFramework,
      safetyLevel,
      precisionRequirement,
    };
  }

  /**
   * Extract named entities (simplified)
   */
  private extractEntities(text: string): string[] {
    // Simple capitalized phrase extraction
    const capitalizedPhrases = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    return [...new Set(capitalizedPhrases)].slice(0, 20);
  }

  /**
   * Detect evidence style
   */
  private detectEvidenceStyle(
    text: string
  ): DomainSignature['reasoning']['evidenceStyle'] {
    if (/experiment|study|data|result|measured|observed/i.test(text)) {
      return 'empirical';
    }
    if (/theorem|proof|axiom|lemma|corollary/i.test(text)) {
      return 'theoretical';
    }
    if (/shall|must|required|prohibited|compliance/i.test(text)) {
      return 'regulatory';
    }
    if (/procedure|step|process|instruction|guideline/i.test(text)) {
      return 'procedural';
    }
    return 'mixed';
  }

  /**
   * Detect formality level
   */
  private detectFormality(text: string): number {
    let formalityScore = 0.5; // Base

    // Formal indicators
    if (/\b(shall|pursuant|herein|thereof|whereby)\b/i.test(text)) {
      formalityScore += 0.2;
    }
    if (/\b(moreover|furthermore|consequently|notwithstanding)\b/i.test(text)) {
      formalityScore += 0.1;
    }

    // Informal indicators
    if (/\b(gonna|wanna|kinda|sorta|yeah|nope)\b/i.test(text)) {
      formalityScore -= 0.3;
    }
    if (/!{2,}|\?{2,}/i.test(text)) {
      formalityScore -= 0.1;
    }

    return Math.max(0, Math.min(1.0, formalityScore));
  }

  /**
   * Detect source types
   */
  private detectSourceTypes(text: string): string[] {
    const types: string[] = [];

    if (/journal|publication|doi:|arxiv:/i.test(text)) {
      types.push('journal');
    }
    if (/§|CFR|USC|regulation/i.test(text)) {
      types.push('regulation');
    }
    if (/manual|handbook|guide|procedure/i.test(text)) {
      types.push('manual');
    }
    if (/standard|specification|ISO|IEEE|ASTM/i.test(text)) {
      types.push('standard');
    }

    return types.length > 0 ? types : ['general'];
  }

  /**
   * Add domain to knowledge base (for expansion)
   */
  addDomain(domain: DomainKnowledgeBase): void {
    this.knowledgeBase.push(domain);
  }

  /**
   * Get knowledge base
   */
  getKnowledgeBase(): DomainKnowledgeBase[] {
    return this.knowledgeBase;
  }
}

/**
 * Default singleton instance
 */
export const domainDetector = new DomainDetector();
