/**
 * Cognitive Strategy Interface
 *
 * Base interface for all cognitive analysis strategies.
 * Implements the Strategy pattern for expert thinking analysis.
 */

import type { Logger } from "../../shared/logger.js";

/**
 * Request for cognitive analysis
 */
export interface CognitiveAnalysisRequest {
  expertDomain: string;
  expertiseLevel: "professional" | "expert" | "specialist";
  taskType: string;
  cognitiveComplexity: number;
  expertMaterials?: {
    decisionExamples?: string[];
    processDescriptions?: string[];
    expertInterviews?: string[];
    caseStudies?: string[];
  };
  learningObjectives?: string[];
}

/**
 * Context for cognitive analysis
 */
export interface CognitiveContext {
  request: CognitiveAnalysisRequest;
  logger: Logger;
  metadata?: Record<string, unknown>;
}

/**
 * Result of strategy analysis
 */
export interface StrategyAnalysisResult<T> {
  /** Strategy identifier */
  strategyId: string;

  /** Analysis result data */
  data: T;

  /** Confidence in the analysis (0-1) */
  confidence: number;

  /** Processing duration in milliseconds */
  duration: number;

  /** Metadata about the analysis */
  metadata?: Record<string, unknown>;
}

/**
 * Base interface for cognitive strategies
 *
 * All cognitive strategies must implement this interface to ensure
 * consistent behavior and integration with the cognitive scientist service.
 */
export interface CognitiveStrategy<TInput, TOutput> {
  /** Unique strategy identifier */
  readonly id: string;

  /** Human-readable strategy name */
  readonly name: string;

  /** Strategy description */
  readonly description: string;

  /**
   * Analyze input and produce output
   *
   * @param input - Input data for analysis
   * @param context - Cognitive analysis context
   * @returns Strategy analysis result
   */
  analyze(
    input: TInput,
    context: CognitiveContext,
  ): Promise<StrategyAnalysisResult<TOutput>>;

  /**
   * Validate input before analysis
   *
   * @param input - Input to validate
   * @returns True if valid, false otherwise
   */
  validateInput(input: TInput): boolean;

  /**
   * Synthesize results from this strategy with others
   *
   * @param results - Results from multiple strategy executions
   * @param context - Cognitive analysis context
   * @returns Synthesized result
   */
  synthesize?(
    results: StrategyAnalysisResult<TOutput>[],
    context: CognitiveContext,
  ): Promise<TOutput>;
}

/**
 * Abstract base class for cognitive strategies
 *
 * Provides common functionality for all strategies including:
 * - Logging
 * - Performance tracking
 * - Input validation helpers
 * - Error handling
 */
export abstract class BaseCognitiveStrategy<TInput, TOutput>
  implements CognitiveStrategy<TInput, TOutput>
{
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string,
  ) {}

  /**
   * Analyze input and produce output with timing and logging
   */
  async analyze(
    input: TInput,
    context: CognitiveContext,
  ): Promise<StrategyAnalysisResult<TOutput>> {
    const startTime = Date.now();

    context.logger.debug(`Starting ${this.name} analysis`, {
      strategyId: this.id,
      domain: context.request.expertDomain,
      complexity: context.request.cognitiveComplexity,
    });

    // Validate input
    if (!this.validateInput(input)) {
      throw new Error(`Invalid input for strategy ${this.id}`);
    }

    try {
      // Perform analysis
      const data = await this.performAnalysis(input, context);

      // Calculate confidence
      const confidence = await this.calculateConfidence(data, context);

      const duration = Date.now() - startTime;

      context.logger.debug(`Completed ${this.name} analysis`, {
        strategyId: this.id,
        confidence,
        duration,
      });

      return {
        strategyId: this.id,
        data,
        confidence,
        duration,
        metadata: await this.collectMetadata(data, context),
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      context.logger.error(`Failed ${this.name} analysis`, {
        strategyId: this.id,
        error: error instanceof Error ? error.message : String(error),
        duration,
      });

      throw error;
    }
  }

  /**
   * Perform the actual analysis (implemented by subclasses)
   */
  protected abstract performAnalysis(
    input: TInput,
    context: CognitiveContext,
  ): Promise<TOutput>;

  /**
   * Calculate confidence in the analysis result
   */
  protected abstract calculateConfidence(
    output: TOutput,
    context: CognitiveContext,
  ): Promise<number>;

  /**
   * Collect metadata about the analysis
   */
  protected async collectMetadata(
    _output: TOutput,
    _context: CognitiveContext,
  ): Promise<Record<string, unknown>> {
    return {};
  }

  /**
   * Default input validation (can be overridden)
   */
  validateInput(input: TInput): boolean {
    return input !== null && input !== undefined;
  }
}
