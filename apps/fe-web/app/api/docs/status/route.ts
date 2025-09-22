import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

export async function GET(){
  const repoRoot = path.resolve(process.cwd(), "..", "..");
  const docsRoot = path.join(repoRoot, "apps", "fe-web", "docs");
  const stampPath = path.join(docsRoot, ".last_refresh.json");
  const cfgPath   = path.join(docsRoot, ".watch_paths.json");

  // Load defaults / config-first watched set
  let watched = ["src/","apps/fe-web/app/api/","src/agents/","src/core/","src/shared/types.ts","src/augmentation/","src/rag/","src/shared/env.ts",".env.local"];
  try {
    if (fs.existsSync(cfgPath)) {
      const arr = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
      if (Array.isArray(arr) && arr.length) watched = arr;
    }
  } catch {}

  let stamp:any = null;
  if(fs.existsSync(stampPath)){
    try { stamp = JSON.parse(fs.readFileSync(stampPath, "utf-8")); } catch {}
  }

  let head = "";
  try { head = execSync("git rev-parse HEAD", { cwd: repoRoot }).toString().trim(); } catch {}

  let stale = !stamp;
  let reasons:string[] = [];

  if(stamp && head){
    const diff = execSync(`git diff --name-only ${stamp.head}..${head}`, { cwd: repoRoot })
      .toString().split("\n").filter(Boolean);
    const baseWatched = Array.isArray(stamp.watched) && stamp.watched.length ? stamp.watched : watched;
    const touched = diff.filter(f => baseWatched.some((w:string)=> f.startsWith(w) || f===w));
    if(touched.length>0){
      stale = true;
      reasons = touched.slice(0,20);
    }
  }

  return NextResponse.json({ ok:true, stale, head, stamp, watched, reasons });
}