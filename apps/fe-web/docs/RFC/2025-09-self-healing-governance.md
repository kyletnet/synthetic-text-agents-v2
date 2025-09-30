# RFC: Self-Healing Governance & Fail-Safe Architecture

**Status**: ✅ Implemented
**Date**: 2025-09-30
**Author**: Phase 6 후속 조치 팀
**Category**: System Architecture, Reliability Engineering

---

## 📋 Executive Summary

Phase 6 구현 과정에서 발견된 **3가지 치명적 결함**에 대한 근본 해결책을 제시하고 구현한 RFC입니다.

### 문제점
1. **Self-Healing Engine 무한 루프**: API key 부족 시 healing이 무한 반복
2. **백그라운드 프로세스 과다**: 20+ 개의 프로세스가 orphan 상태로 실행
3. **Circuit Breaker 부재**: 실패 상황에서 자동 중단 메커니즘 없음

### 해결책
**6단계 Layered Protection + 중앙 집중식 관리 아키텍처**

---

## 🎯 설계 목표

### 1. Fail-Safe 보장
- 자동화 시스템이 "알고도 멈추지 못하는 상태" 방지
- 모든 자동 작업에 명확한 종료 조건 설정

### 2. Observability 확보
- 시스템 상태를 `/status` API로 완전 노출
- Dormant Mode, Circuit Breaker, Background Tasks 실시간 추적

### 3. Manual Intervention 가능
- Critical 상황에서 수동 개입으로 복구 가능
- Feature Flag로 자동화 기능 즉시 OFF 가능

---

## 🏗️ 아키텍처 개요

### 핵심 컴포넌트

```
┌─────────────────────────────────────────────┐
│      BackgroundTaskManager (Singleton)       │
│  - 모든 setInterval/setTimeout 중앙 관리     │
│  - HMR cleanup, 중복 방지, 최대 10개 제한   │
└─────────────────────────────────────────────┘
              ↓ 관리
┌─────────────────────────────────────────────┐
│        Auto-Detection Engine (5min)          │
│  - 시스템 건강 체크 (30초 → 5분 완화)       │
│  - Alert 발생 시 Event 전송                 │
└─────────────────────────────────────────────┘
              ↓ Event
┌─────────────────────────────────────────────┐
│     Self-Healing Engine (Event-driven)       │
│  - Exponential Backoff (5초 → 10분)         │
│  - Max 10 failures → Dormant Mode           │
│  - Circuit Breaker 통합                     │
└─────────────────────────────────────────────┘
              ↓ Protected by
┌─────────────────────────────────────────────┐
│    Circuit Breaker (PERMANENT_OPEN)          │
│  - 10번 연속 실패 시 영구 차단              │
│  - 특정 에러 조건 매칭 ('no api key')       │
│  - 수동 reset(true)만 가능                  │
└─────────────────────────────────────────────┘
```

---

## 🛡️ 6단계 Layered Protection

### Layer 1: Feature Flag (긴급 킬 스위치)
```bash
FEATURE_AUTO_HEALING_ENABLED=false           # 자동 치유 OFF
FEATURE_AUTO_DETECTION_MONITORING=false      # 자동 감지 OFF
FEATURE_PREVENTIVE_HEALING_ENABLED=false     # 예방적 치유 OFF
FEATURE_PROCESS_MONITORING_ENABLED=false     # 프로세스 모니터링 OFF
```

**효과**: 즉시 모든 자동화 중단 가능

---

### Layer 2: Exponential Backoff

```typescript
// Base: 5초 → Max: 10분
backoffDelay = baseDelay * 2^consecutiveFailures
```

| 실패 횟수 | Backoff 시간 |
|----------|-------------|
| 1        | 5초         |
| 2        | 10초        |
| 3        | 20초        |
| 4        | 40초        |
| 5        | 1분 20초    |
| 10+      | 10분 (max)  |

**효과**: 반복 실패 시 재시도 간격 지수 증가

---

### Layer 3: Max Consecutive Failures

```typescript
if (consecutiveFailures >= 10) {
  enterDormantMode('Exceeded max failures');
}
```

**효과**: 10번 실패 후 자동으로 Dormant Mode 진입

---

### Layer 4: Circuit Breaker OPEN

```typescript
{
  failureThreshold: 3,      // 3번 실패 후 OPEN
  timeoutWindow: 60000,     // 1분 후 HALF_OPEN
  halfOpenMaxAttempts: 1
}
```

**효과**: 3번 연속 실패 시 1분간 차단

---

### Layer 5: Circuit Breaker PERMANENT_OPEN

```typescript
{
  permanentOpenThreshold: 10,
  permanentOpenConditions: [
    'no active api keys',
    'unauthorized'
  ]
}
```

**효과**: 10번 연속 실패 또는 특정 에러 조건 시 **영구 차단**

---

### Layer 6: Dormant Mode (휴면 모드)

```typescript
interface DormantModeConfig {
  reason: string;
  timestamp: Date;
  triggeredBy: 'automatic' | 'circuit_breaker' | 'manual';
  resumeConditions: string[];
  manualResetRequired: true;
}
```

**진입 조건**:
- 10번 연속 실패
- Circuit Breaker PERMANENT_OPEN
- 수동 요청

**복구 방법**:
```typescript
selfHealingEngine.resumeFromDormant('Valid API keys added');
```

**효과**: 완전한 자동 치유 중단, 수동 복구만 가능

---

## 📊 Background Task Management

### 문제: setInterval 누수

```typescript
// ❌ 이전 방식 (문제)
this.healingInterval = setInterval(async () => {
  await this.performHealing();
}, 30000);

// HMR 재시작 시 interval이 살아있음!
```

### 해결: BackgroundTaskManager

```typescript
// ✅ 개선 방식
backgroundTaskManager.registerInterval(
  'self-healing-preventive',
  async () => {
    await this.performHealing();
  },
  600000, // 10분
  { enabled: true, replace: true }
);

// HMR 재시작 시 자동 cleanup
// module.hot.dispose(() => cleanup())
```

### 특징

1. **중복 방지**: 동일 ID 등록 시 기존 작업 자동 해제
2. **최대 제한**: 동시 실행 10개 제한
3. **자동 Cleanup**:
   - HMR 재시작
   - Process exit
   - SIGINT/SIGTERM
4. **통계 추적**: 실행 횟수, 실패, uptime 추적

---

## 🔄 감지/치유 분리 아키텍처

### 이전 방식 (문제)

```
Auto-Detection (30초 간격)
  ↓ Alert 발생
Self-Healing (1초 debounce)
  ↓ 실패
Auto-Detection (30초 후 다시 감지)
  ↓ Alert 발생
Self-Healing (1초 debounce)
  → 무한 반복!
```

### 개선 방식

```
Auto-Detection (5분 간격)
  ↓ Alert 발생
Self-Healing (Backoff 적용)
  ├─ 1차 실패 → 5초 대기
  ├─ 2차 실패 → 10초 대기
  ├─ 3차 실패 → Circuit Breaker OPEN (1분 차단)
  └─ 10차 실패 → PERMANENT_OPEN / Dormant Mode
```

### 개선 사항

1. **감지 간격 완화**: 30초 → 5분
2. **치유 간격 증가**: Exponential Backoff
3. **Event-driven**: Alert 발생 시에만 치유 실행
4. **Preventive 분리**: 10분 간격 별도 실행

---

## 🔍 Observability 강화

### /status API 확장

```json
{
  "selfHealing": {
    "enabled": true,
    "isDormant": false,
    "consecutiveFailures": 0,
    "backoffDelay": 5000,
    "totalAttempts": 42,
    "successfulHealings": 38,
    "failedHealings": 4
  },
  "circuitBreakers": [
    {
      "name": "self-healing-main",
      "state": "CLOSED",
      "failureCount": 0,
      "lastFailureAgo": null
    }
  ],
  "backgroundTasks": {
    "totalTasks": 3,
    "activeTasks": 3,
    "tasks": [
      {
        "id": "auto-detection-monitoring",
        "type": "interval",
        "enabled": true,
        "executionCount": 12,
        "uptime": 3600
      }
    ]
  },
  "issues": [],
  "recommendations": []
}
```

### 주요 메트릭

1. **Dormant Mode 상태**: 즉시 파악
2. **Circuit Breaker 상태**: PERMANENT_OPEN 감지
3. **Background Tasks**: 누수 감지
4. **Recommendations**: 자동 조언 제공

---

## 🧪 테스트 시나리오

### 자동화 테스트 스크립트

```bash
ts-node scripts/test-self-healing-failure.ts
```

#### 검증 항목

1. ✅ 초기 상태 (healthy)
2. ✅ API key 제거 후 실패 감지
3. ✅ 5번 연속 실패 시 Backoff 증가
4. ✅ 10번 실패 후 Dormant Mode 진입
5. ✅ Circuit Breaker PERMANENT_OPEN 전환
6. ✅ Background Task 중복 없음
7. ✅ 수동 복구 후 정상 동작
8. ✅ Exponential Backoff 리셋

---

## 📖 운영 가이드

### Dormant Mode 복구 절차

#### 1. 상태 확인
```bash
curl http://localhost:3001/api/status | jq '.selfHealing'
```

#### 2. 근본 원인 해결
```bash
# API key 추가
export ANTHROPIC_API_KEY="sk-ant-..."

# 또는 .env 파일 수정
echo "ANTHROPIC_API_KEY=sk-ant-..." >> .env.local
```

#### 3. Circuit Breaker 리셋 (선택)
```bash
# 코드에서 수동으로
circuitBreakerRegistry.get('self-healing-main').reset(true);
```

#### 4. Dormant Mode 해제
```typescript
selfHealingEngine.resumeFromDormant('Valid API keys added');
```

#### 5. 재확인
```bash
curl http://localhost:3001/api/status | jq '.selfHealing.isDormant'
# false 확인
```

---

### Feature Flag 긴급 조치

```bash
# .env.local 파일에 추가
FEATURE_AUTO_HEALING_ENABLED=false
FEATURE_AUTO_DETECTION_MONITORING=false

# 서버 재시작
npm run dev
```

---

## 🎯 성과 및 향후 과제

### ✅ 달성한 것

1. **무한 루프 완전 차단** - 6단계 보호 메커니즘
2. **프로세스 누수 해결** - BackgroundTaskManager로 중앙 관리
3. **Observability 확보** - /status API로 완전 노출
4. **Manual Intervention** - Feature Flag + Dormant Mode
5. **테스트 자동화** - 8가지 시나리오 검증

### 📋 향후 과제 (선택)

1. **관리자 대시보드**: 웹 UI로 상태 모니터링
2. **Slack 알림**: Dormant Mode 진입 시 알림
3. **자동 문서 생성**: /status 응답 → Markdown 변환
4. **Prometheus 통합**: 메트릭 수집 및 시각화

---

## 🔗 관련 문서

- [LLM Governance System RFC](./2024-12-llm-governance-system.md)
- [Development Standards](../DEVELOPMENT_STANDARDS.md)
- [TypeScript Guidelines](../TYPESCRIPT_GUIDELINES.md)

---

## 📝 Changelog

| Date       | Version | Changes |
|------------|---------|---------|
| 2025-09-30 | 1.0.0   | Initial RFC - Phase 6 후속 조치 완료 |

---

**Status**: ✅ Implemented
**Last Updated**: 2025-09-30
**Next Review**: 2025-10-30