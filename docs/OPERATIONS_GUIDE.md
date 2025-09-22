# Operations Guide (Non-Dev)
## 하루/주간 체크
- 실행 후: Run Log·Decision 카드 초안 자동 생성 → **한 줄 보완 후 커밋**
- 주 1회(30초): `SYSTEM_OVERVIEW.md`의 **Quick Links 3건** 갱신

## 트리거에 따른 액션(예시 문구)
- PASS 낮고 **hallucination**↑ → "근거 부족—인용 강제·사실성 가중 ↑"
- **too_easy**↑ → "난이도 상향"
- **overuse_jargon**↑ → "전문용어 줄이고 톤 통일"
- **Latency**↑ → "Guardian 지연 한도 재검토"

## 전략을 언제 만지나?
- 피드백 반영 후에도 **Red/Amber 지속** 시 소폭 조정(표준 스텝) → 미니 재실행 → 결과 기록.
- 한 번에 1~2개 노브만. 실패 시 Ledger 기준 **즉시 롤백**.

## 피드백은 이렇게 쓰세요(복붙 예시)
- "근거 부족. 인용 강제하고 사실성 가중 올려줘." → `hallucination`
- "너무 쉬움. 난이도 상향." → `too_easy`
- "전문용어가 많아. 톤은 친절하게." → `overuse_jargon`
> 시스템이 태그/조치 초안을 만들고 Decision 카드로 남깁니다. 범위·스텝은 Strategy Profile을 따릅니다.

## 어디서 무엇을 보나?
- 현황 한 눈에: `docs/SYSTEM_OVERVIEW.md`
- 최근 실행 상세: `docs/RUN_LOGS/`
- 왜 그렇게 바꿨는지: `docs/LEDGER/`