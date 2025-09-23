import type { Chunk } from "./chunk";
export interface RetrieveOptions {
  topK?: number;
  minScore?: number;
}
export interface RetrievalItem {
  id: string;
  score: number;
  chunk: Chunk;
}
export declare function retrieve(
  query: string,
  corpus: Chunk[],
  options?: RetrieveOptions,
): RetrievalItem[];
//# sourceMappingURL=retrieve.d.ts.map
