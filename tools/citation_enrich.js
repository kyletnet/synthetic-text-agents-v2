export function enrichWithCitations(answer, retrievedTopK) {
  const citations = (retrievedTopK || []).slice(0, 5).map((r) => ({
    doc_id: r.doc_id,
    span: r.span ?? "",
    snippet: r.snippet || "",
    score: typeof r.score === "number" ? r.score : 0,
  }));
  return { answer: String(answer || ""), citations };
}
