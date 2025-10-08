/**
 * Runtime Profiler (Phase 3.3 - Performance Optimization)
 *
 * "측정할 수 없으면 최적화할 수 없다"
 * - ChatGPT Genius Insight
 *
 * Purpose:
 * - Profile layer-level performance
 * - Identify bottlenecks
 * - Enable data-driven optimization
 *
 * Architecture:
 * Runtime Execution → **Profiler** → Performance Metrics → Optimization
 *
 * Profiling Strategy:
 * 1. Layer-level Instrumentation
 * 2. Metric Collection (latency, throughput, errors)
 * 3. Bottleneck Detection
 * 4. Report Generation
 *
 * Expected Gain: p95 latency -20%, Throughput +30%
 *
 * @see ChatGPT Master Directive: "Measure Everything"
 */

/**
 * Layer Types
 */
export type LayerType = 'L1-Retrieval' | 'L2-Synthesizer' | 'L3-Planner' | 'L4-Optimizer';

/**
 * Performance Metrics
 */
export interface PerformanceMetrics {
  // Timing
  duration: number; // ms
  startTime: number; // timestamp
  endTime: number; // timestamp

  // Throughput
  itemsProcessed: number;
  throughput: number; // items/sec

  // Quality
  successRate: number; // 0-1
  errorRate: number; // 0-1

  // Resource
  memoryUsed?: number; // bytes
  cpuTime?: number; // ms
}

/**
 * Layer Profile
 */
export interface LayerProfile {
  layer: LayerType;
  operation: string; // e.g., "rerank", "nli-verify", "feedback-interpret"

  // Metrics
  metrics: PerformanceMetrics;

  // Context
  context: {
    runId: string;
    timestamp: Date;
    inputSize?: number;
    outputSize?: number;
  };
}

/**
 * Profiling Session
 */
export interface ProfilingSession {
  id: string;
  runId: string;
  startTime: Date;
  endTime?: Date;

  // Profiles
  profiles: LayerProfile[];

  // Aggregates
  summary?: SessionSummary;
}

/**
 * Session Summary
 */
export interface SessionSummary {
  // Overall
  totalDuration: number; // ms
  totalLayers: number;

  // Per-layer breakdown
  layerBreakdown: Record<LayerType, {
    count: number;
    totalDuration: number;
    avgDuration: number;
    maxDuration: number;
    percentage: number; // % of total time
  }>;

  // Bottlenecks
  bottlenecks: Bottleneck[];

  // Performance
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;

  // Quality
  overallSuccessRate: number;
  overallErrorRate: number;
}

/**
 * Bottleneck
 */
export interface Bottleneck {
  layer: LayerType;
  operation: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  impact: number; // ms (time impact)
  recommendation: string;
}

/**
 * Profiler Config
 */
export interface RuntimeProfilerConfig {
  // Collection
  enableProfiling: boolean; // Default: true
  sampleRate: number; // Default: 1.0 (100%)

  // Storage
  maxSessions: number; // Default: 100
  autoSaveReports: boolean; // Default: true
  reportPath: string; // Default: "reports/performance-metrics.json"

  // Analysis
  bottleneckThreshold: number; // Default: 500ms
  p95Target: number; // Default: 3000ms
}

/**
 * Runtime Profiler
 *
 * Profiles runtime performance at layer level
 */
export class RuntimeProfiler {
  private config: RuntimeProfilerConfig;
  private sessions: Map<string, ProfilingSession> = new Map();
  private currentSession: ProfilingSession | null = null;

  constructor(config?: Partial<RuntimeProfilerConfig>) {
    this.config = {
      enableProfiling: config?.enableProfiling ?? true,
      sampleRate: config?.sampleRate ?? 1.0,
      maxSessions: config?.maxSessions ?? 100,
      autoSaveReports: config?.autoSaveReports ?? true,
      reportPath: config?.reportPath ?? 'reports/performance-metrics.json',
      bottleneckThreshold: config?.bottleneckThreshold ?? 500,
      p95Target: config?.p95Target ?? 3000,
    };
  }

  /**
   * Start profiling session
   */
  startSession(runId: string): string {
    if (!this.config.enableProfiling) {
      return '';
    }

    // Check sample rate
    if (Math.random() > this.config.sampleRate) {
      return '';
    }

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    this.currentSession = {
      id: sessionId,
      runId,
      startTime: new Date(),
      profiles: [],
    };

    this.sessions.set(sessionId, this.currentSession);

    // Cleanup old sessions
    if (this.sessions.size > this.config.maxSessions) {
      const oldestKey = Array.from(this.sessions.keys())[0];
      this.sessions.delete(oldestKey);
    }

    return sessionId;
  }

  /**
   * End profiling session
   */
  endSession(sessionId: string): SessionSummary | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    session.endTime = new Date();

    // Generate summary
    session.summary = this.generateSummary(session);

    // Auto-save if enabled
    if (this.config.autoSaveReports) {
      this.saveReport(session);
    }

    // Clear current session
    if (this.currentSession?.id === sessionId) {
      this.currentSession = null;
    }

    return session.summary;
  }

  /**
   * Profile layer operation
   */
  async profile<T>(
    layer: LayerType,
    operation: string,
    fn: () => Promise<T>,
    context?: Partial<LayerProfile['context']>
  ): Promise<T> {
    if (!this.config.enableProfiling || !this.currentSession) {
      return fn();
    }

    const startTime = Date.now();
    const startMemory = this.getMemoryUsage();

    let result: T;
    let error: Error | null = null;

    try {
      result = await fn();
    } catch (err) {
      error = err as Error;
      throw err;
    } finally {
      const endTime = Date.now();
      const endMemory = this.getMemoryUsage();
      const duration = endTime - startTime;

      const profile: LayerProfile = {
        layer,
        operation,
        metrics: {
          duration,
          startTime,
          endTime,
          itemsProcessed: 1, // Default
          throughput: 1000 / duration, // items/sec
          successRate: error ? 0 : 1,
          errorRate: error ? 1 : 0,
          memoryUsed: endMemory - startMemory,
        },
        context: {
          runId: this.currentSession.runId,
          timestamp: new Date(),
          ...context,
        },
      };

      this.currentSession.profiles.push(profile);
    }

    return result!;
  }

  /**
   * Record layer metrics (manual)
   */
  recordMetrics(
    layer: LayerType,
    operation: string,
    metrics: Partial<PerformanceMetrics>,
    context?: Partial<LayerProfile['context']>
  ): void {
    if (!this.config.enableProfiling || !this.currentSession) {
      return;
    }

    const profile: LayerProfile = {
      layer,
      operation,
      metrics: {
        duration: metrics.duration ?? 0,
        startTime: metrics.startTime ?? Date.now(),
        endTime: metrics.endTime ?? Date.now(),
        itemsProcessed: metrics.itemsProcessed ?? 1,
        throughput: metrics.throughput ?? 0,
        successRate: metrics.successRate ?? 1,
        errorRate: metrics.errorRate ?? 0,
        memoryUsed: metrics.memoryUsed,
        cpuTime: metrics.cpuTime,
      },
      context: {
        runId: this.currentSession.runId,
        timestamp: new Date(),
        ...context,
      },
    };

    this.currentSession.profiles.push(profile);
  }

  /**
   * Generate session summary
   */
  private generateSummary(session: ProfilingSession): SessionSummary {
    const totalDuration =
      session.endTime && session.startTime
        ? session.endTime.getTime() - session.startTime.getTime()
        : 0;

    // Layer breakdown
    const layerBreakdown: SessionSummary['layerBreakdown'] = {} as SessionSummary['layerBreakdown'];

    const layers: LayerType[] = ['L1-Retrieval', 'L2-Synthesizer', 'L3-Planner', 'L4-Optimizer'];

    layers.forEach((layer) => {
      const layerProfiles = session.profiles.filter((p) => p.layer === layer);
      const layerDuration = layerProfiles.reduce((sum, p) => sum + p.metrics.duration, 0);

      layerBreakdown[layer] = {
        count: layerProfiles.length,
        totalDuration: layerDuration,
        avgDuration:
          layerProfiles.length > 0 ? layerDuration / layerProfiles.length : 0,
        maxDuration:
          layerProfiles.length > 0
            ? Math.max(...layerProfiles.map((p) => p.metrics.duration))
            : 0,
        percentage: totalDuration > 0 ? (layerDuration / totalDuration) * 100 : 0,
      };
    });

    // Bottlenecks
    const bottlenecks = this.detectBottlenecks(session);

    // Percentiles
    const durations = session.profiles
      .map((p) => p.metrics.duration)
      .sort((a, b) => a - b);

    const p50Latency = this.percentile(durations, 0.5);
    const p95Latency = this.percentile(durations, 0.95);
    const p99Latency = this.percentile(durations, 0.99);

    // Success/Error rates
    const totalOps = session.profiles.length;
    const successCount = session.profiles.filter((p) => p.metrics.successRate > 0.5).length;

    return {
      totalDuration,
      totalLayers: session.profiles.length,
      layerBreakdown,
      bottlenecks,
      p50Latency,
      p95Latency,
      p99Latency,
      overallSuccessRate: totalOps > 0 ? successCount / totalOps : 0,
      overallErrorRate: totalOps > 0 ? (totalOps - successCount) / totalOps : 0,
    };
  }

  /**
   * Detect bottlenecks
   */
  private detectBottlenecks(session: ProfilingSession): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];

    // Group by layer + operation
    const operations = new Map<string, LayerProfile[]>();

    session.profiles.forEach((profile) => {
      const key = `${profile.layer}:${profile.operation}`;
      if (!operations.has(key)) {
        operations.set(key, []);
      }
      operations.get(key)!.push(profile);
    });

    // Check each operation
    operations.forEach((profiles, key) => {
      const [layer, operation] = key.split(':') as [LayerType, string];
      const avgDuration =
        profiles.reduce((sum, p) => sum + p.metrics.duration, 0) / profiles.length;

      if (avgDuration > this.config.bottleneckThreshold) {
        bottlenecks.push({
          layer,
          operation,
          severity:
            avgDuration > this.config.bottleneckThreshold * 2
              ? 'critical'
              : avgDuration > this.config.bottleneckThreshold * 1.5
              ? 'high'
              : 'medium',
          description: `${layer}:${operation} avg ${avgDuration.toFixed(0)}ms (threshold: ${this.config.bottleneckThreshold}ms)`,
          impact: avgDuration,
          recommendation: this.getOptimizationRecommendation(layer, operation, avgDuration),
        });
      }
    });

    return bottlenecks.sort((a, b) => b.impact - a.impact);
  }

  /**
   * Get optimization recommendation
   */
  private getOptimizationRecommendation(
    layer: LayerType,
    operation: string,
    avgDuration: number
  ): string {
    if (layer === 'L1-Retrieval') {
      if (operation.includes('rerank')) {
        return 'Consider batch reranking or reducing topK';
      }
      return 'Optimize retrieval strategy (reduce search space or use caching)';
    }

    if (layer === 'L2-Synthesizer') {
      return 'Consider caching synthesis results or reducing LLM calls';
    }

    if (layer === 'L3-Planner') {
      if (operation.includes('nli')) {
        return 'Reduce NLI verification scope or use faster model';
      }
      return 'Optimize planning logic or parallelize steps';
    }

    if (layer === 'L4-Optimizer') {
      return 'Reduce feedback complexity or optimize bandit exploration';
    }

    return `Operation taking ${avgDuration.toFixed(0)}ms - investigate and optimize`;
  }

  /**
   * Calculate percentile
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;

    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  /**
   * Get memory usage
   */
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }

  /**
   * Save report to file
   */
  private saveReport(session: ProfilingSession): void {
    // Implementation depends on environment
    // For now, just log
    console.log('[RuntimeProfiler] Session report:', {
      id: session.id,
      summary: session.summary,
    });
  }

  /**
   * Get session
   */
  getSession(sessionId: string): ProfilingSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all sessions
   */
  getAllSessions(): ProfilingSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get configuration
   */
  getConfig(): RuntimeProfilerConfig {
    return { ...this.config };
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalSessions: number;
    totalProfiles: number;
    avgProfilesPerSession: number;
    avgP95Latency: number;
  } {
    const totalSessions = this.sessions.size;
    const totalProfiles = Array.from(this.sessions.values()).reduce(
      (sum, s) => sum + s.profiles.length,
      0
    );

    const p95Latencies = Array.from(this.sessions.values())
      .filter((s) => s.summary)
      .map((s) => s.summary!.p95Latency);

    const avgP95Latency =
      p95Latencies.length > 0
        ? p95Latencies.reduce((sum, p) => sum + p, 0) / p95Latencies.length
        : 0;

    return {
      totalSessions,
      totalProfiles,
      avgProfilesPerSession:
        totalSessions > 0 ? totalProfiles / totalSessions : 0,
      avgP95Latency,
    };
  }
}

/**
 * Default singleton instance
 */
export const runtimeProfiler = new RuntimeProfiler();
