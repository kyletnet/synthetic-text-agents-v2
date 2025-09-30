# 🚨 Self-Healing System 운영 가이드

**Last Updated**: 2025-09-30
**Audience**: DevOps, SRE, System Administrators

---

## 📋 목차

1. [시스템 상태 확인](#시스템-상태-확인)
2. [Dormant Mode 복구](#dormant-mode-복구)
3. [Circuit Breaker 관리](#circuit-breaker-관리)
4. [Background Task 관리](#background-task-관리)
5. [Feature Flag 제어](#feature-flag-제어)
6. [트러블슈팅](#트러블슈팅)
7. [비상 대응 절차](#비상-대응-절차)

---

## 시스템 상태 확인

### 기본 상태 조회

```bash
curl http://localhost:3001/api/status | jq '.'
```

### 핵심 메트릭 확인

```bash
# Self-Healing 상태
curl http://localhost:3001/api/status | jq '.selfHealing'

# Circuit Breaker 상태
curl http://localhost:3001/api/status | jq '.circuitBreakers'

# Background Tasks
curl http://localhost:3001/api/status | jq '.backgroundTasks'

# Issues & Recommendations
curl http://localhost:3001/api/status | jq '{issues, recommendations}'
```

### 정상 상태 예시

```json
{
  "status": "healthy",
  "selfHealing": {
    "enabled": true,
    "isDormant": false,
    "consecutiveFailures": 0,
    "backoffDelay": 5000,
    "totalAttempts": 42,
    "successfulHealings": 40,
    "failedHealings": 2
  },
  "circuitBreakers": [
    {
      "name": "self-healing-main",
      "state": "CLOSED",
      "failureCount": 0
    }
  ],
  "backgroundTasks": {
    "totalTasks": 3,
    "activeTasks": 3
  },
  "issues": []
}
```

### ⚠️ 경고 상태 예시

```json
{
  "status": "warning",
  "selfHealing": {
    "consecutiveFailures": 5  // ⚠️ 10에 가까워짐
  },
  "issues": [
    "WARNING: Self-Healing has 5 consecutive failures"
  ],
  "recommendations": [
    "System approaching Dormant Mode threshold (10 failures)"
  ]
}
```

### 🚨 위기 상태 예시

```json
{
  "status": "critical",
  "selfHealing": {
    "isDormant": true,  // 🚨 Dormant Mode
    "dormantReason": "Exceeded maximum consecutive failures (10)"
  },
  "circuitBreakers": [
    {
      "name": "self-healing-main",
      "state": "PERMANENT_OPEN",  // 🚨 영구 차단
      "permanentOpenReason": "Exceeded permanent failure threshold"
    }
  ],
  "issues": [
    "CRITICAL: Self-Healing Engine in DORMANT mode"
  ],
  "recommendations": [
    "Call POST /api/system/heal/resume with valid reason"
  ]
}
```

---

## Dormant Mode 복구

### 📌 Dormant Mode란?

- Self-Healing Engine이 **완전히 멈춘 상태**
- 10번 연속 실패 또는 Circuit Breaker PERMANENT_OPEN 시 진입
- **수동 개입 없이는 절대 복구 안됨**

---

### 🔍 Step 1: 현재 상태 확인

```bash
# Dormant 상태인지 확인
curl http://localhost:3001/api/status | jq '.selfHealing.isDormant'
# true → Dormant Mode

# Dormant 이유 확인
curl http://localhost:3001/api/status | jq '.selfHealing.dormantReason'
# "Exceeded maximum consecutive failures (10)"
```

---

### 🛠️ Step 2: 근본 원인 해결

#### Case 1: API Key 문제

```bash
# API key 상태 확인
curl http://localhost:3001/api/status | jq '.llm.keyManagement'

# 출력 예시:
# {
#   "totalKeys": 0,      # ⚠️ 키가 없음
#   "activeKeys": 0,
#   "failedKeys": 0
# }
```

**해결책**:
```bash
# 환경변수에 API key 추가
export ANTHROPIC_API_KEY="sk-ant-api03-..."

# 또는 .env.local 파일 수정
echo "ANTHROPIC_API_KEY=sk-ant-api03-..." >> .env.local

# 서버 재시작 (환경변수 적용)
# Ctrl+C 후 npm run dev
```

#### Case 2: Circuit Breaker PERMANENT_OPEN

```bash
# Circuit Breaker 상태 확인
curl http://localhost:3001/api/status | jq '.circuitBreakers[] | select(.state == "PERMANENT_OPEN")'
```

**해결책**: Step 3에서 수동 리셋 필요

---

### ▶️ Step 3: Dormant Mode 해제

#### 방법 1: API 호출 (권장)

```bash
# POST /api/system/heal/resume 엔드포인트 생성 필요
curl -X POST http://localhost:3001/api/system/heal/resume \
  -H "Content-Type: application/json" \
  -d '{"reason": "Valid API keys added"}'
```

#### 방법 2: 서버 콘솔에서 직접 실행

```typescript
// Node.js REPL 또는 서버 코드에서
import { selfHealingEngine } from './lib/self-healing-engine';

selfHealingEngine.resumeFromDormant('Valid API keys restored');
// ✅ Returns: true
```

#### 방법 3: 서버 재시작 (최후의 수단)

```bash
# Ctrl+C로 서버 중단
# npm run dev로 재시작

# ⚠️ 주의: 근본 원인 해결 없이 재시작하면 다시 Dormant 진입
```

---

### ✅ Step 4: 복구 확인

```bash
# 1. Dormant Mode 해제 확인
curl http://localhost:3001/api/status | jq '.selfHealing.isDormant'
# false

# 2. Consecutive failures 리셋 확인
curl http://localhost:3001/api/status | jq '.selfHealing.consecutiveFailures'
# 0

# 3. Circuit Breaker 상태 확인
curl http://localhost:3001/api/status | jq '.circuitBreakers[] | select(.name == "self-healing-main").state'
# "CLOSED"

# 4. 전체 상태 확인
curl http://localhost:3001/api/status | jq '.status'
# "healthy" 또는 "warning"
```

---

### 🔄 Step 5: 모니터링

복구 후 **최소 30분간 모니터링** 필요:

```bash
# 1분마다 상태 확인
watch -n 60 'curl -s http://localhost:3001/api/status | jq "{status, selfHealing: .selfHealing.consecutiveFailures}"'
```

**정상 시나리오**:
```
consecutiveFailures: 0 → 0 → 0 (유지)
```

**비정상 시나리오**:
```
consecutiveFailures: 0 → 1 → 2 → 3  (증가 중)
→ Step 2로 돌아가서 근본 원인 재확인 필요
```

---

## Circuit Breaker 관리

### 상태 조회

```bash
# 모든 Circuit Breaker 상태
curl http://localhost:3001/api/status | jq '.circuitBreakers'
```

### 상태별 의미

| 상태 | 의미 | 조치 |
|------|------|------|
| `CLOSED` | 정상 | 없음 |
| `OPEN` | 임시 차단 (1분) | 1분 후 자동 복구 시도 |
| `HALF_OPEN` | 복구 시도 중 | 모니터링만 |
| `PERMANENT_OPEN` | 영구 차단 | **수동 리셋 필수** |

### PERMANENT_OPEN 수동 리셋

```typescript
import { circuitBreakerRegistry } from './lib/circuit-breaker';

// Circuit Breaker 찾기
const breaker = circuitBreakerRegistry.get('self-healing-main');

// 강제 리셋 (force=true 필수)
breaker.reset(true);

console.log('Circuit Breaker reset:', breaker.getState());
```

### ⚠️ 주의사항

- PERMANENT_OPEN 리셋 전에 **반드시 근본 원인 해결 먼저**
- 리셋만 하고 원인 미해결 시 **다시 PERMANENT_OPEN 됨**

---

## Background Task 관리

### 현재 Task 목록 조회

```bash
curl http://localhost:3001/api/status | jq '.backgroundTasks.tasks'
```

### 정상적인 Task 수

- **3-5개**: 정상
- **6-10개**: 주의 (정리 고려)
- **10개 이상**: ⚠️ 과부하 (즉시 조치 필요)

### Task 정리 방법

```typescript
import { backgroundTaskManager } from './lib/background-task-manager';

// 특정 task 해제
backgroundTaskManager.unregister('task-id');

// 모든 task 정리 (비상 시)
backgroundTaskManager.cleanup();

// 전역 일시정지
backgroundTaskManager.pauseAll();

// 전역 재개
backgroundTaskManager.resumeAll();
```

### Task 중복 감지

```bash
# Task ID 중복 체크
curl http://localhost:3001/api/status | jq '.backgroundTasks.tasks | group_by(.id) | map(select(length > 1))'

# 결과가 [] 이면 중복 없음
# 결과가 있으면 중복 발생 → 서버 재시작 필요
```

---

## Feature Flag 제어

### 현재 설정 확인

```bash
# .env.local 파일 확인
cat .env.local | grep FEATURE_
```

### 전체 자동화 비활성화 (긴급)

```bash
# .env.local에 추가
cat >> .env.local << EOF
FEATURE_AUTO_HEALING_ENABLED=false
FEATURE_AUTO_DETECTION_MONITORING=false
FEATURE_PREVENTIVE_HEALING_ENABLED=false
FEATURE_PROCESS_MONITORING_ENABLED=false
EOF

# 서버 재시작
# Ctrl+C 후 npm run dev
```

### 개별 기능 제어

```bash
# 자동 치유만 OFF
echo "FEATURE_AUTO_HEALING_ENABLED=false" >> .env.local

# 자동 감지만 OFF
echo "FEATURE_AUTO_DETECTION_MONITORING=false" >> .env.local

# 예방적 치유만 OFF
echo "FEATURE_PREVENTIVE_HEALING_ENABLED=false" >> .env.local
```

### 재활성화

```bash
# .env.local에서 해당 라인 제거
sed -i '' '/FEATURE_AUTO_HEALING_ENABLED/d' .env.local

# 또는 true로 변경
echo "FEATURE_AUTO_HEALING_ENABLED=true" >> .env.local
```

---

## 트러블슈팅

### 문제 1: "Self-Healing이 멈췄어요"

**증상**:
```bash
curl http://localhost:3001/api/status | jq '.selfHealing.isDormant'
# true
```

**해결**: [Dormant Mode 복구](#dormant-mode-복구) 참조

---

### 문제 2: "API 키가 있는데도 실패해요"

**진단**:
```bash
# 1. API 키 상태 확인
curl http://localhost:3001/api/status | jq '.llm.keyManagement'

# 2. Circuit Breaker 상태 확인
curl http://localhost:3001/api/status | jq '.circuitBreakers'

# 3. Issues 확인
curl http://localhost:3001/api/status | jq '.issues'
```

**가능한 원인**:
- API 키가 유효하지 않음 (Anthropic 콘솔에서 확인)
- Rate limit 초과
- Circuit Breaker가 OPEN 상태

---

### 문제 3: "Background task가 20개 이상이에요"

**긴급 조치**:
```bash
# 서버 재시작 (HMR cleanup 실행됨)
# Ctrl+C 후 npm run dev
```

**근본 원인**: BackgroundTaskManager 사용하지 않고 직접 `setInterval` 사용

**해결책**: 코드에서 `setInterval` 찾아서 `backgroundTaskManager.registerInterval`로 변경

---

### 문제 4: "consecutiveFailures가 계속 증가해요"

**진단**:
```bash
# Backoff delay 확인
curl http://localhost:3001/api/status | jq '.selfHealing.backoffDelay'
# 예: 320000 (5분 20초)

# Circuit Breaker 상태
curl http://localhost:3001/api/status | jq '.circuitBreakers[] | select(.name == "self-healing-main")'
```

**조치**:
1. API 키 유효성 재확인
2. Anthropic API 서비스 상태 확인 (status.anthropic.com)
3. 네트워크 연결 확인

---

## 비상 대응 절차

### 🔥 레벨 1: Dormant Mode 진입 (CRITICAL)

**1분 안에 해야 할 것**:
```bash
# 1. 상태 확인
curl http://localhost:3001/api/status | jq '{status, selfHealing: .selfHealing.isDormant, issues}'

# 2. Feature Flag로 자동화 중단
echo "FEATURE_AUTO_HEALING_ENABLED=false" >> .env.local

# 3. 서버 재시작
# Ctrl+C 후 npm run dev
```

**5분 안에 해야 할 것**:
```bash
# 1. 근본 원인 파악
curl http://localhost:3001/api/status | jq '{issues, recommendations}'

# 2. API 키 확인 및 추가
export ANTHROPIC_API_KEY="sk-ant-..."

# 3. Dormant Mode 해제
# (resumeFromDormant 호출 또는 서버 재시작)
```

---

### 🔥 레벨 2: Background Task 과부하 (WARNING)

```bash
# 1. 즉시 cleanup
backgroundTaskManager.cleanup();

# 2. 서버 재시작
# Ctrl+C 후 npm run dev

# 3. 모니터링
curl http://localhost:3001/api/status | jq '.backgroundTasks.totalTasks'
```

---

### 🔥 레벨 3: API 키 모두 실패 (CRITICAL)

```bash
# 1. 모든 자동화 중단
cat >> .env.local << EOF
FEATURE_AUTO_HEALING_ENABLED=false
FEATURE_AUTO_DETECTION_MONITORING=false
EOF

# 2. 새 API 키 추가
export ANTHROPIC_API_KEY="sk-ant-새로운키..."

# 3. 서버 재시작

# 4. 상태 확인
curl http://localhost:3001/api/status | jq '.llm.keyManagement.activeKeys'
# 1 이상 확인

# 5. 자동화 재활성화
sed -i '' '/FEATURE_AUTO_HEALING_ENABLED/d' .env.local
```

---

## 📞 지원 및 문의

### 로그 확인

```bash
# Self-Healing 로그
grep "SelfHealing" logs/*.log

# Circuit Breaker 로그
grep "CircuitBreaker" logs/*.log

# Background Task 로그
grep "BackgroundTaskManager" logs/*.log
```

### 디버그 모드

```bash
DEBUG=self-healing:* npm run dev
```

### 문의

- **GitHub Issues**: https://github.com/your-repo/issues
- **Slack**: #platform-reliability
- **Docs**: `/docs/RFC/2025-09-self-healing-governance.md`

---

**Last Updated**: 2025-09-30
**Version**: 1.0.0