/**
 * 규칙기반 Baseline Q/A 생성 (LLM 호출 없음)
 * 입력: docs/seed.json {chunks:[{id,text}]}
 * 출력: outputs/min_<ts>.jsonl, RUN_LOGS/min_<ts>.jsonl, reports/min_<ts>.md
 */
const fs = require("fs"),
  path = require("path");

function nowTS() {
  return new Date()
    .toISOString()
    .replace(/[-:TZ]/g, "")
    .slice(0, 14);
}
function sentences(s) {
  return s
    .split(/(?<=[\.!\?]|다\.)\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
}
function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}
function uniq(arr) {
  return Array.from(new Set(arr));
}
function toks(s) {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}
function overlap(a, b) {
  const A = new Set(a),
    B = new Set(b);
  let hit = 0;
  A.forEach((t) => {
    if (B.has(t)) hit++;
  });
  return (A.size ? hit / A.size : 0 + B.size ? hit / B.size : 0) / 2 || 0;
}
function pickQuestion(txt) {
  const t = txt;
  if (/[물|수증기|얼음|상태|응결|증발]/.test(t))
    return "이 문단은 물의 상태 변화와 관련해 무엇을 설명하나요?";
  if (/원인|영향|요인|조건/.test(t))
    return "이 문단에서 핵심 원인과 조건은 무엇인가요?";
  return "이 문단의 핵심 주제는 무엇인가요?";
}
function makeAnswer(txt) {
  const ss = sentences(txt);
  const first = ss[0] || txt.slice(0, 120);
  // 요약 느낌으로 앞문장을 다듬어 짧게
  return first.length > 160 ? first.slice(0, 157) + "…" : first;
}
function lenScore(ans) {
  // 40~160자 권장
  const n = ans.length;
  if (n < 20) return 0.2;
  if (n > 220) return 0.3;
  const mid = clamp((n - 40) / (160 - 40), 0, 1);
  return 0.6 + 0.4 * mid;
}
function formatScore(q, a) {
  let s = 0;
  if (/\?$/.test(q)) s += 0.5;
  if (a && !/[?]$/.test(a)) s += 0.5;
  return s;
}
function coverScore(chunk, a) {
  const tkC = toks(chunk),
    tkA = toks(a);
  return overlap(tkC, tkA); // 0~1
}
function qualityScore(chunk, q, a) {
  const wC = 0.5,
    wF = 0.2,
    wL = 0.3;
  const C = coverScore(chunk, a);
  const F = formatScore(q, a);
  const L = lenScore(a);
  return clamp(wC * C + wF * F + wL * L, 0, 1);
}
function quantiles(arr, ps = [0.5, 0.95]) {
  if (!arr.length) return {};
  const xs = [...arr].sort((a, b) => a - b);
  const at = (p) => {
    const i = clamp(Math.floor(p * (xs.length - 1)), 0, xs.length - 1);
    return xs[i];
  };
  const out = {};
  ps.forEach((p) => (out["p" + Math.round(p * 100)] = at(p)));
  return out;
}

function main() {
  const inPath = "docs/seed.json";
  const { chunks } = JSON.parse(fs.readFileSync(inPath, "utf8"));
  const ts = nowTS();
  const outPath = `outputs/min_${ts}.jsonl`;
  const logPath = `RUN_LOGS/min_${ts}.jsonl`;
  const repPath = `reports/min_${ts}.md`;

  fs.mkdirSync("outputs", { recursive: true });
  fs.mkdirSync("RUN_LOGS", { recursive: true });
  fs.mkdirSync("reports", { recursive: true });

  const lines = [];
  for (const ch of chunks) {
    const q = pickQuestion(ch.text);
    const a = makeAnswer(ch.text);
    const s = qualityScore(ch.text, q, a);
    lines.push({
      q,
      a,
      meta: {
        chunk_id: ch.id,
        source: "rule-baseline",
        scores: {
          coverage: coverScore(ch.text, a),
          format: formatScore(q, a),
          length: lenScore(a),
        },
        score: s,
      },
    });
  }
  // JSONL 저장
  const enc = (o) => JSON.stringify(o, null, 0);
  fs.writeFileSync(outPath, lines.map(enc).join("\n") + "\n");

  // 로그 저장(간단 메타)
  const avg =
    lines.reduce((a, x) => a + x.meta.score, 0) / Math.max(1, lines.length);
  const scores = lines.map((x) => x.meta.score);
  const qtl = quantiles(scores, [0.5, 0.95, 0.99]);
  fs.writeFileSync(
    logPath,
    JSON.stringify({
      ts,
      n: lines.length,
      avg,
      ...qtl,
      input: inPath,
      output: outPath,
    }) + "\n",
  );

  // 리포트(MD) — 분포요약 + 샘플 5건 테이블
  const hi = lines.slice(0, 5);
  const bar = (v) =>
    "█".repeat(Math.round(clamp(v, 0, 1) * 20)).padEnd(20, "·");
  const dist = [
    { label: "avg", v: avg },
    ...Object.entries(qtl).map(([k, v]) => ({ label: k, v })),
  ];
  const md = [];
  md.push(`# Baseline Q/A Report (rule-based, LLM-free)`);
  md.push(`- **samples**: ${lines.length}`);
  md.push(
    `- **score avg**: ${avg.toFixed(3)}  |  **p50**: ${(qtl.p50 ?? 0).toFixed(3)}  |  **p95**: ${(qtl.p95 ?? 0).toFixed(3)}  |  **p99**: ${(qtl.p99 ?? 0).toFixed(3)}`,
  );
  md.push(``);
  md.push(`## Score Distribution`);
  dist.forEach(({ label, v }) => {
    md.push(`- ${label.padEnd(4)} ${bar(v)} ${v.toFixed(3)}`);
  });
  md.push(``);
  md.push(`## Sample Q/A (top-5 by order)`);
  md.push(`| # | Question | Answer | score | coverage | length | format |`);
  md.push(`|---|---|---|---:|---:|---:|---:|`);
  hi.forEach((x, i) => {
    const m = x.meta,
      s = m.scores;
    md.push(
      `| ${i + 1} | ${x.q} | ${x.a} | ${m.score.toFixed(2)} | ${s.coverage.toFixed(2)} | ${s.length.toFixed(2)} | ${s.format.toFixed(2)} |`,
    );
  });
  md.push(``);
  md.push(`## Notes (for non-engineers)`);
  md.push(
    `- 이 리포트는 **LLM 호출 없이** 규칙만으로 만든 베이스라인 Q/A 품질을 가늠합니다.`,
  );
  md.push(
    `- **score**는 덮어씀(답변-원문 겹침), 형식 적합성(물음표/문장), 길이 적정성(너무 짧거나 김) 등을 조합한 0~1 점수입니다.`,
  );
  md.push(
    `- 이 분포를 베이스라인-제로로 저장해두고, 이후 LLM/다양성 지표/근거체크 등을 붙였을 때 개선폭을 비교하세요.`,
  );
  fs.writeFileSync(repPath, md.join("\n"));

  console.log(`[ok] outputs: ${outPath}`);
  console.log(`[ok] logs   : ${logPath}`);
  console.log(`[ok] report : ${repPath}`);
}
main();
