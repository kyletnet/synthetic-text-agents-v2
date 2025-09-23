// Minimal retriever: token-overlap (Jaccard-like) for predictable baseline.
// Replace later with vector/semantic retrieval.
const DEFAULTS = {
  topK: 5,
  minScore: 0.01,
};
export function retrieve(query, corpus, options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  if (!query?.trim() || !Array.isArray(corpus) || corpus.length === 0)
    return [];
  const q = toTokens(query);
  const results = corpus.map((c) => {
    const score = jaccard(q, toTokens(c.text));
    return { id: c.id, score, chunk: c };
  });
  return results
    .filter((r) => r.score >= cfg.minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, cfg.topK);
}
function toTokens(s) {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .split(/[^a-z0-9가-힣]+/g)
    .filter(Boolean);
}
function jaccard(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}
//# sourceMappingURL=retrieve.js.map
