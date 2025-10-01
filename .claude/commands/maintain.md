# /maintain - 스마트 자동 유지보수

모든 시스템 점검, 리팩토링, 문서 갱신, 백업을 자동으로 처리하는 통합 명령어입니다.

## 사용법

```bash
/maintain              # 스마트 유지보수 (권장)
/maintain quick        # 빠른 유지보수 (critical만)
```

## 🤖 자동 실행되는 작업들

### ✅ **Auto-fix Tasks (자동 수정 - 승인 불필요)**

- Prettier + ESLint 자동 수정
- Self-Designing System 자동 진화
- 문서 자동 동기화
- 컴포넌트 레지스트리 갱신
- 설계 원칙 재적용

### ✅ **Quality Gates (검증만 - 수정 없음)**

- TypeScript 컴파일 체크
- 코드 스타일 검증
- 테스트 실행
- 보안 감사

### ⚠️ **승인 필요 작업은 `/fix`에서 처리**

- TypeScript 오류 수정 → `/fix`
- 워크어라운드 처리 → `/fix`
- 리팩토링 대기 항목 → `/fix`
- 컴포넌트 문서화 → `/fix`

## 🎯 `/maintain`의 역할

**자동 수정만 수행 (승인 불필요)**

- ✅ Prettier/ESLint 자동 수정
- ✅ 문서 동기화
- ✅ 컴포넌트 레지스트리 갱신
- ✅ 자동 진화 (설계 원칙 적용)
- ⚠️ 진단은 하지 않음 (`/inspect`에서 수행)
- ⚠️ 승인 필요 작업은 하지 않음 (`/fix`에서 수행)

## 📋 실행 예시

```
🤖 Smart Maintenance (자동수정) Starting...
════════════════════════════════════════════════════════

🔧 Executing: prettier-autofix
📝 Prettier + ESLint 자동 수정
✅ Completed (1.2s)

🔧 Executing: auto-evolution
📝 Self-Designing System 자동 진화
✅ Completed (3.5s) - 2 improvements applied

🔧 Executing: documentation-sync
📝 문서 자동 동기화
✅ Completed (2.1s)

🎯 Maintenance Report
════════════════════════════════════════════════════════
✅ Auto-fixed: 3 tasks
📈 Success Rate: 100%

💡 다음 단계: npm run fix (대화형 수정)
```

## 실행 명령어

```bash
# 자동 수정 (승인 불필요)
npm run maintain
```

## 🔄 올바른 워크플로우

```bash
1. npm run status    # 진단 (읽기 전용)
2. npm run maintain  # 자동 수정 (승인 불필요)
3. npm run fix       # 대화형 수정 (승인 필요) ← 중요!
4. npm run ship      # 배포 준비
```

**중요**: `/maintain` 실행 후 나온 **승인 필요 항목**은 `/fix`에서 처리합니다!

_Last updated: 2025-10-01_
