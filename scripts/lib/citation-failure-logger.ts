/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Citation Failure Logger
 *
 * Logs citation validation failures for debugging and quality improvement.
 * Helps identify patterns in citation generation issues.
 */

import { writeFileSync, appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

export interface CitationFailureLog {
  timestamp: string;
  qa_id: string;
  question: string;
  answer: string;
  failure_reason:
    | "no_citations"
    | "invalid_structure"
    | "hallucination"
    | "low_quality";
  details: {
    error_messages: string[];
    warning_messages: string[];
    citation_count: number;
    avg_alignment_score?: number;
    citation_coverage?: number;
  };
  evidence_provided: number;
  recovery_attempted?: boolean;
}

const LOG_DIR = "logs/citation-failures";
const LOG_FILE = join(LOG_DIR, "citation-failures.jsonl");

/**
 * Initialize logging directory
 */
function ensureLogDir() {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

/**
 * Log a citation failure
 */
export function logCitationFailure(log: CitationFailureLog): void {
  ensureLogDir();

  const logEntry = JSON.stringify({
    ...log,
    timestamp: log.timestamp || new Date().toISOString(),
  });

  try {
    appendFileSync(LOG_FILE, logEntry + "\n", "utf-8");
  } catch (error) {
    console.error("[citation-failure-logger] Failed to write log:", error);
  }
}

/**
 * Log empty citations (policy violation)
 */
export function logNoCitations(
  qaId: string,
  question: string,
  answer: string,
  evidenceCount: number,
): void {
  logCitationFailure({
    timestamp: new Date().toISOString(),
    qa_id: qaId,
    question: question.substring(0, 200),
    answer: answer.substring(0, 500),
    failure_reason: "no_citations",
    details: {
      error_messages: [
        "No citations generated despite evidence being provided",
      ],
      warning_messages: [
        "LLM may have ignored citation requirements in prompt",
      ],
      citation_count: 0,
    },
    evidence_provided: evidenceCount,
  });
}

/**
 * Log hallucinated citations
 */
export function logHallucinatedCitation(
  qaId: string,
  question: string,
  answer: string,
  hallucinatedSpan: string,
  evidenceCount: number,
): void {
  logCitationFailure({
    timestamp: new Date().toISOString(),
    qa_id: qaId,
    question: question.substring(0, 200),
    answer: answer.substring(0, 500),
    failure_reason: "hallucination",
    details: {
      error_messages: [
        `Hallucinated span: "${hallucinatedSpan.substring(0, 100)}"`,
      ],
      warning_messages: ["Citation span does not exist in answer text"],
      citation_count: 1,
    },
    evidence_provided: evidenceCount,
  });
}

/**
 * Log low quality citations
 */
export function logLowQualityCitations(
  qaId: string,
  question: string,
  answer: string,
  citationCount: number,
  avgAlignmentScore: number,
  citationCoverage: number,
  evidenceCount: number,
): void {
  logCitationFailure({
    timestamp: new Date().toISOString(),
    qa_id: qaId,
    question: question.substring(0, 200),
    answer: answer.substring(0, 500),
    failure_reason: "low_quality",
    details: {
      error_messages: [],
      warning_messages: [
        `Low alignment score: ${avgAlignmentScore.toFixed(3)}`,
        `Low coverage: ${(citationCoverage * 100).toFixed(1)}%`,
      ],
      citation_count: citationCount,
      avg_alignment_score: avgAlignmentScore,
      citation_coverage: citationCoverage,
    },
    evidence_provided: evidenceCount,
  });
}

/**
 * Generate summary report from failure logs
 */
export function generateFailureSummary(): {
  total_failures: number;
  by_reason: Record<string, number>;
  common_patterns: string[];
} {
  ensureLogDir();

  if (!existsSync(LOG_FILE)) {
    return {
      total_failures: 0,
      by_reason: {},
      common_patterns: [],
    };
  }

  const { readFileSync } = require("fs");
  const content = readFileSync(LOG_FILE, "utf-8");
  const lines = content
    .trim()
    .split("\n")
    .filter((l: string) => l.length > 0);

  const failures = lines.map(
    (line: string) => JSON.parse(line) as CitationFailureLog,
  );

  const byReason: Record<string, number> = {};
  failures.forEach((f: CitationFailureLog) => {
    byReason[f.failure_reason] = (byReason[f.failure_reason] || 0) + 1;
  });

  // Identify common patterns
  const patterns: string[] = [];
  const noCitationsCount = byReason["no_citations"] || 0;
  const hallucinationCount = byReason["hallucination"] || 0;
  const lowQualityCount = byReason["low_quality"] || 0;

  if (noCitationsCount > failures.length * 0.3) {
    patterns.push("High rate of missing citations - prompt may be too weak");
  }

  if (hallucinationCount > failures.length * 0.1) {
    patterns.push("Frequent hallucinations - LLM may be fabricating citations");
  }

  if (lowQualityCount > failures.length * 0.4) {
    patterns.push("Low alignment scores - evidence may be poorly matched");
  }

  return {
    total_failures: failures.length,
    by_reason: byReason,
    common_patterns: patterns,
  };
}
