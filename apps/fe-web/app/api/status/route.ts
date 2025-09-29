import { NextRequest, NextResponse } from "next/server";
import { getLLMStats, getLLMDiagnostics } from "@/lib/llm-call-manager";
import { ExecutionVerifier } from "@/lib/execution-verifier";

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
  };
  system: {
    strictMode: boolean;
    mockContaminationRisk: "none" | "low" | "high" | "critical";
    nodeEnv: string;
  };
  uptime: {
    startTime: string;
    uptimeSeconds: number;
  };
  issues?: string[];
}

/**
 * System status endpoint with LLM configuration and fallback rate
 * GET /api/status
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const timestamp = new Date().toISOString();

    // LLM 상태 수집
    const llmStats = getLLMStats(60); // 최근 1시간
    const llmDiagnostics = getLLMDiagnostics();
    const envPolicy = ExecutionVerifier.checkEnvironmentPolicy();

    // API 키 설정 확인
    const apiKeyConfigured = Boolean(
      process.env.ANTHROPIC_API_KEY &&
      !process.env.ANTHROPIC_API_KEY.includes('your_api_key_here')
    );

    // Fallback Rate 계산
    const fallbackRate = llmStats.totalCalls > 0
      ? Math.round((llmStats.fallbackCalls / llmStats.totalCalls) * 100)
      : 0;

    const successRate = llmStats.totalCalls > 0
      ? Math.round((llmStats.successfulCalls / llmStats.totalCalls) * 100)
      : 0;

    // 현재 소스 상태 판단
    let currentSource: "llm" | "fallback" | "mixed" = "llm";
    if (fallbackRate >= 80) {
      currentSource = "fallback";
    } else if (fallbackRate > 0) {
      currentSource = "mixed";
    }

    // Mock 오염 위험도 평가
    let mockContaminationRisk: "none" | "low" | "high" | "critical" = "none";
    if (!envPolicy.strictMode && process.env.NODE_ENV === 'production') {
      mockContaminationRisk = "critical";
    } else if (fallbackRate > 50) {
      mockContaminationRisk = "high";
    } else if (fallbackRate > 20) {
      mockContaminationRisk = "low";
    }

    // 마지막 호출 시간 계산
    const lastCallTime = llmStats.totalCalls > 0 && llmStats.recentFailures.length > 0
      ? llmStats.recentFailures[0].metadata.timestamp
      : undefined;

    // 시스템 상태 결정
    const issues: string[] = [];
    let overallStatus: "healthy" | "warning" | "critical" = "healthy";

    if (mockContaminationRisk === "critical") {
      issues.push("CRITICAL: Production environment without strict mode");
      overallStatus = "critical";
    } else if (!apiKeyConfigured) {
      issues.push("WARNING: ANTHROPIC_API_KEY not configured");
      overallStatus = "warning";
    } else if (fallbackRate > 30) {
      issues.push(`HIGH: Fallback rate too high (${fallbackRate}%)`);
      overallStatus = "warning";
    } else if (llmDiagnostics.status !== "healthy") {
      issues.push(`LLM System: ${llmDiagnostics.status}`);
      if (llmDiagnostics.status === "critical") {
        overallStatus = "critical";
      } else if (overallStatus === "healthy") {
        overallStatus = "warning";
      }
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
        currentSource
      },
      system: {
        strictMode: envPolicy.strictMode,
        mockContaminationRisk,
        nodeEnv: process.env.NODE_ENV || "unknown"
      },
      uptime: {
        startTime,
        uptimeSeconds
      },
      ...(issues.length > 0 && { issues })
    };

    // 상태 코드 결정
    const statusCode = overallStatus === "critical" ? 503 :
                      overallStatus === "warning" ? 207 : 200;

    return NextResponse.json(systemStatus, { status: statusCode });

  } catch (error) {
    console.error("Status endpoint error:", error);

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      status: "critical",
      error: "Status check failed",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}