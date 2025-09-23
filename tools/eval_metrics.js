import { alignmentScore } from "./similarity.js";

/**
 * Compute recall@k as fraction of gold doc ids found in top-k retrieved doc ids.
 * Returns { recall_at_k, hit_at_k, found, total }
 */
export function recallAtK(goldDocIds, retrievedDocIds, k = 5) {
  const gold = Array.from(new Set((goldDocIds || []).map(String)));
  const ret = Array.from(new Set((retrievedDocIds || []).map(String))).slice(
    0,
    k,
  );
  let found = 0;
  for (const g of gold) {
    if (ret.includes(g)) found++;
  }
  const total = gold.length || 1;
  const recall = found / total;
  const hit = found > 0 ? 1 : 0;
  return {
    recall_at_k: Number(recall.toFixed(4)),
    hit_at_k: hit,
    found,
    total,
  };
}

/**
 * Citation precision proxy against the final answer.
 * Count citations whose snippet aligns with the answer above a threshold.
 * Returns { precision_proxy, positives, total, threshold }
 */
export function citationPrecisionProxy(answer, citations, threshold = 0.3) {
  const arr = Array.isArray(citations) ? citations : [];
  if (arr.length === 0) {
    return { precision_proxy: 0, positives: 0, total: 0, threshold };
  }
  let pos = 0;
  for (const c of arr) {
    const s = alignmentScore(String(answer || ""), String(c?.snippet || ""));
    if (s >= threshold) pos++;
  }
  const prec = pos / arr.length;
  return {
    precision_proxy: Number(prec.toFixed(4)),
    positives: pos,
    total: arr.length,
    threshold,
  };
}

/** Percentile utility (e.g., p=0.95) */
export function percentile(values, p = 0.95) {
  const v = (values || [])
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  if (v.length === 0) return 0;
  const idx = Math.min(v.length - 1, Math.max(0, Math.ceil(p * v.length) - 1));
  return v[idx];
}

/** Measure latency in ms for an async function fn */
export async function timeIt(fn) {
  const t0 = performance.now();
  const val = await fn();
  const t1 = performance.now();
  return { ms: Number((t1 - t0).toFixed(3)), value: val };
}
