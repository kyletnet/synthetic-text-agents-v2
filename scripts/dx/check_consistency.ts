/**
 * DxLoop v1 - Consistency Checker
 * Verifies report-to-execution alignment and validates core requirements
 */

import { promises as fs } from 'fs';
import { SessionCollection, collectSessionData } from './collect_session.js';
import { ConsistencyCheck } from './types.js';

/**
 * Check if session report matches actual execution state
 */
function validateSessionReportConsistency(collection: SessionCollection): ConsistencyCheck {
  const issues: string[] = [];
  let dry_run_match = true;
  let mode_match = true;
  let result_match = true;
  let cases_total = 0;

  const sessionData = collection.session_report;

  if (!sessionData) {
    issues.push('Session report not found or could not be parsed');
    return {
      passed: false,
      issues,
      cases_total: 0,
      session_report_exists: false,
      baseline_report_exists: !!collection.baseline_report,
      llm_analysis_exists: !!collection.llm_analysis,
      dry_run_match: false,
      mode_match: false,
      result_match: false
    };
  }

  // Check DRY_RUN consistency
  const expectedDryRun = process.env.DRY_RUN === 'true';
  if (sessionData.dry_run !== expectedDryRun) {
    dry_run_match = false;
    issues.push(`DRY_RUN mismatch: report=${sessionData.dry_run}, env=${expectedDryRun}`);
  }

  // Check MODE consistency
  const expectedMode = process.env.MODE || 'unknown';
  if (sessionData.mode !== expectedMode) {
    mode_match = false;
    issues.push(`MODE mismatch: report=${sessionData.mode}, env=${expectedMode}`);
  }

  // Check RESULT/RUN_STATE consistency
  const expectedResult = process.env.RESULT || sessionData.result;
  if (sessionData.result !== expectedResult && sessionData.run_state !== expectedResult) {
    result_match = false;
    issues.push(`RESULT mismatch: report=${sessionData.result}/${sessionData.run_state}, expected=${expectedResult}`);
  }

  // Check CASES_TOTAL validity
  if (sessionData.cases_total === 0) {
    cases_total = -1;
    issues.push(`CASES_TOTAL is 0 - invalid run state`);
  }

  // Cross-validate with baseline report if available
  if (collection.baseline_report) {
    const baselineItems = collection.baseline_report.total_items || 0;
    if (sessionData.cases_total !== baselineItems && baselineItems > 0) {
      issues.push(`Case count mismatch: session=${sessionData.cases_total}, baseline=${baselineItems}`);
    }
  }

  // Cross-validate with LLM analysis if available
  if (collection.llm_analysis) {
    const llmCases = collection.llm_analysis.total_cases || 0;
    if (sessionData.cases_total !== llmCases && llmCases > 0) {
      issues.push(`Case count mismatch: session=${sessionData.cases_total}, llm_analysis=${llmCases}`);
    }
  }

  return {
    session_report_exists: true,
    baseline_report_exists: !!collection.baseline_report,
    llm_analysis_exists: !!collection.llm_analysis,
    dry_run_match,
    mode_match,
    result_match,
    passed: cases_total >= 0,
    cases_total: Math.max(0, cases_total),
    issues
  };
}

/**
 * Additional file-level consistency checks
 */
async function performAdditionalChecks(collection: SessionCollection): Promise<string[]> {
  const issues: string[] = [];

  try {
    // Check if reports directory exists
    const reportsDir = 'reports';
    try {
      await fs.access(reportsDir);
    } catch {
      issues.push('Reports directory does not exist');
    }

    // Check for stale reports (older than 24 hours)
    const sessionData = collection.session_report;
    if (sessionData?.timestamp) {
      const reportTime = new Date(sessionData.timestamp);
      const now = new Date();
      const ageHours = (now.getTime() - reportTime.getTime()) / (1000 * 60 * 60);

      if (ageHours > 24) {
        issues.push(`Session report is stale (${Math.round(ageHours)}h old)`);
      }
    }

    // Check for required environment variables
    const requiredEnvVars = ['DRY_RUN', 'MODE'];
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        issues.push(`Required environment variable not set: ${envVar}`);
      }
    }

    // Check for DLQ entries if failure detected
    if (sessionData?.result === 'FAIL' || sessionData?.run_state === 'FAIL') {
      try {
        const dlqDir = 'DLQ';
        const dlqEntries = await fs.readdir(dlqDir);
        if (dlqEntries.length === 0) {
          issues.push('Failed run but no DLQ entries found');
        }
      } catch {
        issues.push('DLQ directory not accessible');
      }
    }

  } catch (error) {
    issues.push(`Error during additional checks: ${error}`);
  }

  return issues;
}

/**
 * Perform comprehensive consistency check
 */
export async function checkConsistency(): Promise<ConsistencyCheck> {
  try {
    console.log('Starting consistency check...');

    // Collect session data
    const collection = await collectSessionData();

    // Validate session report consistency
    const consistency = validateSessionReportConsistency(collection);

    // Perform additional checks
    const additionalIssues = await performAdditionalChecks(collection);
    consistency.issues.push(...additionalIssues);

    // Determine overall pass/fail status
    const hasCriticalIssues = !consistency.passed ||
                             !consistency.session_report_exists ||
                             consistency.issues.some(issue =>
                               issue.includes('CASES_TOTAL is 0') ||
                               issue.includes('Session report not found')
                             );

    console.log('Consistency check completed:', {
      passed: !hasCriticalIssues,
      total_issues: consistency.issues.length,
      critical_issues: hasCriticalIssues
    });

    return consistency;

  } catch (error) {
    console.error('Consistency check failed:', error);
    return {
      passed: false,
      issues: [`Consistency check error: ${error}`],
      cases_total: 0,
      session_report_exists: false,
      baseline_report_exists: false,
      llm_analysis_exists: false,
      dry_run_match: false,
      mode_match: false,
      result_match: false
    };
  }
}

/**
 * CLI interface for consistency checking
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];

  if (command === 'check') {
    checkConsistency()
      .then((result) => {
        console.log('Consistency Check Result:');
        console.log(JSON.stringify(result, null, 2));

        // Exit with appropriate code
        const hasCriticalIssues = !result.passed ||
                                 !result.session_report_exists ||
                                 result.issues.some(issue =>
                                   issue.includes('CASES_TOTAL is 0') ||
                                   issue.includes('Session report not found')
                                 );

        process.exit(hasCriticalIssues ? 1 : 0);
      })
      .catch((error) => {
        console.error('Consistency check failed:', error);
        process.exit(1);
      });
  } else {
    console.log('Usage: node check_consistency.js check');
    process.exit(1);
  }
}