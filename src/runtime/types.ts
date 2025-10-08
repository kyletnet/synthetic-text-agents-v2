/**
 * Runtime Layer Types
 *
 * Core type definitions for 4-Layer Runtime (L1-L4)
 * - L1: Retrieval (BM25 + Vector + Re-ranking)
 * - L2: Synthesizer (Intent + Slot extraction)
 * - L3: Planner (AOL + GCG orchestration)
 * - L4: Optimizer (Bandit + Pareto + Feedback)
 */

// ============================================================================
// L1: Retrieval Types
// ============================================================================

/**
 * Document chunk with metadata
 */
export interface Chunk {
  id: string;
  text: string;
  sourceId: string;
  sourceName: string;
  trustScore?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Evidence chunk with provenance
 */
export interface Evidence {
  id: string;
  text: string;
  sourceId: string;
  trustScore: number;
  retrievalStrategy: 'bm25' | 'vector' | 'hybrid' | 'splade' | 'colbert';
  citations?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Re-ranking result
 */
export interface RerankResult {
  chunkId: string;
  score: number;
  originalRank: number;
  newRank: number;
}

/**
 * Retrieval configuration
 */
export interface RetrievalConfig {
  alpha: number; // BM25 weight
  beta: number; // Vector weight
  topK: number;
  minTrustScore?: number;
  rerankEnabled?: boolean;
  fusionStrategy?: 'rrf' | 'mmr' | 'none';
}

// ============================================================================
// L2: Synthesizer Types
// ============================================================================

/**
 * User intent classification
 */
export type UserIntent =
  | 'incorrect'
  | 'insufficient'
  | 'evidence'
  | 'brevity'
  | 'contrast'
  | 'lexicon'
  | 'structure'
  | 'coverage'
  | 'tone'
  | 'other';

/**
 * Intent classification result
 */
export interface IntentResult {
  intent: UserIntent;
  confidence: number; // 0-1
  modifiers: string[];
}

/**
 * Query context
 */
export interface QueryContext {
  query: string;
  intent?: IntentResult;
  slots?: Record<string, unknown>;
  domain?: string;
  tenantId?: string;
}

// ============================================================================
// L3: Planner Types
// ============================================================================

/**
 * Operator metadata
 */
export interface OperatorMeta {
  id: string;
  version: string;
  category: 'semantic' | 'cognitive' | 'structural' | 'domain';
  status: 'champion' | 'canary' | 'deprecated';
  evidenceLevel: 'required' | 'optional' | 'none';
  costTier: number; // 1-5 (1=cheapest)
  riskLevel: 'low' | 'medium' | 'high';
  performance: {
    avgLatencyMs: number;
    successRate: number;
  };
}

/**
 * Operator interface (Abstract)
 */
export interface Operator {
  id: string;
  apply(text: string, evidence?: Evidence[]): Promise<string>;
}

/**
 * Decoding constraints
 */
export interface DecodingConstraints {
  citationMandatory: boolean;
  spanCopyOnly: boolean;
  evidenceIds: string[];
  maxNewTokens: number;
  numericFormat?: string;
  structureFormat?: 'bullet' | 'paragraph' | 'table';
}

// ============================================================================
// L4: Optimizer Types
// ============================================================================

/**
 * User feedback
 */
export interface UserFeedback {
  id: string;
  intent: UserIntent;
  modifiers: string[];
  confidence: number;
  text?: string;
  timestamp: Date;
  userId?: string;
  tenantId?: string;
}

/**
 * System parameters (derived from feedback)
 */
export interface SystemParameters {
  retrieval?: Partial<RetrievalConfig>;
  operators?: string[];
  gcg?: Partial<DecodingConstraints>;
  reward?: {
    groundednessWeight?: number;
    coverageWeight?: number;
    readabilityWeight?: number;
    diversityWeight?: number;
    originalityWeight?: number;
  };
}

/**
 * Bandit action
 */
export interface Action {
  model: string;
  prompt: string;
  operators: string[];
  temperature?: number;
}

/**
 * Bandit context
 */
export interface Context {
  tenantId: string;
  domain: string;
  docType: string;
  budget: number;
  sla: number; // Latency SLA in ms
}

/**
 * Reward signal
 */
export interface Reward {
  naturalness: number;
  groundedness: number;
  originality: number;
  compliance: number;
  toneConsistency: number;
  composite?: number;
}

// ============================================================================
// Common Types
// ============================================================================

/**
 * Feature scores
 */
export interface Features {
  groundedness: number;
  naturalness: number;
  originality: number;
  compliance: number;
  tone: number;
}

/**
 * Preference pair (for reward training)
 */
export interface PreferencePair {
  preferred: string;
  rejected: string;
  features?: {
    preferred: Features;
    rejected: Features;
  };
}

/**
 * Reward model interface
 */
export interface RewardModel {
  score(response: string): Promise<Reward>;
}

/**
 * Feedback mapping (from feedback-mapping.json)
 */
export interface FeedbackMapping {
  intent_to_params: Record<UserIntent, SystemParameters>;
  modifiers: Record<string, SystemParameters>;
}
