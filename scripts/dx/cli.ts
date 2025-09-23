#!/usr/bin/env node
/**
 * DxLoop v1 - Main CLI Interface
 * Orchestrates the complete diagnostic loop: collect→analyze→calibrate→gate→report
 */

import 'dotenv/config';
import { program } from 'commander';
import { collectSessionData } from './collect_session.js';
import { checkConsistency } from './check_consistency.js';
import { loadThresholds } from './load_thresholds.js';
import { autoCalibrateThresholds, applyCalibrations } from './autocalibrate.js';
import { analyzeMetrics } from './analyze_metrics.js';
import { detectAnomalies } from './detect_anomalies.js';
import { recommendActions } from './recommend_actions.js';
import { performGating, summarizeGating } from './gating.js';
import { persistReport } from './persist_reports.js';
import { DxLoopReport, ConsistencyCheck } from './types.js';

/**
 * Run a smoke test before the full diagnostic loop
 */
async function runSmokeTest(budget: number, profile: string): Promise<boolean> {
  console.log('🔍 Running pre-diagnostic smoke test...');

  try {
    // Basic environment check
    const requiredEnvVars = ['DRY_RUN', 'MODE'];
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        console.error(`❌ Missing required environment variable: ${envVar}`);
        return false;
      }
    }

    // Check if reports directory exists and has recent data
    try {
      const { collectSessionData } = await import('./collect_session.js');
      const collection = await collectSessionData();

      if (!collection.session_report) {
        console.error('❌ No session report found - ensure a run has completed first');
        return false;
      }

      if (collection.session_report.cases_total === 0) {
        console.error('❌ Session report shows zero cases - invalid run state');
        return false;
      }

      console.log(`✅ Found session data: ${collection.session_report.cases_total} cases`);
    } catch (error) {
      console.error('❌ Session data collection failed:', error);
      return false;
    }

    // Check budget constraints
    if (budget > 0) {
      try {
        const { loadThresholds } = await import('./load_thresholds.js');
        const { profile_config } = await loadThresholds(profile);

        if (budget > profile_config.budget_max_usd) {
          console.error(`❌ Budget ${budget} exceeds profile limit ${profile_config.budget_max_usd} for ${profile}`);
          return false;
        }

        console.log(`✅ Budget ${budget} within profile limits`);
      } catch (error) {
        console.warn('⚠️ Could not validate budget constraints:', error);
      }
    }

    console.log('✅ Smoke test passed');
    return true;

  } catch (error) {
    console.error('❌ Smoke test failed:', error);
    return false;
  }
}

/**
 * Main diagnostic loop execution
 */
async function runDiagnosticLoop(options: {
  profile: string;
  budget: number;
  autocalib: boolean;
  approve: boolean;
  skipSmoke: boolean;
}): Promise<void> {
  const startTime = Date.now();
  const sessionId = `dxloop_${new Date().toISOString().replace(/[:.]/g, '-')}`;

  console.log('🚀 Starting DxLoop v1 Diagnostic System');
  console.log(`Session ID: ${sessionId}`);
  console.log(`Profile: ${options.profile} | Budget: $${options.budget} | Auto-cal: ${options.autocalib}`);

  try {
    // Step 0: Smoke test (unless skipped)
    if (!options.skipSmoke) {
      const smokeResult = await runSmokeTest(options.budget, options.profile);
      if (!smokeResult) {
        console.error('❌ Smoke test failed - aborting diagnostic loop');
        process.exit(1);
      }
    }

    // Step 1: Collect session data
    console.log('\n📊 Step 1/8: Collecting session data...');
    const collection = await collectSessionData();

    if (!collection.session_report) {
      throw new Error('No session report found - ensure a run has completed first');
    }

    // Step 2: Check consistency
    console.log('\n🔍 Step 2/8: Checking consistency...');
    const consistency: ConsistencyCheck = await checkConsistency();

    // Step 3: Load thresholds
    console.log('\n⚙️ Step 3/8: Loading thresholds...');
    const { config: dxConfig, profile_config } = await loadThresholds(options.profile);

    // Step 4: Auto-calibrate thresholds (if enabled)
    console.log('\n📈 Step 4/8: Auto-calibrating thresholds...');
    let calibrationChanges: any[] = [];
    let updatedConfig = dxConfig;

    if (options.autocalib && dxConfig.autocalibration.enabled) {
      calibrationChanges = await autoCalibrateThresholds(dxConfig, options.profile);

      if (calibrationChanges.length > 0) {
        console.log(`Found ${calibrationChanges.length} threshold calibration opportunities`);

        if (options.approve) {
          const { updatedConfig: newConfig, appliedChanges } = applyCalibrations(
            dxConfig,
            calibrationChanges,
            true // Enable drift guard
          );
          updatedConfig = newConfig;
          console.log(`Applied ${appliedChanges.length} threshold changes`);
        } else {
          console.log('Threshold changes proposed but not approved (use --approve to apply)');
        }
      }
    } else {
      console.log('Auto-calibration disabled or not requested');
    }

    // Step 5: Analyze metrics
    console.log('\n📋 Step 5/8: Analyzing metrics...');
    const metrics = await analyzeMetrics();

    // Step 6: Detect anomalies
    console.log('\n🔎 Step 6/8: Detecting anomalies...');
    const anomalies = await detectAnomalies(metrics);

    // Step 7: Generate recommendations
    console.log('\n💡 Step 7/8: Generating recommendations...');
    const recommendations = recommendActions(metrics, anomalies);

    // Step 8: Perform gating
    console.log('\n🚪 Step 8/8: Performing gating analysis...');
    const gating = performGating(metrics, updatedConfig.thresholds, anomalies, recommendations, consistency);

    // Create comprehensive report
    const report: DxLoopReport = {
      report_version: '1.0.0',
      session_id: sessionId,
      run_id: collection.session_report.run_id,
      timestamp: new Date().toISOString(),
      profile: options.profile,
      mode: collection.session_report.mode,
      budget_usd: options.budget,
      consistency,
      metrics,
      anomalies,
      calibration: {
        enabled: options.autocalib && dxConfig.autocalibration.enabled,
        approved: options.approve && calibrationChanges.length > 0,
        changes: calibrationChanges,
        diff_summary: calibrationChanges.length > 0
          ? `${calibrationChanges.length} threshold adjustments proposed`
          : 'No threshold changes proposed'
      },
      gating,
      recommendations,
      dlq_status: {
        total_entries: 0,
        recent_failures: [],
        retry_candidates: []
      },
      summary: {
        overall_status: gating.gate_status,
        top_issues: [
          ...gating.p0_violations.slice(0, 3),
          ...gating.p1_warnings.slice(0, 2),
          ...recommendations.filter(r => r.severity === 'critical').map(r => r.issue).slice(0, 2)
        ].slice(0, 5),
        next_actions: summarizeGating(gating).next_steps,
        proceed_recommendation: gating.can_proceed
      }
    };

    // Persist report
    console.log('\n💾 Persisting diagnostic report...');
    const persistResult = await persistReport(report, options.approve);

    // Final summary
    const duration = Date.now() - startTime;
    const gatingSummary = summarizeGating(gating);

    console.log('\n' + '='.repeat(60));
    console.log('🎯 DXLOOP DIAGNOSTIC SUMMARY');
    console.log('='.repeat(60));
    console.log(`${gatingSummary.status_emoji} ${gatingSummary.summary_text}`);
    console.log(`\n📊 Quality Overview:`);
    console.log(`   Consistency: ${consistency.passed ? '✅' : '❌'} | Cases: ${consistency.cases_total}`);
    console.log(`   Evidence: ${(metrics.evidence.presence_rate * 100).toFixed(0)}% | Duplication: ${(metrics.duplication.rate * 100).toFixed(1)}%`);
    console.log(`   Cost/Item: $${metrics.cost_latency.cost_per_item.toFixed(3)} | P95 Latency: ${metrics.cost_latency.latency_p95_ms}ms`);

    if (report.summary.top_issues.length > 0) {
      console.log(`\n⚠️ Top Issues:`);
      report.summary.top_issues.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`);
      });
    }

    console.log(`\n📁 Reports Generated:`);
    console.log(`   📄 ${persistResult.md_path}`);
    console.log(`   📊 ${persistResult.jsonl_path}`);
    console.log(`   ✅ Schema Valid: ${persistResult.schema_valid}`);

    if (calibrationChanges.length > 0) {
      console.log(`\n⚙️ Threshold Calibration:`);
      console.log(`   📈 ${calibrationChanges.length} changes proposed`);
      console.log(`   ${options.approve ? '✅ Applied' : '⏳ Pending approval'}`);
    }

    console.log(`\n🕐 Execution Time: ${(duration / 1000).toFixed(1)}s`);
    console.log(`🎯 Recommendation: ${gating.can_proceed ? 'PROCEED' : 'BLOCK'} full run`);

    // Exit with appropriate code
    if (gating.gate_status === 'FAIL') {
      console.log('\n❌ Diagnostic loop completed with FAIL status');
      process.exit(1);
    } else if (gating.gate_status === 'PARTIAL') {
      console.log('\n🟡 Diagnostic loop completed with PARTIAL status');
      process.exit(2);
    } else {
      console.log('\n✅ Diagnostic loop completed successfully');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n❌ Diagnostic loop failed:', error);
    process.exit(1);
  }
}

/**
 * Report-only mode (load and display existing report)
 */
async function reportMode(): Promise<void> {
  try {
    const { loadReport } = await import('./persist_reports.js');
    const report = await loadReport();

    if (!report) {
      console.error('❌ No existing DxLoop report found');
      process.exit(1);
    }

    const gatingSummary = summarizeGating(report.gating);

    console.log('📋 DXLOOP REPORT SUMMARY');
    console.log('='.repeat(40));
    console.log(`${gatingSummary.status_emoji} Status: ${report.summary.overall_status}`);
    console.log(`📅 Generated: ${report.timestamp}`);
    console.log(`🎯 Recommendation: ${report.summary.proceed_recommendation ? 'PROCEED' : 'BLOCK'}`);

    if (report.summary.top_issues.length > 0) {
      console.log(`\n⚠️ Issues:`);
      report.summary.top_issues.forEach(issue => console.log(`   • ${issue}`));
    }

    console.log(`\n📁 Full Report: reports/dxloop_report.md`);

    process.exit(report.summary.proceed_recommendation ? 0 : 1);

  } catch (error) {
    console.error('❌ Report mode failed:', error);
    process.exit(1);
  }
}

/**
 * CLI Command Setup
 */
program
  .name('dxloop')
  .description('DxLoop v1 - Pre-Full-Run Quality & Stability Guard')
  .version('1.0.0');

program
  .command('run')
  .description('Execute complete diagnostic loop')
  .option('--profile <profile>', 'Execution profile (dev|stage|prod)', 'dev')
  .option('--budget <amount>', 'Budget limit in USD', '0.50')
  .option('--autocalib', 'Enable auto-calibration of P1/P2 thresholds', false)
  .option('--approve', 'Auto-approve and apply threshold changes', false)
  .option('--skip-smoke', 'Skip smoke test validation', false)
  .action(async (options) => {
    await runDiagnosticLoop({
      profile: options.profile,
      budget: parseFloat(options.budget),
      autocalib: options.autocalib,
      approve: options.approve,
      skipSmoke: options.skipSmoke
    });
  });

program
  .command('report')
  .description('Display summary of last diagnostic report')
  .action(reportMode);

program
  .command('smoke')
  .description('Run smoke test only')
  .option('--profile <profile>', 'Execution profile', 'dev')
  .option('--budget <amount>', 'Budget limit in USD', '0.50')
  .action(async (options) => {
    const result = await runSmokeTest(parseFloat(options.budget), options.profile);
    process.exit(result ? 0 : 1);
  });

// Parse CLI arguments
program.parse();

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}