/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Citation Quality Metrics Calculator
 *
 * Integrates with baseline report generator to provide
 * citation validation and quality metrics.
 */

import {
  validateCitations,
  validateQABatch,
  getCitationQualityGate,
  type Citation,
  type CitationQualityMetrics,
} from "../lib/citation-validator.js";

export interface QAWithCitations {
  qa: { q: string; a: string };
  citations?: Citation[];
  evidence?: string;
  evidence_items?: Array<{ text: string }>;
}

export interface CitationMetricsResult {
  citation_quality: CitationQualityMetrics;
  quality_gate: {
    status: "PASS" | "WARN" | "FAIL";
    reason: string;
  };
  validation_errors: string[];
  validation_warnings: string[];
}

/**
 * Calculate citation metrics for a single QA item
 */
export function calculateCitationMetrics(
  qaItem: QAWithCitations,
): CitationMetricsResult {
  const citations = qaItem.citations || [];
  const evidenceCount = qaItem.evidence_items?.length || 0;

  if (citations.length === 0) {
    return {
      citation_quality: {
        total_citations: 0,
        valid_citations: 0,
        invalid_citations: 0,
        avg_alignment_score: 0,
        citation_coverage: 0,
        has_evidence_idx: 0,
        has_alignment_score: 0,
        has_span: 0,
      },
      quality_gate: {
        status: "FAIL",
        reason: "No citations provided",
      },
      validation_errors: ["No citations found in answer"],
      validation_warnings: [],
    };
  }

  const validation = validateCitations(citations, qaItem.qa.a, evidenceCount);

  const qualityGate = getCitationQualityGate(validation.metrics);

  const allErrors = validation.results.flatMap((r) => r.errors);
  const allWarnings = validation.results.flatMap((r) => r.warnings);

  return {
    citation_quality: validation.metrics,
    quality_gate: qualityGate,
    validation_errors: allErrors,
    validation_warnings: allWarnings,
  };
}

/**
 * Calculate aggregate citation metrics for all QA items
 */
export function calculateAggregateCitationMetrics(qaItems: QAWithCitations[]): {
  total_qa: number;
  valid_qa: number;
  invalid_qa: number;
  aggregate_metrics: CitationQualityMetrics;
  quality_gate: {
    status: "PASS" | "WARN" | "FAIL";
    reason: string;
  };
  per_qa_issues: Array<{
    qa_index: number;
    errors: string[];
    warnings: string[];
  }>;
} {
  const batchValidation = validateQABatch(
    qaItems.map((item) => ({
      qa: item.qa,
      citations: item.citations,
      evidence_count: item.evidence_items?.length || 0,
    })),
  );

  const qualityGate = getCitationQualityGate(batchValidation.aggregate_metrics);

  const perQaIssues = batchValidation.per_qa_results
    .filter((r) => r.errors.length > 0 || r.warnings.length > 0)
    .map((r) => ({
      qa_index: r.qa_index,
      errors: r.errors,
      warnings: r.warnings,
    }));

  return {
    total_qa: batchValidation.total_qa,
    valid_qa: batchValidation.valid_qa,
    invalid_qa: batchValidation.invalid_qa,
    aggregate_metrics: batchValidation.aggregate_metrics,
    quality_gate: qualityGate,
    per_qa_issues: perQaIssues,
  };
}

/**
 * Format citation metrics for display in baseline report
 */
export function formatCitationMetricsForReport(
  metrics: CitationQualityMetrics,
  qualityGate: { status: string; reason: string },
): string[] {
  const lines: string[] = [];

  lines.push("## Citation Quality Metrics");
  lines.push("");
  lines.push("### 📌 Citation Statistics");
  lines.push("");
  lines.push("| Metric | Value | Status |");
  lines.push("|--------|-------|--------|");

  const totalCitations = metrics.total_citations;
  const validPct =
    totalCitations > 0 ? (metrics.valid_citations / totalCitations) * 100 : 0;
  const invalidPct =
    totalCitations > 0 ? (metrics.invalid_citations / totalCitations) * 100 : 0;

  lines.push(`| **Total Citations** | **${totalCitations}** | - |`);
  lines.push(
    `| Valid Citations | ${metrics.valid_citations} (${validPct.toFixed(
      1,
    )}%) | ${validPct >= 80 ? "✅" : validPct >= 60 ? "⚠️" : "❌"} |`,
  );
  lines.push(
    `| Invalid Citations | ${metrics.invalid_citations} (${invalidPct.toFixed(
      1,
    )}%) | ${invalidPct < 10 ? "✅" : invalidPct < 30 ? "⚠️" : "❌"} |`,
  );
  lines.push("");

  lines.push("### 📊 Citation Quality");
  lines.push("");
  lines.push("| Metric | Value | Status |");
  lines.push("|--------|-------|--------|");

  const alignmentScore = metrics.avg_alignment_score;
  const coverage = metrics.citation_coverage * 100;

  lines.push(
    `| **Avg Alignment Score** | **${alignmentScore.toFixed(3)}** | ${
      alignmentScore >= 0.6 ? "✅" : alignmentScore >= 0.4 ? "⚠️" : "❌"
    } |`,
  );
  lines.push(
    `| **Citation Coverage** | **${coverage.toFixed(1)}%** | ${
      coverage >= 60 ? "✅" : coverage >= 40 ? "⚠️" : "❌"
    } |`,
  );
  lines.push(
    `| Evidence Index Coverage | ${(metrics.has_evidence_idx * 100).toFixed(
      1,
    )}% | ${metrics.has_evidence_idx >= 0.8 ? "✅" : "⚠️"} |`,
  );
  lines.push(
    `| Alignment Score Coverage | ${(metrics.has_alignment_score * 100).toFixed(
      1,
    )}% | ${metrics.has_alignment_score >= 0.8 ? "✅" : "⚠️"} |`,
  );
  lines.push(
    `| Span Coverage | ${(metrics.has_span * 100).toFixed(1)}% | ${
      metrics.has_span >= 0.8 ? "✅" : "⚠️"
    } |`,
  );
  lines.push("");

  // Quality gate
  const gateEmoji =
    qualityGate.status === "PASS"
      ? "✅"
      : qualityGate.status === "WARN"
      ? "⚠️"
      : "❌";
  lines.push(`**Quality Gate**: ${gateEmoji} ${qualityGate.status}`);
  lines.push(`**Reason**: ${qualityGate.reason}`);
  lines.push("");

  return lines;
}
