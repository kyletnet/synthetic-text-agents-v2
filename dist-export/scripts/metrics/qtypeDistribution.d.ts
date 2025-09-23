interface QtypeDistribution {
    distributions: Record<string, {
        count: number;
        ratio: number;
        examples: string[];
    }>;
    imbalance_score: number;
    entropy: number;
    missing_categories: string[];
    alert_triggered: boolean;
    unclassified_count: number;
    unclassified_ratio: number;
}
interface QAItem {
    qa: {
        q: string;
        a: string;
    };
    index?: number;
}
/**
 * Analyze question type distribution in QA dataset
 */
export declare function analyzeQuestionTypeDistribution(qaItems: QAItem[], configPath?: string): QtypeDistribution;
/**
 * Generate a summary report for question type distribution
 */
export declare function generateQtypeReport(distribution: QtypeDistribution): string;
export {};
//# sourceMappingURL=qtypeDistribution.d.ts.map