const fs = require('fs');
const { spawnSync } = require('child_process');
const path = require('path');

if(!fs.existsSync('docs')) fs.mkdirSync('docs');
if(!fs.existsSync('docs/sample.txt')){
  fs.writeFileSync('docs/sample.txt', '유지관리 계약서: 30일 사전통지, 99.9% SLA, 현재지번 면책, 조기해지 위약금 50%.');
}

function run(cmd, args, env){
  const r = spawnSync(cmd, args, {stdio:'inherit', env:Object.assign({}, process.env, env||{})});
  if(r.status!==0) process.exit(r.status||1);
}

const hasKey = !!(process.env.ANTHROPIC_API_KEY || (fs.existsSync('.env') && /ANTHROPIC_API_KEY=\S+/.test(fs.readFileSync('.env','utf8'))));

if(!hasKey){
  console.log('[INFO] Skip LLM call (no API key). Add ANTHROPIC_API_KEY then re-run.');
  process.exit(0);
}

// End-to-end:
// 1) generate -> outputs/run1.json
run('node', ['cli/generate.cjs','docs/sample.txt']);
// 2) validate schema
run('node', ['tools/validate-schema.cjs','outputs/run1.json']);

// Save quick summary
try{
  const j = JSON.parse(fs.readFileSync('outputs/run1.json','utf8'));
  const cnt = Array.isArray(j.qa_scenarios)? j.qa_scenarios.length : 0;
  console.log(`[OK] Generated ${cnt} QA scenarios`);
}catch(e){}
