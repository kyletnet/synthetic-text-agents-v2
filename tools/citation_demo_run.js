import fs from 'fs';
import path from 'path';
import { enrichWithCitations } from './citation_enrich.js';
import { guardianCitation } from './guardian_citation.js';

const root=process.cwd();
const docA=fs.readFileSync(path.join(root,'dev/runs/sample_docs/docA.md'),'utf8');
const docB=fs.readFileSync(path.join(root,'dev/runs/sample_docs/docB.md'),'utf8');

const retrievedTopK=[
  { doc_id:'docA', span:'p.1', snippet:'short sample document', score:0.92 },
  { doc_id:'docB', span:'p.1', snippet:'retrieval', score:0.85 }
];

const answer='According to the uploaded short sample document, it mentions retrieval in a minimal way.';

const enriched=enrichWithCitations(answer,retrievedTopK);
const metrics=guardianCitation({ run_id:`cit-${Date.now()}`, answer: enriched.answer, citations: enriched.citations });

console.log(JSON.stringify({ ...enriched, metrics }, null, 2));
