import { BaseAgent } from "./baseAgent.js";
import { AgentContext } from "../shared/types.js";
import { Logger } from "../shared/logger.js";
export interface ComplexityAnalysis {
    score: number;
    factors: {
        domainSpecificity: number;
        technicalDepth: number;
        userComplexity: number;
        innovationRequired: number;
        interdisciplinaryNeeds: number;
    };
    reasoning: string;
    recommendedAgents: string[];
}
export interface ExpertSummons {
    coreAgents: string[];
    expertCouncil: string[];
    strategy: "minimal" | "standard" | "full-council";
    collaborationApproach: "sequential" | "parallel" | "hybrid";
}
export interface MetaControllerDecision {
    taskAnalysis: ComplexityAnalysis;
    agentSelection: ExpertSummons;
    qualityGates: number[];
    executionStrategy: string;
    expectedOutcome: {
        qualityScore: number;
        estimatedDuration: number;
        resourceRequirement: "low" | "medium" | "high";
    };
}
export declare class MetaController extends BaseAgent {
    constructor(logger: Logger);
    protected handle(content: unknown, context?: AgentContext): Promise<MetaControllerDecision>;
    private parseTaskRequest;
    private analyzeComplexity;
    private assessDomainSpecificity;
    private assessTechnicalDepth;
    private assessUserComplexity;
    private assessInnovationRequirement;
    private assessInterdisciplinaryNeeds;
    private calculateComplexityScore;
    private generateComplexityReasoning;
    private recommendInitialAgents;
    private selectOptimalAgents;
    private defineQualityGates;
    private planExecutionStrategy;
    private projectOutcome;
    protected assessConfidence(result: unknown): Promise<number>;
    protected explainReasoning(input: unknown, output: unknown, context?: AgentContext): Promise<string>;
}
//# sourceMappingURL=metaController.d.ts.map