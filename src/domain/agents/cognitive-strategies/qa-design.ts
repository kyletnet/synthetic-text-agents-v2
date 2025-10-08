/**
 * QA Design Strategy
 *
 * Designs Q&A pairs with cognitive psychology principles:
 * - Question formulation (cognitive load, expertise elicitation)
 * - Answer structuring (cognitive flow, expertise markers)
 * - Learning optimization (memorability, transferability)
 */

import {
  BaseCognitiveStrategy,
  type CognitiveContext,
} from "../cognitive-strategy.js";
import type { ExpertThinkingModel } from "./expert-modeling.js";

/**
 * QA design psychology framework
 */
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

/**
 * Input for QA design
 */
export interface QADesignInput {
  expertModel: ExpertThinkingModel;
}

/**
 * QA Design Strategy
 *
 * Applies cognitive psychology principles to design effective Q&A pairs.
 * This strategy ensures questions elicit expert thinking and answers
 * facilitate knowledge transfer and learning.
 */
export class QADesignStrategy extends BaseCognitiveStrategy<
  QADesignInput,
  QADesignPsychology
> {
  constructor() {
    super(
      "qa-design",
      "QA Design Strategy",
      "Designs Q&A pairs using cognitive psychology principles",
    );
  }

  /**
   * Perform QA design analysis
   */
  protected async performAnalysis(
    input: QADesignInput,
    _context: CognitiveContext,
  ): Promise<QADesignPsychology> {
    const questionFormulation = this.designQuestionFormulation(input);
    const answerStructuring = this.designAnswerStructuring(input);

    return {
      questionFormulation,
      answerStructuring,
    };
  }

  /**
   * Calculate confidence based on design completeness
   */
  protected async calculateConfidence(
    output: QADesignPsychology,
    _context: CognitiveContext,
  ): Promise<number> {
    const cognitiveLoadElements = Object.values(
      output.questionFormulation.cognitiveLoad,
    ).reduce((sum, arr) => sum + arr.length, 0);
    const flowElements = Object.values(
      output.answerStructuring.cognitiveFlow,
    ).reduce((sum, arr) => sum + arr.length, 0);

    // Higher confidence with more comprehensive design elements
    const completeness = (cognitiveLoadElements + flowElements) / 20;
    const baseConfidence = 0.85;

    return Math.min(baseConfidence + completeness * 0.1, 0.95);
  }

  /**
   * Collect metadata about the design
   */
  protected async collectMetadata(
    output: QADesignPsychology,
    _context: CognitiveContext,
  ): Promise<Record<string, unknown>> {
    return {
      questionElements: Object.values(output.questionFormulation).length,
      answerElements: Object.values(output.answerStructuring).length,
      cognitiveLoadStrategies: Object.keys(
        output.questionFormulation.cognitiveLoad,
      ).length,
      expertiseMarkersCount:
        output.answerStructuring.expertiseMarkers.knowledgeDepth.length,
    };
  }

  /**
   * Validate input has expert model
   */
  validateInput(input: QADesignInput): boolean {
    return (
      input !== null &&
      input !== undefined &&
      input.expertModel !== null &&
      input.expertModel !== undefined
    );
  }

  /**
   * Design question formulation strategies
   */
  private designQuestionFormulation(
    _input: QADesignInput,
  ): QADesignPsychology["questionFormulation"] {
    return {
      cognitiveLoad: {
        intrinsicLoad: [
          "focus on single concept or procedure at basic level",
          "use familiar terminology and context",
          "limit information elements per question",
          "align question complexity with expertise level",
        ],
        extraneousLoad: [
          "eliminate irrelevant details and distractors",
          "use clear and direct language",
          "avoid complex sentence structures",
          "minimize cognitive switching between contexts",
        ],
        germaneLoad: [
          "promote schema construction and pattern recognition",
          "encourage connections between concepts",
          "stimulate deep processing and understanding",
          "facilitate transfer to new situations",
        ],
      },
      expertiseElicitation: {
        triggers: [
          "present realistic professional scenarios",
          "include contextual cues that activate expert knowledge",
          "use domain-specific terminology appropriately",
          "reference familiar tools and processes",
        ],
        probes: [
          "ask for reasoning behind decisions",
          "request explanation of alternative approaches",
          "inquire about potential complications or edge cases",
          "explore stakeholder considerations and trade-offs",
        ],
        contextActivators: [
          "specify realistic constraints and limitations",
          "include relevant stakeholder perspectives",
          "reference organizational or environmental factors",
          "incorporate time pressure and urgency elements",
        ],
      },
      thinkingStimulation: {
        analyticalPrompts: [
          "analyze the root causes of...",
          "evaluate the pros and cons of...",
          "compare and contrast different approaches to...",
          "diagnose the key factors contributing to...",
        ],
        synthesisTriggers: [
          "develop a comprehensive approach that...",
          "integrate multiple perspectives to create...",
          "design a solution that addresses...",
          "combine different strategies to achieve...",
        ],
        evaluationCues: [
          "assess the effectiveness of...",
          "determine the best course of action when...",
          "judge the quality or appropriateness of...",
          "prioritize actions based on...",
        ],
      },
    };
  }

  /**
   * Design answer structuring strategies
   */
  private designAnswerStructuring(
    _input: QADesignInput,
  ): QADesignPsychology["answerStructuring"] {
    return {
      cognitiveFlow: {
        informationSequencing: [
          "present overview before details",
          "follow logical progression from problem to solution",
          "sequence information according to expert reasoning patterns",
          "use progressive disclosure for complex information",
        ],
        logicalProgression: [
          "establish context and problem definition first",
          "present analysis and reasoning processes",
          "provide solution or recommendation",
          "include implementation considerations and validation",
        ],
        coherenceMarkers: [
          "use clear transitions between ideas",
          "employ consistent terminology throughout",
          "reference previous points when building arguments",
          "provide explicit structure and organization cues",
        ],
      },
      expertiseMarkers: {
        knowledgeDepth: [
          "include domain-specific technical details",
          "reference relevant theories, frameworks, or methodologies",
          "demonstrate understanding of complex relationships",
          "show awareness of edge cases and exceptions",
        ],
        experienceIndicators: [
          "share insights from practical application",
          "mention common pitfalls and how to avoid them",
          "reference what typically works in practice",
          "include lessons learned from experience",
        ],
        proficiencySignals: [
          "demonstrate confident decision-making",
          "show ability to handle uncertainty and ambiguity",
          "exhibit efficient problem-solving approaches",
          "display metacognitive awareness of expertise",
        ],
      },
      learningOptimization: {
        memorability: [
          "use concrete examples and vivid imagery",
          "create meaningful connections to existing knowledge",
          "employ storytelling and narrative structures",
          "include distinctive and memorable details",
        ],
        transferability: [
          "emphasize underlying principles and patterns",
          "provide multiple examples from different contexts",
          "explain when and where to apply knowledge",
          "highlight generalizable strategies and approaches",
        ],
        applicability: [
          "include specific, actionable steps",
          "provide realistic implementation guidance",
          "address common obstacles and solutions",
          "offer criteria for success and evaluation",
        ],
      },
    };
  }
}
