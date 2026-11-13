'use strict';
(()=>{
const $=id=>document.getElementById(id);
let report=null,marketContext=null,controller=null;
const encode=s=>new Blob([s],{type:'text/plain;charset=utf-8'});
const download=(text,name,type='text/plain;charset=utf-8')=>{const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)};
function progress(s){$('status').textContent=s;}
function updateCount(){$('count').textContent=$('transcript').value.length.toLocaleString()+' characters';}
const ticker=()=>$('ticker').value.trim().toUpperCase().replace(/[^A-Z0-9.^-]/g,'').slice(0,12);
async function refreshMarket(){
 const symbol=ticker();marketContext=null;
 if(!$('market').checked){$('marketPreview').textContent='Public quote context disabled.';return;}
 if(!symbol){$('marketPreview').textContent='Enter a ticker to look up the existing dated market snapshot.';return;}
 $('marketPreview').textContent='Checking published MARKET-DEX snapshot…';
 try{
  const response=await fetch('../data/market-preview.json',{cache:'no-store'});
  if(!response.ok)throw Error('snapshot unavailable');
  const json=await response.json();
  const q=json?.markets?.[symbol];
  if(!q){$('marketPreview').textContent='No curated MARKET-DEX observation for '+symbol+'. Analysis can proceed without market context.';return;}
  marketContext={symbol,as_of:q.as_of,close:q.close,change_pct:q.change_pct,currency:q.currency,provider:q.provider,price_basis:q.price_basis};
  $('marketPreview').textContent=symbol+' · '+q.as_of+' close '+q.close+' '+(q.currency||'USD')+' · day change '+q.change_pct+'% · EOD (not event return)';
 }catch{$('marketPreview').textContent='Public market snapshot unavailable; transcript analysis can still proceed.';}
}
let debounce;
$('ticker').addEventListener('input',()=>{clearTimeout(debounce);debounce=setTimeout(refreshMarket,300)});
$('market').addEventListener('change',refreshMarket);
$('transcript').addEventListener('input',updateCount);
$('transcriptFile').addEventListener('change',async()=>{
 const f=$('transcriptFile').files?.[0];if(!f)return;
 if(!/\.txt$/i.test(f.name)||f.size>180000){progress('Only .txt transcripts up to 180 KB are supported. For PDFs or DOCX, paste extracted text.');$('transcriptFile').value='';return;}
 try{$('transcript').value=await f.text();updateCount();progress('Text loaded into this tab only.');}catch{progress('Could not read this local file.');}
 $('transcriptFile').value='';
});
function clear(){
 if(controller){controller.abort();controller=null;}
 $('transcript').value='';$('ticker').value='';$('period').value='';$('transcriptFile').value='';
 $('report').textContent='No analysis yet. Results are never saved to local storage or the repository.';$('report').classList.add('placeholder');
 $('verdictText').textContent='Upload or paste a transcript to generate a source-constrained assessment.';$('state').textContent='AWAITING INPUT';$('download').disabled=true;$('downloadJson').disabled=true;report=null;marketContext=null;updateCount();progress('Session cleared.');refreshMarket();
}
$('clear').addEventListener('click',clear);
$('analyze').addEventListener('click',async()=>{
 if(controller)return;
 const text=$('transcript').value.trim(), symbol=ticker(),period=$('period').value.trim();
 if(!symbol||!period){progress('Enter a ticker and reporting period.');return;}
 if(text.length<500||text.length>180000){progress('Provide 500–180,000 transcript characters.');return;}
 const btn=$('analyze');btn.disabled=true;controller=new AbortController();progress('Analyzing transcript. Longer calls may require multiple passes…');$('state').textContent='PROCESSING';
 try{
 const response=await fetch('../api/earnings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticker:symbol,period,transcript:text,market:$('market').checked&&marketContext?.symbol===symbol?marketContext:null}),signal:controller.signal,cache:'no-store',credentials:'omit'});
 const out=await response.json().catch(()=>({error:'Unexpected server response.'}));
 if(!response.ok)throw Error(out.error||'Analysis failed.');
 if(typeof out.analysis!=='string'||!out.analysis.trim())throw Error('No analysis returned.');
 report={ticker:symbol,period,analysis:out.analysis,market_context:out.market_context||null,generated_at:new Date().toISOString(),methodology:'Market-Dex Earnings Intelligence'};
 $('report').textContent=out.analysis;$('report').classList.remove('placeholder');
 $('verdictText').textContent=out.analysis.split('\n').filter(Boolean).slice(0,5).join(' ').slice(0,1200);
 $('state').textContent='COMPLETED';$('download').disabled=false;$('downloadJson').disabled=false;progress('Analysis complete. The report lives only in this tab until downloaded.');
 }catch(e){$('state').textContent='NOT COMPLETED';progress(e.name==='AbortError'?'Analysis cancelled.':String(e.message||'Analysis failed.'))}
 finally{controller=null;btn.disabled=false;}
});
$('download').addEventListener('click',()=>{if(report)download(report.analysis,'market-dex-'+report.ticker+'-'+report.period.replace(/[^a-z0-9-]/gi,'_')+'.txt')});
$('downloadJson').addEventListener('click',()=>{if(report)download(JSON.stringify(report,null,2),'market-dex-'+report.ticker+'-earnings.json','application/json')});
window.addEventListener('pagehide',()=>{if(controller)controller.abort();report=null;marketContext=null;});
refreshMarket();
})();