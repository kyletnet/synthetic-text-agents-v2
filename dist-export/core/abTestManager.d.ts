import { QARequest, QAResponse } from "../shared/types.js";
import { Orchestrator } from "./orchestrator.js";
interface TestVariant {
    id: string;
    name: string;
    description: string;
    agentSelection: (complexity: number, domain?: string) => string[];
    enabled: boolean;
}
interface QualityMetrics {
    averageConfidence: number;
    qualityScore: number;
    diversityScore: number;
    coherenceScore: number;
    agentCollaborationScore: number;
}
export declare class ABTestManager {
    private variants;
    private activeTests;
    private logger;
    private orchestrator;
    constructor(orchestrator: Orchestrator);
    private initializeDefaultVariants;
    /**
     * A/B 테스트 시작
     */
    startTest(testId: string, variantIds: string[], sampleSize?: number): Promise<void>;
    /**
     * 특정 variant로 요청 처리 및 결과 기록
     */
    processRequestWithVariant(variantId: string, request: QARequest, testId?: string): Promise<{
        response: QAResponse;
        metrics: QualityMetrics;
    }>;
    /**
     * A/B 테스트 자동 실행
     */
    runAutomatedTest(testId: string, testRequests: QARequest[], variantIds?: string[]): Promise<void>;
    /**
     * 테스트 결과 분석
     */
    analyzeTestResults(testId: string): Promise<{
        variants: {
            [variantId: string]: VariantStats;
        };
        summary: TestSummary;
    }>;
    private calculateMetrics;
    private estimateCost;
    /**
     * Get available variants
     */
    getVariants(): TestVariant[];
    /**
     * Get active tests
     */
    getActiveTests(): {
        [testId: string]: string[];
    };
}
interface VariantStats {
    variantId: string;
    sampleSize: number;
    averageProcessingTime: number;
    averageQualityScore: number;
    averageConfidence: number;
    totalCost: number;
    successRate: number;
}
interface TestSummary {
    testId: string;
    totalRequests: number;
    bestVariant: string;
    significantDifference: boolean;
    recommendedAction: string;
}
export {};
//# sourceMappingURL=abTestManager.d.ts.map