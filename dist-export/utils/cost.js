const PRICING = {
  // USD per 1 token (단순화: $/1e6 tokens 테이블을 1토큰 당 단가로 환산)
  // claude-3.5-sonnet-latest 예시: in $3/M, out $15/M
  "claude-3-5-sonnet-latest": { in: 3 / 1_000_000, out: 15 / 1_000_000 },
};
export function estimateUSD(model, u) {
  const p = PRICING[model] || PRICING["claude-3-5-sonnet-latest"];
  const tin = (u?.input_tokens || 0) * p.in;
  const tout = (u?.output_tokens || 0) * p.out;
  return +(tin + tout).toFixed(6);
}
//# sourceMappingURL=cost.js.map
