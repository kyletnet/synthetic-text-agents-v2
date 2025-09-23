/**
 * observability_exporter.ts — Export and render observability data from run logs
 */
interface TraceEntry {
    timestamp: string;
    run_id?: string;
    session_id?: string;
    correlation_id?: string;
    component: string;
    operation?: string;
    agent_id?: string;
    agent_role?: string;
    status?: string;
    cost_usd?: number;
    latency_ms?: number;
    level?: string;
    parentId?: string | null;
    span_kind?: "root" | "child";
    is_root?: boolean;
    op_id?: string;
    [key: string]: any;
}
interface TraceTree {
    runs: Record<string, {
        run_id: string;
        start_time: string;
        end_time: string;
        duration_ms: number;
        total_cost_usd: number;
        operations: TraceEntry[];
        topLevelOps?: TraceEntry[];
        agents: Record<string, {
            agent_id: string;
            operations: number;
            total_cost_usd: number;
            total_latency_ms: number;
        }>;
        summary: {
            total_operations: number;
            successful_operations: number;
            failed_operations: number;
            components: string[];
        };
    }>;
    global_summary: {
        total_runs: number;
        total_operations: number;
        total_cost_usd: number;
        total_duration_ms: number;
        most_expensive_operation?: TraceEntry;
        slowest_operation?: TraceEntry;
    };
    timeline: Array<{
        timestamp: string;
        event: string;
        run_id?: string;
        component: string;
        details: any;
    }>;
}
interface ExportOptions {
    format: "json" | "csv" | "html";
    includeMetrics: boolean;
    includeTimeline: boolean;
    filterByComponent?: string[];
    filterByRunId?: string[];
    canonicalRunId?: string;
    timeRange?: {
        start: string;
        end: string;
    };
}
interface RenderOptions {
    title: string;
    includeStats: boolean;
    includeTimeline: boolean;
    theme?: "light" | "dark";
}
export declare class ObservabilityExporter {
    exportTrace(runLogsDir: string, options: ExportOptions): Promise<TraceTree>;
    private processLogFile;
    private isTopLevelSpan;
    private computeGlobalSummary;
    private buildTimeline;
    renderHTML(traceData: TraceTree, options: RenderOptions): Promise<string>;
    private renderStats;
    private renderRunDetails;
    private renderTimeline;
}
export {};
//# sourceMappingURL=observability_exporter.d.ts.map