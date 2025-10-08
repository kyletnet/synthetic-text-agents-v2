/**
 * Pattern Learner (Phase 3.2 - Knowledge Skeletonization)
 *
 * "추론 패턴은 전문가의 DNA다"
 * - ChatGPT Genius Insight
 *
 * Purpose:
 * - Learn reasoning patterns from knowledge graph
 * - Identify recurring inference structures
 * - Enable pattern-based reasoning
 *
 * Architecture:
 * This is the THIRD COMPONENT of Knowledge Skeletonization Layer:
 * Skeleton Extractor → Knowledge Graph Builder → **Pattern Learner**
 *
 * Learning Strategy:
 * 1. Motif Detection (graph motif mining)
 * 2. Path Pattern Mining (frequent path patterns)
 * 3. Causal Pattern Discovery (cause-effect chains)
 * 4. Hierarchical Pattern Discovery (taxonomy structures)
 *
 * Expected Gain: Reasoning speed ×2, Pattern accuracy ≥85%
 *
 * @see ChatGPT Master Directive: "Pattern > Instance"
 */

import type { KnowledgeGraph, ConceptNode, RelationEdge } from './knowledge-graph-builder';
import type { ReasoningPattern, PatternType } from './skeleton-extractor';

/**
 * Learned Pattern (discovered from graph)
 */
export interface LearnedPattern {
  id: string;
  type: PatternType;

  // Pattern structure
  structure: PatternStructure;

  // Pattern instances
  instances: PatternInstance[];

  // Statistics
  frequency: number; // Number of instances
  confidence: number; // 0-1 (pattern reliability)
  support: number; // 0-1 (graph coverage)

  // Pattern template
  template: string;
  formalRepresentation?: string;
}

/**
 * Pattern Structure (graph motif)
 */
export interface PatternStructure {
  // Nodes in pattern
  nodes: Array<{
    role: string; // e.g., "cause", "effect", "condition"
    conceptType?: string; // Optional: specific concept type
  }>;

  // Edges in pattern
  edges: Array<{
    source: string; // Node role
    target: string; // Node role
    relationType: string;
  }>;

  // Constraints
  constraints?: Array<{
    type: 'temporal' | 'logical' | 'cardinality';
    description: string;
  }>;
}

/**
 * Pattern Instance (concrete example)
 */
export interface PatternInstance {
  // Mapped concepts
  conceptMapping: Record<string, string>; // role → conceptId

  // Evidence
  evidenceEdges: string[]; // Edge IDs

  // Confidence
  confidence: number; // 0-1
}

/**
 * Pattern Learner Config
 */
export interface PatternLearnerConfig {
  // Motif detection
  minMotifSize: number; // Default: 2
  maxMotifSize: number; // Default: 5

  // Pattern mining
  minSupport: number; // Default: 0.1 (10% of graph)
  minConfidence: number; // Default: 0.6
  minFrequency: number; // Default: 3

  // Pattern types to learn
  enableCausal: boolean; // Default: true
  enableSequential: boolean; // Default: true
  enableHierarchical: boolean; // Default: true
  enableDiagnostic: boolean; // Default: true
}

/**
 * Pattern Learner
 *
 * Learns reasoning patterns from knowledge graph
 */
export class PatternLearner {
  private config: PatternLearnerConfig;

  constructor(config?: Partial<PatternLearnerConfig>) {
    this.config = {
      minMotifSize: config?.minMotifSize ?? 2,
      maxMotifSize: config?.maxMotifSize ?? 5,
      minSupport: config?.minSupport ?? 0.1,
      minConfidence: config?.minConfidence ?? 0.6,
      minFrequency: config?.minFrequency ?? 3,
      enableCausal: config?.enableCausal ?? true,
      enableSequential: config?.enableSequential ?? true,
      enableHierarchical: config?.enableHierarchical ?? true,
      enableDiagnostic: config?.enableDiagnostic ?? true,
    };
  }

  /**
   * Learn patterns from knowledge graph
   *
   * Main entry point
   */
  async learn(graph: KnowledgeGraph): Promise<LearnedPattern[]> {
    const patterns: LearnedPattern[] = [];

    // 1. Learn Causal Patterns (A → B)
    if (this.config.enableCausal) {
      const causalPatterns = this.learnCausalPatterns(graph);
      patterns.push(...causalPatterns);
    }

    // 2. Learn Sequential Patterns (A → B → C)
    if (this.config.enableSequential) {
      const sequentialPatterns = this.learnSequentialPatterns(graph);
      patterns.push(...sequentialPatterns);
    }

    // 3. Learn Hierarchical Patterns (A contains B, C)
    if (this.config.enableHierarchical) {
      const hierarchicalPatterns = this.learnHierarchicalPatterns(graph);
      patterns.push(...hierarchicalPatterns);
    }

    // 4. Learn Diagnostic Patterns (symptoms → diagnosis)
    if (this.config.enableDiagnostic) {
      const diagnosticPatterns = this.learnDiagnosticPatterns(graph);
      patterns.push(...diagnosticPatterns);
    }

    // Filter by support and confidence
    return patterns
      .filter((p) => p.support >= this.config.minSupport)
      .filter((p) => p.confidence >= this.config.minConfidence)
      .filter((p) => p.frequency >= this.config.minFrequency)
      .sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Step 1: Learn Causal Patterns
   *
   * Find "A causes B" patterns
   */
  private learnCausalPatterns(graph: KnowledgeGraph): LearnedPattern[] {
    const patterns: LearnedPattern[] = [];
    const causalEdges = graph.indexes.edgesByType.get('causes') || [];

    if (causalEdges.length === 0) return patterns;

    // Group by edge structure
    const structureGroups = new Map<string, RelationEdge[]>();

    causalEdges.forEach((edge) => {
      const source = graph.indexes.nodeById.get(edge.relation.source);
      const target = graph.indexes.nodeById.get(edge.relation.target);

      if (source && target) {
        const key = `${source.concept.type}-causes-${target.concept.type}`;
        if (!structureGroups.has(key)) {
          structureGroups.set(key, []);
        }
        structureGroups.get(key)!.push(edge);
      }
    });

    // Create patterns for each group
    structureGroups.forEach((edges, key) => {
      if (edges.length < this.config.minFrequency) return;

      const [sourceType, , targetType] = key.split('-');

      const instances: PatternInstance[] = edges.map((edge) => ({
        conceptMapping: {
          cause: edge.relation.source,
          effect: edge.relation.target,
        },
        evidenceEdges: [edge.id],
        confidence: edge.weight,
      }));

      const avgConfidence =
        instances.reduce((sum, inst) => sum + inst.confidence, 0) / instances.length;

      patterns.push({
        id: `causal_${patterns.length}`,
        type: 'causal',
        structure: {
          nodes: [
            { role: 'cause', conceptType: sourceType },
            { role: 'effect', conceptType: targetType },
          ],
          edges: [
            {
              source: 'cause',
              target: 'effect',
              relationType: 'causes',
            },
          ],
        },
        instances,
        frequency: instances.length,
        confidence: avgConfidence,
        support: instances.length / graph.nodes.length,
        template: 'If {cause} then {effect}',
        formalRepresentation: 'cause(X) ⇒ effect(Y)',
      });
    });

    return patterns;
  }

  /**
   * Step 2: Learn Sequential Patterns
   *
   * Find "A → B → C" patterns
   */
  private learnSequentialPatterns(graph: KnowledgeGraph): LearnedPattern[] {
    const patterns: LearnedPattern[] = [];
    const sequentialEdges = graph.indexes.edgesByType.get('precedes') || [];

    if (sequentialEdges.length < 2) return patterns;

    // Find chains of length 2-3
    const chains = this.findChains(graph, sequentialEdges, 3);

    // Group by structure
    const structureGroups = new Map<string, typeof chains>();

    chains.forEach((chain) => {
      const types = chain.nodes.map((nodeId) => {
        const node = graph.indexes.nodeById.get(nodeId);
        return node?.concept.type || 'unknown';
      });
      const key = types.join('-');

      if (!structureGroups.has(key)) {
        structureGroups.set(key, []);
      }
      structureGroups.get(key)!.push(chain);
    });

    // Create patterns
    structureGroups.forEach((chainList, key) => {
      if (chainList.length < this.config.minFrequency) return;

      const types = key.split('-');
      const instances: PatternInstance[] = chainList.map((chain) => {
        const mapping: Record<string, string> = {};
        chain.nodes.forEach((nodeId, idx) => {
          mapping[`step${idx + 1}`] = nodeId;
        });

        return {
          conceptMapping: mapping,
          evidenceEdges: chain.edges,
          confidence: 0.7, // Placeholder
        };
      });

      const avgConfidence =
        instances.reduce((sum, inst) => sum + inst.confidence, 0) / instances.length;

      patterns.push({
        id: `sequential_${patterns.length}`,
        type: 'sequential',
        structure: {
          nodes: types.map((type, idx) => ({
            role: `step${idx + 1}`,
            conceptType: type,
          })),
          edges: types.slice(0, -1).map((_, idx) => ({
            source: `step${idx + 1}`,
            target: `step${idx + 2}`,
            relationType: 'precedes',
          })),
        },
        instances,
        frequency: instances.length,
        confidence: avgConfidence,
        support: instances.length / graph.nodes.length,
        template: types.map((_, idx) => `{step${idx + 1}}`).join(' → '),
      });
    });

    return patterns;
  }

  /**
   * Step 3: Learn Hierarchical Patterns
   *
   * Find "A is-a B" or "A has-a B" patterns
   */
  private learnHierarchicalPatterns(graph: KnowledgeGraph): LearnedPattern[] {
    const patterns: LearnedPattern[] = [];
    const hierarchicalEdges = [
      ...(graph.indexes.edgesByType.get('is-a') || []),
      ...(graph.indexes.edgesByType.get('has-a') || []),
    ];

    if (hierarchicalEdges.length === 0) return patterns;

    // Find parent nodes with multiple children
    const parentChildren = new Map<string, Array<{ childId: string; edgeId: string }>>();

    hierarchicalEdges.forEach((edge) => {
      const parent = edge.relation.source;
      if (!parentChildren.has(parent)) {
        parentChildren.set(parent, []);
      }
      parentChildren.get(parent)!.push({
        childId: edge.relation.target,
        edgeId: edge.id,
      });
    });

    // Create patterns for parents with 2+ children
    parentChildren.forEach((children, parentId) => {
      if (children.length < 2) return;

      const parent = graph.indexes.nodeById.get(parentId);
      if (!parent) return;

      const instances: PatternInstance[] = [
        {
          conceptMapping: {
            parent: parentId,
            ...Object.fromEntries(
              children.map((c, idx) => [`child${idx + 1}`, c.childId])
            ),
          },
          evidenceEdges: children.map((c) => c.edgeId),
          confidence: 0.8,
        },
      ];

      patterns.push({
        id: `hierarchical_${patterns.length}`,
        type: 'hierarchical',
        structure: {
          nodes: [
            { role: 'parent', conceptType: parent.concept.type },
            ...children.map((_, idx) => ({
              role: `child${idx + 1}`,
            })),
          ],
          edges: children.map((_, idx) => ({
            source: 'parent',
            target: `child${idx + 1}`,
            relationType: 'has-a',
          })),
        },
        instances,
        frequency: 1,
        confidence: 0.8,
        support: (1 + children.length) / graph.nodes.length,
        template: '{parent} contains {child1}, {child2}, ...',
      });
    });

    return patterns;
  }

  /**
   * Step 4: Learn Diagnostic Patterns
   *
   * Find "symptoms → diagnosis" patterns
   */
  private learnDiagnosticPatterns(graph: KnowledgeGraph): LearnedPattern[] {
    const patterns: LearnedPattern[] = [];

    // Look for nodes with high in-degree (potential diagnoses)
    const potentialDiagnoses = graph.nodes
      .filter((node) => node.inDegree >= 3)
      .sort((a, b) => b.inDegree - a.inDegree)
      .slice(0, 20); // Top 20

    potentialDiagnoses.forEach((diagnosis) => {
      const incomingEdges = graph.indexes.edgesByTarget.get(diagnosis.id) || [];

      if (incomingEdges.length < 3) return;

      // Group incoming edges by type
      const symptomEdges = incomingEdges.filter((edge) =>
        ['causes', 'correlates'].includes(edge.relation.type)
      );

      if (symptomEdges.length < 3) return;

      const instances: PatternInstance[] = [
        {
          conceptMapping: {
            diagnosis: diagnosis.id,
            ...Object.fromEntries(
              symptomEdges.map((e, idx) => [`symptom${idx + 1}`, e.relation.source])
            ),
          },
          evidenceEdges: symptomEdges.map((e) => e.id),
          confidence: 0.75,
        },
      ];

      patterns.push({
        id: `diagnostic_${patterns.length}`,
        type: 'diagnostic',
        structure: {
          nodes: [
            { role: 'diagnosis', conceptType: diagnosis.concept.type },
            ...symptomEdges.map((_, idx) => ({
              role: `symptom${idx + 1}`,
            })),
          ],
          edges: symptomEdges.map((_, idx) => ({
            source: `symptom${idx + 1}`,
            target: 'diagnosis',
            relationType: 'causes',
          })),
        },
        instances,
        frequency: 1,
        confidence: 0.75,
        support: (1 + symptomEdges.length) / graph.nodes.length,
        template: 'If {symptom1}, {symptom2}, ... then likely {diagnosis}',
      });
    });

    return patterns;
  }

  // ========== Helper Methods ==========

  /**
   * Find chains in graph
   */
  private findChains(
    graph: KnowledgeGraph,
    edges: RelationEdge[],
    maxLength: number
  ): Array<{ nodes: string[]; edges: string[] }> {
    const chains: Array<{ nodes: string[]; edges: string[] }> = [];

    // Build adjacency for precedes edges
    const adjacency = new Map<string, Array<{ target: string; edgeId: string }>>();
    edges.forEach((edge) => {
      if (!adjacency.has(edge.relation.source)) {
        adjacency.set(edge.relation.source, []);
      }
      adjacency.get(edge.relation.source)!.push({
        target: edge.relation.target,
        edgeId: edge.id,
      });
    });

    // DFS to find chains
    const dfs = (
      current: string,
      path: string[],
      edgePath: string[],
      visited: Set<string>
    ) => {
      if (path.length >= maxLength) {
        if (path.length >= 2) {
          chains.push({ nodes: [...path], edges: [...edgePath] });
        }
        return;
      }

      const neighbors = adjacency.get(current) || [];
      neighbors.forEach(({ target, edgeId }) => {
        if (!visited.has(target)) {
          visited.add(target);
          dfs(target, [...path, target], [...edgePath, edgeId], visited);
          visited.delete(target);
        }
      });

      // Save current chain if length >= 2
      if (path.length >= 2) {
        chains.push({ nodes: [...path], edges: [...edgePath] });
      }
    };

    // Start DFS from each node
    edges.forEach((edge) => {
      const visited = new Set<string>([edge.relation.source]);
      dfs(edge.relation.source, [edge.relation.source], [], visited);
    });

    return chains;
  }

  /**
   * Get configuration
   */
  getConfig(): PatternLearnerConfig {
    return { ...this.config };
  }

  // ========== Pattern Application ==========

  /**
   * Apply pattern to new instance
   *
   * Given a partial match, complete the pattern
   */
  applyPattern(
    pattern: LearnedPattern,
    partialMapping: Record<string, string>,
    graph: KnowledgeGraph
  ): string[] {
    // Find nodes that match the pattern structure
    const candidates: string[] = [];

    // Get roles that need to be filled
    const missingRoles = pattern.structure.nodes
      .map((n) => n.role)
      .filter((role) => !partialMapping[role]);

    if (missingRoles.length === 0) {
      return []; // Pattern already complete
    }

    // For each missing role, find candidates
    missingRoles.forEach((role) => {
      const node = pattern.structure.nodes.find((n) => n.role === role);
      if (!node) return;

      // Find nodes of matching type
      const matchingNodes = node.conceptType
        ? graph.indexes.nodesByType.get(node.conceptType) || []
        : graph.nodes;

      matchingNodes.forEach((candidate) => {
        candidates.push(candidate.id);
      });
    });

    return candidates;
  }
}

/**
 * Default singleton instance
 */
export const patternLearner = new PatternLearner();
