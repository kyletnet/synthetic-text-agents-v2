import { BaseAgent } from "../core/baseAgent.js";
import { AgentContext } from "../shared/types.js";
import { Logger } from "../shared/logger.js";
export interface DomainConsultationRequest {
    domain: string;
    specialization?: string;
    expertiseLevel: "professional" | "expert" | "specialist";
    contextualFactors: {
        industrySize?: "startup" | "mid-market" | "enterprise";
        regulatoryEnvironment?: "light" | "moderate" | "strict";
        marketMaturity?: "emerging" | "growing" | "mature";
        competitiveIntensity?: "low" | "medium" | "high";
    };
    taskScope: string;
    qualityTarget: number;
}
export interface DomainExpertise {
    industryContext: {
        marketDynamics: string[];
        keyStakeholders: string[];
        valueChain: string[];
        businessModels: string[];
        competitiveLandscape: string[];
    };
    professionalStandards: {
        bestPractices: string[];
        industryStandards: string[];
        regulatoryRequirements: string[];
        ethicalGuidelines: string[];
        qualityBenchmarks: string[];
    };
    practicalKnowledge: {
        commonScenarios: string[];
        typicalChallenges: string[];
        solutionPatterns: string[];
        toolsAndMethods: string[];
        successMetrics: string[];
    };
    expertInsights: {
        emergingTrends: string[];
        advancedTechniques: string[];
        lessonsLearned: string[];
        pitfallsToAvoid: string[];
        innovativeApproaches: string[];
    };
}
export interface ProcessFrameworks {
    decisionFrameworks: Array<{
        name: string;
        description: string;
        steps: string[];
        applicableScenarios: string[];
    }>;
    methodologies: Array<{
        name: string;
        purpose: string;
        phases: string[];
        keyDeliverables: string[];
    }>;
    evaluationCriteria: Array<{
        category: string;
        metrics: string[];
        benchmarks: string[];
    }>;
}
export interface QAGuidance {
    questionTypes: Array<{
        category: string;
        characteristics: string[];
        examples: string[];
        appropriateContexts: string[];
    }>;
    answerPatterns: Array<{
        scenario: string;
        structure: string;
        keyElements: string[];
        expertiseMarkers: string[];
    }>;
    contextualConsiderations: {
        industrySpecific: string[];
        roleSpecific: string[];
        experienceSpecific: string[];
        situationSpecific: string[];
    };
}
export interface DomainConsultantOutput {
    domainExpertise: DomainExpertise;
    processFrameworks: ProcessFrameworks;
    qaGuidance: QAGuidance;
    implementationRecommendations: {
        expertiseIntegration: string[];
        qualityAssurance: string[];
        contextualAdaptation: string[];
        continuousImprovement: string[];
    };
    riskAssessment: Array<{
        risk: string;
        likelihood: "low" | "medium" | "high";
        impact: "low" | "medium" | "high";
        mitigation: string;
    }>;
}
export declare class DomainConsultant extends BaseAgent {
    private domainKnowledgeBase;
    constructor(logger: Logger);
    protected handle(content: unknown, context?: AgentContext): Promise<DomainConsultantOutput>;
    private parseRequest;
    private initializeDomainKnowledgeBase;
    assembleDomainExpertise(request: DomainConsultationRequest, _context?: AgentContext): Promise<DomainExpertise>;
    private getGenericDomainData;
    private buildIndustryContext;
    private constructValueChain;
    private analyzeCompetitiveLandscape;
    private compileProfessionalStandards;
    private identifyIndustryStandards;
    private gatherRegulatoryRequirements;
    private establishEthicalGuidelines;
    private defineQualityBenchmarks;
    private gatherPracticalKnowledge;
    private identifyTypicalChallenges;
    private compileSolutionPatterns;
    private deriveExpertInsights;
    private identifyEmergingTrends;
    private compileAdvancedTechniques;
    private gatherLessonsLearned;
    private identifyPitfalls;
    private suggestInnovativeApproaches;
    private developProcessFrameworks;
    private createDecisionFrameworks;
    private defineMethodologies;
    private establishEvaluationCriteria;
    private createQAGuidance;
    private defineQuestionTypes;
    private createAnswerPatterns;
    private identifyContextualConsiderations;
    private generateImplementationRecommendations;
    private conductRiskAssessment;
    protected assessConfidence(result: unknown): Promise<number>;
    protected explainReasoning(input: unknown, output: unknown, context?: AgentContext): Promise<string>;
}
//# sourceMappingURL=domainConsultant.d.ts.map