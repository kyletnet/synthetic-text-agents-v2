export function tokenize(s){
  return String(s||'').toLowerCase()
    .replace(/[^a-z0-9\s]/gi,' ')
    .split(/\s+/).filter(Boolean);
}
export function jaccard(a,b){
  const A=new Set(tokenize(a)), B=new Set(tokenize(b));
  if(!A.size && !B.size) return 1;
  let inter=0; for(const t of A) if(B.has(t)) inter++;
  const uni=A.size+B.size-inter; return uni? inter/uni : 0;
}
export function alignmentScore(answer,snippet){ return jaccard(answer,snippet); }
