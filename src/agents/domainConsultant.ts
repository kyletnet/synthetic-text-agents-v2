import { BaseAgent } from '../core/baseAgent.js';
import { AgentContext } from '../shared/types.js';
import { Logger } from '../shared/logger.js';

export interface DomainConsultationRequest {
  domain: string;
  specialization?: string;
  expertiseLevel: 'professional' | 'expert' | 'specialist';
  contextualFactors: {
    industrySize?: 'startup' | 'mid-market' | 'enterprise';
    regulatoryEnvironment?: 'light' | 'moderate' | 'strict';
    marketMaturity?: 'emerging' | 'growing' | 'mature';
    competitiveIntensity?: 'low' | 'medium' | 'high';
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
    likelihood: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high';
    mitigation: string;
  }>;
}

export class DomainConsultant extends BaseAgent {
  private domainKnowledgeBase: Map<string, any>;

  constructor(logger: Logger) {
    super(
      'domain-consultant',
      'domain_expertise_professional_knowledge',
      ['domain-expertise', 'industry-knowledge', 'best-practices', 'professional-standards'],
      logger
    );
    
    this.domainKnowledgeBase = this.initializeDomainKnowledgeBase();
  }

  protected async handle(content: unknown, context?: AgentContext): Promise<DomainConsultantOutput> {
    await this.validateInput(content);
    
    const request = this.parseRequest(content);
    
    await this.logger.trace({
      level: 'debug',
      agentId: this.id,
      action: 'domain_consultation_started',
      data: {
        domain: request.domain,
        expertiseLevel: request.expertiseLevel,
        specialization: request.specialization,
      },
    });

    const domainExpertise = await this.assembleDomainExpertise(request, context);
    const processFrameworks = await this.developProcessFrameworks(request, domainExpertise);
    const qaGuidance = await this.createQAGuidance(request, domainExpertise);
    const implementationRecommendations = await this.generateImplementationRecommendations(request, domainExpertise);
    const riskAssessment = await this.conductRiskAssessment(request, domainExpertise);

    return {
      domainExpertise,
      processFrameworks,
      qaGuidance,
      implementationRecommendations,
      riskAssessment,
    };
  }

  private parseRequest(content: unknown): DomainConsultationRequest {
    if (typeof content === 'object' && content !== null) {
      const input = content as any;
      
      return {
        domain: input.domain || 'general',
        specialization: input.specialization,
        expertiseLevel: input.expertiseLevel || 'professional',
        contextualFactors: input.contextualFactors || {},
        taskScope: input.taskScope || input.description || '',
        qualityTarget: input.qualityTarget || 8,
      };
    }
    
    throw new Error('Invalid domain consultation request format');
  }

  private initializeDomainKnowledgeBase(): Map<string, any> {
    const knowledgeBase = new Map();
    
    knowledgeBase.set('customer_service', {
      marketDynamics: ['digital transformation', 'omnichannel expectations', 'self-service trends', 'AI integration'],
      keyStakeholders: ['customers', 'support agents', 'management', 'IT teams', 'product teams'],
      businessModels: ['B2C support', 'B2B account management', 'SaaS customer success', 'retail service'],
      bestPractices: ['first call resolution', 'empathy training', 'knowledge management', 'escalation procedures'],
      commonScenarios: ['billing inquiries', 'technical support', 'product complaints', 'service requests'],
      tools: ['CRM systems', 'ticketing platforms', 'knowledge bases', 'chat systems', 'phone systems'],
      metrics: ['CSAT', 'NPS', 'resolution time', 'first call resolution', 'agent productivity'],
    });

    knowledgeBase.set('sales', {
      marketDynamics: ['digital buying behavior', 'longer sales cycles', 'committee-based decisions', 'value-based selling'],
      keyStakeholders: ['prospects', 'customers', 'sales teams', 'marketing', 'customer success'],
      businessModels: ['B2B enterprise', 'B2B SMB', 'B2C retail', 'channel partnerships', 'inside sales'],
      bestPractices: ['consultative selling', 'needs analysis', 'value proposition', 'objection handling'],
      commonScenarios: ['lead qualification', 'product demos', 'proposal development', 'contract negotiation'],
      tools: ['CRM platforms', 'sales enablement', 'proposal tools', 'forecasting software'],
      metrics: ['conversion rates', 'pipeline velocity', 'deal size', 'quota attainment', 'customer lifetime value'],
    });

    knowledgeBase.set('marketing', {
      marketDynamics: ['data-driven decisions', 'personalization', 'multi-channel attribution', 'privacy regulations'],
      keyStakeholders: ['target audiences', 'customers', 'sales teams', 'creative teams', 'analysts'],
      businessModels: ['B2B lead generation', 'B2C brand marketing', 'e-commerce', 'SaaS growth'],
      bestPractices: ['audience segmentation', 'content marketing', 'marketing automation', 'performance measurement'],
      commonScenarios: ['campaign planning', 'lead nurturing', 'brand positioning', 'market research'],
      tools: ['marketing automation', 'analytics platforms', 'social media tools', 'content management'],
      metrics: ['CAC', 'ROAS', 'conversion rates', 'engagement rates', 'brand awareness'],
    });

    knowledgeBase.set('healthcare', {
      marketDynamics: ['regulatory compliance', 'patient safety', 'cost pressures', 'technology adoption'],
      keyStakeholders: ['patients', 'providers', 'administrators', 'regulators', 'payers'],
      businessModels: ['fee-for-service', 'value-based care', 'subscription health', 'digital health'],
      bestPractices: ['evidence-based medicine', 'patient-centered care', 'quality improvement', 'safety protocols'],
      commonScenarios: ['diagnosis decisions', 'treatment planning', 'patient communication', 'care coordination'],
      tools: ['EHR systems', 'clinical decision support', 'telemedicine platforms', 'quality dashboards'],
      metrics: ['patient outcomes', 'safety indicators', 'satisfaction scores', 'cost efficiency'],
    });

    knowledgeBase.set('finance', {
      marketDynamics: ['regulatory change', 'fintech disruption', 'data analytics', 'risk management'],
      keyStakeholders: ['clients', 'regulators', 'investors', 'risk committees', 'audit teams'],
      businessModels: ['traditional banking', 'investment management', 'fintech services', 'insurance'],
      bestPractices: ['risk assessment', 'compliance procedures', 'financial analysis', 'client advisory'],
      commonScenarios: ['investment decisions', 'risk evaluation', 'compliance reporting', 'client consultation'],
      tools: ['risk systems', 'portfolio management', 'trading platforms', 'regulatory reporting'],
      metrics: ['ROI', 'risk-adjusted returns', 'compliance metrics', 'client satisfaction'],
    });

    return knowledgeBase;
  }

  public async assembleDomainExpertise(
    request: DomainConsultationRequest,
    _context?: AgentContext
  ): Promise<DomainExpertise> {
    const USE_LLM = String(process.env.FEATURE_LLM_DOMAIN_CONSULTANT||'false').toLowerCase()==='true';
    
    if(USE_LLM){
      const { consultDomainLLM } = require('./domainConsultant.llm.js');
      return await consultDomainLLM({ 
        documentText: (request as any).documentText||'', 
        domain: request.domain||'', 
        personas: (request as any).personas||[] 
      });
    }
    
    // Original template-based implementation
    const domainData = this.domainKnowledgeBase.get(request.domain) || this.getGenericDomainData();
    
    const industryContext = await this.buildIndustryContext(request, domainData);
    const professionalStandards = await this.compileProfessionalStandards(request, domainData);
    const practicalKnowledge = await this.gatherPracticalKnowledge(request, domainData);
    const expertInsights = await this.deriveExpertInsights(request, domainData);

    return {
      industryContext,
      professionalStandards,
      practicalKnowledge,
      expertInsights,
    };
  }

  private getGenericDomainData() {
    return {
      marketDynamics: ['digital transformation', 'competitive pressure', 'regulatory change', 'customer expectations'],
      keyStakeholders: ['customers', 'employees', 'management', 'partners', 'regulators'],
      businessModels: ['traditional service', 'digital platform', 'subscription model', 'consulting services'],
      bestPractices: ['strategic planning', 'process improvement', 'quality management', 'stakeholder engagement'],
      commonScenarios: ['strategic decisions', 'operational challenges', 'customer issues', 'team management'],
      tools: ['management systems', 'analytics platforms', 'communication tools', 'project management'],
      metrics: ['performance indicators', 'customer satisfaction', 'operational efficiency', 'financial results'],
    };
  }

  private async buildIndustryContext(request: DomainConsultationRequest, domainData: any) {
    const marketDynamics = [...domainData.marketDynamics];
    const keyStakeholders = [...domainData.keyStakeholders];
    const valueChain = this.constructValueChain(request.domain);
    const businessModels = [...domainData.businessModels];
    const competitiveLandscape = this.analyzeCompetitiveLandscape(request);

    // Enhance based on contextual factors
    if (request.contextualFactors.marketMaturity === 'emerging') {
      marketDynamics.push('rapid change', 'technology adoption', 'market education');
    } else if (request.contextualFactors.marketMaturity === 'mature') {
      marketDynamics.push('consolidation', 'efficiency focus', 'differentiation challenges');
    }

    if (request.contextualFactors.regulatoryEnvironment === 'strict') {
      keyStakeholders.push('compliance officers', 'regulatory bodies', 'audit teams');
    }

    return {
      marketDynamics,
      keyStakeholders,
      valueChain,
      businessModels,
      competitiveLandscape,
    };
  }

  private constructValueChain(domain: string): string[] {
    const valueChains: Record<string, string[]> = {
      'customer_service': [
        'customer inquiry',
        'initial response',
        'issue analysis',
        'solution development',
        'resolution implementation',
        'follow-up and validation'
      ],
      'sales': [
        'lead generation',
        'qualification',
        'needs analysis',
        'solution design',
        'proposal development',
        'negotiation and closing',
        'onboarding and success'
      ],
      'marketing': [
        'market research',
        'strategy development',
        'content creation',
        'campaign execution',
        'performance measurement',
        'optimization and iteration'
      ],
      'healthcare': [
        'patient assessment',
        'diagnosis',
        'treatment planning',
        'care delivery',
        'monitoring and follow-up',
        'outcome evaluation'
      ],
      'finance': [
        'client consultation',
        'risk assessment',
        'strategy development',
        'implementation',
        'monitoring and reporting',
        'review and adjustment'
      ]
    };

    return valueChains[domain] || [
      'planning and analysis',
      'solution design',
      'implementation',
      'execution and delivery',
      'monitoring and evaluation',
      'continuous improvement'
    ];
  }

  private analyzeCompetitiveLandscape(request: DomainConsultationRequest): string[] {
    const landscape: string[] = [];

    if (request.contextualFactors.competitiveIntensity === 'high') {
      landscape.push('intense price competition', 'rapid feature development', 'customer acquisition battles');
    } else if (request.contextualFactors.competitiveIntensity === 'low') {
      landscape.push('established players', 'relationship-based competition', 'service differentiation');
    }

    if (request.contextualFactors.industrySize === 'startup') {
      landscape.push('agile competitors', 'innovative disruption', 'resource constraints');
    } else if (request.contextualFactors.industrySize === 'enterprise') {
      landscape.push('established processes', 'complex decision-making', 'compliance requirements');
    }

    return landscape.length > 0 ? landscape : ['moderate competition', 'established practices', 'gradual evolution'];
  }

  private async compileProfessionalStandards(request: DomainConsultationRequest, domainData: any) {
    const bestPractices = [...domainData.bestPractices];
    const industryStandards = this.identifyIndustryStandards(request.domain);
    const regulatoryRequirements = this.gatherRegulatoryRequirements(request);
    const ethicalGuidelines = this.establishEthicalGuidelines(request.domain);
    const qualityBenchmarks = this.defineQualityBenchmarks(request);

    // Enhance based on expertise level
    if (request.expertiseLevel === 'expert' || request.expertiseLevel === 'specialist') {
      bestPractices.push('advanced methodologies', 'thought leadership', 'innovation practices');
      qualityBenchmarks.push('industry-leading performance', 'breakthrough results', 'expert recognition');
    }

    return {
      bestPractices,
      industryStandards,
      regulatoryRequirements,
      ethicalGuidelines,
      qualityBenchmarks,
    };
  }

  private identifyIndustryStandards(domain: string): string[] {
    const standards: Record<string, string[]> = {
      'customer_service': ['ISO 9001 quality management', 'COPC customer operations standards', 'HDI support center standards'],
      'sales': ['Sales methodology frameworks', 'CRM best practices', 'Sales enablement standards'],
      'marketing': ['Marketing automation standards', 'Data privacy compliance', 'Brand management guidelines'],
      'healthcare': ['HIPAA compliance', 'Joint Commission standards', 'Clinical practice guidelines'],
      'finance': ['Basel III compliance', 'GDPR data protection', 'Fiduciary duty standards'],
    };

    return standards[domain] || ['ISO standards', 'Industry best practices', 'Professional certifications'];
  }

  private gatherRegulatoryRequirements(request: DomainConsultationRequest): string[] {
    const requirements: string[] = [];

    if (request.contextualFactors.regulatoryEnvironment === 'strict') {
      requirements.push('comprehensive compliance programs');
      requirements.push('regular audit and reporting');
      requirements.push('staff training and certification');
    } else if (request.contextualFactors.regulatoryEnvironment === 'moderate') {
      requirements.push('standard compliance procedures');
      requirements.push('periodic review and updates');
    }

    // Domain-specific requirements
    const domainRequirements: Record<string, string[]> = {
      'healthcare': ['patient privacy protection', 'medical record management', 'informed consent procedures'],
      'finance': ['anti-money laundering', 'know your customer', 'risk disclosure requirements'],
      'customer_service': ['data protection compliance', 'accessibility standards', 'consumer protection laws'],
    };

    requirements.push(...(domainRequirements[request.domain] || ['general business compliance', 'data protection standards']));

    return requirements;
  }

  private establishEthicalGuidelines(domain: string): string[] {
    const guidelines: Record<string, string[]> = {
      'customer_service': ['customer privacy respect', 'honest communication', 'fair treatment principles'],
      'sales': ['truthful representation', 'customer best interests', 'transparent pricing'],
      'marketing': ['honest advertising', 'consumer protection', 'data privacy respect'],
      'healthcare': ['patient autonomy', 'beneficence and non-maleficence', 'justice and fairness'],
      'finance': ['fiduciary responsibility', 'conflict of interest management', 'fair dealing'],
    };

    return guidelines[domain] || ['honesty and integrity', 'stakeholder respect', 'responsible practices'];
  }

  private defineQualityBenchmarks(request: DomainConsultationRequest): string[] {
    const benchmarks: string[] = [];

    if (request.qualityTarget >= 9) {
      benchmarks.push('industry-leading performance');
      benchmarks.push('best-in-class service delivery');
      benchmarks.push('innovation and excellence');
    } else if (request.qualityTarget >= 7) {
      benchmarks.push('above-average performance');
      benchmarks.push('professional service standards');
      benchmarks.push('continuous improvement');
    } else {
      benchmarks.push('acceptable service levels');
      benchmarks.push('basic professional standards');
    }

    benchmarks.push('customer satisfaction targets');
    benchmarks.push('operational efficiency metrics');

    return benchmarks;
  }

  private async gatherPracticalKnowledge(request: DomainConsultationRequest, domainData: any) {
    const commonScenarios = [...domainData.commonScenarios];
    const typicalChallenges = this.identifyTypicalChallenges(request);
    const solutionPatterns = this.compileSolutionPatterns(request);
    const toolsAndMethods = [...domainData.tools];
    const successMetrics = [...domainData.metrics];

    // Enhance based on specialization
    if (request.specialization) {
      commonScenarios.push(`${request.specialization}-specific scenarios`);
      solutionPatterns.push(`${request.specialization} best practices`);
    }

    return {
      commonScenarios,
      typicalChallenges,
      solutionPatterns,
      toolsAndMethods,
      successMetrics,
    };
  }

  private identifyTypicalChallenges(request: DomainConsultationRequest): string[] {
    const challenges: string[] = [];

    // Context-based challenges
    if (request.contextualFactors.industrySize === 'startup') {
      challenges.push('resource constraints', 'rapid scaling needs', 'process establishment');
    } else if (request.contextualFactors.industrySize === 'enterprise') {
      challenges.push('organizational complexity', 'change resistance', 'coordination difficulties');
    }

    if (request.contextualFactors.competitiveIntensity === 'high') {
      challenges.push('differentiation pressure', 'price competition', 'customer retention');
    }

    // Domain-specific challenges
    const domainChallenges: Record<string, string[]> = {
      'customer_service': ['high volume management', 'agent turnover', 'technology integration'],
      'sales': ['long sales cycles', 'objection handling', 'quota pressure'],
      'marketing': ['attribution complexity', 'channel coordination', 'ROI measurement'],
      'healthcare': ['regulatory compliance', 'cost management', 'quality assurance'],
      'finance': ['risk management', 'regulatory changes', 'market volatility'],
    };

    challenges.push(...(domainChallenges[request.domain] || ['operational efficiency', 'quality maintenance', 'stakeholder alignment']));

    return challenges;
  }

  private compileSolutionPatterns(request: DomainConsultationRequest): string[] {
    const patterns: string[] = [];

    // Expertise level patterns
    if (request.expertiseLevel === 'expert' || request.expertiseLevel === 'specialist') {
      patterns.push('advanced analytical approaches');
      patterns.push('innovative solution design');
      patterns.push('strategic thinking application');
    }

    patterns.push('systematic problem analysis');
    patterns.push('stakeholder-centered solutions');
    patterns.push('iterative improvement processes');
    patterns.push('data-driven decision making');

    // Domain-specific patterns
    const domainPatterns: Record<string, string[]> = {
      'customer_service': ['root cause analysis', 'proactive communication', 'escalation management'],
      'sales': ['consultative approach', 'value demonstration', 'relationship building'],
      'marketing': ['segmentation strategies', 'multi-touch campaigns', 'performance optimization'],
      'healthcare': ['evidence-based decisions', 'patient-centered care', 'continuous monitoring'],
      'finance': ['risk-return analysis', 'diversification strategies', 'compliance-first approach'],
    };

    patterns.push(...(domainPatterns[request.domain] || ['best practice application', 'process optimization', 'quality assurance']));

    return patterns;
  }

  private async deriveExpertInsights(request: DomainConsultationRequest, _domainData: any) {
    const emergingTrends = this.identifyEmergingTrends(request.domain);
    const advancedTechniques = this.compileAdvancedTechniques(request);
    const lessonsLearned = this.gatherLessonsLearned(request);
    const pitfallsToAvoid = this.identifyPitfalls(request);
    const innovativeApproaches = this.suggestInnovativeApproaches(request);

    return {
      emergingTrends,
      advancedTechniques,
      lessonsLearned,
      pitfallsToAvoid,
      innovativeApproaches,
    };
  }

  private identifyEmergingTrends(domain: string): string[] {
    const trends: Record<string, string[]> = {
      'customer_service': ['AI-powered support', 'proactive service', 'omnichannel integration', 'self-service expansion'],
      'sales': ['digital selling', 'social selling', 'AI-assisted prospecting', 'virtual demonstrations'],
      'marketing': ['privacy-first marketing', 'AI personalization', 'voice search optimization', 'influencer partnerships'],
      'healthcare': ['telemedicine adoption', 'personalized medicine', 'AI diagnostics', 'value-based care'],
      'finance': ['open banking', 'cryptocurrency integration', 'ESG investing', 'robo-advisory services'],
    };

    return trends[domain] || ['digital transformation', 'AI integration', 'automation advancement', 'data-driven insights'];
  }

  private compileAdvancedTechniques(request: DomainConsultationRequest): string[] {
    const techniques: string[] = [];

    if (request.expertiseLevel === 'expert' || request.expertiseLevel === 'specialist') {
      techniques.push('predictive analytics application');
      techniques.push('advanced automation strategies');
      techniques.push('cross-functional integration');
      techniques.push('innovation methodology application');
    }

    techniques.push('data-driven optimization');
    techniques.push('systematic process improvement');
    techniques.push('stakeholder alignment strategies');

    return techniques;
  }

  private gatherLessonsLearned(_request: DomainConsultationRequest): string[] {
    return [
      'start with customer needs and work backwards',
      'invest in team training and development',
      'measure what matters and act on insights',
      'adapt quickly to changing conditions',
      'maintain focus on quality over quantity',
      'build strong stakeholder relationships',
      'document and share knowledge effectively'
    ];
  }

  private identifyPitfalls(_request: DomainConsultationRequest): string[] {
    return [
      'ignoring customer feedback and market signals',
      'over-complicating simple processes',
      'failing to invest in employee development',
      'neglecting to measure and track performance',
      'rushing implementation without proper planning',
      'underestimating change management requirements',
      'focusing on tools rather than processes'
    ];
  }

  private suggestInnovativeApproaches(request: DomainConsultationRequest): string[] {
    const approaches: string[] = [];

    if (request.qualityTarget >= 9) {
      approaches.push('breakthrough thinking methodologies');
      approaches.push('cross-industry best practice adoption');
      approaches.push('experimental and pilot programs');
    }

    approaches.push('design thinking application');
    approaches.push('agile methodology adoption');
    approaches.push('collaborative problem-solving');
    approaches.push('continuous learning integration');

    return approaches;
  }

  private async developProcessFrameworks(
    request: DomainConsultationRequest,
    domainExpertise: DomainExpertise
  ): Promise<ProcessFrameworks> {
    
    const decisionFrameworks = this.createDecisionFrameworks(request, domainExpertise);
    const methodologies = this.defineMethodologies(request, domainExpertise);
    const evaluationCriteria = this.establishEvaluationCriteria(request, domainExpertise);

    return {
      decisionFrameworks,
      methodologies,
      evaluationCriteria,
    };
  }

  private createDecisionFrameworks(request: DomainConsultationRequest, _domainExpertise: DomainExpertise) {
    const frameworks = [];

    // Generic decision framework
    frameworks.push({
      name: 'Professional Decision Framework',
      description: 'Systematic approach to professional decision-making',
      steps: [
        'Define the problem and objectives clearly',
        'Gather relevant information and data',
        'Identify stakeholders and their interests',
        'Generate alternative solutions',
        'Evaluate options against criteria',
        'Make decision and develop implementation plan',
        'Monitor results and adjust as needed'
      ],
      applicableScenarios: ['strategic decisions', 'operational choices', 'resource allocation', 'problem resolution']
    });

    // Domain-specific frameworks
    if (request.domain === 'customer_service') {
      frameworks.push({
        name: 'Service Recovery Framework',
        description: 'Systematic approach to handling customer issues',
        steps: [
          'Listen actively and empathize with customer',
          'Apologize sincerely and take ownership',
          'Analyze the issue and root causes',
          'Develop solution options with customer input',
          'Implement agreed solution promptly',
          'Follow up to ensure satisfaction'
        ],
        applicableScenarios: ['complaint handling', 'service failures', 'escalation management']
      });
    }

    return frameworks;
  }

  private defineMethodologies(_request: DomainConsultationRequest, _domainExpertise: DomainExpertise) {
    const methodologies = [];

    // Generic methodology
    methodologies.push({
      name: 'Process Improvement Methodology',
      purpose: 'Systematic approach to improving business processes',
      phases: [
        'Current state analysis',
        'Gap identification',
        'Solution design',
        'Implementation planning',
        'Change management',
        'Performance monitoring'
      ],
      keyDeliverables: ['process maps', 'gap analysis', 'improvement plan', 'success metrics']
    });

    return methodologies;
  }

  private establishEvaluationCriteria(request: DomainConsultationRequest, domainExpertise: DomainExpertise) {
    const criteria = [];

    criteria.push({
      category: 'Quality',
      metrics: ['accuracy', 'completeness', 'timeliness', 'consistency'],
      benchmarks: domainExpertise.professionalStandards.qualityBenchmarks
    });

    criteria.push({
      category: 'Effectiveness',
      metrics: ['goal achievement', 'stakeholder satisfaction', 'resource efficiency'],
      benchmarks: ['meets objectives', 'exceeds expectations', 'optimal resource use']
    });

    return criteria;
  }

  private async createQAGuidance(
    request: DomainConsultationRequest,
    domainExpertise: DomainExpertise
  ): Promise<QAGuidance> {
    
    const questionTypes = this.defineQuestionTypes(request, domainExpertise);
    const answerPatterns = this.createAnswerPatterns(request, domainExpertise);
    const contextualConsiderations = this.identifyContextualConsiderations(request, domainExpertise);

    return {
      questionTypes,
      answerPatterns,
      contextualConsiderations,
    };
  }

  private defineQuestionTypes(_request: DomainConsultationRequest, _domainExpertise: DomainExpertise) {
    const questionTypes = [];

    questionTypes.push({
      category: 'Procedural',
      characteristics: ['step-by-step focus', 'process-oriented', 'implementation details'],
      examples: ['How should I implement...', 'What steps are needed to...', 'What is the process for...'],
      appropriateContexts: ['new employee training', 'process documentation', 'implementation guidance']
    });

    questionTypes.push({
      category: 'Strategic',
      characteristics: ['high-level decisions', 'long-term impact', 'stakeholder considerations'],
      examples: ['What approach should we take for...', 'How should we position...', 'What strategy works best when...'],
      appropriateContexts: ['leadership decisions', 'planning scenarios', 'competitive situations']
    });

    questionTypes.push({
      category: 'Troubleshooting',
      characteristics: ['problem-focused', 'diagnostic approach', 'solution-oriented'],
      examples: ['How do I handle...', 'What should I do when...', 'How can I resolve...'],
      appropriateContexts: ['operational issues', 'customer problems', 'system failures']
    });

    return questionTypes;
  }

  private createAnswerPatterns(_request: DomainConsultationRequest, domainExpertise: DomainExpertise) {
    const patterns = [];

    patterns.push({
      scenario: 'Complex professional decision',
      structure: 'Context → Analysis → Options → Recommendation → Implementation',
      keyElements: ['situational analysis', 'option comparison', 'clear recommendation', 'next steps'],
      expertiseMarkers: domainExpertise.professionalStandards.bestPractices.slice(0, 3)
    });

    patterns.push({
      scenario: 'Technical implementation',
      structure: 'Overview → Prerequisites → Step-by-step process → Quality checks',
      keyElements: ['clear prerequisites', 'detailed steps', 'quality validation', 'troubleshooting tips'],
      expertiseMarkers: domainExpertise.practicalKnowledge.toolsAndMethods.slice(0, 3)
    });

    return patterns;
  }

  private identifyContextualConsiderations(request: DomainConsultationRequest, domainExpertise: DomainExpertise) {
    return {
      industrySpecific: domainExpertise.industryContext.marketDynamics,
      roleSpecific: ['decision authority level', 'resource access', 'stakeholder relationships'],
      experienceSpecific: ['beginner guidance needs', 'expert-level nuances', 'specialist considerations'],
      situationSpecific: ['urgency factors', 'risk tolerance', 'regulatory constraints']
    };
  }

  private async generateImplementationRecommendations(
    _request: DomainConsultationRequest,
    _domainExpertise: DomainExpertise
  ) {
    return {
      expertiseIntegration: [
        'Incorporate domain-specific terminology naturally',
        'Reference industry standards and best practices',
        'Include real-world context and examples',
        'Demonstrate deep professional knowledge'
      ],
      qualityAssurance: [
        'Validate against professional standards',
        'Ensure practical applicability',
        'Check for accuracy and completeness',
        'Verify stakeholder consideration'
      ],
      contextualAdaptation: [
        'Adjust complexity for expertise level',
        'Consider organizational context',
        'Account for regulatory requirements',
        'Reflect market conditions'
      ],
      continuousImprovement: [
        'Monitor industry developments',
        'Update practices based on feedback',
        'Incorporate emerging trends',
        'Refine based on usage patterns'
      ]
    };
  }

  private async conductRiskAssessment(
    request: DomainConsultationRequest,
    _domainExpertise: DomainExpertise
  ) {
    const risks = [];

    // Generic professional risks
    risks.push({
      risk: 'Outdated information or practices',
      likelihood: 'medium' as const,
      impact: 'high' as const,
      mitigation: 'Regular updates based on industry developments and feedback'
    });

    risks.push({
      risk: 'Insufficient context for recommendations',
      likelihood: 'medium' as const,
      impact: 'medium' as const,
      mitigation: 'Include contextual factors and situational considerations'
    });

    // Domain-specific risks
    if (request.contextualFactors.regulatoryEnvironment === 'strict') {
      risks.push({
        risk: 'Compliance violations due to outdated regulations',
        likelihood: 'low' as const,
        impact: 'high' as const,
        mitigation: 'Include disclaimer about verifying current regulations'
      });
    }

    if (request.expertiseLevel === 'professional' && request.qualityTarget >= 9) {
      risks.push({
        risk: 'Over-complexity for target expertise level',
        likelihood: 'medium' as const,
        impact: 'medium' as const,
        mitigation: 'Balance expert insights with practical accessibility'
      });
    }

    return risks;
  }

  protected async assessConfidence(result: unknown): Promise<number> {
    if (typeof result === 'object' && result !== null) {
      const output = result as DomainConsultantOutput;
      
      // Higher confidence for well-known domains
      const knownDomains = ['customer_service', 'sales', 'marketing', 'healthcare', 'finance'];
      const domainKnown = knownDomains.some(domain => 
        JSON.stringify(result).toLowerCase().includes(domain.replace('_', ' '))
      );
      
      const baseConfidence = domainKnown ? 0.85 : 0.75;
      const expertiseBonus = output.domainExpertise.expertInsights.advancedTechniques.length > 5 ? 0.05 : 0;
      const riskPenalty = output.riskAssessment.filter(r => r.likelihood === 'high').length * 0.05;
      
      return Math.max(0.6, baseConfidence + expertiseBonus - riskPenalty);
    }
    
    return 0.75;
  }

  protected async explainReasoning(
    input: unknown,
    output: unknown,
    context?: AgentContext
  ): Promise<string> {
    if (typeof output === 'object' && output !== null) {
      const result = output as DomainConsultantOutput;
      
      const domain = JSON.stringify(input).includes('domain') ? 'specified domain' : 'general';
      const expertiseItems = result.domainExpertise.practicalKnowledge.commonScenarios.length;
      const frameworksCount = result.processFrameworks.decisionFrameworks.length;
      const risksIdentified = result.riskAssessment.length;
      
      return `Domain Consultant provided expertise for ${domain} with ${expertiseItems} practical scenarios, ${frameworksCount} decision frameworks, and identified ${risksIdentified} risk factors. Recommendations include industry best practices, professional standards, and contextual adaptations for optimal implementation.`;
    }
    
    return super.explainReasoning(input, output, context);
  }
}