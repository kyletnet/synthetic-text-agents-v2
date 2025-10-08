/**
 * Base Strategy Interface for Linguistics Engineering
 *
 * Defines the contract for all linguistics strategies following Strategy Pattern
 */

import type { LinguisticsAnalysisRequest } from "../linguistics-types.js";

export interface LinguisticsStrategy {
  /**
   * Execute the strategy with given request
   */
  execute(request: LinguisticsAnalysisRequest): Promise<unknown>;

  /**
   * Validate if the strategy can handle the request
   */
  canHandle(request: LinguisticsAnalysisRequest): boolean;

  /**
   * Get strategy name for logging and debugging
   */
  getName(): string;
}

/**
 * Abstract base class providing common functionality
 */
export abstract class BaseLinguisticsStrategy implements LinguisticsStrategy {
  constructor(protected readonly strategyName: string) {}

  abstract execute(request: LinguisticsAnalysisRequest): Promise<unknown>;

  canHandle(_request: LinguisticsAnalysisRequest): boolean {
    return true; // Default: all strategies can handle all requests
  }

  getName(): string {
    return this.strategyName;
  }
}
