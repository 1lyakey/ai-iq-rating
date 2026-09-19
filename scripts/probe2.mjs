const UA={'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36'};
async function j(url){
  const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),9000);
  try{const r=await fetch(url,{headers:UA,signal:ctl.signal});clearTimeout(t);
    return {status:r.status,body:r.ok?await r.text():''};
  }catch(e){clearTimeout(t);return {status:0,body:'',err:e.name};}
}

// 1. SWE-bench experiments repo (результаты в JSON)
const sw=await j('https://api.github.com/repos/SWE-bench/experiments/git/trees/main?recursive=1');
if(sw.status===200){
  const t=JSON.parse(sw.body);
  const js=(t.tree||[]).filter(x=>/results\.json$/.test(x.path));
  console.log('SWE-bench results files:',js.length);
  js.slice(0,8).forEach(x=>console.log('  ',x.path));
}else console.log('SWE-bench tree:',sw.status||sw.err);

// 2. MathArena repo
const ma=await j('https://api.github.com/repos/eth-sri/matharena/git/trees/main?recursive=1');
if(ma.status===200){
  const t=JSON.parse(ma.body);
  const f=(t.tree||[]).filter(x=>/\.(json|csv)$/.test(x.path)).slice(0,8);
  console.log('MathArena files:',(t.tree||[]).length);
  f.forEach(x=>console.log('  ',x.path));
}else console.log('MathArena tree:',ma.status||ma.err);

// 3. LiveBench repo (master/main)
for(const b of ['main','master']){
  const l=await j(`https://api.github.com/repos/LiveBench/LiveBench/git/trees/${b}?recursive=1`);
  console.log(`LiveBench ${b}:`,l.status||l.err);
  if(l.status===200){const t=JSON.parse(l.body);const f=(t.tree||[]).filter(x=>/\.csv$/.test(x.path)).slice(0,6);f.forEach(x=>console.log('  ',x.path));break;}
}

// 4. ARC Prize data endpoint
for(const u of ['https://arcprize.org/api/leaderboard','https://arcprize.org/data/leaderboard.json','https://arcprize.org/api/leaderboard.json']){
  const r=await j(u);
  console.log('ARC',u.replace('https://arcprize.org',''),':',r.status||r.err,r.body?r.body.slice(0,80).replace(/\s+/g,' '):'');
}

// 5. HF datasets-server (open LLM leaderboard)
const hf=await j('https://datasets-server.huggingface.co/splits?dataset=open-llm-leaderboard%2Fresults');
console.log('HF splits:',hf.status||hf.err,hf.body?hf.body.slice(0,200):'');