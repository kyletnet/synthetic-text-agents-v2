const { callLLM } = require("../services/llmService");
type Req = { documentText: string; domain?: string; personas?: string[] };
type Res = any;

const INDUSTRY_HINTS: Record<string, string> = {
  software_maintenance:
    "SLA, 장애, 패치, 보안, 라이선스, 데이터백업, 통지의무, 위약금, 책임제한",
  construction_safety:
    "산안법, 불시점검, 출입통제, 중대재해, 원청/하청 책임, 사고보고, 로그보존",
};

function sys(_domain?: string) {
  return [
    "당신은 문서 근거 기반 상황형 QA를 생성하는 전문가입니다.",
    "반드시 JSON 하나로만 출력하십시오. SCHEMA.json을 만족해야 합니다.",
    "근거 불충분시 insufficient-evidence 라고 명시하고 추측을 금지합니다.",
  ].join("\n");
}
function user(doc: string, domain?: string, personas?: string[]) {
  const hints = INDUSTRY_HINTS[(domain || "").toLowerCase()] || "";
  return [
    "다음 문서를 분석하여 두 섹션을 생성하십시오.",
    "섹션 A: clause_map[] 추출 → 각 항목 {clause_id,human_label,key_text,conditions[],exceptions[],owner,severity}.",
    "섹션 B: records[] 생성(실무상황형 QA) → 각 항목 {question,answer,clause_ids[],evidence_excerpt,severity,reasoning_brief,novelty_score,persona}.",
    "생성 규칙:",
    "- 질문은 '상황/조건/절차/책임/위험' 키워드 중 2개 이상을 포함.",
    "- answer에는 문서 근거 인용(evidence_excerpt) 1~2문장(직접 발췌).",
    "- novelty_score: 0.0~1.0 (표면적 재진술=0.2, 창발 시나리오=0.8).",
    "- 충돌/모순 발견 시 reasoning_brief에 'conflict:'로 시작해 요약.",
    "- 페르소나별 차별화(persona; 예: 운영팀, 법무, 영업).",
    "- 불명확하면 insufficient-evidence.",
    `도메인 힌트: ${hints}`,
    personas?.length ? `페르소나 후보: ${personas.join(", ")}` : "",
    '출력은 반드시 하나의 JSON: {"clause_map":[], "records":[], "_meta":{}}',
    "문서:",
    doc.slice(0, 12000),
  ].join("\n");
}

export async function consultDomainLLM(req: Req): Promise<Res> {
  const { text, usage, model, provider, latencyMs, cost } = await callLLM({
    system: sys(req.domain),
    user: user(req.documentText, req.domain, req.personas),
    json: true,
  });
  let data: any;
  try {
    data = JSON.parse(text);
  } catch (e) {
    data = { clause_map: [], records: [], raw: text, parse_error: String(e) };
  }
  data._meta = {
    provider,
    model,
    latency_ms: latencyMs,
    usage,
    cost_usd: cost?.cost ?? 0,
  };
  return data;
}
