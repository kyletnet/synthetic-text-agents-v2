export function wordCount(s) {
  return (s || "").trim().split(/\s+/).filter(Boolean).length;
}
export function ngramOverlap(a, b, n = 2) {
  const grams = (t) => {
    const tok = (t || "").split(/\s+/).filter(Boolean);
    const out = [];
    for (let i = 0; i <= tok.length - n; i++)
      out.push(tok.slice(i, i + n).join(" "));
    return new Set(out);
  };
  const A = grams(a),
    B = grams(b);
  let inter = 0;
  A.forEach((g) => {
    if (B.has(g)) inter++;
  });
  return A.size ? inter / A.size : 0;
}
export function difficultyScore(s) {
  // naive proxy: longer words → higher difficulty
  const words = (s || "").match(/[A-Za-z가-힣]+/g) || [];
  if (!words.length) return 0;
  const avgLen = words.reduce((x, w) => x + w.length, 0) / words.length;
  return Math.min(1, avgLen / 10);
}
//# sourceMappingURL=metrics.js.map
