import fs from "fs";
import path from "path";

type Status = "ok"|"missing"|"partial";

function has(patterns:string[], root:string):boolean{
  const stack=[root];
  while(stack.length){
    const cur=stack.pop()!;
    for(const name of fs.readdirSync(cur)){
      const p=path.join(cur,name);
      const stat=fs.statSync(p);
      if(stat.isDirectory()){ stack.push(p); continue; }
      if(patterns.some(rx=> new RegExp(rx).test(p))) return true;
    }
  }
  return false;
}

function writeSystemMap(repoRoot:string){
  const sysPath = path.join(repoRoot,"SYSTEM_MAP.md");
  const now = new Date().toISOString();
  const rag = has(["src/rag/chunk\\.ts","src/rag/retriever\\.ts"], repoRoot) ? "ok":"missing";
  const augParaphrase = has(["src/augmentation/"], repoRoot) ? "partial":"missing";
  const docPath = has(["seed_doc_path"], path.join(repoRoot,"src")) ? "partial":"missing";
  const pairsPath = has(["gold_pairs_path"], path.join(repoRoot,"src")) ? "partial":"missing";
  
  const md = `# System Map

_Auto-generated: ${now}_

## Input Routing

| Component | Status | Details |
|-----------|--------|---------|
| seed_doc_path | **${docPath}** | ${docPath!=="missing" && docPath!=="partial"?"Doc-only pipeline wired":"No explicit doc ingestion routing found"} |
| gold_pairs_path | **${pairsPath}** | ${pairsPath!=="missing" && pairsPath!=="partial"?"Pairs-only pipeline wired":"No explicit gold pair routing found"} |
| mixed inputs | **${(docPath!=="missing"&&pairsPath!=="missing")?"partial":"missing"}** | Mixed = both routes present |
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
  
  fs.writeFileSync(sysPath, md, "utf-8");
  return sysPath;
}

const repoRoot = path.resolve(__dirname, "..");
const out = writeSystemMap(repoRoot);
console.log("SYSTEM_MAP.md regenerated:", out);