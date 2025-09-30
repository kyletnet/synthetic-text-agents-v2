#!/usr/bin/env tsx

/**
 * Agent Decision Trace Visualization
 * AI 에이전트 결정 과정 추적 및 시각화
 * 투명성, 감사, 개선 경로 분석
 */

import { promises as fs } from "fs";
import { resolve, join } from "path";
import { logger } from "./simple_logger.js";

interface AgentDecision {
  id: string;
  timestamp: Date;
  agentId: string;
  agentType: string;
  context: {
    taskId: string;
    phase: string;
    inputData: any;
    environmentState: Record<string, any>;
  };
  reasoning: {
    problem: string;
    alternatives: Alternative[];
    selectedAlternative: string;
    confidenceScore: number;
    riskAssessment: RiskAssessment;
  };
  decision: {
    action: string;
    parameters: Record<string, any>;
    expectedOutcome: string;
    fallbackPlan?: string;
  };
  execution: {
    startTime: Date;
    endTime?: Date;
    status: "pending" | "executing" | "completed" | "failed" | "rolled_back";
    actualOutcome?: string;
    performanceMetrics?: PerformanceMetrics;
    errors?: string[];
  };
  dependencies: string[]; // Other decision IDs this depends on
  consequences: string[]; // Decision IDs that resulted from this decision
  humanOverride?: {
    timestamp: Date;
    reason: string;
    newAction: string;
  };
}

interface Alternative {
  id: string;
  description: string;
  pros: string[];
  cons: string[];
  estimatedEffort: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  successProbability: number;
}

interface RiskAssessment {
  overallRisk: "low" | "medium" | "high" | "critical";
  riskFactors: string[];
  mitigations: string[];
  rollbackComplexity: number; // 1-10 scale
}

interface PerformanceMetrics {
  executionTime: number;
  tokensUsed: number;
  memoryUsage: number;
  qualityScore: number;
  userSatisfaction?: number;
}

interface DecisionGraph {
  nodes: DecisionNode[];
  edges: DecisionEdge[];
  clusters: DecisionCluster[];
}

interface DecisionNode {
  id: string;
  agentId: string;
  agentType: string;
  action: string;
  status: string;
  timestamp: Date;
  confidence: number;
  risk: string;
  performance?: PerformanceMetrics;
}

interface DecisionEdge {
  from: string;
  to: string;
  type: "dependency" | "consequence" | "alternative" | "rollback";
  weight: number;
}

interface DecisionCluster {
  id: string;
  name: string;
  agentType: string;
  decisions: string[];
  averagePerformance: number;
  successRate: number;
}

class AgentDecisionTracer {
  private readonly tracePath: string;
  private readonly visualizationPath: string;

  constructor(rootPath = process.cwd()) {
    this.tracePath = resolve(rootPath, ".system-backups/decision-traces");
    this.visualizationPath = resolve(rootPath, "reports/decision-analytics");
  }

  async init(): Promise<void> {
    await fs.mkdir(this.tracePath, { recursive: true });
    await fs.mkdir(this.visualizationPath, { recursive: true });

    logger.info("🔍 Agent Decision Tracer initialized");
  }

  async recordDecision(
    decision: Omit<AgentDecision, "id" | "timestamp">,
  ): Promise<string> {
    const id = this.generateDecisionId(
      decision.agentId,
      decision.decision.action,
    );

    const fullDecision: AgentDecision = {
      id,
      timestamp: new Date(),
      ...decision,
    };

    await this.saveDecision(fullDecision);
    logger.debug(`📝 Recorded decision: ${id} by ${decision.agentId}`);

    return id;
  }

  async updateDecisionExecution(
    decisionId: string,
    execution: Partial<AgentDecision["execution"]>,
  ): Promise<void> {
    const decision = await this.loadDecision(decisionId);
    if (!decision) {
      throw new Error(`Decision ${decisionId} not found`);
    }

    decision.execution = { ...decision.execution, ...execution };
    await this.saveDecision(decision);

    logger.debug(`📊 Updated execution for decision: ${decisionId}`);
  }

  async recordHumanOverride(
    decisionId: string,
    reason: string,
    newAction: string,
  ): Promise<void> {
    const decision = await this.loadDecision(decisionId);
    if (!decision) {
      throw new Error(`Decision ${decisionId} not found`);
    }

    decision.humanOverride = {
      timestamp: new Date(),
      reason,
      newAction,
    };

    await this.saveDecision(decision);
    logger.info(`👤 Human override recorded for decision: ${decisionId}`);
  }

  async generateDecisionGraph(timeRange?: {
    start: Date;
    end: Date;
  }): Promise<DecisionGraph> {
    const decisions = await this.getDecisions(timeRange);

    const nodes: DecisionNode[] = decisions.map((d) => ({
      id: d.id,
      agentId: d.agentId,
      agentType: d.agentType,
      action: d.decision.action,
      status: d.execution.status,
      timestamp: d.timestamp,
      confidence: d.reasoning.confidenceScore,
      risk: d.reasoning.riskAssessment.overallRisk,
      performance: d.execution.performanceMetrics,
    }));

    const edges: DecisionEdge[] = [];

    // Add dependency edges
    for (const decision of decisions) {
      for (const depId of decision.dependencies) {
        edges.push({
          from: depId,
          to: decision.id,
          type: "dependency",
          weight: 1,
        });
      }

      // Add consequence edges
      for (const consId of decision.consequences) {
        edges.push({
          from: decision.id,
          to: consId,
          type: "consequence",
          weight: 1,
        });
      }
    }

    // Generate clusters by agent type
    const clusters = this.generateClusters(decisions);

    return { nodes, edges, clusters };
  }

  private generateClusters(decisions: AgentDecision[]): DecisionCluster[] {
    const clusterMap = new Map<string, AgentDecision[]>();

    for (const decision of decisions) {
      if (!clusterMap.has(decision.agentType)) {
        clusterMap.set(decision.agentType, []);
      }
      clusterMap.get(decision.agentType)!.push(decision);
    }

    return Array.from(clusterMap.entries()).map(
      ([agentType, agentDecisions]) => {
        const successCount = agentDecisions.filter(
          (d) => d.execution.status === "completed",
        ).length;
        const avgPerformance =
          agentDecisions
            .filter((d) => d.execution.performanceMetrics)
            .reduce(
              (sum, d) => sum + d.execution.performanceMetrics!.qualityScore,
              0,
            ) /
            agentDecisions.filter((d) => d.execution.performanceMetrics)
              .length || 0;

        return {
          id: `cluster-${agentType}`,
          name: agentType,
          agentType,
          decisions: agentDecisions.map((d) => d.id),
          averagePerformance: avgPerformance,
          successRate: successCount / agentDecisions.length,
        };
      },
    );
  }

  async generateAnalytics(): Promise<any> {
    const decisions = await this.getAllDecisions();
    const graph = await this.generateDecisionGraph();

    const analytics = {
      timestamp: new Date().toISOString(),
      summary: {
        totalDecisions: decisions.length,
        agentTypes: [...new Set(decisions.map((d) => d.agentType))],
        averageConfidence: this.calculateAverageConfidence(decisions),
        successRate: this.calculateSuccessRate(decisions),
        riskDistribution: this.calculateRiskDistribution(decisions),
      },
      performance: {
        byAgent: this.calculateAgentPerformance(decisions),
        trends: await this.calculatePerformanceTrends(decisions),
        bottlenecks: this.identifyBottlenecks(decisions),
      },
      patterns: {
        commonDecisionPaths: this.identifyCommonPaths(graph),
        frequentOverrides: this.analyzeHumanOverrides(decisions),
        riskPatterns: this.analyzeRiskPatterns(decisions),
      },
      recommendations: await this.generateRecommendations(decisions, graph),
    };

    // Save analytics
    await fs.writeFile(
      join(this.visualizationPath, "decision-analytics.json"),
      JSON.stringify(analytics, null, 2),
    );

    return analytics;
  }

  async generateVisualization(): Promise<string> {
    const graph = await this.generateDecisionGraph();
    const analytics = await this.generateAnalytics();

    // Generate HTML visualization
    const html = this.generateHTMLVisualization(graph, analytics);
    const htmlPath = join(this.visualizationPath, "decision-trace.html");

    await fs.writeFile(htmlPath, html);

    logger.info(`📊 Generated visualization: ${htmlPath}`);
    return htmlPath;
  }

  private generateHTMLVisualization(
    graph: DecisionGraph,
    analytics: any,
  ): string {
    return `<!DOCTYPE html>
<html>
<head>
    <title>Agent Decision Trace Visualization</title>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .graph-container { width: 100%; height: 600px; border: 1px solid #ccc; }
        .node { stroke: #fff; stroke-width: 2px; }
        .link { stroke: #999; stroke-opacity: 0.6; }
        .tooltip { position: absolute; background: rgba(0,0,0,0.8); color: white; padding: 10px; border-radius: 5px; pointer-events: none; }
        .analytics { margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .metric { background: #f5f5f5; padding: 15px; border-radius: 5px; }
        .risk-low { fill: #28a745; }
        .risk-medium { fill: #ffc107; }
        .risk-high { fill: #fd7e14; }
        .risk-critical { fill: #dc3545; }
        .status-completed { stroke: #28a745; }
        .status-failed { stroke: #dc3545; }
        .status-pending { stroke: #6c757d; }
    </style>
</head>
<body>
    <h1>🔍 Agent Decision Trace Visualization</h1>
    
    <div class="analytics">
        <div class="metric">
            <h3>📊 Summary</h3>
            <p>Total Decisions: ${analytics.summary.totalDecisions}</p>
            <p>Success Rate: ${(analytics.summary.successRate * 100).toFixed(1)}%</p>
            <p>Avg Confidence: ${(analytics.summary.averageConfidence * 100).toFixed(1)}%</p>
        </div>
        
        <div class="metric">
            <h3>⚡ Performance</h3>
            <p>Best Agent: ${analytics.performance.byAgent[0]?.agentType || "N/A"}</p>
            <p>Bottlenecks: ${analytics.performance.bottlenecks.length}</p>
        </div>
    </div>
    
    <div class="graph-container" id="graph"></div>
    
    <script>
        const data = ${JSON.stringify(graph)};
        const analytics = ${JSON.stringify(analytics)};
        
        // D3.js visualization code
        const width = 800;
        const height = 600;
        
        const svg = d3.select("#graph")
            .append("svg")
            .attr("width", width)
            .attr("height", height);
            
        const simulation = d3.forceSimulation(data.nodes)
            .force("link", d3.forceLink(data.edges).id(d => d.id))
            .force("charge", d3.forceManyBody().strength(-300))
            .force("center", d3.forceCenter(width / 2, height / 2));
            
        const link = svg.append("g")
            .selectAll("line")
            .data(data.edges)
            .enter().append("line")
            .attr("class", "link")
            .attr("stroke-width", d => Math.sqrt(d.weight));
            
        const node = svg.append("g")
            .selectAll("circle")
            .data(data.nodes)
            .enter().append("circle")
            .attr("class", d => \`node risk-\${d.risk} status-\${d.status}\`)
            .attr("r", d => 5 + (d.confidence * 10))
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended));
                
        node.append("title")
            .text(d => \`\${d.agentType}: \${d.action}\\nConfidence: \${(d.confidence * 100).toFixed(1)}%\\nRisk: \${d.risk}\`);
            
        simulation.on("tick", () => {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);
                
            node
                .attr("cx", d => d.x)
                .attr("cy", d => d.y);
        });
        
        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }
        
        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }
        
        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }
    </script>
</body>
</html>`;
  }

  private calculateAverageConfidence(decisions: AgentDecision[]): number {
    if (decisions.length === 0) return 0;
    return (
      decisions.reduce((sum, d) => sum + d.reasoning.confidenceScore, 0) /
      decisions.length
    );
  }

  private calculateSuccessRate(decisions: AgentDecision[]): number {
    if (decisions.length === 0) return 0;
    const successful = decisions.filter(
      (d) => d.execution.status === "completed",
    ).length;
    return successful / decisions.length;
  }

  private calculateRiskDistribution(
    decisions: AgentDecision[],
  ): Record<string, number> {
    const distribution = { low: 0, medium: 0, high: 0, critical: 0 };

    for (const decision of decisions) {
      distribution[decision.reasoning.riskAssessment.overallRisk]++;
    }

    return distribution;
  }

  private calculateAgentPerformance(decisions: AgentDecision[]): any[] {
    const agentMap = new Map<string, AgentDecision[]>();

    for (const decision of decisions) {
      if (!agentMap.has(decision.agentType)) {
        agentMap.set(decision.agentType, []);
      }
      agentMap.get(decision.agentType)!.push(decision);
    }

    return Array.from(agentMap.entries())
      .map(([agentType, agentDecisions]) => ({
        agentType,
        decisionsCount: agentDecisions.length,
        successRate: this.calculateSuccessRate(agentDecisions),
        averageConfidence: this.calculateAverageConfidence(agentDecisions),
        averageQuality:
          agentDecisions
            .filter((d) => d.execution.performanceMetrics)
            .reduce(
              (sum, d) => sum + d.execution.performanceMetrics!.qualityScore,
              0,
            ) /
            agentDecisions.filter((d) => d.execution.performanceMetrics)
              .length || 0,
      }))
      .sort((a, b) => b.averageQuality - a.averageQuality);
  }

  private async calculatePerformanceTrends(
    decisions: AgentDecision[],
  ): Promise<any> {
    // Group decisions by day and calculate daily metrics
    const dayGroups = new Map<string, AgentDecision[]>();

    for (const decision of decisions) {
      const day = decision.timestamp.toISOString().split("T")[0];
      if (!dayGroups.has(day)) {
        dayGroups.set(day, []);
      }
      dayGroups.get(day)!.push(decision);
    }

    return Array.from(dayGroups.entries())
      .map(([day, dayDecisions]) => ({
        date: day,
        count: dayDecisions.length,
        successRate: this.calculateSuccessRate(dayDecisions),
        averageConfidence: this.calculateAverageConfidence(dayDecisions),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private identifyBottlenecks(decisions: AgentDecision[]): any[] {
    // Identify decisions that frequently fail or have long execution times
    return decisions
      .filter(
        (d) =>
          d.execution.status === "failed" ||
          (d.execution.performanceMetrics &&
            d.execution.performanceMetrics.executionTime > 30000),
      )
      .map((d) => ({
        id: d.id,
        agentType: d.agentType,
        action: d.decision.action,
        issue: d.execution.status === "failed" ? "failure" : "slow_execution",
        executionTime: d.execution.performanceMetrics?.executionTime,
      }));
  }

  private identifyCommonPaths(graph: DecisionGraph): any[] {
    // Identify frequently used decision paths
    const pathMap = new Map<string, number>();

    for (const edge of graph.edges) {
      if (edge.type === "consequence") {
        const pathKey = `${edge.from}->${edge.to}`;
        pathMap.set(pathKey, (pathMap.get(pathKey) || 0) + 1);
      }
    }

    return Array.from(pathMap.entries())
      .map(([path, count]) => ({ path, frequency: count }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);
  }

  private analyzeHumanOverrides(decisions: AgentDecision[]): any[] {
    return decisions
      .filter((d) => d.humanOverride)
      .map((d) => ({
        decisionId: d.id,
        agentType: d.agentType,
        originalAction: d.decision.action,
        newAction: d.humanOverride!.newAction,
        reason: d.humanOverride!.reason,
        timestamp: d.humanOverride!.timestamp,
      }));
  }

  private analyzeRiskPatterns(decisions: AgentDecision[]): any {
    const riskSuccessMap = new Map<
      string,
      { total: number; successful: number }
    >();

    for (const decision of decisions) {
      const risk = decision.reasoning.riskAssessment.overallRisk;
      if (!riskSuccessMap.has(risk)) {
        riskSuccessMap.set(risk, { total: 0, successful: 0 });
      }

      const stats = riskSuccessMap.get(risk)!;
      stats.total++;
      if (decision.execution.status === "completed") {
        stats.successful++;
      }
    }

    return Object.fromEntries(
      Array.from(riskSuccessMap.entries()).map(([risk, stats]) => [
        risk,
        {
          total: stats.total,
          successRate: stats.successful / stats.total,
          recommendedApproach: this.getRecommendedApproach(
            risk,
            stats.successful / stats.total,
          ),
        },
      ]),
    );
  }

  private getRecommendedApproach(risk: string, successRate: number): string {
    if (risk === "critical" && successRate < 0.8) {
      return "Require human approval for critical decisions";
    } else if (risk === "high" && successRate < 0.7) {
      return "Add additional validation steps";
    } else if (successRate > 0.9) {
      return "Consider increasing automation level";
    }
    return "Monitor and maintain current approach";
  }

  private async generateRecommendations(
    decisions: AgentDecision[],
    graph: DecisionGraph,
  ): Promise<string[]> {
    const recommendations: string[] = [];

    // Analyze performance patterns
    const agentPerf = this.calculateAgentPerformance(decisions);
    const lowPerformingAgents = agentPerf.filter((a) => a.successRate < 0.7);

    if (lowPerformingAgents.length > 0) {
      recommendations.push(
        `Improve training for agents: ${lowPerformingAgents.map((a) => a.agentType).join(", ")}`,
      );
    }

    // Analyze human override patterns
    const overrides = this.analyzeHumanOverrides(decisions);
    const frequentOverrideReasons = new Map<string, number>();

    for (const override of overrides) {
      frequentOverrideReasons.set(
        override.reason,
        (frequentOverrideReasons.get(override.reason) || 0) + 1,
      );
    }

    const topOverrideReason = Array.from(
      frequentOverrideReasons.entries(),
    ).sort((a, b) => b[1] - a[1])[0];

    if (topOverrideReason && topOverrideReason[1] > 3) {
      recommendations.push(
        `Address common override reason: "${topOverrideReason[0]}"`,
      );
    }

    // Analyze risk patterns
    const riskPatterns = this.analyzeRiskPatterns(decisions);
    if (riskPatterns.critical && riskPatterns.critical.successRate < 0.8) {
      recommendations.push(
        "Implement mandatory human review for critical risk decisions",
      );
    }

    return recommendations;
  }

  private generateDecisionId(agentId: string, action: string): string {
    const timestamp = Date.now().toString();
    return `${agentId}-${action.replace(/[^a-zA-Z0-9]/g, "-")}-${timestamp}`;
  }

  private async saveDecision(decision: AgentDecision): Promise<void> {
    const decisionFile = join(this.tracePath, `${decision.id}.json`);
    await fs.writeFile(decisionFile, JSON.stringify(decision, null, 2));
  }

  private async loadDecision(
    decisionId: string,
  ): Promise<AgentDecision | null> {
    try {
      const decisionFile = join(this.tracePath, `${decisionId}.json`);
      const content = await fs.readFile(decisionFile, "utf-8");
      const decision = JSON.parse(content);

      // Convert date strings back to Date objects
      decision.timestamp = new Date(decision.timestamp);
      decision.execution.startTime = new Date(decision.execution.startTime);
      if (decision.execution.endTime) {
        decision.execution.endTime = new Date(decision.execution.endTime);
      }
      if (decision.humanOverride) {
        decision.humanOverride.timestamp = new Date(
          decision.humanOverride.timestamp,
        );
      }

      return decision;
    } catch {
      return null;
    }
  }

  private async getDecisions(timeRange?: {
    start: Date;
    end: Date;
  }): Promise<AgentDecision[]> {
    const allDecisions = await this.getAllDecisions();

    if (!timeRange) return allDecisions;

    return allDecisions.filter(
      (d) => d.timestamp >= timeRange.start && d.timestamp <= timeRange.end,
    );
  }

  private async getAllDecisions(): Promise<AgentDecision[]> {
    try {
      const files = await fs.readdir(this.tracePath);
      const decisions: AgentDecision[] = [];

      for (const file of files) {
        if (file.endsWith(".json")) {
          const decision = await this.loadDecision(file.replace(".json", ""));
          if (decision) decisions.push(decision);
        }
      }

      return decisions.sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
      );
    } catch {
      return [];
    }
  }
}

// CLI Interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , command, ...args] = process.argv;
  const tracer = new AgentDecisionTracer();

  (async () => {
    try {
      await tracer.init();

      switch (command) {
        case "analytics":
          const analytics = await tracer.generateAnalytics();
          console.log("📊 Decision Analytics:");
          console.log(JSON.stringify(analytics, null, 2));
          break;

        case "visualize":
          const htmlPath = await tracer.generateVisualization();
          console.log(`📊 Visualization generated: ${htmlPath}`);
          break;

        case "graph":
          const graph = await tracer.generateDecisionGraph();
          console.log("🔗 Decision Graph:");
          console.log(JSON.stringify(graph, null, 2));
          break;

        default:
          console.log(
            "Usage: tsx agent_decision_tracer.ts [analytics|visualize|graph]",
          );
      }
    } catch (error) {
      logger.error("Agent decision tracer failed:", error);
      process.exit(1);
    }
  })();
}

export { AgentDecisionTracer };
