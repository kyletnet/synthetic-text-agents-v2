# RFC 2025-Phase 3 – Hybrid Multimodal RAG Integration


⸻

📄 RFC 2025–Phase 3–5

Hybrid Multimodal RAG Integration & Enterprise Optimization (v2.1 Final)

⸻

1️⃣ 개요 & 목적

본 문서는 RAG 기반 QA 시스템의 Phase 3~5 전체 기술 사양을 정의한다.
Vision-Guided Chunking → Hybrid Search → Adaptive RAG → Reinforced-IR → Quantized LLM 으로 진화하며
비용·속도·정확도·신뢰의 균형을 갖춘 산업용 품질 엔진을 완성한다.

핵심 목표
	•	복잡 문서(PDF/표/이미지) 청킹 품질 +85 pp
	•	검색 정확도 +20 pp, Groundedness +15 pp
	•	토큰 비용 –60 %, Latency –30 %
	•	다국어·멀티도메인 대응
	•	Gate A~G + R/Q/T 완전 자동화

⸻

2️⃣ 기술 트리 및 도입 순서

단계	기술	목적	적용 시기
①	Vision-Guided Chunking (VGC)	시각 정보 보존 청킹	Week 2–3
②	Hybrid Search (Elastic + FAISS + RRF)	Lexical + Semantic 검색	Week 4
③	Adaptive RAG	비용·정확도 균형	Week 5
④	RAGAS Evaluation	품질 표준화	Phase 4
⑤	Reinforced-IR Loop	Retriever↔Generator 동적 학습	Phase 4.2
⑥	Quantized LLM + Soft Prompt	효율·비용 최적화	Phase 5


⸻

3️⃣ Vision-Guided Chunking (VGC)
	•	Gemini 2.5 Pro / Qwen2-VL VLM으로 문서 이미지 분석
	•	표/제목/문단 좌표 보존 + Markdown 구조 생성

{
 "section": "제3조 아이돌봄 서비스 요금",
 "type": "table",
 "text": "기본형 11,630원 / 종합형 15,110원",
 "coords": [x, y, w, h],
 "page": 47
}

예상 향상
Section Alignment 0→85%, Table Detection 0→95%, Gate C 품질 대폭 개선

⸻

4️⃣ Hybrid Search (Elastic + FAISS + RRF)
	•	Tier1: Elasticsearch (BM25F + Boost) → 정확한 법률/용어 검색
	•	Tier2: FAISS HNSW Dense Retrieval → 빠른 의미 검색
	•	Tier3: bge-reranker-v2-m3 Re-ranking → 최종 순위 정렬
	•	병합: Reciprocal Rank Fusion (RRF)

효과
Elastic 정밀도 + FAISS 속도 + Reranker 정합성 ⇒ Recall@10 +20 pp

⸻

5️⃣ Adaptive RAG (비용 최적화 엔진)
	•	adaptiveRAG(k=2→6): “답변 불가” 시 k 확장
	•	Gate F(Throughput)와 연동 → Token Cost 실시간 추적
	•	Token 사용 –60 %, 정확도 유지

⸻

6️⃣ RAGAS + Gate 평가 통합

지표	의미	연동 Gate
Context Recall	필요한 문맥이 모두 검색되었는가	B
Context Precision	검색된 문맥 중 유효한 비율	D
Answer Faithfulness	답변이 근거에 충실한가	G
Answer Relevance	질문 의도와 일치하는가	E

→ /reports/ragas/phase3.json 자동 기록

⸻

7️⃣ 효율 보강 (Legacy Best Practices)

기술	효과	비고
FAISS (HNSW)	Dense Retrieval 가속	Elastic 보조
BM25F Boosting	Lexical 정확도 +20 %	비용 無
SentencePiece	임베딩 속도 +2–3×	다국어 안정


⸻

8️⃣ 리스크 및 대응
	•	VLM 비용: Batch 제한·샘플링 전략
	•	Chunk 폭증: FAISS 압축 + BM25F 필터링
	•	다국어 문서: Multilingual-E5 Embedding
	•	Fallback: Gemini ↔ Qwen2 자동 전환
	•	감사 부하: RAGAS 평가를 비동기 Cron으로 분리

⸻

9️⃣ Phase 4 확장 기술

🔁 Reinforced-IR Loop
	•	RLRF: Generator가 Retriever 피드백으로 쿼리 재작성
	•	RLGF: Retriever가 Generator의 ranking 선호도로 학습
→ Domain QA 정확도 +30 pp

⚙️ Domain Adaptation
	•	법률·의료·구매 등 각 도메인별 self-boosting
	•	Agent-level Reward Shaping

🔐 Quantized LLM (Phase 5)

포맷	효과	사용처
W4A16-INT	Latency 2–7× 개선	실시간
W8A8-FP	Throughput 극대화	배치
Soft Prompt	Accuracy 복원 +95 %	전 구간


⸻

10️⃣ Appendix A – Security & Compliance Addendum
	•	API Key Encryption, Access Control Layer
	•	Audit Log Retention 30일
	•	Gate R (Regulatory) 자동 실행
	•	GDPR/HIPAA/SOX 룰셋 포함

⸻

11️⃣ Appendix B – Evaluation Benchmark Plan
	•	RAGAS + IR Metrics (F1, NDCG, mAP)
	•	AutoRAG Suite → Retrieval / Generation / Agent별 점수 분리
	•	LLM-as-a-Judge는 최종 QA 평가용으로만 사용

⸻

12️⃣ Appendix C – Resource Budget Profile

환경	GPU	Throughput	비용
Dev	CPU-only	80 q/s	$0.01/q
Stage	T4 (INT8)	500 q/s	$0.004/q
Prod	A100 (FP16)	2,000 q/s	$0.002/q

→ /configs/resource-profiles.json 로 관리

⸻

⚙️ 실행 루틴 (클코 자동 감지)

# 1. Vision-Guided Chunking 테스트
npx tsx scripts/pdf-vision-pipeline.ts --in datasets/sample.pdf

# 2. Hybrid Search 벤치마크
npx tsx scripts/hybrid-retrieval-benchmark.ts --out reports/hybrid-retrieval.json

# 3. Adaptive RAG 평가
npx tsx scripts/evaluate-ragas.ts --phase 3

# 4. Reinforced-IR Loop 학습
npx tsx scripts/train-reinforced-ir.ts

# 5. Quantized LLM 배포
npx tsx scripts/deploy-quantized-llm.ts --profile prod


⸻

🔑 적용 방법

이 문서를
designs/rfc/rfc-integrate-multimodal-rag-augmentation-v2.1.md
이름으로 저장하면 클코는 아래 루틴을 자동 실행한다.

1️⃣ Vision + Hybrid 모듈 생성
2️⃣ Adaptive RAG + RAGAS 평가 통합
3️⃣ Reinforced-IR Loop 및 LLM Quantization 모듈 연결

⸻

💡 한줄 요약

Vision-Guided Chunking + Hybrid Search + Adaptive RAG → Reinforced-IR + Quantized LLM
산업 최고 수준의 품질·비용·속도 균형형 QA 엔진 완성.


