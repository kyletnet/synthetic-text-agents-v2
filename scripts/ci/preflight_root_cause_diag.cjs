/* Root-cause diagnostic for preflight issues.
 * It inspects dist/scripts/preflight_pack.js, baseline_config.json,
 * presence of data_manifest.json, Product Plan location/headers,
 * and confirms whether the compiled JS actually contains the new logic
 * (auto-manifest + resolveSmokeCmd + dual product plan paths).
 * No external processes or preflight are executed.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}
function stat(p) {
  try {
    return fs.statSync(p);
  } catch {
    return null;
  }
}
function read(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}
function sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}
function safeJson(p) {
  const txt = read(p);
  if (!txt) return { ok: false, error: "missing", path: p };
  try {
    return { ok: true, value: JSON.parse(txt), path: p };
  } catch (e) {
    return {
      ok: false,
      error: "json-parse-failed",
      path: p,
      detail: String(e),
    };
  }
}
function findNeedle(txt, needles) {
  const got = {};
  for (const n of needles) {
    got[n] = txt.includes(n);
  }
  return got;
}
function parseProductPlanHeader(txt) {
  // Expect 4-key header anywhere in first ~40 lines
  if (!txt) return { found: false };
  const lines = txt.split(/\r?\n/).slice(0, 40);
  const map = {};
  for (const ln of lines) {
    const m = ln.match(/^(Title|Version|Commit|Profile):\s*(.+)\s*$/);
    if (m) map[m[1]] = m[2];
  }
  const ok = ["Title", "Version", "Commit", "Profile"].every((k) => map[k]);
  return { found: ok, fields: map, sample: lines.slice(0, 10) };
}

(function main() {
  const wd = process.cwd();

  // Key paths
  const srcPreflight = path.join(wd, "src", "scripts", "preflight_pack.ts");
  const distPreflight = path.join(wd, "dist", "scripts", "preflight_pack.js");
  const dataManifest = path.join(wd, "data_manifest.json");

  // Product Plan candidates
  const ppRoot = path.join(wd, "PRODUCT_PLAN.md");
  const ppDocs = path.join(wd, "docs", "PRODUCT_PLAN.md");

  // baseline_config candidates
  const bc1 = path.join(wd, "baseline_config.json");
  const bc2 = path.join(wd, "config", "baseline_config.json");

  // Presence & timestamps
  const sStat = stat(srcPreflight);
  const dStat = stat(distPreflight);
  const srcNewer = sStat && dStat ? sStat.mtimeMs > dStat.mtimeMs : null;

  // Dist content scan
  const distTxt = read(distPreflight) || "";
  const distHash = distTxt ? sha256(distTxt).slice(0, 12) : null;
  const needles = findNeedle(distTxt, [
    "auto-created data_manifest.json", // our auto-manifest log
    "resolveSmokeCmd", // our resolver
    "No smoke runner found, simulating", // old behavior marker
    "./PRODUCT_PLAN.md", // root path probe
    "./docs/PRODUCT_PLAN.md", // docs path probe
  ]);

  // baseline_config load
  const bcs = [bc1, bc2].filter(exists);
  let smokeCmd = null,
    bcLoad = null;
  for (const p of bcs) {
    const j = safeJson(p);
    if (j.ok) {
      bcLoad = j;
      if (
        j.value &&
        j.value.runners &&
        typeof j.value.runners.smoke === "string"
      ) {
        smokeCmd = j.value.runners.smoke;
      }
      break;
    } else {
      bcLoad = j; // last error
    }
  }

  // Env override
  const envSmoke = process.env.SMOKE_RUN_CMD || null;

  // Product Plan detection
  const ppRootTxt = exists(ppRoot) ? read(ppRoot) : null;
  const ppDocsTxt = exists(ppDocs) ? read(ppDocs) : null;
  const ppRootHdr = parseProductPlanHeader(ppRootTxt);
  const ppDocsHdr = parseProductPlanHeader(ppDocsTxt);

  // run_v3.sh presence
  const runV3 = path.join(wd, "run_v3.sh");
  let runV3Exec = false;
  try {
    fs.accessSync(runV3, fs.constants.X_OK);
    runV3Exec = true;
  } catch {
    runV3Exec = false;
  }

  // Build the report
  const report = {
    workspace: wd,
    src: {
      preflight_ts: exists(srcPreflight),
      mtime: sStat?.mtime?.toISOString?.(),
      newerThanDist: srcNewer,
    },
    dist: {
      preflight_js: exists(distPreflight),
      mtime: dStat?.mtime?.toISOString?.(),
      size: dStat?.size,
      hash12: distHash,
      contains: needles,
    },
    manifest: {
      data_manifest_exists: exists(dataManifest),
    },
    smoke: {
      env_SMOKE_RUN_CMD: envSmoke,
      baseline_config_path: bcLoad?.path,
      baseline_config_ok: bcLoad?.ok === true,
      runners_smoke: smokeCmd,
      run_v3_present: exists(runV3),
      run_v3_executable: runV3Exec,
    },
    product_plan: {
      root_exists: exists(ppRoot),
      root_header_ok: ppRootHdr.found,
      root_fields: ppRootHdr.fields,
      docs_exists: exists(ppDocs),
      docs_header_ok: ppDocsHdr.found,
      docs_fields: ppDocsHdr.fields,
    },
    red_flags: [],
  };

  // Heuristics for root-cause flags
  if (!exists(dataManifest)) report.red_flags.push("NO_CURRENT_MANIFEST");
  if (
    needles["No smoke runner found, simulating"] &&
    !needles["resolveSmokeCmd"]
  )
    report.red_flags.push("DIST_OLD_BEHAVIOR_SIMULATING");
  if (!needles["auto-created data_manifest.json"])
    report.red_flags.push("DIST_MISSING_AUTOCREATE_LOG");
  if (!(needles["./PRODUCT_PLAN.md"] || needles["./docs/PRODUCT_PLAN.md"]))
    report.red_flags.push("DIST_NO_PRODUCT_PLAN_TOLERANCE");
  if (!smokeCmd && !envSmoke) report.red_flags.push("NO_SMOKE_RUNNER_CONFIG");
  if (!(ppRootHdr.found || ppDocsHdr.found))
    report.red_flags.push("PRODUCT_PLAN_HEADER_NOT_FOUND");
  if (srcNewer === true)
    report.red_flags.push("SRC_NEWER_THAN_DIST_REBUILD_NEEDED");

  // Pretty print
  const lines = [];
  lines.push("=== Preflight Root-Cause Diagnostic (no re-run) ===");
  lines.push(`WD: ${wd}`);
  lines.push("");
  lines.push("1) Build parity");
  lines.push(
    `- src/scripts/preflight_pack.ts: ${exists(srcPreflight)} mtime=${report.src.mtime}`,
  );
  lines.push(
    `- dist/scripts/preflight_pack.js: ${exists(distPreflight)} mtime=${report.dist.mtime} hash=${report.dist.hash12}`,
  );
  lines.push(`- src newer than dist? ${srcNewer === null ? "n/a" : srcNewer}`);
  lines.push("");
  lines.push("2) Dist content markers");
  Object.entries(needles).forEach(([k, v]) =>
    lines.push(`- contains("${k}") = ${v}`),
  );
  lines.push("");
  lines.push("3) Manifest presence");
  lines.push(
    `- data_manifest.json exists? ${report.manifest.data_manifest_exists}`,
  );
  lines.push("");
  lines.push("4) Smoke runner resolution");
  lines.push(`- ENV.SMOKE_RUN_CMD: ${envSmoke ? "(set)" : "(unset)"}`);
  lines.push(
    `- baseline_config: path=${report.smoke.baseline_config_path} ok=${report.smoke.baseline_config_ok}`,
  );
  lines.push(`- runners.smoke: ${smokeCmd || "(none)"}`);
  lines.push(
    `- run_v3.sh present=${report.smoke.run_v3_present} executable=${report.smoke.run_v3_executable}`,
  );
  lines.push("");
  lines.push("5) Product Plan detection");
  lines.push(
    `- ./PRODUCT_PLAN.md exists=${report.product_plan.root_exists} headerOk=${report.product_plan.root_header_ok}`,
  );
  lines.push(
    `- ./docs/PRODUCT_PLAN.md exists=${report.product_plan.docs_exists} headerOk=${report.product_plan.docs_header_ok}`,
  );
  if (report.product_plan.root_fields)
    lines.push(
      `- root fields: ${JSON.stringify(report.product_plan.root_fields)}`,
    );
  if (report.product_plan.docs_fields)
    lines.push(
      `- docs fields: ${JSON.stringify(report.product_plan.docs_fields)}`,
    );
  lines.push("");
  lines.push(
    "RED FLAGS: " +
      (report.red_flags.length ? report.red_flags.join(", ") : "(none)"),
  );
  lines.push("");
  console.log(lines.join("\n"));
  console.log("\n--- JSON ---\n" + JSON.stringify(report, null, 2));
})();
