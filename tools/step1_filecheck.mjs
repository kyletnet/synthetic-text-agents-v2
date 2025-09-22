import fs from 'fs';
import path from 'path';

const NOW = new Date().toISOString();
const REPORT_DIR = path.join(process.cwd(), 'reports');

function walk(dir, acc=[]) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}
function exists(p){ try{ fs.accessSync(p); return true; } catch { return false; } }
function readJSON(p){
  try { return JSON.parse(fs.readFileSync(p,'utf8')); }
  catch(e){ return { __error: String(e) }; }
}
function detectExampleJSON() {
  const candidates = [
    '예제.json','예시.json','example.json','examples.json',
    ...walk(process.cwd()).filter(p => /[/\\](예제|예시|example)s?\.json$/i.test(p))
  ];
  for (const p of candidates) {
    if (exists(p)) return path.resolve(p);
  }
  return null;
}
function listJSONL(dir){
  if (!exists(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.toLowerCase().endsWith('.jsonl'))
    .map(f => path.join(dir, f))
    .sort((a,b)=>fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
}
function readJSONLProbe(p, max=50) {
  const lines = fs.readFileSync(p,'utf8').split(/\r?\n/).filter(Boolean);
  const probe = lines.slice(0, max);
  let ok=0, fail=0;
  for (const ln of probe) {
    try { JSON.parse(ln); ok++; } catch { fail++; }
  }
  return { total: lines.length, ok, fail };
}
function analyzeExample(json) {
  // 허용 구조:
  //  A) { chunks: [ {text:...}, ... ] }
  //  B) [ {text:...}, ... ]
  //  C) { docs: [...] } 등 확장 가능
  let chunks = null, shape='unknown', note=[];
  if (json && typeof json==='object' && Array.isArray(json.chunks)) {
    chunks = json.chunks; shape='object.chunks';
  } else if (Array.isArray(json)) {
    chunks = json; shape='array';
  } else if (json && typeof json==='object' && Array.isArray(json.docs)) {
    chunks = json.docs; shape='object.docs';
  }
  if (!chunks) return { valid:false, shape, count:0, notes:['chunks 배열 형태를 찾지 못함'] };

  const count = chunks.length;
  const samples = [];
  let empty=0;
  for (let i=0;i<count;i++){
    const c = chunks[i];
    const s = typeof c==='string' ? c : (c?.text ?? c?.content ?? '');
    if (!s || typeof s!=='string' || s.trim().length===0) empty++;
    const len = (s||'').length;
    if (i<3) samples.push({ i, len, preview: (s||'').slice(0,80).replace(/\s+/g,' ').trim() });
  }
  if (empty>0) note.push(`빈/누락 청크 ${empty}개`);
  // 간단 길이 지표
  const lens = chunks.map(c => {
    const s = typeof c==='string' ? c : (c?.text ?? c?.content ?? '');
    return (s||'').length;
  });
  const sum = lens.reduce((a,b)=>a+b,0);
  const avg = count ? Math.round(sum/count) : 0;
  const min = count ? Math.min(...lens) : 0;
  const max = count ? Math.max(...lens) : 0;

  return {
    valid:true, shape, count,
    avg_len: avg, min_len: min, max_len: max,
    sample: samples, notes: note
  };
}

function ensureDir(p){ fs.mkdirSync(p,{recursive:true}); }

function writeReadableMD(p, data){
  const lines = [];
  lines.push('Step 1 파일 점검 요약');
  lines.push('');
  lines.push(`생성 시각: ${NOW}`);
  lines.push('');
  lines.push('무엇을 확인했나요:');
  lines.push('- 예제.json 존재 및 구조');
  lines.push('- outputs/ 및 RUN_LOGS/의 JSONL 파싱 가능 여부');
  lines.push('- 다음 단계 진행 가능 여부');
  lines.push('');
  lines.push('핵심 결과:');
  lines.push(`- 예제 파일: ${data.example.found ? '존재' : '없음'}`);
  if (data.example.found) {
    const ex = data.example;
    lines.push(`  - 경로: ${ex.path}`);
    lines.push(`  - 구조 인식: ${ex.analysis.shape}`);
    lines.push(`  - 청크 개수: ${ex.analysis.count}`);
    lines.push(`  - 평균/최소/최대 길이: ${ex.analysis.avg_len}/${ex.analysis.min_len}/${ex.analysis.max_len}`);
    if (ex.analysis.notes?.length) lines.push(`  - 참고: ${ex.analysis.notes.join('; ')}`);
  }
  lines.push(`- outputs/ JSONL: ${data.outputs.files.length}개 (최근 파일 라인=${data.outputs.probe?.total ?? 0}, 파싱성공=${data.outputs.probe?.ok ?? 0}, 실패=${data.outputs.probe?.fail ?? 0})`);
  lines.push(`- RUN_LOGS/ JSONL: ${data.logs.files.length}개 (최근 파일 라인=${data.logs.probe?.total ?? 0}, 파싱성공=${data.logs.probe?.ok ?? 0}, 실패=${data.logs.probe?.fail ?? 0})`);
  lines.push('');
  lines.push('판정:');
  lines.push(`- ${data.ok_for_step2 ? 'STEP 2(해석/요약) 진행 가능' : '보완 필요: 예제.json이 없거나 구조 감지가 불안정, 혹은 JSONL 파싱 실패율 높음'}`);
  lines.push('');
  lines.push('다음 권장 액션:');
  if (!data.example.found) lines.push('- 예제.json을 프로젝트 루트에 두거나 파일명을 예제.json으로 맞춰주세요.');
  if (data.outputs.probe && data.outputs.probe.fail>0) lines.push('- outputs/*.jsonl 일부 줄이 손상되어 보입니다. 생성 루틴 재점검을 권장합니다.');
  if (data.logs.probe && data.logs.probe.fail>0) lines.push('- RUN_LOGS/*.jsonl 일부 줄이 손상되어 보입니다. 로깅 시 JSON 직렬화 확인이 필요합니다.');
  if (data.example.found && data.example.analysis.valid && data.example.analysis.count<4) lines.push('- 멀티지문 QA 목표라면 최소 4개 청크 준비가 필요합니다.');
  lines.push('');
  lines.push('참고:');
  lines.push('- 이 문서는 자동 생성되었으며, LLM 호출 없이 수행되었습니다.');
  fs.writeFileSync(p, lines.join('\n'), 'utf8');
}

function writeTechMD(p, data){
  const lines = [];
  lines.push('# STEP1_FILECHECK');
  lines.push('');
  lines.push(`- generated_at: ${NOW}`);
  lines.push(`- cwd: ${process.cwd()}`);
  lines.push('');
  lines.push('## inputs');
  lines.push(`- example_found: ${data.example.found}`);
  if (data.example.found){
    lines.push(`- example_path: ${data.example.path}`);
    lines.push(`- shape: ${data.example.analysis.shape}`);
    lines.push(`- chunks: ${data.example.analysis.count}`);
    lines.push(`- avg_len: ${data.example.analysis.avg_len}`);
    lines.push(`- min_len: ${data.example.analysis.min_len}`);
    lines.push(`- max_len: ${data.example.analysis.max_len}`);
    for (const s of (data.example.analysis.sample||[])) {
      lines.push(`- sample_${s.i}: len=${s.len} preview="${s.preview}"`);
    }
    if (data.example.analysis.notes?.length) lines.push(`- notes: ${data.example.analysis.notes.join('; ')}`);
  }
  lines.push('');
  lines.push('## outputs_probe');
  lines.push(`- files: ${data.outputs.files.length}`);
  if (data.outputs.files[0]) lines.push(`- latest: ${data.outputs.files[0]}`);
  if (data.outputs.probe) lines.push(`- latest_lines: ${data.outputs.probe.total}, ok: ${data.outputs.probe.ok}, fail: ${data.outputs.probe.fail}`);
  lines.push('');
  lines.push('## run_logs_probe');
  lines.push(`- files: ${data.logs.files.length}`);
  if (data.logs.files[0]) lines.push(`- latest: ${data.logs.files[0]}`);
  if (data.logs.probe) lines.push(`- latest_lines: ${data.logs.probe.total}, ok: ${data.logs.probe.ok}, fail: ${data.logs.probe.fail}`);
  lines.push('');
  lines.push('## decision');
  lines.push(`- ok_for_step2: ${data.ok_for_step2}`);
  fs.writeFileSync(p, lines.join('\n'), 'utf8');
}

(function main(){
  ensureDir(REPORT_DIR);

  // 1) 예제.json 탐색 및 분석
  const exPath = detectExampleJSON();
  let ex = { found:false, path:null, analysis:{ valid:false, shape:'unknown', count:0, notes:['not found'] } };
  if (exPath) {
    const raw = readJSON(exPath);
    if (raw && !raw.__error){
      const an = analyzeExample(raw);
      ex = { found:true, path:exPath, analysis:an };
    } else {
      ex = { found:true, path:exPath, analysis:{ valid:false, shape:'parse_error', count:0, notes:[raw.__error||'parse error'] } };
    }
  }

  // 2) outputs, RUN_LOGS 요약
  const outFiles = listJSONL(path.join(process.cwd(),'outputs'));
  const logFiles = listJSONL(path.join(process.cwd(),'RUN_LOGS'));
  const outProbe = outFiles[0] ? readJSONLProbe(outFiles[0]) : null;
  const logProbe = logFiles[0] ? readJSONLProbe(logFiles[0]) : null;

  // 3) 판정 로직(보수적)
  // - 예제.json 존재 + 분석 valid
  // - JSONL 파싱 실패율이 크지 않음
  const outOK = !outProbe || (outProbe.fail <= Math.max(1, Math.floor(outProbe.total*0.05)));
  const logOK = !logProbe || (logProbe.fail <= Math.max(1, Math.floor(logProbe.total*0.05)));
  const ok_for_step2 = !!(ex.found && ex.analysis.valid && outOK && logOK);

  const data = {
    example: ex,
    outputs: { files: outFiles, probe: outProbe },
    logs: { files: logFiles, probe: logProbe },
    ok_for_step2
  };

  // 4) 리포트 쓰기 (사람용, 기술용, JSON)
  writeReadableMD(path.join(REPORT_DIR, '_STEP1_FILECHECK_READABLE.md'), data);
  writeTechMD(path.join(REPORT_DIR, '_STEP1_FILECHECK.md'), data);
  fs.writeFileSync(path.join(REPORT_DIR, '_STEP1_FILECHECK.json'), JSON.stringify(data,null,2), 'utf8');

  // 5) 콘솔 요약
  const status = ok_for_step2 ? 'READY_FOR_STEP2' : 'ACTION_NEEDED';
  console.log(`[STEP1] status=${status}`);
  if (!ex.found) console.log(' - 예제.json을 찾지 못했습니다. 루트에 예제.json을 두거나 파일명을 맞춰주세요.');
  if (ex.found && !ex.analysis.valid) console.log(` - 예제.json 구조 감지 실패(shape=${ex.analysis.shape}). chunks 배열 형태인지 확인하세요.`);
  if (outProbe && outProbe.fail>0) console.log(` - outputs 최신 JSONL 파싱 실패 줄: ${outProbe.fail}/${outProbe.total}`);
  if (logProbe && logProbe.fail>0) console.log(` - RUN_LOGS 최신 JSONL 파싱 실패 줄: ${logProbe.fail}/${logProbe.total}`);
})();
