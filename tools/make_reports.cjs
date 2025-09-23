const fs = require("fs");
const path = require("path");
const { mdTable } = require("./_utils_diversity.cjs");

function rowForCase(r, idx) {
  return {
    "#": idx + 1,
    Question: (r.Q || "").slice(0, 80),
    "Answer(80)": (r.A || "").slice(0, 80),
    Score: (r.score ?? "").toFixed(2),
    Type: r.type,
    LenA: r.lenA,
    TTR: (r.ttr ?? 0).toFixed(2),
    Cover: (r.cover ?? 0).toFixed(2),
    Fmt: r.okFormat ? "✓" : "✗",
  };
}

function main() {
  const args = process.argv.slice(2);
  const i = args.indexOf("--in");
  const inFile = i >= 0 ? args[i + 1] : null;
  const outSummary = args[args.indexOf("--summary") + 1];
  const outCasebook = args[args.indexOf("--casebook") + 1];
  const samples = parseInt(process.env.CASE_SAMPLES || "12", 10);

  if (!inFile) {
    console.error("need --in json");
    process.exit(2);
  }
  const data = JSON.parse(fs.readFileSync(inFile, "utf8"));
  const { meta, diversity, per } = data;

  // 상단 요약
  const sumMD = [];
  sumMD.push(`# Baseline-Plus Summary`);
  sumMD.push(`- Input: \`${meta.inFile}\`  (total: ${meta.total})`);
  sumMD.push(
    `- Pass threshold: **${meta.passThreshold}**  ·  Pass rate: **${(diversity.score.passRate * 100).toFixed(1)}%**`,
  );
  sumMD.push(
    `- Score mean/p50/p95: **${diversity.score.mean.toFixed(2)} / ${diversity.score.p50.toFixed(2)} / ${diversity.score.p95.toFixed(2)}**`,
  );
  sumMD.push(
    `- Answer length (mean/p50/p95): **${diversity.lenA.mean.toFixed(1)} / ${diversity.lenA.p50.toFixed(0)} / ${diversity.lenA.p95.toFixed(0)}**`,
  );
  sumMD.push(
    `- Lexical diversity (TTR mean): **${diversity.ttrMean.toFixed(2)}**`,
  );
  sumMD.push(
    `- 3-gram overlap (dup-rate): **${(diversity.dup3Rate * 100).toFixed(1)}%**  (낮을수록 중복↓)`,
  );
  sumMD.push(
    `- Question type distribution: \`${Object.entries(diversity.qtypeDist)
      .map(([k, v]) => `${k}:${v}`)
      .join(", ")}\``,
  );
  sumMD.push(`- Score distribution sparkline: \`${diversity.score.spark}\``);
  sumMD.push(
    `\n> 가이드: dup-rate > 20%면 질문/답변 패턴 다양화 필요, TTR < 0.25면 어휘 다양화 필요, p95 길이 > 180이면 장황 가능성.\n`,
  );

  fs.writeFileSync(outSummary, sumMD.join("\n") + "\n");

  // 사례집(상·중·하 골고루)
  const sorted = [...per].sort((a, b) => b.score - a.score);
  const take = (arr, n) => arr.slice(0, Math.min(n, arr.length));
  const hi = take(sorted, Math.ceil(samples / 3));
  const mid = take(
    sorted.slice(Math.floor(sorted.length / 2)),
    Math.ceil(samples / 3),
  );
  const lo = take(sorted.slice(-samples), Math.ceil(samples / 3));

  const cb = [];
  cb.push(`# Casebook (샘플 ${samples}건)`);
  cb.push(`- 생성 시각: ${meta.createdAt}`);
  cb.push(`- 기준선 파일: \`${meta.inFile}\``);
  cb.push(`\n## 상위 케이스`);
  cb.push(mdTable(hi.map(rowForCase)));
  cb.push(`\n## 중간 케이스`);
  cb.push(mdTable(mid.map(rowForCase)));
  cb.push(`\n## 하위 케이스`);
  cb.push(mdTable(lo.map(rowForCase)));

  // 페르소나 노트가 있으면 첨부
  const pn = fs
    .readdirSync("reports")
    .filter((f) => /^_PERSONA_NOTES_/.test(f))
    .sort()
    .pop();
  if (pn) {
    cb.push(`\n## 전문가 페르소나 노트`);
    cb.push(fs.readFileSync(path.join("reports", pn), "utf8"));
  }
  fs.writeFileSync(outCasebook, cb.join("\n") + "\n");
}
main();
