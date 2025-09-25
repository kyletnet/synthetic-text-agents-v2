"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if ((from && typeof from === "object") || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, {
          get: () => from[key],
          enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable,
        });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (
  (target = mod != null ? __create(__getProtoOf(mod)) : {}),
  __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule
      ? __defProp(target, "default", { value: mod, enumerable: true })
      : target,
    mod,
  )
);
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
function has(patterns, root) {
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop();
    for (const name of import_fs.default.readdirSync(cur)) {
      const p = import_path.default.join(cur, name);
      const stat = import_fs.default.statSync(p);
      if (stat.isDirectory()) {
        stack.push(p);
        continue;
      }
      if (patterns.some((rx) => new RegExp(rx).test(p))) return true;
    }
  }
  return false;
}
function writeSystemMap(repoRoot2) {
  const sysPath = import_path.default.join(repoRoot2, "SYSTEM_MAP.md");
  const now = /* @__PURE__ */ new Date().toISOString();
  const rag = has(["src/rag/chunk\\.ts", "src/rag/retriever\\.ts"], repoRoot2)
    ? "ok"
    : "missing";
  const augParaphrase = has(["src/augmentation/"], repoRoot2)
    ? "partial"
    : "missing";
  const docPath = has(
    ["seed_doc_path"],
    import_path.default.join(repoRoot2, "src"),
  )
    ? "partial"
    : "missing";
  const pairsPath = has(
    ["gold_pairs_path"],
    import_path.default.join(repoRoot2, "src"),
  )
    ? "partial"
    : "missing";
  const md = `# System Map

_Auto-generated: ${now}_

## Input Routing

| Component | Status | Details |
|-----------|--------|---------|
| seed_doc_path | **${docPath}** | ${docPath === "ok" ? "Doc-only pipeline wired" : "No explicit doc ingestion routing found"} |
| gold_pairs_path | **${pairsPath}** | ${pairsPath === "ok" ? "Pairs-only pipeline wired" : "No explicit gold pair routing found"} |
| mixed inputs | **${docPath !== "missing" && pairsPath !== "missing" ? "partial" : "missing"}** | Mixed = both routes present |
| default path | **ok** | Backward-compatible fallback retained |

## RAG/Chunking

| Component | Status | Details |
|-----------|--------|---------|
| chunking | **${rag}** | src/rag/chunk.ts |
| retriever | **${rag}** | src/rag/retriever.ts |

## Augmentation

| Component | Status | Details |
|-----------|--------|---------|
| paraphrase | **${augParaphrase}** | src/augmentation/ |

## Telemetry
- RUN_LOGS: apps/fe-web/docs/RUN_LOGS/
- DECISIONS: apps/fe-web/docs/DECISIONS/
- Cleanup: LOG_RETENTION_DAYS in .env.local
`;
  import_fs.default.writeFileSync(sysPath, md, "utf-8");
  return sysPath;
}
const repoRoot = import_path.default.resolve(__dirname, "..");
const out = writeSystemMap(repoRoot);
console.log("SYSTEM_MAP.md regenerated:", out);
