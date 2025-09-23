import { Orchestrator } from "./orchestrator.js";
import { AgentRegistry } from "../shared/registry.js";
import { MessageBus } from "../shared/bus.js";
import { Logger } from "../shared/logger.js";
import { RAGService } from "../rag/service.js";
import { ConfigService } from "../shared/config.js";
export interface OrchestrationServiceOptions {
  configPath?: string;
  enableRAG?: boolean;
}
export declare class OrchestrationService {
  private orchestrator;
  private ragService?;
  private configService;
  private constructor();
  static create(
    registry: AgentRegistry,
    messageBus: MessageBus,
    logger: Logger,
    options?: OrchestrationServiceOptions,
  ): Promise<OrchestrationService>;
  getOrchestrator(): Orchestrator;
  getRAGService(): RAGService | undefined;
  getConfigService(): ConfigService;
  addDocumentToRAG(path: string, content?: string): Promise<void>;
  removeDocumentFromRAG(path: string): Promise<void>;
  getRAGStats():
    | {
        enabled: boolean;
        documentsCount: number;
        chunksCount: number;
        config: import("../rag/service.js").RAGConfig;
      }
    | {
        enabled: false;
        documentsCount: number;
        chunksCount: number;
        config: null;
      };
}
//# sourceMappingURL=orchestratorFactory.d.ts.map
