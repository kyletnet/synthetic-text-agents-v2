const https = require('https');
const targets = ['api.anthropic.com', 'api.openai.com'];
function hit(host){
  return new Promise(res=>{
    const req = https.request({method:'GET', host, timeout:3000, path:'/'}, r=>{
      res({host, status: r.statusCode||0});
    });
    req.on('error', e=>res({host, error: String(e.code||e.message)}));
    req.on('timeout', ()=>{ req.destroy(); res({host, error:'TIMEOUT'}); });
    req.end();
  });
}
(async()=>{
  const out = await Promise.all(targets.map(hit));
  console.log('Egress check:', out);
  const reachable = out.every(r => (r.status===404 || r.status===421) && !r.error);
  if(!reachable) process.exit(1);
})();
