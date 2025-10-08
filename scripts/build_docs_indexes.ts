/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2025 [Your Company]
 */

import fs from "fs";
import path from "path";

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function listLatest(dir: string, extFilter: RegExp, limit = 20) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => extFilter.test(f))
    .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtime.getTime() }))
    .sort((a, b) => b.t - a.t)
    .slice(0, limit)
    .map((x) => x.f);
}

function writeIndex(root: string, sub: string, title: string, pattern: RegExp) {
  const dir = path.join(root, sub);
  ensureDir(dir);
  const files = listLatest(dir, pattern, 50);
  const md =
    `# ${title}

_Last updated: ${new Date().toISOString()}_

` +
    (files.length
      ? files.map((f) => `- [${f}](${sub}/${f})`).join("\n")
      : "_No files_") +
    "\n";

  const out = path.join(root, sub, "INDEX.md");
  fs.writeFileSync(out, md, "utf-8");
  return out;
}

const docsRoot = path.resolve(process.cwd(), "apps", "fe-web", "docs");
const out1 = writeIndex(docsRoot, "RUN_LOGS", "Run Logs (latest)", /\.md$/);
const out2 = writeIndex(
  docsRoot,
  "DECISIONS",
  "Improvement Notes (latest)",
  /\.md$/,
);
const out3 = writeIndex(
  docsRoot,
  "EXPERIMENTS",
  "Sandbox Experiments (latest)",
  /\.md$/,
);

console.log("Indexes written:", out1, out2, out3);
