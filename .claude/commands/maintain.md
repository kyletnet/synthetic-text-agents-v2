# /maintain - 스마트 자동 유지보수

모든 시스템 점검, 리팩토링, 문서 갱신, 백업을 자동으로 처리하는 통합 명령어입니다.

## 사용법

```bash
/maintain              # 스마트 유지보수 (권장)
/maintain quick        # 빠른 유지보수 (critical만)
```

## 🤖 자동 실행되는 작업들

### ✅ **Daily (매일 자동)**

- 시스템 건강도 체크 (`/status`)
- Self-Designing System 자동 진화 (`/evolve`)
- 보안 감사
- TypeScript 오류 체크 (수동 승인)

### ✅ **Weekly (주간 자동)**

- 통합 규칙 감사
- 전체 시스템 리팩토링 분석
- 성능 최적화 제안

### ✅ **On-Change (변경 시 자동)**

- 문서 자동 동기화 (`docs:refresh`)
- 컴포넌트 레지스트리 갱신
- 설계 원칙 재적용

### ✅ **Before-Commit (커밋 전 자동)**

- TypeScript 컴파일 체크
- 코드 스타일 검증
- 테스트 실행

## 🎯 Smart Maintenance의 장점

**기존 5개 명령어 → 1개로 통합!**

- ✅ `/check` + `/status` + `/fix` + `/evolve` + 문서갱신 + 백업 → **`/maintain`**
- 🤖 사용자가 신경 쓸 필요 없음 - 알아서 필요한 것만 실행
- ⚡ 중복 작업 제거 - 이미 최신이면 스킵
- 📊 실행 결과 리포트 자동 생성

## 📋 실행 예시

```
🤖 Smart Maintenance Orchestrator Starting...
════════════════════════════════════════════════════════
📊 Total maintenance tasks: 7
⚡ Tasks due for execution: 3

🔧 Executing: system-health-check
📝 시스템 전체 건강도 체크
✅ Completed (2.1s)

🔧 Executing: auto-evolution
📝 Self-Designing System 자동 진화
✅ Completed (4.7s) - 2 improvements applied

⏭️ Skipping: documentation-sync (already up-to-date)

🎯 Smart Maintenance Report
════════════════════════════════════════════════════════
✅ Completed: 2/3 tasks
📈 Success Rate: 100%
🚀 Next maintenance: 24 hours
```

## 실행 명령어

```bash
# 스마트 유지보수 (모든 필요한 작업 자동 실행)
npm run maintain

# 빠른 유지보수 (critical 작업만)
npm run maintain:quick
```

**이제 딱 1개 명령어만 기억하면 됩니다!** 🤖✨

모든 시스템 관리가 **완전 자동화**되었습니다.
