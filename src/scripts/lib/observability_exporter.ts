/**
 * observability_exporter.ts — Export and render observability data from run logs
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { globSync } from 'glob';

interface TraceEntry {
  timestamp: string;
  run_id?: string;
  session_id?: string;
  correlation_id?: string;
  component: string;
  operation?: string;
  agent_id?: string;
  agent_role?: string;
  status?: string;
  cost_usd?: number;
  latency_ms?: number;
  level?: string;
  // New fields for top-level span identification
  parentId?: string | null;
  span_kind?: 'root' | 'child';
  is_root?: boolean;
  op_id?: string; // For merging retries of same logical operation
  [key: string]: any;
}

interface TraceTree {
  runs: Record<string, {
    run_id: string;
    start_time: string;
    end_time: string;
    duration_ms: number;
    total_cost_usd: number;
    operations: TraceEntry[];
    topLevelOps?: TraceEntry[]; // Top-level operations only
    agents: Record<string, {
      agent_id: string;
      operations: number;
      total_cost_usd: number;
      total_latency_ms: number;
    }>;
    summary: {
      total_operations: number;
      successful_operations: number;
      failed_operations: number;
      components: string[];
    };
  }>;
  global_summary: {
    total_runs: number;
    total_operations: number;
    total_cost_usd: number;
    total_duration_ms: number;
    most_expensive_operation?: TraceEntry;
    slowest_operation?: TraceEntry;
  };
  timeline: Array<{
    timestamp: string;
    event: string;
    run_id?: string;
    component: string;
    details: any;
  }>;
}

interface ExportOptions {
  format: 'json' | 'csv' | 'html';
  includeMetrics: boolean;
  includeTimeline: boolean;
  filterByComponent?: string[];
  filterByRunId?: string[];
  canonicalRunId?: string; // Override run_id to use from session report
  timeRange?: {
    start: string;
    end: string;
  };
}

interface RenderOptions {
  title: string;
  includeStats: boolean;
  includeTimeline: boolean;
  theme?: 'light' | 'dark';
}

export class ObservabilityExporter {
  async exportTrace(runLogsDir: string, options: ExportOptions): Promise<TraceTree> {
    const logFiles = globSync(join(runLogsDir, '*.jsonl'));
    const traceTree: TraceTree = {
      runs: {},
      global_summary: {
        total_runs: 0,
        total_operations: 0,
        total_cost_usd: 0,
        total_duration_ms: 0
      },
      timeline: []
    };

    for (const logFile of logFiles) {
      await this.processLogFile(logFile, traceTree, options);
    }

    this.computeGlobalSummary(traceTree);
    this.buildTimeline(traceTree, options);

    return traceTree;
  }

  private async processLogFile(
    logFile: string,
    traceTree: TraceTree,
    options: ExportOptions
  ): Promise<void> {
    try {
      const content = await fs.readFile(logFile, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const entry: TraceEntry = JSON.parse(line);

          // Apply filters
          if (options.filterByComponent &&
              !options.filterByComponent.includes(entry.component)) {
            continue;
          }

          if (options.filterByRunId && entry.run_id &&
              !options.filterByRunId.includes(entry.run_id)) {
            continue;
          }

          if (options.timeRange) {
            const entryTime = new Date(entry.timestamp);
            const startTime = new Date(options.timeRange.start);
            const endTime = new Date(options.timeRange.end);

            if (entryTime < startTime || entryTime > endTime) {
              continue;
            }
          }

          // Group by run_id (use canonical if provided)
          const runId = options.canonicalRunId || entry.run_id || 'unknown';
          if (!traceTree.runs[runId]) {
            traceTree.runs[runId] = {
              run_id: runId,
              start_time: entry.timestamp,
              end_time: entry.timestamp,
              duration_ms: 0,
              total_cost_usd: 0,
              operations: [],
              agents: {},
              summary: {
                total_operations: 0,
                successful_operations: 0,
                failed_operations: 0,
                components: []
              }
            };
          }

          const run = traceTree.runs[runId];

          // Update run metadata
          if (entry.timestamp < run.start_time) {
            run.start_time = entry.timestamp;
          }
          if (entry.timestamp > run.end_time) {
            run.end_time = entry.timestamp;
          }

          // Add operation (all entries for full trace)
          run.operations.push(entry);

          // Count only top-level spans as operations
          const isTopLevel = this.isTopLevelSpan(entry);
          if (isTopLevel) {
            // Check if this is a retry of an existing operation
            const existingOpIndex = run.topLevelOps?.findIndex(op =>
              entry.op_id && op.op_id === entry.op_id
            );

            if (!run.topLevelOps) {
              run.topLevelOps = [];
            }

            if (existingOpIndex !== undefined && existingOpIndex >= 0 && entry.op_id) {
              // Merge retry into existing operation (keep latest status/cost)
              run.topLevelOps[existingOpIndex] = entry;
            } else {
              // New top-level operation
              run.topLevelOps.push(entry);
            }

            // Recompute summary based on unique top-level operations
            run.summary.total_operations = run.topLevelOps.length;
            run.summary.successful_operations = run.topLevelOps.filter(op =>
              op.status === 'completed' || op.status === 'success'
            ).length;
            run.summary.failed_operations = run.topLevelOps.filter(op =>
              op.status === 'failed' || op.status === 'error'
            ).length;
          }

          // Track components
          if (!run.summary.components.includes(entry.component)) {
            run.summary.components.push(entry.component);
          }

          // Track costs
          if (entry.cost_usd) {
            run.total_cost_usd += entry.cost_usd;
          }

          // Track agent stats
          if (entry.agent_id) {
            if (!run.agents[entry.agent_id]) {
              run.agents[entry.agent_id] = {
                agent_id: entry.agent_id,
                operations: 0,
                total_cost_usd: 0,
                total_latency_ms: 0
              };
            }

            const agent = run.agents[entry.agent_id];
            agent.operations++;
            if (entry.cost_usd) agent.total_cost_usd += entry.cost_usd;
            if (entry.latency_ms) agent.total_latency_ms += entry.latency_ms;
          }

        } catch (parseError) {
          console.warn(`Failed to parse log line: ${line.slice(0, 100)}...`);
        }
      }
    } catch (error) {
      console.warn(`Failed to process log file ${logFile}: ${error}`);
    }
  }

  private isTopLevelSpan(entry: TraceEntry): boolean {
    // Check for explicit span_kind
    if (entry.span_kind === 'root') {
      return true;
    }
    if (entry.span_kind === 'child') {
      return false;
    }

    // Check for explicit is_root flag
    if (entry.is_root === true) {
      return true;
    }
    if (entry.is_root === false) {
      return false;
    }

    // Check for parentId (null/undefined means root)
    if (entry.parentId === null || entry.parentId === undefined) {
      return true;
    }

    // Default: treat as top-level if no span markers present (v1 logs)
    // But we'll handle this in the checker by setting SKIP instead
    return false;
  }

  private computeGlobalSummary(traceTree: TraceTree): void {
    const summary = traceTree.global_summary;
    summary.total_runs = Object.keys(traceTree.runs).length;

    let mostExpensive: TraceEntry | undefined;
    let slowest: TraceEntry | undefined;

    for (const run of Object.values(traceTree.runs)) {
      // Compute run duration
      const startTime = new Date(run.start_time).getTime();
      const endTime = new Date(run.end_time).getTime();
      run.duration_ms = endTime - startTime;

      // Round run cost to 2 decimal places for consistency
      run.total_cost_usd = Math.round(run.total_cost_usd * 100) / 100;

      summary.total_operations += run.summary.total_operations;
      summary.total_cost_usd += run.total_cost_usd;
      summary.total_duration_ms += run.duration_ms;

      // Find most expensive and slowest operations
      for (const op of run.operations) {
        if (op.cost_usd && (!mostExpensive || op.cost_usd > (mostExpensive.cost_usd || 0))) {
          mostExpensive = op;
        }
        if (op.latency_ms && (!slowest || op.latency_ms > (slowest.latency_ms || 0))) {
          slowest = op;
        }
      }
    }

    // Round global summary cost to 2 decimal places
    summary.total_cost_usd = Math.round(summary.total_cost_usd * 100) / 100;

    if (mostExpensive) summary.most_expensive_operation = mostExpensive;
    if (slowest) summary.slowest_operation = slowest;
  }

  private buildTimeline(traceTree: TraceTree, options: ExportOptions): void {
    if (!options.includeTimeline) return;

    const allOperations: Array<{
      timestamp: string;
      event: string;
      run_id: string;
      component: string;
      details: any;
    }> = [];

    for (const run of Object.values(traceTree.runs)) {
      for (const op of run.operations) {
        allOperations.push({
          timestamp: op.timestamp,
          event: op.operation || op.level || 'operation',
          run_id: run.run_id,
          component: op.component,
          details: {
            agent_id: op.agent_id,
            agent_role: op.agent_role,
            status: op.status,
            cost_usd: op.cost_usd,
            latency_ms: op.latency_ms
          }
        });
      }
    }

    // Sort by timestamp
    allOperations.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    traceTree.timeline = allOperations;
  }

  async renderHTML(traceData: TraceTree, options: RenderOptions): Promise<string> {
    const theme = options.theme || 'light';
    const themeColors = theme === 'dark' ? {
      bg: '#1a1a1a',
      text: '#ffffff',
      card: '#2d2d2d',
      border: '#404040',
      accent: '#4f46e5'
    } : {
      bg: '#ffffff',
      text: '#000000',
      card: '#f8fafc',
      border: '#e2e8f0',
      accent: '#4f46e5'
    };

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${options.title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: ${themeColors.bg};
            color: ${themeColors.text};
            margin: 0;
            padding: 20px;
            line-height: 1.6;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 40px; }
        .card {
            background: ${themeColors.card};
            border: 1px solid ${themeColors.border};
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .metric { text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; color: ${themeColors.accent}; }
        .metric-label { color: #666; margin-top: 5px; }
        .table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid ${themeColors.border}; }
        .table th { background-color: ${themeColors.border}; font-weight: 600; }
        .status-success { color: #10b981; }
        .status-failed { color: #ef4444; }
        .status-pending { color: #f59e0b; }
        .timeline-item {
            padding: 10px;
            border-left: 3px solid ${themeColors.accent};
            margin-bottom: 10px;
            background: ${themeColors.card};
        }
        .timeline-time { font-weight: bold; color: ${themeColors.accent}; }
        .timeline-details { font-size: 0.9em; color: #666; margin-top: 5px; }
        .expand-btn {
            background: ${themeColors.accent};
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 4px;
            cursor: pointer;
        }
        .expandable { display: none; }
        .expandable.show { display: block; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${options.title}</h1>
            <p>Generated: ${new Date().toISOString()}</p>
        </div>

        ${options.includeStats ? this.renderStats(traceData, themeColors) : ''}

        ${this.renderRunDetails(traceData)}

        ${options.includeTimeline ? this.renderTimeline(traceData) : ''}
    </div>

    <script>
        function toggleExpand(id) {
            const element = document.getElementById(id);
            element.classList.toggle('show');
        }
    </script>
</body>
</html>`;
  }

  private renderStats(traceData: TraceTree, colors: any): string {
    const summary = traceData.global_summary;

    return `
        <div class="card">
            <h2>Global Summary</h2>
            <div class="grid">
                <div class="metric">
                    <div class="metric-value">${summary.total_runs}</div>
                    <div class="metric-label">Total Runs</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${summary.total_operations}</div>
                    <div class="metric-label">Total Operations</div>
                </div>
                <div class="metric">
                    <div class="metric-value">$${summary.total_cost_usd.toFixed(4)}</div>
                    <div class="metric-label">Total Cost</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${(summary.total_duration_ms / 1000).toFixed(1)}s</div>
                    <div class="metric-label">Total Duration</div>
                </div>
            </div>
        </div>`;
  }

  private renderRunDetails(traceData: TraceTree): string {
    let html = '<div class="card"><h2>Run Details</h2>';

    for (const [runId, run] of Object.entries(traceData.runs)) {
      const successRate = run.summary.total_operations > 0
        ? (run.summary.successful_operations / run.summary.total_operations * 100).toFixed(1)
        : '0';

      html += `
        <div class="card">
            <h3>Run: ${runId}</h3>
            <div class="grid">
                <div>
                    <strong>Duration:</strong> ${(run.duration_ms / 1000).toFixed(1)}s<br>
                    <strong>Operations:</strong> ${run.summary.total_operations}<br>
                    <strong>Success Rate:</strong> ${successRate}%<br>
                    <strong>Total Cost:</strong> $${run.total_cost_usd.toFixed(4)}
                </div>
                <div>
                    <strong>Components:</strong> ${run.summary.components.join(', ')}<br>
                    <strong>Agents:</strong> ${Object.keys(run.agents).length}<br>
                    <strong>Started:</strong> ${new Date(run.start_time).toLocaleString()}<br>
                    <strong>Ended:</strong> ${new Date(run.end_time).toLocaleString()}
                </div>
            </div>

            <button class="expand-btn" onclick="toggleExpand('run-${runId}-details')">
                Show Details
            </button>

            <div id="run-${runId}-details" class="expandable">
                <h4>Agent Statistics</h4>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Agent ID</th>
                            <th>Operations</th>
                            <th>Total Cost</th>
                            <th>Total Latency</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.values(run.agents).map(agent => `
                            <tr>
                                <td>${agent.agent_id}</td>
                                <td>${agent.operations}</td>
                                <td>$${agent.total_cost_usd.toFixed(4)}</td>
                                <td>${agent.total_latency_ms}ms</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
    }

    html += '</div>';
    return html;
  }

  private renderTimeline(traceData: TraceTree): string {
    if (!traceData.timeline.length) return '';

    let html = `
        <div class="card">
            <h2>Timeline</h2>
            <button class="expand-btn" onclick="toggleExpand('timeline-details')">
                Show Timeline (${traceData.timeline.length} events)
            </button>

            <div id="timeline-details" class="expandable">`;

    for (const event of traceData.timeline.slice(0, 100)) { // Limit to first 100 events
      const statusClass = event.details.status === 'completed' || event.details.status === 'success'
        ? 'status-success'
        : event.details.status === 'failed' || event.details.status === 'error'
        ? 'status-failed'
        : 'status-pending';

      html += `
        <div class="timeline-item">
            <div class="timeline-time">${new Date(event.timestamp).toLocaleTimeString()}</div>
            <div><strong>${event.component}</strong> - ${event.event}</div>
            <div class="timeline-details">
                Run: ${event.run_id} |
                ${event.details.agent_id ? `Agent: ${event.details.agent_id} | ` : ''}
                <span class="${statusClass}">${event.details.status || 'unknown'}</span>
                ${event.details.cost_usd ? ` | $${event.details.cost_usd.toFixed(4)}` : ''}
                ${event.details.latency_ms ? ` | ${event.details.latency_ms}ms` : ''}
            </div>
        </div>`;
    }

    html += '</div></div>';
    return html;
  }
}