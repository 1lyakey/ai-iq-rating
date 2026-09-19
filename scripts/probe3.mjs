const UA={'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36'};
async function txt(url){
  const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),10000);
  try{const r=await fetch(url,{headers:UA,signal:ctl.signal});clearTimeout(t);return r.ok?await r.text():'';}
  catch(e){clearTimeout(t);return '';}
}

// 1. LiveBench: ищем в JS-бандле ссылку на CSV
const idx=await txt('https://livebench.ai/');
const assets=[...idx.matchAll(/["'\/]([^"']*assets\/[^"']+\.js)/g)].map(m=>m[1]);
console.log('LiveBench assets:',assets);
for(const a of assets.slice(0,4)){
  const url=a.startsWith('http')?a:'https://livebench.ai/'+a.replace(/^\//,'');
  const js=await txt(url);
  const tables=[...new Set([...js.matchAll(/table[_\-0-9A-Za-z]*\.csv/g)].map(m=>m[0]))];
  const urls=[...new Set([...js.matchAll(/https?:\/\/[^"'\s]+\.csv/g)].map(m=>m[0]))];
  console.log(' in',url.slice(-40),'->',tables.slice(0,10),urls.slice(0,5));
}

// 2. SWE-bench: структура verified-оценок
const tr=await txt('https://api.github.com/repos/SWE-bench/experiments/git/trees/main?recursive=1');
const tree=JSON.parse(tr||'{"tree":[]}').tree||[];
const ver=tree.filter(x=>/^evaluation\/verified\//.test(x.path)&&/\.json$/.test(x.path));
console.log('\nSWE-bench verified files:',ver.length);
ver.map(x=>x.path).sort().slice(-12).forEach(p=>console.log('  ',p));