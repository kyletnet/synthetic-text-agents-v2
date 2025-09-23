import { type Chunk, type ChunkOptions } from "./chunk.js";
import { type RetrievalItem, type RetrieveOptions } from "./retrieve.js";
import type { Logger } from "../shared/logger.js";
export interface RAGConfig {
  enabled: boolean;
  topK: number;
  minScore: number;
  chunkOptions?: ChunkOptions;
  indexPaths: string[];
}
export interface DocumentIndex {
  id: string;
  path: string;
  chunks: Chunk[];
  lastModified: Date;
  metadata: Record<string, unknown>;
}
export interface RAGContext {
  query: string;
  retrievedChunks: RetrievalItem[];
  totalChunks: number;
  searchDuration: number;
}
export declare class RAGService {
  private config;
  private logger;
  private documentIndex;
  private corpus;
  constructor(config: RAGConfig, logger: Logger);
  initialize(): Promise<void>;
  search(query: string, options?: RetrieveOptions): Promise<RAGContext>;
  addDocument(path: string, content?: string): Promise<void>;
  removeDocument(path: string): Promise<void>;
  getStats(): {
    enabled: boolean;
    documentsCount: number;
    chunksCount: number;
    config: RAGConfig;
  };
  private buildIndex;
  private indexPath;
  private shouldIndexFile;
}
//# sourceMappingURL=service.d.ts.map
