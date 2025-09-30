/**
 * 다중 API 키 관리 및 로테이션 시스템
 *
 * 기능:
 * - 여러 API 키 자동 로테이션
 * - 키 소진 시 자동 fallback
 * - 키별 사용량 추적
 * - 실패 키 자동 제외
 */

interface APIKeyConfig {
  key: string;
  name: string;
  usageCount: number;
  failureCount: number;
  lastUsed: Date | null;
  isActive: boolean;
  quotaLimit?: number; // 일일 할당량 (옵션)
}

interface APIKeyStats {
  totalKeys: number;
  activeKeys: number;
  failedKeys: number;
  currentKeyIndex: number;
  totalUsage: number;
  rotationCount: number;
}

class APIKeyManager {
  private keys: APIKeyConfig[] = [];
  private currentIndex = 0;
  private rotationCount = 0;
  private maxFailuresBeforeDisable = 3;
  private rotationThreshold = 100; // 100회 사용 후 로테이션

  constructor() {
    this.initializeKeys();
  }

  /**
   * 환경변수에서 API 키들을 로드
   */
  private initializeKeys(): void {
    const keys: APIKeyConfig[] = [];

    // 메인 API 키
    const mainKey = process.env.ANTHROPIC_API_KEY;
    if (mainKey && mainKey !== 'your_api_key_here') {
      keys.push({
        key: mainKey,
        name: 'PRIMARY',
        usageCount: 0,
        failureCount: 0,
        lastUsed: null,
        isActive: true
      });
    }

    // 백업 키들 (ANTHROPIC_API_KEY_2, ANTHROPIC_API_KEY_3, ...)
    for (let i = 2; i <= 10; i++) {
      const backupKey = process.env[`ANTHROPIC_API_KEY_${i}`];
      if (backupKey && backupKey !== 'your_api_key_here') {
        keys.push({
          key: backupKey,
          name: `BACKUP_${i}`,
          usageCount: 0,
          failureCount: 0,
          lastUsed: null,
          isActive: true
        });
      }
    }

    // fallback 키들
    const fallbackKeys = process.env.ANTHROPIC_FALLBACK_KEYS;
    if (fallbackKeys) {
      try {
        const parsedKeys = JSON.parse(fallbackKeys);
        if (Array.isArray(parsedKeys)) {
          parsedKeys.forEach((keyData, index) => {
            if (typeof keyData === 'string') {
              keys.push({
                key: keyData,
                name: `FALLBACK_${index + 1}`,
                usageCount: 0,
                failureCount: 0,
                lastUsed: null,
                isActive: true
              });
            } else if (keyData && keyData.key) {
              keys.push({
                key: keyData.key,
                name: keyData.name || `FALLBACK_${index + 1}`,
                usageCount: 0,
                failureCount: 0,
                lastUsed: null,
                isActive: true,
                quotaLimit: keyData.quotaLimit
              });
            }
          });
        }
      } catch (error) {
        console.warn('Failed to parse ANTHROPIC_FALLBACK_KEYS:', error);
      }
    }

    this.keys = keys;
    console.log(`API Key Manager initialized with ${keys.length} keys`);
  }

  /**
   * 현재 사용 가능한 API 키 반환
   */
  getCurrentKey(): string | null {
    if (this.keys.length === 0) {
      return null;
    }

    const activeKeys = this.keys.filter(k => k.isActive);
    if (activeKeys.length === 0) {
      console.error('All API keys are disabled');
      return null;
    }

    // 현재 키가 비활성화되면 다음 활성 키로 이동
    let attempts = 0;
    while (attempts < this.keys.length) {
      const currentKey = this.keys[this.currentIndex];

      if (currentKey && currentKey.isActive) {
        // 로테이션 조건 체크
        if (this.shouldRotateKey(currentKey)) {
          this.rotateToNextKey();
          continue;
        }

        return currentKey.key;
      }

      this.rotateToNextKey();
      attempts++;
    }

    return null;
  }

  /**
   * 키 로테이션 조건 체크
   */
  private shouldRotateKey(keyConfig: APIKeyConfig): boolean {
    // 사용 횟수가 임계점을 넘으면 로테이션
    if (keyConfig.usageCount >= this.rotationThreshold) {
      return true;
    }

    // 할당량 제한이 있고 초과했으면 로테이션
    if (keyConfig.quotaLimit && keyConfig.usageCount >= keyConfig.quotaLimit) {
      return true;
    }

    // 연속 실패가 많으면 로테이션
    if (keyConfig.failureCount >= this.maxFailuresBeforeDisable) {
      return true;
    }

    return false;
  }

  /**
   * 다음 키로 로테이션
   */
  private rotateToNextKey(): void {
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    this.rotationCount++;

    const currentKey = this.keys[this.currentIndex];
    console.log(`Rotated to key: ${currentKey?.name || 'UNKNOWN'} (rotation #${this.rotationCount})`);
  }

  /**
   * API 키 사용 성공 기록
   */
  recordSuccess(key: string): void {
    const keyConfig = this.keys.find(k => k.key === key);
    if (keyConfig) {
      keyConfig.usageCount++;
      keyConfig.lastUsed = new Date();
      keyConfig.failureCount = 0; // 성공 시 실패 카운트 리셋
    }
  }

  /**
   * API 키 사용 실패 기록
   */
  recordFailure(key: string, error: any): void {
    const keyConfig = this.keys.find(k => k.key === key);
    if (keyConfig) {
      keyConfig.failureCount++;

      // 실패 횟수가 임계점을 넘으면 키 비활성화
      if (keyConfig.failureCount >= this.maxFailuresBeforeDisable) {
        keyConfig.isActive = false;
        console.warn(`API key ${keyConfig.name} disabled after ${keyConfig.failureCount} failures`);

        // 현재 키가 비활성화되면 즉시 로테이션
        if (this.keys[this.currentIndex] === keyConfig) {
          this.rotateToNextKey();
        }
      }

      // 특정 에러 코드에 대해서는 즉시 비활성화
      if (this.shouldDisableImmediately(error)) {
        keyConfig.isActive = false;
        console.warn(`API key ${keyConfig.name} immediately disabled due to: ${error.message}`);
      }
    }
  }

  /**
   * 즉시 비활성화해야 하는 에러인지 체크
   */
  private shouldDisableImmediately(error: any): boolean {
    const immediateDisableErrors = [
      'invalid_api_key',
      'api_key_invalid',
      'unauthorized',
      'forbidden'
    ];

    const errorMessage = error?.message?.toLowerCase() || '';
    const errorCode = error?.code?.toLowerCase() || '';

    return immediateDisableErrors.some(pattern =>
      errorMessage.includes(pattern) || errorCode.includes(pattern)
    );
  }

  /**
   * 모든 키가 사용 가능한지 체크
   */
  hasAvailableKeys(): boolean {
    return this.keys.some(k => k.isActive);
  }

  /**
   * API 키 통계 반환
   */
  getStats(): APIKeyStats {
    const activeKeys = this.keys.filter(k => k.isActive);
    const failedKeys = this.keys.filter(k => !k.isActive);
    const totalUsage = this.keys.reduce((sum, k) => sum + k.usageCount, 0);

    return {
      totalKeys: this.keys.length,
      activeKeys: activeKeys.length,
      failedKeys: failedKeys.length,
      currentKeyIndex: this.currentIndex,
      totalUsage,
      rotationCount: this.rotationCount
    };
  }

  /**
   * 키 상태 상세 정보 반환 (디버깅용)
   */
  getDetailedStatus(): { keys: Omit<APIKeyConfig, 'key'>[] } {
    return {
      keys: this.keys.map(k => ({
        name: k.name,
        usageCount: k.usageCount,
        failureCount: k.failureCount,
        lastUsed: k.lastUsed,
        isActive: k.isActive,
        quotaLimit: k.quotaLimit
      }))
    };
  }

  /**
   * 비활성화된 키 재활성화 (관리자용)
   */
  reactivateKey(keyName: string): boolean {
    const keyConfig = this.keys.find(k => k.name === keyName);
    if (keyConfig) {
      keyConfig.isActive = true;
      keyConfig.failureCount = 0;
      console.log(`API key ${keyName} reactivated`);
      return true;
    }
    return false;
  }

  /**
   * 모든 키 사용량 리셋 (일일 리셋용)
   */
  resetUsageCounters(): void {
    this.keys.forEach(k => {
      k.usageCount = 0;
      k.failureCount = 0;
    });
    console.log('All API key usage counters reset');
  }
}

// 싱글톤 인스턴스
export const apiKeyManager = new APIKeyManager();

// 타입 익스포트
export type { APIKeyConfig, APIKeyStats };