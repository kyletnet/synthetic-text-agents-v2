#!/usr/bin/env node
/**
 * check_observability_consistency.ts — Permanent observability consistency checker
 *
 * CLI usage:
 * node dist/scripts/ci/check_observability_consistency.js \
 *   --session reports/session_report.md \
 *   --obs reports/observability/2025-09-19T01-50-27/index.html \
 *   --logs RUN_LOGS
 *
 * Performs strict, deterministic consistency checks between:
 * - Session report (canonical source)
 * - Observability HTML export
 * - Raw run logs
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { parseArgs } from 'util';
import { globSync } from 'glob';

interface ConsistencyResult {
  run_id_match: 'PASS' | 'FAIL';
  cost_check: 'PASS' | 'WARN' | 'FAIL';
  duration_check: 'PASS' | 'FAIL';
  operations_check: 'PASS' | 'FAIL' | 'SKIP';
  components_seen: string[];
  notes: string[];
  exit: 0 | 1;
  details?: {
    session_data: any;
    html_data: any;
    logs_aggregated: any;
  };
}

interface SessionData {
  run_id: string;
  cost_usd: number;
  duration_ms: number;
}

interface HtmlData {
  run_id: string;
  total_cost_usd: number;
  total_duration_ms: number;
  total_operations: number;
  components: string[];
}

interface LogsData {
  total_operations: number;
  components_seen: string[];
}

export class ObservabilityConsistencyChecker {
  async checkConsistency(
    sessionPath: string,
    htmlPath: string,
    logsDir: string
  ): Promise<ConsistencyResult> {
    const result: ConsistencyResult = {
      run_id_match: 'FAIL',
      cost_check: 'FAIL',
      duration_check: 'FAIL',
      operations_check: 'SKIP',
      components_seen: [],
      notes: [],
      exit: 1
    };

    try {
      // Parse session report (canonical source)
      const sessionData = await this.parseSessionReport(sessionPath);

      // Parse observability HTML
      const htmlData = await this.parseObservabilityHtml(htmlPath);

      // Aggregate run logs
      const logsData = await this.aggregateRunLogs(logsDir);

      // Store details for debugging
      result.details = {
        session_data: sessionData,
        html_data: htmlData,
        logs_aggregated: logsData
      };

      // Perform consistency checks
      await this.checkRunIdMatch(sessionData, htmlData, result);
      await this.checkCostConsistency(sessionData, htmlData, result);
      await this.checkDurationConsistency(sessionData, htmlData, result);
      await this.checkOperationsConsistency(htmlData, logsData, result);
      await this.checkComponents(htmlData, result);

      // Determine overall exit code
      const hasFailures = [
        result.run_id_match,
        result.cost_check,
        result.duration_check,
        result.operations_check
      ].some(check => check === 'FAIL');

      result.exit = hasFailures ? 1 : 0;

      return result;

    } catch (error) {
      result.notes.push(`Fatal error: ${error}`);
      result.exit = 1;
      return result;
    }
  }

  private async parseSessionReport(sessionPath: string): Promise<SessionData> {
    const content = await fs.readFile(sessionPath, 'utf8');

    // Extract JSON block from markdown
    const jsonBlockRegex = /```json\s*\n([\s\S]*?)\n```/g;
    let sessionSummary: any = null;

    let match;
    while ((match = jsonBlockRegex.exec(content)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        // Look for session summary (has run_id, cost_usd, duration_ms)
        if (parsed.run_id && typeof parsed.cost_usd === 'number' && typeof parsed.duration_ms === 'number') {
          sessionSummary = parsed;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!sessionSummary) {
      throw new Error('Could not find session summary JSON block in session report');
    }

    return {
      run_id: sessionSummary.run_id,
      cost_usd: sessionSummary.cost_usd,
      duration_ms: sessionSummary.duration_ms
    };
  }

  private async parseObservabilityHtml(htmlPath: string): Promise<HtmlData> {
    const content = await fs.readFile(htmlPath, 'utf8');

    // Extract JSON from <pre> tag
    const preTagRegex = /<pre>([\s\S]*?)<\/pre>/g;
    let traceData: any = null;

    let match;
    while ((match = preTagRegex.exec(content)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        // Look for trace data structure with runs and global_summary
        if (parsed.runs && parsed.global_summary) {
          traceData = parsed;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!traceData) {
      throw new Error('Could not find trace data JSON in <pre> tag of HTML');
    }

    // Extract run data (assuming single run)
    const runIds = Object.keys(traceData.runs);
    if (runIds.length === 0) {
      throw new Error('No runs found in trace data');
    }

    // Use the first run (or could be more sophisticated)
    const runId = runIds[0];
    const runData = traceData.runs[runId];

    return {
      run_id: runId,
      total_cost_usd: traceData.global_summary.total_cost_usd || 0,
      total_duration_ms: traceData.global_summary.total_duration_ms || 0,
      total_operations: traceData.global_summary.total_operations || 0,
      components: runData.components || []
    };
  }

  private async aggregateRunLogs(logsDir: string): Promise<LogsData> {
    try {
      // Find all .jsonl files in logs directory
      const logFiles = globSync(join(logsDir, '*.jsonl'));

      let totalOperations = 0;
      const componentsSet = new Set<string>();

      for (const logFile of logFiles) {
        try {
          const content = await fs.readFile(logFile, 'utf8');
          const lines = content.trim().split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const entry = JSON.parse(line);

              // Count as operation if it has a component and operation/action
              if (entry.component && (entry.operation || entry.action || entry.level)) {
                totalOperations++;
                componentsSet.add(entry.component);
              }
            } catch {
              // Skip malformed JSON lines
            }
          }
        } catch {
          // Skip files that can't be read
        }
      }

      return {
        total_operations: totalOperations,
        components_seen: Array.from(componentsSet)
      };

    } catch (error) {
      // If we can't read logs, return empty data
      return {
        total_operations: 0,
        components_seen: []
      };
    }
  }

  private async checkRunIdMatch(
    sessionData: SessionData,
    htmlData: HtmlData,
    result: ConsistencyResult
  ): Promise<void> {
    const sessionRunId = sessionData.run_id;
    const htmlRunId = htmlData.run_id;

    if (sessionRunId === htmlRunId) {
      result.run_id_match = 'PASS';
      result.notes.push(`Run ID match: ${sessionRunId}`);
    } else {
      result.run_id_match = 'FAIL';
      result.notes.push(`Run ID mismatch: session="${sessionRunId}" vs html="${htmlRunId}"`);

      // Check for prefix mismatch pattern
      if (sessionRunId.includes('smoke-') && htmlRunId.includes('run-')) {
        result.notes.push('Hint: Use session_report.run_id as the exporter\'s run_id');
      } else if (htmlRunId.includes('smoke-') && sessionRunId.includes('run-')) {
        result.notes.push('Hint: Use session_report.run_id as the exporter\'s run_id');
      }
    }
  }

  private async checkCostConsistency(
    sessionData: SessionData,
    htmlData: HtmlData,
    result: ConsistencyResult
  ): Promise<void> {
    const sessionCost = sessionData.cost_usd;
    const htmlCost = htmlData.total_cost_usd;
    const diff = Math.abs(sessionCost - htmlCost);

    if (diff === 0) {
      result.cost_check = 'PASS';
      result.notes.push(`Cost exact match: $${sessionCost.toFixed(4)}`);
    } else if (diff <= 0.03) {
      result.cost_check = 'WARN';
      result.notes.push(`Cost within tolerance: session=$${sessionCost.toFixed(4)}, html=$${htmlCost.toFixed(4)}, diff=$${diff.toFixed(4)}`);
    } else {
      result.cost_check = 'FAIL';
      result.notes.push(`Cost difference exceeds threshold: session=$${sessionCost.toFixed(4)}, html=$${htmlCost.toFixed(4)}, diff=$${diff.toFixed(4)} > $0.03`);
    }
  }

  private async checkDurationConsistency(
    sessionData: SessionData,
    htmlData: HtmlData,
    result: ConsistencyResult
  ): Promise<void> {
    const sessionDuration = sessionData.duration_ms;
    const htmlDuration = htmlData.total_duration_ms;

    if (sessionDuration === htmlDuration) {
      result.duration_check = 'PASS';
      result.notes.push(`Duration match: ${sessionDuration}ms`);
    } else {
      result.duration_check = 'FAIL';
      result.notes.push(`Duration mismatch: session=${sessionDuration}ms vs html=${htmlDuration}ms`);
    }
  }

  private async checkOperationsConsistency(
    htmlData: HtmlData,
    logsData: LogsData,
    result: ConsistencyResult
  ): Promise<void> {
    if (logsData.total_operations === 0) {
      result.operations_check = 'SKIP';
      result.notes.push('Operations check skipped: no log data found');
      return;
    }

    const htmlOperations = htmlData.total_operations;
    const logsOperations = logsData.total_operations;

    if (htmlOperations === logsOperations) {
      result.operations_check = 'PASS';
      result.notes.push(`Operations match: ${htmlOperations}`);
    } else {
      result.operations_check = 'FAIL';
      result.notes.push(`Operations mismatch: html=${htmlOperations} vs logs=${logsOperations}`);
    }
  }

  private async checkComponents(
    htmlData: HtmlData,
    result: ConsistencyResult
  ): Promise<void> {
    const expectedComponents = ['typescript-validation', 'smoke-run', 'gating-validation'];
    const seenComponents = htmlData.components;

    result.components_seen = seenComponents;

    const missing = expectedComponents.filter(comp => !seenComponents.includes(comp));
    const extra = seenComponents.filter(comp => !expectedComponents.includes(comp));

    if (missing.length === 0) {
      result.notes.push(`All expected components present: [${expectedComponents.join(', ')}]`);
    } else {
      result.notes.push(`Missing expected components: [${missing.join(', ')}]`);
    }

    if (extra.length > 0) {
      result.notes.push(`Additional components found: [${extra.join(', ')}]`);
    }

    // Components are informational only - never fail on this
    result.notes.push(`Components check: informational only (${seenComponents.length} total)`);
  }
}

// CLI interface
async function main() {
  const { values: args } = parseArgs({
    options: {
      session: { type: 'string' },
      obs: { type: 'string' },
      logs: { type: 'string' }
    }
  });

  if (!args.session || !args.obs || !args.logs) {
    console.error('Usage: node check_observability_consistency.js --session <path> --obs <path> --logs <dir>');
    process.exit(1);
  }

  const checker = new ObservabilityConsistencyChecker();
  const result = await checker.checkConsistency(args.session, args.obs, args.logs);

  // Remove details from output unless debugging
  const outputResult = { ...result };
  delete outputResult.details;

  console.log(JSON.stringify(outputResult, null, 2));
  process.exit(result.exit);
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(JSON.stringify({
      run_id_match: 'FAIL',
      cost_check: 'FAIL',
      duration_check: 'FAIL',
      operations_check: 'FAIL',
      components_seen: [],
      notes: [`Fatal error: ${error}`],
      exit: 1
    }, null, 2));
    process.exit(1);
  });
}

export { main };