/**
 * Offline mini-evaluator for Recall@5 and Citation-Precision proxy.
 * Reads cases.json and results_sample.json (placeholder until wired to actual RAG CLI output).
 */
const fs = require("fs"),
  path = require("path");
const root = process.cwd();
const cases = JSON.parse(
  fs.readFileSync(path.join(root, "dev/runs/cases.json"), "utf8"),
);
const resultsPath = path.join(root, "dev/runs/results_sample.json");
if (!fs.existsSync(resultsPath)) {
  console.error(
    "[hint] Create dev/runs/results_sample.json from your RAG output to evaluate.",
  );
  process.exit(1);
}
const res = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
const byId = Object.fromEntries(res.map((r) => [r.id, r]));
let hit = 0,
  total = cases.length,
  lat = [],
  cost = [],
  cpHit = 0;
for (const c of cases) {
  const r = byId[c.id];
  if (!r) {
    console.log(`[miss] ${c.id} no-result`);
    continue;
  }
  const top5 = (r.top5_snippets || []).map((s) => String(s).toLowerCase());
  const exp = String(c.expected_snippet_or_page || "").toLowerCase();
  const found = top5.some((s) => s.includes(exp));
  if (found) hit++;
  lat.push(r.latency_ms || 0);
  cost.push(r.cost || 0);
  // Citation-Precision proxy: count if any of top5 exactly contains expected cue
  if (found) cpHit++;
}
const recall5 = total ? hit / total : 0;
const cp = total ? cpHit / total : 0;
const p95 = (arr) => {
  if (arr.length === 0) return 0;
  const a = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil(0.95 * a.length) - 1;
  return a[idx];
};
const sum = (a) => a.reduce((x, y) => x + y, 0);
console.log(
  JSON.stringify(
    {
      recall_at_5: Number(recall5.toFixed(4)),
      citation_precision_proxy: Number(cp.toFixed(4)),
      p95_ms: p95(lat),
      avg_cost: Number((sum(cost) / Math.max(1, cost.length)).toFixed(6)),
    },
    null,
    2,
  ),
);
