/**
 * AOL Operator Registry Loader (Phase 2.7)
 *
 * "연산자 카탈로그가 있어야 Bandit가 탐색할 수 있다"
 * - ChatGPT Genius Insight
 *
 * Purpose:
 * - Load and manage operator registry
 * - Search and filter operators
 * - Validate operator compatibility
 *
 * Architecture:
 * Registry → Loader → Bandit/Pareto Orchestrator
 *
 * Expected Gain: Operator discoverability 100%, Search latency <1ms
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type {
  OperatorDefinition,
  OperatorRegistry,
  OperatorSearchQuery,
  OperatorSearchResult,
  OperatorCategory,
  RiskLevel,
  CompatibilityTarget,
} from './types';

/**
 * Operator Registry Loader
 *
 * Loads and searches operator registry
 */
export class OperatorRegistryLoader {
  private registry: OperatorRegistry | null = null;
  private indexByCategory: Map<OperatorCategory, OperatorDefinition[]> = new Map();
  private indexByTag: Map<string, OperatorDefinition[]> = new Map();
  private indexById: Map<string, OperatorDefinition> = new Map();

  constructor(private registryPath?: string) {
    this.registryPath =
      registryPath || join(process.cwd(), 'configs/aol/operator-registry.json');
  }

  /**
   * Load registry from file
   */
  load(): void {
    if (!existsSync(this.registryPath!)) {
      throw new Error(`Operator registry not found: ${this.registryPath}`);
    }

    const content = readFileSync(this.registryPath!, 'utf-8');
    this.registry = JSON.parse(content) as OperatorRegistry;

    // Build indexes
    this.buildIndexes();
  }

  /**
   * Build search indexes
   */
  private buildIndexes(): void {
    if (!this.registry) return;

    this.indexByCategory.clear();
    this.indexByTag.clear();
    this.indexById.clear();

    this.registry.operators.forEach((op) => {
      // Index by ID
      this.indexById.set(op.id, op);

      // Index by category
      if (!this.indexByCategory.has(op.category)) {
        this.indexByCategory.set(op.category, []);
      }
      this.indexByCategory.get(op.category)!.push(op);

      // Index by tags
      op.tags.forEach((tag) => {
        if (!this.indexByTag.has(tag)) {
          this.indexByTag.set(tag, []);
        }
        this.indexByTag.get(tag)!.push(op);
      });
    });
  }

  /**
   * Search operators
   */
  search(query: OperatorSearchQuery): OperatorSearchResult {
    if (!this.registry) {
      this.load();
    }

    let results = this.registry!.operators;

    // Filter by category
    if (query.category) {
      results = results.filter((op) => op.category === query.category);
    }

    // Filter by tags
    if (query.tags && query.tags.length > 0) {
      results = results.filter((op) =>
        query.tags!.some((tag) => op.tags.includes(tag))
      );
    }

    // Filter by risk level
    if (query.maxRiskLevel) {
      const riskOrder: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
      const maxRiskIndex = riskOrder.indexOf(query.maxRiskLevel);

      results = results.filter((op) => {
        const opRiskIndex = riskOrder.indexOf(op.riskLevel);
        return opRiskIndex <= maxRiskIndex;
      });
    }

    // Filter by latency
    if (query.maxLatency) {
      results = results.filter((op) => op.latency <= query.maxLatency!);
    }

    // Filter by compatibility
    if (query.compatibility && query.compatibility.length > 0) {
      results = results.filter((op) =>
        query.compatibility!.some(
          (target) =>
            op.compatibility.includes(target) || op.compatibility.includes('all')
        )
      );
    }

    // Filter by version
    if (query.minVersion) {
      results = results.filter((op) =>
        this.compareVersions(op.version, query.minVersion!) >= 0
      );
    }

    return {
      operators: results,
      metadata: {
        totalResults: results.length,
        query,
      },
    };
  }

  /**
   * Get operator by ID
   */
  getById(id: string): OperatorDefinition | undefined {
    if (!this.registry) {
      this.load();
    }

    return this.indexById.get(id);
  }

  /**
   * Get operators by category
   */
  getByCategory(category: OperatorCategory): OperatorDefinition[] {
    if (!this.registry) {
      this.load();
    }

    return this.indexByCategory.get(category) || [];
  }

  /**
   * Get operators by tag
   */
  getByTag(tag: string): OperatorDefinition[] {
    if (!this.registry) {
      this.load();
    }

    return this.indexByTag.get(tag) || [];
  }

  /**
   * Get all operators
   */
  getAll(): OperatorDefinition[] {
    if (!this.registry) {
      this.load();
    }

    return this.registry!.operators;
  }

  /**
   * Get registry metadata
   */
  getMetadata(): OperatorRegistry['metadata'] {
    if (!this.registry) {
      this.load();
    }

    return this.registry!.metadata;
  }

  /**
   * Validate operator compatibility
   */
  isCompatible(
    operator: OperatorDefinition,
    target: CompatibilityTarget
  ): boolean {
    return (
      operator.compatibility.includes(target) ||
      operator.compatibility.includes('all')
    );
  }

  /**
   * Check if operator meets risk constraint
   */
  meetsRiskConstraint(
    operator: OperatorDefinition,
    maxRiskLevel: RiskLevel
  ): boolean {
    const riskOrder: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
    const maxRiskIndex = riskOrder.indexOf(maxRiskLevel);
    const opRiskIndex = riskOrder.indexOf(operator.riskLevel);

    return opRiskIndex <= maxRiskIndex;
  }

  /**
   * Check if operator meets latency constraint
   */
  meetsLatencyConstraint(
    operator: OperatorDefinition,
    maxLatency: number
  ): boolean {
    return operator.latency <= maxLatency;
  }

  /**
   * Get recommended operators for domain
   *
   * Heuristic-based recommendation
   */
  getRecommendedForDomain(
    domain: string,
    maxRiskLevel: RiskLevel = 'medium',
    maxLatency: number = 300
  ): OperatorDefinition[] {
    if (!this.registry) {
      this.load();
    }

    // Domain-specific keywords
    const domainKeywords: Record<string, string[]> = {
      medical: ['medical', 'health', 'clinical', 'diagnosis'],
      financial: ['financial', 'finance', 'compliance', 'sec', 'finra'],
      legal: ['legal', 'law', 'regulation', 'compliance'],
      technical: ['technical', 'engineering', 'code', 'system'],
    };

    const keywords = domainKeywords[domain.toLowerCase()] || [];

    // Search by tags
    let results = this.registry!.operators.filter((op) =>
      op.tags.some((tag) => keywords.some((kw) => tag.includes(kw)))
    );

    // If no domain-specific operators, fall back to generic
    if (results.length === 0) {
      results = this.registry!.operators.filter((op) =>
        op.compatibility.includes('all')
      );
    }

    // Filter by constraints
    results = results.filter(
      (op) =>
        this.meetsRiskConstraint(op, maxRiskLevel) &&
        this.meetsLatencyConstraint(op, maxLatency)
    );

    // Sort by cost multiplier (prefer cheaper operators)
    return results.sort((a, b) => a.costMultiplier - b.costMultiplier);
  }

  /**
   * Estimate total cost multiplier for operator set
   */
  estimateCostMultiplier(operatorIds: string[]): number {
    if (!this.registry) {
      this.load();
    }

    let totalMultiplier = 1.0;

    operatorIds.forEach((id) => {
      const op = this.indexById.get(id);
      if (op) {
        totalMultiplier *= op.costMultiplier;
      }
    });

    return totalMultiplier;
  }

  /**
   * Estimate total latency for operator set
   */
  estimateLatency(operatorIds: string[]): number {
    if (!this.registry) {
      this.load();
    }

    let totalLatency = 0;

    operatorIds.forEach((id) => {
      const op = this.indexById.get(id);
      if (op) {
        totalLatency += op.latency;
      }
    });

    return totalLatency;
  }

  /**
   * Get maximum risk level in operator set
   */
  getMaxRiskLevel(operatorIds: string[]): RiskLevel {
    if (!this.registry) {
      this.load();
    }

    const riskOrder: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
    let maxRiskIndex = 0;

    operatorIds.forEach((id) => {
      const op = this.indexById.get(id);
      if (op) {
        const opRiskIndex = riskOrder.indexOf(op.riskLevel);
        if (opRiskIndex > maxRiskIndex) {
          maxRiskIndex = opRiskIndex;
        }
      }
    });

    return riskOrder[maxRiskIndex];
  }

  /**
   * Compare semantic versions
   *
   * Returns: -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;

      if (p1 < p2) return -1;
      if (p1 > p2) return 1;
    }

    return 0;
  }

  /**
   * Reload registry (for testing or hot-reload)
   */
  reload(): void {
    this.registry = null;
    this.indexByCategory.clear();
    this.indexByTag.clear();
    this.indexById.clear();
    this.load();
  }
}

/**
 * Default singleton instance
 */
export const operatorRegistryLoader = new OperatorRegistryLoader();

/**
 * Helper: Create search query builder
 */
export class OperatorSearchQueryBuilder {
  private query: OperatorSearchQuery = {};

  category(category: OperatorCategory): this {
    this.query.category = category;
    return this;
  }

  tags(...tags: string[]): this {
    this.query.tags = tags;
    return this;
  }

  maxRiskLevel(level: RiskLevel): this {
    this.query.maxRiskLevel = level;
    return this;
  }

  maxLatency(latency: number): this {
    this.query.maxLatency = latency;
    return this;
  }

  compatibility(...targets: CompatibilityTarget[]): this {
    this.query.compatibility = targets;
    return this;
  }

  minVersion(version: string): this {
    this.query.minVersion = version;
    return this;
  }

  build(): OperatorSearchQuery {
    return this.query;
  }
}

/**
 * Helper: Create search query
 */
export function createSearchQuery(): OperatorSearchQueryBuilder {
  return new OperatorSearchQueryBuilder();
}
