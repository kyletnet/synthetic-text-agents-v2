/**
 * GCG Compiler (Phase 2.7 - Guideline Constraint Grammar)
 *
 * "가이드라인은 형식 문법이 되어야 일관성이 보장된다"
 * - ChatGPT Genius Insight
 *
 * Purpose:
 * - Compile natural language guidelines into formal constraint grammar
 * - Enable automated guideline enforcement
 * - Support domain-specific customization
 *
 * Architecture:
 * Guideline (NL) → **GCG Compiler** → Formal Grammar → Runtime Enforcement
 *
 * Compilation Strategy:
 * 1. Guideline Parsing (extract intent)
 * 2. Constraint Generation (create formal constraints)
 * 3. Rule Synthesis (combine constraints into rules)
 * 4. Grammar Assembly (organize rules into grammar)
 *
 * Expected Gain: Guideline compliance ≥95%, Enforcement automation 100%
 *
 * @see ChatGPT Master Directive: "Formal > Informal"
 */

import type {
  GCGRule,
  GCGConstraint,
  GCGGrammar,
  GCGCompilationResult,
  GCGCategory,
  ConstraintSeverity,
  ConstraintType,
  EnforcementAction,
  EnforcementTarget,
} from './types';

/**
 * Guideline Input (natural language)
 */
export interface GuidelineInput {
  text: string; // Guideline text
  category?: GCGCategory; // Optional category hint
  domain?: string; // Optional domain
  priority?: number; // Optional priority (0-1)
}

/**
 * GCG Compiler Config
 */
export interface GCGCompilerConfig {
  // Parsing
  enableNLParsing: boolean; // Default: true
  parseTimeout: number; // Default: 5000ms

  // Generation
  defaultPriority: number; // Default: 0.5
  defaultSeverity: ConstraintSeverity; // Default: 'should'

  // Validation
  enableValidation: boolean; // Default: true
  strictMode: boolean; // Default: false
}

/**
 * GCG Compiler
 *
 * Compiles natural language guidelines into formal grammar
 */
export class GCGCompiler {
  private config: GCGCompilerConfig;
  private ruleCounter = 0;

  constructor(config?: Partial<GCGCompilerConfig>) {
    this.config = {
      enableNLParsing: config?.enableNLParsing ?? true,
      parseTimeout: config?.parseTimeout ?? 5000,
      defaultPriority: config?.defaultPriority ?? 0.5,
      defaultSeverity: config?.defaultSeverity ?? 'should',
      enableValidation: config?.enableValidation ?? true,
      strictMode: config?.strictMode ?? false,
    };
  }

  /**
   * Compile guidelines into grammar
   *
   * Main entry point
   */
  async compile(
    guidelines: GuidelineInput[],
    grammarId: string,
    grammarName: string
  ): Promise<GCGCompilationResult> {
    const warnings: string[] = [];
    const errors: string[] = [];
    const rules: GCGRule[] = [];

    // Reset counter
    this.ruleCounter = 0;

    // Process each guideline
    for (const guideline of guidelines) {
      try {
        const rule = await this.compileGuideline(guideline);
        rules.push(rule);
      } catch (error) {
        const message = `Failed to compile guideline: "${guideline.text.substring(0, 50)}..."`;
        if (this.config.strictMode) {
          errors.push(message);
        } else {
          warnings.push(message);
        }
      }
    }

    // Validate grammar
    if (this.config.enableValidation) {
      const validationResult = this.validateGrammar(rules);
      warnings.push(...validationResult.warnings);
      errors.push(...validationResult.errors);
    }

    // Assemble grammar
    const grammar: GCGGrammar = {
      id: grammarId,
      name: grammarName,
      description: `Compiled from ${guidelines.length} guidelines`,
      rules,
      metadata: {
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        totalRules: rules.length,
      },
    };

    // Calculate statistics
    const totalConstraints = rules.reduce(
      (sum, rule) => sum + rule.constraints.length,
      0
    );

    return {
      grammar,
      stats: {
        totalGuidelines: guidelines.length,
        totalRules: rules.length,
        totalConstraints,
        avgConstraintsPerRule:
          rules.length > 0 ? totalConstraints / rules.length : 0,
      },
      warnings,
      errors,
    };
  }

  /**
   * Compile single guideline
   */
  private async compileGuideline(guideline: GuidelineInput): Promise<GCGRule> {
    // 1. Determine category
    const category = guideline.category || this.inferCategory(guideline.text);

    // 2. Extract constraints
    const constraints = this.extractConstraints(guideline.text, category);

    // 3. Determine severity
    const severity = this.inferSeverity(guideline.text);

    // 4. Determine priority
    const priority = guideline.priority ?? this.config.defaultPriority;

    // 5. Generate rule ID
    const ruleId = `rule_${category}_${this.ruleCounter++}`;

    return {
      id: ruleId,
      name: this.generateRuleName(guideline.text),
      category,
      tags: this.extractTags(guideline.text, category),
      guideline: guideline.text,
      constraints,
      priority,
      severity,
      version: '1.0.0',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Infer category from guideline text
   */
  private inferCategory(text: string): GCGCategory {
    const lowerText = text.toLowerCase();

    // Category keywords
    const categoryMap: Array<{ keywords: string[]; category: GCGCategory }> = [
      {
        keywords: ['formal', 'professional', 'tone', 'polite', 'casual'],
        category: 'tone',
      },
      {
        keywords: ['cite', 'source', 'reference', 'evidence', 'proof'],
        category: 'reasoning',
      },
      {
        keywords: ['format', 'structure', 'json', 'yaml', 'markdown'],
        category: 'format',
      },
      {
        keywords: ['comply', 'regulation', 'hipaa', 'gdpr', 'sox', 'legal'],
        category: 'regulation',
      },
      {
        keywords: ['safe', 'danger', 'risk', 'warning', 'caution'],
        category: 'safety',
      },
      {
        keywords: ['quality', 'accuracy', 'precision', 'correct'],
        category: 'quality',
      },
    ];

    for (const { keywords, category } of categoryMap) {
      if (keywords.some((kw) => lowerText.includes(kw))) {
        return category;
      }
    }

    return 'quality'; // Default
  }

  /**
   * Extract constraints from guideline
   */
  private extractConstraints(
    text: string,
    category: GCGCategory
  ): GCGConstraint[] {
    const constraints: GCGConstraint[] = [];
    const lowerText = text.toLowerCase();

    // Pattern-based extraction
    const patterns: Array<{
      pattern: RegExp | string;
      constraintFactory: () => GCGConstraint;
    }> = [];

    // Tone constraints
    if (category === 'tone') {
      if (lowerText.includes('formal')) {
        constraints.push({
          type: 'stylistic',
          enforcement: {
            action: 'require',
            target: 'tone',
            parameters: { formalityLevel: 'formal' },
          },
          severity: 'should',
          description: 'Use formal tone',
        });
      }

      if (lowerText.includes('casual')) {
        constraints.push({
          type: 'stylistic',
          enforcement: {
            action: 'require',
            target: 'tone',
            parameters: { formalityLevel: 'casual' },
          },
          severity: 'should',
          description: 'Use casual tone',
        });
      }
    }

    // Reasoning constraints
    if (category === 'reasoning') {
      if (lowerText.includes('cite') || lowerText.includes('source')) {
        constraints.push({
          type: 'semantic',
          enforcement: {
            action: 'require',
            target: 'citations',
            parameters: { minCitations: 1 },
          },
          severity: 'must',
          description: 'Include citations for claims',
        });
      }

      if (lowerText.includes('step-by-step')) {
        constraints.push({
          type: 'structural',
          enforcement: {
            action: 'require',
            target: 'structure',
            parameters: { format: 'sequential' },
          },
          severity: 'should',
          description: 'Use step-by-step reasoning',
        });
      }
    }

    // Format constraints
    if (category === 'format') {
      if (lowerText.includes('json')) {
        constraints.push({
          type: 'structural',
          enforcement: {
            action: 'require',
            target: 'format',
            parameters: { format: 'json' },
          },
          severity: 'must',
          description: 'Output must be valid JSON',
        });
      }

      if (lowerText.includes('markdown')) {
        constraints.push({
          type: 'structural',
          enforcement: {
            action: 'require',
            target: 'format',
            parameters: { format: 'markdown' },
          },
          severity: 'should',
          description: 'Use Markdown formatting',
        });
      }
    }

    // Regulation constraints
    if (category === 'regulation') {
      const frameworks = ['hipaa', 'gdpr', 'sox', 'ccpa', 'pci-dss'];
      frameworks.forEach((framework) => {
        if (lowerText.includes(framework)) {
          constraints.push({
            type: 'regulatory',
            enforcement: {
              action: 'validate',
              target: 'compliance',
              parameters: { framework: framework.toUpperCase() },
            },
            severity: 'must',
            description: `Must comply with ${framework.toUpperCase()}`,
          });
        }
      });
    }

    // Safety constraints
    if (category === 'safety') {
      if (lowerText.includes('warn') || lowerText.includes('caution')) {
        constraints.push({
          type: 'pragmatic',
          enforcement: {
            action: 'require',
            target: 'structure',
            parameters: { includeWarnings: true },
          },
          severity: 'must',
          description: 'Include safety warnings when applicable',
        });
      }
    }

    // Quality constraints
    if (category === 'quality') {
      if (lowerText.includes('accurate') || lowerText.includes('precision')) {
        constraints.push({
          type: 'semantic',
          enforcement: {
            action: 'validate',
            target: 'logic',
            parameters: { checkFactuality: true },
          },
          severity: 'must',
          description: 'Ensure factual accuracy',
        });
      }
    }

    // Lexical constraints (word choice)
    if (lowerText.includes('avoid') || lowerText.includes('do not use')) {
      // Extract forbidden words
      const forbiddenMatch = text.match(/avoid\s+["'](.+?)["']/i) ||
        text.match(/do not use\s+["'](.+?)["']/i);

      if (forbiddenMatch) {
        constraints.push({
          type: 'lexical',
          enforcement: {
            action: 'forbid',
            target: 'vocabulary',
            parameters: { forbiddenWords: [forbiddenMatch[1]] },
          },
          severity: 'should',
          description: `Avoid using "${forbiddenMatch[1]}"`,
        });
      }
    }

    // If no constraints extracted, create generic constraint
    if (constraints.length === 0) {
      constraints.push({
        type: 'pragmatic',
        enforcement: {
          action: 'prefer',
          target: 'structure',
          parameters: { guideline: text },
        },
        severity: this.config.defaultSeverity,
        description: text,
      });
    }

    return constraints;
  }

  /**
   * Infer severity from guideline
   */
  private inferSeverity(text: string): ConstraintSeverity {
    const lowerText = text.toLowerCase();

    // "must", "required", "mandatory" → must
    if (
      lowerText.includes('must') ||
      lowerText.includes('required') ||
      lowerText.includes('mandatory')
    ) {
      return 'must';
    }

    // "should", "recommended", "prefer" → should
    if (
      lowerText.includes('should') ||
      lowerText.includes('recommended') ||
      lowerText.includes('prefer')
    ) {
      return 'should';
    }

    // "may", "optional", "can" → may
    if (
      lowerText.includes('may') ||
      lowerText.includes('optional') ||
      lowerText.includes('can')
    ) {
      return 'may';
    }

    return this.config.defaultSeverity;
  }

  /**
   * Generate rule name from guideline
   */
  private generateRuleName(text: string): string {
    // Extract first few words
    const words = text
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .slice(0, 5);

    return words.join(' ').toLowerCase();
  }

  /**
   * Extract tags from guideline
   */
  private extractTags(text: string, category: GCGCategory): string[] {
    const tags: string[] = [category];
    const lowerText = text.toLowerCase();

    // Common tags
    const tagKeywords = [
      'formal',
      'casual',
      'cite',
      'source',
      'json',
      'markdown',
      'hipaa',
      'gdpr',
      'safe',
      'quality',
    ];

    tagKeywords.forEach((keyword) => {
      if (lowerText.includes(keyword)) {
        tags.push(keyword);
      }
    });

    return tags;
  }

  /**
   * Validate grammar
   */
  private validateGrammar(
    rules: GCGRule[]
  ): { warnings: string[]; errors: string[] } {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Check for empty grammar
    if (rules.length === 0) {
      warnings.push('Grammar is empty');
    }

    // Check for duplicate rules
    const ruleIds = new Set<string>();
    rules.forEach((rule) => {
      if (ruleIds.has(rule.id)) {
        warnings.push(`Duplicate rule ID: ${rule.id}`);
      }
      ruleIds.add(rule.id);
    });

    // Check for conflicting constraints
    const conflictingPairs: Array<{
      action: EnforcementAction;
      opposite: EnforcementAction;
    }> = [
      { action: 'require', opposite: 'forbid' },
      { action: 'prefer', opposite: 'avoid' },
    ];

    conflictingPairs.forEach(({ action, opposite }) => {
      const requireActions = rules
        .flatMap((r) => r.constraints)
        .filter((c) => c.enforcement.action === action);
      const forbidActions = rules
        .flatMap((r) => r.constraints)
        .filter((c) => c.enforcement.action === opposite);

      requireActions.forEach((req) => {
        forbidActions.forEach((forbid) => {
          if (req.enforcement.target === forbid.enforcement.target) {
            warnings.push(
              `Conflicting constraints: ${action} vs ${opposite} on ${req.enforcement.target}`
            );
          }
        });
      });
    });

    return { warnings, errors };
  }

  /**
   * Get configuration
   */
  getConfig(): GCGCompilerConfig {
    return { ...this.config };
  }
}

/**
 * Default singleton instance
 */
export const gcgCompiler = new GCGCompiler();

/**
 * Helper: Create guideline input
 */
export function createGuideline(
  text: string,
  options?: Partial<Omit<GuidelineInput, 'text'>>
): GuidelineInput {
  return {
    text,
    ...options,
  };
}
