const UA={'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36'};
async function txt(url,ms=12000){
  const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),ms);
  try{const r=await fetch(url,{headers:UA,signal:ctl.signal});clearTimeout(t);return {s:r.status,b:r.ok?await r.text():''};}
  catch(e){clearTimeout(t);return {s:0,b:'',e:e.name};}
}
const tries=[
  ['OpenRouter rankings (jina)','https://r.jina.ai/https://openrouter.ai/rankings'],
  ['ARC Prize (jina)','https://r.jina.ai/https://arcprize.org/leaderboard'],
  ['Epoch dashboard (jina)','https://r.jina.ai/https://epoch.ai/data/ai-benchmarking-dashboard'],
  ['SuperCLUE api','https://www.superclueai.com/api/leaderboard'],
  ['Epoch GH','https://api.github.com/repos/epoch-research/epoch-ai/git/trees/main?recursive=1'],
  ['HF OpenLLM rows','https://datasets-server.huggingface.co/rows?dataset=open-llm-leaderboard%2Fresults&config=default&split=train&offset=0&length=3']
];
for(const [name,u] of tries){
  const r=await txt(u);
  console.log(`${name}: ${r.s||r.e} ${r.b?('| '+r.b.replace(/\s+/g,' ').slice(0,180)):''}`);
}