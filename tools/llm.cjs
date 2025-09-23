const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const { maskPII } = require("./privacy.cjs");

const PROVIDER = process.env.LLM_PROVIDER || "anthropic";
const TIMEOUT = Number(process.env.LLM_TIMEOUT_MS || 30000);
const RETRIES = Number(process.env.LLM_RETRIES || 2);
const MAX_CONC = Number(process.env.LLM_MAX_CONCURRENCY || 1);
const PRICE_IN = Number(process.env.LLM_PRICE_PERK_IN || 0);
const PRICE_OUT = Number(process.env.LLM_PRICE_PERK_OUT || 0);

let inflight = 0;
const queue = [];
async function throttle() {
  if (inflight < MAX_CONC) {
    inflight++;
    return;
  }
  await new Promise((r) => queue.push(r));
  inflight++;
}
function release() {
  inflight--;
  const n = queue.shift();
  if (n) n();
}

function withTimeout(p, ms) {
  return Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error("TIMEOUT")), ms)),
  ]);
}

function tokenGuard(s, max = 8000) {
  if (!s) return s;
  const words = s.split(/\s+/);
  if (words.length > max) {
    return words.slice(0, max).join(" ") + " ...[TRUNC]";
  }
  return s;
}

// Use unified anthropic client instead of direct API calls
const { spawn } = require("child_process");
const path = require("path");

async function callLLM({ prompt, system }) {
  await throttle();
  const t0 = Date.now();
  try {
    if (PROVIDER !== "anthropic") {
      throw new Error("Only Anthropic provider supported via unified client");
    }

    // Prepare payload for unified client
    const payload = {
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 2048,
      temperature: 0.2,
      messages: [{ role: "user", content: tokenGuard(prompt) }],
    };
    if (system) payload.system = tokenGuard(system);

    // Call unified client
    const result = await callUnifiedClient(JSON.stringify(payload));

    if (!result.success) {
      throw new Error(`API_ERROR: ${result.error}`);
    }

    const json = result.data;
    const text = json?.content?.[0]?.text || "";
    const ms = Date.now() - t0;
    const meta = { provider: PROVIDER, ms, ts: new Date().toISOString() };

    // Use actual token counts if available
    const inTok =
      json?.usage?.input_tokens ||
      Math.round((prompt.length + (system || "").length) / 4);
    const outTok = json?.usage?.output_tokens || Math.round(text.length / 4);
    const cost = (inTok / 1000) * PRICE_IN + (outTok / 1000) * PRICE_OUT;

    return { text, meta: { ...meta, inTok, outTok, cost } };
  } finally {
    release();
  }
}

// Call the unified anthropic client wrapper
async function callUnifiedClient(payload) {
  return new Promise((resolve) => {
    const clientPath = path.join(__dirname, "anthropic_client.sh");
    const child = spawn("bash", [clientPath, "--chat"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, LLM_TIMEOUT_MS: TIMEOUT.toString() },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (exitCode) => {
      if (exitCode === 0) {
        try {
          const data = JSON.parse(stdout);
          resolve({ success: true, data });
        } catch (e) {
          resolve({ success: false, error: `Parse error: ${e.message}` });
        }
      } else {
        resolve({ success: false, error: stderr || "Unknown error" });
      }
    });

    // Send payload via stdin
    child.stdin.write(payload);
    child.stdin.end();
  });
}

function saveRunLog(entry) {
  const fsPath = "RUN_LOGS";
  if (!fs.existsSync(fsPath)) fs.mkdirSync(fsPath, { recursive: true });
  const day = new Date().toISOString().slice(0, 10);
  const p = path.join(fsPath, `run_${day}.json`);
  let arr = [];
  if (fs.existsSync(p)) arr = JSON.parse(fs.readFileSync(p, "utf8"));
  const safe = { ...entry };
  if (safe.prompt) safe.prompt = maskPII(safe.prompt).slice(0, 500);
  if (safe.evidence_excerpt)
    safe.evidence_excerpt = maskPII(safe.evidence_excerpt).slice(0, 300);
  arr.push(safe);
  fs.writeFileSync(p, JSON.stringify(arr, null, 2));
  return p;
}

module.exports = { callLLM, saveRunLog };
