import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  const headerToken = req.headers.get("x-docs-refresh-token") || "";
  const envToken = process.env.DOCS_REFRESH_TOKEN || "";
  if (!envToken || headerToken !== envToken) {
    return NextResponse.json({ ok:false, error:"unauthorized" }, { status: 401 });
  }
  try {
    const repoRoot = path.resolve(process.cwd(), "..", "..");
    const docsRoot = path.join(repoRoot, "apps", "fe-web", "docs");
    const stampPath = path.join(docsRoot, ".last_refresh.json");
    const cfgPath   = path.join(docsRoot, ".watch_paths.json");

    execSync("node scripts/generate_system_map.cjs", {
      stdio: "inherit",
      cwd: repoRoot,
    });
    execSync("node scripts/build_docs_indexes.cjs", {
      stdio: "inherit",
      cwd: repoRoot,
    });

    const defaultWatched = [
      "src/","apps/fe-web/app/api/","src/agents/","src/core/",
      "src/shared/types.ts","src/augmentation/","src/rag/",
      "src/shared/env.ts",".env.local"
    ];
    let watched = defaultWatched;
    try {
      if (fs.existsSync(cfgPath)) {
        const arr = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
        if (Array.isArray(arr) && arr.length) watched = arr;
      }
    } catch {}

    const gitHead = execSync("git rev-parse HEAD", { cwd: repoRoot }).toString().trim();
    const now = new Date().toISOString();
    fs.writeFileSync(stampPath, JSON.stringify({ at: now, head: gitHead, watched }, null, 2));

    return NextResponse.json({
      ok: true,
      refreshed: ["SYSTEM_MAP.md","RUN_LOGS/INDEX.md","DECISIONS/INDEX.md","EXPERIMENTS/INDEX.md"],
      stamp: { at: now, head: gitHead },
      watched,
    });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: String(e?.message || e) }, { status: 500 });
  }
}