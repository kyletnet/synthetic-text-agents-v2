const fs = require("fs");
const path = require("path");

const OUT_JSON = process.env.OUT_JSON;
const SUM_MD = process.env.SUM_MD;
const CASE_MD = process.env.CASE_MD;
const BASELINE_SUM = process.env.BASELINE_SUM || ""; // 4.1b summary 파일 경로(선택)

if (!OUT_JSON || !SUM_MD || !CASE_MD) {
  console.error("ENV OUT_JSON/SUM_MD/CASE_MD 필요");
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(OUT_JSON, "utf8"));
const { meta, score, results } = data;
const bins = score.bins || [];
const bar = bins
  .map(
    (n, i) =>
      `${(i / 10).toFixed(1)}–${((i + 1) / 10).toFixed(1)}│${"█".repeat(
        Math.min(40, n),
      )} ${n}`,
  )
  .join("\n");

const head = `# Baseline-LLM Panel Report
- Model: ${meta.model}  | Panel: ${meta.panelSize} | Mode: ${
  meta.mode
} | Used: ${meta.used}/${meta.total}
- Pass threshold: ${meta.passThreshold}
- Mean score: ${score.mean.toFixed(3)}
- Pass rate: ${(score.passRate * 100).toFixed(1)}%
- Distribution (bin=0.1)
\`\`\`
${bar}
\`\`\`
${BASELINE_SUM ? `- Baseline(4.1b) 요약 링크: ${BASELINE_SUM}` : ""}
`;

const worst = results
  .slice()
  .sort((a, b) => a.agg.median - b.agg.median)
  .slice(0, Math.min(10, results.length));
const best = results
  .slice()
  .sort((a, b) => b.agg.median - a.agg.median)
  .slice(0, Math.min(5, results.length));

const casebook = `# Casebook (Hard cases)
${worst
  .map(
    (r, idx) => `## ${idx + 1}. score=${r.agg.median.toFixed(2)} ${
      r.agg.pass ? "(PASS)" : "(FAIL)"
    }
**Q**: ${r.q}
**A**: ${r.a}
${r.doc ? `**Doc**: ${r.doc.slice(0, 400)}...` : ""}
**Panel**
${r.panel
  .map((p, i) => `- P${i + 1}: ${p.score.toFixed(2)} — ${p.comment}`)
  .join("\n")}
`,
  )
  .join("\n")}

# Good examples
${best
  .map(
    (r, idx) => `## Top ${idx + 1}. score=${r.agg.median.toFixed(2)}
**Q**: ${r.q}
**A**: ${r.a}
`,
  )
  .join("\n")}
`;

fs.writeFileSync(SUM_MD, head);
fs.writeFileSync(CASE_MD, casebook);
process.stdout.write(`[ok] wrote ${SUM_MD}, ${CASE_MD}\n`);
