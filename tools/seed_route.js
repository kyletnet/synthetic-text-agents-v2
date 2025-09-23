import fs from "fs";
import path from "path";

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const [k, v] = a.split("=");
      const key = k.replace(/^--/, "");
      if (typeof v === "undefined") {
        // handle "--enableRag" or "--seedDoc" followed by value
        const next =
          argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
        out[key] = next;
      } else out[key] = v;
    }
  }
  return out;
}

function logRun(payload) {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const dir = path.join(process.cwd(), "RUN_LOGS");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${day}.jsonl`);
  payload.timestamp = new Date().toISOString();
  fs.appendFileSync(file, JSON.stringify(payload) + "\n", "utf8");
  console.log(`[log] appended -> ${file}`);
}

async function maybeCallRag(seedDoc) {
  // Try a best-effort import for an existing RAG service without breaking if missing
  // Expected optional exports:
  //   - processSeedDoc(path)  OR
  //   - default({seedDocPath})
  const candidates = [
    "./dist/rag/service.js", // compiled JS
    "./src/rag/service.js", // ESM JS project
    "./src/rag/service.ts", // TS source (will not import directly without ts-node)
  ];
  for (const rel of candidates) {
    const abs = path.join(process.cwd(), rel);
    if (fs.existsSync(abs) && abs.endsWith(".js")) {
      try {
        const mod = await import(pathToFileURL(abs).href);
        if (typeof mod.processSeedDoc === "function") {
          return await mod.processSeedDoc(seedDoc);
        }
        if (mod.default && typeof mod.default === "function") {
          return await mod.default({ seedDocPath: seedDoc });
        }
      } catch (e) {
        console.warn(
          `[warn] RAG service import failed at ${rel}: ${e?.message || e}`,
        );
      }
    }
  }
  console.log(
    "[info] RAG service not found; skipping actual RAG call (router demo only).",
  );
  return { ok: true, note: "rag-service-missing" };
}

// Node <20 compatibility for file URL helper without adding deps
function pathToFileURL(p) {
  const u = new URL("file://");
  u.pathname = path.resolve(p).replace(/\\/g, "/");
  return u;
}

(async function main() {
  const args = parseArgs(process.argv);
  const enableRag = !!args.enableRag || args.enableRag === "true";
  const seedDoc = String(args.seedDoc || args.seed_doc_path || "");
  const runId = `p1-1-${Date.now()}`;

  let routing = "legacy";
  let resultNote = "";

  if (enableRag && seedDoc) {
    if (fs.existsSync(seedDoc)) {
      routing = "rag";
      try {
        const res = await maybeCallRag(seedDoc);
        resultNote = res?.note || "rag-called";
      } catch (e) {
        console.warn(
          "[warn] RAG call failed, falling back to legacy:",
          e?.message || e,
        );
        routing = "legacy"; // fallback on failure
        resultNote = "fallback-legacy";
      }
    } else {
      console.warn("[warn] seedDoc not found on disk; falling back to legacy");
      routing = "legacy";
      resultNote = "missing-doc";
    }
  } else {
    resultNote = enableRag ? "no-seedDoc" : "flag-off";
  }

  console.log(
    JSON.stringify(
      { run_id: runId, decided_routing: routing, note: resultNote },
      null,
      2,
    ),
  );

  // Guardian-compatible minimal fields
  logRun({
    run_id: runId,
    routing_path: routing,
    quality_score: null,
    p95_ms: null,
    cost: null,
    cost_cap_hit: 0,
    citation_presence: null,
    snippet_alignment: null,
    failure_class: routing === "legacy" && enableRag ? "routing" : "-",
  });
})();
