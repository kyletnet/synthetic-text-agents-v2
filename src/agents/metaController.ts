import { BaseAgent } from '../core/baseAgent.js';
import { AgentMessage, AgentResult, AgentContext } from '../shared/types.js';
import { Logger } from '../shared/logger.js';

export class MetaController extends BaseAgent {
  constructor() {
    super('meta-controller', 'MetaController', ['orchestration', 'strategy'], new Logger());
  }

  protected async handle(content: unknown, context?: AgentContext): Promise<unknown> {
    const req: any = content || {};
    const topic = req.topic || 'general';
    const complexity = req.complexity || 5;
    const domainContext = req.domainContext || 'general';

    // MetaController analyzes the request and provides strategic guidance
    const strategy = this.analyzeRequestStrategy(topic, complexity, domainContext);

    return {
      strategy,
      recommendations: this.getProcessingRecommendations(complexity, domainContext),
      estimatedAgents: this.estimateRequiredAgents(complexity, domainContext),
      processingHints: this.getProcessingHints(topic)
    };
  }

  private analyzeRequestStrategy(topic: string, complexity: number, domainContext: string) {
    const strategies: string[] = [];

    if (complexity >= 8) {
      strategies.push('comprehensive-analysis');
    }

    if (domainContext !== 'general') {
      strategies.push('domain-specific');
    }

    if (topic.includes('교육') || topic.includes('학습')) {
      strategies.push('educational-focus');
    }

    if (topic.includes('기술') || topic.includes('프로그래밍')) {
      strategies.push('technical-precision');
    }

    return {
      primary: strategies[0] || 'balanced-approach',
      secondary: strategies.slice(1),
      confidence: Math.min(0.95, 0.6 + (complexity / 10) * 0.3)
    };
  }

  private getProcessingRecommendations(complexity: number, domainContext: string) {
    const recommendations: string[] = [];

    if (complexity >= 9) {
      recommendations.push('Use full expert council');
      recommendations.push('Enable detailed quality auditing');
    } else if (complexity >= 7) {
      recommendations.push('Use core agents with domain specialist');
    } else {
      recommendations.push('Use minimal agent set for efficiency');
    }

    if (domainContext !== 'general') {
      recommendations.push(`Prioritize domain-specific expertise for ${domainContext}`);
    }

    return recommendations;
  }

  private estimateRequiredAgents(complexity: number, domainContext: string) {
    const agents = ['qa-generator', 'quality-auditor'];

    if (complexity >= 6) {
      agents.push('prompt-architect');
    }

    if (complexity >= 8) {
      agents.push('psychology-specialist', 'linguistics-engineer');
    }

    if (domainContext !== 'general') {
      agents.push('domain-consultant');
    }

    if (complexity >= 9) {
      agents.push('cognitive-scientist');
    }

    return {
      required: agents,
      estimatedProcessingTime: this.estimateProcessingTime(agents.length),
      estimatedCost: this.estimateCost(agents.length, complexity)
    };
  }

  private getProcessingHints(topic: string) {
    const hints: string[] = [];

    if (topic.length < 10) {
      hints.push('Consider expanding topic description for better results');
    }

    if (topic.includes('간단한')) {
      hints.push('Detected simple request - optimizing for speed');
    }

    if (topic.includes('복잡한') || topic.includes('고급')) {
      hints.push('Detected complex request - prioritizing quality');
    }

    return hints;
  }

  private estimateProcessingTime(agentCount: number): number {
    // Base time + time per agent
    return 500 + (agentCount * 300);
  }

  private estimateCost(agentCount: number, complexity: number): number {
    // Rough cost estimation in USD
    const baseCost = 0.001;
    const agentMultiplier = agentCount * 0.0005;
    const complexityMultiplier = complexity * 0.0002;

    return Number((baseCost + agentMultiplier + complexityMultiplier).toFixed(6));
  }
}