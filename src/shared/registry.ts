/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Agent Registry with Factory Pattern (No Circular Dependencies)
 *
 * This registry uses lazy loading factories to avoid circular import dependencies.
 * Agents are only instantiated when first requested, breaking the circular dependency chain.
 */

import type { BaseAgent } from "./agent-interface.js";
import type { Logger } from "./logger.js";

// Re-export BaseAgent for convenience
export type { BaseAgent };

type AgentFactory = (logger?: Logger) => BaseAgent | Promise<BaseAgent>;

export class AgentRegistry {
  private factories: Map<string, AgentFactory> = new Map();
  private instances: Map<string, BaseAgent> = new Map();

  constructor() {
    // Register agent factories (lazy loading - no imports until needed)
    this.registerFactory("prompt-architect", async () => {
      const { PromptArchitect } = await import("../agents/promptArchitect.js");
      return new PromptArchitect();
    });

    this.registerFactory("qa-generator", async () => {
      const { QAGenerator } = await import("../agents/qaGenerator.js");
      return new QAGenerator();
    });

    this.registerFactory("quality-auditor", async () => {
      const { QualityAuditor } = await import("../agents/qualityAuditor.js");
      return new QualityAuditor();
    });

    this.registerFactory("psychology-specialist", async (logger) => {
      const { PsychologySpecialist } = await import(
        "../agents/psychologySpecialist.js"
      );
      const { Logger } = await import("../shared/logger.js");
      return new PsychologySpecialist(logger || new Logger());
    });

    this.registerFactory("linguistics-engineer", async (logger) => {
      const { LinguisticsEngineer } = await import(
        "../agents/linguisticsEngineer.js"
      );
      const { Logger } = await import("../shared/logger.js");
      return new LinguisticsEngineer(logger || new Logger());
    });

    this.registerFactory("domain-consultant", async (logger) => {
      const { DomainConsultant } = await import(
        "../agents/domainConsultant.js"
      );
      const { Logger } = await import("../shared/logger.js");
      return new DomainConsultant(logger || new Logger());
    });

    this.registerFactory("cognitive-scientist", async (logger) => {
      const { CognitiveScientist } = await import(
        "../agents/cognitiveScientist.js"
      );
      const { Logger } = await import("../shared/logger.js");
      return new CognitiveScientist(logger || new Logger());
    });

    this.registerFactory("meta-controller", async (logger) => {
      const { MetaController } = await import("../core/metaController.js");
      const { Logger } = await import("../shared/logger.js");
      return new MetaController(logger || new Logger());
    });
  }

  /**
   * Register a factory function for lazy agent creation
   */
  registerFactory(id: string, factory: AgentFactory): void {
    this.factories.set(id, factory);
  }

  /**
   * Get an agent by ID (lazy instantiation)
   */
  async getAgent(id: string, logger?: Logger): Promise<BaseAgent | undefined> {
    // Return cached instance if available
    if (this.instances.has(id)) {
      return this.instances.get(id);
    }

    // Create new instance from factory
    const factory = this.factories.get(id);
    if (!factory) {
      return undefined;
    }

    const agent = await factory(logger);
    this.instances.set(id, agent);
    return agent;
  }

  /**
   * Register a pre-instantiated agent (for backward compatibility)
   */
  register(agent: BaseAgent): void {
    this.instances.set(agent.id, agent);
  }

  /**
   * Get all registered agent IDs
   */
  getRegisteredAgents(): string[] {
    return Array.from(this.factories.keys());
  }

  /**
   * Clear all cached instances (for testing)
   */
  clearInstances(): void {
    this.instances.clear();
  }
}

/**
 * Global singleton registry (for backward compatibility)
 */
let globalRegistry: AgentRegistry | null = null;

export function getGlobalRegistry(): AgentRegistry {
  if (!globalRegistry) {
    globalRegistry = new AgentRegistry();
  }
  return globalRegistry;
}
