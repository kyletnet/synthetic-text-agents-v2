#!/usr/bin/env tsx
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */


/**
 * Component Harmony Analyzer
 * Measures and tracks system component harmony with concrete metrics
 * Implements GPT recommendation for clear metric definitions and tracking
 */

import { EventEmitter } from "events";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  statSync,
} from "fs";
import { join, extname, relative } from "path";
import { execSync } from "child_process";

export interface DependencyNode {
  name: string;
  path: string;
  dependencies: string[];
  dependents: string[];
  type: "script" | "component" | "utility" | "config";
  complexity: number;
  size: number;
}

export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: Array<{ from: string; to: string; weight: number }>;
  cycles: string[][];
  depth: number;
  entropy: number;
}

export interface InterfaceMetric {
  component: string;
  publicMethods: number;
  parameters: number;
  returnComplexity: number;
  consistency: number; // 0-1 scale
}

export interface CommunicationPattern {
  source: string;
  target: string;
  frequency: number;
  latency: number;
  errorRate: number;
  protocol: "direct" | "hub" | "event" | "api";
}

export interface HarmonyMetrics {
  componentHarmony: number;
  dependencyHealth: number;
  interfaceConsistency: number;
  communicationEfficiency: number;
  overall: number;
}

export interface HarmonyAnalysis {
  timestamp: Date;
  metrics: HarmonyMetrics;
  graph: DependencyGraph;
  interfaces: InterfaceMetric[];
  communications: CommunicationPattern[];
  issues: Array<{
    type: "cycle" | "complexity" | "inconsistency" | "bottleneck";
    severity: "low" | "medium" | "high" | "critical";
    component: string;
    description: string;
    recommendation: string;
  }>;
  trends: Array<{
    timestamp: Date;
    metric: string;
    value: number;
    change: number;
  }>;
}

/**
 * Component Harmony Analyzer - Concrete metrics for system harmony
 */
export class ComponentHarmonyAnalyzer extends EventEmitter {
  private projectRoot = process.cwd();
  private analysisHistory: HarmonyAnalysis[] = [];
  private analysisPath = join(
    this.projectRoot,
    "reports",
    "harmony-analysis.json",
  );

  constructor() {
    super();
    this.setMaxListeners(50);
    this.loadHistoricalAnalysis();
  }

  /**
   * Perform comprehensive harmony analysis
   */
  async analyzeHarmony(): Promise<HarmonyAnalysis> {
    console.log("🎵 Analyzing component harmony...");

    const graph = await this.buildDependencyGraph();
    const interfaces = await this.analyzeInterfaces();
    const communications = await this.analyzeCommunications();

    const metrics = this.calculateHarmonyMetrics(
      graph,
      interfaces,
      communications,
    );
    const issues = this.identifyIssues(graph, interfaces, communications);
    const trends = this.calculateTrends(metrics);

    const analysis: HarmonyAnalysis = {
      timestamp: new Date(),
      metrics,
      graph,
      interfaces,
      communications,
      issues,
      trends,
    };

    this.analysisHistory.push(analysis);

    // Keep only last 50 analyses
    if (this.analysisHistory.length > 50) {
      this.analysisHistory = this.analysisHistory.slice(-50);
    }

    await this.persistAnalysis();

    console.log(`   Overall Harmony: ${metrics.overall.toFixed(2)}`);
    console.log(`   Component Harmony: ${metrics.componentHarmony.toFixed(2)}`);
    console.log(`   Dependency Health: ${metrics.dependencyHealth.toFixed(2)}`);
    console.log(
      `   Interface Consistency: ${metrics.interfaceConsistency.toFixed(2)}`,
    );
    console.log(
      `   Communication Efficiency: ${metrics.communicationEfficiency.toFixed(
        2,
      )}`,
    );

    if (issues.length > 0) {
      console.log(
        `   Issues Found: ${issues.length} (${
          issues.filter(
            (i) => i.severity === "high" || i.severity === "critical",
          ).length
        } critical)`,
      );
    }

    this.emit("harmony:analyzed", analysis);
    return analysis;
  }

  /**
   * Get current harmony metrics
   */
  getCurrentMetrics(): HarmonyMetrics | null {
    if (this.analysisHistory.length === 0) return null;
    return this.analysisHistory[this.analysisHistory.length - 1].metrics;
  }

  /**
   * Get harmony trends over time
   */
  getHarmonyTrends(days = 30): Array<{
    timestamp: Date;
    overall: number;
    componentHarmony: number;
    dependencyHealth: number;
    interfaceConsistency: number;
    communicationEfficiency: number;
  }> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.analysisHistory
      .filter((a) => a.timestamp >= cutoff)
      .map((a) => ({
        timestamp: a.timestamp,
        overall: a.metrics.overall,
        componentHarmony: a.metrics.componentHarmony,
        dependencyHealth: a.metrics.dependencyHealth,
        interfaceConsistency: a.metrics.interfaceConsistency,
        communicationEfficiency: a.metrics.communicationEfficiency,
      }));
  }

  /**
   * Get critical harmony issues
   */
  getCriticalIssues(): Array<{
    type: string;
    component: string;
    description: string;
    recommendation: string;
  }> {
    if (this.analysisHistory.length === 0) return [];

    const latestAnalysis =
      this.analysisHistory[this.analysisHistory.length - 1];
    return latestAnalysis.issues
      .filter((i) => i.severity === "high" || i.severity === "critical")
      .map((i) => ({
        type: i.type,
        component: i.component,
        description: i.description,
        recommendation: i.recommendation,
      }));
  }

  private async buildDependencyGraph(): Promise<DependencyGraph> {
    const nodes = new Map<string, DependencyNode>();
    const edges: Array<{ from: string; to: string; weight: number }> = [];

    // Scan TypeScript/JavaScript files
    const files = this.findSourceFiles();

    for (const filePath of files) {
      try {
        const content = readFileSync(filePath, "utf8");
        const relativePath = relative(this.projectRoot, filePath);

        const dependencies = this.extractDependencies(content, filePath);
        const stats = statSync(filePath);

        const node: DependencyNode = {
          name: relativePath,
          path: filePath,
          dependencies,
          dependents: [],
          type: this.classifyFileType(filePath, content),
          complexity: this.calculateFileComplexity(content),
          size: stats.size,
        };

        nodes.set(relativePath, node);

        // Add edges for dependencies
        dependencies.forEach((dep) => {
          edges.push({
            from: relativePath,
            to: dep,
            weight: 1,
          });
        });
      } catch (error) {
        console.warn(`⚠️ Could not analyze file: ${filePath}`, error);
      }
    }

    // Build reverse dependencies (dependents)
    for (const [nodeName, node] of nodes) {
      node.dependents = edges
        .filter((e) => e.to === nodeName)
        .map((e) => e.from);
    }

    const cycles = this.findDependencyCycles(nodes, edges);
    const depth = this.calculateGraphDepth(nodes, edges);
    const entropy = this.calculateGraphEntropy(nodes, edges);

    return {
      nodes,
      edges,
      cycles,
      depth,
      entropy,
    };
  }

  private async analyzeInterfaces(): Promise<InterfaceMetric[]> {
    const interfaces: InterfaceMetric[] = [];
    const files = this.findSourceFiles();

    for (const filePath of files) {
      try {
        const content = readFileSync(filePath, "utf8");
        const relativePath = relative(this.projectRoot, filePath);

        // Extract interface information (simplified analysis)
        const publicMethods = (
          content.match(/export\s+(function|class|interface|type)/g) || []
        ).length;
        const parameters = (content.match(/\([^)]*\)/g) || []).length;
        const returnComplexity = this.calculateReturnComplexity(content);
        const consistency = this.calculateInterfaceConsistency(content);

        if (publicMethods > 0) {
          interfaces.push({
            component: relativePath,
            publicMethods,
            parameters,
            returnComplexity,
            consistency,
          });
        }
      } catch (error) {
        console.warn(`⚠️ Could not analyze interface: ${filePath}`, error);
      }
    }

    return interfaces;
  }

  private async analyzeCommunications(): Promise<CommunicationPattern[]> {
    const communications: CommunicationPattern[] = [];
    const files = this.findSourceFiles();

    for (const filePath of files) {
      try {
        const content = readFileSync(filePath, "utf8");
        const relativePath = relative(this.projectRoot, filePath);

        // Analyze communication patterns (simplified)
        const imports = content.match(/import.*from\s+['"](.*)['"]/g) || [];
        const eventEmits = content.match(/emit\(['"`]([^'"`]+)['"`]/g) || [];
        const functionCalls = content.match(/\w+\.\w+\(/g) || [];

        // Direct imports
        imports.forEach((imp) => {
          const match = imp.match(/from\s+['"](.*)['"]/);
          if (match && match[1].startsWith(".")) {
            communications.push({
              source: relativePath,
              target: match[1],
              frequency: 1,
              latency: 0,
              errorRate: 0,
              protocol: "direct",
            });
          }
        });

        // Event-based communication
        eventEmits.forEach(() => {
          communications.push({
            source: relativePath,
            target: "event-system",
            frequency: 1,
            latency: 5,
            errorRate: 0.01,
            protocol: "event",
          });
        });
      } catch (error) {
        console.warn(`⚠️ Could not analyze communication: ${filePath}`, error);
      }
    }

    return communications;
  }

  private calculateHarmonyMetrics(
    graph: DependencyGraph,
    interfaces: InterfaceMetric[],
    communications: CommunicationPattern[],
  ): HarmonyMetrics {
    // Component harmony based on dependency graph entropy
    const componentHarmony = Math.max(0, Math.min(1, 1 - graph.entropy / 10));

    // Dependency health based on cycles and complexity
    const dependencyHealth = this.calculateDependencyHealth(graph);

    // Interface consistency based on parameter patterns
    const interfaceConsistency =
      interfaces.length > 0
        ? interfaces.reduce((sum, i) => sum + i.consistency, 0) /
          interfaces.length
        : 0.5;

    // Communication efficiency based on patterns and error rates
    const communicationEfficiency =
      communications.length > 0
        ? communications.reduce((sum, c) => sum + (1 - c.errorRate), 0) /
          communications.length
        : 0.5;

    // Weighted overall score
    const overall =
      componentHarmony * 0.4 +
      dependencyHealth * 0.3 +
      interfaceConsistency * 0.2 +
      communicationEfficiency * 0.1;

    return {
      componentHarmony,
      dependencyHealth,
      interfaceConsistency,
      communicationEfficiency,
      overall,
    };
  }

  private identifyIssues(
    graph: DependencyGraph,
    interfaces: InterfaceMetric[],
    communications: CommunicationPattern[],
  ): Array<{
    type: "cycle" | "complexity" | "inconsistency" | "bottleneck";
    severity: "low" | "medium" | "high" | "critical";
    component: string;
    description: string;
    recommendation: string;
  }> {
    const issues: Array<any> = [];

    // Dependency cycles
    graph.cycles.forEach((cycle) => {
      issues.push({
        type: "cycle",
        severity: cycle.length > 3 ? "critical" : "high",
        component: cycle[0],
        description: `Circular dependency: ${cycle.join(" → ")}`,
        recommendation:
          "Break the cycle by introducing abstraction layers or dependency injection",
      });
    });

    // High complexity components
    for (const [name, node] of graph.nodes) {
      if (node.complexity > 20) {
        issues.push({
          type: "complexity",
          severity: node.complexity > 50 ? "critical" : "high",
          component: name,
          description: `High complexity score: ${node.complexity}`,
          recommendation:
            "Consider refactoring into smaller, more focused modules",
        });
      }

      // Components with too many dependencies
      if (node.dependencies.length > 10) {
        issues.push({
          type: "complexity",
          severity: node.dependencies.length > 20 ? "critical" : "medium",
          component: name,
          description: `Too many dependencies: ${node.dependencies.length}`,
          recommendation:
            "Reduce coupling by using dependency injection or facade patterns",
        });
      }
    }

    // Interface inconsistencies
    interfaces.forEach((iface) => {
      if (iface.consistency < 0.5) {
        issues.push({
          type: "inconsistency",
          severity: iface.consistency < 0.3 ? "high" : "medium",
          component: iface.component,
          description: `Low interface consistency: ${(
            iface.consistency * 100
          ).toFixed(0)}%`,
          recommendation:
            "Standardize parameter patterns and naming conventions",
        });
      }
    });

    // Communication bottlenecks
    const targetCounts = new Map<string, number>();
    communications.forEach((comm) => {
      targetCounts.set(comm.target, (targetCounts.get(comm.target) || 0) + 1);
    });

    for (const [target, count] of targetCounts) {
      if (count > 15) {
        issues.push({
          type: "bottleneck",
          severity: count > 30 ? "critical" : "high",
          component: target,
          description: `Communication bottleneck: ${count} incoming connections`,
          recommendation: "Consider load balancing or caching strategies",
        });
      }
    }

    return issues;
  }

  private calculateTrends(currentMetrics: HarmonyMetrics): Array<{
    timestamp: Date;
    metric: string;
    value: number;
    change: number;
  }> {
    const trends: Array<any> = [];

    if (this.analysisHistory.length > 1) {
      const previous =
        this.analysisHistory[this.analysisHistory.length - 2].metrics;
      const current = currentMetrics;

      Object.entries(current).forEach(([metric, value]) => {
        const prevValue = (previous as any)[metric] || 0;
        const change = value - prevValue;

        trends.push({
          timestamp: new Date(),
          metric,
          value,
          change,
        });
      });
    }

    return trends;
  }

  private findSourceFiles(): string[] {
    const extensions = [".ts", ".js", ".tsx", ".jsx"];
    const excludeDirs = ["node_modules", "dist", "build", ".git"];
    const files: string[] = [];

    const scanDir = (dir: string) => {
      try {
        const entries = readdirSync(dir);

        for (const entry of entries) {
          const fullPath = join(dir, entry);
          const stat = statSync(fullPath);

          if (stat.isDirectory() && !excludeDirs.includes(entry)) {
            scanDir(fullPath);
          } else if (stat.isFile() && extensions.includes(extname(entry))) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    scanDir(this.projectRoot);
    return files;
  }

  private extractDependencies(content: string, filePath: string): string[] {
    const dependencies: string[] = [];
    const imports = content.match(/import.*from\s+['"](.*)['"]/g) || [];
    const requires = content.match(/require\(['"](.*)['"]\)/g) || [];

    [...imports, ...requires].forEach((imp) => {
      const match = imp.match(/['"](.*)['"]/);
      if (match && match[1]) {
        // Only track relative imports (internal dependencies)
        if (match[1].startsWith(".")) {
          dependencies.push(match[1]);
        }
      }
    });

    return dependencies;
  }

  private classifyFileType(
    filePath: string,
    content: string,
  ): "script" | "component" | "utility" | "config" {
    const name = filePath.toLowerCase();

    if (
      name.includes("config") ||
      name.endsWith(".json") ||
      name.endsWith(".yaml")
    ) {
      return "config";
    }

    if (
      content.includes("export class") ||
      content.includes("export interface")
    ) {
      return "component";
    }

    if (
      content.includes("export function") ||
      content.includes("export const")
    ) {
      return "utility";
    }

    return "script";
  }

  private calculateFileComplexity(content: string): number {
    let complexity = 1; // Base complexity

    // Cyclomatic complexity indicators
    const conditions = (
      content.match(/if\s*\(|else\s*if|switch|case|while|for|\?/g) || []
    ).length;
    const functions = (content.match(/function|=>/g) || []).length;
    const classes = (content.match(/class\s+\w+/g) || []).length;

    complexity += conditions * 1;
    complexity += functions * 2;
    complexity += classes * 3;

    return complexity;
  }

  private calculateReturnComplexity(content: string): number {
    const returns = content.match(/return\s+([^;]+)/g) || [];
    return returns.reduce((sum, ret) => {
      // Simple heuristic: longer return statements = more complex
      return sum + Math.min(10, ret.length / 20);
    }, 0);
  }

  private calculateInterfaceConsistency(content: string): number {
    // Heuristic: consistent naming and parameter patterns
    const functions = content.match(/function\s+(\w+)|(\w+)\s*\(/g) || [];
    if (functions.length < 2) return 1.0;

    // Check naming consistency (camelCase, etc.)
    const namingConsistency =
      functions.filter((f) => /^[a-z][a-zA-Z0-9]*/.test(f)).length /
      functions.length;

    return namingConsistency;
  }

  private findDependencyCycles(
    nodes: Map<string, DependencyNode>,
    edges: Array<{ from: string; to: string }>,
  ): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string) => {
      if (path.includes(node)) {
        const cycleStart = path.indexOf(node);
        cycles.push([...path.slice(cycleStart), node]);
        return;
      }

      if (visited.has(node)) return;

      visited.add(node);
      path.push(node);

      const outgoing = edges.filter((e) => e.from === node);
      for (const edge of outgoing) {
        dfs(edge.to);
      }

      path.pop();
    };

    for (const nodeName of nodes.keys()) {
      if (!visited.has(nodeName)) {
        dfs(nodeName);
      }
    }

    return cycles;
  }

  private calculateGraphDepth(
    nodes: Map<string, DependencyNode>,
    edges: Array<{ from: string; to: string }>,
  ): number {
    // Simple approximation: maximum dependency chain length
    let maxDepth = 0;

    for (const nodeName of nodes.keys()) {
      const depth = this.calculateNodeDepth(nodeName, nodes, edges, new Set());
      maxDepth = Math.max(maxDepth, depth);
    }

    return maxDepth;
  }

  private calculateNodeDepth(
    node: string,
    nodes: Map<string, DependencyNode>,
    edges: Array<{ from: string; to: string }>,
    visited: Set<string>,
  ): number {
    if (visited.has(node)) return 0; // Cycle detection
    visited.add(node);

    const outgoing = edges.filter((e) => e.from === node);
    if (outgoing.length === 0) return 1;

    let maxDepth = 0;
    for (const edge of outgoing) {
      const depth = this.calculateNodeDepth(
        edge.to,
        nodes,
        edges,
        new Set(visited),
      );
      maxDepth = Math.max(maxDepth, depth);
    }

    return maxDepth + 1;
  }

  private calculateGraphEntropy(
    nodes: Map<string, DependencyNode>,
    edges: Array<{ from: string; to: string }>,
  ): number {
    if (nodes.size === 0) return 0;

    // Calculate degree distribution entropy
    const degrees = new Map<number, number>();

    for (const node of nodes.values()) {
      const degree = node.dependencies.length + node.dependents.length;
      degrees.set(degree, (degrees.get(degree) || 0) + 1);
    }

    let entropy = 0;
    const total = nodes.size;

    for (const count of degrees.values()) {
      const probability = count / total;
      if (probability > 0) {
        entropy -= probability * Math.log2(probability);
      }
    }

    return entropy;
  }

  private calculateDependencyHealth(graph: DependencyGraph): number {
    let health = 1.0;

    // Penalize cycles
    const cycleCount = graph.cycles.length;
    health -= Math.min(0.5, cycleCount * 0.1);

    // Penalize high entropy (chaotic structure)
    if (graph.entropy > 5) {
      health -= Math.min(0.3, (graph.entropy - 5) * 0.05);
    }

    // Penalize excessive depth
    if (graph.depth > 10) {
      health -= Math.min(0.2, (graph.depth - 10) * 0.02);
    }

    return Math.max(0, health);
  }

  private loadHistoricalAnalysis(): void {
    try {
      if (existsSync(this.analysisPath)) {
        const data = readFileSync(this.analysisPath, "utf8");
        const analyses = JSON.parse(data);

        this.analysisHistory = analyses.map((a: any) => ({
          ...a,
          timestamp: new Date(a.timestamp),
        }));

        console.log(
          `📊 Loaded ${this.analysisHistory.length} historical harmony analyses`,
        );
      }
    } catch (error) {
      console.warn("⚠️ Could not load historical harmony data:", error);
    }
  }

  private async persistAnalysis(): Promise<void> {
    try {
      writeFileSync(
        this.analysisPath,
        JSON.stringify(this.analysisHistory, null, 2),
      );
    } catch (error) {
      console.error("❌ Failed to persist harmony analysis:", error);
    }
  }
}

// Global instance
export const componentHarmonyAnalyzer = new ComponentHarmonyAnalyzer();
export default ComponentHarmonyAnalyzer;
