# 사용자 가이드 - Inspect 워크플로우

> 비개발자를 위한 시스템 품질 관리 가이드

## 🎯 3단계 워크플로우

```bash
1. npm run status      # 진단 (문제 발견)
2. npm run maintain    # 자동 수정 (승인 불필요)
3. npm run fix         # 수동 승인 (당신의 결정 필요)
```

**⚠️ 중요**: 반드시 이 순서대로 실행하세요!

---

## 1️⃣ npm run status (진단)

### 무엇을 하나요?

시스템 전체를 검사해서 문제를 찾아냅니다.

### 결과 예시

```
🔍 System Inspection Engine v2.0
════════════════════════════════════════════════════════════

🟢 Overall Health Score: 85/100

📋 Issues Found:
   Total: 2개
   ✅ Auto-fixable: 1개        ← 자동으로 고칠 수 있음
   ⚠️  Needs Approval: 1개     ← 당신의 승인 필요

✨ Auto-fixable Items:
   1. 코드 포매팅 불일치

⚠️  Manual Approval Needed:
   1. 🔴 워크어라운드/TODO 마커 144개

✅ Results saved to: reports/inspection-results.json
⏰ Valid for: 5 minutes        ← 5분 안에 다음 단계 진행
```

### 알아둘 점

- **5분 유효**: 결과는 5분간 유효합니다
- **코드 변경 후**: 코드를 많이 수정했으면 다시 실행하세요
- **파일 위치**: `reports/inspection-results.json`에 저장됩니다

---

## 2️⃣ npm run maintain (자동 수정)

### 무엇을 하나요?

**안전한** 항목만 자동으로 수정합니다. 승인 불필요!

### 결과 예시

```
🔧 Maintain Engine - Auto-fix
════════════════════════════════════════════════════════════

✅ Using inspection results from 9초 전

🔧 Found 1 auto-fixable items

[1/1] 코드 포매팅 불일치
   → npx prettier --write .
   ✅ Completed (2.1s)

✅ Success: 1
```

### 실패한 경우

```
🔴 Failed: 1

❌ Failed Items (need manual attention):

1. 코드 포매팅 불일치
   Command: npx prettier --write .
   Error: Command failed with exit code 1
   💡 Suggested: Run command manually to see full error
```

**조치**: 개발자에게 알려주세요!

### 타임아웃

- **2분 타임아웃**: 각 명령어는 최대 2분까지만 실행됩니다
- **타임아웃 발생 시**: 자동으로 실패 처리되고, 실패 목록에 표시됩니다

---

## 3️⃣ npm run fix (수동 승인)

### 무엇을 하나요?

**위험할 수 있는** 항목을 당신에게 보여주고 승인을 요청합니다.

### 화면 예시

```
══════════════════════════════════════════════════════════════════
📋 항목 1/1 - 승인이 필요합니다
══════════════════════════════════════════════════════════════════

🔴 🚨 긴급: 워크어라운드/TODO 마커 144개

📊 상세 정보:
   • 심각도: CRITICAL
   • 발견 개수: 144개
   • 영향: 기술 부채 감소, 코드 품질 개선

💡 권장 조치:
   우선순위가 높은 항목부터 순차적으로 해결 (grep으로 검색 가능)

📁 영향 받는 파일 (상위 5개):
   1. src/rag/embeddings.ts
   2. src/rag/factory.ts
   3. scripts/fix-orchestrator.ts
   4. scripts/ai-fix-engine.ts
   5. scripts/inspection-engine.ts
   ... 외 139개 파일

🤔 이것은 무엇인가요?
   TODO/FIXME 마커는 임시 해결책이나 나중에 수정해야 할 부분을
   표시한 것입니다.

💬 개발자에게 물어볼 질문:
   1. 이 TODO 마커들 중 긴급한 것이 있나요?
   2. 언제까지 해결해야 하나요?
   3. 어떤 것부터 우선 처리해야 하나요?

──────────────────────────────────────────────────────────────────
🔵 결정을 내려주세요:
   y = 승인 (이 문제를 해결하겠습니다)
   n = 건너뛰기 (나중에 처리)
   m = 수동 처리 (직접 확인 필요)
   a = 전체 중단
   i = 더 자세한 정보 보기
──────────────────────────────────────────────────────────────────

👉 선택 [y/n/m/a/i]:
```

### 선택 옵션

| 입력 | 의미      | 결과                             |
| ---- | --------- | -------------------------------- |
| `y`  | 승인      | 개발자가 수동으로 검토합니다     |
| `n`  | 건너뛰기  | 나중에 다시 검토합니다           |
| `m`  | 수동 처리 | 직접 확인이 필요합니다           |
| `a`  | 전체 중단 | 현재까지 처리 내용 저장하고 종료 |
| `i`  | 더 자세히 | 추가 정보를 보여줍니다           |

### 완료 후

```
═════════════════════════════════════════════════════════════════
📊 Fix Session Summary:
   ✅ Approved: 1
   ⏭️  Skipped: 0
   📝 Manual: 0

🚀 Next Steps:
   1. Address 1 approved/manual items
   2. Re-run: npm run status
   3. Verify: npm run ship
```

---

## ⚠️ 주의사항

### 1. 5분 제한

`npm run status` 실행 후 **5분 이내**에 `maintain`과 `fix`를 실행하세요.

**5분 지나면**:

```
⚠️  maintain를 실행하기 전에 /inspect를 먼저 실행하세요
⏰ 진단 결과가 오래되었습니다 (7분 전)
```

**해결**: `npm run status`부터 다시 실행

---

### 2. 순서 건너뛰기

`npm run status` 없이 `maintain`이나 `fix` 실행하면:

```
⚠️  maintain를 실행하기 전에 /inspect를 먼저 실행하세요
📋 진단 결과가 없습니다.
✅ 올바른 순서: npm run status → npm run maintain
```

**해결**: `npm run status`부터 시작

---

### 3. 타임아웃

**maintain에서**:

- 각 명령어는 최대 **2분**까지만 실행
- 타임아웃 발생 → 실패 목록에 표시
- **조치**: 개발자에게 알림

**fix에서**:

- **당신의 승인 대기** 시간은 제한 없음
- 천천히 읽고 결정하세요!

---

## 💡 실전 예시

### 시나리오 1: 정상 워크플로우

```bash
# 오전에 시작
npm run status
# → 2개 문제 발견 (1개 자동, 1개 수동)

npm run maintain
# → 1개 자동 수정 완료

npm run fix
# → 워크어라운드 144개 - 개발자와 상의 후 승인 (y)

# 커밋
git add -A
git commit -m "fix: quality improvements"
```

---

### 시나리오 2: 5분 초과

```bash
npm run status
# → 결과 저장됨

# ... 10분 후 ...

npm run maintain
# ❌ 오류: 진단 결과가 오래되었습니다

# 해결: 다시 진단
npm run status
npm run maintain
```

---

### 시나리오 3: maintain 실패

```bash
npm run maintain

# 출력:
# ✅ Success: 0
# 🔴 Failed: 1
# ❌ Failed Items:
#    1. 코드 포매팅 불일치
#       Error: Command failed

# 조치: 개발자에게 알림
# "maintain에서 '코드 포매팅 불일치' 실패했어요"
```

---

### 시나리오 4: fix 중 불확실

```bash
npm run fix

# 화면:
# 🔴 🚨 긴급: TypeScript 컴파일 오류 5개
# 💬 개발자에게 물어볼 질문:
#    1. 이 TypeScript 오류가 빌드에 영향을 미치나요?

# 선택: i (더 자세히)
# → 추가 정보 확인

# 선택: m (수동 처리)
# → 개발자와 직접 상의 후 결정
```

---

## 📞 도움이 필요할 때

### 개발자에게 알려야 할 정보

1. **어느 단계에서 문제가 생겼나요?**
   - status / maintain / fix

2. **오류 메시지가 있나요?**
   - 화면에 표시된 내용 복사

3. **어떤 항목인가요?**
   - TypeScript 오류 / ESLint 오류 / 워크어라운드 등

### 예시

```
"maintain 단계에서 '코드 포매팅 불일치' 항목이 실패했어요.
Error: Command failed with exit code 1
이라고 나왔는데, 어떻게 해야 하나요?"
```

---

## ✅ 체크리스트

매번 실행 전 확인:

- [ ] `npm run status` 먼저 실행했나요?
- [ ] 5분 이내인가요?
- [ ] 코드를 많이 수정했다면 다시 `status` 실행했나요?

---

**이 가이드로 시스템 품질 관리를 안전하게 수행하세요!** 🎉

문의: 개발팀에 언제든 질문하세요!
