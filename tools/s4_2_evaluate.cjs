/* LLM 패널 채점기 (CommonJS, Node>=18)
 * 입력 JSONL: 각 라인 { q:string, a:string, doc?:string, meta?:any } 형태 가정(유연 파싱)
 * 출력: 분석 JSON + 요약/케이스북 생성용 중간 데이터
 */
const fs = require("fs");
const path = require("path");

const CONFIG = JSON.parse(process.env.CONFIG_JSON || "{}");
const {
  inFile,
  outJson,
  runLog,
  model,
  panelSize,
  passThreshold,
  mode,
  sampleN,
  seed,
  maxRetries,
  reqTimeoutMs,
} = CONFIG;

const keys = (process.env.ANTHROPIC_API_KEYS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
if (
  !keys.length &&
  process.env.KEY_FILE &&
  fs.existsSync(process.env.KEY_FILE)
) {
  const fileKeys = fs
    .readFileSync(process.env.KEY_FILE, "utf8")
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("#"));
  keys.push(...fileKeys);
}
if (!keys.length && process.env.ANTHROPIC_API_KEY) {
  keys.push(process.env.ANTHROPIC_API_KEY.trim());
}

let keyIdx = 0;
function nextKey() {
  if (!keys.length) return "";
  const k = keys[keyIdx % keys.length];
  keyIdx++;
  return k;
}

function readJSONL(file) {
  const lines = fs.readFileSync(file, "utf8").split("\n").filter(Boolean);
  return lines.map((ln, i) => {
    try {
      return JSON.parse(ln);
    } catch {
      // 허술한 포맷도 유연 대응: "Q: .. A: .." 패턴
      const mQ = ln.match(/Q:\s*(.+?)\s*A:\s*/i);
      const mA = ln.match(/A:\s*(.+)$/i);
      return { q: mQ ? mQ[1].trim() : ln, a: mA ? mA[1].trim() : "" };
    }
  });
}

function sample(arr, n, seed = 42) {
  if (n >= arr.length) return arr.slice();
  let rng = mulberry32(seed);
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; --i) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}
function mulberry32(a) {
  return function () {
    var t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function persona(i) {
  const presets = [
    {
      role: "교육 평가전문가",
      focus: "정확한 개념 이해, 학습 목표 적합성, 학년 적정 난이도",
    },
    {
      role: "데이터 검수 리드",
      focus: "형식 준수(Q/A), 근거 일관성, 중복/누락",
    },
    {
      role: "LLM 프로덕트 오너",
      focus: "사용자 가치, 답변 간결성, 리스크(환각/근거 미스)",
    },
  ];
  return presets[i % presets.length];
}

function buildPrompt(q, a, doc, idx, pid) {
  const p = persona(pid);
  // 출력은 반드시 JSON {score:0~1, comment:"..."} 형식
  const system = `당신은 ${p.role}입니다. 평가 포커스: ${p.focus}.
평가 기준:
- 정확성(근거 기반 여부/환각 여부), 형식 준수(Q/A), 난이도/분량 적정성, 중복/일관성.
- 0.0(매우나쁨) ~ 1.0(매우좋음) 점수. comment는 1~2문장 간결하게.
반드시 JSON으로만 답하세요. 키: score(0~1), comment(문장).`;
  const user = `아래 Q/A를 평가하세요.
[질문]
${q}

[답변]
${a}

${
  doc
    ? `[관련 문서(있으면 근거로만 참고)]
${doc}`
    : ""
}

출력 예시:
{"score":0.86,"comment":"질문 의도에 부합하고 형식도 적절함."}`;

  return { system, user };
}

async function anthropicCall(key, model, system, user, reqTimeoutMs) {
  // Check for offline/dry-run mode - return mock response
  if (process.env.OFFLINE_MODE === "true" || process.env.DRY_RUN === "true") {
    // Generate a realistic mock response for scoring
    const mockScore = 0.75 + Math.random() * 0.2; // 0.75-0.95
    const mockResponse = `{"score":${mockScore.toFixed(2)},"comment":"(모크) 질문이 명확하고 답변이 적절함. 오프라인 모드 시뮬레이션."}`;

    // Add small delay to simulate network latency
    await new Promise((resolve) =>
      setTimeout(resolve, 100 + Math.random() * 200),
    );
    return mockResponse;
  }

  const url = "https://api.anthropic.com/v1/messages";
  const body = {
    model,
    max_tokens: 256,
    system,
    messages: [{ role: "user", content: user }],
    temperature: 0,
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), reqTimeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
    }
    const data = await res.json();
    const txt = (data?.content?.[0]?.text || "").trim();
    return txt;
  } finally {
    clearTimeout(timer);
  }
}

function safeParseScore(s) {
  // JSON 파싱이 실패하면 숫자/코멘트 추출 시도
  try {
    const j = JSON.parse(s);
    let sc = Number(j.score);
    if (!Number.isFinite(sc)) sc = 0;
    sc = Math.max(0, Math.min(1, sc));
    return {
      score: sc,
      comment: (j.comment || "").toString().trim().slice(0, 400),
    };
  } catch {
    const m = s.match(/([01](?:\.\d+)?)/);
    const sc = m ? Math.max(0, Math.min(1, Number(m[1]))) : 0;
    return { score: sc, comment: s.trim().slice(0, 400) };
  }
}

async function scoreOne(item, idx) {
  const q = item.q || item.question || item.prompt || "";
  const a = item.a || item.answer || "";
  const doc = item.doc || item.context || "";
  const panel = [];
  for (let p = 0; p < panelSize; p++) {
    let attempt = 0,
      lastErr = null;
    while (attempt <= maxRetries) {
      try {
        const { system, user } = buildPrompt(q, a, doc, idx, p);
        const key = nextKey();
        if (!key) {
          // 키 없음 → LLM 미사용: 규칙 기반 간이 스코어(형식/길이/기본 체크)
          const len = (a || "").split(/\s+/).filter(Boolean).length;
          const basic = q && a && len >= 7 && len <= 60 ? 0.7 : 0.4; // 러프
          panel.push({ score: basic, comment: "(키없음) 규칙 기반 임시 채점" });
          break;
        }
        const txt = await anthropicCall(key, model, system, user, reqTimeoutMs);
        const parsed = safeParseScore(txt);
        panel.push(parsed);
        break;
      } catch (e) {
        lastErr = e;
        attempt++;
        if (attempt > maxRetries) {
          panel.push({
            score: 0.0,
            comment: `API 실패: ${String(e).slice(0, 150)}`,
          });
          break;
        }
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }
  const scores = panel.map((x) => x.score);
  const median = scores.slice().sort((a, b) => a - b)[
    Math.floor(scores.length / 2)
  ];
  return {
    q,
    a,
    doc,
    panel,
    agg: { median, pass: median >= passThreshold },
  };
}

(async function main() {
  const all = readJSONL(inFile);
  const take = mode === "SMOKE" ? sample(all, sampleN, seed) : all;
  const results = [];
  let pass = 0;
  for (let i = 0; i < take.length; i++) {
    const r = await scoreOne(take[i], i);
    if (r.agg.pass) pass++;
    results.push(r);
  }
  const scores = results.map((r) => r.agg.median);
  const mean = scores.reduce((s, v) => s + v, 0) / (scores.length || 1);
  const passRate = scores.length ? pass / scores.length : 0;
  const bins = Array.from({ length: 10 }, () => 0);
  for (const s of scores) {
    let bi = Math.min(9, Math.max(0, Math.floor(s * 10)));
    bins[bi]++;
  }

  const out = {
    meta: {
      inFile,
      total: all.length,
      used: results.length,
      panelSize,
      model,
      mode,
      sampleN,
      passThreshold,
    },
    diversity: {}, // 4.1b에서 계산된 지표는 보고서에서 링크로 안내
    score: { mean, passRate, bins, scores },
    results,
  };
  fs.writeFileSync(outJson, JSON.stringify(out, null, 2));
  fs.writeFileSync(
    runLog,
    JSON.stringify(
      {
        ts: Date.now(),
        id: process.env.RUN_ID,
        config: CONFIG,
        usedKeys: keys.length,
      },
      null,
      2,
    ),
  );
  process.stdout.write(`[ok] wrote ${outJson}\n`);
})();
