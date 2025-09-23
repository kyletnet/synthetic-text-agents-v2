export function inferRulesFromFeedback(feedback, topicTerms = []) {
  const f = feedback.toLowerCase();
  const rules = [];
  if (/(길|장문|too long|long)/.test(f)) {
    rules.push({
      type: "length_max_tokens",
      value: 12,
      reason: "문장이 길다는 피드백 → 12어절 이하로 제한",
    });
  }
  if (/(어려|난이도|difficult|hard)/.test(f)) {
    rules.push({
      type: "tone_primary",
      value: "elementary",
      reason: "어렵다는 피드백 → 초등 톤으로 낮춤",
    });
  }
  if (/(반복|지루|패턴)/.test(f)) {
    rules.push({
      type: "vary_sentence_forms",
      value: true,
      reason: "표현 반복 지적 → 문형 다양화",
    });
  }
  if (/(핵심|토픽|topic|include)/.test(f) && topicTerms.length) {
    rules.push({
      type: "must_include_topic_terms",
      value: topicTerms.slice(0, 3),
      reason: "핵심 토픽 포함 요구",
    });
  }
  // 금지어는 초기에 없음 (빈 리스트 유지)
  return rules;
}
export function mergeRules(base, extra) {
  // Simple de-dup by type
  const byType = new Map();
  [...base, ...extra].forEach((r) => byType.set(r.type, r));
  return Array.from(byType.values());
}
export function rulesHumanSummary(rules) {
  const parts = rules.map((r) => {
    switch (r.type) {
      case "length_max_tokens":
        return `문장 길이 ${r.value}어절 이하`;
      case "forbid_terms":
        return r.value.length ? `금지어 ${r.value.join(", ")}` : `금지어 없음`;
      case "tone_primary":
        return r.value === "elementary" ? "초등 톤" : "중립 톤";
      case "vary_sentence_forms":
        return "문형 다양화";
      case "must_include_topic_terms":
        return `핵심어 포함: ${r.value.join(", ")}`;
    }
  });
  return parts.join(" / ");
}
export function applyRulesToPrompt(basePrompt, rules) {
  let p = basePrompt;
  rules.forEach((r) => {
    if (r.type === "length_max_tokens") {
      p += `\n- 각 문장은 ${r.value} 어절 이하로 쓰세요.`;
    } else if (r.type === "tone_primary" && r.value === "elementary") {
      p += `\n- 초등학생도 이해할 수 있게 쉬운 어휘와 짧은 문장을 사용하세요.`;
    } else if (r.type === "vary_sentence_forms" && r.value) {
      p += `\n- 문장 패턴을 반복하지 말고 다양한 어투/문형을 섞어 쓰세요.`;
    } else if (r.type === "must_include_topic_terms" && r.value.length) {
      p += `\n- 다음 핵심어(주제어)를 반드시 포함하세요: ${r.value.join(", ")}.`;
    } else if (r.type === "forbid_terms" && r.value.length) {
      p += `\n- 다음 금지어를 사용하지 마세요: ${r.value.join(", ")}.`;
    }
  });
  return p;
}
//# sourceMappingURL=rulesEngine.js.map
