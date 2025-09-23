import fs from "fs";
import path from "path";
import { alignmentScore } from "./similarity.js";

export function guardianCitation(payload) {
  const answer = String(payload.answer || "");
  const cites = Array.isArray(payload.citations) ? payload.citations : [];
  const presence = cites.length > 0 ? 1 : 0;
  let best = 0;
  for (const c of cites) {
    const s = alignmentScore(answer, c?.snippet || "");
    if (s > best) best = s;
  }
  const result = {
    citation_presence: presence,
    snippet_alignment: Number(best.toFixed(4)),
  };

  if (payload.log !== false) {
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const dir = path.join(process.cwd(), "RUN_LOGS");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${day}.jsonl`);
    const line = {
      run_id: payload.run_id || `p1-2-${Date.now()}`,
      routing_path: "-",
      quality_score: null,
      p95_ms: null,
      cost: null,
      cost_cap_hit: 0,
      citation_presence: result.citation_presence,
      snippet_alignment: result.snippet_alignment,
      failure_class: "-",
      timestamp: new Date().toISOString(),
    };
    fs.appendFileSync(file, JSON.stringify(line) + "\n", "utf8");
    console.log(`[guardian] appended -> ${file}`);
  }
  return result;
}
