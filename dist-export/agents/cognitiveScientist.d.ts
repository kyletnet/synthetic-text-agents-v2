import { BaseAgent } from "../core/baseAgent.js";
import { AgentContext } from "../shared/types.js";
import { Logger } from "../shared/logger.js";
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
export interface ExpertThinkingModel {
  cognitiveArchitecture: {
    mentalModels: Array<{
      name: string;
      description: string;
      components: string[];
      relationships: string[];
    }>;
    reasoningPatterns: Array<{
      pattern: string;
      triggerConditions: string[];
      steps: string[];
      outputCharacteristics: string[];
    }>;
    decisionHeuristics: Array<{
      heuristic: string;
      applicableContexts: string[];
      reliability: "high" | "medium" | "low";
      biasRisks: string[];
    }>;
  };
  knowledgeStructure: {
    coreKnowledge: {
      factual: string[];
      procedural: string[];
      conditional: string[];
      metacognitive: string[];
    };
    knowledgeOrganization: {
      hierarchies: string[];
      associations: string[];
      patterns: string[];
      schemas: string[];
    };
    tacitKnowledge: {
      intuitions: string[];
      experienceBasedInsights: string[];
      situationalAwareness: string[];
      implicitRules: string[];
    };
  };
  cognitiveProcesses: {
    problemIdentification: {
      cueRecognition: string[];
      patternMatching: string[];
      contextualAnalysis: string[];
    };
    solutionGeneration: {
      searchStrategies: string[];
      creativityMechanisms: string[];
      analogicalReasoning: string[];
    };
    evaluation: {
      criteria: string[];
      weightingFactors: string[];
      uncertaintyHandling: string[];
    };
  };
}
export interface ExpertiseTransferFramework {
  knowledgeExternalization: {
    explicitationMethods: string[];
    structuringApproaches: string[];
    representationFormats: string[];
    validationStrategies: string[];
  };
  learningDesign: {
    scaffoldingStrategies: string[];
    progressionSequences: string[];
    practiceOpportunities: string[];
    feedbackMechanisms: string[];
  };
  adaptiveInstruction: {
    expertiseAssessment: string[];
    personalizationFactors: string[];
    difficultyProgression: string[];
    supportAdjustment: string[];
  };
}
export interface QADesignPsychology {
  questionFormulation: {
    cognitiveLoad: {
      intrinsicLoad: string[];
      extraneousLoad: string[];
      germaneLoad: string[];
    };
    expertiseElicitation: {
      triggers: string[];
      probes: string[];
      contextActivators: string[];
    };
    thinkingStimulation: {
      analyticalPrompts: string[];
      synthesisTriggers: string[];
      evaluationCues: string[];
    };
  };
  answerStructuring: {
    cognitiveFlow: {
      informationSequencing: string[];
      logicalProgression: string[];
      coherenceMarkers: string[];
    };
    expertiseMarkers: {
      knowledgeDepth: string[];
      experienceIndicators: string[];
      proficiencySignals: string[];
    };
    learningOptimization: {
      memorability: string[];
      transferability: string[];
      applicability: string[];
    };
  };
}
export interface CognitiveScientistOutput {
  expertThinkingModel: ExpertThinkingModel;
  expertiseTransferFramework: ExpertiseTransferFramework;
  qaDesignPsychology: QADesignPsychology;
  implementationGuidance: {
    thinkingProcessIntegration: string[];
    expertiseReplication: string[];
    cognitiveAuthenticity: string[];
    learningEffectiveness: string[];
  };
  validationMethods: {
    expertiseAccuracy: string[];
    cognitiveValidity: string[];
    learningOutcomes: string[];
    transferEffectiveness: string[];
  };
}
export declare class CognitiveScientist extends BaseAgent {
  constructor(logger: Logger);
  protected handle(
    content: unknown,
    context?: AgentContext,
  ): Promise<CognitiveScientistOutput>;
  private parseRequest;
  private modelExpertThinking;
  private buildCognitiveArchitecture;
  private identifyMentalModels;
  private analyzeReasoningPatterns;
  private catalogDecisionHeuristics;
  private mapKnowledgeStructure;
  private categorizeCoreKnowledge;
  private analyzeKnowledgeOrganization;
  private identifyTacitKnowledge;
  private analyzeCognitiveProcesses;
  private modelProblemIdentification;
  private modelSolutionGeneration;
  private modelEvaluation;
  private designExpertiseTransfer;
  private designKnowledgeExternalization;
  private createLearningDesign;
  private developAdaptiveInstruction;
  private developQADesignPsychology;
  private designQuestionFormulation;
  private designAnswerStructuring;
  private createImplementationGuidance;
  private establishValidationMethods;
  protected assessConfidence(result: unknown): Promise<number>;
  protected explainReasoning(
    input: unknown,
    output: unknown,
    context?: AgentContext,
  ): Promise<string>;
}
//# sourceMappingURL=cognitiveScientist.d.ts.map
