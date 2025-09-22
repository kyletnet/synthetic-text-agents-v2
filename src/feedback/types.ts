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
  file?: string; // path to JSON run record
};

export type PatchCard = {
  id: string;
  applies: boolean;
  selectors?: Record<string, any>;
  score?: number;          // 0..1 confidence from heuristics
  deltas: Record<string, any>;
  evidence: string[];      // short bullets why/where
};

export type FeedbackNote = {
  author: string;          // e.g., "data-curator"
  target: "prompt" | "retriever" | "postprocess";
  positives?: string[];
  issues?: string[];
  suggestions?: string[];
  tags?: string[];
  runRef?: string;         // RUN_LOGS filename
};