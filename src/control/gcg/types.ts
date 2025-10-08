/**
 * GCG (Guideline Constraint Grammar) Types
 *
 * Phase 2.7 - GCG Compiler
 */

/**
 * GCG Rule (formal constraint from guideline)
 */
export interface GCGRule {
  // Identification
  id: string; // Unique rule ID
  name: string; // Human-readable name

  // Categorization
  category: GCGCategory;
  tags: string[];

  // Source
  guideline: string; // Original natural language guideline

  // Formal representation
  constraints: GCGConstraint[];

  // Priority
  priority: number; // 0-1 (higher = more important)
  severity: ConstraintSeverity;

  // Metadata
  version: string;
  createdAt: string; // ISO 8601
}

/**
 * GCG Categories
 */
export type GCGCategory =
  | 'tone' // Tone and formality
  | 'reasoning' // Reasoning style
  | 'format' // Output format
  | 'regulation' // Regulatory compliance
  | 'safety' // Safety constraints
  | 'quality'; // Quality requirements

/**
 * GCG Constraint (individual constraint)
 */
export interface GCGConstraint {
  // Type
  type: ConstraintType;

  // Condition (when to apply)
  condition?: ConstraintCondition;

  // Enforcement (what to enforce)
  enforcement: ConstraintEnforcement;

  // Severity
  severity: ConstraintSeverity;

  // Description
  description: string;
}

/**
 * Constraint Types
 */
export type ConstraintType =
  | 'lexical' // Word choice, vocabulary
  | 'syntactic' // Sentence structure
  | 'semantic' // Meaning, context
  | 'pragmatic' // Usage, context-appropriateness
  | 'stylistic' // Style, tone
  | 'structural' // Document structure
  | 'logical' // Logical consistency
  | 'regulatory'; // Regulatory compliance

/**
 * Constraint Condition
 */
export interface ConstraintCondition {
  // Context
  domain?: string; // Apply only in specific domain
  taskType?: string; // Apply only for specific task

  // Content
  hasKeyword?: string[]; // Apply if content contains keywords
  contentLength?: {
    min?: number;
    max?: number;
  };

  // User
  userType?: string; // Apply for specific user type (e.g., "expert", "novice")

  // Custom logic
  customCondition?: string; // JavaScript expression
}

/**
 * Constraint Enforcement
 */
export interface ConstraintEnforcement {
  // Action
  action: EnforcementAction;

  // Target
  target: EnforcementTarget;

  // Parameters
  parameters?: Record<string, unknown>;

  // Examples
  examples?: string[];
}

/**
 * Enforcement Actions
 */
export type EnforcementAction =
  | 'require' // Must include/satisfy
  | 'forbid' // Must not include/satisfy
  | 'prefer' // Should include/satisfy (soft)
  | 'avoid' // Should not include/satisfy (soft)
  | 'transform' // Transform to satisfy
  | 'validate'; // Validate against rule

/**
 * Enforcement Targets
 */
export type EnforcementTarget =
  | 'vocabulary' // Word choice
  | 'tone' // Formality level
  | 'structure' // Document structure
  | 'format' // Output format
  | 'citations' // Citation requirements
  | 'length' // Content length
  | 'logic' // Logical consistency
  | 'compliance'; // Regulatory compliance

/**
 * Constraint Severity
 */
export type ConstraintSeverity =
  | 'must' // Hard constraint (violation = failure)
  | 'should' // Soft constraint (violation = warning)
  | 'may'; // Optional (violation = suggestion)

/**
 * GCG Grammar (collection of rules)
 */
export interface GCGGrammar {
  // Identification
  id: string;
  name: string;
  description: string;

  // Rules
  rules: GCGRule[];

  // Metadata
  metadata: {
    version: string;
    domain?: string;
    createdAt: string;
    totalRules: number;
  };
}

/**
 * GCG Compilation Result
 */
export interface GCGCompilationResult {
  // Compiled grammar
  grammar: GCGGrammar;

  // Statistics
  stats: {
    totalGuidelines: number;
    totalRules: number;
    totalConstraints: number;
    avgConstraintsPerRule: number;
  };

  // Warnings/Errors
  warnings: string[];
  errors: string[];
}
