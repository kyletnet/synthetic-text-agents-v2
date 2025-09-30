# /ship - 외부 배포 & 동기화

GitHub 등 외부 저장소로 배포하고 동기화하는 통합 명령어입니다.

## 사용법

```bash
/ship                  # 전체 배포 프로세스
/ship docs            # 문서만 동기화
/ship backup          # 백업 생성 후 배포
```

## 🚀 자동 배포 프로세스

### 1. **Pre-Ship 검증**

- 전체 유지보수 실행 (`/maintain`)
- 모든 테스트 통과 확인
- TypeScript 컴파일 성공 확인
- 보안 감사 통과 확인

### 2. **문서 준비**

- 최신 문서 생성 (`docs:refresh`)
- CHANGELOG 자동 업데이트
- README 동기화

### 3. **백업 & 안전장치**

- 현재 상태 백업 생성
- 롤백 포인트 설정

### 4. **Git 동기화**

- 변경사항 자동 커밋
- GitHub 원격 저장소 푸시
- 릴리즈 태그 생성 (옵션)

## 📦 배포 검증 체크리스트

```
✅ System Health: PASS
✅ TypeScript: 0 errors
✅ Tests: All passing
✅ Security: No issues
✅ Docs: Up-to-date
✅ Self-Designing: 90%+ compliance
```

## 실행 명령어

```bash
# 전체 배포 프로세스
npm run ship

# 문서만 외부 동기화
npm run ship:docs

# 백업 포함 안전 배포
npm run ship:safe
```

**완전 자동화된 배포 시스템!** 🚢✨


_Last updated: 2025-09-30_