/**
 * Expert Modeling Strategy
 *
 * Models expert thinking patterns including:
 * - Cognitive architecture (mental models, reasoning patterns, heuristics)
 * - Problem identification and solution generation processes
 * - Evaluation and decision-making patterns
 */

import {
  BaseCognitiveStrategy,
  type CognitiveAnalysisRequest,
  type CognitiveContext,
} from "../cognitive-strategy.js";

/**
 * Expert thinking model structure
 */
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

/**
 * Expert Modeling Strategy
 *
 * Analyzes and models expert thinking patterns for a given domain.
 * This strategy focuses on understanding how experts think, reason,
 * and make decisions in their domain of expertise.
 */
export class ExpertModelingStrategy extends BaseCognitiveStrategy<
  CognitiveAnalysisRequest,
  ExpertThinkingModel
> {
  constructor() {
    super(
      "expert-modeling",
      "Expert Modeling Strategy",
      "Models expert thinking patterns and cognitive processes",
    );
  }

  /**
   * Perform expert modeling analysis
   */
  protected async performAnalysis(
    request: CognitiveAnalysisRequest,
    _context: CognitiveContext,
  ): Promise<ExpertThinkingModel> {
    // Build cognitive architecture
    const cognitiveArchitecture = await this.buildCognitiveArchitecture(
      request,
    );

    // Map knowledge structure
    const knowledgeStructure = await this.mapKnowledgeStructure(request);

    // Analyze cognitive processes
    const cognitiveProcesses = await this.analyzeCognitiveProcesses(request);

    return {
      cognitiveArchitecture,
      knowledgeStructure,
      cognitiveProcesses,
    };
  }

  /**
   * Calculate confidence based on model completeness
   */
  protected async calculateConfidence(
    output: ExpertThinkingModel,
    context: CognitiveContext,
  ): Promise<number> {
    const reasoningPatternsCount =
      output.cognitiveArchitecture.reasoningPatterns.length;
    const mentalModelsCount = output.cognitiveArchitecture.mentalModels.length;

    // Higher confidence for well-modeled thinking patterns
    const modelComplexity = (reasoningPatternsCount + mentalModelsCount) / 10;
    const baseConfidence = 0.75;
    const complexityBonus = Math.min(modelComplexity * 0.1, 0.1);

    // Adjust for expertise level
    const expertiseBonus =
      context.request.expertiseLevel === "specialist"
        ? 0.05
        : context.request.expertiseLevel === "expert"
        ? 0.03
        : 0.0;

    return Math.min(baseConfidence + complexityBonus + expertiseBonus, 0.95);
  }

  /**
   * Collect metadata about the analysis
   */
  protected async collectMetadata(
    output: ExpertThinkingModel,
    context: CognitiveContext,
  ): Promise<Record<string, unknown>> {
    return {
      mentalModelsCount: output.cognitiveArchitecture.mentalModels.length,
      reasoningPatternsCount:
        output.cognitiveArchitecture.reasoningPatterns.length,
      heuristicsCount: output.cognitiveArchitecture.decisionHeuristics.length,
      domain: context.request.expertDomain,
      expertiseLevel: context.request.expertiseLevel,
    };
  }

  /**
   * Build cognitive architecture including mental models, reasoning patterns, and heuristics
   */
  private async buildCognitiveArchitecture(
    request: CognitiveAnalysisRequest,
  ): Promise<ExpertThinkingModel["cognitiveArchitecture"]> {
    const mentalModels = this.identifyMentalModels(request);
    const reasoningPatterns = this.analyzeReasoningPatterns(request);
    const decisionHeuristics = this.catalogDecisionHeuristics(request);

    return {
      mentalModels,
      reasoningPatterns,
      decisionHeuristics,
    };
  }

  /**
   * Identify domain-specific mental models
   */
  private identifyMentalModels(
    request: CognitiveAnalysisRequest,
  ): ExpertThinkingModel["cognitiveArchitecture"]["mentalModels"] {
    const models = [];

    // Domain-specific mental models
    const domainModels: Record<
      string,
      ExpertThinkingModel["cognitiveArchitecture"]["mentalModels"][0]
    > = {
      customer_service: {
        name: "Customer Journey Mental Model",
        description:
          "Cognitive representation of customer experience lifecycle",
        components: [
          "touchpoints",
          "emotional states",
          "pain points",
          "expectations",
          "outcomes",
        ],
        relationships: [
          "sequential progression",
          "emotional transitions",
          "satisfaction drivers",
          "service recovery",
        ],
      },
      sales: {
        name: "Sales Process Mental Model",
        description: "Cognitive framework for managing sales opportunities",
        components: [
          "prospect qualification",
          "need identification",
          "solution mapping",
          "objection handling",
          "closing",
        ],
        relationships: [
          "pipeline progression",
          "stakeholder influence",
          "value proposition alignment",
          "timing optimization",
        ],
      },
      marketing: {
        name: "Market Dynamics Mental Model",
        description:
          "Cognitive representation of market forces and customer behavior",
        components: [
          "market segments",
          "customer personas",
          "competitive landscape",
          "value propositions",
          "channels",
        ],
        relationships: [
          "segment interactions",
          "competitive responses",
          "channel synergies",
          "customer lifecycle",
        ],
      },
    };

    // Add domain-specific model
    if (domainModels[request.expertDomain]) {
      models.push(domainModels[request.expertDomain]);
    }

    // Generic professional mental models
    models.push({
      name: "Problem-Solution Mental Model",
      description: "Framework for systematic problem analysis and resolution",
      components: [
        "problem definition",
        "root causes",
        "solution options",
        "implementation plan",
        "success metrics",
      ],
      relationships: [
        "causal chains",
        "solution mapping",
        "risk-benefit analysis",
        "stakeholder impact",
      ],
    });

    models.push({
      name: "Stakeholder Ecosystem Model",
      description: "Understanding of stakeholder relationships and influences",
      components: [
        "primary stakeholders",
        "secondary influencers",
        "decision makers",
        "implementation agents",
      ],
      relationships: [
        "power dynamics",
        "influence networks",
        "communication flows",
        "alignment factors",
      ],
    });

    // Expertise level adjustments
    if (
      request.expertiseLevel === "expert" ||
      request.expertiseLevel === "specialist"
    ) {
      models.push({
        name: "Strategic Systems Model",
        description:
          "High-level understanding of system interactions and long-term dynamics",
        components: [
          "system boundaries",
          "feedback loops",
          "leverage points",
          "emergent properties",
        ],
        relationships: [
          "system interactions",
          "dynamic equilibrium",
          "change propagation",
          "unintended consequences",
        ],
      });
    }

    return models;
  }

  /**
   * Analyze reasoning patterns used by experts
   */
  private analyzeReasoningPatterns(
    request: CognitiveAnalysisRequest,
  ): ExpertThinkingModel["cognitiveArchitecture"]["reasoningPatterns"] {
    const patterns = [];

    // Pattern Recognition Based Reasoning
    patterns.push({
      pattern: "Pattern Recognition Reasoning",
      triggerConditions: [
        "familiar situation encountered",
        "similar cases available",
        "pattern cues present",
      ],
      steps: [
        "Identify key situational features",
        "Match features to known patterns",
        "Retrieve similar case experiences",
        "Adapt previous solutions to current context",
        "Validate pattern applicability",
      ],
      outputCharacteristics: [
        "rapid recognition",
        "experience-based confidence",
        "analogical solutions",
        "contextual adaptations",
      ],
    });

    // Analytical Decomposition
    patterns.push({
      pattern: "Systematic Decomposition Reasoning",
      triggerConditions: [
        "complex novel problems",
        "high stakes decisions",
        "multiple variables present",
      ],
      steps: [
        "Break down problem into components",
        "Analyze each component systematically",
        "Identify interdependencies and relationships",
        "Synthesize component analyses",
        "Evaluate holistic solution coherence",
      ],
      outputCharacteristics: [
        "thorough analysis",
        "logical structure",
        "comprehensive coverage",
        "systematic approach",
      ],
    });

    // Domain-specific reasoning patterns
    if (request.expertDomain === "customer_service") {
      patterns.push({
        pattern: "Empathetic Problem-Solving",
        triggerConditions: [
          "customer distress detected",
          "emotional context present",
          "relationship factors important",
        ],
        steps: [
          "Acknowledge and validate emotions",
          "Understand customer perspective deeply",
          "Identify underlying needs and concerns",
          "Generate solutions considering emotional impact",
          "Communicate with empathy and clarity",
        ],
        outputCharacteristics: [
          "emotional intelligence",
          "relationship preservation",
          "holistic solutions",
          "trust building",
        ],
      });
    } else if (request.expertDomain === "sales") {
      patterns.push({
        pattern: "Consultative Reasoning",
        triggerConditions: [
          "client needs assessment",
          "solution design required",
          "value demonstration needed",
        ],
        steps: [
          "Discover client situation and challenges",
          "Identify decision criteria and success factors",
          "Map solution capabilities to client needs",
          "Quantify value proposition and ROI",
          "Address concerns and build commitment",
        ],
        outputCharacteristics: [
          "client-centric focus",
          "value articulation",
          "consultative approach",
          "trust-based relationships",
        ],
      });
    }

    // Expertise level adjustments
    if (
      request.expertiseLevel === "expert" ||
      request.expertiseLevel === "specialist"
    ) {
      patterns.push({
        pattern: "Intuitive-Analytical Integration",
        triggerConditions: [
          "high complexity situations",
          "time pressure",
          "incomplete information",
        ],
        steps: [
          "Generate intuitive hypothesis based on experience",
          "Conduct rapid analytical validation",
          "Integrate intuitive and analytical insights",
          "Make confident decisions with uncertainty",
          "Monitor outcomes for pattern refinement",
        ],
        outputCharacteristics: [
          "expert intuition",
          "rapid processing",
          "confident uncertainty handling",
          "adaptive expertise",
        ],
      });
    }

    return patterns;
  }

  /**
   * Catalog decision heuristics used by experts
   */
  private catalogDecisionHeuristics(
    request: CognitiveAnalysisRequest,
  ): ExpertThinkingModel["cognitiveArchitecture"]["decisionHeuristics"] {
    const heuristics = [];

    // Universal professional heuristics
    heuristics.push({
      heuristic: "Stakeholder Impact Assessment",
      applicableContexts: [
        "strategic decisions",
        "process changes",
        "resource allocation",
      ],
      reliability: "high" as const,
      biasRisks: ["stakeholder favoritism", "political considerations"],
    });

    heuristics.push({
      heuristic: "Risk-Benefit Analysis",
      applicableContexts: [
        "investment decisions",
        "change initiatives",
        "solution selection",
      ],
      reliability: "high" as const,
      biasRisks: ["optimism bias", "loss aversion", "probability neglect"],
    });

    heuristics.push({
      heuristic: "Past Success Replication",
      applicableContexts: [
        "similar situations",
        "proven approaches",
        "low-risk decisions",
      ],
      reliability: "medium" as const,
      biasRisks: [
        "availability bias",
        "confirmation bias",
        "representativeness bias",
      ],
    });

    // Domain-specific heuristics
    const domainHeuristics: Record<string, typeof heuristics> = {
      customer_service: [
        {
          heuristic: "Customer Effort Minimization",
          applicableContexts: [
            "process design",
            "service delivery",
            "problem resolution",
          ],
          reliability: "high" as const,
          biasRisks: ["oversimplification", "capability underestimation"],
        },
        {
          heuristic: "Emotional State Prioritization",
          applicableContexts: [
            "upset customers",
            "service recovery",
            "escalation handling",
          ],
          reliability: "high" as const,
          biasRisks: ["emotional contagion", "overcompensation"],
        },
      ],
      sales: [
        {
          heuristic: "Value-First Positioning",
          applicableContexts: [
            "objection handling",
            "pricing discussions",
            "competitive situations",
          ],
          reliability: "high" as const,
          biasRisks: ["value overestimation", "cost minimization"],
        },
        {
          heuristic: "Decision Maker Focus",
          applicableContexts: [
            "complex sales",
            "organizational selling",
            "proposal development",
          ],
          reliability: "medium" as const,
          biasRisks: ["influencer neglect", "process oversimplification"],
        },
      ],
    };

    if (domainHeuristics[request.expertDomain]) {
      heuristics.push(...domainHeuristics[request.expertDomain]);
    }

    // Complexity-based heuristics
    if (request.cognitiveComplexity >= 7) {
      heuristics.push({
        heuristic: "Systems Thinking Application",
        applicableContexts: [
          "complex systems",
          "multiple stakeholders",
          "long-term consequences",
        ],
        reliability: "medium" as const,
        biasRisks: [
          "analysis paralysis",
          "complexity bias",
          "system justification",
        ],
      });
    }

    return heuristics;
  }

  /**
   * Map knowledge structure of experts
   */
  private async mapKnowledgeStructure(
    request: CognitiveAnalysisRequest,
  ): Promise<ExpertThinkingModel["knowledgeStructure"]> {
    const coreKnowledge = this.categorizeCoreKnowledge(request);
    const knowledgeOrganization = this.analyzeKnowledgeOrganization(request);
    const tacitKnowledge = this.identifyTacitKnowledge(request);

    return {
      coreKnowledge,
      knowledgeOrganization,
      tacitKnowledge,
    };
  }

  /**
   * Categorize core knowledge types
   */
  private categorizeCoreKnowledge(
    request: CognitiveAnalysisRequest,
  ): ExpertThinkingModel["knowledgeStructure"]["coreKnowledge"] {
    const knowledge = {
      factual: [] as string[],
      procedural: [] as string[],
      conditional: [] as string[],
      metacognitive: [] as string[],
    };

    // Domain-specific factual knowledge
    const domainFacts: Record<string, string[]> = {
      customer_service: [
        "service level agreements and standards",
        "product features and limitations",
        "company policies and procedures",
        "escalation paths and authority levels",
        "customer segment characteristics",
      ],
      sales: [
        "product capabilities and pricing",
        "competitive landscape and differentiation",
        "market segments and sizing",
        "buyer personas and decision processes",
        "sales methodologies and frameworks",
      ],
      marketing: [
        "market research and customer insights",
        "channel effectiveness and reach",
        "campaign performance metrics",
        "competitive positioning and messaging",
        "brand guidelines and standards",
      ],
    };

    knowledge.factual = domainFacts[request.expertDomain] || [
      "industry standards and best practices",
      "regulatory requirements and compliance",
      "organizational structure and processes",
      "stakeholder roles and responsibilities",
      "performance metrics and benchmarks",
    ];

    // Procedural knowledge (how to do things)
    const domainProcedures: Record<string, string[]> = {
      customer_service: [
        "issue diagnosis and troubleshooting",
        "service recovery processes",
        "customer communication protocols",
        "escalation management procedures",
        "quality assurance methods",
      ],
      sales: [
        "opportunity qualification processes",
        "needs discovery techniques",
        "proposal development methods",
        "objection handling approaches",
        "closing and negotiation tactics",
      ],
      marketing: [
        "campaign development processes",
        "audience research methods",
        "content creation workflows",
        "performance analysis techniques",
        "optimization and testing procedures",
      ],
    };

    knowledge.procedural = domainProcedures[request.expertDomain] || [
      "problem analysis and diagnosis",
      "solution development and design",
      "implementation planning and execution",
      "performance monitoring and adjustment",
      "stakeholder communication and management",
    ];

    // Conditional knowledge (when/why to apply knowledge)
    knowledge.conditional = [
      "situational factors influencing approach selection",
      "stakeholder considerations affecting decisions",
      "risk factors requiring alternative approaches",
      "timing considerations for optimal outcomes",
      "resource constraints impacting solution choice",
      "cultural and contextual adaptation requirements",
    ];

    // Metacognitive knowledge
    knowledge.metacognitive = [
      "awareness of expertise strengths and limitations",
      "recognition of when additional expertise needed",
      "understanding of decision-making biases and blind spots",
      "knowledge of effective learning and improvement strategies",
      "awareness of expertise development stages and requirements",
    ];

    return knowledge;
  }

  /**
   * Analyze how knowledge is organized
   */
  private analyzeKnowledgeOrganization(
    _request: CognitiveAnalysisRequest,
  ): ExpertThinkingModel["knowledgeStructure"]["knowledgeOrganization"] {
    return {
      hierarchies: [
        "conceptual frameworks organizing domain knowledge",
        "procedural sequences from basic to advanced",
        "stakeholder influence and authority structures",
        "risk severity and probability classifications",
      ],
      associations: [
        "cause-effect relationships between actions and outcomes",
        "similarity patterns across different scenarios",
        "stakeholder relationship networks and influences",
        "tool-task-outcome association patterns",
      ],
      patterns: [
        "recurring problem types and solution approaches",
        "seasonal or cyclical variations in domain challenges",
        "stakeholder behavior patterns and predictable responses",
        "success factor patterns across different contexts",
      ],
      schemas: [
        "standard operating procedure templates",
        "decision-making frameworks and checklists",
        "communication templates for different audiences",
        "evaluation criteria and assessment frameworks",
      ],
    };
  }

  /**
   * Identify tacit knowledge
   */
  private identifyTacitKnowledge(
    _request: CognitiveAnalysisRequest,
  ): ExpertThinkingModel["knowledgeStructure"]["tacitKnowledge"] {
    return {
      intuitions: [
        "sense of when situations require immediate attention",
        "feeling for stakeholder receptiveness and resistance",
        "intuition about solution feasibility and acceptance",
        "sense of timing for optimal intervention or communication",
      ],
      experienceBasedInsights: [
        "understanding of what actually works in practice versus theory",
        "knowledge of common implementation pitfalls and how to avoid them",
        "insights about stakeholder motivations and hidden agendas",
        "awareness of organizational dynamics and informal influence networks",
      ],
      situationalAwareness: [
        "recognition of environmental and contextual cues",
        "sensitivity to stakeholder emotional states and concerns",
        "awareness of organizational climate and readiness for change",
        "perception of competitive dynamics and market shifts",
      ],
      implicitRules: [
        "unwritten norms about appropriate professional behavior",
        "informal guidelines for stakeholder interaction and communication",
        "implicit quality standards and expectation levels",
        "tacit understanding of organizational priorities and values",
      ],
    };
  }

  /**
   * Analyze cognitive processes
   */
  private async analyzeCognitiveProcesses(
    request: CognitiveAnalysisRequest,
  ): Promise<ExpertThinkingModel["cognitiveProcesses"]> {
    const problemIdentification = this.modelProblemIdentification(request);
    const solutionGeneration = this.modelSolutionGeneration(request);
    const evaluation = this.modelEvaluation(request);

    return {
      problemIdentification,
      solutionGeneration,
      evaluation,
    };
  }

  /**
   * Model problem identification processes
   */
  private modelProblemIdentification(
    _request: CognitiveAnalysisRequest,
  ): ExpertThinkingModel["cognitiveProcesses"]["problemIdentification"] {
    return {
      cueRecognition: [
        "stakeholder behavior changes indicating issues",
        "performance metric deviations from expected ranges",
        "environmental changes affecting standard operations",
        "feedback patterns indicating systemic problems",
      ],
      patternMatching: [
        "comparison with previously encountered problem types",
        "identification of similar contextual factors",
        "recognition of stakeholder involvement patterns",
        "matching problem symptoms to known root causes",
      ],
      contextualAnalysis: [
        "assessment of organizational readiness and capabilities",
        "evaluation of resource constraints and availability",
        "analysis of stakeholder interests and potential conflicts",
        "consideration of timing and external environmental factors",
      ],
    };
  }

  /**
   * Model solution generation processes
   */
  private modelSolutionGeneration(
    _request: CognitiveAnalysisRequest,
  ): ExpertThinkingModel["cognitiveProcesses"]["solutionGeneration"] {
    return {
      searchStrategies: [
        "systematic exploration of solution alternatives",
        "analogical reasoning from similar past situations",
        "creative combination of existing approaches",
        "consultation with experts and stakeholders for input",
      ],
      creativityMechanisms: [
        "brainstorming and ideation techniques",
        "perspective-taking from different stakeholder viewpoints",
        "challenge assumptions and conventional approaches",
        "explore unconventional or innovative alternatives",
      ],
      analogicalReasoning: [
        "identify structural similarities with other domains",
        "adapt successful approaches from different contexts",
        "learn from best practices in related fields",
        "apply proven frameworks to new situations",
      ],
    };
  }

  /**
   * Model evaluation processes
   */
  private modelEvaluation(
    _request: CognitiveAnalysisRequest,
  ): ExpertThinkingModel["cognitiveProcesses"]["evaluation"] {
    return {
      criteria: [
        "feasibility and resource requirements",
        "stakeholder acceptance and support",
        "risk levels and mitigation strategies",
        "expected outcomes and success probability",
        "alignment with organizational goals and values",
      ],
      weightingFactors: [
        "strategic importance and long-term impact",
        "urgency and time constraints",
        "stakeholder influence and political considerations",
        "resource availability and cost considerations",
        "risk tolerance and organizational culture",
      ],
      uncertaintyHandling: [
        "scenario planning for different contingencies",
        "sensitivity analysis for key assumptions",
        "pilot testing and iterative refinement",
        "monitoring systems and feedback loops",
        "contingency planning and risk mitigation",
      ],
    };
  }
}
