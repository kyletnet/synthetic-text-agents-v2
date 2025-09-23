const fs = require("fs");
const https = require("https");

function pickSamples(inFile, n) {
  const lines = fs.readFileSync(inFile, "utf8").split(/\r?\n/).filter(Boolean);
  const step = Math.max(1, Math.floor(lines.length / n));
  const sel = [];
  for (let i = 0; i < lines.length && sel.length < n; i += step) {
    sel.push(lines[i]);
  }
  return sel.map((l) => JSON.parse(l));
}

function rotate(keys) {
  let i = 0;
  return () => keys[i++ % keys.length];
}

function callAnthropic(key, model, messages) {
  const data = JSON.stringify({
    model,
    max_tokens: 512,
    messages,
  });
  const opts = {
    method: "POST",
    hostname: "api.anthropic.com",
    path: "/v1/messages",
    headers: {
      "content-type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": key,
    },
  };
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      let buf = "";
      res.on("data", (c) => (buf += c));
      res.on("end", () => {
        try {
          const j = JSON.parse(buf);
          resolve(j?.content?.[0]?.text || buf);
        } catch (e) {
          resolve(buf);
        }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const args = process.argv.slice(2);
  const IN = args[args.indexOf("--in") + 1];
  const OUT = args[args.indexOf("--out") + 1] || "reports/_PERSONA_NOTES.md";
  const N = parseInt(process.env.PERSONA_SAMPLE_N || "8", 10);
  const model = process.env.PERSONA_MODEL || "claude-3-5-sonnet-20240620";
  const keys = (process.env.ANTHROPIC_API_KEYS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!IN || !keys.length) {
    console.log("skip");
    process.exit(0);
  }

  const nextKey = rotate(keys);
  const samples = pickSamples(IN, N);
  const promptHeader = `당신들은 3인의 전문가 패널입니다: 교육 평가전문가, 데이터 검수 리드, LLM PO.
- 아래 Q/A를 보고 지표(형식, 근거성, 다양성, 길이 적정, 유형 난이도) 관점으로 위험/권고를 5줄 이내 bullet로 합의해 주세요.
- 합격 기준: 점수>=${process.env.PASS_THRESHOLD || "0.82"}.
- 결과는 한국어로 간결하게.`;

  const bullets = [];
  for (const s of samples) {
    const text = `${promptHeader}\n\nQ: ${s.Q}\nA: ${s.A}\n`;
    const key = nextKey();
    const msg = await callAnthropic(key, model, [
      { role: "user", content: text },
    ]).catch((e) => `(API 에러) ${e.message}`);
    bullets.push(`- ${msg.replace(/\n/g, " ")}`);
    await new Promise((r) => setTimeout(r, 200)); // rate 완화
  }

  const out = `> 전문가 패널 합의 노트 (${N}건 샘플)\n${bullets.join("\n")}\n`;
  fs.writeFileSync(OUT.replace(/\.md$/, "_" + Date.now() + ".md"), out);
  console.log("persona notes saved");
}
main().catch((e) => {
  console.error(e);
  process.exit(0);
});
