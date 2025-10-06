/**
 * 🔍 Execution Tracer - LLM 실행 투명성 & 소스 추적 시스템
 *
 * 모든 LLM 호출의 완전한 감사 추적 제공
 * - 실행 체인 추적
 * - 소스 검증
 * - 성능 메트릭
 * - 비용 계산
 */

// Edge runtime 호환성을 위해 조건부 import
let fs: any;
let path: any;

try {
  fs = require("fs");
  path = require("path");
} catch (e) {
  // Edge runtime에서는 사용 불가
  console.log(
    "📝 [ExecutionTracer] Running in edge runtime - file operations disabled",
  );
}

export interface ExecutionTrace {
  traceId: string;
  parentTraceId?: string;
  executionId: string;
  timestamp: Date;
  source: {
    type: "api" | "middleware" | "guard" | "direct";
    origin: string;
    userAgent?: string;
    ipAddress?: string;
  };
  llmCall: {
    provider: "anthropic" | "openai" | "mock";
    model: string;
    endpoint: string;
    apiKeyUsed: string; // Last 4 characters
    tokensInput: number;
    tokensOutput: number;
    cost: number;
    latency: number;
  };
  context: {
    route: string;
    sessionId?: string;
    userId?: string;
    feature: string;
  };
  verification: {
    guardPassed: boolean;
    middlewarePassed: boolean;
    authorityGranted: boolean;
    mockBlocked: boolean;
  };
  metadata: {
    environment: "development" | "production" | "test";
    version: string;
    gitCommit?: string;
    buildId?: string;
  };
}

export interface ExecutionSummary {
  totalCalls: number;
  totalCost: number;
  totalTokens: number;
  averageLatency: number;
  providerBreakdown: Record<string, number>;
  routeBreakdown: Record<string, number>;
  timeRange: {
    start: Date;
    end: Date;
  };
}

export class ExecutionTracer {
  private static instance: ExecutionTracer;
  private traces: Map<string, ExecutionTrace> = new Map();
  private logPath: string;
  private maxTraces: number = 10000;
  private flushInterval: number = 30000; // 30 seconds

  constructor() {
    if (path && typeof process !== "undefined" && process.cwd) {
      this.logPath = path.join(process.cwd(), "logs", "execution-traces.jsonl");
      this.ensureLogDirectory();
      this.startPeriodicFlush();
    } else {
      this.logPath = "/tmp/execution-traces.jsonl"; // fallback for edge runtime
      console.log(
        "📝 [ExecutionTracer] Running in edge runtime - using in-memory trace storage",
      );
    }
  }

  static getInstance(): ExecutionTracer {
    if (!ExecutionTracer.instance) {
      ExecutionTracer.instance = new ExecutionTracer();
    }
    return ExecutionTracer.instance;
  }

  /**
   * 🎯 새로운 실행 추적 시작
   */
  startTrace(context: {
    source: ExecutionTrace["source"];
    context: ExecutionTrace["context"];
    parentTraceId?: string;
  }): string {
    const traceId = `trace_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const trace: Partial<ExecutionTrace> = {
      traceId,
      parentTraceId: context.parentTraceId,
      timestamp: new Date(),
      source: context.source,
      context: context.context,
      verification: {
        guardPassed: false,
        middlewarePassed: false,
        authorityGranted: false,
        mockBlocked: false,
      },
      metadata: {
        environment:
          process.env.NODE_ENV === "production" ? "production" : "development",
        version: process.env.npm_package_version || "1.0.0",
        gitCommit: process.env.VERCEL_GIT_COMMIT_SHA,
        buildId: process.env.BUILD_ID,
      },
    };

    this.traces.set(traceId, trace as ExecutionTrace);

    console.log(
      `🔍 [ExecutionTracer] Started trace: ${traceId} (route: ${context.context.route})`,
    );
    return traceId;
  }

  /**
   * 🛡️ 가드 검증 기록
   */
  recordGuardCheck(traceId: string, passed: boolean, guardType: string): void {
    const trace = this.traces.get(traceId);
    if (!trace) return;

    trace.verification.guardPassed = passed;

    console.log(
      `🛡️ [ExecutionTracer] Guard check (${guardType}): ${
        passed ? "PASSED" : "FAILED"
      } - ${traceId}`,
    );
  }

  /**
   * 🚪 미들웨어 검증 기록
   */
  recordMiddlewareCheck(traceId: string, passed: boolean): void {
    const trace = this.traces.get(traceId);
    if (!trace) return;

    trace.verification.middlewarePassed = passed;

    console.log(
      `🚪 [ExecutionTracer] Middleware check: ${
        passed ? "PASSED" : "FAILED"
      } - ${traceId}`,
    );
  }

  /**
   * 🔐 실행 권한 부여 기록
   */
  recordAuthorityGrant(
    traceId: string,
    granted: boolean,
    executionId: string,
  ): void {
    const trace = this.traces.get(traceId);
    if (!trace) return;

    trace.verification.authorityGranted = granted;
    trace.executionId = executionId;

    console.log(
      `🔐 [ExecutionTracer] Authority grant: ${
        granted ? "GRANTED" : "DENIED"
      } - ${traceId} (exec: ${executionId})`,
    );
  }

  /**
   * 🤖 LLM 호출 기록
   */
  recordLLMCall(traceId: string, llmCall: ExecutionTrace["llmCall"]): void {
    const trace = this.traces.get(traceId);
    if (!trace) return;

    trace.llmCall = llmCall;

    // 비용 계산
    const cost = this.calculateCost(llmCall);
    trace.llmCall.cost = cost;

    console.log(
      `🤖 [ExecutionTracer] LLM call recorded: ${llmCall.provider}/${llmCall.model} - ${traceId}`,
    );
    console.log(
      `💰 [ExecutionTracer] Cost: $${cost.toFixed(4)}, Tokens: ${
        llmCall.tokensInput
      }+${llmCall.tokensOutput}, Latency: ${llmCall.latency}ms`,
    );
  }

  /**
   * 🚫 Mock 차단 기록
   */
  recordMockBlock(traceId: string, blocked: boolean, reason: string): void {
    const trace = this.traces.get(traceId);
    if (!trace) return;

    trace.verification.mockBlocked = blocked;

    console.log(
      `🚫 [ExecutionTracer] Mock block: ${
        blocked ? "BLOCKED" : "ALLOWED"
      } - ${traceId} (${reason})`,
    );
  }

  /**
   * ✅ 추적 완료 및 플러시
   */
  finishTrace(traceId: string): ExecutionTrace | null {
    const trace = this.traces.get(traceId);
    if (!trace) return null;

    // 추적 완료 로그
    console.log(`✅ [ExecutionTracer] Trace completed: ${traceId}`);
    this.logTraceCompletion(trace);

    // 파일에 기록
    this.writeTraceToFile(trace);

    // 메모리에서 제거 (용량 관리)
    this.traces.delete(traceId);

    return trace;
  }

  /**
   * 📊 실행 요약 통계
   */
  getSummary(timeRange?: { start: Date; end: Date }): ExecutionSummary {
    const traces = Array.from(this.traces.values());
    const filteredTraces = timeRange
      ? traces.filter(
          (t) => t.timestamp >= timeRange.start && t.timestamp <= timeRange.end,
        )
      : traces;

    const summary: ExecutionSummary = {
      totalCalls: filteredTraces.length,
      totalCost: filteredTraces.reduce(
        (sum, t) => sum + (t.llmCall?.cost || 0),
        0,
      ),
      totalTokens: filteredTraces.reduce(
        (sum, t) =>
          sum + (t.llmCall?.tokensInput || 0) + (t.llmCall?.tokensOutput || 0),
        0,
      ),
      averageLatency:
        filteredTraces.reduce((sum, t) => sum + (t.llmCall?.latency || 0), 0) /
          filteredTraces.length || 0,
      providerBreakdown: {},
      routeBreakdown: {},
      timeRange: {
        start:
          timeRange?.start ||
          new Date(
            Math.min(...filteredTraces.map((t) => t.timestamp.getTime())),
          ),
        end:
          timeRange?.end ||
          new Date(
            Math.max(...filteredTraces.map((t) => t.timestamp.getTime())),
          ),
      },
    };

    // Provider breakdown
    filteredTraces.forEach((trace) => {
      if (trace.llmCall?.provider) {
        summary.providerBreakdown[trace.llmCall.provider] =
          (summary.providerBreakdown[trace.llmCall.provider] || 0) + 1;
      }
    });

    // Route breakdown
    filteredTraces.forEach((trace) => {
      const route = trace.context.route;
      summary.routeBreakdown[route] = (summary.routeBreakdown[route] || 0) + 1;
    });

    return summary;
  }

  /**
   * 🔍 특정 추적 조회
   */
  getTrace(traceId: string): ExecutionTrace | null {
    return this.traces.get(traceId) || null;
  }

  /**
   * 📈 실시간 메트릭 조회
   */
  getRealTimeMetrics(): {
    activeTraces: number;
    recentCalls: number;
    averageCost: number;
    successRate: number;
  } {
    const traces = Array.from(this.traces.values());
    const recentTraces = traces.filter(
      (t) => Date.now() - t.timestamp.getTime() < 300000,
    ); // 5 minutes

    const successfulTraces = recentTraces.filter(
      (t) =>
        t.verification.guardPassed &&
        t.verification.middlewarePassed &&
        t.verification.authorityGranted,
    );

    return {
      activeTraces: traces.length,
      recentCalls: recentTraces.length,
      averageCost:
        recentTraces.reduce((sum, t) => sum + (t.llmCall?.cost || 0), 0) /
          recentTraces.length || 0,
      successRate:
        recentTraces.length > 0
          ? successfulTraces.length / recentTraces.length
          : 0,
    };
  }

  /**
   * 💰 비용 계산 (모델별)
   */
  private calculateCost(llmCall: ExecutionTrace["llmCall"]): number {
    const rates = {
      anthropic: {
        "claude-3-5-sonnet-20240620": { input: 0.003, output: 0.015 }, // per 1K tokens
        "claude-3-haiku": { input: 0.00025, output: 0.00125 },
        "claude-3-opus": { input: 0.015, output: 0.075 },
      },
      openai: {
        "gpt-4": { input: 0.03, output: 0.06 },
        "gpt-3.5-turbo": { input: 0.001, output: 0.002 },
      },
      mock: {
        default: { input: 0, output: 0 },
      },
    };

    const providerRates = rates[llmCall.provider];
    if (!providerRates) return 0;

    const modelRates = providerRates[llmCall.model] ||
      providerRates.default || { input: 0, output: 0 };

    return (
      (llmCall.tokensInput / 1000) * modelRates.input +
      (llmCall.tokensOutput / 1000) * modelRates.output
    );
  }

  /**
   * 📁 로그 디렉토리 확보
   */
  private ensureLogDirectory(): void {
    if (!fs || !path) return;

    try {
      const logDir = path.dirname(this.logPath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    } catch (error) {
      console.warn(
        "⚠️ [ExecutionTracer] Could not create log directory (edge runtime)",
      );
    }
  }

  /**
   * 📝 파일에 추적 기록
   */
  private writeTraceToFile(trace: ExecutionTrace): void {
    if (!fs) {
      // Edge runtime에서는 메모리에만 저장
      console.log(
        `📝 [ExecutionTracer] Trace logged (memory): ${trace.traceId}`,
      );
      return;
    }

    try {
      const logLine = JSON.stringify(trace) + "\n";
      fs.appendFileSync(this.logPath, logLine, "utf8");
    } catch (error) {
      console.error(
        "🚨 [ExecutionTracer] Failed to write trace to file:",
        error,
      );
    }
  }

  /**
   * ⏰ 주기적 플러시
   */
  private startPeriodicFlush(): void {
    setInterval(() => {
      const traceCount = this.traces.size;
      if (traceCount > this.maxTraces) {
        // 오래된 추적들 정리
        const sortedTraces = Array.from(this.traces.entries()).sort(
          (a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime(),
        );

        const toRemove = sortedTraces.slice(0, traceCount - this.maxTraces);
        toRemove.forEach(([traceId, trace]) => {
          this.writeTraceToFile(trace);
          this.traces.delete(traceId);
        });

        console.log(
          `🧹 [ExecutionTracer] Cleaned up ${toRemove.length} old traces`,
        );
      }
    }, this.flushInterval);
  }

  /**
   * 📊 추적 완료 로깅
   */
  private logTraceCompletion(trace: ExecutionTrace): void {
    const duration = Date.now() - trace.timestamp.getTime();
    const status = trace.verification.authorityGranted ? "SUCCESS" : "BLOCKED";
    const cost = trace.llmCall?.cost || 0;

    console.log(`📊 [ExecutionTracer] COMPLETION SUMMARY:`);
    console.log(`   TraceID: ${trace.traceId}`);
    console.log(`   Status: ${status}`);
    console.log(`   Route: ${trace.context.route}`);
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Cost: $${cost.toFixed(4)}`);
    console.log(`   Provider: ${trace.llmCall?.provider || "none"}`);
    console.log(
      `   Verification: Guard=${trace.verification.guardPassed}, Middleware=${trace.verification.middlewarePassed}, Authority=${trace.verification.authorityGranted}`,
    );
  }
}

// 싱글톤 인스턴스 export
export const executionTracer = ExecutionTracer.getInstance();

console.log("🔍 [ExecutionTracer] Execution transparency system loaded");
