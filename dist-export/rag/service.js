import { readFile, readdir } from "fs/promises";
import { join } from "path";
import { chunkText } from "./chunk.js";
import { retrieve, } from "./retrieve.js";
export class RAGService {
    config;
    logger;
    documentIndex = new Map();
    corpus = [];
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
    }
    async initialize() {
        if (!this.config.enabled) {
            await this.logger.trace({
                level: "info",
                agentId: "rag-service",
                action: "initialization_skipped",
                data: { reason: "RAG disabled in config" },
            });
            return;
        }
        const start = Date.now();
        await this.logger.trace({
            level: "info",
            agentId: "rag-service",
            action: "initialization_started",
            data: { paths: this.config.indexPaths },
        });
        try {
            await this.buildIndex();
            await this.logger.trace({
                level: "info",
                agentId: "rag-service",
                action: "initialization_completed",
                data: {
                    documentsIndexed: this.documentIndex.size,
                    totalChunks: this.corpus.length,
                },
                duration: Date.now() - start,
            });
        }
        catch (error) {
            await this.logger.trace({
                level: "error",
                agentId: "rag-service",
                action: "initialization_failed",
                data: {},
                error: error instanceof Error ? error.message : String(error),
                duration: Date.now() - start,
            });
            throw error;
        }
    }
    async search(query, options) {
        const start = Date.now();
        if (!this.config.enabled) {
            return {
                query,
                retrievedChunks: [],
                totalChunks: 0,
                searchDuration: 0,
            };
        }
        await this.logger.trace({
            level: "debug",
            agentId: "rag-service",
            action: "search_started",
            data: { query: query.substring(0, 100), corpusSize: this.corpus.length },
        });
        try {
            const searchOptions = {
                topK: options?.topK ?? this.config.topK,
                minScore: options?.minScore ?? this.config.minScore,
            };
            const retrievedChunks = retrieve(query, this.corpus, searchOptions);
            const searchDuration = Date.now() - start;
            await this.logger.trace({
                level: "debug",
                agentId: "rag-service",
                action: "search_completed",
                data: {
                    resultsCount: retrievedChunks.length,
                    topScore: retrievedChunks[0]?.score ?? 0,
                },
                duration: searchDuration,
            });
            return {
                query,
                retrievedChunks,
                totalChunks: this.corpus.length,
                searchDuration,
            };
        }
        catch (error) {
            await this.logger.trace({
                level: "error",
                agentId: "rag-service",
                action: "search_failed",
                data: { query: query.substring(0, 100) },
                error: error instanceof Error ? error.message : String(error),
                duration: Date.now() - start,
            });
            throw error;
        }
    }
    async addDocument(path, content) {
        if (!this.config.enabled)
            return;
        const start = Date.now();
        try {
            const documentContent = content || (await readFile(path, "utf-8"));
            const chunks = chunkText(documentContent, this.config.chunkOptions);
            // Add path prefix to chunk IDs to make them globally unique
            const pathPrefix = path.replace(/[^a-zA-Z0-9]/g, "_");
            chunks.forEach((chunk) => {
                chunk.id = `${pathPrefix}_${chunk.id}`;
                chunk.meta = { ...chunk.meta, sourceDocument: path };
            });
            const docIndex = {
                id: pathPrefix,
                path,
                chunks,
                lastModified: new Date(),
                metadata: {
                    chunkCount: chunks.length,
                    contentLength: documentContent.length,
                },
            };
            // Remove old chunks from corpus if document existed
            if (this.documentIndex.has(path)) {
                const oldDoc = this.documentIndex.get(path);
                if (oldDoc) {
                    this.corpus = this.corpus.filter((chunk) => !oldDoc.chunks.some((oldChunk) => oldChunk.id === chunk.id));
                }
            }
            // Add new chunks to corpus
            this.corpus.push(...chunks);
            this.documentIndex.set(path, docIndex);
            await this.logger.trace({
                level: "info",
                agentId: "rag-service",
                action: "document_added",
                data: {
                    path,
                    chunkCount: chunks.length,
                    totalCorpusSize: this.corpus.length,
                },
                duration: Date.now() - start,
            });
        }
        catch (error) {
            await this.logger.trace({
                level: "error",
                agentId: "rag-service",
                action: "document_add_failed",
                data: { path },
                error: error instanceof Error ? error.message : String(error),
                duration: Date.now() - start,
            });
            throw error;
        }
    }
    async removeDocument(path) {
        if (!this.config.enabled || !this.documentIndex.has(path))
            return;
        const docIndex = this.documentIndex.get(path);
        if (!docIndex) {
            await this.logger.trace({
                level: "warn",
                agentId: "rag-service",
                action: "document_remove_failed",
                data: { path, reason: "Document not found in index" },
            });
            return;
        }
        // Remove chunks from corpus
        this.corpus = this.corpus.filter((chunk) => !docIndex.chunks.some((docChunk) => docChunk.id === chunk.id));
        // Remove from index
        this.documentIndex.delete(path);
        await this.logger.trace({
            level: "info",
            agentId: "rag-service",
            action: "document_removed",
            data: { path, remainingCorpusSize: this.corpus.length },
        });
    }
    getStats() {
        return {
            enabled: this.config.enabled,
            documentsCount: this.documentIndex.size,
            chunksCount: this.corpus.length,
            config: this.config,
        };
    }
    async buildIndex() {
        for (const indexPath of this.config.indexPaths) {
            await this.indexPath(indexPath);
        }
    }
    async indexPath(path) {
        try {
            const stat = await readdir(path, { withFileTypes: true }).catch(() => null);
            if (!stat) {
                // Try as single file
                await this.addDocument(path);
                return;
            }
            // Process directory
            for (const dirent of stat) {
                const fullPath = join(path, dirent.name);
                if (dirent.isDirectory()) {
                    // Recursively index subdirectories
                    await this.indexPath(fullPath);
                }
                else if (this.shouldIndexFile(dirent.name)) {
                    await this.addDocument(fullPath);
                }
            }
        }
        catch (error) {
            await this.logger.trace({
                level: "warn",
                agentId: "rag-service",
                action: "index_path_failed",
                data: { path },
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    shouldIndexFile(filename) {
        const textExtensions = [
            ".md",
            ".txt",
            ".json",
            ".ts",
            ".js",
            ".py",
            ".java",
            ".go",
            ".rs",
        ];
        return textExtensions.some((ext) => filename.toLowerCase().endsWith(ext));
    }
}
//# sourceMappingURL=service.js.map