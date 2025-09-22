/**
 * Minimal JSONL logger to RUN_LOGS/YYYYMMDD.jsonl
 * Usage:
 *   node tools/run_logger.js '{"run_id":"r1","routing_path":"rag","quality_score":8.7,"p95_ms":2400,"cost":0.0012,"cost_cap_hit":0,"citation_presence":1,"snippet_alignment":0.93,"failure_class":"-"}'
 */
const fs = require('fs'); const path = require('path');
const day = new Date().toISOString().slice(0,10).replace(/-/g,'');
const dir = path.join(process.cwd(),'RUN_LOGS'); if (!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true});
const file = path.join(dir, `${day}.jsonl`);
try {
  const payload = JSON.parse(process.argv[2] || '{}');
  payload.timestamp = new Date().toISOString();
  fs.appendFileSync(file, JSON.stringify(payload) + '\n', 'utf8');
  console.log(`[log] appended -> ${file}`);
} catch (e) {
  console.error('[error] invalid JSON payload', e.message);
  process.exit(1);
}
