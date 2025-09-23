import { BaseAgent } from "../core/baseAgent.js";
import { Logger } from "../shared/logger.js";
import { PromptArchitect } from "../agents/promptArchitect.js";
import { QAGenerator } from "../agents/qaGenerator.js";
import { QualityAuditor } from "../agents/qualityAuditor.js";
import { PsychologySpecialist } from "../agents/psychologySpecialist.js";
import { LinguisticsEngineer } from "../agents/linguisticsEngineer.js";
import { DomainConsultant } from "../agents/domainConsultant.js";
import { CognitiveScientist } from "../agents/cognitiveScientist.js";
import { MetaController } from "../core/metaController.js";
// Re-export BaseAgent for convenience
export { BaseAgent };
export class AgentRegistry {
    agents = new Map();
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
        // Register meta-controller as a comprehensive orchestrator
        this.register(new MetaController(new Logger()));
    }
    register(agent) {
        this.agents.set(agent.id, agent);
    }
    getAgent(id) {
        return this.agents.get(id);
    }
}
//# sourceMappingURL=registry.js.map