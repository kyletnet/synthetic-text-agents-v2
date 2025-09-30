import { NextRequest, NextResponse } from "next/server";
import { getLLMStats, getLLMDiagnostics } from "@/lib/llm-call-manager";
import { ExecutionVerifier } from "@/lib/execution-verifier";

export interface MaintenanceReport {
  timestamp: string;
  systemHealth: {
    status: "healthy" | "warning" | "critical";
    issues: string[];
    recommendations: string[];
  };
  llmDiagnostics: {
    last100Calls: {
      llm: number;
      fallback: number;
      error: number;
    };
    fallbackRate: string;
    successRate: string;
    averageResponseTime: number;
    lastFailure?: {
      type: string;
      message: string;
      timestamp: string;
    };
    worstErrorTypes: Array<{
      type: string;
      count: number;
      percentage: string;
    }>;
  };
  environmentStatus: {
    apiKeyConfigured: boolean;
    strictMode: boolean;
    currentSource: "llm" | "fallback" | "mixed";
    fallbackActive: boolean;
    mockContaminationRisk: "none" | "low" | "high" | "critical";
  };
  recommendations: string[];
}

/**
 * System maintenance and diagnostics endpoint
 * GET /api/maintain
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const timestamp = new Date().toISOString();

    // LLM 호출 통계 수집 (최근 100회)
    const llmStats = getLLMStats(60); // 최근 1시간
    const llmDiagnostics = getLLMDiagnostics();

    // 환경 정책 확인
    const envPolicy = ExecutionVerifier.checkEnvironmentPolicy();

    // Fallback Rate 계산
    const fallbackRate =
      llmStats.totalCalls > 0
        ? Math.round((llmStats.fallbackCalls / llmStats.totalCalls) * 100)
        : 0;

    const successRate =
      llmStats.totalCalls > 0
        ? Math.round((llmStats.successfulCalls / llmStats.totalCalls) * 100)
        : 0;

    // 최근 실패 분석
    const lastFailure =
      llmStats.recentFailures.length > 0
        ? {
            type: llmStats.recentFailures[0].error?.type || "unknown",
            message:
              llmStats.recentFailures[0].error?.message || "Unknown error",
            timestamp: llmStats.recentFailures[0].metadata.timestamp,
          }
        : undefined;

    // 오류 유형별 분석
    const worstErrorTypes = Object.entries(llmStats.errorBreakdown)
      .map(([type, count]) => ({
        type,
        count,
        percentage:
          llmStats.totalCalls > 0
            ? `${Math.round((count / llmStats.totalCalls) * 100)}%`
            : "0%",
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    // Mock 오염 위험도 평가
    let mockContaminationRisk: "none" | "low" | "high" | "critical" = "none";
    if (!envPolicy.strictMode && process.env.NODE_ENV === "production") {
      mockContaminationRisk = "critical";
    } else if (fallbackRate > 50) {
      mockContaminationRisk = "high";
    } else if (fallbackRate > 20) {
      mockContaminationRisk = "low";
    }

    // 현재 소스 상태 판단
    let currentSource: "llm" | "fallback" | "mixed" = "llm";
    if (fallbackRate >= 80) {
      currentSource = "fallback";
    } else if (fallbackRate > 0) {
      currentSource = "mixed";
    }

    // 추천사항 생성
    const recommendations: string[] = [];

    if (fallbackRate > 30) {
      recommendations.push(
        "HIGH: Fallback rate는 30% 이하로 유지해야 합니다. API 키와 네트워크 상태를 점검하세요.",
      );
    }

    if (mockContaminationRisk === "critical") {
      recommendations.push(
        "CRITICAL: Production 환경에서 Strict Mode가 비활성화되었습니다. 즉시 API 키를 설정하세요.",
      );
    }

    if (llmStats.errorBreakdown.auth > 0) {
      recommendations.push(
        "URGENT: API 키 인증 오류가 발생하고 있습니다. ANTHROPIC_API_KEY를 확인하세요.",
      );
    }

    if (llmStats.errorBreakdown.rate_limit > 0) {
      recommendations.push(
        "WARNING: Rate limit에 도달했습니다. 요청 빈도를 조절하거나 API 플랜을 확인하세요.",
      );
    }

    if (llmStats.averageResponseTime > 10000) {
      recommendations.push(
        "INFO: 평균 응답 시간이 10초를 초과합니다. 네트워크 상태를 점검하세요.",
      );
    }

    if (recommendations.length === 0) {
      recommendations.push("✅ 모든 시스템이 정상적으로 작동 중입니다.");
    }

    const maintenanceReport: MaintenanceReport = {
      timestamp,
      systemHealth: llmDiagnostics,
      llmDiagnostics: {
        last100Calls: {
          llm: llmStats.successfulCalls,
          fallback: llmStats.fallbackCalls,
          error: llmStats.errorCalls,
        },
        fallbackRate: `${fallbackRate}%`,
        successRate: `${successRate}%`,
        averageResponseTime: llmStats.averageResponseTime,
        lastFailure,
        worstErrorTypes,
      },
      environmentStatus: {
        apiKeyConfigured: process.env.ANTHROPIC_API_KEY
          ? !process.env.ANTHROPIC_API_KEY.includes("your_api_key_here")
          : false,
        strictMode: envPolicy.strictMode,
        currentSource,
        fallbackActive: fallbackRate > 0,
        mockContaminationRisk,
      },
      recommendations,
    };

    // 상태 코드 결정
    const statusCode =
      mockContaminationRisk === "critical" ||
      llmDiagnostics.status === "critical"
        ? 503
        : mockContaminationRisk === "high" ||
            llmDiagnostics.status === "warning"
          ? 207 // Multi-Status (partial success)
          : 200;

    return NextResponse.json(maintenanceReport, { status: statusCode });
  } catch (error) {
    console.error("Maintenance report generation failed:", error);

    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        error: "Maintenance report failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
