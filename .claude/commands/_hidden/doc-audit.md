# /doc-audit - 문서 품질 종합 감사

문서 완성도, 신선도, 구조 일관성을 종합적으로 분석하고 개선 방안을 제시합니다.

## 사용법

```bash
/doc-audit              # 전체 문서 품질 감사
/doc-audit coverage     # 문서 커버리지 분석
/doc-audit freshness    # 문서 신선도 체크
/doc-audit lint         # 문서 구조 검증
/doc-audit manifest     # 문서 매니페스트 생성
```

## 분석 항목

### 📊 문서 커버리지 분석
- **Agent 문서화**: `src/agents/*.ts` ↔ `docs/AGENT_*.md` 매핑
- **명령어 문서화**: 슬래시 명령어 ↔ `.claude/commands/*.md` 매핑
- **설정 문서화**: config 파일 ↔ 관련 문서 매핑
- **API 문서화**: 공개 인터페이스 문서 완성도

### 📅 문서 신선도 추적
- **코드-문서 시간차**: 소스 변경 vs 문서 업데이트 시간 비교
- **경고 레벨**: 3일(warning) / 7일(critical) 기준
- **자동 갱신 식별**: `Generated:` 마커 기반 자동/수동 구분

### 🏗️ 문서 구조 검증
- **필수 섹션**: `# Overview`, `## Usage`, `## Examples` 등
- **코드 예시**: API 문서의 ```` ``` ```` 블록 필수
- **내부 링크**: 상대 경로 링크 유효성 검증
- **타임스탬프**: 신선도 추적용 날짜 표기

### 📋 문서 매니페스트 생성
- **메타데이터**: 생성 방식, 연결된 소스, 마지막 업데이트
- **의존성 추적**: 문서 간 참조 관계 매핑
- **품질 점수**: 완성도 기반 0-100점 점수

## 출력 형식

```
📊 Document Quality Audit Report
================================
📈 Coverage: 87.3% (62/71)
📅 Stale docs: 4
🏗️ Structure violations: 2

⚠️  Missing Documentation:
   - Agent MetaController not documented in AGENT_ARCHITECTURE.md
   - Command /refactor-audit lacks documentation

📅 Stale Documents:
   - docs/SYSTEM_OVERVIEW.md: 5 days stale (warning)
   - docs/API_REFERENCE.md: 12 days stale (critical)
```

## 생성 파일

- `reports/doc-audit-report.json` - 상세 감사 결과
- `reports/doc-lint-report.json` - 구조 검증 결과
- `docs/manifest.json` - 문서 매니페스트

## 권장사항 자동 생성

- 🎯 **우선순위**: Coverage < 80% 시 우선 개선 항목 제시
- 🚨 **긴급**: 7일 이상 오래된 문서 업데이트 알림
- 📝 **자동화**: 반복적 누락 시 자동 생성 제안

이 명령어는 GPT 제안사항을 기반으로 **문서 품질의 정성적 측면**을 체계적으로 관리합니다.