const fs = require('fs');
const path = require('path');
const { tokenizeKoEn, ngrams, uniq, mean, quantiles, sparkline } = require('./_utils_diversity');

function parseLine(line){
  // JSONL 표준 파서 (Q/A 필드가 없으면 패턴 추출 시도)
  try {
    const obj = JSON.parse(line);
    if(obj.Q || obj.A) return obj;
    if(obj.q || obj.a){ return {Q: obj.q, A: obj.a, meta: obj.meta||{}}; }
    // 기타 포맷 호환은 필요 시 추가
    return obj;
  } catch(e){
    // "Q: ... A: ..." 형태 느슨 대응
    const q = (line.match(/Q\s*[:：]\s*(.+?)(?=\s*A\s*[:：])/i)||[])[1];
    const a = (line.match(/A\s*[:：]\s*(.+)$/i)||[])[1];
    if(q || a) return {Q:q||'', A:a||'', raw:line};
    return null;
  }
}

function judgeType(q){
  const s=(q||'').toLowerCase();
  if(/[?]\s*$/.test(s)===false && /^q[:：]/.test(s)===false) return 'other';
  if(/[왜|why]/.test(s)) return 'why';
  if(/[어떻게|how]/.test(s)) return 'how';
  if(/[누가|who]/.test(s)) return 'who';
  if(/[언제|when]/.test(s)) return 'when';
  if(/[어디|where]/.test(s)) return 'where';
  if(/[무엇|what]/.test(s)) return 'what';
  if(/[정의|정의하|define]/.test(s)) return 'define';
  if(/(맞|맞나요|참|거짓|true|false|yes|no)/.test(s)) return 'yesno';
  return 'what';
}

function scoreOne(rec, docTopTokens){
  const Q = rec.Q||'';
  const A = rec.A||'';
  const qt = tokenizeKoEn(Q), at=tokenizeKoEn(A);
  const lenQ = qt.length, lenA = at.length;
  const ttr = uniq(at).length / Math.max(1, at.length);  // 어휘 다양도
  const okFormat = ((/q[:：]/i.test(Q) || /\?$/.test(Q)) && (/^a[:：]/i.test(A) || at.length>0)) ? 1 : 0;
  // 키워드 커버리지: 문서 상위 토큰과 답변의 교집합 비율
  const cover = docTopTokens.length ? uniq(at).filter(t=>docTopTokens.includes(t)).length / Math.max(1, uniq(docTopTokens).length) : 0.0;
  // 길이 적정성(짧거나 과도하게 긴 경우 페널티)
  let lenFit=1.0;
  if(lenA<5) lenFit = 0.5;
  else if(lenA>120) lenFit = 0.7;
  // 유형 난이도 보정(선택): 현재는 1.0(평준)
  const type = judgeType(Q);
  const typeAdj = 1.0;

  // 가중 합: 형식 0.4, 커버리지 0.25, TTR 0.2, 길이 0.15
  const score = (0.4*okFormat + 0.25*cover + 0.2*ttr + 0.15*lenFit)*typeAdj;

  return {lenQ,lenA,ttr,okFormat,cover,type,score};
}

function topDocTokensFromSeed(){
  // docs/seed.txt 있으면 상위 토큰 추출
  const p = path.join('docs','seed.txt');
  if(!fs.existsSync(p)) return [];
  const txt = fs.readFileSync(p,'utf8');
  const toks = tokenizeKoEn(txt).filter(t=>t.length>1);
  const counts = {};
  toks.forEach(t=>counts[t]=(counts[t]||0)+1);
  return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,40).map(([t])=>t);
}

function main(){
  const args=process.argv.slice(2);
  const i = args.indexOf('--in'); 
  const inFile = i>=0 ? args[i+1] : null;
  const o = args.indexOf('--out');
  const outFile = o>=0 ? args[o+1] : null;
  if(!inFile || !fs.existsSync(inFile)){ 
    console.error('no input'); process.exit(2);
  }

  const docTopTokens = topDocTokensFromSeed();

  const lines = fs.readFileSync(inFile,'utf8').split(/\r?\n/).filter(Boolean);
  const recs=[];
  for(const line of lines){
    const obj = parseLine(line);
    if(!obj) continue;
    const r = {Q: obj.Q||obj.q||'', A: obj.A||obj.a||'', meta: obj.meta||{}};
    recs.push(r);
  }

  // 중복(3-gram) 측정: 전체 답변 tri-gram의 중복률
  const allTris = [];
  recs.forEach(r=> allTris.push(...ngrams(tokenizeKoEn(r.A),3)));
  const triCount = {};
  allTris.forEach(t=> triCount[t]=(triCount[t]||0)+1);
  const dup3Cnt = Object.values(triCount).filter(c=>c>1).reduce((x,y)=>x+y,0);
  const dup3Rate = allTris.length? dup3Cnt / allTris.length : 0;

  // 개별 스코어
  const per=[];
  const lensA=[], scores=[];
  const types = {};
  for(const r of recs){
    const s = scoreOne(r, docTopTokens);
    per.push({...r, ...s});
    lensA.push(s.lenA); scores.push(s.score);
    types[s.type]=(types[s.type]||0)+1;
  }

  const lenStats = quantiles(lensA);
  const scoreStats = quantiles(scores);
  const passTh = parseFloat(process.env.PASS_THRESHOLD || '0.82');
  const passRate = scores.length? scores.filter(x=>x>=passTh).length / scores.length : 0;

  const out = {
    meta: {
      inFile, total: recs.length, passThreshold: passTh,
      createdAt: new Date().toISOString()
    },
    diversity: {
      qtypeDist: Object.fromEntries(Object.entries(types).sort((a,b)=>b[1]-a[1])),
      ttrMean: mean(per.map(x=>x.ttr)),
      dup3Rate,
      lenA: { ...lenStats, mean: mean(lensA) },
      score: { ...scoreStats, mean: mean(scores), passRate, spark: sparkline(scores.map(x=>Math.round(x*100)/100)) }
    },
    per
  };

  if(outFile){
    fs.writeFileSync(outFile, JSON.stringify(out,null,2));
  } else {
    console.log(JSON.stringify(out,null,2));
  }
}
main();
