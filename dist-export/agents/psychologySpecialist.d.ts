import { BaseAgent } from "../core/baseAgent.js";
import { AgentContext } from "../shared/types.js";
import { Logger } from "../shared/logger.js";
export interface PsychologyAnalysisRequest {
    taskDescription: string;
    targetDomain: string;
    userPersona?: string;
    contextualFactors?: {
        urgency?: "low" | "medium" | "high";
        emotionalState?: string;
        experienceLevel?: "beginner" | "intermediate" | "expert";
        stakeholderPressure?: "low" | "medium" | "high";
    };
    communicationGoals?: string[];
}
export interface PsychologyInsights {
    userPsychology: {
        emotionalState: string;
        primaryMotivations: string[];
        cognitiveLoad: "low" | "medium" | "high";
        decisionMakingStyle: "analytical" | "intuitive" | "collaborative" | "directive";
        stressFactors: string[];
        confidenceLevels: string;
    };
    communicationStrategy: {
        optimalTone: "supportive" | "authoritative" | "collaborative" | "reassuring" | "direct";
        languageStyle: "formal" | "conversational" | "technical" | "simplified";
        structuralApproach: "step-by-step" | "options-based" | "narrative" | "analytical";
        empathyLevel: "high" | "medium" | "low";
        urgencyHandling: string;
    };
    persuasionPsychology: {
        keyInfluencers: string[];
        resistancePoints: string[];
        motivationalFrames: string[];
        trustBuilders: string[];
    };
    cognitiveConsiderations: {
        informationProcessing: string;
        attentionSpan: "short" | "medium" | "extended";
        learningStyle: "visual" | "auditory" | "kinesthetic" | "reading";
        memoryAids: string[];
    };
}
export interface PsychologyRecommendations {
    qaDesignPrinciples: string[];
    communicationGuidelines: string[];
    emotionalConsiderations: string[];
    avoidanceStrategies: string[];
    engagementTactics: string[];
    qualityIndicators: string[];
}
export interface PsychologySpecialistOutput {
    analysis: PsychologyInsights;
    recommendations: PsychologyRecommendations;
    implementationGuidance: {
        questionFormulation: string[];
        answerToneGuidance: string[];
        empathyIntegration: string[];
        motivationalElements: string[];
    };
    riskFactors: Array<{
        factor: string;
        impact: "high" | "medium" | "low";
        mitigation: string;
    }>;
}
export declare class PsychologySpecialist extends BaseAgent {
    constructor(logger: Logger);
    protected handle(content: unknown, context?: AgentContext): Promise<PsychologySpecialistOutput>;
    private parseRequest;
    private conductPsychologyAnalysis;
    private analyzeUserPsychology;
    private determineEmotionalState;
    private identifyMotivations;
    private assessCognitiveLoad;
    private analyzeDecisionMakingStyle;
    private identifyStressFactors;
    private assessConfidenceLevels;
    private developCommunicationStrategy;
    private determineTone;
    private selectLanguageStyle;
    private selectStructuralApproach;
    private determineEmpathyLevel;
    private developUrgencyHandling;
    private analyzePersuasionFactors;
    private identifyInfluencers;
    private identifyResistancePoints;
    private developMotivationalFrames;
    private identifyTrustBuilders;
    private analyzeCognitiveFactors;
    private analyzeInformationProcessing;
    private assessAttentionSpan;
    private determineLearningStyle;
    private identifyMemoryAids;
    private generateRecommendations;
    private generateQADesignPrinciples;
    private generateCommunicationGuidelines;
    private generateEmotionalConsiderations;
    private generateAvoidanceStrategies;
    private generateEngagementTactics;
    private generateQualityIndicators;
    private createImplementationGuidance;
    private generateQuestionFormulationGuidance;
    private generateAnswerToneGuidance;
    private generateEmpathyIntegration;
    private generateMotivationalElements;
    private identifyRiskFactors;
}
//# sourceMappingURL=psychologySpecialist.d.ts.map