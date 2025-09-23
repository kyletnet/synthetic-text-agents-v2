export interface Chunk {
    id: string;
    text: string;
    start: number;
    end: number;
    meta?: Record<string, unknown>;
}
export interface ChunkOptions {
    maxChars?: number;
    overlap?: number;
    minChars?: number;
}
export declare function chunkText(input: string, options?: ChunkOptions): Chunk[];
//# sourceMappingURL=chunk.d.ts.map