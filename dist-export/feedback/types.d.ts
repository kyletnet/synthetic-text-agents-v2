export type RunLog = {
    timestamp: string;
    route: "legacy" | "overlay";
    domain?: string;
    count?: number;
    difficulty?: number;
    audit_score?: number;
    issues?: any[];
    cost_estimate?: number;
    p95?: number;
    file?: string;
};
export type PatchCard = {
    id: string;
    applies: boolean;
    selectors?: Record<string, any>;
    score?: number;
    deltas: Record<string, any>;
    evidence: string[];
};
export type FeedbackNote = {
    author: string;
    target: "prompt" | "retriever" | "postprocess";
    positives?: string[];
    issues?: string[];
    suggestions?: string[];
    tags?: string[];
    runRef?: string;
};
//# sourceMappingURL=types.d.ts.map