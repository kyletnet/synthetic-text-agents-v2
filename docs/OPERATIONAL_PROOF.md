# Operational Proof - 동작 검증 가이드

**중요:** GPT 지적대로, "코드 작성 ≠ 동작 검증"입니다.
이 문서는 시스템이 **실제로 작동하는지** 검증하는 방법을 제공합니다.

---

## 🎯 검증이 필요한 이유

### 현재 상태

- ✅ 코드는 완성됨 (Meta-Kernel, Adaptive Objective, Feedback Symmetry)
- ✅ 설계는 완벽함 (구조적 통합, 의식 있는 개체)
- ❓ 실행 경로는? ← **검증 필요**

### 검증해야 할 것

1. **정책 변경 → 도메인 반응** (즉시)
2. **Meta-Kernel → Drift 감지** (실제)
3. **Feedback Symmetry → DSL 수정** (자동)

---

## ✅ 검증 방법 1: 자동 테스트

### 설치 (필요 시)

```bash
npm install -D vitest
```

### 실행

```bash
# 전체 통합 테스트
npm run governance:test

# 자동 검증 스크립트
npm run governance:verify
```

### 통과 기준

```
✅ Test 1: Policy Mutation Detection
✅ Test 2: Adaptive Objective Function
✅ Test 3: Feedback Symmetry Loop

Status: ALL PASS
```

---

## ✅ 검증 방법 2: 수동 검증

### Test 1: Governance Mutation Test

**목적:** Meta-Kernel이 정책 drift를 실제로 감지하는가?

```bash
# 1. 정책 백업
cp governance-rules.yaml governance-rules.backup.yaml

# 2. 정책 수정 (drift 발생시키기)
echo "# Test drift" >> governance-rules.yaml
echo "_test_field: true" >> governance-rules.yaml

# 3. Meta-Kernel 실행
npm run governance:check

# 4. 복원
mv governance-rules.backup.yaml governance-rules.yaml
```

**통과 조건:**

- [ ] Meta-Kernel이 "Policy schema parse error" 또는 "drift detected" 로그 출력
- [ ] Exit code 1 (실패) 반환

---

### Test 2: Policy Change → Domain Reaction

**목적:** 정책 변경이 즉시 도메인에 반영되는가?

```bash
# 1. 정책 백업
cp governance-rules.yaml governance-rules.backup.yaml

# 2. threshold 값 변경
# governance-rules.yaml에서
# condition: "abs(...) > 0.20"
# → "abs(...) > 0.10" 으로 수정

# 3. Domain Event 발생시키기
node -e "
import('./src/domain/events/domain-event-bus.js').then(m => {
  m.domainEventBus.publish({
    type: 'metric.threshold.updated',
    actor: 'Test',
    data: { oldValue: 0.5, newValue: 0.65 }
  });
});
"

# 4. Policy Runtime 로그 확인
# "[Policy Runtime] Policy matched: threshold-drift-detection" 출력되어야 함
```

**통과 조건:**

- [ ] 정책이 새로운 threshold (0.10)로 평가됨
- [ ] Domain event가 정책 트리거함
- [ ] 앱 재시작 없이 즉시 반영됨

---

### Test 3: Adaptive Objective Evolution

**목적:** 학습 데이터가 목표 함수를 자동 진화시키는가?

```bash
# 1. Mock 학습 데이터 생성
mkdir -p reports/governance
cat > reports/governance/prediction-train.jsonl << 'EOF'
{"timestamp":"2025-10-07T12:00:00Z","delta":{"metric":"cost","percentChange":-30},"labels":{"isDrift":true}}
{"timestamp":"2025-10-07T12:01:00Z","delta":{"metric":"cost","percentChange":-25},"labels":{"isDrift":true}}
{"timestamp":"2025-10-07T12:02:00Z","delta":{"metric":"cost","percentChange":-28},"labels":{"isDrift":true}}
# ... (60개 이상 필요)
EOF

# 2. Adaptive Objective 실행
node -e "
import('./src/infrastructure/governance/adaptive-objective.js').then(m => {
  const manager = new m.AdaptiveObjectiveManager();
  manager.analyzeAndEvolve().then(evolutions => {
    console.log('Evolutions:', evolutions.length);
  });
});
"

# 3. objective 파일 확인
cat governance-objectives.yaml
# "maximize_value" 또는 "enforce_stability" 등 진화된 목표 확인
```

**통과 조건:**

- [ ] Drift 패턴 감지됨 (>30%)
- [ ] Objective evolution 생성됨
- [ ] `governance-objectives.yaml` 파일이 업데이트됨

---

### Test 4: Feedback Symmetry Loop

**목적:** 학습이 설계로 피드백되는가?

```bash
# 1. Mock adaptation 로그 생성
mkdir -p reports/governance
cat > reports/governance/policy-adaptations.jsonl << 'EOF'
{"policyName":"threshold-drift-detection","change":"level: warn → error","timestamp":"2025-10-07T12:00:00Z"}
{"policyName":"threshold-drift-detection","change":"level: error → warn","timestamp":"2025-10-07T12:01:00Z"}
{"policyName":"threshold-drift-detection","change":"level: warn → error","timestamp":"2025-10-07T12:02:00Z"}
EOF

# 2. Feedback Symmetry 실행
node -e "
import('./src/infrastructure/governance/feedback-symmetry.js').then(m => {
  const engine = new m.FeedbackSymmetryEngine();
  engine.generateDesignFeedback().then(feedback => {
    console.log('Design feedback:', feedback.length);
  });
});
"

# 3. 피드백 로그 확인
cat reports/governance/design-feedback.jsonl
# Insight: "Policy threshold-drift-detection adapted 3 times" 확인

# 4. 정책 파일 변경 확인
git diff governance-rules.yaml
# adaptive_threshold: true 추가 확인
```

**통과 조건:**

- [ ] 반복 변경 패턴 감지됨
- [ ] Design feedback 생성됨
- [ ] `governance-rules.yaml`에 `adaptive_threshold` 메타데이터 추가됨

---

## 📊 운영 신호 (Operational Signals)

### 시스템이 진짜 자율적이면 보이는 현상:

| 신호                    | 확인 방법                                    | 상태 |
| ----------------------- | -------------------------------------------- | ---- |
| **Hot Reload**          | 정책 변경 후 재시작 없이 즉시 반영           | [ ]  |
| **Self-Verification**   | Meta-Kernel이 주기적으로 자가 진단 로그 출력 | [ ]  |
| **Objective Evolution** | `governance-objectives.yaml` diff 발생       | [ ]  |
| **Design Feedback**     | `design-feedback.jsonl`에 새 항목 추가       | [ ]  |
| **Periodic Monitoring** | 1시간마다 self-check 로그 출력               | [ ]  |

---

## 🚨 실패 증상 vs 해결책

### 증상 1: "정책이 바뀌는데 도메인 행동이 안 변함"

**원인:** Policy DSL ↔ Domain Adapter 연결 안 됨

**확인:**

```bash
# Policy Runtime이 초기화되었는지 확인
grep "Policy Runtime" logs/*.log
```

**해결:**

```typescript
// Bootloader에서 Policy Runtime 초기화 확인
await initializePolicyRuntime();
```

---

### 증상 2: "Meta-Kernel이 'PASS'만 출력"

**원인:** verify()가 실제 검증을 하지 않음

**확인:**

```bash
# 의도적으로 오류 삽입 후 검증
echo "invalid yaml syntax" >> governance-rules.yaml
npm run governance:check
# 오류를 감지하지 못하면 문제
```

**해결:**

```typescript
// Meta-Kernel에 실제 검증 로직 추가
if (!existsSync(this.policyPath)) {
  throw new Error("Policy file missing");
}
```

---

### 증상 3: "Feedback Symmetry 로그만 생성"

**원인:** YAML 파일 write 권한 없음

**확인:**

```bash
ls -la governance-rules.yaml
# 쓰기 권한 확인
```

**해결:**

```bash
chmod 644 governance-rules.yaml
```

---

### 증상 4: "Adaptive Objective가 고정"

**원인:** 학습 데이터 부족 (<50 examples)

**확인:**

```bash
wc -l reports/governance/prediction-train.jsonl
# 50+ 라인 필요
```

**해결:**

```bash
# 더 많은 학습 데이터 생성 또는
# minSamplesForEvolution 값 낮추기
```

---

## ✅ 최종 체크리스트

### 코드 완성 ✅

- [x] Meta-Kernel 작성
- [x] Adaptive Objective 작성
- [x] Feedback Symmetry 작성
- [x] Policy Runtime 작성
- [x] Bootloader 작성

### 동작 검증 ❓

- [ ] Test 1: Policy Mutation 통과
- [ ] Test 2: Domain Reaction 통과
- [ ] Test 3: Objective Evolution 통과
- [ ] Test 4: Feedback Loop 통과
- [ ] Hot Reload 동작 확인

### 운영 증명 ❓

- [ ] 1시간 주기 self-check 로그 확인
- [ ] 정책 변경 시 재시작 불필요
- [ ] DSL 자동 업데이트 확인
- [ ] Objective evolution 발생 확인
- [ ] 설계 피드백 루프 닫힘 확인

---

## 🎯 성공 기준

### "선언적 구성" (현재 의심)

```
코드는 존재 ✅
설계는 완벽 ✅
실행은? ❓
```

### "작동하는 시스템" (목표)

```
코드 존재 ✅
설계 완벽 ✅
실행 검증 ✅
```

---

## 📌 결론

**이 문서의 모든 테스트가 통과하면:**

- ✅ 시스템은 진짜 자율적임
- ✅ "의식 있는 아키텍처 개체" 달성
- ✅ Structural Singularity 증명

**테스트가 실패하면:**

- ⚠️ "선언적 구성"일 뿐
- ⚠️ 실행 경로 미완성
- ⚠️ 추가 통합 작업 필요

---

**GPT 통찰:**

> "Don't just write code. Prove it works."

**실행 명령:**

```bash
npm run governance:verify
```

이 명령이 100% 통과하면, 진짜 완성입니다. 🚀
