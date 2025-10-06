#!/usr/bin/env node

/**
 * 🛡️ Circuit Breaker Pattern Implementation
 *
 * Phase 6: Fail-Fast Governance의 핵심 컴포넌트
 * - Self-Healing 무한 루프 방지
 * - 실패 임계치 관리
 * - 자동 복구 시도 제한
 */

interface CircuitBreakerState {
  failureCount: number;
  lastFailureTime: number;
  state: "CLOSED" | "OPEN" | "HALF_OPEN" | "PERMANENT_OPEN";
  successCount: number;
  permanentOpenReason?: string;
  permanentOpenTimestamp?: number;
}

interface CircuitBreakerConfig {
  failureThreshold: number;
  timeoutWindow: number; // ms
  monitoringPeriod: number; // ms
  halfOpenMaxAttempts: number;
  permanentOpenThreshold?: number; // PERMANENT_OPEN으로 전환할 연속 실패 횟수
  permanentOpenConditions?: string[]; // PERMANENT_OPEN 조건 (예: 'no_api_key', 'auth_failure')
}

export class CircuitBreaker {
  private state: CircuitBreakerState;
  private config: CircuitBreakerConfig;
  private name: string;

  constructor(name: string, config?: Partial<CircuitBreakerConfig>) {
    this.name = name;
    this.config = {
      failureThreshold: 3,
      timeoutWindow: 30000, // 30초
      monitoringPeriod: 60000, // 1분
      halfOpenMaxAttempts: 1,
      permanentOpenThreshold: 10, // 10번 연속 실패 시 영구 차단
      permanentOpenConditions: [],
      ...config,
    };

    this.state = {
      failureCount: 0,
      lastFailureTime: 0,
      state: "CLOSED",
      successCount: 0,
    };

    console.log(
      `🛡️ [CircuitBreaker] ${this.name} initialized: ${JSON.stringify(
        this.config,
      )}`,
    );
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // PERMANENT_OPEN 상태면 수동 복구만 가능
    if (this.state.state === "PERMANENT_OPEN") {
      throw new Error(
        `Circuit breaker ${this.name} is PERMANENTLY OPEN. ` +
          `Reason: ${this.state.permanentOpenReason || "Unknown"}. ` +
          `Manual reset required via reset() method.`,
      );
    }

    // Circuit이 OPEN이면 즉시 실패
    if (this.state.state === "OPEN") {
      if (Date.now() - this.state.lastFailureTime > this.config.timeoutWindow) {
        console.log(
          `🔄 [CircuitBreaker] ${this.name} transitioning to HALF_OPEN`,
        );
        this.state.state = "HALF_OPEN";
        this.state.successCount = 0;
      } else {
        const remainingTime =
          this.config.timeoutWindow - (Date.now() - this.state.lastFailureTime);
        throw new Error(
          `Circuit breaker ${this.name} is OPEN. Retry in ${Math.round(
            remainingTime / 1000,
          )}s`,
        );
      }
    }

    // HALF_OPEN 상태에서 시도 제한
    if (
      this.state.state === "HALF_OPEN" &&
      this.state.successCount >= this.config.halfOpenMaxAttempts
    ) {
      throw new Error(
        `Circuit breaker ${this.name} is HALF_OPEN with max attempts reached`,
      );
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error instanceof Error ? error : undefined);
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state.state === "HALF_OPEN") {
      this.state.successCount++;
      console.log(
        `✅ [CircuitBreaker] ${this.name} success in HALF_OPEN (${this.state.successCount})`,
      );

      if (this.state.successCount >= this.config.halfOpenMaxAttempts) {
        console.log(`🔓 [CircuitBreaker] ${this.name} transitioning to CLOSED`);
        this.state.state = "CLOSED";
        this.state.failureCount = 0;
      }
    } else {
      // CLOSED 상태에서 성공 시 실패 카운트 리셋
      this.state.failureCount = 0;
    }
  }

  private onFailure(error?: Error): void {
    this.state.failureCount++;
    this.state.lastFailureTime = Date.now();

    console.log(
      `❌ [CircuitBreaker] ${this.name} failure count: ${this.state.failureCount}/${this.config.failureThreshold}`,
    );

    // PERMANENT_OPEN 조건 체크
    if (this.shouldTransitionToPermanentOpen(error)) {
      console.error(
        `🔒🔒 [CircuitBreaker] ${this.name} transitioning to PERMANENT_OPEN`,
      );
      this.state.state = "PERMANENT_OPEN";
      this.state.permanentOpenReason =
        error?.message || "Exceeded permanent failure threshold";
      this.state.permanentOpenTimestamp = Date.now();
      return;
    }

    // 일반 OPEN 전환
    if (this.state.failureCount >= this.config.failureThreshold) {
      console.log(`🔒 [CircuitBreaker] ${this.name} transitioning to OPEN`);
      this.state.state = "OPEN";
    }
  }

  /**
   * PERMANENT_OPEN 전환 조건 체크
   */
  private shouldTransitionToPermanentOpen(error?: Error): boolean {
    // 1. 연속 실패 횟수가 임계치 초과
    if (
      this.config.permanentOpenThreshold &&
      this.state.failureCount >= this.config.permanentOpenThreshold
    ) {
      return true;
    }

    // 2. 특정 에러 조건 매칭 (예: API key 없음)
    if (error && this.config.permanentOpenConditions) {
      const errorMessage = error.message.toLowerCase();
      return this.config.permanentOpenConditions.some((condition) =>
        errorMessage.includes(condition.toLowerCase()),
      );
    }

    return false;
  }

  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  isCircuitOpen(): boolean {
    return this.state.state === "OPEN" || this.state.state === "PERMANENT_OPEN";
  }

  isPermanentlyOpen(): boolean {
    return this.state.state === "PERMANENT_OPEN";
  }

  reset(force: boolean = false): void {
    if (this.state.state === "PERMANENT_OPEN" && !force) {
      console.warn(
        `⚠️ [CircuitBreaker] ${this.name} is PERMANENTLY OPEN - use reset(true) to force reset`,
      );
      return;
    }

    console.log(
      `🔄 [CircuitBreaker] ${this.name} manually reset${
        force ? " (forced)" : ""
      }`,
    );
    this.state = {
      failureCount: 0,
      lastFailureTime: 0,
      state: "CLOSED",
      successCount: 0,
    };
  }

  getStatus(): string {
    const timeSinceLastFailure = this.state.lastFailureTime
      ? Math.round((Date.now() - this.state.lastFailureTime) / 1000)
      : 0;

    let status = `${this.name}: ${this.state.state} (failures: ${this.state.failureCount}, last: ${timeSinceLastFailure}s ago)`;

    if (this.state.state === "PERMANENT_OPEN") {
      const permanentOpenDuration = this.state.permanentOpenTimestamp
        ? Math.round((Date.now() - this.state.permanentOpenTimestamp) / 1000)
        : 0;
      status += ` | BLOCKED FOR: ${permanentOpenDuration}s | REASON: ${this.state.permanentOpenReason}`;
    }

    return status;
  }
}

/**
 * 🌍 Global Circuit Breaker Registry
 */
class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();

  get(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, config));
    }
    return this.breakers.get(name)!;
  }

  getAll(): CircuitBreaker[] {
    return Array.from(this.breakers.values());
  }

  getStatus(): string[] {
    return Array.from(this.breakers.values()).map((cb) => cb.getStatus());
  }

  resetAll(): void {
    console.log("🔄 [CircuitBreakerRegistry] Resetting all circuit breakers");
    this.breakers.forEach((cb) => cb.reset());
  }
}

export const circuitBreakerRegistry = new CircuitBreakerRegistry();

/**
 * 🔧 Convenience function for Self-Healing operations
 */
export function withCircuitBreaker<T>(
  name: string,
  operation: () => Promise<T>,
  config?: Partial<CircuitBreakerConfig>,
): Promise<T> {
  const breaker = circuitBreakerRegistry.get(name, config);
  return breaker.execute(operation);
}
