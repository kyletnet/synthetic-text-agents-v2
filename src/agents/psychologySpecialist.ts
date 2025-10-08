/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

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
    decisionMakingStyle:
      | "analytical"
      | "intuitive"
      | "collaborative"
      | "directive";
    stressFactors: string[];
    confidenceLevels: string;
  };
  communicationStrategy: {
    optimalTone:
      | "supportive"
      | "authoritative"
      | "collaborative"
      | "reassuring"
      | "direct";
    languageStyle: "formal" | "conversational" | "technical" | "simplified";
    structuralApproach:
      | "step-by-step"
      | "options-based"
      | "narrative"
      | "analytical";
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

export class PsychologySpecialist extends BaseAgent {
  constructor(logger: Logger) {
    super(
      "psychology-specialist",
      "user_psychology_communication_strategy",
      [
        "psychology",
        "user-behavior",
        "communication",
        "motivation",
        "empathy",
        "persuasion",
      ],
      logger,
    );
  }

  protected async handle(
    content: unknown,
    context?: AgentContext,
  ): Promise<PsychologySpecialistOutput> {
    await this.validateInput(content);

    const request = this.parseRequest(content);
    const analysis = await this.conductPsychologyAnalysis(request, context);
    const recommendations = await this.generateRecommendations(
      analysis,
      request,
    );
    const implementationGuidance = await this.createImplementationGuidance(
      analysis,
      request,
    );
    const riskFactors = await this.identifyRiskFactors(analysis, request);

    return {
      analysis,
      recommendations,
      implementationGuidance,
      riskFactors,
    };
  }

  private parseRequest(content: unknown): PsychologyAnalysisRequest {
    if (typeof content === "object" && content !== null) {
      const input = content as any;

      return {
        taskDescription: input.taskDescription || input.description || "",
        targetDomain: input.domain || input.targetDomain || "general",
        userPersona: input.userPersona,
        contextualFactors: input.contextualFactors || {},
        communicationGoals: input.communicationGoals || [],
      };
    }

    throw new Error("Invalid psychology analysis request format");
  }

  private async conductPsychologyAnalysis(
    request: PsychologyAnalysisRequest,
    _context?: AgentContext,
  ): Promise<PsychologyInsights> {
    const userPsychology = await this.analyzeUserPsychology(request);
    const communicationStrategy = await this.developCommunicationStrategy(
      request,
      userPsychology,
    );
    const persuasionPsychology = await this.analyzePersuasionFactors(
      request,
      userPsychology,
    );
    const cognitiveConsiderations = await this.analyzeCognitiveFactors(
      request,
      userPsychology,
    );

    return {
      userPsychology,
      communicationStrategy,
      persuasionPsychology,
      cognitiveConsiderations,
    };
  }

  private async analyzeUserPsychology(request: PsychologyAnalysisRequest) {
    const domain = request.targetDomain;
    const contextualFactors = request.contextualFactors || {};

    // Analyze emotional state based on domain and context
    const emotionalState = this.determineEmotionalState(
      domain,
      contextualFactors,
    );

    // Identify primary motivations
    const primaryMotivations = this.identifyMotivations(
      domain,
      request.taskDescription,
    );

    // Assess cognitive load
    const cognitiveLoad = this.assessCognitiveLoad(
      request.taskDescription,
      contextualFactors.experienceLevel,
    );

    // Determine decision-making style
    const decisionMakingStyle = this.analyzeDecisionMakingStyle(
      domain,
      contextualFactors,
    );

    // Identify stress factors
    const stressFactors = this.identifyStressFactors(domain, contextualFactors);

    // Assess confidence levels
    const confidenceLevels = this.assessConfidenceLevels(
      domain,
      contextualFactors.experienceLevel,
    );

    return {
      emotionalState,
      primaryMotivations,
      cognitiveLoad,
      decisionMakingStyle,
      stressFactors,
      confidenceLevels,
    };
  }

  private determineEmotionalState(
    domain: string,
    contextualFactors: any,
  ): string {
    const domainEmotions: Record<string, string[]> = {
      customer_service: [
        "frustrated",
        "impatient",
        "seeking_resolution",
        "anxious",
      ],
      sales: ["skeptical", "evaluating", "pressured", "hopeful"],
      marketing: [
        "curious",
        "evaluating_options",
        "comparison_mode",
        "research_focused",
      ],
      healthcare: ["anxious", "concerned", "seeking_reassurance", "vulnerable"],
      legal: ["stressed", "cautious", "seeking_clarity", "apprehensive"],
      finance: ["cautious", "analytical", "seeking_security", "risk_aware"],
    };

    const baseEmotions = domainEmotions[domain] || [
      "neutral",
      "information_seeking",
    ];

    // Modify based on contextual factors
    if (contextualFactors.urgency === "high") {
      return baseEmotions.includes("anxious")
        ? "highly_anxious"
        : "urgent_and_focused";
    }

    if (contextualFactors.stakeholderPressure === "high") {
      return baseEmotions[0] + "_with_external_pressure";
    }

    return baseEmotions[0];
  }

  private identifyMotivations(
    domain: string,
    taskDescription: string,
  ): string[] {
    const domainMotivations: Record<string, string[]> = {
      customer_service: [
        "resolve_issue_quickly",
        "feel_heard_and_valued",
        "avoid_future_problems",
        "maintain_relationship",
      ],
      sales: [
        "make_best_decision",
        "minimize_risk",
        "demonstrate_competence",
        "achieve_business_goals",
      ],
      marketing: [
        "improve_performance",
        "stay_competitive",
        "demonstrate_innovation",
        "achieve_growth_targets",
      ],
      healthcare: [
        "ensure_safety",
        "understand_options",
        "reduce_anxiety",
        "make_informed_decisions",
      ],
    };

    const baseMotivations = domainMotivations[domain] || [
      "solve_problem_effectively",
      "gain_expertise",
      "improve_outcomes",
      "reduce_uncertainty",
    ];

    // Enhance based on task description analysis
    const urgentWords = ["urgent", "immediate", "asap", "quickly", "fast"];
    const hasUrgency = urgentWords.some((word) =>
      taskDescription.toLowerCase().includes(word),
    );

    if (hasUrgency) {
      baseMotivations.unshift("achieve_immediate_resolution");
    }

    return baseMotivations;
  }

  private assessCognitiveLoad(
    taskDescription: string,
    experienceLevel?: string,
  ): "low" | "medium" | "high" {
    let loadScore = 0;

    // Complexity indicators in task description
    const complexityWords = [
      "complex",
      "multiple",
      "various",
      "comprehensive",
      "detailed",
    ];
    loadScore += complexityWords.filter((word) =>
      taskDescription.toLowerCase().includes(word),
    ).length;

    // Technical terms increase cognitive load
    const technicalWords = [
      "implementation",
      "integration",
      "optimization",
      "configuration",
    ];
    loadScore += technicalWords.filter((word) =>
      taskDescription.toLowerCase().includes(word),
    ).length;

    // Experience level adjustment
    if (experienceLevel === "beginner") {
      loadScore += 2;
    } else if (experienceLevel === "expert") {
      loadScore = Math.max(0, loadScore - 1);
    }

    if (loadScore >= 4) return "high";
    if (loadScore >= 2) return "medium";
    return "low";
  }

  private analyzeDecisionMakingStyle(
    domain: string,
    contextualFactors: any,
  ): PsychologyInsights["userPsychology"]["decisionMakingStyle"] {
    const domainStyles: Record<
      string,
      PsychologyInsights["userPsychology"]["decisionMakingStyle"]
    > = {
      finance: "analytical",
      legal: "analytical",
      healthcare: "collaborative",
      customer_service: "directive",
      sales: "analytical",
      marketing: "collaborative",
    };

    let baseStyle = domainStyles[domain] || "analytical";

    // Modify based on contextual factors
    if (contextualFactors.urgency === "high") {
      baseStyle = "directive";
    } else if (contextualFactors.stakeholderPressure === "high") {
      baseStyle = "collaborative";
    }

    return baseStyle;
  }

  private identifyStressFactors(
    domain: string,
    contextualFactors: any,
  ): string[] {
    const domainStressors: Record<string, string[]> = {
      customer_service: [
        "time_pressure",
        "angry_customers",
        "complex_issues",
        "performance_metrics",
      ],
      sales: ["quota_pressure", "rejection", "competition", "decision_delays"],
      marketing: [
        "campaign_performance",
        "budget_constraints",
        "changing_trends",
        "attribution_challenges",
      ],
      healthcare: [
        "patient_safety",
        "regulatory_compliance",
        "resource_constraints",
        "life_impact",
      ],
      finance: [
        "regulatory_requirements",
        "market_volatility",
        "accuracy_demands",
        "audit_pressure",
      ],
    };

    const baseStressors = domainStressors[domain] || [
      "performance_pressure",
      "complexity",
      "time_constraints",
    ];

    // Add contextual stressors
    if (contextualFactors.urgency === "high") {
      baseStressors.push("urgent_timeline");
    }

    if (contextualFactors.stakeholderPressure === "high") {
      baseStressors.push("external_expectations");
    }

    return baseStressors;
  }

  private assessConfidenceLevels(
    domain: string,
    experienceLevel?: string,
  ): string {
    const baseLevels: Record<string, string> = {
      customer_service: "moderate_confidence_seeking_validation",
      sales: "confident_but_verification_seeking",
      marketing: "cautiously_confident_data_driven",
      healthcare: "highly_cautious_evidence_based",
      finance: "methodically_confident_risk_aware",
    };

    let baseLevel =
      baseLevels[domain] || "moderate_confidence_information_seeking";

    // Adjust for experience level
    if (experienceLevel === "beginner") {
      baseLevel = "low_confidence_guidance_seeking";
    } else if (experienceLevel === "expert") {
      baseLevel = "high_confidence_validation_seeking";
    }

    return baseLevel;
  }

  private async developCommunicationStrategy(
    request: PsychologyAnalysisRequest,
    userPsychology: PsychologyInsights["userPsychology"],
  ): Promise<PsychologyInsights["communicationStrategy"]> {
    const optimalTone = this.determineTone(
      userPsychology,
      request.targetDomain,
    );
    const languageStyle = this.selectLanguageStyle(
      userPsychology,
      request.contextualFactors?.experienceLevel,
    );
    const structuralApproach = this.selectStructuralApproach(userPsychology);
    const empathyLevel = this.determineEmpathyLevel(userPsychology);
    const urgencyHandling = this.developUrgencyHandling(
      userPsychology,
      request.contextualFactors?.urgency,
    );

    return {
      optimalTone,
      languageStyle,
      structuralApproach,
      empathyLevel,
      urgencyHandling,
    };
  }

  private determineTone(
    userPsychology: PsychologyInsights["userPsychology"],
    domain: string,
  ): PsychologyInsights["communicationStrategy"]["optimalTone"] {
    // High stress or anxiety = supportive tone
    if (
      userPsychology.stressFactors.length > 3 ||
      userPsychology.emotionalState.includes("anxious")
    ) {
      return "supportive";
    }

    // Expert level users often prefer direct, authoritative communication
    if (userPsychology.confidenceLevels.includes("high_confidence")) {
      return "authoritative";
    }

    // Collaborative decision makers prefer collaborative tone
    if (userPsychology.decisionMakingStyle === "collaborative") {
      return "collaborative";
    }

    // Default based on domain
    const domainTones: Record<
      string,
      PsychologyInsights["communicationStrategy"]["optimalTone"]
    > = {
      customer_service: "supportive",
      healthcare: "reassuring",
      sales: "collaborative",
      finance: "authoritative",
      legal: "authoritative",
    };

    return domainTones[domain] || "collaborative";
  }

  private selectLanguageStyle(
    userPsychology: PsychologyInsights["userPsychology"],
    experienceLevel?: string,
  ): PsychologyInsights["communicationStrategy"]["languageStyle"] {
    if (
      experienceLevel === "beginner" ||
      userPsychology.cognitiveLoad === "high"
    ) {
      return "simplified";
    }

    if (
      experienceLevel === "expert" &&
      userPsychology.decisionMakingStyle === "analytical"
    ) {
      return "technical";
    }

    if (
      userPsychology.emotionalState.includes("frustrated") ||
      userPsychology.emotionalState.includes("anxious")
    ) {
      return "conversational";
    }

    return "formal";
  }

  private selectStructuralApproach(
    userPsychology: PsychologyInsights["userPsychology"],
  ): PsychologyInsights["communicationStrategy"]["structuralApproach"] {
    if (
      userPsychology.cognitiveLoad === "high" ||
      userPsychology.decisionMakingStyle === "directive"
    ) {
      return "step-by-step";
    }

    if (userPsychology.decisionMakingStyle === "collaborative") {
      return "options-based";
    }

    if (userPsychology.decisionMakingStyle === "analytical") {
      return "analytical";
    }

    return "narrative";
  }

  private determineEmpathyLevel(
    userPsychology: PsychologyInsights["userPsychology"],
  ): PsychologyInsights["communicationStrategy"]["empathyLevel"] {
    const stressScore = userPsychology.stressFactors.length;
    const hasEmotionalDistress =
      userPsychology.emotionalState.includes("anxious") ||
      userPsychology.emotionalState.includes("frustrated");

    if (stressScore >= 3 || hasEmotionalDistress) {
      return "high";
    }

    if (stressScore >= 1 || userPsychology.cognitiveLoad === "high") {
      return "medium";
    }

    return "low";
  }

  private developUrgencyHandling(
    userPsychology: PsychologyInsights["userPsychology"],
    urgencyLevel?: string,
  ): string {
    if (
      urgencyLevel === "high" ||
      userPsychology.emotionalState.includes("urgent")
    ) {
      return "Acknowledge urgency immediately, provide immediate actionable steps, include timeframes";
    }

    if (
      urgencyLevel === "medium" ||
      userPsychology.stressFactors.includes("time_pressure")
    ) {
      return "Recognize time sensitivity, prioritize most critical information first";
    }

    return "Focus on thoroughness and completeness over speed";
  }

  private async analyzePersuasionFactors(
    request: PsychologyAnalysisRequest,
    userPsychology: PsychologyInsights["userPsychology"],
  ): Promise<PsychologyInsights["persuasionPsychology"]> {
    const keyInfluencers = this.identifyInfluencers(
      request.targetDomain,
      userPsychology,
    );
    const resistancePoints = this.identifyResistancePoints(
      userPsychology,
      request,
    );
    const motivationalFrames = this.developMotivationalFrames(
      userPsychology.primaryMotivations,
    );
    const trustBuilders = this.identifyTrustBuilders(
      request.targetDomain,
      userPsychology,
    );

    return {
      keyInfluencers,
      resistancePoints,
      motivationalFrames,
      trustBuilders,
    };
  }

  private identifyInfluencers(
    domain: string,
    userPsychology: PsychologyInsights["userPsychology"],
  ): string[] {
    const domainInfluencers: Record<string, string[]> = {
      customer_service: [
        "empathy",
        "quick_resolution",
        "competence_demonstration",
        "follow_up_commitment",
      ],
      sales: [
        "social_proof",
        "risk_reduction",
        "value_demonstration",
        "scarcity_urgency",
      ],
      marketing: [
        "data_evidence",
        "case_studies",
        "industry_benchmarks",
        "thought_leadership",
      ],
      healthcare: [
        "clinical_evidence",
        "safety_assurance",
        "expert_endorsement",
        "patient_testimonials",
      ],
      finance: [
        "regulatory_compliance",
        "risk_mitigation",
        "performance_data",
        "expert_analysis",
      ],
    };

    const baseInfluencers = domainInfluencers[domain] || [
      "expertise",
      "evidence",
      "credibility",
      "practical_value",
    ];

    // Personalize based on user psychology
    if (userPsychology.decisionMakingStyle === "analytical") {
      baseInfluencers.push("detailed_analysis", "comparative_data");
    }

    if (userPsychology.confidenceLevels.includes("low_confidence")) {
      baseInfluencers.push("step_by_step_guidance", "reassurance");
    }

    return baseInfluencers;
  }

  private identifyResistancePoints(
    userPsychology: PsychologyInsights["userPsychology"],
    request: PsychologyAnalysisRequest,
  ): string[] {
    const resistancePoints: string[] = [];

    if (userPsychology.cognitiveLoad === "high") {
      resistancePoints.push("information_overwhelm", "complexity_aversion");
    }

    if (userPsychology.emotionalState.includes("skeptical")) {
      resistancePoints.push("credibility_doubts", "verification_demands");
    }

    if (userPsychology.stressFactors.includes("time_pressure")) {
      resistancePoints.push("lengthy_explanations", "theoretical_content");
    }

    if (userPsychology.decisionMakingStyle === "collaborative") {
      resistancePoints.push("unilateral_recommendations", "lack_of_options");
    }

    // Add domain-specific resistance points
    const domainResistance: Record<string, string[]> = {
      sales: ["pushy_tactics", "hidden_costs", "commitment_pressure"],
      customer_service: [
        "scripted_responses",
        "deflection_attempts",
        "impersonal_service",
      ],
      marketing: [
        "generic_advice",
        "untested_strategies",
        "resource_intensive_solutions",
      ],
    };

    resistancePoints.push(...(domainResistance[request.targetDomain] || []));

    return resistancePoints;
  }

  private developMotivationalFrames(primaryMotivations: string[]): string[] {
    const frameMap: Record<string, string> = {
      resolve_issue_quickly: "Efficiency and speed benefits",
      feel_heard_and_valued: "Personal recognition and acknowledgment",
      avoid_future_problems: "Prevention and risk mitigation",
      make_best_decision: "Optimal outcome achievement",
      minimize_risk: "Security and safety assurance",
      demonstrate_competence: "Professional credibility enhancement",
      achieve_business_goals: "Success and performance improvement",
      improve_performance: "Growth and advancement opportunities",
      stay_competitive: "Market leadership and advantage",
    };

    return primaryMotivations.map(
      (motivation) => frameMap[motivation] || "Value and benefit realization",
    );
  }

  private identifyTrustBuilders(
    domain: string,
    userPsychology: PsychologyInsights["userPsychology"],
  ): string[] {
    const domainTrustBuilders: Record<string, string[]> = {
      customer_service: [
        "active_listening",
        "problem_ownership",
        "follow_through",
        "transparency",
      ],
      sales: [
        "honest_communication",
        "customer_references",
        "proven_track_record",
        "no_pressure_approach",
      ],
      marketing: [
        "data_transparency",
        "methodology_explanation",
        "realistic_expectations",
        "case_study_evidence",
      ],
      healthcare: [
        "credentials_display",
        "evidence_based_recommendations",
        "patient_safety_priority",
        "informed_consent",
      ],
      finance: [
        "regulatory_compliance",
        "risk_disclosure",
        "track_record",
        "third_party_validation",
      ],
    };

    const baseTrustBuilders = domainTrustBuilders[domain] || [
      "expertise_demonstration",
      "transparency",
      "reliability",
      "competence",
    ];

    // Add psychology-specific trust builders
    if (
      userPsychology.emotionalState.includes("anxious") ||
      userPsychology.emotionalState.includes("cautious")
    ) {
      baseTrustBuilders.push("reassurance_providing", "safety_emphasizing");
    }

    if (userPsychology.decisionMakingStyle === "analytical") {
      baseTrustBuilders.push("evidence_providing", "logical_reasoning");
    }

    return baseTrustBuilders;
  }

  private async analyzeCognitiveFactors(
    request: PsychologyAnalysisRequest,
    userPsychology: PsychologyInsights["userPsychology"],
  ): Promise<PsychologyInsights["cognitiveConsiderations"]> {
    const informationProcessing =
      this.analyzeInformationProcessing(userPsychology);
    const attentionSpan = this.assessAttentionSpan(
      userPsychology,
      request.contextualFactors,
    );
    const learningStyle = this.determineLearningStyle(
      request.targetDomain,
      userPsychology,
    );
    const memoryAids = this.identifyMemoryAids(userPsychology, learningStyle);

    return {
      informationProcessing,
      attentionSpan,
      learningStyle,
      memoryAids,
    };
  }

  private analyzeInformationProcessing(
    userPsychology: PsychologyInsights["userPsychology"],
  ): string {
    if (userPsychology.cognitiveLoad === "high") {
      return "Sequential processing preferred - present information in logical order with clear connections";
    }

    if (userPsychology.decisionMakingStyle === "analytical") {
      return "Detailed processing style - provide comprehensive information with supporting evidence";
    }

    if (
      userPsychology.emotionalState.includes("urgent") ||
      userPsychology.stressFactors.includes("time_pressure")
    ) {
      return "Rapid processing mode - prioritize key information and actionable insights";
    }

    return "Balanced processing - mixture of overview and detail as needed";
  }

  private assessAttentionSpan(
    userPsychology: PsychologyInsights["userPsychology"],
    contextualFactors?: any,
  ): PsychologyInsights["cognitiveConsiderations"]["attentionSpan"] {
    if (
      userPsychology.stressFactors.length > 3 ||
      userPsychology.cognitiveLoad === "high"
    ) {
      return "short";
    }

    if (contextualFactors?.urgency === "high") {
      return "short";
    }

    if (
      userPsychology.decisionMakingStyle === "analytical" &&
      userPsychology.emotionalState.includes("focused")
    ) {
      return "extended";
    }

    return "medium";
  }

  private determineLearningStyle(
    domain: string,
    userPsychology: PsychologyInsights["userPsychology"],
  ): PsychologyInsights["cognitiveConsiderations"]["learningStyle"] {
    const domainStyles: Record<
      string,
      PsychologyInsights["cognitiveConsiderations"]["learningStyle"]
    > = {
      customer_service: "auditory", // Conversation-based
      sales: "visual", // Presentations and demos
      marketing: "visual", // Charts and visual content
      healthcare: "reading", // Documentation-heavy
      finance: "reading", // Analysis and reports
    };

    let baseStyle = domainStyles[domain] || "reading";

    // Adjust based on user psychology
    if (userPsychology.decisionMakingStyle === "collaborative") {
      baseStyle = "auditory"; // Discussion-based
    }

    if (userPsychology.cognitiveLoad === "high") {
      baseStyle = "visual"; // Easier to process
    }

    return baseStyle;
  }

  private identifyMemoryAids(
    userPsychology: PsychologyInsights["userPsychology"],
    learningStyle: PsychologyInsights["cognitiveConsiderations"]["learningStyle"],
  ): string[] {
    const memoryAids: string[] = [];

    // Base aids for learning style
    switch (learningStyle) {
      case "visual":
        memoryAids.push(
          "diagrams",
          "flowcharts",
          "bullet_points",
          "visual_metaphors",
        );
        break;
      case "auditory":
        memoryAids.push(
          "verbal_repetition",
          "mnemonics",
          "rhythm_patterns",
          "discussion_points",
        );
        break;
      case "kinesthetic":
        memoryAids.push(
          "step_by_step_actions",
          "practice_examples",
          "hands_on_exercises",
        );
        break;
      case "reading":
        memoryAids.push(
          "written_summaries",
          "key_point_lists",
          "structured_outlines",
          "reference_materials",
        );
        break;
    }

    // Add cognitive load considerations
    if (userPsychology.cognitiveLoad === "high") {
      memoryAids.push(
        "chunking_strategies",
        "simple_frameworks",
        "repetition_emphasis",
      );
    }

    // Add stress-based aids
    if (userPsychology.stressFactors.length > 2) {
      memoryAids.push(
        "stress_reduction_cues",
        "confidence_boosters",
        "success_reminders",
      );
    }

    return memoryAids;
  }

  private async generateRecommendations(
    analysis: PsychologyInsights,
    _request: PsychologyAnalysisRequest,
  ): Promise<PsychologyRecommendations> {
    const qaDesignPrinciples = this.generateQADesignPrinciples(analysis);
    const communicationGuidelines =
      this.generateCommunicationGuidelines(analysis);
    const emotionalConsiderations =
      this.generateEmotionalConsiderations(analysis);
    const avoidanceStrategies = this.generateAvoidanceStrategies(analysis);
    const engagementTactics = this.generateEngagementTactics(analysis);
    const qualityIndicators = this.generateQualityIndicators(analysis);

    return {
      qaDesignPrinciples,
      communicationGuidelines,
      emotionalConsiderations,
      avoidanceStrategies,
      engagementTactics,
      qualityIndicators,
    };
  }

  private generateQADesignPrinciples(analysis: PsychologyInsights): string[] {
    const principles: string[] = [];

    // Based on attention span
    if (analysis.cognitiveConsiderations.attentionSpan === "short") {
      principles.push("Keep questions concise and focused on single issues");
      principles.push("Provide immediate value in opening sentences");
    } else if (analysis.cognitiveConsiderations.attentionSpan === "extended") {
      principles.push("Allow for comprehensive, detailed questions");
      principles.push("Include context and background information");
    }

    // Based on decision-making style
    if (analysis.userPsychology.decisionMakingStyle === "collaborative") {
      principles.push("Frame questions to invite multiple perspectives");
      principles.push("Include stakeholder consideration prompts");
    } else if (analysis.userPsychology.decisionMakingStyle === "directive") {
      principles.push(
        "Provide clear, actionable questions with definitive answers",
      );
      principles.push("Focus on implementation and execution aspects");
    }

    // Based on cognitive load
    if (analysis.userPsychology.cognitiveLoad === "high") {
      principles.push(
        "Break complex topics into smaller, manageable questions",
      );
      principles.push("Use familiar terminology and avoid jargon");
    }

    // Communication strategy integration
    if (analysis.communicationStrategy.structuralApproach === "step-by-step") {
      principles.push("Structure questions in logical, sequential order");
      principles.push("Include progressive complexity building");
    }

    return principles;
  }

  private generateCommunicationGuidelines(
    analysis: PsychologyInsights,
  ): string[] {
    const guidelines: string[] = [];

    // Tone guidelines
    guidelines.push(
      `Maintain ${analysis.communicationStrategy.optimalTone} tone throughout responses`,
    );
    guidelines.push(
      `Use ${analysis.communicationStrategy.languageStyle} language style`,
    );

    // Empathy level
    if (analysis.communicationStrategy.empathyLevel === "high") {
      guidelines.push(
        "Include empathetic acknowledgment of challenges and concerns",
      );
      guidelines.push(
        "Use validating language that recognizes emotional state",
      );
    }

    // Structure approach
    guidelines.push(
      `Organize responses using ${analysis.communicationStrategy.structuralApproach} structure`,
    );

    // Urgency handling
    if (analysis.userPsychology.emotionalState.includes("urgent")) {
      guidelines.push(analysis.communicationStrategy.urgencyHandling);
    }

    // Trust building
    guidelines.push("Include credibility markers and expertise demonstrations");
    guidelines.push("Provide transparent reasoning for recommendations");

    return guidelines;
  }

  private generateEmotionalConsiderations(
    analysis: PsychologyInsights,
  ): string[] {
    const considerations: string[] = [];

    // Emotional state handling
    const emotionalState = analysis.userPsychology.emotionalState;
    if (emotionalState.includes("anxious")) {
      considerations.push(
        "Provide reassurance and confidence-building elements",
      );
      considerations.push("Include safety and risk mitigation emphasis");
    }

    if (emotionalState.includes("frustrated")) {
      considerations.push("Acknowledge frustration and provide validation");
      considerations.push("Focus on solutions and positive outcomes");
    }

    if (emotionalState.includes("skeptical")) {
      considerations.push("Include evidence and proof points");
      considerations.push("Address potential doubts proactively");
    }

    // Stress factor mitigation
    for (const stressFactor of analysis.userPsychology.stressFactors) {
      if (stressFactor === "time_pressure") {
        considerations.push("Emphasize efficiency and time-saving benefits");
      } else if (stressFactor === "performance_pressure") {
        considerations.push(
          "Include success indicators and confidence boosters",
        );
      }
    }

    // Confidence level support
    if (analysis.userPsychology.confidenceLevels.includes("low_confidence")) {
      considerations.push(
        "Provide step-by-step guidance with confidence checkpoints",
      );
      considerations.push("Include encouragement and capability affirmation");
    }

    return considerations;
  }

  private generateAvoidanceStrategies(analysis: PsychologyInsights): string[] {
    const strategies: string[] = [];

    // Avoid resistance triggers
    for (const resistancePoint of analysis.persuasionPsychology
      .resistancePoints) {
      if (resistancePoint === "information_overwhelm") {
        strategies.push("Avoid dense, information-heavy responses");
        strategies.push("Limit to 3-5 key points per response");
      } else if (resistancePoint === "pushy_tactics") {
        strategies.push("Avoid pressure language and urgency manipulation");
        strategies.push("Present options rather than single solutions");
      } else if (resistancePoint === "credibility_doubts") {
        strategies.push("Avoid unsupported claims or generalizations");
        strategies.push(
          "Include evidence and reasoning for all recommendations",
        );
      }
    }

    // Communication style avoidances
    if (analysis.communicationStrategy.empathyLevel === "high") {
      strategies.push("Avoid dismissive or minimizing language");
      strategies.push(
        "Avoid purely technical responses without emotional consideration",
      );
    }

    // Cognitive load considerations
    if (analysis.userPsychology.cognitiveLoad === "high") {
      strategies.push("Avoid complex multi-part questions");
      strategies.push("Avoid technical jargon without explanation");
    }

    return strategies;
  }

  private generateEngagementTactics(analysis: PsychologyInsights): string[] {
    const tactics: string[] = [];

    // Leverage key influencers
    for (const influencer of analysis.persuasionPsychology.keyInfluencers) {
      if (influencer === "social_proof") {
        tactics.push("Include relevant examples and case studies");
        tactics.push("Reference industry best practices and peer success");
      } else if (influencer === "expertise") {
        tactics.push("Demonstrate deep domain knowledge");
        tactics.push("Share professional insights and advanced techniques");
      } else if (influencer === "empathy") {
        tactics.push("Acknowledge challenges and show understanding");
        tactics.push("Validate concerns and emotional responses");
      }
    }

    // Motivational frames
    for (const frame of analysis.persuasionPsychology.motivationalFrames) {
      if (frame.includes("efficiency")) {
        tactics.push("Emphasize time-saving and streamlined approaches");
      } else if (frame.includes("success")) {
        tactics.push("Highlight achievement and goal accomplishment");
      } else if (frame.includes("security")) {
        tactics.push("Focus on risk mitigation and safety assurance");
      }
    }

    // Learning style engagement
    const learningStyle = analysis.cognitiveConsiderations.learningStyle;
    if (learningStyle === "visual") {
      tactics.push("Use visual metaphors and descriptive language");
      tactics.push("Structure information with clear visual organization");
    } else if (learningStyle === "auditory") {
      tactics.push("Use conversational tone and rhythm");
      tactics.push("Include dialogue examples and verbal cues");
    }

    return tactics;
  }

  private generateQualityIndicators(analysis: PsychologyInsights): string[] {
    const indicators: string[] = [];

    // Psychological alignment indicators
    indicators.push(
      `Response tone matches ${analysis.communicationStrategy.optimalTone} preference`,
    );
    indicators.push(
      `Language complexity appropriate for ${analysis.userPsychology.cognitiveLoad} cognitive load`,
    );
    indicators.push(
      `Structure follows ${analysis.communicationStrategy.structuralApproach} organization`,
    );

    // Emotional resonance indicators
    if (analysis.communicationStrategy.empathyLevel === "high") {
      indicators.push(
        "Includes empathetic acknowledgment and emotional validation",
      );
    }

    // Engagement indicators
    indicators.push("Leverages identified key influencers and trust builders");
    indicators.push("Avoids psychological resistance triggers");
    indicators.push("Incorporates appropriate motivational frames");

    // Cognitive compatibility indicators
    indicators.push(
      `Matches ${analysis.cognitiveConsiderations.learningStyle} learning style preferences`,
    );
    indicators.push("Includes relevant memory aids and retention supports");
    indicators.push(
      `Respects ${analysis.cognitiveConsiderations.attentionSpan} attention span limitations`,
    );

    return indicators;
  }

  private async createImplementationGuidance(
    analysis: PsychologyInsights,
    _request: PsychologyAnalysisRequest,
  ) {
    const questionFormulation =
      this.generateQuestionFormulationGuidance(analysis);
    const answerToneGuidance = this.generateAnswerToneGuidance(analysis);
    const empathyIntegration = this.generateEmpathyIntegration(analysis);
    const motivationalElements = this.generateMotivationalElements(analysis);

    return {
      questionFormulation,
      answerToneGuidance,
      empathyIntegration,
      motivationalElements,
    };
  }

  private generateQuestionFormulationGuidance(
    analysis: PsychologyInsights,
  ): string[] {
    const guidance: string[] = [];

    if (analysis.userPsychology.cognitiveLoad === "high") {
      guidance.push("Frame questions with clear, simple language");
      guidance.push("Focus on single, specific issues per question");
    }

    if (analysis.userPsychology.decisionMakingStyle === "collaborative") {
      guidance.push("Include stakeholder and team consideration elements");
      guidance.push(
        "Frame as collaborative exploration rather than individual challenge",
      );
    }

    if (analysis.userPsychology.emotionalState.includes("anxious")) {
      guidance.push("Avoid threatening or high-pressure question framing");
      guidance.push("Include reassuring context that normalizes the challenge");
    }

    guidance.push("Questions should reflect realistic professional scenarios");
    guidance.push("Include enough context for meaningful, specific answers");

    return guidance;
  }

  private generateAnswerToneGuidance(analysis: PsychologyInsights): string[] {
    const guidance: string[] = [];

    const tone = analysis.communicationStrategy.optimalTone;
    switch (tone) {
      case "supportive":
        guidance.push("Use encouraging, confidence-building language");
        guidance.push("Include reassurance and validation elements");
        guidance.push("Acknowledge challenges while focusing on solutions");
        break;
      case "authoritative":
        guidance.push("Present information with confidence and expertise");
        guidance.push("Use definitive language and clear recommendations");
        guidance.push("Include credibility markers and expert insights");
        break;
      case "collaborative":
        guidance.push("Use inclusive language that invites participation");
        guidance.push("Present options and alternatives for consideration");
        guidance.push(
          "Acknowledge multiple perspectives and stakeholder needs",
        );
        break;
      case "reassuring":
        guidance.push("Provide calm, steady guidance");
        guidance.push("Include safety and security emphasis");
        guidance.push(
          "Use language that reduces anxiety and builds confidence",
        );
        break;
      case "direct":
        guidance.push("Be clear, concise, and action-oriented");
        guidance.push("Focus on immediate, practical steps");
        guidance.push("Avoid unnecessary elaboration or complexity");
        break;
    }

    return guidance;
  }

  private generateEmpathyIntegration(analysis: PsychologyInsights): string[] {
    const integration: string[] = [];

    if (analysis.communicationStrategy.empathyLevel === "high") {
      integration.push(
        "Begin responses with acknowledgment of challenges or concerns",
      );
      integration.push("Use validating language that shows understanding");
      integration.push(
        "Include emotional support alongside practical guidance",
      );
      integration.push("Acknowledge the human impact of decisions and actions");
    } else if (analysis.communicationStrategy.empathyLevel === "medium") {
      integration.push(
        "Include brief acknowledgment of situational challenges",
      );
      integration.push("Show awareness of practical constraints and pressures");
    } else {
      integration.push(
        "Focus primarily on practical solutions with minimal emotional content",
      );
      integration.push("Maintain professional distance while being respectful");
    }

    return integration;
  }

  private generateMotivationalElements(analysis: PsychologyInsights): string[] {
    const elements: string[] = [];

    // Primary motivations integration
    for (const motivation of analysis.userPsychology.primaryMotivations) {
      if (motivation === "resolve_issue_quickly") {
        elements.push("Emphasize speed and efficiency benefits");
        elements.push("Highlight immediate actionability of recommendations");
      } else if (motivation === "demonstrate_competence") {
        elements.push("Include opportunities to showcase expertise");
        elements.push(
          "Frame solutions as professionally sophisticated approaches",
        );
      } else if (motivation === "minimize_risk") {
        elements.push("Highlight safety and security aspects");
        elements.push("Include risk mitigation and prevention strategies");
      } else if (motivation === "achieve_business_goals") {
        elements.push(
          "Connect solutions to business outcomes and success metrics",
        );
        elements.push("Include performance and achievement indicators");
      }
    }

    // Trust builder integration
    elements.push("Include credibility markers and expertise demonstrations");
    elements.push("Provide transparent reasoning and evidence");
    elements.push("Show alignment with user goals and values");

    return elements;
  }

  private async identifyRiskFactors(
    analysis: PsychologyInsights,
    request: PsychologyAnalysisRequest,
  ) {
    const riskFactors = [];

    // High cognitive load risks
    if (analysis.userPsychology.cognitiveLoad === "high") {
      riskFactors.push({
        factor: "Information overwhelm leading to decision paralysis",
        impact: "high" as const,
        mitigation:
          "Limit information density, use progressive disclosure, provide clear next steps",
      });
    }

    // Emotional state risks
    if (analysis.userPsychology.emotionalState.includes("anxious")) {
      riskFactors.push({
        factor: "Anxiety amplification through pressure or complexity",
        impact: "high" as const,
        mitigation:
          "Use calming language, provide reassurance, break down complex tasks",
      });
    }

    // Resistance point risks
    if (
      analysis.persuasionPsychology.resistancePoints.includes(
        "credibility_doubts",
      )
    ) {
      riskFactors.push({
        factor: "Rejection of recommendations due to trust deficits",
        impact: "medium" as const,
        mitigation:
          "Include evidence, provide transparent reasoning, demonstrate expertise",
      });
    }

    // Communication mismatch risks
    if (
      analysis.communicationStrategy.empathyLevel === "high" &&
      request.contextualFactors?.urgency === "high"
    ) {
      riskFactors.push({
        factor: "Conflict between empathy needs and urgency demands",
        impact: "medium" as const,
        mitigation:
          "Balance empathetic acknowledgment with rapid solution provision",
      });
    }

    // Attention span risks
    if (analysis.cognitiveConsiderations.attentionSpan === "short") {
      riskFactors.push({
        factor: "Loss of engagement due to lengthy or complex responses",
        impact: "medium" as const,
        mitigation:
          "Front-load key information, use bullet points, provide summaries",
      });
    }

    return riskFactors;
  }
}
