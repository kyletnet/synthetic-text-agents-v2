const fs = require("fs");
const path = require("path");
const GLOBS = ["src", "cli", "tools", "apps", "dist", "ops", "prompts"]; // exclude node_modules
const findings = [];
function walk(dir) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    if (name.isDirectory()) {
      if (name.name === "node_modules" || name.name.startsWith(".")) continue;
      walk(path.join(dir, name.name));
    } else if (name.isFile()) {
      const fp = path.join(dir, name.name);
      if (!/\.(cjs|js|ts|md|txt|json)$/.test(fp)) continue;
      const s = fs.readFileSync(fp, "utf8");
      // Simple anti-patterns
      if (
        /fetch\(.+?\)\s*;?\s*$/.test(s) &&
        /timeout|AbortController/.test(s) === false
      ) {
        findings.push({
          file: fp,
          issue:
            "No timeout around fetch (consider AbortController/LLM_TIMEOUT_MS)",
        });
      }
      if (
        /Promise\.all\s*\(/.test(s) &&
        /LLM_MAX_CONCURRENCY/.test(s) === false
      ) {
        findings.push({
          file: fp,
          issue:
            "Potential unbounded concurrency (guard with concurrency limiter)",
        });
      }
    }
  }
}
for (const g of GLOBS) {
  if (fs.existsSync(g)) walk(g);
}
const out = { score: 10 - findings.length, findings };
fs.writeFileSync("reports/CODE_AUDIT.json", JSON.stringify(out, null, 2));
fs.writeFileSync(
  "reports/CODE_AUDIT.md",
  `# Code Audit\n\nScore: ${out.score}/10\n\n` +
    (findings.length
      ? findings.map((f, i) => `- [${i + 1}] ${f.file} — ${f.issue}`).join("\n")
      : "- No risky patterns detected.") +
    "\n",
);
console.log("== Saved: reports/CODE_AUDIT.{json,md}");
