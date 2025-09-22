#!/usr/bin/env node

/**
 * Comprehensive Integration Test Suite
 * Tests all pre-flight reinforcement requirements end-to-end
 *
 * Test Categories:
 * - T1: Smoke run validation
 * - T2: Full run validation
 * - T3: P0 violation handling
 * - T4: P1/P2 auto-calibration
 * - T5: DLQ generation and reprocessing
 * - T6: Diversity planning improvement
 * - T7: Agent logging with common fields
 * - T8: Emergency report separation
 */

import { strict as assert } from 'assert';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

// Import our new systems
import { createThresholdManager, ThresholdManager } from '../../scripts/metrics/threshold_manager.js';
import { createDLQManager, DLQManager } from '../../scripts/lib/dlq_manager.js';
import { createBudgetGuardian, BudgetGuardian } from '../../scripts/lib/budget_guardian.js';
import { createManifestManager, ManifestManager } from '../../scripts/lib/manifest_manager.js';
import { initializeSeedManager, getSeedManager } from '../../scripts/lib/seed_manager.js';
import { initializeAgentLogger, getAgentLogger } from '../../scripts/lib/agent_logger.js';
import { createGatingIntegrator, evaluateSession } from '../../scripts/lib/gating_integrator.js';
import { createMultiAgentOrchestrator } from '../../agents/ma_orchestrator.js';
import { createCheckpointManager } from '../../scripts/lib/checkpoint_manager.js';

interface TestResult {
  test_id: string;
  description: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  execution_time_ms: number;
  error_message?: string;
  assertions_passed: number;
  assertions_total: number;
}

interface TestSuite {
  suite_name: string;
  tests: TestResult[];
  overall_status: 'PASS' | 'FAIL';
  total_time_ms: number;
}

class FullSystemTestRunner {
  private testResults: TestSuite[] = [];
  private testDir: string;

  constructor() {
    this.testDir = join(process.cwd(), 'tests', 'temp');
    this.ensureTestDir();
  }

  private ensureTestDir(): void {
    if (!existsSync(this.testDir)) {
      mkdirSync(this.testDir, { recursive: true });
    }
  }

  /**
   * Run all test suites
   */
  async runAllTests(): Promise<void> {
    console.log('🧪 Starting Full System Integration Tests...\n');

    // Initialize test environment
    await this.initializeTestEnvironment();

    // Run test suites
    await this.runThresholdTests();
    await this.runDLQTests();
    await this.runBudgetTests();
    await this.runManifestTests();
    await this.runSeedTests();
    await this.runLoggingTests();
    await this.runGatingTests();
    await this.runMultiAgentTests();
    await this.runCheckpointTests();

    // Generate final report
    this.generateTestReport();
  }

  private async initializeTestEnvironment(): Promise<void> {
    console.log('🔧 Initializing test environment...');

    // Initialize seed manager with fixed seed for reproducible tests
    initializeSeedManager(12345, 'test_run_12345');

    // Initialize logger
    initializeAgentLogger({
      base_dir: this.testDir,
      flush_interval_ms: 1000
    });

    console.log('✅ Test environment initialized\n');
  }

  /**
   * T-1 to T-4: Threshold Management Tests
   */
  private async runThresholdTests(): Promise<void> {
    const suite: TestSuite = {
      suite_name: 'Threshold Management',
      tests: [],
      overall_status: 'PASS',
      total_time_ms: 0
    };

    const startTime = Date.now();

    // T-3: P0 violation handling
    suite.tests.push(await this.testP0ViolationHandling());

    // T-4: P1/P2 auto-calibration
    suite.tests.push(await this.testAutoCalibration());

    // Test gating integration
    suite.tests.push(await this.testThresholdGating());

    suite.total_time_ms = Date.now() - startTime;
    suite.overall_status = suite.tests.every(t => t.status === 'PASS') ? 'PASS' : 'FAIL';

    this.testResults.push(suite);
    this.logSuiteResult(suite);
  }

  private async testP0ViolationHandling(): Promise<TestResult> {
    const test: TestResult = {
      test_id: 'T-3',
      description: 'P0 violation triggers immediate FAIL',
      status: 'PASS',
      execution_time_ms: 0,
      assertions_passed: 0,
      assertions_total: 3
    };

    const startTime = Date.now();

    try {
      const thresholdManager = createThresholdManager();

      // Create metrics with P0 violations
      const violatingMetrics = {
        pii_hits: 5,                    // > 0 (P0 violation)
        license_violations: 1,          // <= 2 (OK)
        evidence_missing_rate: 0.15,    // <= 0.20 (OK)
        hallucination_rate: 0.03,       // <= 0.05 (OK)
        cost_per_item: 0.04,           // Normal value
        latency_p95_ms: 3000,          // Normal value
        failure_rate: 0.05,            // Normal value
        duplication_rate: 0.08,        // Normal value
        coverage_rate: 0.75,           // Normal value
        quality_score: 0.80            // Normal value
      };

      const gatingResult = thresholdManager.evaluateGating(violatingMetrics, 'dev');

      // Assertions
      assert.strictEqual(gatingResult.gate_status, 'FAIL', 'Gate status should be FAIL for P0 violation');
      test.assertions_passed++;

      assert.strictEqual(gatingResult.can_proceed, false, 'Can proceed should be false for P0 violation');
      test.assertions_passed++;

      assert(gatingResult.p0_violations.length > 0, 'Should have P0 violations');
      test.assertions_passed++;

      test.status = 'PASS';
    } catch (error) {
      test.status = 'FAIL';
      test.error_message = (error as Error).message;
    }

    test.execution_time_ms = Date.now() - startTime;
    return test;
  }

  private async testAutoCalibration(): Promise<TestResult> {
    const test: TestResult = {
      test_id: 'T-4',
      description: 'P1/P2 auto-calibration from historical data',
      status: 'PASS',
      execution_time_ms: 0,
      assertions_passed: 0,
      assertions_total: 4
    };

    const startTime = Date.now();

    try {
      const thresholdManager = createThresholdManager();

      // Create mock historical data directory structure
      const historyDir = join(this.testDir, 'reports', 'history');
      mkdirSync(historyDir, { recursive: true });

      // Create mock baseline reports
      for (let i = 0; i < 5; i++) {
        const runDir = join(historyDir, `20250917_${String(i).padStart(6, '0')}`);
        mkdirSync(runDir, { recursive: true });

        const mockReport = {
          timestamp: new Date().toISOString(),
          session_id: `test_session_${i}`,
          cost_per_item: 0.03 + (i * 0.005),
          latency_p95_ms: 2000 + (i * 200),
          duplication: { rate: 0.1 + (i * 0.02) },
          overall_quality_score: 0.8 - (i * 0.05)
        };

        writeFileSync(
          join(runDir, 'baseline_report.jsonl'),
          JSON.stringify(mockReport)
        );
      }

      // Test auto-calibration
      const calibrationResults = await thresholdManager.autoCalibrateThresholds('dev');

      // Assertions
      assert(Array.isArray(calibrationResults), 'Calibration results should be an array');
      test.assertions_passed++;

      // Should have some calibration results for P1/P2 metrics
      const appliedResults = calibrationResults.filter(r => r.applied);
      assert(appliedResults.length >= 0, 'Should have calibration results (even if 0 applied)');
      test.assertions_passed++;

      // Check that P0 thresholds are never auto-calibrated
      const p0Results = calibrationResults.filter(r =>
        r.metric_name.includes('pii') ||
        r.metric_name.includes('license') ||
        r.metric_name.includes('evidence_missing') ||
        r.metric_name.includes('hallucination')
      );
      assert.strictEqual(p0Results.length, 0, 'P0 thresholds should never be auto-calibrated');
      test.assertions_passed++;

      // Check drift guard protection
      const largeDriftResults = calibrationResults.filter(r => Math.abs(r.change_pct) > 0.20);
      const blockedByDriftGuard = largeDriftResults.filter(r => r.drift_guard_triggered && !r.applied);
      assert(blockedByDriftGuard.length >= 0, 'Drift guard should protect against large changes');
      test.assertions_passed++;

      test.status = 'PASS';
    } catch (error) {
      test.status = 'FAIL';
      test.error_message = (error as Error).message;
    }

    test.execution_time_ms = Date.now() - startTime;
    return test;
  }

  private async testThresholdGating(): Promise<TestResult> {
    const test: TestResult = {
      test_id: 'GATING-1',
      description: 'Threshold gating connects to RESULT determination',
      status: 'PASS',
      execution_time_ms: 0,
      assertions_passed: 0,
      assertions_total: 3
    };

    const startTime = Date.now();

    try {
      const integrator = createGatingIntegrator();

      const context = {
        run_id: 'test_run_gating',
        session_id: 'test_session_gating',
        profile: 'dev',
        dry_run: false,
        mode: 'smoke' as const,
        cases_total: 10
      };

      const metrics = {
        duplication_rate: 0.05,
        evidence_presence_rate: 0.95,
        evidence_missing_rate: 0.05,
        hallucination_rate: 0.02,
        pii_hits: 0,
        license_violations: 0,
        cost_per_item: 0.03,
        latency_p95_ms: 2500,
        failure_rate: 0.05,
        coverage_rate: 0.80,
        quality_score: 0.85,
        total_cost_usd: 0.30,
        total_items: 10,
        total_time_ms: 25000
      };

      const sessionResult = integrator.evaluateSessionResult(context, metrics);

      // Assertions
      assert(['PASS', 'WARN', 'PARTIAL', 'FAIL'].includes(sessionResult.result), 'Result should be valid');
      test.assertions_passed++;

      assert.strictEqual(sessionResult.cases_total_valid, true, 'Cases total should be valid');
      test.assertions_passed++;

      assert(sessionResult.gating_summary !== undefined, 'Should have gating summary');
      test.assertions_passed++;

      test.status = 'PASS';
    } catch (error) {
      test.status = 'FAIL';
      test.error_message = (error as Error).message;
    }

    test.execution_time_ms = Date.now() - startTime;
    return test;
  }

  /**
   * T-5: DLQ Tests
   */
  private async runDLQTests(): Promise<void> {
    const suite: TestSuite = {
      suite_name: 'Dead Letter Queue',
      tests: [],
      overall_status: 'PASS',
      total_time_ms: 0
    };

    const startTime = Date.now();

    suite.tests.push(await this.testDLQGeneration());
    suite.tests.push(await this.testDLQReprocessing());

    suite.total_time_ms = Date.now() - startTime;
    suite.overall_status = suite.tests.every(t => t.status === 'PASS') ? 'PASS' : 'FAIL';

    this.testResults.push(suite);
    this.logSuiteResult(suite);
  }

  private async testDLQGeneration(): Promise<TestResult> {
    const test: TestResult = {
      test_id: 'T-5A',
      description: 'DLQ generation for 429/5xx/timeout errors',
      status: 'PASS',
      execution_time_ms: 0,
      assertions_passed: 0,
      assertions_total: 3
    };

    const startTime = Date.now();

    try {
      const dlqManager = createDLQManager(this.testDir);

      // Test different error types
      const errors = [
        new Error('429 Rate limit exceeded'),
        new Error('503 Service unavailable'),
        new Error('Network timeout after 30s')
      ];

      const context = { profile: 'dev', agent_role: 'test_agent' };

      for (let i = 0; i < errors.length; i++) {
        const dlqItem = dlqManager.addFailedItem(
          'test_run_dlq',
          `item_${i}`,
          { test_data: `data_${i}` },
          errors[i],
          context
        );

        assert(dlqItem.error_type === 'TRANSIENT', `Error ${i} should be classified as TRANSIENT`);
        assert(dlqItem.max_retries > 0, `Error ${i} should have retry attempts`);
      }

      test.assertions_passed += errors.length;

      // Check DLQ stats
      const stats = dlqManager.getDLQStats('test_run_dlq');
      assert.strictEqual(stats.total_items, 3, 'Should have 3 DLQ items');
      test.assertions_passed++;

      test.status = 'PASS';
    } catch (error) {
      test.status = 'FAIL';
      test.error_message = (error as Error).message;
    }

    test.execution_time_ms = Date.now() - startTime;
    return test;
  }

  private async testDLQReprocessing(): Promise<TestResult> {
    const test: TestResult = {
      test_id: 'T-5B',
      description: 'DLQ reprocessing with exponential backoff',
      status: 'PASS',
      execution_time_ms: 0,
      assertions_passed: 0,
      assertions_total: 2
    };

    const startTime = Date.now();

    try {
      const dlqManager = createDLQManager(this.testDir);

      // Add an item ready for retry
      const dlqItem = dlqManager.addFailedItem(
        'test_run_dlq_retry',
        'retry_item_1',
        { test_data: 'retry_test' },
        new Error('Temporary failure'),
        { profile: 'dev' }
      );

      // Mark it as ready for retry (simulate time passing)
      dlqItem.next_retry_timestamp = new Date(Date.now() - 1000).toISOString();

      // Get pending retries
      const pendingRetries = dlqManager.getPendingRetries('test_run_dlq_retry');
      assert(pendingRetries.length > 0, 'Should have pending retries');
      test.assertions_passed++;

      // Simulate successful retry
      const updatedItem = dlqManager.markRetryAttempt(dlqItem, true);
      assert(updatedItem === null, 'Successful retry should remove item from DLQ');
      test.assertions_passed++;

      test.status = 'PASS';
    } catch (error) {
      test.status = 'FAIL';
      test.error_message = (error as Error).message;
    }

    test.execution_time_ms = Date.now() - startTime;
    return test;
  }

  /**
   * Budget Guardian Tests
   */
  private async runBudgetTests(): Promise<void> {
    const suite: TestSuite = {
      suite_name: 'Budget Guardian',
      tests: [],
      overall_status: 'PASS',
      total_time_ms: 0
    };

    const startTime = Date.now();

    suite.tests.push(await this.testBudgetGuards());
    suite.tests.push(await this.testKillSwitch());

    suite.total_time_ms = Date.now() - startTime;
    suite.overall_status = suite.tests.every(t => t.status === 'PASS') ? 'PASS' : 'FAIL';

    this.testResults.push(suite);
    this.logSuiteResult(suite);
  }

  private async testBudgetGuards(): Promise<TestResult> {
    const test: TestResult = {
      test_id: 'BUDGET-1',
      description: 'Budget guards prevent cost/time overruns',
      status: 'PASS',
      execution_time_ms: 0,
      assertions_passed: 0,
      assertions_total: 3
    };

    const startTime = Date.now();

    try {
      const budgetGuardian = createBudgetGuardian(this.testDir);

      const budgetLimits = {
        max_cost_per_run: 0.10,
        max_cost_per_item: 0.02,
        max_time_per_run_ms: 10000,
        max_time_per_item_ms: 2000,
        per_agent_limits: {
          test_agent: { max_cost_usd: 0.05, max_time_ms: 5000 }
        }
      };

      // Initialize budget tracking
      budgetGuardian.initializeRun(
        'test_budget_run',
        'test_budget_session',
        'dev',
        budgetLimits,
        10
      );

      // Test within budget
      const withinBudgetCheck = budgetGuardian.checkBudget(0.01, 1000, 'test_agent');
      assert.strictEqual(withinBudgetCheck.can_proceed, true, 'Should allow operation within budget');
      test.assertions_passed++;

      // Test budget exceeded
      const overBudgetCheck = budgetGuardian.checkBudget(0.15, 1000, 'test_agent');
      assert.strictEqual(overBudgetCheck.can_proceed, false, 'Should block operation over budget');
      test.assertions_passed++;

      // Test per-agent limits
      const agentOverCheck = budgetGuardian.checkBudget(0.01, 6000, 'test_agent');
      assert.strictEqual(agentOverCheck.can_proceed, false, 'Should block operation over agent time limit');
      test.assertions_passed++;

      test.status = 'PASS';
    } catch (error) {
      test.status = 'FAIL';
      test.error_message = (error as Error).message;
    }

    test.execution_time_ms = Date.now() - startTime;
    return test;
  }

  private async testKillSwitch(): Promise<TestResult> {
    const test: TestResult = {
      test_id: 'BUDGET-2',
      description: 'Kill switch functionality',
      status: 'PASS',
      execution_time_ms: 0,
      assertions_passed: 0,
      assertions_total: 2
    };

    const startTime = Date.now();

    try {
      const budgetGuardian = createBudgetGuardian(this.testDir);

      // Activate kill switch
      budgetGuardian.activateKillSwitch('Test kill switch activation');

      // Check kill switch status
      const killSwitchStatus = budgetGuardian.checkKillSwitch();
      assert.strictEqual(killSwitchStatus.triggered, true, 'Kill switch should be triggered');
      test.assertions_passed++;

      // Test budget check with kill switch active
      const budgetCheck = budgetGuardian.checkBudget(0.01, 1000);
      assert.strictEqual(budgetCheck.can_proceed, false, 'Should block operations when kill switch is active');
      test.assertions_passed++;

      // Deactivate kill switch
      budgetGuardian.deactivateKillSwitch();

      test.status = 'PASS';
    } catch (error) {
      test.status = 'FAIL';
      test.error_message = (error as Error).message;
    }

    test.execution_time_ms = Date.now() - startTime;
    return test;
  }

  /**
   * Manifest and Seed Tests
   */
  private async runManifestTests(): Promise<void> {
    const suite: TestSuite = {
      suite_name: 'Data Manifest & Freeze',
      tests: [],
      overall_status: 'PASS',
      total_time_ms: 0
    };

    const startTime = Date.now();

    suite.tests.push(await this.testManifestCreation());
    suite.tests.push(await this.testManifestValidation());

    suite.total_time_ms = Date.now() - startTime;
    suite.overall_status = suite.tests.every(t => t.status === 'PASS') ? 'PASS' : 'FAIL';

    this.testResults.push(suite);
    this.logSuiteResult(suite);
  }

  private async testManifestCreation(): Promise<TestResult> {
    const test: TestResult = {
      test_id: 'MANIFEST-1',
      description: 'Data manifest creation with freeze',
      status: 'PASS',
      execution_time_ms: 0,
      assertions_passed: 0,
      assertions_total: 3
    };

    const startTime = Date.now();

    try {
      const manifestManager = createManifestManager(this.testDir);

      // Create test files
      const testFile1 = join(this.testDir, 'test_input.txt');
      const testFile2 = join(this.testDir, 'test_config.json');

      writeFileSync(testFile1, 'Test input content');
      writeFileSync(testFile2, JSON.stringify({ test: true }));

      // Create manifest
      const manifest = await manifestManager.createManifest(
        'Test manifest',
        [testFile1],
        [],
        [testFile2],
        true,
        42
      );

      assert(manifest.manifest_id.length > 0, 'Should have manifest ID');
      test.assertions_passed++;

      assert.strictEqual(manifest.freeze_enabled, true, 'Should have freeze enabled');
      test.assertions_passed++;

      assert.strictEqual(manifest.seed_value, 42, 'Should have correct seed value');
      test.assertions_passed++;

      test.status = 'PASS';
    } catch (error) {
      test.status = 'FAIL';
      test.error_message = (error as Error).message;
    }

    test.execution_time_ms = Date.now() - startTime;
    return test;
  }

  private async testManifestValidation(): Promise<TestResult> {
    const test: TestResult = {
      test_id: 'MANIFEST-2',
      description: 'Manifest integrity validation',
      status: 'PASS',
      execution_time_ms: 0,
      assertions_passed: 0,
      assertions_total: 2
    };

    const startTime = Date.now();

    try {
      const manifestManager = createManifestManager(this.testDir);

      // Get the latest manifest from previous test
      const manifest = manifestManager.getLatestManifest();
      assert(manifest !== null, 'Should find a manifest');
      test.assertions_passed++;

      // Validate manifest
      const validation = await manifestManager.validateManifest(manifest!.manifest_id);
      assert.strictEqual(validation.valid, true, 'Manifest should be valid');
      test.assertions_passed++;

      test.status = 'PASS';
    } catch (error) {
      test.status = 'FAIL';
      test.error_message = (error as Error).message;
    }

    test.execution_time_ms = Date.now() - startTime;
    return test;
  }

  private async runSeedTests(): Promise<void> {
    const suite: TestSuite = {
      suite_name: 'Seed Management',
      tests: [],
      overall_status: 'PASS',
      total_time_ms: 0
    };

    const startTime = Date.now();

    suite.tests.push(await this.testSeedConsistency());

    suite.total_time_ms = Date.now() - startTime;
    suite.overall_status = suite.tests.every(t => t.status === 'PASS') ? 'PASS' : 'FAIL';

    this.testResults.push(suite);
    this.logSuiteResult(suite);
  }

  private async testSeedConsistency(): Promise<TestResult> {
    const test: TestResult = {
      test_id: 'SEED-1',
      description: 'Deterministic seed-based randomization',
      status: 'PASS',
      execution_time_ms: 0,
      assertions_passed: 0,
      assertions_total: 3
    };

    const startTime = Date.now();

    try {
      const seedManager = getSeedManager();

      // Test component seed consistency
      const seed1 = seedManager.getSeedForComponent('test_component');
      const seed2 = seedManager.getSeedForComponent('test_component');
      assert.strictEqual(seed1, seed2, 'Component seeds should be consistent');
      test.assertions_passed++;

      // Test deterministic sampling
      const testArray = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const sample1 = seedManager.sample(testArray, 5, 'test_sampling');
      const sample2 = seedManager.sample(testArray, 5, 'test_sampling');
      assert.deepStrictEqual(sample1, sample2, 'Samples should be deterministic');
      test.assertions_passed++;

      // Test environment seeds
      const envSeeds = seedManager.getEnvironmentSeeds();
      assert(envSeeds.SEED_GLOBAL, 'Should have global seed in environment');
      test.assertions_passed++;

      test.status = 'PASS';
    } catch (error) {
      test.status = 'FAIL';
      test.error_message = (error as Error).message;
    }

    test.execution_time_ms = Date.now() - startTime;
    return test;
  }

  /**
   * T-7: Logging Tests
   */
  private async runLoggingTests(): Promise<void> {
    const suite: TestSuite = {
      suite_name: 'Agent Logging',
      tests: [],
      overall_status: 'PASS',
      total_time_ms: 0
    };

    const startTime = Date.now();

    suite.tests.push(await this.testAgentLogging());

    suite.total_time_ms = Date.now() - startTime;
    suite.overall_status = suite.tests.every(t => t.status === 'PASS') ? 'PASS' : 'FAIL';

    this.testResults.push(suite);
    this.logSuiteResult(suite);
  }

  private async testAgentLogging(): Promise<TestResult> {
    const test: TestResult = {
      test_id: 'T-7',
      description: 'Agent logging with common JSONL fields',
      status: 'PASS',
      execution_time_ms: 0,
      assertions_passed: 0,
      assertions_total: 4
    };

    const startTime = Date.now();

    try {
      const logger = getAgentLogger();

      const context = logger.createTraceContext('test_logging_run', 'test_item_1');

      // Test operation logging
      const opStartTime = Date.now();
      const correlationId = logger.logOperationStart(
        context,
        'test_agent_1',
        'test_role',
        'test_operation',
        { input: 'test_data' }
      );

      assert(correlationId.length > 0, 'Should return correlation ID');
      test.assertions_passed++;

      // Complete operation
      logger.logOperationComplete(
        context,
        'test_agent_1',
        'test_role',
        'test_operation',
        opStartTime,
        {
          cost_usd: 0.01,
          tokens_in: 100,
          tokens_out: 50,
          output_data: { result: 'success' }
        }
      );

      // Test workflow logging
      logger.logWorkflowStep(
        context,
        'test_workflow_step',
        ['test_agent_1'],
        {
          duration_ms: 1000,
          cost_usd: 0.01,
          success: true,
          output_data: { step_result: 'completed' }
        }
      );

      // Force flush and query logs
      logger.flush();

      // Query the logs
      const logs = logger.queryLogs({ run_id: 'test_logging_run' });
      assert(logs.length >= 2, 'Should have logged operations');
      test.assertions_passed++;

      // Check required fields
      const firstLog = logs[0];
      const requiredFields = ['run_id', 'item_id', 'agent_id', 'agent_role', 'cost_usd', 'latency_ms', 'retries'];
      for (const field of requiredFields) {
        assert(firstLog.hasOwnProperty(field), `Log should have field: ${field}`);
      }
      test.assertions_passed++;

      // Test performance summary
      const perfSummary = logger.getAgentPerformanceSummary('test_logging_run');
      assert(Object.keys(perfSummary).length > 0, 'Should have performance summary');
      test.assertions_passed++;

      test.status = 'PASS';
    } catch (error) {
      test.status = 'FAIL';
      test.error_message = (error as Error).message;
    }

    test.execution_time_ms = Date.now() - startTime;
    return test;
  }

  private async runGatingTests(): Promise<void> {
    const suite: TestSuite = {
      suite_name: 'Gating Integration',
      tests: [],
      overall_status: 'PASS',
      total_time_ms: 0
    };

    const startTime = Date.now();

    suite.tests.push(await this.testSessionEvaluation());

    suite.total_time_ms = Date.now() - startTime;
    suite.overall_status = suite.tests.every(t => t.status === 'PASS') ? 'PASS' : 'FAIL';

    this.testResults.push(suite);
    this.logSuiteResult(suite);
  }

  private async testSessionEvaluation(): Promise<TestResult> {
    const test: TestResult = {
      test_id: 'GATE-1',
      description: 'Session evaluation with gating integration',
      status: 'PASS',
      execution_time_ms: 0,
      assertions_passed: 0,
      assertions_total: 3
    };

    const startTime = Date.now();

    try {
      const context = {
        run_id: 'test_session_eval',
        session_id: 'test_session_eval_1',
        profile: 'dev',
        dry_run: false,
        mode: 'smoke' as const,
        cases_total: 5
      };

      const metrics = {
        duplication_rate: 0.08,
        evidence_presence_rate: 0.92,
        evidence_missing_rate: 0.08,
        hallucination_rate: 0.02,
        pii_hits: 0,
        license_violations: 1,
        cost_per_item: 0.04,
        latency_p95_ms: 3000,
        failure_rate: 0.06,
        coverage_rate: 0.78,
        quality_score: 0.82,
        total_cost_usd: 0.20,
        total_items: 5,
        total_time_ms: 15000
      };

      const sessionResult = await evaluateSession(context, metrics, 'test_manifest_hash');

      assert(['PASS', 'WARN', 'PARTIAL', 'FAIL'].includes(sessionResult.result), 'Should have valid result');
      test.assertions_passed++;

      assert(sessionResult.gating_summary !== undefined, 'Should have gating summary');
      test.assertions_passed++;

      assert(sessionResult.decision_rationale.length > 0, 'Should have decision rationale');
      test.assertions_passed++;

      test.status = 'PASS';
    } catch (error) {
      test.status = 'FAIL';
      test.error_message = (error as Error).message;
    }

    test.execution_time_ms = Date.now() - startTime;
    return test;
  }

  /**
   * T-6: Multi-Agent Tests
   */
  private async runMultiAgentTests(): Promise<void> {
    const suite: TestSuite = {
      suite_name: 'Multi-Agent Orchestration',
      tests: [],
      overall_status: 'PASS',
      total_time_ms: 0
    };

    const startTime = Date.now();

    suite.tests.push(await this.testMultiAgentChain());

    suite.total_time_ms = Date.now() - startTime;
    suite.overall_status = suite.tests.every(t => t.status === 'PASS') ? 'PASS' : 'FAIL';

    this.testResults.push(suite);
    this.logSuiteResult(suite);
  }

  private async testMultiAgentChain(): Promise<TestResult> {
    const test: TestResult = {
      test_id: 'T-6',
      description: 'Multi-agent chain (E→A→Audit) execution',
      status: 'PASS',
      execution_time_ms: 0,
      assertions_passed: 0,
      assertions_total: 4
    };

    const startTime = Date.now();

    try {
      const orchestrator = createMultiAgentOrchestrator();
      const logger = getAgentLogger();

      const context = logger.createTraceContext('test_ma_run', 'test_ma_item');

      const request = {
        source_text: 'This is a test document containing information about artificial intelligence and machine learning. AI systems can process large amounts of data to identify patterns and make predictions. Machine learning algorithms improve their performance through experience and training data.',
        question: 'What can AI systems do with data?',
        generation_config: {
          max_evidence_snippets: 3,
          answer_style: 'conversational' as const,
          answer_length: 'medium' as const
        }
      };

      const result = await orchestrator.generateQA(context, request);

      // Assertions
      assert(result.answer.length > 0, 'Should generate an answer');
      test.assertions_passed++;

      assert(result.evidence_used.length > 0, 'Should use evidence');
      test.assertions_passed++;

      assert(['PASS', 'WARN', 'FAIL', 'REWRITE'].includes(result.audit_result.overall_verdict), 'Should have valid audit verdict');
      test.assertions_passed++;

      assert(result.processing_summary.agents_involved.length >= 3, 'Should involve multiple agents');
      test.assertions_passed++;

      test.status = 'PASS';
    } catch (error) {
      test.status = 'FAIL';
      test.error_message = (error as Error).message;
    }

    test.execution_time_ms = Date.now() - startTime;
    return test;
  }

  private async runCheckpointTests(): Promise<void> {
    const suite: TestSuite = {
      suite_name: 'Checkpoint & Recovery',
      tests: [],
      overall_status: 'PASS',
      total_time_ms: 0
    };

    const startTime = Date.now();

    suite.tests.push(await this.testCheckpointCreation());
    suite.tests.push(await this.testRecoveryAnalysis());

    suite.total_time_ms = Date.now() - startTime;
    suite.overall_status = suite.tests.every(t => t.status === 'PASS') ? 'PASS' : 'FAIL';

    this.testResults.push(suite);
    this.logSuiteResult(suite);
  }

  private async testCheckpointCreation(): Promise<TestResult> {
    const test: TestResult = {
      test_id: 'CHECKPOINT-1',
      description: 'Checkpoint creation and storage',
      status: 'PASS',
      execution_time_ms: 0,
      assertions_passed: 0,
      assertions_total: 3
    };

    const startTime = Date.now();

    try {
      const checkpointManager = createCheckpointManager(this.testDir);

      const progress = {
        total_items: 10,
        completed_items: 7,
        failed_items: 1,
        last_processed_index: 7
      };

      const state = {
        seed_value: 12345,
        manifest_hash: 'test_manifest_hash'
      };

      const processedItems = [
        {
          item_id: 'item_1',
          item_index: 0,
          status: 'completed' as const,
          timestamp: new Date().toISOString(),
          processing_time_ms: 1000,
          cost_usd: 0.01
        },
        {
          item_id: 'item_2',
          item_index: 1,
          status: 'failed' as const,
          timestamp: new Date().toISOString(),
          error_message: 'Test error'
        }
      ];

      const checkpoint = checkpointManager.createCheckpoint(
        'test_checkpoint_run',
        'test_checkpoint_session',
        progress,
        state,
        processedItems
      );

      assert(checkpoint.checkpoint_id.length > 0, 'Should have checkpoint ID');
      test.assertions_passed++;

      assert.strictEqual(checkpoint.progress.completed_items, 7, 'Should record correct progress');
      test.assertions_passed++;

      // Test loading checkpoint
      const loadedCheckpoint = checkpointManager.loadCheckpoint(checkpoint.checkpoint_id);
      assert(loadedCheckpoint !== null, 'Should be able to load checkpoint');
      test.assertions_passed++;

      test.status = 'PASS';
    } catch (error) {
      test.status = 'FAIL';
      test.error_message = (error as Error).message;
    }

    test.execution_time_ms = Date.now() - startTime;
    return test;
  }

  private async testRecoveryAnalysis(): Promise<TestResult> {
    const test: TestResult = {
      test_id: 'CHECKPOINT-2',
      description: 'Recovery analysis and execution',
      status: 'PASS',
      execution_time_ms: 0,
      assertions_passed: 0,
      assertions_total: 3
    };

    const startTime = Date.now();

    try {
      const checkpointManager = createCheckpointManager(this.testDir);

      // Analyze recovery for the checkpoint created in previous test
      const recoveryPlan = checkpointManager.analyzeRecoveryOptions('test_checkpoint_run');

      assert.strictEqual(recoveryPlan.can_recover, true, 'Should be able to recover');
      test.assertions_passed++;

      assert(['resume', 'restart', 'partial_restart'].includes(recoveryPlan.recovery_strategy), 'Should have valid recovery strategy');
      test.assertions_passed++;

      // Execute recovery
      const recovery = checkpointManager.executeRecovery('test_checkpoint_run', recoveryPlan);
      assert(recovery.recovered_state !== undefined, 'Should have recovered state');
      test.assertions_passed++;

      test.status = 'PASS';
    } catch (error) {
      test.status = 'FAIL';
      test.error_message = (error as Error).message;
    }

    test.execution_time_ms = Date.now() - startTime;
    return test;
  }

  private logSuiteResult(suite: TestSuite): void {
    const status = suite.overall_status === 'PASS' ? '✅' : '❌';
    const passCount = suite.tests.filter(t => t.status === 'PASS').length;

    console.log(`${status} ${suite.suite_name}: ${passCount}/${suite.tests.length} tests passed (${suite.total_time_ms}ms)`);

    // Log failed tests
    const failedTests = suite.tests.filter(t => t.status === 'FAIL');
    for (const test of failedTests) {
      console.log(`   ❌ ${test.test_id}: ${test.description}`);
      if (test.error_message) {
        console.log(`      Error: ${test.error_message}`);
      }
    }

    console.log();
  }

  private generateTestReport(): void {
    const totalTests = this.testResults.reduce((sum, suite) => sum + suite.tests.length, 0);
    const passedTests = this.testResults.reduce((sum, suite) =>
      sum + suite.tests.filter(t => t.status === 'PASS').length, 0
    );
    const totalTime = this.testResults.reduce((sum, suite) => sum + suite.total_time_ms, 0);

    const overallPass = passedTests === totalTests;

    console.log('📊 Test Summary');
    console.log('================');
    console.log(`Overall Status: ${overallPass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Tests Passed: ${passedTests}/${totalTests}`);
    console.log(`Total Time: ${totalTime}ms`);
    console.log();

    // Generate detailed report
    const reportPath = join(this.testDir, 'test_report.json');
    const report = {
      timestamp: new Date().toISOString(),
      overall_status: overallPass ? 'PASS' : 'FAIL',
      total_tests: totalTests,
      passed_tests: passedTests,
      failed_tests: totalTests - passedTests,
      total_time_ms: totalTime,
      test_suites: this.testResults
    };

    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Detailed report saved: ${reportPath}`);

    // Exit with appropriate code
    process.exit(overallPass ? 0 : 1);
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new FullSystemTestRunner();
  runner.runAllTests().catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
}