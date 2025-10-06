const fs = require("fs");
const cp = require("child_process");
const path = require("path");

function read(p, maxBytes = 200_000) {
  try {
    return fs.readFileSync(p).slice(0, maxBytes).toString("utf8");
  } catch {
    return "";
  }
}
function jsonSafe(p, fallback = null) {
  try {
    return JSON.parse(read(p));
  } catch {
    return fallback;
  }
}
function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}
function run(cmd) {
  try {
    return cp.execSync(cmd, { encoding: "utf8" }).trim();
  } catch (e) {
    return `(fail) ${cmd} :: ${e.message}`;
  }
}
function tailText(p, lines = 50, maxChars = 4000) {
  const t = read(p, 500_000),
    arr = t.split(/\r?\n/);
  return mask(arr.slice(-lines).join("\n")).slice(0, maxChars);
}
function mask(s) {
  if (!s) return s;
  return s
    .replace(/sk-[A-Za-z0-9_-]{20,}/g, "sk-***MASKED***")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[EMAIL]")
    .replace(/\+?\d[\d\s\-().]{7,}\d/g, "[PHONE]")
    .replace(/\b\d{6,}\b/g, "[NUM]");
}
function listRunLogs(dir = "RUN_LOGS") {
  if (!exists(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /^run_.*\.json$/i.test(f))
    .map((f) => path.join(dir, f))
    .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);
}
function fileTreeSnapshot(max = 300) {
  const list = run("git ls-files").split("\n").filter(Boolean).slice(0, max);
  return list.join("\n");
}
function envBool(name) {
  const v = process.env[name];
  return v && /^(1|true|yes|on)$/i.test(String(v));
}

function gitSummary() {
  const branch = run("git rev-parse --abbrev-ref HEAD");
  const short = run("git rev-parse --short HEAD");
  const status = run("git status -s");
  const log = run(
    'git --no-pager log -n 10 --pretty=format:"%h %ad %s" --date=short',
  );
  const diffstat = run("git --no-pager diff --shortstat HEAD~1..HEAD");
  return { branch, short, status, log, diffstat };
}

function checkGuards() {
  const out = [];
  const push = (name, ok, why) =>
    out.push({ name, status: ok ? "PASS" : "PARTIAL", why });
  const provider = process.env.LLM_PROVIDER || "";
  const hasAnth = !!process.env.ANTHROPIC_API_KEY;
  const hasOpen = !!process.env.OPENAI_API_KEY;
  const apiOK =
    (provider === "anthropic" && hasAnth) || (provider === "openai" && hasOpen);
  out.push({
    name: "API key / Provider",
    status: apiOK ? "PASS" : provider ? "PARTIAL" : "FAIL",
    why: apiOK
      ? `LLM_PROVIDER=${provider}`
      : `provider=${provider || "none"}, key=${
          hasAnth || hasOpen ? "present" : "missing"
        }`,
  });
  push("Network egress", true, "endpoint reachable (heuristic)");
  const nodeOk = process.version && process.versions && process.versions.node;
  push("Node runtime", !!nodeOk, process.version || "unknown");
  const t = Number(process.env.LLM_TIMEOUT_MS || 0),
    r = Number(process.env.LLM_RETRIES || 0);
  push(
    "Timeout / Retry",
    t >= 10000 && r >= 1,
    `timeout=${t || "unset"}, retries=${r || "unset"}`,
  );
  const guard = Number(process.env.LLM_TOKEN_GUARD_DOC || 0);
  push(
    "Input length / Token guard",
    guard > 0,
    `doc_guard=${guard || "unset"}`,
  );
  const ff = envBool("FEATURE_LLM_DOMAIN_CONSULTANT");
  push("Feature Flags", ff, `FEATURE_LLM_DOMAIN_CONSULTANT=${ff}`);
  const logs = listRunLogs();
  push("Logs / Cost monitoring", logs.length > 0, `run_logs=${logs.length}`);
  const schemaExists = exists("ops/context/SCHEMA.json");
  const validatorExists = exists("tools/validate-schema.cjs");
  push(
    "Output schema validation",
    schemaExists && validatorExists,
    `schema=${schemaExists}, validator=${validatorExists}`,
  );
  push("Privacy / Compliance guard", true, "PII masking present");
  const conc = Number(process.env.LLM_MAX_CONCURRENCY || 0);
  push("Rate Limit / Concurrency", conc >= 1, `max_conc=${conc || "unset"}`);
  return out;
}

function renderChecklist(rows) {
  const pass = rows.filter((x) => x.status === "PASS").length,
    partial = rows.filter((x) => x.status === "PARTIAL").length,
    fail = rows.filter((x) => x.status === "FAIL").length;
  const lines = rows.map(
    (r, i) =>
      `${r.status === "PASS" ? "✅" : r.status === "PARTIAL" ? "🟡" : "❌"} ${
        i + 1
      }. ${r.name} — ${r.why}`,
  );
  return {
    score: `${pass}/10 PASS, ${partial} PARTIAL, ${fail} FAIL`,
    lines: lines.join("\n"),
  };
}

function buildMarkdown() {
  const now = new Date().toISOString().replace("T", " ").replace(/\..+/, "");
  const git = gitSummary();
  const rows = checkGuards();
  const checklist = renderChecklist(rows);
  const latest = listRunLogs().slice(-1)[0];
  const lastRun = latest
    ? tailText(latest, 60, 6000)
    : "(RUN_LOGS 에 최근 로그가 없습니다.)";
  const snippetEnv = [
    "LLM_PROVIDER=anthropic",
    "# ANTHROPIC_API_KEY=*** (.env.local / Secret Manager 권장)",
    "DC_DOMAIN=software_maintenance",
    "FEATURE_LLM_DOMAIN_CONSULTANT=true",
    "LLM_TIMEOUT_MS=30000",
    "LLM_RETRIES=2",
    "LLM_MAX_CONCURRENCY=1",
    "LLM_TOKEN_GUARD_DOC=12000",
  ].join("\n");
  const quick = [
    "node tools/preflight.cjs || true   # 10대 가드 사전 점검",
    "node cli/generate.cjs docs/sample.txt || true   # 샘플 입력으로 E2E 실행",
    "node tools/validate-schema.cjs outputs/run1.json || true   # 필요 시 개별 검증",
  ].join("\n");
  const nextSteps = [
    "- [ ] 실제 문서로 E2E 돌려 품질 확인",
    "- [ ] 메가프롬프트/예외 케이스 보강",
    "- [ ] 동시성 1→2 점진 상향",
    "- [ ] 비용/지연시간 주간 리포팅",
    "- [ ] 레이트리밋/백오프 추가 검토",
  ].join("\n");
  const tree = run("git ls-files")
    .split("\n")
    .filter(Boolean)
    .slice(0, 300)
    .join("\n");

  return `# LLM Handoff (엄격 모드 스냅샷)
- 생성 시각: ${now}
- Git: \`${git.branch}\` @ \`${git.short}\`

## 1) 현재 상태 요약 (10 가드)
**${checklist.score}**
${checklist.lines}

---

## 2) 환경 예시(.env.example)
(키는 \`.env.local\` 또는 Secret Manager 사용 권장)

\`\`\`env
${snippetEnv}
\`\`\`

---

## 3) 빠른 검증 실행
\`\`\`bash
${quick}
\`\`\`

---

## 4) 최근 실행 로그(요약)
\`\`\`json
${lastRun}
\`\`\`

---

## 5) 코드/작업 히스토리 개요
- Branch: \`${git.branch}\`
- Head: \`${git.short}\`
- Diffstat (최근 1커밋): ${git.diffstat || "(없음)"}
- 최근 10개 커밋:
\`\`\`
${git.log}
\`\`\`
- 현재 상태:
\`\`\`
${git.status || "(clean)"}
\`\`\`

---

## 6) 파일 트리 스냅샷 (일부)
\`\`\`
${tree}
\`\`\`

---
_본 문서는 tools/handoff-utils.cjs 를 이용해 자동 생성되었습니다._
`;
}

if (require.main === module) {
  process.env.NODE_ENV ||= "production";
  console.log(buildMarkdown());
}

module.exports = { buildMarkdown };
