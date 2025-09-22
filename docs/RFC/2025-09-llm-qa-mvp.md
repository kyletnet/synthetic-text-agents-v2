제목: LLM QA MVP (라이트 표준형) — Feature Flag + Dry-run + 규칙화 + 정적 뷰어

배경:
    기존 오케스트레이터/로깅 표준을 유지하면서, LLM 경로를 Feature Flag로 안전하게 추가한다.
    Dry-run으로 비용과 리스크 없이 프롬프트 설계를 검증하고, 피드백→규칙화→재생성 루프를 파일 기반으로 구현한다.

핵심 결정:
    - FEATURE_LLM_QA=false 기본
    - DRY_RUN=true 시작
    - 초기 규칙 5종 적용
    - 단일 재시도(품질 감사 결과 기반)
    - 정적 뷰어 추가 (기존 웹에 페이지 추가)

테스트 플랜:
    1) Dry-run 상태에서 CLI 실행
    2) 정적 뷰어에 baseline/feedback/apply/rerun/report/예제.json 로드
    3) 규칙 체크리스트와 전후 비교가 시각적으로 보이는지 확인
    4) LLM ON 후 재실행하여 rerun_*.jsonl 생성 확인

보강 델타:
    - apply_log.jsonl: 규칙 적용 내역을 qa_index 단위로 기록
    - rerun_*.jsonl: Auditor 재시도 기반 전후 스냅샷 저장
    - review/index.html: CSV 파서와 KPI 집계 추가, RUN_LOGS 수용
    - shared/bus.ts: 레포에 없을 경우 no-op 스텁 자동 생성
    - 해시 유틸: promptSpecHash 계산용 djb2
