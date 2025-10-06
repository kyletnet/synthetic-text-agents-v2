const fs = require("fs");

function tokenizeKoEn(s) {
  if (!s) return [];
  // 한글/영문/숫자 중심 토큰화, 소문자화
  return (s + "")
    .toLowerCase()
    .replace(/[^0-9a-z가-힣\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}
function ngrams(tokens, n = 3) {
  const res = [];
  for (let i = 0; i + (n - 1) < tokens.length; i++) {
    res.push(tokens.slice(i, i + n).join(" "));
  }
  return res;
}
function uniq(arr) {
  return Array.from(new Set(arr));
}
function mean(a) {
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
}
function quantiles(nums) {
  if (!nums.length) return { p50: 0, p95: 0, min: 0, max: 0 };
  const a = [...nums].sort((x, y) => x - y);
  const q = (p) => {
    const i = (a.length - 1) * p;
    const lo = Math.floor(i),
      hi = Math.ceil(i);
    return lo === hi ? a[lo] : a[lo] * (hi - i) + a[hi] * (i - lo);
  };
  return { p50: q(0.5), p95: q(0.95), min: a[0], max: a[a.length - 1] };
}
function sparkline(arr) {
  // 8단계 블럭으로 간단 시각화
  const ticks = "▁▂▃▄▅▆▇█";
  const mn = Math.min(...arr, 0),
    mx = Math.max(...arr, 1e-9);
  const span = mx - mn || 1;
  return arr
    .map((v) => {
      const idx = Math.max(0, Math.min(7, Math.floor(((v - mn) / span) * 7)));
      return ticks[idx];
    })
    .join("");
}
function mdTable(rows) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const head = `| ${keys.join(" | ")} |\n| ${keys
    .map(() => "---")
    .join(" | ")} |\n`;
  const body = rows
    .map((r) => `| ${keys.map((k) => String(r[k] ?? "")).join(" | ")} |`)
    .join("\n");
  return head + body + "\n";
}

module.exports = {
  tokenizeKoEn,
  ngrams,
  uniq,
  mean,
  quantiles,
  sparkline,
  mdTable,
};
