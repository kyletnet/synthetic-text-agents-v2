import { Orchestrator } from "./orchestrator.js";
import { RAGService } from "../rag/service.js";
import { ConfigService } from "../shared/config.js";
export class OrchestrationService {
    orchestrator;
    ragService;
    configService;
    constructor(orchestrator, ragService, configService) {
        this.orchestrator = orchestrator;
        this.ragService = ragService || undefined;
        this.configService = configService;
    }
    static async create(registry, messageBus, logger, options = {}) {
        // Initialize configuration
        const configService = await ConfigService.initialize(options.configPath);
        const ragConfig = configService.getRAGConfig();
        // Initialize RAG service if enabled
        let ragService;
        if (ragConfig.enabled || options.enableRAG) {
            ragService = new RAGService(ragConfig, logger);
            await ragService.initialize();
            await logger.trace({
                level: "info",
                agentId: "orchestration-service",
                action: "rag_initialized",
                data: ragService.getStats(),
            });
        }
        else {
            await logger.trace({
                level: "info",
                agentId: "orchestration-service",
                action: "rag_disabled",
                data: {
                    configEnabled: ragConfig.enabled,
                    optionEnabled: options.enableRAG,
                },
            });
        }
        // Create orchestrator with RAG service
        const orchestrator = new Orchestrator();
        return new OrchestrationService(orchestrator, ragService, configService);
    }
    getOrchestrator() {
        return this.orchestrator;
    }
    getRAGService() {
        return this.ragService;
    }
    getConfigService() {
        return this.configService;
    }
    async addDocumentToRAG(path, content) {
        if (this.ragService) {
            await this.ragService.addDocument(path, content);
        }
    }
    async removeDocumentFromRAG(path) {
        if (this.ragService) {
            await this.ragService.removeDocument(path);
        }
    }
    getRAGStats() {
        return (this.ragService?.getStats() ?? {
            enabled: false,
            documentsCount: 0,
            chunksCount: 0,
            config: null,
        });
    }
}
//# sourceMappingURL=orchestratorFactory.js.map