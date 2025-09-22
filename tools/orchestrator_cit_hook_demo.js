import fs from 'fs';
import path from 'path';
import { enrichWithCitations } from './citation_enrich.js';
import { guardianCitation } from './guardian_citation.js';

function safeRead(p){
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

const root = process.cwd();
const aPath = path.join(root, 'dev/runs/sample_docs/docA.md');
const bPath = path.join(root, 'dev/runs/sample_docs/docB.md');

const aTxt = safeRead(aPath) || 'short sample document';
const bTxt = safeRead(bPath) || 'retrieval minimal example';

const aId = fs.existsSync(aPath) ? 'docA' : 'inlineA';
const bId = fs.existsSync(bPath) ? 'docB' : 'inlineB';

const retrievedTopK = [
  { doc_id: aId, span: 'p.1', snippet: aTxt.slice(0, 120), score: 0.92 },
  { doc_id: bId, span: 'p.1', snippet: bTxt.slice(0, 120), score: 0.85 }
];

const answer = 'According to the uploaded short sample document, it mentions retrieval in a minimal way.';
const run_id = `orch-${Date.now()}`;

const enriched = enrichWithCitations(answer, retrievedTopK);
const metrics  = guardianCitation({
  run_id,
  answer: enriched.answer,
  citations: enriched.citations
});

const payload = { run_id, answer: enriched.answer, citations: enriched.citations, metrics };
console.log(JSON.stringify(payload, null, 2));
