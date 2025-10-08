/**
 * Knowledge Extraction Strategy
 *
 * Extracts and structures expert knowledge for transfer:
 * - Knowledge externalization methods
 * - Learning design strategies
 * - Adaptive instruction approaches
 */

import {
  BaseCognitiveStrategy,
  type CognitiveContext,
} from "../cognitive-strategy.js";
import type { ExpertThinkingModel } from "./expert-modeling.js";

/**
 * Expertise transfer framework
 */
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

/**
 * Input for knowledge extraction
 */
export interface KnowledgeExtractionInput {
  expertModel: ExpertThinkingModel;
}

/**
 * Knowledge Extraction Strategy
 *
 * Transforms expert thinking models into transferable knowledge frameworks.
 * This strategy focuses on making tacit knowledge explicit and designing
 * effective learning experiences.
 */
export class KnowledgeExtractionStrategy extends BaseCognitiveStrategy<
  KnowledgeExtractionInput,
  ExpertiseTransferFramework
> {
  constructor() {
    super(
      "knowledge-extraction",
      "Knowledge Extraction Strategy",
      "Extracts and structures expert knowledge for effective transfer",
    );
  }

  /**
   * Perform knowledge extraction analysis
   */
  protected async performAnalysis(
    input: KnowledgeExtractionInput,
    _context: CognitiveContext,
  ): Promise<ExpertiseTransferFramework> {
    const knowledgeExternalization = this.designKnowledgeExternalization(input);
    const learningDesign = this.createLearningDesign(input);
    const adaptiveInstruction = this.developAdaptiveInstruction(input);

    return {
      knowledgeExternalization,
      learningDesign,
      adaptiveInstruction,
    };
  }

  /**
   * Calculate confidence based on framework completeness
   */
  protected async calculateConfidence(
    output: ExpertiseTransferFramework,
    _context: CognitiveContext,
  ): Promise<number> {
    const methodsCount =
      output.knowledgeExternalization.explicitationMethods.length;
    const strategiesCount = output.learningDesign.scaffoldingStrategies.length;
    const assessmentCount =
      output.adaptiveInstruction.expertiseAssessment.length;

    // Higher confidence with more comprehensive frameworks
    const completeness =
      (methodsCount + strategiesCount + assessmentCount) / 15;
    const baseConfidence = 0.8;

    return Math.min(baseConfidence + completeness * 0.1, 0.95);
  }

  /**
   * Collect metadata about the extraction
   */
  protected async collectMetadata(
    output: ExpertiseTransferFramework,
    _context: CognitiveContext,
  ): Promise<Record<string, unknown>> {
    return {
      externalizationMethodsCount:
        output.knowledgeExternalization.explicitationMethods.length,
      learningStrategiesCount:
        output.learningDesign.scaffoldingStrategies.length,
      adaptiveFactorsCount:
        output.adaptiveInstruction.personalizationFactors.length,
    };
  }

  /**
   * Validate input has expert model
   */
  validateInput(input: KnowledgeExtractionInput): boolean {
    return (
      input !== null &&
      input !== undefined &&
      input.expertModel !== null &&
      input.expertModel !== undefined
    );
  }

  /**
   * Design knowledge externalization approach
   */
  private designKnowledgeExternalization(
    _input: KnowledgeExtractionInput,
  ): ExpertiseTransferFramework["knowledgeExternalization"] {
    return {
      explicitationMethods: [
        "think-aloud protocols during problem solving",
        "case-based reasoning explanations",
        "decision tree articulation",
        "mental model diagramming",
        "process flow documentation with rationale",
      ],
      structuringApproaches: [
        "hierarchical knowledge organization",
        "network-based concept mapping",
        "procedural step-by-step breakdowns",
        "conditional rule articulation",
        "pattern-based knowledge clustering",
      ],
      representationFormats: [
        "structured Q&A pairs with reasoning",
        "case studies with expert commentary",
        "decision frameworks with examples",
        "process diagrams with decision points",
        "scenario-based problem solutions",
      ],
      validationStrategies: [
        "expert review and verification",
        "novice comprehension testing",
        "application validation in realistic scenarios",
        "peer expert consensus checking",
        "outcome effectiveness measurement",
      ],
    };
  }

  /**
   * Create learning design framework
   */
  private createLearningDesign(
    _input: KnowledgeExtractionInput,
  ): ExpertiseTransferFramework["learningDesign"] {
    return {
      scaffoldingStrategies: [
        "progressive complexity introduction",
        "guided practice with decreasing support",
        "expert reasoning model demonstration",
        "error correction with explanation",
        "metacognitive strategy instruction",
      ],
      progressionSequences: [
        "foundational knowledge before procedures",
        "simple before complex scenario applications",
        "guided before independent practice",
        "local before systemic thinking",
        "routine before adaptive expertise",
      ],
      practiceOpportunities: [
        "realistic scenario-based problems",
        "varied context application practice",
        "decision-making simulation exercises",
        "case-based reasoning practice",
        "collaborative problem-solving activities",
      ],
      feedbackMechanisms: [
        "immediate correctness feedback",
        "explanatory feedback on reasoning",
        "comparative feedback against expert solutions",
        "self-assessment and reflection prompts",
        "peer feedback and discussion",
      ],
    };
  }

  /**
   * Develop adaptive instruction framework
   */
  private developAdaptiveInstruction(
    _input: KnowledgeExtractionInput,
  ): ExpertiseTransferFramework["adaptiveInstruction"] {
    return {
      expertiseAssessment: [
        "prior knowledge and experience evaluation",
        "reasoning pattern recognition assessment",
        "decision-making quality evaluation",
        "metacognitive awareness testing",
        "domain-specific skill demonstration",
      ],
      personalizationFactors: [
        "learning style preferences and needs",
        "expertise level and background knowledge",
        "professional role and responsibilities",
        "time constraints and learning context",
        "motivation and learning objectives",
      ],
      difficultyProgression: [
        "adaptive complexity adjustment based on performance",
        "prerequisite mastery before advancement",
        "individual pace accommodation",
        "challenge level optimization for engagement",
        "remediation for knowledge gaps",
      ],
      supportAdjustment: [
        "scaffolding level adaptation",
        "feedback frequency and detail modification",
        "guidance versus independence balance",
        "resource provision based on needs",
        "social support and collaboration facilitation",
      ],
    };
  }
}
