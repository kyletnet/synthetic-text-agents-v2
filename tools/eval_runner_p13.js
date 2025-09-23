import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { enrichWithCitations } from "./citation_enrich.js";
import { guardianCitation } from "./guardian_citation.js";
import { recallAtK, citationPrecisionProxy, timeIt } from "./eval_metrics.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function safeRead(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

function ensureRunLogsDir() {
  const dir = path.join(process.cwd(), "RUN_LOGS");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function todaysLogPath() {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return path.join(ensureRunLogsDir(), `${day}.jsonl`);
}

/** Do one synthetic end-to-end run and append metrics to RUN_LOGS */
export async function runOnce() {
  const root = process.cwd();
  const gold = JSON.parse(
    safeRead(path.join(root, "dev/runs/gold/p13_gold.json")) ||
      '{"gold_doc_ids":["docA"],"thresholds":{"citation_precision":0.30}}',
  );
  const aPath = path.join(root, "dev/runs/sample_docs/docA.md");
  const bPath = path.join(root, "dev/runs/sample_docs/docB.md");

  const aTxt = safeRead(aPath) || "short sample document";
  const bTxt = safeRead(bPath) || "retrieval minimal example";
  const aId = fs.existsSync(aPath) ? "docA" : "inlineA";
  const bId = fs.existsSync(bPath) ? "docB" : "inlineB";

  const retrievedTopK = [
    { doc_id: aId, span: "p.1", snippet: aTxt.slice(0, 180), score: 0.92 },
    { doc_id: bId, span: "p.1", snippet: bTxt.slice(0, 180), score: 0.85 },
  ];
  const answer =
    "According to the uploaded short sample document, it mentions retrieval in a minimal way.";
  const run_id = `p13-${Date.now()}`;

  // measure enrich + guardian latency
  const { ms: latency_ms, value: enriched } = await timeIt(async () => {
    const e = enrichWithCitations(answer, retrievedTopK);
    // guardian logs citation_presence & snippet_alignment internally
    guardianCitation({
      run_id,
      answer: e.answer,
      citations: e.citations,
      log: true,
    });
    return e;
  });

  // compute recall@5 over doc ids
  const recall = recallAtK(
    gold.gold_doc_ids || ["docA"],
    retrievedTopK.map((r) => r.doc_id),
    5,
  );

  // compute citation precision proxy w.r.t. the final answer
  const cpp = citationPrecisionProxy(
    answer,
    enriched.citations,
    Number(gold?.thresholds?.citation_precision ?? 0.3),
  );

  // append unified log line
  const logLine = {
    run_id,
    routing_path: "rag",
    quality_score: null,
    latency_ms: Number(latency_ms.toFixed(3)),
    recall_at_5: recall.recall_at_k,
    recall_hit_at_5: recall.hit_at_k,
    citation_precision_proxy: cpp.precision_proxy,
    cost: null,
    cost_cap_hit: 0,
    failure_class: "-",
    timestamp: new Date().toISOString(),
  };
  fs.appendFileSync(todaysLogPath(), JSON.stringify(logLine) + "\n", "utf8");

  // print summary
  const out = {
    run_id,
    latency_ms: logLine.latency_ms,
    recall_at_5: recall.recall_at_k,
    recall_hit_at_5: recall.hit_at_k,
    citation_precision_proxy: cpp.precision_proxy,
  };
  console.log(JSON.stringify(out, null, 2));
  return out;
}

// If run directly: execute once
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runOnce().catch((e) => {
    console.error("[eval_runner_p13] error:", e);
    process.exit(1);
  });
}
