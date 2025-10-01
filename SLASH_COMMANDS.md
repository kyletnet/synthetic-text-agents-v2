# Slash Commands Reference

## 🎯 4-Step Quality Workflow (순서 필수!)

**정밀 진단과 완전 수정을 위한 워크플로우**

### 1. `/inspect` - 정밀 진단

```bash
bash scripts/slash-commands.sh inspect
# OR
npm run status
```

**실행 내용:**

- TypeScript 컴파일 검사
- ESLint/Prettier 검사
- 테스트 실행 상태
- 보안 감사
- 워크어라운드 탐지 (TODO/FIXME/HACK)
- 컴포넌트 문서화 상태
- 리팩토링 대기 항목

**출력:**

- 건강도 점수 (0-100)
- Auto-fixable 항목 목록 → `/maintain`으로 자동 수정
- Manual approval 항목 목록 → `/fix`로 대화형 수정
- 캐시: `reports/inspection-results.json` (TTL: 5분)

---

### 2. `/maintain` - 자동 수정

```bash
bash scripts/slash-commands.sh maintain
# OR
npm run maintain
```

**전제조건:** `/inspect` 먼저 실행 필수 (5분 이내)

**실행 내용:**

- Prettier 자동 포맷팅
- ESLint --fix 자동 수정
- 수정 후 자동 재검증

**특징:**

- 승인 불필요 (자동 실행)
- 캐시 기반 (진단하지 않음)

---

### 3. `/fix` - 대화형 수정

```bash
bash scripts/slash-commands.sh fix
# OR
npm run fix
```

**전제조건:** `/inspect` 먼저 실행 필수 (5분 이내)

**실행 내용:**

- TypeScript 오류 수정 (대화형 승인)
- ESLint 에러 수정 (대화형 승인)
- 워크어라운드 처리 (대화형 승인)
- 문서화 누락 처리 (대화형 승인)

**대화형 옵션:**

- `y`: Approve (승인하고 실행)
- `n`: Skip (건너뛰기)
- `m`: Manual (수동 처리로 표시)
- `a`: Abort (전체 중단)
- `i`: Info (자세한 정보)

---

### 4. `/ship` - 배포 준비 + 실제 배포

```bash
bash scripts/slash-commands.sh ship
```

**전제조건:** `/inspect`, `/maintain`, `/fix` 완료 권장

**실행 내용 (3단계):**

**Phase 1: Pre-ship Validation**

- 오래된 파일 정리
- 명령어 레퍼런스 업데이트

**Phase 2: Ship Pipeline**

- Design principles validation
- System validation & verification
- Integration guard
- Advanced audit
- Documentation sync
- Optimization analysis

**Phase 3: Deploy**

- Auto-commit with timestamp
- Push to remote repository

**출력:**

```
🚢 Deployment complete! Changes pushed to remote.
```

---

## 🔄 완전한 워크플로우 예시

### 일상 개발 (3단계)

```bash
/inspect     # 1. 정밀 진단
/maintain    # 2. 자동 수정
/fix         # 3. 대화형 수정

# 커밋
git add -A
git commit -m "fix: 품질 개선"
```

### 배포 전 (4단계)

```bash
/inspect     # 1. 정밀 진단
/maintain    # 2. 자동 수정
/fix         # 3. 대화형 수정
/ship        # 4. 배포 준비 + 배포
```

---

## 🛠️ System Management Commands

### `/sync` - Complete System Update

```bash
bash scripts/slash-commands.sh sync
```

- Updates all documentation
- Cleans old files
- Validates system health
- Commits and pushes changes

### `/clean` - Cleanup Old Files

```bash
bash scripts/slash-commands.sh clean
```

- Removes old documentation
- Cleans log files
- Removes temporary files

---

## 🔧 Development Commands

### `/map` - Generate System Architecture Map

```bash
bash scripts/slash-commands.sh map
```

### `/build` - Build TypeScript Project

```bash
bash scripts/slash-commands.sh build
```

### `/test` - Run Test Suite

```bash
bash scripts/slash-commands.sh test
```

### `/lint` - Fix Linting Issues

```bash
bash scripts/slash-commands.sh lint
```

---

## 🆘 Recovery Commands

```bash
npm run sync:tx:rollback   # Rollback failed sync
npm run sync:tx:status     # Show last sync status
```

---

## 💡 Pro Tips

1. **순서가 중요합니다!** `/inspect` → `/maintain` → `/fix` → `/ship`
2. **캐시 주의:** `/inspect` 캐시는 5분 TTL. 만료되면 재실행 필요
3. **배포는 신중하게:** `/ship`은 실제 push까지 수행합니다
4. **자동 vs 대화형:** `/maintain`은 자동, `/fix`는 승인 필요

---

**🎯 핵심: 정밀 진단(/inspect)과 완전 수정(/maintain + /fix)으로 완벽한 코드 품질 유지!**

_Last updated: 2025-10-01_
