#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { globSync } from "glob";

type Mode = "handoff" | "export";
const mode = process.argv.includes("--mode")
  ? (process.argv[process.argv.indexOf("--mode") + 1] as Mode)
  : "handoff";

function existsOne(patterns: string[]): { ok: boolean; hits: string[] } {
  const hits = patterns.flatMap((p) => globSync(p, { nodir: true }));
  return { ok: hits.length > 0, hits };
}

function must(oneOf: string[], name: string, missing: string[]) {
  const r = existsOne(oneOf);
  if (!r.ok) missing.push(name);
  return r.hits;
}

function checkRedactedEnv(hits: string[], notes: string[], missing: string[]) {
  if (hits.length === 0) {
    missing.push(".env*(redacted)");
    return;
  }
  const bad = hits.filter((f) => {
    const s = fs.readFileSync(f, "utf8");
    return !/(REDACTED|\*\*\*|MASKED)/.test(s);
  });
  if (bad.length) notes.push(`env not redacted: ${bad.join(", ")}`);
}

function main() {
  const present: string[] = [];
  const missing: string[] = [];
  const notes: string[] = [];

  present.push(
    ...must(
      ["reports/session_report.md"],
      "reports/session_report.md",
      missing,
    ),
  );
  present.push(
    ...must(
      ["reports/baseline_report.jsonl", "reports/baseline_report.json"],
      "reports/baseline_report.(jsonl|json)",
      missing,
    ),
  );
  present.push(
    ...must(
      ["reports/observability/**/index.html"],
      "observability index.html",
      missing,
    ),
  );
  present.push(
    ...must(
      [
        "reports/observability/**/trace*.json",
        "reports/observability/**/trace_tree.json",
      ],
      "observability trace json",
      missing,
    ),
  );
  present.push(...must(["RUN_LOGS/**/*", "RUN_LOGS/*"], "RUN_LOGS/*", missing));
  present.push(...must(["data_manifest.json"], "data_manifest.json", missing));
  present.push(
    ...must(["baseline_config.json"], "baseline_config.json", missing),
  );

  // env files (redacted)
  const envHits = globSync(".env*", { nodir: true });
  checkRedactedEnv(envHits, notes, missing);
  present.push(...envHits);

  present.push(
    ...must(
      ["tsconfig.build.json", "tsconfig.json"],
      "tsconfig*.json",
      missing,
    ),
  );
  present.push(
    ...must(["docs/PRODUCT_PLAN.md"], "docs/PRODUCT_PLAN.md", missing),
  );
  present.push(...must(["docs/OPS_BRIEF.md"], "docs/OPS_BRIEF.md", missing));

  if (mode === "export") {
    present.push(
      ...must(
        ["src/**/*", "scripts/**/*"],
        "code snapshot (src/, scripts/)",
        missing,
      ),
    );
    present.push(
      ...must(
        ["validators/**/*", "schema/**/*", "schemas/**/*"],
        "validators/schema/*",
        missing,
      ),
    );
    // dashboards optional; no-op
  }

  const out = { mode, presentCount: present.length, missing, notes };
  console.log(JSON.stringify(out, null, 2));
  process.exit(missing.length ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
