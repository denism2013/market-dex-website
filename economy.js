'use strict';
(() => {
 let snapshot=null,selected='CPIAUCSL',group='All',loading=null;
 const $=s=>document.querySelector(s), number=(n,d=2)=>Number.isFinite(n)?n.toLocaleString('en-US',{maximumFractionDigits:d,minimumFractionDigits:d}):'—';
 function node(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;}
 function label(series,date){if(!date)return 'Unavailable';if(series.frequency==='Quarterly')return date.slice(0,4)+' Q'+(Math.floor((Number(date.slice(5,7))-1)/3)+1);if(series.frequency==='Monthly')return new Date(date+'T00:00:00Z').toLocaleDateString('en-US',{month:'short',year:'numeric',timeZone:'UTC'});return date;}
 function stale(s){if(!s.latest)return true;const age=(Date.now()-Date.parse(s.latest.date+'T00:00:00Z'))/86400000;return age>({Daily:10,Weekly:21,Monthly:85,Quarterly:180}[s.frequency]||90);}
 function value(s){return s.latest?number(s.latest.value,s.id==='PAYEMS'||s.id==='ICSA'||s.id==='JTSJOL'||s.id==='HOUST'?0:2):'—';}
 function render(){
  if(!snapshot)return;
  const all=snapshot.series||[],shown=all.filter(s=>group==='All'||s.group===group),host=$('#economyCards');host.replaceChildren();
  for(const s of shown){const card=node('button','economy-card glass');card.type='button';card.setAttribute('aria-pressed',String(s.id===selected));card.append(node('span','eyebrow',s.group.toUpperCase()+' / '+s.frequency.toUpperCase()),node('h3','',s.title),node('strong','economy-value',value(s)),node('span','economy-unit',s.display_units),node('span','economy-period','Reference period · '+label(s,s.latest?.date)));
   const change=s.latest&&s.previous?s.latest.value-s.previous.value:null;
   const deltaUnit=s.transformation==='level'?(s.raw_units==='Percent'?'pp':s.raw_units):s.transformation==='change'?'thousand':'pp';
   card.append(node('small','economy-change',change===null?'Prior comparable observation unavailable':(change>=0?'+':'')+number(change)+' '+deltaUnit+' vs prior reading'));
   if(s.status!=='observed'||stale(s))card.append(node('span','economy-warning',s.status==='retained_previous'?'Last verified snapshot retained':!s.latest?'Data unavailable':'Older reference period · check publisher'));
   card.addEventListener('click',()=>{selected=s.id;render();});host.append(card);
  }
  const count=all.filter(s=>s.latest).length;
  $('#economyStatus').textContent=count+'/'+all.length+' source-backed series · snapshot checked '+new Date(snapshot.generated_at).toLocaleString('en-US',{timeZone:'America/New_York',timeZoneName:'short'})+' · '+(snapshot.warnings?.length||0)+' fetch warnings';
  const s=all.find(s=>s.id===selected)||shown[0];if(!s)return;
  $('#economyChartTitle').textContent=s.title+' · '+s.display_units;
  $('#economyChartMeta').textContent='Reference period '+label(s,s.latest?.date)+' · '+s.publisher+' via FRED · '+s.seasonal_adjustment;
  const link=$('#economySeriesLink');link.href=s.source_url;link.textContent='Inspect '+s.id+' on FRED ↗';
  const transformation={yoy:'100 × (index / index 12 months earlier − 1).',mom:'100 × (level / prior month level − 1).',annualized:'100 × ((real GDP / prior quarter real GDP)⁴ − 1).',change:'Current payroll level minus the prior calendar month, in thousands of persons.',level:'Published level, without an additional transformation.'};
  $('#economyMethod').textContent=transformation[s.transformation]+' Raw series: '+s.raw_units+'. '+(s.overlapping_revisions_since_previous_snapshot===null?'First snapshot; revision comparison unavailable.':s.overlapping_revisions_since_previous_snapshot+' overlapping observations changed since the preceding snapshot.')+' Data can be revised; charts use the latest collected vintage.';
  $('#economyCollected').textContent='Series last collected '+(s.collected_at?new Date(s.collected_at).toLocaleString('en-US',{timeZone:'America/New_York',timeZoneName:'short'}):'never')+'. Checked '+(s.checked_at||'unknown')+' · Source updated '+(s.source_updated_at||'unknown')+' · Next scheduled release '+(s.next_release_date||'unknown')+' · '+({awaiting_scheduled_release:'Awaiting next scheduled release',stale_reference_period:'Older reference period: check publisher',source_unavailable:'Source unavailable: showing dated cache',latest_fetched_release_schedule_unknown:'Latest fetched; release schedule not confirmed'}[s.freshness]||'See observation date')+'. '+(s.status==='retained_previous'?'Current fetch failed; the previous verified history remains visible.':'');
  draw(s);
  const tbody=$('#economyTableBody');tbody.replaceChildren();for(const p of [...s.display_history].slice(-12).reverse()){const tr=node('tr');tr.append(node('td','',label(s,p.date)),node('td','',number(p.value)),node('td','',s.display_units));tbody.append(tr);}
 }
 function draw(s){const canvas=$('#economyCanvas');if(!canvas)return;const ctx=canvas.getContext('2d'),w=Math.max(260,canvas.getBoundingClientRect().width),h=280,dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=w*dpr;canvas.height=h*dpr;ctx.scale(dpr,dpr);ctx.font='11px ui-monospace,monospace';ctx.clearRect(0,0,w,h);const rows=s.display_history.slice(-({Daily:500,Weekly:156,Monthly:60,Quarterly:24}[s.frequency]||60));
  if(rows.length<2){ctx.fillStyle='#a1b3cb';ctx.fillText('No validated history available',20,120);$('#economyChartReadout').textContent='History unavailable.';return;}
  let lo=Math.min(...rows.map(p=>p.value)),hi=Math.max(...rows.map(p=>p.value)),pad=(hi-lo||1)*.12;lo-=pad;hi+=pad;
  const first=Date.parse(rows[0].date),last=Date.parse(rows.at(-1).date),X=p=>16+(Date.parse(p.date)-first)/(last-first)*(w-88),Y=v=>16+(hi-v)/(hi-lo)*(h-52);
  ctx.strokeStyle='#27374d';ctx.fillStyle='#98afc8';for(let i=0;i<5;i++){const n=lo+(hi-lo)*i/4;ctx.beginPath();ctx.moveTo(16,Y(n));ctx.lineTo(w-66,Y(n));ctx.stroke();ctx.fillText(number(n,1),w-60,Y(n)+3);}
  ctx.strokeStyle='#58edd4';ctx.lineWidth=2;ctx.beginPath();rows.forEach((p,i)=>i?ctx.lineTo(X(p),Y(p.value)):ctx.moveTo(X(p),Y(p.value)));ctx.stroke();ctx.fillStyle='#a1b3cb';ctx.fillText(label(s,rows[0].date),16,h-8);ctx.textAlign='right';ctx.fillText(label(s,rows.at(-1).date),w-66,h-8);ctx.textAlign='left';
  const read=p=>label(s,p.date)+' · '+number(p.value)+' '+s.display_units;
  $('#economyChartReadout').textContent=read(rows.at(-1));canvas.onpointermove=e=>{const rect=canvas.getBoundingClientRect(),t=first+Math.max(0,Math.min(1,(e.clientX-rect.left-16)/(w-88)))*(last-first),p=rows.reduce((a,b)=>Math.abs(Date.parse(b.date)-t)<Math.abs(Date.parse(a.date)-t)?b:a);$('#economyChartReadout').textContent=read(p);};canvas.onpointerleave=()=>$('#economyChartReadout').textContent=read(rows.at(-1));
 }
 async function load(force=false){if(loading)return loading;loading=(async()=>{const status=$('#economyStatus');try{status.textContent='Checking published economic snapshot…';const r=await fetch('data/economy.json'+(force?'?check='+Date.now():''),{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);const data=await r.json();if(data.schema!=='market-dex.economy.v1'||!Array.isArray(data.series))throw Error('Invalid snapshot');snapshot=data;render();}catch{status.textContent=snapshot?'Refresh unavailable; the loaded verified snapshot remains visible.':'Economic snapshot unavailable. Use the official source links below.';}finally{loading=null;}})();return loading;}
 document.addEventListener('DOMContentLoaded',()=>{if(!$('#economy'))return;$('#economyRefresh').addEventListener('click',()=>load(true));$('#economyFilter').addEventListener('change',e=>{group=e.target.value;if(!snapshot?.series.some(s=>s.id===selected&&(group==='All'||s.group===group)))selected=snapshot?.series.find(s=>group==='All'||s.group===group)?.id;render();});if(location.hash==='#economy')load();});
 window.addEventListener('mdx:view-changed',e=>{if(e.detail==='economy'){if(!snapshot)load();else requestAnimationFrame(render);}});
 let timer;window.addEventListener('resize',()=>{clearTimeout(timer);timer=setTimeout(()=>{if(document.documentElement.dataset.view==='economy'&&snapshot)render();},150);});
})();
