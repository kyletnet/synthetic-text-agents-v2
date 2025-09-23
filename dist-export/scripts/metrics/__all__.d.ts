interface BaselineMetricsRecord {
    timestamp: string;
    session_id: string;
    item_index: number;
    total_items: number;
    qa: {
        q: string;
        a: string;
    };
    evidence?: string;
    evidence_idx?: number;
    source_text?: string;
    duplication: {
        is_duplicate: boolean;
        max_similarity: number;
        similar_to_indices: number[];
    };
    qtype: {
        classified_type: string | null;
        confidence: number;
        unclassified: boolean;
    };
    coverage: {
        entity_coverage_score: number;
        section_coverage_score: number;
        covered_entities: string[];
        missing_entities: string[];
    };
    evidence_quality: {
        has_evidence: boolean;
        alignment_score: number;
        evidence_complete: boolean;
    };
    hallucination: {
        flagged: boolean;
        risk_level: "low" | "medium" | "high" | null;
        similarity_to_evidence: number;
        unsupported_claims: string[];
    };
    pii_license: {
        pii_violations: number;
        license_violations: number;
        clean: boolean;
        violation_types: string[];
    };
    cost_usd: number;
    latency_ms: number;
    tokens_in?: number;
    tokens_out?: number;
    quality_score: number;
    alert_flags: string[];
}
interface BaselineMetricsSummary {
    timestamp: string;
    session_id: string;
    total_items: number;
    config_version: string;
    duplication: {
        rate: number;
        high_similarity_pairs: number;
        semantic_duplication_rate?: number;
        alert_triggered: boolean;
    };
    qtype_distribution: {
        distributions: Record<string, {
            count: number;
            ratio: number;
        }>;
        imbalance_score: number;
        entropy: number;
        missing_categories: string[];
        alert_triggered: boolean;
    };
    coverage: {
        entity_coverage_rate: number;
        section_coverage_rate: number;
        overall_score: number;
        critical_gaps: string[];
        alert_triggered: boolean;
    };
    evidence_quality: {
        presence_rate: number;
        alignment_mean: number;
        alignment_p95: number;
        alert_triggered: boolean;
    };
    hallucination: {
        rate: number;
        high_risk_count: number;
        risk_distribution: Record<string, number>;
        alert_triggered: boolean;
    };
    pii_license: {
        pii_hits: number;
        license_hits: number;
        total_violations: number;
        alert_triggered: boolean;
    };
    cost_total_usd: number;
    cost_per_item: number;
    latency_p50_ms: number;
    latency_p95_ms: number;
    budget_utilization: number;
    overall_quality_score: number;
    reproducibility_check: {
        passed: boolean;
        deviations: Record<string, number>;
    };
    total_alerts: number;
    recommendation_level: "green" | "yellow" | "red";
}
interface QAItem {
    qa: {
        q: string;
        a: string;
    };
    evidence?: string;
    evidence_text?: string;
    source_text?: string;
    index?: number;
    cost_usd?: number;
    latency_ms?: number;
    tokens_in?: number;
    tokens_out?: number;
}
interface CalculateOptions {
    configPath?: string;
    sessionId?: string;
    budgetLimit?: number;
    sourceTexts?: string[];
}
/**
 * Main function to calculate all baseline metrics
 */
export declare function calculateAllBaselineMetrics(qaItems: QAItem[], options?: CalculateOptions): Promise<{
    records: BaselineMetricsRecord[];
    summary: BaselineMetricsSummary;
}>;
export {};
//# sourceMappingURL=__all__.d.ts.map