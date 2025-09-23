import { BaseAgent } from "../core/baseAgent.js";
export class CognitiveScientist extends BaseAgent {
    constructor(logger) {
        super("cognitive-scientist", "expert_thinking_modeling", [
            "cognitive-modeling",
            "expertise-transfer",
            "learning-design",
            "knowledge-elicitation",
        ], logger);
    }
    async handle(content, context) {
        await this.validateInput(content);
        const request = this.parseRequest(content);
        await this.logger.trace({
            level: "debug",
            agentId: this.id,
            action: "cognitive_analysis_started",
            data: {
                expertDomain: request.expertDomain,
                expertiseLevel: request.expertiseLevel,
                cognitiveComplexity: request.cognitiveComplexity,
            },
        });
        const expertThinkingModel = await this.modelExpertThinking(request, context);
        const expertiseTransferFramework = await this.designExpertiseTransfer(request, expertThinkingModel);
        const qaDesignPsychology = await this.developQADesignPsychology(request, expertThinkingModel);
        const implementationGuidance = await this.createImplementationGuidance(request, expertThinkingModel);
        const validationMethods = await this.establishValidationMethods(request, expertThinkingModel);
        return {
            expertThinkingModel,
            expertiseTransferFramework,
            qaDesignPsychology,
            implementationGuidance,
            validationMethods,
        };
    }
    parseRequest(content) {
        if (typeof content === "object" && content !== null) {
            const input = content;
            return {
                expertDomain: input.expertDomain || input.domain || "general",
                expertiseLevel: input.expertiseLevel || "professional",
                taskType: input.taskType || input.description || "general_problem_solving",
                cognitiveComplexity: input.cognitiveComplexity || input.complexityLevel || 5,
                expertMaterials: input.expertMaterials || {},
                learningObjectives: input.learningObjectives || [],
            };
        }
        throw new Error("Invalid cognitive analysis request format");
    }
    async modelExpertThinking(request, _context) {
        const cognitiveArchitecture = await this.buildCognitiveArchitecture(request);
        const knowledgeStructure = await this.mapKnowledgeStructure(request);
        const cognitiveProcesses = await this.analyzeCognitiveProcesses(request);
        return {
            cognitiveArchitecture,
            knowledgeStructure,
            cognitiveProcesses,
        };
    }
    async buildCognitiveArchitecture(request) {
        const mentalModels = this.identifyMentalModels(request);
        const reasoningPatterns = this.analyzeReasoningPatterns(request);
        const decisionHeuristics = this.catalogDecisionHeuristics(request);
        return {
            mentalModels,
            reasoningPatterns,
            decisionHeuristics,
        };
    }
    identifyMentalModels(request) {
        const models = [];
        // Domain-specific mental models
        const domainModels = {
            customer_service: {
                name: "Customer Journey Mental Model",
                description: "Cognitive representation of customer experience lifecycle",
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
                description: "Cognitive representation of market forces and customer behavior",
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
        if (request.expertiseLevel === "expert" ||
            request.expertiseLevel === "specialist") {
            models.push({
                name: "Strategic Systems Model",
                description: "High-level understanding of system interactions and long-term dynamics",
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
    analyzeReasoningPatterns(request) {
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
        }
        else if (request.expertDomain === "sales") {
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
        if (request.expertiseLevel === "expert" ||
            request.expertiseLevel === "specialist") {
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
    catalogDecisionHeuristics(request) {
        const heuristics = [];
        // Universal professional heuristics
        heuristics.push({
            heuristic: "Stakeholder Impact Assessment",
            applicableContexts: [
                "strategic decisions",
                "process changes",
                "resource allocation",
            ],
            reliability: "high",
            biasRisks: ["stakeholder favoritism", "political considerations"],
        });
        heuristics.push({
            heuristic: "Risk-Benefit Analysis",
            applicableContexts: [
                "investment decisions",
                "change initiatives",
                "solution selection",
            ],
            reliability: "high",
            biasRisks: ["optimism bias", "loss aversion", "probability neglect"],
        });
        heuristics.push({
            heuristic: "Past Success Replication",
            applicableContexts: [
                "similar situations",
                "proven approaches",
                "low-risk decisions",
            ],
            reliability: "medium",
            biasRisks: [
                "availability bias",
                "confirmation bias",
                "representativeness bias",
            ],
        });
        // Domain-specific heuristics
        const domainHeuristics = {
            customer_service: [
                {
                    heuristic: "Customer Effort Minimization",
                    applicableContexts: [
                        "process design",
                        "service delivery",
                        "problem resolution",
                    ],
                    reliability: "high",
                    biasRisks: ["oversimplification", "capability underestimation"],
                },
                {
                    heuristic: "Emotional State Prioritization",
                    applicableContexts: [
                        "upset customers",
                        "service recovery",
                        "escalation handling",
                    ],
                    reliability: "high",
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
                    reliability: "high",
                    biasRisks: ["value overestimation", "cost minimization"],
                },
                {
                    heuristic: "Decision Maker Focus",
                    applicableContexts: [
                        "complex sales",
                        "organizational selling",
                        "proposal development",
                    ],
                    reliability: "medium",
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
                reliability: "medium",
                biasRisks: [
                    "analysis paralysis",
                    "complexity bias",
                    "system justification",
                ],
            });
        }
        return heuristics;
    }
    async mapKnowledgeStructure(request) {
        const coreKnowledge = this.categorizeCoreKnowledge(request);
        const knowledgeOrganization = this.analyzeKnowledgeOrganization(request);
        const tacitKnowledge = this.identifyTacitKnowledge(request);
        return {
            coreKnowledge,
            knowledgeOrganization,
            tacitKnowledge,
        };
    }
    categorizeCoreKnowledge(request) {
        const knowledge = {
            factual: [],
            procedural: [],
            conditional: [],
            metacognitive: [],
        };
        // Domain-specific factual knowledge
        const domainFacts = {
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
        const domainProcedures = {
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
        // Metacognitive knowledge (awareness of one's knowledge and thinking)
        knowledge.metacognitive = [
            "awareness of expertise strengths and limitations",
            "recognition of when additional expertise needed",
            "understanding of decision-making biases and blind spots",
            "knowledge of effective learning and improvement strategies",
            "awareness of expertise development stages and requirements",
        ];
        return knowledge;
    }
    analyzeKnowledgeOrganization(_request) {
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
    identifyTacitKnowledge(_request) {
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
    async analyzeCognitiveProcesses(request) {
        const problemIdentification = this.modelProblemIdentification(request);
        const solutionGeneration = this.modelSolutionGeneration(request);
        const evaluation = this.modelEvaluation(request);
        return {
            problemIdentification,
            solutionGeneration,
            evaluation,
        };
    }
    modelProblemIdentification(_request) {
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
    modelSolutionGeneration(_request) {
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
    modelEvaluation(_request) {
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
    async designExpertiseTransfer(request, expertModel) {
        const knowledgeExternalization = this.designKnowledgeExternalization(request, expertModel);
        const learningDesign = this.createLearningDesign(request, expertModel);
        const adaptiveInstruction = this.developAdaptiveInstruction(request, expertModel);
        return {
            knowledgeExternalization,
            learningDesign,
            adaptiveInstruction,
        };
    }
    designKnowledgeExternalization(_request, _expertModel) {
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
    createLearningDesign(_request, _expertModel) {
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
    developAdaptiveInstruction(_request, _expertModel) {
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
    async developQADesignPsychology(request, expertModel) {
        const questionFormulation = this.designQuestionFormulation(request, expertModel);
        const answerStructuring = this.designAnswerStructuring(request, expertModel);
        return {
            questionFormulation,
            answerStructuring,
        };
    }
    designQuestionFormulation(_request, _expertModel) {
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
    designAnswerStructuring(_request, _expertModel) {
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
    async createImplementationGuidance(_request, _expertModel) {
        return {
            thinkingProcessIntegration: [
                "embed expert reasoning patterns in answer structures",
                "include decision-making heuristics in guidance",
                "reflect mental model organization in information presentation",
                "incorporate metacognitive elements in explanations",
            ],
            expertiseReplication: [
                "translate tacit knowledge into explicit guidance",
                "structure information according to expert knowledge organization",
                "include contextual factors that experts naturally consider",
                "provide access to expert decision-making criteria",
            ],
            cognitiveAuthenticity: [
                "ensure answers reflect genuine expert thinking processes",
                "maintain consistency with expert mental models",
                "preserve the complexity and nuance of expert judgment",
                "avoid oversimplification of expert decision-making",
            ],
            learningEffectiveness: [
                "optimize cognitive load for efficient learning",
                "facilitate pattern recognition and schema development",
                "support transfer to novel situations",
                "promote metacognitive awareness and self-regulation",
            ],
        };
    }
    async establishValidationMethods(_request, _expertModel) {
        return {
            expertiseAccuracy: [
                "expert review and validation of cognitive models",
                "comparison with established expertise research",
                "verification through think-aloud protocols",
                "validation against expert performance benchmarks",
            ],
            cognitiveValidity: [
                "assessment of psychological plausibility",
                "evaluation of cognitive load appropriateness",
                "testing of reasoning pattern authenticity",
                "validation of knowledge structure organization",
            ],
            learningOutcomes: [
                "measurement of knowledge acquisition and retention",
                "assessment of skill development and application",
                "evaluation of transfer to new situations",
                "testing of problem-solving improvement",
            ],
            transferEffectiveness: [
                "evaluation of performance in realistic scenarios",
                "assessment of adaptation to novel contexts",
                "measurement of long-term retention and application",
                "comparison with traditional instructional methods",
            ],
        };
    }
    async assessConfidence(result) {
        if (typeof result === "object" && result !== null) {
            const output = result;
            // Higher confidence for well-modeled thinking patterns
            const reasoningPatternsCount = output.expertThinkingModel.cognitiveArchitecture.reasoningPatterns
                .length;
            const mentalModelsCount = output.expertThinkingModel.cognitiveArchitecture.mentalModels.length;
            const validationMethodsCount = output.validationMethods.expertiseAccuracy.length;
            const modelComplexity = (reasoningPatternsCount + mentalModelsCount) / 10; // Normalize
            const validationRobustness = validationMethodsCount / 5; // Normalize
            const baseConfidence = 0.75;
            const complexityBonus = Math.min(modelComplexity * 0.1, 0.1);
            const validationBonus = Math.min(validationRobustness * 0.05, 0.05);
            return Math.min(baseConfidence + complexityBonus + validationBonus, 0.95);
        }
        return 0.7;
    }
    async explainReasoning(input, output, context) {
        if (typeof output === "object" && output !== null) {
            const result = output;
            const mentalModels = result.expertThinkingModel.cognitiveArchitecture.mentalModels.length;
            const reasoningPatterns = result.expertThinkingModel.cognitiveArchitecture.reasoningPatterns
                .length;
            const heuristics = result.expertThinkingModel.cognitiveArchitecture.decisionHeuristics
                .length;
            const validationMethods = Object.values(result.validationMethods).reduce((sum, methods) => sum + methods.length, 0);
            return `Cognitive Scientist modeled expert thinking with ${mentalModels} mental models, ${reasoningPatterns} reasoning patterns, and ${heuristics} decision heuristics. Designed expertise transfer framework with cognitive load optimization and learning effectiveness strategies. Provided ${validationMethods} validation methods to ensure cognitive authenticity and learning outcomes.`;
        }
        return super.explainReasoning(input, output, context);
    }
}
//# sourceMappingURL=cognitiveScientist.js.map