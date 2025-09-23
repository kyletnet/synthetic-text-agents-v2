import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { percentile } from "./eval_metrics.js";
import { runOnce } from "./eval_runner_p13.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function todaysLogPath() {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const dir = path.join(process.cwd(), "RUN_LOGS");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${day}.jsonl`);
}

function readTodayLatencies() {
  const p = todaysLogPath();
  if (!fs.existsSync(p)) return [];
  const lines = fs.readFileSync(p, "utf8").split(/\n/).filter(Boolean);
  const vals = [];
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (typeof obj.latency_ms === "number") vals.push(obj.latency_ms);
    } catch {}
  }
  return vals;
}

async function main() {
  const N = Math.max(1, Number(process.env.N || process.argv[2] || 8));
  const latencies = [];
  for (let i = 0; i < N; i++) {
    const r = await runOnce();
    latencies.push(r.latency_ms);
  }
  const all = readTodayLatencies(); // include any previous runs from today
  const p50 = percentile(all, 0.5);
  const p95 = percentile(all, 0.95);
  console.log(
    JSON.stringify(
      {
        runs_in_session: N,
        session_p50_ms: Number(percentile(latencies, 0.5).toFixed(3)),
        session_p95_ms: Number(percentile(latencies, 0.95).toFixed(3)),
        today_total_samples: all.length,
        today_p50_ms: Number(p50.toFixed(3)),
        today_p95_ms: Number(p95.toFixed(3)),
      },
      null,
      2,
    ),
  );
}
main().catch((e) => {
  console.error("[eval_runner_multi_p13] error:", e);
  process.exit(1);
});
