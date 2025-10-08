/**
 * AOL (Augmentation Operator Library) Types
 *
 * Phase 2.7 - AOL Registry
 */

/**
 * Operator Definition
 */
export interface OperatorDefinition {
  // Identification
  id: string; // Unique operator ID (e.g., "op_paraphrase_simple")
  name: string; // Human-readable name
  description: string; // Purpose and usage

  // Categorization
  category: OperatorCategory;
  tags: string[]; // Searchable tags

  // Performance characteristics
  riskLevel: RiskLevel; // Safety/quality risk
  latency: number; // Expected latency (ms)
  costMultiplier: number; // Cost impact (1.0 = baseline)

  // Compatibility
  compatibility: CompatibilityTarget[];
  constraints?: string[]; // Usage constraints

  // Parameters
  parameters: OperatorParameters;

  // Metadata
  version: string;
  author?: string;
  createdAt: string; // ISO 8601
}

/**
 * Operator Categories
 */
export type OperatorCategory =
  | 'augmentation' // Text augmentation (paraphrase, synonym)
  | 'retrieval' // Retrieval enhancement (rerank, filter)
  | 'reasoning' // Reasoning support (logic, math)
  | 'validation' // Validation/verification (NLI, fact-check)
  | 'formatting' // Output formatting (structure, style)
  | 'domain-specific'; // Domain-specific operations

/**
 * Risk Levels
 */
export type RiskLevel =
  | 'low' // Minimal impact on quality
  | 'medium' // Moderate quality variance
  | 'high' // Significant quality risk
  | 'critical'; // Requires manual review

/**
 * Compatibility Targets
 */
export type CompatibilityTarget =
  | 'text-generation' // General text generation
  | 'qa' // Question answering
  | 'summarization' // Text summarization
  | 'reasoning' // Logical reasoning
  | 'retrieval' // Information retrieval
  | 'all'; // Compatible with all tasks

/**
 * Operator Parameters
 */
export interface OperatorParameters {
  // Common parameters
  intensity?: number; // 0-1 (operation strength)
  temperature?: number; // 0-2 (randomness)
  maxTokens?: number; // Token limit

  // Operator-specific parameters
  [key: string]: unknown;
}

/**
 * Operator Registry Index
 */
export interface OperatorRegistry {
  operators: OperatorDefinition[];
  metadata: {
    version: string;
    lastUpdated: string;
    totalOperators: number;
  };
}

/**
 * Operator Search Query
 */
export interface OperatorSearchQuery {
  category?: OperatorCategory;
  tags?: string[];
  maxRiskLevel?: RiskLevel;
  maxLatency?: number;
  compatibility?: CompatibilityTarget[];
  minVersion?: string;
}

/**
 * Operator Search Result
 */
export interface OperatorSearchResult {
  operators: OperatorDefinition[];
  metadata: {
    totalResults: number;
    query: OperatorSearchQuery;
  };
}
