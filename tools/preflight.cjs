require("dotenv").config({ path: [".env.local", ".env"] });
const { execSync } = require("child_process");
const fs = require("fs");

function ok(cmd) {
  try {
    execSync(cmd, { stdio: "pipe" });
    return true;
  } catch (_) {
    return false;
  }
}
const out = [];

// 1. API key / Provider
const provider = process.env.LLM_PROVIDER || "anthropic";
const hasKey = !!process.env.ANTHROPIC_API_KEY;
out.push({
  status: hasKey ? "PASS" : "FAIL",
  why: hasKey ? "" : "missing ANTHROPIC_API_KEY",
  provider,
});

// 2. Network egress
const egress = ok("node tools/check-egress.cjs");
out.push({
  status: egress ? "PASS" : "FAIL",
  why: egress ? "" : "egress blocked",
});

// 3. Node runtime
let runtime = "unknown";
try {
  runtime = execSync("node -v").toString().trim();
} catch (_) {}
out.push({
  status: /^v1[89]|^v2/.test(runtime) ? "PASS" : "FAIL",
  why: runtime,
});

// 4. Timeout / Retry
const t = Number(process.env.LLM_TIMEOUT_MS || 0),
  r = Number(process.env.LLM_RETRIES || 0);
out.push({
  status: t >= 10000 && r >= 1 ? "PASS" : "PARTIAL",
  why: `timeout=${t}, retries=${r}`,
});

// 5. Input length / Token guard
const guard = Number(process.env.LLM_TOKEN_GUARD_DOC || 0);
out.push({ status: guard > 0 ? "PASS" : "PARTIAL", why: `guard=${guard}` });

// 6. Feature flags
const ff = String(process.env.FEATURE_LLM_DOMAIN_CONSULTANT || "");
out.push({
  status: ff === "true" ? "PASS" : "PARTIAL",
  why: `FEATURE_LLM_DOMAIN_CONSULTANT=${ff}`,
});

// 7. Logs / Cost monitoring (RUN_LOGS exist?)
const logsDir = fs.existsSync("RUN_LOGS");
out.push({
  status: logsDir ? "PASS" : "PARTIAL",
  why: logsDir ? "" : "no RUN_LOGS dir",
});

// 8. Output schema validation (validator present?)
const hasValidator =
  fs.existsSync("tools/validate-schema.cjs") &&
  fs.existsSync("ops/context/SCHEMA.json");
out.push({
  status: hasValidator ? "PASS" : "FAIL",
  why: hasValidator ? "" : "schema/validator missing",
});

// 9. Privacy / Compliance guard (privacy util present?)
const hasPrivacy = fs.existsSync("tools/privacy.cjs");
out.push({
  status: hasPrivacy ? "PASS" : "PARTIAL",
  why: hasPrivacy ? "" : "privacy mask util missing",
});

// 10. Rate Limit / Concurrency
const conc = Number(process.env.LLM_MAX_CONCURRENCY || 0);
out.push({
  status: conc > 0 ? "PASS" : "PARTIAL",
  why: `LLM_MAX_CONCURRENCY=${conc}`,
});

console.log("\n=== Preflight Audit (10) ===");
const items = [
  "API key / Provider",
  "Network egress",
  "Node runtime",
  "Timeout / Retry",
  "Input length / Token guard",
  "Feature flags",
  "Logs / Cost",
  "Output schema validation",
  "Privacy / Compliance",
  "Rate limit / Concurrency",
];
items.forEach((name, i) => {
  const r = out[i];
  const mark =
    r.status === "PASS" ? "✅" : r.status === "PARTIAL" ? "🟡" : "❌";
  console.log(`${mark} ${i + 1}. ${name} :: ${r.status} — ${r.why}`);
});
const pass = out.filter((x) => x.status === "PASS").length;
const partial = out.filter((x) => x.status === "PARTIAL").length;
const fail = out.filter((x) => x.status === "FAIL").length;
console.log(`\nSummary: ${pass}/10 PASS, ${partial} PARTIAL, ${fail} FAIL`);
if (fail > 0) process.exit(2);
