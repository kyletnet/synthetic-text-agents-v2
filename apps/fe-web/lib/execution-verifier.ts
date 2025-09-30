/**
 * ExecutionVerifier - 실행 보증 시스템
 * Mock 데이터가 Production에서 사용되는 것을 방지하고 실제 LLM 실행을 보증
 */

export interface ExecutionResult {
  source: "llm" | "mock" | "fallback" | "unknown";
  verified: boolean;
  timestamp: string;
  executionTrace?: {
    apiCalled: boolean;
    responseTime?: number;
    errorFallback?: boolean;
  };
}

export class ExecutionVerificationError extends Error {
  constructor(
    message: string,
    public result: any,
  ) {
    super(message);
    this.name = "ExecutionVerificationError";
  }
}

export class ExecutionVerifier {
  /**
   * 실제 LLM 호출 보증 - Mock 데이터 사용 시 에러 발생
   */
  static assertRealLLMCall(response: any, context: string = "unknown"): void {
    // source 필드 검사
    if (response.source === "mock") {
      throw new ExecutionVerificationError(
        `Invalid execution in ${context}: Mock data used in production. This violates the No-Mock Policy.`,
        response,
      );
    }

    // 결과 구조 검사 - Mock 패턴 감지
    if (this.detectMockPattern(response)) {
      throw new ExecutionVerificationError(
        `Mock pattern detected in ${context}: Response appears to be generated from templates rather than LLM.`,
        response,
      );
    }

    // LLM 응답 필수 필드 검사
    if (!this.hasLLMResponseSignature(response)) {
      console.warn(
        `[ExecutionVerifier] Warning: Response in ${context} lacks LLM signature fields`,
      );
    }
  }

  /**
   * Mock 패턴 감지 - 하드코딩된 템플릿 사용 여부 확인
   */
  private static detectMockPattern(response: any): boolean {
    const mockIndicators = [
      // 하드코딩된 패러프레이즈 패턴
      "패러프레이즈하여 의미는 유지하되 표현을 다양화한 결과입니다",
      "위 내용을 더 자세히 설명하거나 관련 정보를 추가한 확장 버전입니다",
      "핵심 내용을 간략하게 정리한 요약입니다",

      // Mock 응답 구조 패턴
      "Math.random() * 0.3 + 0.7", // Mock 점수 생성 패턴
      "generateMockResults",
      "mock-001",
      "mock-002",
      "mock-003", // Mock ID 패턴
    ];

    const responseStr = JSON.stringify(response);
    return mockIndicators.some((indicator) => responseStr.includes(indicator));
  }

  /**
   * LLM 응답 시그니처 확인 - 실제 LLM에서 온 응답인지 검증
   */
  private static hasLLMResponseSignature(response: any): boolean {
    // 실제 LLM 응답에서만 나타나는 특성들
    const llmSignatures = [
      // 비일정한 응답 길이 (템플릿은 일정함)
      response.augmented && response.augmented.length > 50,
      // 실제 LLM 호출 메타데이터
      response.metadata?.processingTime > 100, // LLM은 100ms 이상 소요
      // 품질 점수의 다양성 (Mock은 0.7 고정)
      response.quality?.score && response.quality.score !== 0.7,
    ];

    return llmSignatures.some((signature) => signature === true);
  }

  /**
   * 전체 세션 검증 - 모든 결과가 실제 LLM 기반인지 확인
   */
  static verifySession(session: any): ExecutionResult {
    const result: ExecutionResult = {
      source: "unknown",
      verified: false,
      timestamp: new Date().toISOString(),
    };

    try {
      // 세션 내 모든 증강 결과 검증
      if (session.augmentations) {
        for (const augmentation of session.augmentations) {
          if (augmentation.results) {
            for (const augResult of augmentation.results) {
              this.assertRealLLMCall(augResult, `session-${session.sessionId}`);
            }
          }
        }
      }

      result.verified = true;
      result.source = session.summary?.ragContextUsed ? "llm" : "llm";
    } catch (error) {
      result.verified = false;
      result.source = "mock";

      if (error instanceof ExecutionVerificationError) {
        console.error(
          `[ExecutionVerifier] Verification failed: ${error.message}`,
        );
        // Production에서는 에러를 던지지 않고 warning만 로그
        if (process.env.NODE_ENV === "production") {
          console.error(
            "[CRITICAL] Mock data detected in production:",
            error.result,
          );
        }
      }
    }

    return result;
  }

  /**
   * UI에서 사용할 Mock 결과 필터링
   */
  static filterMockResults(results: any[]): {
    real: any[];
    mock: any[];
    stats: { mockCount: number; realCount: number; mockPercentage: number };
  } {
    const real: any[] = [];
    const mock: any[] = [];

    for (const result of results) {
      try {
        this.assertRealLLMCall(result, "filter-check");
        real.push(result);
      } catch {
        mock.push(result);
      }
    }

    const mockCount = mock.length;
    const realCount = real.length;
    const total = mockCount + realCount;
    const mockPercentage =
      total > 0 ? Math.round((mockCount / total) * 100) : 0;

    return {
      real,
      mock,
      stats: { mockCount, realCount, mockPercentage },
    };
  }

  /**
   * 환경별 실행 정책 확인
   */
  static checkEnvironmentPolicy(): {
    allowMock: boolean;
    strictMode: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];
    const isProduction = process.env.NODE_ENV === "production";
    const hasValidApiKey = Boolean(
      process.env.ANTHROPIC_API_KEY &&
        !process.env.ANTHROPIC_API_KEY.includes("your_api_key_here"),
    );

    // LLM_STRICT_MODE 환경변수 확인
    const llmStrictModeEnv = process.env.LLM_STRICT_MODE?.toLowerCase();
    const explicitStrictMode =
      llmStrictModeEnv === "true"
        ? true
        : llmStrictModeEnv === "false"
          ? false
          : null;

    // Strict mode 결정 로직
    let strictMode: boolean;
    if (explicitStrictMode !== null) {
      // 환경변수로 명시적 설정
      strictMode = explicitStrictMode;
      if (strictMode) {
        warnings.push(
          "INFO: LLM_STRICT_MODE=true - strict mode enforced by configuration",
        );
      } else {
        warnings.push(
          "INFO: LLM_STRICT_MODE=false - strict mode disabled by configuration",
        );
      }
    } else {
      // 자동 감지 (기존 로직)
      strictMode = isProduction && hasValidApiKey;
    }

    // 위험 상황 경고
    if (isProduction && !hasValidApiKey) {
      warnings.push(
        "CRITICAL: Production environment detected but ANTHROPIC_API_KEY not configured",
      );
    }

    if (!hasValidApiKey && strictMode) {
      warnings.push(
        "WARNING: Strict mode enabled but ANTHROPIC_API_KEY not configured - may cause failures",
      );
    }

    if (!hasValidApiKey && !strictMode) {
      warnings.push(
        "WARNING: ANTHROPIC_API_KEY not configured - system will use fallback templates",
      );
    }

    // Mock 허용 여부 결정
    const allowMock = !strictMode;

    return {
      allowMock,
      strictMode,
      warnings,
    };
  }
}

// 전역 검증 헬퍼
export const verifyExecution = ExecutionVerifier.assertRealLLMCall;
export const filterMockData = ExecutionVerifier.filterMockResults;
