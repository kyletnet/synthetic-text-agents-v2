import { BaseAgent } from '../core/baseAgent.js';
import { Logger } from '../shared/logger.js';
import { PromptArchitect } from '../agents/promptArchitect.js';
import { QAGenerator } from '../agents/qaGenerator.js';
import { QualityAuditor } from '../agents/qualityAuditor.js';
import { PsychologySpecialist } from '../agents/psychologySpecialist.js';
import { LinguisticsEngineer } from '../agents/linguisticsEngineer.js';
import { DomainConsultant } from '../agents/domainConsultant.js';
import { CognitiveScientist } from '../agents/cognitiveScientist.js';
import { MetaController } from '../agents/metaController.js';

// Re-export BaseAgent for convenience
export { BaseAgent };

export class AgentRegistry {
  private agents: Map<string, BaseAgent> = new Map();

  constructor() {
    // Register core agents
    this.register(new PromptArchitect());
    this.register(new QAGenerator());
    this.register(new QualityAuditor());

    // Register expert council agents
    this.register(new PsychologySpecialist(new Logger()));
    this.register(new LinguisticsEngineer(new Logger()));
    this.register(new DomainConsultant(new Logger()));
    this.register(new CognitiveScientist(new Logger()));

    // Register meta-controller as a lightweight agent
    this.register(new MetaController());
  }

  register(agent: BaseAgent) {
    this.agents.set((agent as any).id, agent);
  }

  getAgent(id: string): BaseAgent | undefined {
    return this.agents.get(id);
  }
}
