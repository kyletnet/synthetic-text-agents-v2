/**
 * LLM 호출 관리 및 실패 시나리오별 대응 체계
 * GPT 조언 반영: 정교한 LLM 호출 품질 보증 시스템
 */

export interface LLMCallResult {
  success: boolean;
  source: "llm" | "fallback" | "cache" | "error";
  data?: any;
  error?: {
    type: "network" | "auth" | "rate_limit" | "format" | "timeout" | "unknown";
    message: string;
    code?: string;
    retryable: boolean;
  };
  metadata: {
    model: string;
    attempt: number;
    duration: number;
    fallbackUsed: boolean;
    timestamp: string;
    sessionId: string;
  };
}

export interface LLMCallStats {
  totalCalls: number;
  successfulCalls: number;
  fallbackCalls: number;
  errorCalls: number;
  successRate: number;
  fallbackRate: number;
  averageResponseTime: number;
  errorBreakdown: Record<string, number>;
  recentFailures: LLMCallResult[];
}

// SSR-safe 글로벌 상태 관리
interface GlobalLLMTracker {
  calls: LLMCallResult[];
  readonly MAX_HISTORY: number;
}

function getGlobalLLMTracker(): GlobalLLMTracker {
  if (typeof globalThis === "undefined") {
    // Node.js 환경이 아닌 경우 로컬 상태로 fallback
    return {
      calls: [],
      MAX_HISTORY: 1000,
    };
  }

  if (!globalThis.llmTracker) {
    globalThis.llmTracker = {
      calls: [],
      MAX_HISTORY: 1000,
    };
  }

  return globalThis.llmTracker as GlobalLLMTracker;
}

class LLMCallTracker {
  static recordCall(result: LLMCallResult) {
    const tracker = getGlobalLLMTracker();
    tracker.calls.push(result);

    // 메모리 관리: 최근 1000개만 유지
    if (tracker.calls.length > tracker.MAX_HISTORY) {
      tracker.calls = tracker.calls.slice(-tracker.MAX_HISTORY);
    }

    // 중요한 실패는 즉시 로깅
    if (!result.success && result.error?.type === "auth") {
      console.error(
        `🚨 [CRITICAL] API Key authentication failed: ${result.error.message}`,
      );
    } else if (result.source === "fallback") {
      console.warn(
        `⚠️ [FALLBACK] LLM call failed, using template: ${
          result.error?.message || "unknown reason"
        }`,
      );
    }

    // 성공적인 LLM 호출 로깅
    if (result.success && result.source === "llm") {
      console.log(
        `✅ [LLM] Successful ${result.metadata.model} call (${result.metadata.duration}ms)`,
      );
    }
  }

  static getStats(timeWindow?: number): LLMCallStats {
    const now = Date.now();
    const windowMs = timeWindow ? timeWindow * 60 * 1000 : 60 * 60 * 1000; // 기본 1시간
    const tracker = getGlobalLLMTracker();

    // 방어 코드: calls가 빈 배열인 경우
    if (tracker.calls.length === 0) {
      return {
        totalCalls: 0,
        successfulCalls: 0,
        fallbackCalls: 0,
        errorCalls: 0,
        successRate: 0,
        fallbackRate: 0,
        averageResponseTime: 0,
        errorBreakdown: {},
        recentFailures: [],
      };
    }

    const recentCalls = tracker.calls.filter(
      (call) => now - new Date(call.metadata.timestamp).getTime() < windowMs,
    );

    const totalCalls = recentCalls.length;
    const successfulCalls = recentCalls.filter(
      (c) => c.success && c.source === "llm",
    ).length;
    const fallbackCalls = recentCalls.filter(
      (c) => c.source === "fallback",
    ).length;
    const errorCalls = recentCalls.filter((c) => !c.success).length;

    const errorBreakdown: Record<string, number> = {};
    recentCalls
      .filter((c) => !c.success)
      .forEach((call) => {
        const errorType = call.error?.type || "unknown";
        errorBreakdown[errorType] = (errorBreakdown[errorType] || 0) + 1;
      });

    const totalResponseTime = recentCalls.reduce(
      (sum, call) => sum + call.metadata.duration,
      0,
    );
    const averageResponseTime =
      totalCalls > 0 ? totalResponseTime / totalCalls : 0;

    const recentFailures = recentCalls
      .filter((c) => !c.success)
      .slice(-10) // 최근 10개 실패
      .reverse();

    return {
      totalCalls,
      successfulCalls,
      fallbackCalls,
      errorCalls,
      successRate: totalCalls > 0 ? successfulCalls / totalCalls : 0,
      fallbackRate: totalCalls > 0 ? fallbackCalls / totalCalls : 0,
      averageResponseTime: Math.round(averageResponseTime),
      errorBreakdown,
      recentFailures,
    };
  }

  static getDiagnostics(): {
    status: "healthy" | "warning" | "critical";
    issues: string[];
    recommendations: string[];
  } {
    const stats = LLMCallTracker.getStats(60); // 최근 1시간
    const issues: string[] = [];
    const recommendations: string[] = [];

    // 임계값 기반 진단
    if (stats.fallbackRate > 0.5) {
      issues.push(
        `높은 Fallback 발생률: ${Math.round(stats.fallbackRate * 100)}%`,
      );
      recommendations.push("ANTHROPIC_API_KEY 설정 확인 및 네트워크 상태 점검");
    }

    if (stats.successRate < 0.7 && stats.totalCalls > 10) {
      issues.push(
        `낮은 LLM 호출 성공률: ${Math.round(stats.successRate * 100)}%`,
      );
      recommendations.push("API 키 유효성 및 할당량 확인 필요");
    }

    if (stats.errorBreakdown?.auth > 0) {
      issues.push(`인증 오류 ${stats.errorBreakdown.auth}회 발생`);
      recommendations.push("CRITICAL: API 키 즉시 점검 필요");
    }

    if (stats.errorBreakdown?.rate_limit > 0) {
      issues.push(`Rate Limit 오류 ${stats.errorBreakdown.rate_limit}회 발생`);
      recommendations.push("요청 빈도 조절 또는 API 플랜 업그레이드 검토");
    }

    const status =
      issues.length === 0
        ? "healthy"
        : issues.some((i) => i.includes("CRITICAL"))
        ? "critical"
        : "warning";

    return { status, issues, recommendations };
  }
}

export class LLMCallManager {
  private static maxRetries = 3;
  private static retryDelayMs = 1000;

  /**
   * LLM 호출을 관리하고 실패 시나리오별로 대응
   */
  static async callWithRetry<T>(
    sessionId: string,
    callFunction: () => Promise<T>,
    context: string = "unknown",
  ): Promise<LLMCallResult> {
    const startTime = Date.now();
    let lastError: any = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const data = await callFunction();
        const duration = Date.now() - startTime;

        const result: LLMCallResult = {
          success: true,
          source: "llm",
          data,
          metadata: {
            model: "claude-3-haiku-20240307",
            attempt,
            duration,
            fallbackUsed: false,
            timestamp: new Date().toISOString(),
            sessionId,
          },
        };

        LLMCallTracker.recordCall(result);
        return result;
      } catch (error: any) {
        lastError = error;
        const errorType = this.categorizeError(error);

        // 오류 유형별 대응 로직 실행
        await this.handleErrorByType(errorType, error, sessionId);

        // 재시도 불가능한 오류는 즉시 종료
        if (!this.isRetryable(errorType)) {
          console.error(
            `❌ [NO-RETRY] ${errorType} error - 재시도 중단: ${error.message}`,
          );
          break;
        }

        // 재시도 간격 (지수 백오프)
        if (attempt < this.maxRetries) {
          const delay = this.retryDelayMs * Math.pow(2, attempt - 1);
          console.log(
            `⏳ [BACKOFF] ${errorType} error - ${delay}ms 후 재시도 (${attempt}/${this.maxRetries})`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // 모든 재시도 실패 - Fallback으로 처리
    const duration = Date.now() - startTime;
    const errorType = this.categorizeError(lastError);

    const result: LLMCallResult = {
      success: false,
      source: "error",
      error: {
        type: errorType,
        message: lastError?.message || "Unknown error",
        code: lastError?.code,
        retryable: this.isRetryable(errorType),
      },
      metadata: {
        model: "claude-3-haiku-20240307",
        attempt: this.maxRetries,
        duration,
        fallbackUsed: true,
        timestamp: new Date().toISOString(),
        sessionId,
      },
    };

    LLMCallTracker.recordCall(result);
    return result;
  }

  private static categorizeError(
    error: any,
  ): "network" | "auth" | "rate_limit" | "format" | "timeout" | "unknown" {
    if (!error) return "unknown";

    const message = error.message?.toLowerCase() || "";
    const code = error.code || error.status;

    // CRITICAL: API 키 인증 관련 오류
    if (
      code === 401 ||
      message.includes("unauthorized") ||
      message.includes("api key") ||
      message.includes("authentication") ||
      message.includes("invalid key") ||
      message.includes("api_key")
    ) {
      console.error(
        `🚨 [CRITICAL] API Key authentication failed: ${error.message}`,
      );
      return "auth";
    }

    // HIGH: Rate limit 도달 - 지수 백오프 적용 가능
    if (
      code === 429 ||
      message.includes("rate limit") ||
      message.includes("too many requests") ||
      message.includes("quota exceeded") ||
      code === "rate_limited"
    ) {
      console.warn(`⚠️ [RATE_LIMIT] API rate limit reached: ${error.message}`);
      return "rate_limit";
    }

    // MEDIUM: 네트워크 관련 오류 - 재시도 가능
    if (
      message.includes("network") ||
      message.includes("connection") ||
      message.includes("econnreset") ||
      message.includes("enotfound") ||
      message.includes("socket") ||
      code === "ECONNRESET" ||
      code === "ENOTFOUND" ||
      code === "ECONNREFUSED"
    ) {
      console.warn(`⚠️ [NETWORK] Network error occurred: ${error.message}`);
      return "network";
    }

    // MEDIUM: 타임아웃 오류 - 재시도 가능
    if (
      message.includes("timeout") ||
      message.includes("timed out") ||
      code === "TIMEOUT" ||
      code === "ETIMEDOUT"
    ) {
      console.warn(`⚠️ [TIMEOUT] Request timed out: ${error.message}`);
      return "timeout";
    }

    // LOW: 파싱/포맷 오류 - 재시도 불가능, 로깅 필요
    if (
      message.includes("parse") ||
      message.includes("format") ||
      message.includes("json") ||
      message.includes("syntax") ||
      message.includes("malformed") ||
      code === "JSON_PARSE_ERROR"
    ) {
      console.error(`❌ [FORMAT] Response format error: ${error.message}`);
      return "format";
    }

    // 알 수 없는 오류 - 추가 분석 필요
    console.warn(
      `❓ [UNKNOWN] Unclassified error: ${error.message} (code: ${code})`,
    );
    return "unknown";
  }

  private static isRetryable(
    errorType:
      | "network"
      | "auth"
      | "rate_limit"
      | "format"
      | "timeout"
      | "unknown",
  ): boolean {
    switch (errorType) {
      case "network":
      case "timeout":
      case "unknown":
        return true;
      case "rate_limit":
        return true; // 지수 백오프로 재시도 가능
      case "auth":
      case "format":
        return false; // 재시도 불가능
      default:
        return false;
    }
  }

  /**
   * 알림 전송 (오류 유형별 처리)
   */
  private static async sendAlert(
    errorType: string,
    message: string,
    sessionId: string,
  ): Promise<void> {
    try {
      // CRITICAL 및 HIGH 우선순위 오류에 대해서만 알림 전송
      if (errorType === "auth") {
        console.error(
          `🚨 [ALERT-CRITICAL] API Key 인증 실패 - 즉시 조치 필요: ${message}`,
        );
        // 실제 환경에서는 Slack, Discord, 이메일 등으로 알림 전송
        // await this.sendSlackAlert(`CRITICAL: API Key authentication failed in session ${sessionId}: ${message}`);
      } else if (errorType === "rate_limit") {
        console.warn(
          `⚠️ [ALERT-HIGH] Rate Limit 도달 - 요청 빈도 조절 필요: ${message}`,
        );
        // await this.sendSlackAlert(`HIGH: Rate limit reached in session ${sessionId}: ${message}`);
      }
    } catch (alertError) {
      console.error("Alert sending failed:", alertError);
    }
  }

  /**
   * 오류 유형별 대응 로직
   */
  private static async handleErrorByType(
    errorType:
      | "network"
      | "auth"
      | "rate_limit"
      | "format"
      | "timeout"
      | "unknown",
    error: any,
    sessionId: string,
  ): Promise<void> {
    switch (errorType) {
      case "auth":
        // API 키 오류 - 즉시 알림 및 fallback 강제
        await this.sendAlert("auth", error.message, sessionId);
        break;

      case "rate_limit":
        // Rate limit - 알림 및 백오프 시간 증가
        await this.sendAlert("rate_limit", error.message, sessionId);
        this.retryDelayMs = Math.min(this.retryDelayMs * 2, 30000); // 최대 30초
        break;

      case "network":
      case "timeout":
        // 네트워크/타임아웃 - 재시도 로직 적용
        console.log(
          `🔄 [RETRY] ${errorType} error - 재시도 적용: ${error.message}`,
        );
        break;

      case "format":
        // 포맷 오류 - 재시도 하지 않고 로깅
        console.error(
          `❌ [NO-RETRY] Format error - 재시도하지 않음: ${error.message}`,
        );
        break;

      case "unknown":
        // 알 수 없는 오류 - 추가 분석을 위한 상세 로깅
        console.error(`❓ [ANALYSIS-NEEDED] Unknown error - 분석 필요:`, {
          message: error.message,
          stack: error.stack,
          code: error.code,
          status: error.status,
          sessionId,
        });
        break;
    }
  }

  /**
   * 통계 조회
   */
  static getStats = LLMCallTracker.getStats;
  static getDiagnostics = LLMCallTracker.getDiagnostics;
}

// 전역 헬퍼
export const recordLLMCall = LLMCallTracker.recordCall;
export const getLLMStats = LLMCallManager.getStats;
export const getLLMDiagnostics = LLMCallManager.getDiagnostics;

// globalThis 타입 확장
declare global {
  var llmTracker: GlobalLLMTracker | undefined;
}
