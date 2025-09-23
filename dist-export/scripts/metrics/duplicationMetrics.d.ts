interface DuplicationPair {
    index1: number;
    index2: number;
    text1: string;
    text2: string;
    jaccard_similarity: number;
    cosine_similarity?: number;
    ngram_overlap: number;
    semantic_duplicate?: boolean;
}
interface DuplicationMetrics {
    duplication_rate: number;
    total_pairs_checked: number;
    high_similarity_pairs: number;
    top_duplicate_pairs: DuplicationPair[];
    semantic_duplication_rate?: number;
    ngram_distributions: Record<number, number>;
    alert_triggered: boolean;
}
interface QAItem {
    qa: {
        q: string;
        a: string;
    };
    index?: number;
}
/**
 * Calculate duplication metrics for a batch of QA items
 */
export declare function calculateDuplicationMetrics(qaItems: QAItem[], configPath?: string): Promise<DuplicationMetrics>;
export {};
//# sourceMappingURL=duplicationMetrics.d.ts.map