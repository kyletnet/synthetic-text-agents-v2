import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { calculateAllBaselineMetrics } from '../../scripts/metrics/__all__';
import { calculateDuplicationMetrics } from '../../scripts/metrics/duplication_metrics';
import { analyzeQuestionTypeDistribution } from '../../scripts/metrics/qtype_distribution';
import { calculateCoverageMetrics } from '../../scripts/metrics/coverage_metrics';
import { calculateEvidenceQuality } from '../../scripts/metrics/evidence_quality';
import { detectHallucinations } from '../../scripts/metrics/hallucination_rules';
import { scanPiiAndLicense } from '../../scripts/metrics/pii_license_scan';

interface QAItem {
  qa: { q: string; a: string };
  evidence?: string;
  evidence_text?: string;
  source_text?: string;
  index?: number;
  cost_usd?: number;
  latency_ms?: number;
}

describe('Baseline v1.5 Metrics - Regression Tests', () => {
  const testConfigPath = 'tests/regression/test_baseline_config.json';
  const goldStandardPath = 'tests/regression/baseline_v15_gold_standard.json';

  const testConfig = {
    "version": "1.5.0",
    "duplication_metrics": {
      "ngram_range": [3, 4, 5],
      "similarity_thresholds": { "jaccard": 0.7, "cosine": 0.8 },
      "max_pairs_for_llm_judge": 5,
      "budget_caps": { "llm_judge_max_usd": 0.10 },
      "alert_thresholds": { "duplication_rate_max": 0.15, "semantic_duplication_rate_max": 0.20 }
    },
    "qtype_distribution": {
      "patterns": {
        "what": ["what", "무엇", "어떤"],
        "why": ["why", "왜"],
        "how": ["how", "어떻게"]
      },
      "target_distribution": { "what": 0.4, "why": 0.3, "how": 0.3 },
      "alert_thresholds": { "imbalance_score_max": 0.30, "missing_categories_max": 1 }
    },
    "coverage_metrics": {
      "entity_extraction": { "method": "rake", "top_k": 10, "min_phrase_length": 2, "max_phrase_length": 3 },
      "section_mapping": { "min_evidence_length": 10, "section_overlap_threshold": 0.3 },
      "alert_thresholds": { "entity_coverage_rate_min": 0.50, "section_coverage_rate_min": 0.60, "uncovered_important_entities_max": 3 }
    },
    "evidence_quality": {
      "hit_rate": { "required_fields": ["evidence"] },
      "snippet_alignment": { "similarity_method": "cosine", "min_similarity": 0.4, "ngram_overlap_weight": 0.3, "embedding_weight": 0.7 },
      "alert_thresholds": { "evidence_presence_rate_min": 0.70, "snippet_alignment_mean_min": 0.40, "snippet_alignment_p95_min": 0.25 }
    },
    "hallucination_detection": {
      "similarity_threshold": 0.3,
      "min_matching_ngrams": 3,
      "context_window": 2,
      "alert_thresholds": { "hallucination_rate_max": 0.05, "high_risk_cases_max": 2 }
    },
    "pii_license_scan": {
      "pii_patterns": ["\\b\\d{3}-\\d{2}-\\d{4}\\b", "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b"],
      "license_keywords": ["copyright", "proprietary"],
      "alert_thresholds": { "pii_hits_max": 0, "license_risk_hits_max": 1 }
    }
  };

  const testQAItems: QAItem[] = [
    {
      qa: { q: "물이 어떤 상태로 존재하나요?", a: "물은 고체, 액체, 기체 상태로 존재합니다." },
      evidence: "물은 세 가지 상태로 존재할 수 있습니다. 고체 상태인 얼음, 액체 상태인 물, 그리고 기체 상태인 수증기입니다.",
      cost_usd: 0.01,
      latency_ms: 150,
      index: 0
    },
    {
      qa: { q: "왜 물이 얼까요?", a: "온도가 0도 이하로 내려가기 때문입니다." },
      evidence: "물이 얼음으로 변하는 과정을 응고라고 하며, 온도가 0도 이하로 내려갈 때 일어납니다.",
      cost_usd: 0.01,
      latency_ms: 120,
      index: 1
    },
    {
      qa: { q: "어떻게 물이 수증기가 되나요?", a: "가열하면 증발합니다." },
      evidence: "물이 수증기로 변하는 과정을 증발이라고 하며, 물의 표면에서 일어나는 현상입니다.",
      cost_usd: 0.01,
      latency_ms: 180,
      index: 2
    },
    {
      qa: { q: "물의 상태는 무엇인가요?", a: "물은 얼음, 물, 수증기로 존재할 수 있습니다." },
      evidence: "물은 세 가지 상태로 존재할 수 있습니다.",
      cost_usd: 0.01,
      latency_ms: 140,
      index: 3
    }
  ];

  const testSourceTexts = [
    "물은 세 가지 상태로 존재할 수 있습니다. 고체 상태인 얼음, 액체 상태인 물, 그리고 기체 상태인 수증기입니다.",
    "물이 얼음으로 변하는 과정을 응고라고 하며, 온도가 0도 이하로 내려갈 때 일어납니다.",
    "물이 수증기로 변하는 과정을 증발이라고 하며, 물의 표면에서 일어나는 현상입니다."
  ];

  beforeAll(() => {
    // Create test configuration
    writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));
  });

  afterAll(() => {
    // Cleanup test files
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
  });

  describe('Individual Metric Tests', () => {
    it('should calculate duplication metrics correctly', async () => {
      const metrics = await calculateDuplicationMetrics(testQAItems, testConfigPath);

      expect(metrics).toBeDefined();
      expect(metrics.duplication_rate).toBeGreaterThanOrEqual(0);
      expect(metrics.duplication_rate).toBeLessThanOrEqual(1);
      expect(metrics.total_pairs_checked).toBe(6); // 4 items = 6 pairs
      expect(metrics.high_similarity_pairs).toBeGreaterThanOrEqual(0);
      expect(metrics.top_duplicate_pairs).toBeInstanceOf(Array);
      expect(metrics.ngram_distributions).toBeDefined();
      expect(typeof metrics.alert_triggered).toBe('boolean');

      // Test for expected duplication (items 0 and 3 are similar)
      expect(metrics.duplication_rate).toBeGreaterThan(0);
    });

    it('should analyze question type distribution correctly', () => {
      const metrics = analyzeQuestionTypeDistribution(testQAItems, testConfigPath);

      expect(metrics).toBeDefined();
      expect(metrics.distributions).toBeDefined();
      expect(metrics.distributions.what).toBeDefined();
      expect(metrics.distributions.why).toBeDefined();
      expect(metrics.distributions.how).toBeDefined();
      expect(metrics.imbalance_score).toBeGreaterThanOrEqual(0);
      expect(metrics.entropy).toBeGreaterThanOrEqual(0);
      expect(metrics.missing_categories).toBeInstanceOf(Array);
      expect(typeof metrics.alert_triggered).toBe('boolean');

      // Verify each question type is properly detected
      expect(metrics.distributions.what.count).toBeGreaterThan(0);
      expect(metrics.distributions.why.count).toBeGreaterThan(0);
      expect(metrics.distributions.how.count).toBeGreaterThan(0);
    });

    it('should calculate coverage metrics correctly', () => {
      const metrics = calculateCoverageMetrics(testQAItems, testSourceTexts, testConfigPath);

      expect(metrics).toBeDefined();
      expect(metrics.entity_coverage).toBeDefined();
      expect(metrics.section_coverage).toBeDefined();
      expect(metrics.entity_coverage.coverage_rate).toBeGreaterThanOrEqual(0);
      expect(metrics.entity_coverage.coverage_rate).toBeLessThanOrEqual(1);
      expect(metrics.section_coverage.coverage_rate).toBeGreaterThanOrEqual(0);
      expect(metrics.section_coverage.coverage_rate).toBeLessThanOrEqual(1);
      expect(metrics.coverage_summary.overall_score).toBeGreaterThanOrEqual(0);
      expect(metrics.coverage_summary.overall_score).toBeLessThanOrEqual(1);
      expect(typeof metrics.alert_triggered).toBe('boolean');
    });

    it('should assess evidence quality correctly', () => {
      const metrics = calculateEvidenceQuality(testQAItems, testConfigPath);

      expect(metrics).toBeDefined();
      expect(metrics.evidence_presence_rate).toBeGreaterThanOrEqual(0);
      expect(metrics.evidence_presence_rate).toBeLessThanOrEqual(1);
      expect(metrics.total_items).toBe(4);
      expect(metrics.items_with_evidence).toBeGreaterThan(0);
      expect(metrics.snippet_alignment.mean).toBeGreaterThanOrEqual(0);
      expect(metrics.snippet_alignment.mean).toBeLessThanOrEqual(1);
      expect(metrics.snippet_alignment.p95).toBeGreaterThanOrEqual(0);
      expect(metrics.snippet_alignment.p95).toBeLessThanOrEqual(1);
      expect(typeof metrics.alert_triggered).toBe('boolean');

      // All test items have evidence
      expect(metrics.evidence_presence_rate).toBe(1.0);
    });

    it('should detect hallucinations correctly', () => {
      const metrics = detectHallucinations(testQAItems, testConfigPath);

      expect(metrics).toBeDefined();
      expect(metrics.total_items).toBe(4);
      expect(metrics.flagged_items).toBeGreaterThanOrEqual(0);
      expect(metrics.hallucination_rate).toBeGreaterThanOrEqual(0);
      expect(metrics.hallucination_rate).toBeLessThanOrEqual(1);
      expect(metrics.high_risk_count).toBeGreaterThanOrEqual(0);
      expect(metrics.flags).toBeInstanceOf(Array);
      expect(metrics.risk_distribution).toBeDefined();
      expect(typeof metrics.alert_triggered).toBe('boolean');
    });

    it('should scan for PII and license violations correctly', () => {
      const metrics = scanPiiAndLicense(testQAItems, testConfigPath);

      expect(metrics).toBeDefined();
      expect(metrics.total_items_scanned).toBe(4);
      expect(metrics.pii_hits).toBeGreaterThanOrEqual(0);
      expect(metrics.license_risk_hits).toBeGreaterThanOrEqual(0);
      expect(metrics.total_violations).toBeGreaterThanOrEqual(0);
      expect(metrics.matches).toBeInstanceOf(Array);
      expect(metrics.summary).toBeDefined();
      expect(typeof metrics.alert_triggered).toBe('boolean');

      // Test items should be clean
      expect(metrics.pii_hits).toBe(0);
      expect(metrics.license_risk_hits).toBe(0);
    });
  });

  describe('Integration Tests', () => {
    it('should calculate all baseline metrics correctly', async () => {
      const { records, summary } = await calculateAllBaselineMetrics(testQAItems, {
        configPath: testConfigPath,
        sessionId: 'test_regression_001',
        budgetLimit: 0.10,
        sourceTexts: testSourceTexts
      });

      expect(records).toBeDefined();
      expect(records).toHaveLength(4);
      expect(summary).toBeDefined();

      // Validate record structure
      for (const record of records) {
        expect(record.timestamp).toBeDefined();
        expect(record.session_id).toBe('test_regression_001');
        expect(record.qa).toBeDefined();
        expect(record.duplication).toBeDefined();
        expect(record.qtype).toBeDefined();
        expect(record.coverage).toBeDefined();
        expect(record.evidence_quality).toBeDefined();
        expect(record.hallucination).toBeDefined();
        expect(record.pii_license).toBeDefined();
        expect(record.quality_score).toBeGreaterThanOrEqual(0);
        expect(record.quality_score).toBeLessThanOrEqual(1);
        expect(record.alert_flags).toBeInstanceOf(Array);
      }

      // Validate summary structure
      expect(summary.total_items).toBe(4);
      expect(summary.config_version).toBe('1.5.0');
      expect(summary.overall_quality_score).toBeGreaterThanOrEqual(0);
      expect(summary.overall_quality_score).toBeLessThanOrEqual(1);
      expect(summary.recommendation_level).toMatch(/^(green|yellow|red)$/);
      expect(summary.cost_total_usd).toBeGreaterThanOrEqual(0);
      expect(summary.cost_per_item).toBeGreaterThanOrEqual(0);
      expect(summary.total_alerts).toBeGreaterThanOrEqual(0);
    });

    it('should maintain reproducibility within tolerance', async () => {
      const tolerance = 5; // 5% tolerance

      // Run metrics twice with same inputs
      const result1 = await calculateAllBaselineMetrics(testQAItems, {
        configPath: testConfigPath,
        sessionId: 'repro_test_1',
        sourceTexts: testSourceTexts
      });

      const result2 = await calculateAllBaselineMetrics(testQAItems, {
        configPath: testConfigPath,
        sessionId: 'repro_test_2',
        sourceTexts: testSourceTexts
      });

      // Compare key metrics
      const keyMetrics = [
        'overall_quality_score',
        'duplication.rate',
        'evidence_quality.presence_rate',
        'cost_per_item'
      ];

      for (const metricPath of keyMetrics) {
        const value1 = getNestedValue(result1.summary, metricPath);
        const value2 = getNestedValue(result2.summary, metricPath);

        if (value1 !== 0) {
          const deviation = Math.abs(value1 - value2) / value1 * 100;
          expect(deviation).toBeLessThanOrEqual(tolerance);
        }
      }
    });

    it('should trigger alerts correctly based on thresholds', async () => {
      // Create test data that should trigger alerts
      const alertTestItems: QAItem[] = [
        {
          qa: { q: "test@example.com은 무엇인가요?", a: "이메일 주소입니다." },
          index: 0
        },
        {
          qa: { q: "test@example.com은 무엇인가요?", a: "이메일 주소입니다." },
          index: 1
        },
        {
          qa: { q: "copyright 2024", a: "저작권 표시입니다." },
          index: 2
        }
      ];

      const { summary } = await calculateAllBaselineMetrics(alertTestItems, {
        configPath: testConfigPath,
        sessionId: 'alert_test',
        sourceTexts: []
      });

      // Should trigger alerts for PII and duplication
      expect(summary.total_alerts).toBeGreaterThan(0);
      expect(summary.pii_license.alert_triggered || summary.duplication.alert_triggered).toBe(true);
    });
  });

  describe('Performance Tests', () => {
    it('should complete metrics calculation within reasonable time', async () => {
      const startTime = Date.now();

      await calculateAllBaselineMetrics(testQAItems, {
        configPath: testConfigPath,
        sessionId: 'perf_test',
        sourceTexts: testSourceTexts
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should handle larger datasets efficiently', async () => {
      // Create larger test dataset
      const largeTestItems: QAItem[] = [];
      for (let i = 0; i < 50; i++) {
        largeTestItems.push({
          qa: { q: `질문 ${i}번`, a: `답변 ${i}번입니다.` },
          evidence: `근거 텍스트 ${i}번`,
          cost_usd: 0.01,
          latency_ms: 100 + Math.random() * 100,
          index: i
        });
      }

      const startTime = Date.now();
      const { summary } = await calculateAllBaselineMetrics(largeTestItems, {
        configPath: testConfigPath,
        sessionId: 'scale_test',
        sourceTexts: testSourceTexts
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
      expect(summary.total_items).toBe(50);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing configuration gracefully', async () => {
      const invalidConfigPath = 'non_existent_config.json';

      await expect(calculateAllBaselineMetrics(testQAItems, {
        configPath: invalidConfigPath,
        sessionId: 'error_test'
      })).rejects.toThrow();
    });

    it('should handle empty QA items array', async () => {
      const { summary } = await calculateAllBaselineMetrics([], {
        configPath: testConfigPath,
        sessionId: 'empty_test'
      });

      expect(summary.total_items).toBe(0);
      expect(summary.overall_quality_score).toBeGreaterThanOrEqual(0);
    });

    it('should handle malformed QA items', async () => {
      const malformedItems = [
        { qa: { q: "", a: "" }, index: 0 },
        { qa: { q: "Valid question?", a: "Valid answer." }, index: 1 }
      ] as QAItem[];

      const { summary } = await calculateAllBaselineMetrics(malformedItems, {
        configPath: testConfigPath,
        sessionId: 'malformed_test'
      });

      expect(summary.total_items).toBe(2);
      // Should still complete without throwing
    });
  });
});

// Helper function to get nested object values
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}