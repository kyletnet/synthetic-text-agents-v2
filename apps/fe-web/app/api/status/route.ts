import { NextRequest, NextResponse } from "next/server";
import { getLLMStats, getLLMDiagnostics } from "@/lib/llm-call-manager";
import { ExecutionVerifier } from "@/lib/execution-verifier";
import { APIGuard, withAPIGuard } from "@/lib/api-guard";
import { apiKeyManager } from "@/lib/api-key-manager";
import { selfHealingEngine } from "@/lib/self-healing-engine";
import { circuitBreakerRegistry } from "@/lib/circuit-breaker";
import { backgroundTaskManager } from "@/lib/background-task-manager";

export interface SystemStatus {
  timestamp: string;
  status: "healthy" | "warning" | "critical";
  version: string;
  environment: string;
  llm: {
    configured: boolean;
    fallbackRate: number;
    successRate: number;
    totalCalls: number;
    lastCallTime?: string;
    currentSource: "llm" | "fallback" | "mixed";
    keyManagement: {
      totalKeys: number;
      activeKeys: number;
      failedKeys: number;
      rotationCount: number;
      canServeRequests: boolean;
    };
  };
  system: {
    strictMode: boolean;
    mockContaminationRisk: "none" | "low" | "high" | "critical";
    nodeEnv: string;
    apiGuardStatus: "healthy" | "degraded" | "critical";
  };
  selfHealing: {
    enabled: boolean;
    isDormant: boolean;
    dormantReason?: string;
    dormantSince?: string;
    consecutiveFailures: number;
    backoffDelay: number;
    totalAttempts: number;
    successfulHealings: number;
    failedHealings: number;
    lastHealingTime?: string;
  };
  circuitBreakers: Array<{
    name: string;
    state: "CLOSED" | "OPEN" | "HALF_OPEN" | "PERMANENT_OPEN";
    failureCount: number;
    lastFailureAgo?: string;
    permanentOpenReason?: string;
    permanentOpenSince?: string;
  }>;
  backgroundTasks: {
    totalTasks: number;
    activeTasks: number;
    disabledTasks: number;
    totalExecutions: number;
    failedExecutions: number;
    tasks: Array<{
      id: string;
      type: string;
      enabled: boolean;
      executionCount: number;
      uptime: number;
      lastError?: string;
    }>;
  };
  uptime: {
    startTime: string;
    uptimeSeconds: number;
  };
  issues?: string[];
  recommendations?: string[];
}

/**
 * System status endpoint with LLM configuration and fallback rate
 * GET /api/status
 */
async function statusHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const timestamp = new Date().toISOString();

    // LLM 상태 수집
    const llmStats = getLLMStats(60); // 최근 1시간
    const llmDiagnostics = getLLMDiagnostics();
    const envPolicy = ExecutionVerifier.checkEnvironmentPolicy();

    // API Key Manager 상태 수집
    const keyStats = apiKeyManager.getStats();
    const apiGuardStatus = APIGuard.getSystemStatus();

    // Self-Healing Engine 상태 수집
    const healingStats = selfHealingEngine.getHealingStats();
    const dormantStatus = selfHealingEngine.getDormantStatus();

    // Circuit Breakers 상태 수집
    const allBreakers = circuitBreakerRegistry.getAll();
    const breakerStates = allBreakers.map((breaker) => {
      const state = breaker.getState();
      const timeSinceFailure = state.lastFailureTime
        ? Math.round((Date.now() - state.lastFailureTime) / 1000)
        : undefined;

      return {
        name: breaker.getStatus().split(":")[0],
        state: state.state,
        failureCount: state.failureCount,
        lastFailureAgo: timeSinceFailure ? `${timeSinceFailure}s` : undefined,
        permanentOpenReason: state.permanentOpenReason,
        permanentOpenSince: state.permanentOpenTimestamp
          ? new Date(state.permanentOpenTimestamp).toISOString()
          : undefined,
      };
    });

    // Background Tasks 상태 수집
    const taskStats = backgroundTaskManager.getStats();
    const taskList = backgroundTaskManager.listTasks();
    const backgroundTasksInfo = {
      ...taskStats,
      tasks: taskList.map((task) => ({
        id: task.id,
        type: task.type,
        enabled: task.enabled,
        executionCount: task.executionCount,
        uptime: Math.round(task.uptime / 1000), // seconds
        lastError: task.lastError,
      })),
    };

    // API 키 설정 확인 - 이제 API Key Manager 기반
    const apiKeyConfigured = keyStats.totalKeys > 0;
    const hasActiveKeys = keyStats.activeKeys > 0;

    // Fallback Rate 계산
    const fallbackRate =
      llmStats.totalCalls > 0
        ? Math.round((llmStats.fallbackCalls / llmStats.totalCalls) * 100)
        : 0;

    const successRate =
      llmStats.totalCalls > 0
        ? Math.round((llmStats.successfulCalls / llmStats.totalCalls) * 100)
        : 0;

    // 현재 소스 상태 판단
    let currentSource: "llm" | "fallback" | "mixed" = "llm";
    if (fallbackRate >= 80) {
      currentSource = "fallback";
    } else if (fallbackRate > 0) {
      currentSource = "mixed";
    }

    // Mock 오염 위험도 평가 - 강화된 로직
    let mockContaminationRisk: "none" | "low" | "high" | "critical" = "none";
    if (!envPolicy.strictMode && process.env.NODE_ENV === "production") {
      mockContaminationRisk = "critical";
    } else if (!apiKeyConfigured || !hasActiveKeys) {
      mockContaminationRisk = "critical"; // API 키가 없거나 활성 키가 없으면 critical
    } else if (keyStats.activeKeys < keyStats.totalKeys / 2) {
      mockContaminationRisk = "high"; // 절반 이상의 키가 실패하면 high
    } else if (fallbackRate > 50) {
      mockContaminationRisk = "high";
    } else if (fallbackRate > 20 || keyStats.failedKeys > 0) {
      mockContaminationRisk = "low";
    }

    // 마지막 호출 시간 계산
    const lastCallTime =
      llmStats.totalCalls > 0 && llmStats.recentFailures.length > 0
        ? llmStats.recentFailures[0].metadata.timestamp
        : undefined;

    // 시스템 상태 결정 - API Key Manager + Self-Healing 통합
    const issues: string[] = [];
    const recommendations: string[] = [];
    let overallStatus: "healthy" | "warning" | "critical" = "healthy";

    // Dormant Mode 체크 (최우선)
    if (healingStats.isDormant) {
      issues.push(
        `CRITICAL: Self-Healing Engine in DORMANT mode - ${healingStats.dormantReason}`,
      );
      recommendations.push(
        "Call POST /api/system/heal/resume with valid reason to resume",
      );
      recommendations.push("Verify API keys are configured before resuming");
      overallStatus = "critical";
    }

    // Circuit Breaker PERMANENT_OPEN 체크
    const permanentOpenBreakers = breakerStates.filter(
      (b) => b.state === "PERMANENT_OPEN",
    );
    if (permanentOpenBreakers.length > 0) {
      permanentOpenBreakers.forEach((breaker) => {
        issues.push(
          `CRITICAL: Circuit Breaker '${breaker.name}' PERMANENTLY OPEN - ${breaker.permanentOpenReason}`,
        );
      });
      recommendations.push(
        "Manual intervention required - check circuit breaker status",
      );
      if (overallStatus !== "critical") overallStatus = "critical";
    }

    // Background Task 과부하 체크
    if (taskStats.totalTasks > 10) {
      issues.push(
        `WARNING: Excessive background tasks (${taskStats.totalTasks}/10 limit)`,
      );
      recommendations.push(
        "Review background task list - possible memory leak",
      );
      if (overallStatus === "healthy") overallStatus = "warning";
    }

    // 연속 실패 체크
    if (healingStats.consecutiveFailures >= 5) {
      issues.push(
        `WARNING: Self-Healing has ${healingStats.consecutiveFailures} consecutive failures`,
      );
      recommendations.push(
        "System approaching Dormant Mode threshold (10 failures)",
      );
      if (overallStatus === "healthy") overallStatus = "warning";
    }

    if (mockContaminationRisk === "critical") {
      if (!envPolicy.strictMode && process.env.NODE_ENV === "production") {
        issues.push("CRITICAL: Production environment without strict mode");
      } else if (!apiKeyConfigured) {
        issues.push(
          "CRITICAL: No API keys configured - system cannot function",
        );
        recommendations.push("Add ANTHROPIC_API_KEY to environment variables");
      } else if (!hasActiveKeys) {
        issues.push("CRITICAL: All API keys disabled - system cannot function");
        recommendations.push("Check API key validity and rotation status");
      }
      overallStatus = "critical";
    } else if (apiGuardStatus.status === "critical") {
      issues.push(`CRITICAL: API Guard - ${apiGuardStatus.message}`);
      overallStatus = "critical";
    } else if (keyStats.activeKeys < keyStats.totalKeys / 2) {
      issues.push(
        `WARNING: ${keyStats.failedKeys}/${keyStats.totalKeys} API keys failed - reduced capacity`,
      );
      recommendations.push("Add backup API keys for redundancy");
      if (overallStatus === "healthy") overallStatus = "warning";
    } else if (fallbackRate > 30) {
      issues.push(`HIGH: Fallback rate too high (${fallbackRate}%)`);
      if (overallStatus === "healthy") overallStatus = "warning";
    } else if (llmDiagnostics.status !== "healthy") {
      issues.push(`LLM System: ${llmDiagnostics.status}`);
      if (llmDiagnostics.status === "critical") {
        overallStatus = "critical";
      } else if (overallStatus === "healthy") {
        overallStatus = "warning";
      }
    } else if (keyStats.failedKeys > 0) {
      issues.push(
        `INFO: ${keyStats.failedKeys} API keys disabled but system functional`,
      );
    }

    // Feature Flag 상태 추가
    if (
      !healingStats.isDormant &&
      process.env.FEATURE_AUTO_HEALING_ENABLED === "false"
    ) {
      recommendations.push(
        "Auto-healing is disabled - manual intervention may be required",
      );
    }

    // 업타임 계산 (프로세스 시작 시간 기준)
    const uptimeSeconds = Math.floor(process.uptime());
    const startTime = new Date(Date.now() - uptimeSeconds * 1000).toISOString();

    const systemStatus: SystemStatus = {
      timestamp,
      status: overallStatus,
      version: process.env.npm_package_version || "unknown",
      environment: process.env.NODE_ENV || "unknown",
      llm: {
        configured: apiKeyConfigured,
        fallbackRate,
        successRate,
        totalCalls: llmStats.totalCalls,
        lastCallTime,
        currentSource,
        keyManagement: {
          totalKeys: keyStats.totalKeys,
          activeKeys: keyStats.activeKeys,
          failedKeys: keyStats.failedKeys,
          rotationCount: keyStats.rotationCount,
          canServeRequests: apiGuardStatus.canServeRequests,
        },
      },
      system: {
        strictMode: envPolicy.strictMode,
        mockContaminationRisk,
        nodeEnv: process.env.NODE_ENV || "unknown",
        apiGuardStatus: apiGuardStatus.status,
      },
      selfHealing: {
        enabled: process.env.FEATURE_AUTO_HEALING_ENABLED !== "false",
        isDormant: healingStats.isDormant,
        dormantReason: healingStats.dormantReason,
        dormantSince: dormantStatus?.timestamp.toISOString(),
        consecutiveFailures: healingStats.consecutiveFailures,
        backoffDelay: healingStats.backoffDelay,
        totalAttempts: healingStats.totalHealingAttempts,
        successfulHealings: healingStats.successfulHealings,
        failedHealings: healingStats.failedHealings,
        lastHealingTime: healingStats.lastHealingTime?.toISOString(),
      },
      circuitBreakers: breakerStates,
      backgroundTasks: backgroundTasksInfo,
      uptime: {
        startTime,
        uptimeSeconds,
      },
      ...(issues.length > 0 && { issues }),
      ...(recommendations.length > 0 && { recommendations }),
    };

    // 상태 코드 결정
    const statusCode =
      overallStatus === "critical"
        ? 503
        : overallStatus === "warning"
        ? 207
        : 200;

    return NextResponse.json(systemStatus, { status: statusCode });
  } catch (error) {
    console.error("Status endpoint error:", error);

    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        status: "critical",
        error: "Status check failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// API Guard를 적용한 GET 핸들러 export
export const GET = withAPIGuard(statusHandler);
