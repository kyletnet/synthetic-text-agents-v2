/**
 * API 키 검증 가드 시스템
 *
 * 기능:
 * - API 키 없이는 요청 자체를 차단
 * - mock처럼 실행 자체가 안되게 함
 * - 명확한 에러 메시지 제공
 * - 사용자 혼란 방지
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiKeyManager } from './api-key-manager';

export interface APIGuardResult {
  isAllowed: boolean;
  reason?: string;
  status?: number;
  response?: NextResponse;
}

export class APIGuard {
  /**
   * API 키 검증 미들웨어
   */
  static validateAPIKey(req: NextRequest): APIGuardResult {
    // API Key Manager 상태 확인
    const stats = apiKeyManager.getStats();

    if (stats.totalKeys === 0) {
      return {
        isAllowed: false,
        reason: 'NO_API_KEYS_CONFIGURED',
        status: 503,
        response: NextResponse.json({
          error: 'SERVICE_UNAVAILABLE',
          message: '❌ CRITICAL: No API keys configured. System cannot function.',
          details: {
            cause: 'No ANTHROPIC_API_KEY found in environment variables',
            solution: 'Please configure at least one valid API key',
            documentation: 'https://docs.anthropic.com/claude/reference/getting-started'
          },
          timestamp: new Date().toISOString(),
          requestId: req.headers.get('x-request-id') || 'unknown'
        }, { status: 503 })
      };
    }

    if (stats.activeKeys === 0) {
      return {
        isAllowed: false,
        reason: 'ALL_API_KEYS_DISABLED',
        status: 503,
        response: NextResponse.json({
          error: 'SERVICE_UNAVAILABLE',
          message: '❌ CRITICAL: All API keys are disabled due to failures. System cannot function.',
          details: {
            totalKeys: stats.totalKeys,
            activeKeys: stats.activeKeys,
            failedKeys: stats.failedKeys,
            cause: 'All configured API keys have been disabled due to repeated failures',
            solution: 'Please check your API keys and reactivate them, or add new valid keys',
            recommendation: 'Contact support if keys were working previously'
          },
          timestamp: new Date().toISOString(),
          requestId: req.headers.get('x-request-id') || 'unknown'
        }, { status: 503 })
      };
    }

    // 현재 사용 가능한 키가 있는지 최종 확인
    const currentKey = apiKeyManager.getCurrentKey();
    if (!currentKey) {
      return {
        isAllowed: false,
        reason: 'NO_CURRENT_KEY_AVAILABLE',
        status: 503,
        response: NextResponse.json({
          error: 'SERVICE_UNAVAILABLE',
          message: '❌ CRITICAL: No current API key available. System cannot function.',
          details: {
            totalKeys: stats.totalKeys,
            activeKeys: stats.activeKeys,
            cause: 'No API key is currently available for use',
            solution: 'API key rotation failed - check key validity',
            stats: stats
          },
          timestamp: new Date().toISOString(),
          requestId: req.headers.get('x-request-id') || 'unknown'
        }, { status: 503 })
      };
    }

    return {
      isAllowed: true
    };
  }

  /**
   * API 엔드포인트용 가드 함수
   */
  static async guardedHandler<T>(
    req: NextRequest,
    handler: (req: NextRequest) => Promise<T>
  ): Promise<T | NextResponse> {
    const guardResult = this.validateAPIKey(req);

    if (!guardResult.isAllowed) {
      console.error(`🚫 API request blocked: ${guardResult.reason}`);
      return guardResult.response!;
    }

    try {
      return await handler(req);
    } catch (error) {
      // API 키 관련 에러인 경우 특별 처리
      if (this.isAPIKeyError(error)) {
        const stats = apiKeyManager.getStats();
        return NextResponse.json({
          error: 'API_KEY_ERROR',
          message: '❌ API key error occurred during request processing',
          details: {
            originalError: (error as Error).message,
            currentStats: stats,
            recommendation: 'API key may be invalid or quota exceeded'
          },
          timestamp: new Date().toISOString(),
          requestId: req.headers.get('x-request-id') || 'unknown'
        }, { status: 503 });
      }

      // 일반 에러는 그대로 throw
      throw error;
    }
  }

  /**
   * API 키 관련 에러인지 확인
   */
  private static isAPIKeyError(error: any): boolean {
    const errorMessage = error?.message?.toLowerCase() || '';
    const apiKeyErrorPatterns = [
      'api key',
      'authentication',
      'unauthorized',
      'invalid key',
      'quota exceeded',
      'rate limit',
      'billing',
      'subscription'
    ];

    return apiKeyErrorPatterns.some(pattern =>
      errorMessage.includes(pattern)
    );
  }

  /**
   * 개발 모드에서 사용할 수 있는 테스트 모드
   */
  static bypassForTesting(): boolean {
    return process.env.NODE_ENV === 'development' &&
           process.env.BYPASS_API_GUARD === 'true';
  }

  /**
   * 시스템 상태 체크 (헬스 체크용)
   */
  static getSystemStatus(): {
    status: 'healthy' | 'degraded' | 'critical';
    apiKeys: {
      total: number;
      active: number;
      failed: number;
    };
    canServeRequests: boolean;
    message: string;
  } {
    const stats = apiKeyManager.getStats();

    if (stats.totalKeys === 0) {
      return {
        status: 'critical',
        apiKeys: {
          total: stats.totalKeys,
          active: stats.activeKeys,
          failed: stats.failedKeys
        },
        canServeRequests: false,
        message: 'No API keys configured'
      };
    }

    if (stats.activeKeys === 0) {
      return {
        status: 'critical',
        apiKeys: {
          total: stats.totalKeys,
          active: stats.activeKeys,
          failed: stats.failedKeys
        },
        canServeRequests: false,
        message: 'All API keys are disabled'
      };
    }

    if (stats.activeKeys < stats.totalKeys / 2) {
      return {
        status: 'degraded',
        apiKeys: {
          total: stats.totalKeys,
          active: stats.activeKeys,
          failed: stats.failedKeys
        },
        canServeRequests: true,
        message: 'Some API keys are disabled - reduced capacity'
      };
    }

    return {
      status: 'healthy',
      apiKeys: {
        total: stats.totalKeys,
        active: stats.activeKeys,
        failed: stats.failedKeys
      },
      canServeRequests: true,
      message: 'All systems operational'
    };
  }
}

/**
 * API 라우트에서 사용할 데코레이터 함수
 */
export function withAPIGuard<T extends any[], R>(
  handler: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R | NextResponse> => {
    // 첫 번째 인자가 NextRequest인지 확인
    const req = args[0] as NextRequest;

    if (req && typeof req === 'object' && 'headers' in req) {
      const guardResult = APIGuard.validateAPIKey(req);

      if (!guardResult.isAllowed) {
        console.error(`🚫 API request blocked: ${guardResult.reason}`);
        return guardResult.response!;
      }
    }

    return await handler(...args);
  };
}

// 편의 함수들
export const isAPIKeyConfigured = () => apiKeyManager.getStats().totalKeys > 0;
export const hasActiveAPIKeys = () => apiKeyManager.getStats().activeKeys > 0;
export const canServeRequests = () => {
  const stats = apiKeyManager.getStats();
  return stats.totalKeys > 0 && stats.activeKeys > 0;
};