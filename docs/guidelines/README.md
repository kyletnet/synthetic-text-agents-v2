# QA Generation Guidelines

이 디렉토리는 QA 생성 품질을 관리하는 가이드라인을 포함합니다.

## 디렉토리 구조

```
docs/guidelines/
├── README.md                       # 이 파일
├── qa-generation-guidelines.md     # 가이드라인 원본
├── versions.json                   # 버전 관리
└── cache/                          # 파싱 캐시
    ├── rules.v1.0.json            # 버전별 파싱 결과
    └── hash.v1.0.txt              # 버전별 해시
```

## 버전 관리

가이드라인 변경 시:

1. **문서 수정**: `qa-generation-guidelines.md` 편집
2. **버전 업데이트**: `versions.json`에서 버전 번호 증가
3. **캐시 재생성**: `npm run quality:parse-guidelines` 실행
4. **검증**: `npm run quality:assess` 실행

## 현재 버전

- **활성 버전**: 1.0
- **효력 발생일**: 2024-10-06
- **질문 유형**: 7가지
- **규칙 개수**: 42개

## 질문 유형 (v1.0)

1. 기본 정보 확인형 (난이도: 하)
2. 조건부 정보 확인형 (난이도: 중)
3. 비교/구분형 (난이도: 중)
4. 절차/방법 확인형 (난이도: 중)
5. 계산/산정형 (난이도: 중상)
6. 조건+예외 복합형 (난이도: 상)
7. 기간/시점 확인형 (난이도: 중)

## 캐시 메커니즘

가이드라인 파서는 다음 조건에서 캐시를 갱신합니다:

- 원본 문서 SHA256 해시 변경
- 버전 번호 변경
- 명시적 재파싱 요청 (`--force` 플래그)

## 참조 문서

- **시스템 아키텍처**: `docs/QUALITY_SYSTEM_ARCHITECTURE.md`
- **확장 가이드**: `docs/QUALITY_EXTENSION_GUIDE.md`
- **구현 스펙**: `docs/RFC/2024-10-quality-enhancement-approaches.md`
