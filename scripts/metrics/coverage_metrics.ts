import { readFileSync } from "fs";

interface CoverageConfig {
  entity_extraction: {
    method: string;
    top_k: number;
    min_phrase_length: number;
    max_phrase_length: number;
  };
  section_mapping: {
    min_evidence_length: number;
    section_overlap_threshold: number;
  };
  alert_thresholds: {
    entity_coverage_rate_min: number;
    section_coverage_rate_min: number;
    uncovered_important_entities_max: number;
  };
}

interface EntityCoverage {
  total_entities: number;
  covered_entities: number;
  coverage_rate: number;
  missed_entities: string[];
  entity_frequency: Record<string, number>;
}

interface SectionCoverage {
  total_sections: number;
  covered_sections: number;
  coverage_rate: number;
  section_histogram: Record<string, number>;
  uncovered_sections: string[];
}

interface CoverageMetrics {
  entity_coverage: EntityCoverage;
  section_coverage: SectionCoverage;
  alert_triggered: boolean;
  coverage_summary: {
    overall_score: number;
    critical_gaps: string[];
  };
}

interface QAItem {
  qa: {
    q: string;
    a: string;
  };
  evidence?: string;
  evidence_idx?: number;
  source_text?: string;
  index?: number;
}

/**
 * Simple RAKE-inspired keyword extraction
 */
function extractKeyPhrases(
  text: string,
  minLength: number,
  maxLength: number,
): string[] {
  // Normalize text
  const normalized = text
    .toLowerCase()
    .replace(/[^\w\s가-힣]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = normalized.split(" ").filter((word) => word.length > 1);
  const phrases: string[] = [];

  // Extract n-gram phrases
  for (let n = minLength; n <= maxLength; n++) {
    for (let i = 0; i <= words.length - n; i++) {
      const phrase = words.slice(i, i + n).join(" ");
      if (phrase.length > 3) {
        // Minimum phrase length
        phrases.push(phrase);
      }
    }
  }

  // Score phrases by frequency and return top ones
  const phraseFreq = new Map<string, number>();
  phrases.forEach((phrase) => {
    phraseFreq.set(phrase, (phraseFreq.get(phrase) || 0) + 1);
  });

  return Array.from(phraseFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([phrase]) => phrase);
}

/**
 * Extract entities from source documents
 */
function extractSourceEntities(
  sourceTexts: string[],
  config: CoverageConfig,
): { entities: string[]; frequency: Record<string, number> } {
  const allEntities = new Set<string>();
  const frequency: Record<string, number> = {};

  for (const text of sourceTexts) {
    const phrases = extractKeyPhrases(
      text,
      config.entity_extraction.min_phrase_length,
      config.entity_extraction.max_phrase_length,
    );

    // Take top K phrases as entities
    const entities = phrases.slice(0, config.entity_extraction.top_k);

    entities.forEach((entity) => {
      allEntities.add(entity);
      frequency[entity] = (frequency[entity] || 0) + 1;
    });
  }

  // Return most frequent entities
  const sortedEntities = Array.from(allEntities).sort(
    (a, b) => (frequency[b] || 0) - (frequency[a] || 0),
  );

  return {
    entities: sortedEntities,
    frequency,
  };
}

/**
 * Check if an entity is covered in QA items
 */
function isEntityCovered(entity: string, qaItems: QAItem[]): boolean {
  const entityLower = entity.toLowerCase();

  for (const item of qaItems) {
    const questionText = item.qa.q.toLowerCase();
    const answerText = item.qa.a.toLowerCase();

    if (
      questionText.includes(entityLower) ||
      answerText.includes(entityLower)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Analyze entity coverage
 */
function analyzeEntityCoverage(
  qaItems: QAItem[],
  sourceTexts: string[],
  config: CoverageConfig,
): EntityCoverage {
  const { entities, frequency } = extractSourceEntities(sourceTexts, config);

  let coveredCount = 0;
  const missedEntities: string[] = [];

  for (const entity of entities) {
    if (isEntityCovered(entity, qaItems)) {
      coveredCount++;
    } else {
      missedEntities.push(entity);
    }
  }

  const coverageRate = entities.length > 0 ? coveredCount / entities.length : 0;

  return {
    total_entities: entities.length,
    covered_entities: coveredCount,
    coverage_rate: coverageRate,
    missed_entities: missedEntities.slice(0, 10), // Limit for reporting
    entity_frequency: frequency,
  };
}

/**
 * Create mock sections from source text (simple paragraph splitting)
 */
function createSections(sourceTexts: string[]): string[] {
  const sections: string[] = [];

  for (const text of sourceTexts) {
    // Split by double newlines or sentences ending with periods
    const paragraphs = text
      .split(/\n\n|\. /)
      .filter((p) => p.trim().length > 10);

    sections.push(...paragraphs);
  }

  return sections;
}

/**
 * Check if a section is covered by evidence
 */
function isSectionCovered(
  section: string,
  qaItems: QAItem[],
  overlapThreshold: number,
): boolean {
  const sectionWords = new Set(
    section
      .toLowerCase()
      .replace(/[^\w\s가-힣]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1),
  );

  for (const item of qaItems) {
    if (item.evidence) {
      const evidenceWords = new Set(
        item.evidence
          .toLowerCase()
          .replace(/[^\w\s가-힣]/g, " ")
          .split(/\s+/)
          .filter((w) => w.length > 1),
      );

      // Calculate overlap
      const intersection = new Set(
        [...sectionWords].filter((w) => evidenceWords.has(w)),
      );
      const overlap =
        intersection.size / Math.min(sectionWords.size, evidenceWords.size);

      if (overlap >= overlapThreshold) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Analyze section coverage
 */
function analyzeSectionCoverage(
  qaItems: QAItem[],
  sourceTexts: string[],
  config: CoverageConfig,
): SectionCoverage {
  const sections = createSections(sourceTexts);
  let coveredCount = 0;
  const uncoveredSections: string[] = [];
  const sectionHistogram: Record<string, number> = {};

  for (const section of sections) {
    const sectionKey = `Section_${section.substring(0, 20)}...`;
    sectionHistogram[sectionKey] = section.length;

    if (
      isSectionCovered(
        section,
        qaItems,
        config.section_mapping.section_overlap_threshold,
      )
    ) {
      coveredCount++;
    } else {
      uncoveredSections.push(sectionKey);
    }
  }

  const coverageRate = sections.length > 0 ? coveredCount / sections.length : 0;

  return {
    total_sections: sections.length,
    covered_sections: coveredCount,
    coverage_rate: coverageRate,
    section_histogram: sectionHistogram,
    uncovered_sections: uncoveredSections.slice(0, 10), // Limit for reporting
  };
}

/**
 * Calculate overall coverage metrics
 */
export function calculateCoverageMetrics(
  qaItems: QAItem[],
  sourceTexts: string[],
  configPath: string = "baseline_config.json",
): CoverageMetrics {
  // Load configuration
  const configText = readFileSync(configPath, "utf-8");
  const fullConfig = JSON.parse(configText);
  const config: CoverageConfig = fullConfig.coverage_metrics;

  // Analyze entity and section coverage
  const entityCoverage = analyzeEntityCoverage(qaItems, sourceTexts, config);
  const sectionCoverage = analyzeSectionCoverage(qaItems, sourceTexts, config);

  // Calculate overall score (weighted average)
  const overallScore =
    entityCoverage.coverage_rate * 0.6 + sectionCoverage.coverage_rate * 0.4;

  // Identify critical gaps
  const criticalGaps: string[] = [];
  if (
    entityCoverage.coverage_rate <
    config.alert_thresholds.entity_coverage_rate_min
  ) {
    criticalGaps.push(
      `Low entity coverage: ${(entityCoverage.coverage_rate * 100).toFixed(1)}%`,
    );
  }
  if (
    sectionCoverage.coverage_rate <
    config.alert_thresholds.section_coverage_rate_min
  ) {
    criticalGaps.push(
      `Low section coverage: ${(sectionCoverage.coverage_rate * 100).toFixed(1)}%`,
    );
  }
  if (
    entityCoverage.missed_entities.length >
    config.alert_thresholds.uncovered_important_entities_max
  ) {
    criticalGaps.push(
      `Too many uncovered entities: ${entityCoverage.missed_entities.length}`,
    );
  }

  // Check alert conditions
  const alertTriggered = criticalGaps.length > 0;

  return {
    entity_coverage: entityCoverage,
    section_coverage: sectionCoverage,
    alert_triggered: alertTriggered,
    coverage_summary: {
      overall_score: overallScore,
      critical_gaps: criticalGaps,
    },
  };
}

/**
 * Generate coverage report
 */
export function generateCoverageReport(metrics: CoverageMetrics): string {
  const lines: string[] = [];

  lines.push("## Coverage Analysis");
  lines.push("");

  // Summary metrics
  lines.push("### Overall Coverage Summary");
  lines.push(
    `- **Overall Score**: ${(metrics.coverage_summary.overall_score * 100).toFixed(1)}%`,
  );
  lines.push(
    `- **Alert Status**: ${metrics.alert_triggered ? "⚠️ ISSUES DETECTED" : "✅ NORMAL"}`,
  );
  lines.push("");

  // Entity coverage
  lines.push("### Entity Coverage");
  lines.push(`- **Total Entities**: ${metrics.entity_coverage.total_entities}`);
  lines.push(
    `- **Covered Entities**: ${metrics.entity_coverage.covered_entities}`,
  );
  lines.push(
    `- **Coverage Rate**: ${(metrics.entity_coverage.coverage_rate * 100).toFixed(1)}%`,
  );

  if (metrics.entity_coverage.missed_entities.length > 0) {
    lines.push("- **Top Missed Entities**:");
    metrics.entity_coverage.missed_entities.slice(0, 5).forEach((entity) => {
      lines.push(`  - ${entity}`);
    });
  }
  lines.push("");

  // Section coverage
  lines.push("### Section Coverage");
  lines.push(
    `- **Total Sections**: ${metrics.section_coverage.total_sections}`,
  );
  lines.push(
    `- **Covered Sections**: ${metrics.section_coverage.covered_sections}`,
  );
  lines.push(
    `- **Coverage Rate**: ${(metrics.section_coverage.coverage_rate * 100).toFixed(1)}%`,
  );
  lines.push("");

  // Critical gaps
  if (metrics.coverage_summary.critical_gaps.length > 0) {
    lines.push("### Critical Gaps");
    metrics.coverage_summary.critical_gaps.forEach((gap) => {
      lines.push(`- ⚠️ ${gap}`);
    });
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * CLI entry point for testing
 */
if (require.main === module) {
  // Test with sample data
  const sampleQA: QAItem[] = [
    {
      qa: {
        q: "물이 어떤 상태로 존재하나요?",
        a: "물은 고체, 액체, 기체 상태로 존재합니다.",
      },
      evidence:
        "물은 세 가지 상태로 존재할 수 있습니다. 고체 상태인 얼음, 액체 상태인 물, 그리고 기체 상태인 수증기입니다.",
      index: 0,
    },
    {
      qa: {
        q: "식물은 어떻게 자라나요?",
        a: "식물은 뿌리로 물을 흡수하고 잎으로 광합성을 합니다.",
      },
      evidence: "식물은 뿌리로 물을 흡수하고 잎으로 광합성을 합니다.",
      index: 1,
    },
  ];

  const sampleSourceTexts = [
    "물은 세 가지 상태로 존재할 수 있습니다. 고체 상태인 얼음, 액체 상태인 물, 그리고 기체 상태인 수증기입니다.",
    "물이 얼음으로 변하는 과정을 응고라고 하며, 온도가 0도 이하로 내려갈 때 일어납니다.",
    "식물은 뿌리로 물을 흡수하고 잎으로 광합성을 합니다. 동물은 먹이를 먹고 소화시켜 에너지를 얻습니다.",
  ];

  try {
    const metrics = calculateCoverageMetrics(sampleQA, sampleSourceTexts);
    console.log("Coverage Metrics:");
    console.log(JSON.stringify(metrics, null, 2));
    console.log("\nReport:");
    console.log(generateCoverageReport(metrics));
  } catch (error) {
    console.error("Error calculating coverage metrics:", error);
  }
}
