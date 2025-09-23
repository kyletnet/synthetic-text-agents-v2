import { BaseAgent } from "../core/baseAgent.js";
import { AgentContext } from "../shared/types.js";
import { Logger } from "../shared/logger.js";
export interface LinguisticsAnalysisRequest {
  targetLLM: "claude" | "gpt" | "gemini" | "generic";
  domain: string;
  complexityLevel: number;
  qualityTarget: number;
  outputFormat: "qa-pairs" | "structured" | "conversational";
  existingPrompt?: string;
  terminologyRequirements?: string[];
}
export interface LLMOptimization {
  modelCharacteristics: {
    contextWindow: number;
    tokenEfficiency: number;
    instructionFollowing: "excellent" | "good" | "moderate";
    reasoningCapability: "advanced" | "standard" | "basic";
    creativityLevel: "high" | "medium" | "low";
  };
  promptStructure: {
    optimalFormat: string;
    sectionOrganization: string[];
    instructionClarity: string[];
    examplePlacement: "before" | "after" | "inline" | "none";
  };
  tokenOptimization: {
    estimatedTokens: number;
    reductionStrategies: string[];
    efficiencyScore: number;
  };
  outputParsing: {
    formatSpecification: string;
    validationCriteria: string[];
    errorHandling: string[];
  };
}
export interface LanguageQuality {
  clarity: {
    score: number;
    improvements: string[];
    readabilityLevel: string;
  };
  consistency: {
    score: number;
    terminologyAlignment: string[];
    styleCoherence: string[];
  };
  precision: {
    score: number;
    specificityEnhancements: string[];
    ambiguityReduction: string[];
  };
  naturalness: {
    score: number;
    flowImprovements: string[];
    conversationalElements: string[];
  };
}
export interface TerminologyFramework {
  domainVocabulary: {
    coreTerms: string[];
    technicalConcepts: string[];
    industryJargon: string[];
    alternativeExpressions: Record<string, string[]>;
  };
  usageGuidelines: {
    appropriateContexts: Record<string, string>;
    avoidancePatterns: string[];
    clarificationNeeds: string[];
  };
  consistencyRules: {
    preferredTerms: Record<string, string>;
    synonymHandling: string[];
    definitionRequirements: string[];
  };
}
export interface LinguisticsEngineerOutput {
  llmOptimization: LLMOptimization;
  languageQuality: LanguageQuality;
  terminologyFramework: TerminologyFramework;
  structuralRecommendations: {
    promptArchitecture: string[];
    informationHierarchy: string[];
    coherenceStrategies: string[];
    diversityMechanisms: string[];
  };
  performancePredictions: {
    generationQuality: number;
    consistencyExpectation: number;
    tokenEfficiency: number;
    processingSpeed: "fast" | "medium" | "slow";
  };
}
export declare class LinguisticsEngineer extends BaseAgent {
  constructor(logger: Logger);
  protected handle(
    content: unknown,
    context?: AgentContext,
  ): Promise<LinguisticsEngineerOutput>;
  private parseRequest;
  private optimizeForLLM;
  private analyzeLLMCharacteristics;
  private optimizePromptStructure;
  private optimizeTokenUsage;
  private designOutputParsing;
  private analyzeLanguageQuality;
  private assessClarity;
  private assessConsistency;
  private assessPrecision;
  private assessNaturalness;
  private developTerminologyFramework;
  private buildDomainVocabulary;
  private createUsageGuidelines;
  private establishConsistencyRules;
  private generateStructuralRecommendations;
  private predictPerformance;
  protected assessConfidence(result: unknown): Promise<number>;
  protected explainReasoning(
    input: unknown,
    output: unknown,
    context?: AgentContext,
  ): Promise<string>;
}
//# sourceMappingURL=linguisticsEngineer.d.ts.map
