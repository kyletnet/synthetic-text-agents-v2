import { BaseAgent } from './baseAgent.js';
import { QARequest, AgentContext, QARequestSchema } from '../shared/types.js';
import { Logger } from '../shared/logger.js';

export interface ComplexityAnalysis {
  score: number; // 1-10
  factors: {
    domainSpecificity: number;
    technicalDepth: number;
    userComplexity: number;
    innovationRequired: number;
    interdisciplinaryNeeds: number;
  };
  reasoning: string;
  recommendedAgents: string[];
}

export interface ExpertSummons {
  coreAgents: string[];
  expertCouncil: string[];
  strategy: 'minimal' | 'standard' | 'full-council';
  collaborationApproach: 'sequential' | 'parallel' | 'hybrid';
}

export interface MetaControllerDecision {
  taskAnalysis: ComplexityAnalysis;
  agentSelection: ExpertSummons;
  qualityGates: number[];
  executionStrategy: string;
  expectedOutcome: {
    qualityScore: number;
    estimatedDuration: number;
    resourceRequirement: 'low' | 'medium' | 'high';
  };
}

export class MetaController extends BaseAgent {
  constructor(logger: Logger) {
    super(
      'meta-controller',
      'system_orchestration',
      ['orchestration', 'strategy', 'decision-making', 'complexity-analysis'],
      logger
    );
  }

  protected async handle(content: unknown, context?: AgentContext): Promise<MetaControllerDecision> {
    await this.validateInput(content);
    
    const taskRequest = this.parseTaskRequest(content);
    const complexityAnalysis = await this.analyzeComplexity(taskRequest, context);
    const agentSelection = await this.selectOptimalAgents(complexityAnalysis, taskRequest);
    const qualityGates = await this.defineQualityGates(taskRequest, complexityAnalysis);
    const executionStrategy = await this.planExecutionStrategy(agentSelection, complexityAnalysis);
    const expectedOutcome = await this.projectOutcome(complexityAnalysis, agentSelection);

    return {
      taskAnalysis: complexityAnalysis,
      agentSelection,
      qualityGates,
      executionStrategy,
      expectedOutcome,
    };
  }

  private parseTaskRequest(content: unknown): QARequest {
    if (typeof content === 'object' && content !== null) {
      return QARequestSchema.parse(content);
    }

    throw new Error('Invalid task request format');
  }

  private async analyzeComplexity(request: QARequest, context?: AgentContext): Promise<ComplexityAnalysis> {
    const start = Date.now();

    await this.logger.trace({
      level: 'debug',
      agentId: this.id,
      action: 'complexity_analysis_started',
      data: { taskId: context?.taskId || 'unknown', domain: request.domainContext || 'general' },
    });

    const factors = {
      domainSpecificity: this.assessDomainSpecificity(request),
      technicalDepth: this.assessTechnicalDepth(request),
      userComplexity: this.assessUserComplexity(request),
      innovationRequired: this.assessInnovationRequirement(request),
      interdisciplinaryNeeds: this.assessInterdisciplinaryNeeds(request),
    };

    const score = this.calculateComplexityScore(factors);
    const reasoning = this.generateComplexityReasoning(factors, score);
    const recommendedAgents = this.recommendInitialAgents(score, factors);

    const analysis: ComplexityAnalysis = {
      score,
      factors,
      reasoning,
      recommendedAgents,
    };

    await this.logger.trace({
      level: 'info',
      agentId: this.id,
      action: 'complexity_analysis_completed',
      data: { 
        taskId: context?.taskId || 'unknown',
        complexityScore: score,
        recommendedAgentCount: recommendedAgents.length,
      },
      duration: Date.now() - start,
    });

    return analysis;
  }

  private assessDomainSpecificity(request: QARequest): number {
    const specializedDomains = ['healthcare', 'legal', 'finance', 'scientific'];
    const domain = request.domainContext || 'general';
    const isSpecialized = specializedDomains.includes(domain.toLowerCase());

    const hasSpecialization = domain !== 'general';
    const qualityTarget = request.qualityTarget || 8;
    
    let score = 3;
    if (isSpecialized) score += 2;
    if (hasSpecialization) score += 2;
    if (qualityTarget >= 9) score += 1;
    
    return Math.min(score, 5);
  }

  private assessTechnicalDepth(request: QARequest): number {
    const topic = request.topic.toLowerCase();
    const technicalKeywords = [
      'implementation', 'algorithm', 'architecture', 'integration',
      'protocol', 'framework', 'api', 'system', 'technical'
    ];
    
    const keywordCount = technicalKeywords.filter(keyword =>
      topic.includes(keyword)
    ).length;
    
    return Math.min(Math.ceil(keywordCount / 2) + 1, 5);
  }

  private assessUserComplexity(request: QARequest): number {
    const quantity = request.count || 5;
    const qualityTarget = request.qualityTarget || 8;
    
    let score = 2;
    if (quantity > 500) score += 1;
    if (quantity > 1000) score += 1;
    if (qualityTarget >= 9) score += 1;
    if (qualityTarget >= 9.5) score += 1;
    
    return Math.min(score, 5);
  }

  private assessInnovationRequirement(request: QARequest): number {
    const topic = request.topic.toLowerCase();
    const innovationKeywords = [
      'novel', 'innovative', 'creative', 'unique', 'breakthrough',
      'cutting-edge', 'pioneering', 'revolutionary', 'new approach'
    ];
    
    const hasInnovation = innovationKeywords.some(keyword =>
      topic.includes(keyword)
    );
    
    const qualityTarget = request.qualityTarget || 8;
    
    let score = hasInnovation ? 4 : 2;
    if (qualityTarget >= 9.5) score += 1;
    
    return Math.min(score, 5);
  }

  private assessInterdisciplinaryNeeds(request: QARequest): number {
    const topic = request.topic.toLowerCase();
    const disciplines = [
      'psychology', 'linguistics', 'cognitive', 'behavioral',
      'social', 'cultural', 'economic', 'technical', 'creative'
    ];
    
    const disciplineCount = disciplines.filter(discipline =>
      topic.includes(discipline)
    ).length;
    
    return Math.min(disciplineCount + 1, 5);
  }

  private calculateComplexityScore(factors: ComplexityAnalysis['factors']): number {
    const weights = {
      domainSpecificity: 0.25,
      technicalDepth: 0.20,
      userComplexity: 0.20,
      innovationRequired: 0.20,
      interdisciplinaryNeeds: 0.15,
    };

    const weightedScore = Object.entries(factors).reduce((sum, [key, value]) => {
      const weight = weights[key as keyof typeof weights];
      return sum + (value * weight);
    }, 0);

    return Math.min(Math.max(Math.round(weightedScore * 2), 1), 10);
  }

  private generateComplexityReasoning(
    factors: ComplexityAnalysis['factors'], 
    score: number
  ): string {
    const highFactors = Object.entries(factors)
      .filter(([_, value]) => value >= 4)
      .map(([key, _]) => key.replace(/([A-Z])/g, ' $1').toLowerCase());

    const complexity = score >= 7 ? 'high' : score >= 5 ? 'medium' : 'low';
    
    const reasoning = `Complexity score: ${score}/10 (${complexity}). ` +
      (highFactors.length > 0 
        ? `Key complexity drivers: ${highFactors.join(', ')}. `
        : 'Standard complexity factors identified. ') +
      `This task ${score >= 7 ? 'requires full expert council' : 
        score >= 5 ? 'needs selective expert consultation' : 
        'can be handled with core agents'}.`;

    return reasoning;
  }

  private recommendInitialAgents(score: number, factors: ComplexityAnalysis['factors']): string[] {
    const coreAgents = ['meta-controller', 'qa-generator', 'quality-auditor'];
    
    if (score >= 7) {
      return [
        ...coreAgents,
        'prompt-architect',
        'psychology-specialist',
        'linguistics-engineer',
        'domain-consultant',
        'cognitive-scientist'
      ];
    } else if (score >= 5) {
      const experts = ['prompt-architect', 'domain-consultant'];
      
      if (factors.userComplexity >= 4) {
        experts.push('psychology-specialist');
      }
      if (factors.technicalDepth >= 4) {
        experts.push('linguistics-engineer');
      }
      
      return [...coreAgents, ...experts];
    } else {
      return [...coreAgents, 'domain-consultant'];
    }
  }

  private async selectOptimalAgents(
    analysis: ComplexityAnalysis,
    _request: QARequest
  ): Promise<ExpertSummons> {
    const { score, factors } = analysis;

    let strategy: ExpertSummons['strategy'];
    let collaborationApproach: ExpertSummons['collaborationApproach'];

    if (score >= 7) {
      strategy = 'full-council';
      collaborationApproach = 'hybrid';
    } else if (score >= 5) {
      strategy = 'standard';
      collaborationApproach = 'sequential';
    } else {
      strategy = 'minimal';
      collaborationApproach = 'parallel';
    }

    const coreAgents = ['meta-controller', 'qa-generator', 'quality-auditor'];
    
    let expertCouncil: string[] = [];
    
    if (strategy === 'full-council') {
      expertCouncil = [
        'prompt-architect',
        'psychology-specialist',
        'linguistics-engineer',
        'domain-consultant',
        'cognitive-scientist'
      ];
    } else if (strategy === 'standard') {
      expertCouncil.push('prompt-architect', 'domain-consultant');
      
      if (factors.userComplexity >= 4 || factors.innovationRequired >= 4) {
        expertCouncil.push('psychology-specialist');
      }
      if (factors.technicalDepth >= 4 || factors.domainSpecificity >= 4) {
        expertCouncil.push('linguistics-engineer');
      }
    } else {
      expertCouncil.push('domain-consultant');
    }

    return {
      coreAgents,
      expertCouncil,
      strategy,
      collaborationApproach,
    };
  }

  private async defineQualityGates(
    request: QARequest,
    analysis: ComplexityAnalysis
  ): Promise<number[]> {
    const target = request.qualityTarget || 8;
    const complexity = analysis.score;

    if (complexity >= 7) {
      return [target * 0.6, target * 0.75, target * 0.9, target];
    } else if (complexity >= 5) {
      return [target * 0.7, target * 0.85, target];
    } else {
      return [target * 0.8, target];
    }
  }

  private async planExecutionStrategy(
    selection: ExpertSummons,
    analysis: ComplexityAnalysis
  ): Promise<string> {
    const { strategy, collaborationApproach } = selection;
    const complexity = analysis.score;

    if (strategy === 'full-council') {
      return `Hybrid execution: Meta-Controller analysis → Parallel expert consultation (${selection.expertCouncil.length} experts) → Sequential core processing → Quality validation. Expected ${Math.ceil(complexity * 0.5)} rounds of refinement.`;
    } else if (strategy === 'standard') {
      return `Sequential execution: Meta-Controller planning → Expert consultation (${selection.expertCouncil.length} experts) → Core processing → Quality review. Expected ${Math.ceil(complexity * 0.3)} refinement cycles.`;
    } else {
      return `Streamlined execution: Meta-Controller oversight → Parallel core processing with domain consultation → Quality check. Single-pass execution expected.`;
    }
  }

  private async projectOutcome(
    analysis: ComplexityAnalysis,
    selection: ExpertSummons
  ): Promise<MetaControllerDecision['expectedOutcome']> {
    const complexity = analysis.score;
    const agentCount = selection.coreAgents.length + selection.expertCouncil.length;

    const baseQuality = 7;
    const qualityBoost = Math.min(agentCount * 0.2, 2.5);
    const qualityScore = Math.min(baseQuality + qualityBoost, 10);

    const baseDuration = 30; // minutes
    const durationMultiplier = complexity * agentCount * 0.1;
    const estimatedDuration = baseDuration * (1 + durationMultiplier);

    let resourceRequirement: 'low' | 'medium' | 'high';
    if (agentCount <= 4) {
      resourceRequirement = 'low';
    } else if (agentCount <= 6) {
      resourceRequirement = 'medium';
    } else {
      resourceRequirement = 'high';
    }

    return {
      qualityScore: Math.round(qualityScore * 10) / 10,
      estimatedDuration: Math.round(estimatedDuration),
      resourceRequirement,
    };
  }

  protected async assessConfidence(result: unknown): Promise<number> {
    if (typeof result === 'object' && result !== null) {
      const decision = result as MetaControllerDecision;
      const complexityScore = decision.taskAnalysis.score;
      
      const baseConfidence = 0.8;
      const complexityPenalty = Math.max(0, (complexityScore - 5) * 0.02);
      
      return Math.max(0.6, baseConfidence - complexityPenalty);
    }
    
    return 0.7;
  }

  protected async explainReasoning(
    input: unknown,
    output: unknown,
    context?: AgentContext
  ): Promise<string> {
    if (typeof output === 'object' && output !== null) {
      const decision = output as MetaControllerDecision;
      
      return `Meta-Controller analyzed task complexity (${decision.taskAnalysis.score}/10) and selected ${decision.agentSelection.strategy} strategy with ${decision.agentSelection.coreAgents.length + decision.agentSelection.expertCouncil.length} agents. Execution approach: ${decision.agentSelection.collaborationApproach}. Quality gates: ${decision.qualityGates.length} checkpoints. Expected quality: ${decision.expectedOutcome.qualityScore}/10 in ${decision.expectedOutcome.estimatedDuration} minutes.`;
    }
    
    return super.explainReasoning(input, output, context);
  }
}