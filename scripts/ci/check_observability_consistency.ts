#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

interface SessionData {
  run_id: string;
  cost_usd: number;
  duration_ms: number;
}

interface ObservabilityData {
  run_id: string;
  total_cost_usd: number;
  total_duration_ms: number;
  total_operations: number;
  components: string[];
}

interface CheckResult {
  run_id_match: 'PASS' | 'FAIL';
  cost_check: 'PASS' | 'WARN' | 'FAIL';
  duration_check: 'PASS' | 'FAIL';
  operations_check: 'PASS' | 'FAIL' | 'SKIP';
  components_seen: string[];
  notes: string[];
  exit: 0 | 1;
}

function parseSessionReport(sessionPath: string): SessionData {
  const content = readFileSync(sessionPath, 'utf-8');

  // Extract JSON block from markdown
  const jsonMatch = content.match(/```json\s*\n([\s\S]*?)\n```/);
  if (!jsonMatch) {
    throw new Error('No JSON block found in session report');
  }

  const sessionData = JSON.parse(jsonMatch[1]);
  return {
    run_id: sessionData.run_id,
    cost_usd: sessionData.cost_usd,
    duration_ms: sessionData.duration_ms
  };
}

function parseObservabilityHTML(htmlPath: string): ObservabilityData {
  const content = readFileSync(htmlPath, 'utf-8');

  // Extract JSON from <pre> tag
  const preMatch = content.match(/<pre>([\s\S]*?)<\/pre>/);
  if (!preMatch) {
    throw new Error('No <pre> tag found in observability HTML');
  }

  const obsData = JSON.parse(preMatch[1]);

  // Extract data from the first run or global summary
  const runs = obsData.runs || {};
  const runKeys = Object.keys(runs);
  const firstRun = runKeys.length > 0 ? runs[runKeys[0]] : null;
  const globalSummary = obsData.global_summary || {};

  return {
    run_id: firstRun?.run_id || runKeys[0] || '',
    total_cost_usd: globalSummary.total_cost_usd || firstRun?.total_cost_usd || 0,
    total_duration_ms: globalSummary.total_duration_ms || firstRun?.duration_ms || 0,
    total_operations: globalSummary.total_operations || firstRun?.operations || 0,
    components: firstRun?.components || []
  };
}

interface LogOperationsResult {
  count: number;
  hasSpanMarkers: boolean;
  isV1Logs: boolean;
}

function countRunLogsOperations(logsPath: string): LogOperationsResult {
  try {
    const files = readdirSync(logsPath);
    let topLevelOperations = 0;
    let hasSpanMarkers = false;
    let totalEntries = 0;
    const seenOpIds = new Set<string>();

    for (const file of files) {
      const filePath = join(logsPath, file);
      const stats = statSync(filePath);

      if (stats.isFile() && (file.endsWith('.jsonl') || file.endsWith('.log'))) {
        try {
          const content = readFileSync(filePath, 'utf-8');
          const lines = content.split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const entry = JSON.parse(line);
              totalEntries++;

              // Check if entry has span identification markers
              const hasParentId = 'parentId' in entry;
              const hasSpanKind = 'span_kind' in entry;
              const hasIsRoot = 'is_root' in entry;

              if (hasParentId || hasSpanKind || hasIsRoot) {
                hasSpanMarkers = true;

                // Check if this is a top-level span
                const isTopLevel = (
                  entry.span_kind === 'root' ||
                  entry.is_root === true ||
                  entry.parentId === null ||
                  entry.parentId === undefined
                ) && entry.span_kind !== 'child' && entry.is_root !== false;

                if (isTopLevel) {
                  // Handle operation deduplication by op_id
                  if (entry.op_id) {
                    if (!seenOpIds.has(entry.op_id)) {
                      seenOpIds.add(entry.op_id);
                      topLevelOperations++;
                    }
                  } else {
                    topLevelOperations++;
                  }
                }
              }
            } catch (parseError) {
              // Skip unparseable lines
              continue;
            }
          }
        } catch (err) {
          // Skip files that can't be read
          continue;
        }
      }
    }

    const isV1Logs = !hasSpanMarkers;

    return {
      count: isV1Logs ? totalEntries : topLevelOperations,
      hasSpanMarkers,
      isV1Logs
    };
  } catch (err) {
    return { count: -1, hasSpanMarkers: false, isV1Logs: true }; // Indicates logs couldn't be processed
  }
}

function checkConsistency(sessionPath: string, obsPath: string, logsPath: string): CheckResult {
  const result: CheckResult = {
    run_id_match: 'FAIL',
    cost_check: 'FAIL',
    duration_check: 'FAIL',
    operations_check: 'SKIP',
    components_seen: [],
    notes: [],
    exit: 1
  };

  try {
    const sessionData = parseSessionReport(sessionPath);
    const obsData = parseObservabilityHTML(obsPath);
    const logOperationsResult = countRunLogsOperations(logsPath);

    // Check run_id match
    if (sessionData.run_id === obsData.run_id) {
      result.run_id_match = 'PASS';
    } else {
      result.run_id_match = 'FAIL';
      const sessionPrefix = sessionData.run_id.split('-')[0];
      const obsPrefix = obsData.run_id.split('-')[0];
      if (sessionPrefix !== obsPrefix) {
        result.notes.push("Use session_report.run_id as the exporter's run_id");
      }
      result.notes.push(`Run ID mismatch: session="${sessionData.run_id}", obs="${obsData.run_id}"`);
    }

    // Check cost
    const costDiff = Math.abs(sessionData.cost_usd - obsData.total_cost_usd);
    if (costDiff === 0) {
      result.cost_check = 'PASS';
    } else if (costDiff <= 0.03) {
      result.cost_check = 'WARN';
      result.notes.push(`Cost difference within threshold: session=$${sessionData.cost_usd}, obs=$${obsData.total_cost_usd}, diff=$${costDiff.toFixed(3)}`);
    } else {
      result.cost_check = 'FAIL';
      result.notes.push(`Cost difference exceeds threshold: session=$${sessionData.cost_usd}, obs=$${obsData.total_cost_usd}, diff=$${costDiff.toFixed(3)}`);
    }

    // Check duration
    if (sessionData.duration_ms === obsData.total_duration_ms) {
      result.duration_check = 'PASS';
    } else {
      result.duration_check = 'FAIL';
      result.notes.push(`Duration mismatch: session=${sessionData.duration_ms}ms, obs=${obsData.total_duration_ms}ms`);
    }

    // Check operations with new top-level span logic
    if (logOperationsResult.count === -1) {
      result.operations_check = 'SKIP';
      result.notes.push('Unable to read RUN_LOGS for operation count');
    } else if (logOperationsResult.isV1Logs) {
      result.operations_check = 'SKIP';
      result.notes.push('v1 logs: event-level only');
    } else if (logOperationsResult.count === obsData.total_operations) {
      result.operations_check = 'PASS';
    } else {
      result.operations_check = 'FAIL';
      result.notes.push(`Operations mismatch: logs=${logOperationsResult.count}, obs=${obsData.total_operations}`);
    }

    // Check components (informational only)
    result.components_seen = obsData.components;
    const expectedComponents = ['typescript-validation', 'smoke-run', 'gating-validation'];
    const missingComponents = expectedComponents.filter(comp => !obsData.components.includes(comp));
    if (missingComponents.length > 0) {
      result.notes.push(`Missing expected components: ${missingComponents.join(', ')}`);
    }

    // Determine exit code (SKIP for operations is acceptable)
    const hasFailures = result.run_id_match === 'FAIL' ||
                       result.cost_check === 'FAIL' ||
                       result.duration_check === 'FAIL' ||
                       result.operations_check === 'FAIL';

    result.exit = hasFailures ? 1 : 0;

  } catch (error) {
    result.notes.push(`Error during check: ${error instanceof Error ? error.message : String(error)}`);
    result.exit = 1;
  }

  return result;
}

function main() {
  const args = process.argv.slice(2);
  const sessionIndex = args.indexOf('--session');
  const obsIndex = args.indexOf('--obs');
  const logsIndex = args.indexOf('--logs');

  if (sessionIndex === -1 || obsIndex === -1 || logsIndex === -1) {
    console.error('Usage: node check_observability_consistency.js --session <path> --obs <path> --logs <path>');
    process.exit(1);
  }

  const sessionPath = args[sessionIndex + 1];
  const obsPath = args[obsIndex + 1];
  const logsPath = args[logsIndex + 1];

  if (!sessionPath || !obsPath || !logsPath) {
    console.error('All paths must be provided');
    process.exit(1);
  }

  const result = checkConsistency(sessionPath, obsPath, logsPath);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.exit);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}