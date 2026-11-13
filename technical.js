'use strict';
(() => {
 const $=s=>document.querySelector(s), fmt=(n,d=2)=>Number.isFinite(n)?n.toLocaleString('en-US',{maximumFractionDigits:d,minimumFractionDigits:d}):'—';
 let security=null, treasury=null, fred=null, rateRenderer=null, archiveError='';
 const sma=(a,n)=>a.map((_,i)=>i+1<n?null:a.slice(i-n+1,i+1).reduce((s,v)=>s+v,0)/n);
 function ema(a,n){let result=Array(a.length).fill(null), seed=[] ,last=null;for(let i=0;i<a.length;i++){if(!Number.isFinite(a[i]))continue;if(last===null){seed.push(a[i]);if(seed.length===n)last=seed.reduce((s,v)=>s+v,0)/n;}else last=a[i]*2/(n+1)+last*(1-2/(n+1));result[i]=last;}return result;}
 function indicators(bars){const p=bars.map(b=>b.close), n=p.length, s20=sma(p,20),s50=sma(p,50),s200=sma(p,200), e12=ema(p,12), e26=ema(p,26), macd=p.map((_,i)=>e12[i]===null||e26[i]===null?null:e12[i]-e26[i]), signal=ema(macd,9);let rsi=null;
 if(n>=15){let g=0,l=0;for(let i=1;i<=14;i++){const d=p[i]-p[i-1];g+=Math.max(0,d)/14;l+=Math.max(0,-d)/14;}for(let i=15;i<n;i++){const d=p[i]-p[i-1];g=(g*13+Math.max(0,d))/14;l=(l*13+Math.max(0,-d))/14;}rsi=l===0?(g===0?50:100):100-100/(1+g/l);}
 const vols=bars.slice(-21,-1).map(b=>b.volume), avg=vols.length===20&&vols.every(Number.isFinite)?vols.reduce((s,v)=>s+v,0)/20:null;
 return {s20,s50,s200,macd,signal,rsi,relativeVolume:avg>0&&Number.isFinite(bars.at(-1)?.volume)?bars.at(-1).volume/avg:null};}
 function canvas(id,height){const el=$(id),w=Math.max(240,el.getBoundingClientRect().width),h=height,dpr=Math.min(window.devicePixelRatio||1,2);el.width=w*dpr;el.height=h*dpr;const ctx=el.getContext('2d');ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);ctx.font='10px ui-monospace,monospace';return {ctx,w,h};}
 function render(x){security=x;const bars=(x?.history||[]).filter(b=>/^\d{4}-\d{2}-\d{2}$/.test(b.date)&&Number.isFinite(b.close)&&b.close>0), n=Number($('#priceRange').value), start=n?Math.max(0,bars.length-n):0, shown=bars.slice(start), ind=indicators(bars), {ctx,w,h}=canvas('#priceCanvas',248),v=canvas('#volumeCanvas',96);
 $('#priceCoverage').textContent=shown.length?`${shown[0].date} → ${shown.at(-1).date} · ${shown.length} / ${bars.length} loaded sessions · unadjusted close (USD)`:'No verified history available';
 if(shown.length<2){ctx.fillStyle='#a1b3cb';ctx.fillText('Insufficient observed bars for a chart',16,100);$('#technicalSummary').textContent='Signals unavailable: at least two valid price observations are required.';return;}
 const overlays=[ind.s20,ind.s50,ind.s200].map(a=>a.slice(start)),values=[...shown.map(b=>b.close),...overlays.flat().filter(Number.isFinite)],lo=Math.min(...values),hi=Math.max(...values),pad=(hi-lo||1)*.1,min=lo-pad,max=hi+pad;
 const X=i=>12+i*(w-70)/(shown.length-1),Y=p=>15+(max-p)/(max-min)*(h-45);
 ctx.strokeStyle='#24364b';ctx.fillStyle='#a1b3cb';for(let i=0;i<5;i++){const value=min+(max-min)*i/4,y=Y(value);ctx.beginPath();ctx.moveTo(12,y);ctx.lineTo(w-56,y);ctx.stroke();ctx.fillText(fmt(value),w-52,y+3);}
 function line(values,color,dash=[]){ctx.strokeStyle=color;ctx.lineWidth=1.7;ctx.setLineDash(dash);ctx.beginPath();let active=false;values.forEach((p,i)=>{if(!Number.isFinite(p)){active=false;return;}active?ctx.lineTo(X(i),Y(p)):ctx.moveTo(X(i),Y(p));active=true;});ctx.stroke();ctx.setLineDash([]);}
 line(shown.map(b=>b.close),'#58edd4');line(overlays[0],'#e3b4ff',[4,3]);line(overlays[1],'#ffcc66',[8,3]);line(overlays[2],'#58baff',[2,3]);ctx.fillStyle='#a1b3cb';ctx.fillText(shown[0].date,12,h-5);ctx.textAlign='right';ctx.fillText(shown.at(-1).date,w-56,h-5);
 const volumes=shown.map(b=>b.volume).filter(Number.isFinite),cap=Math.max(1,...volumes);v.ctx.fillStyle='#a1b3cb';v.ctx.fillText(`VOLUME · max ${fmt(cap/1e6,1)}M`,12,11);
 shown.forEach((b,i)=>{if(!Number.isFinite(b.volume))return;v.ctx.fillStyle=i>0&&b.close<shown[i-1].close?'#ff91b2':'#30e5a3';const bh=b.volume/cap*62;v.ctx.fillRect(X(i),89-bh,Math.max(1,(w-70)/shown.length*.75),bh);});
 const last=bars.at(-1), s20=ind.s20.at(-1),s50=ind.s50.at(-1),s200=ind.s200.at(-1),m=ind.macd.at(-1),sig=ind.signal.at(-1),r=ind.rsi;
 const trend=s20===null||s50===null?'Trend unavailable: 50 sessions required.':last.close>s20&&s20>s50?'Uptrend alignment: close > SMA20 > SMA50.':last.close<s20&&s20<s50?'Downtrend alignment: close < SMA20 < SMA50.':'Mixed trend: close and moving averages are not aligned.';
 const momentum=r===null?'RSI unavailable: 15 closes required.':`RSI14 ${fmt(r,1)}: ${r>=70?'strong / extended momentum':r<=30?'weak / oversold momentum':'within the 30–70 range'}.`;
 const macd=m===null||sig===null?'MACD signal unavailable: 34 closes required.':`MACD ${fmt(m)} vs signal ${fmt(sig)}: ${m>sig?'positive':m<sig?'negative':'flat'} histogram (${fmt(m-sig)}).`;
 const rv=ind.relativeVolume;$('#technicalSummary').textContent=[trend,momentum,macd,rv===null?'Relative volume unavailable: 21 valid volume sessions required.':`Relative volume ${fmt(rv)}× the prior 20-session mean.`, `As of ${last.date}${x.status==='prior_verified_cached'?' · retained previous observation':''}. Descriptive signals; no predicted return.`].join(' ');
 const old=$('#companyMetrics');old.innerHTML=[['20D RETURN',Number.isFinite(x.indicators?.return_20d)?fmt(x.indicators.return_20d)+'%':'—'],['REALIZED VOL 20D',Number.isFinite(x.indicators?.realized_vol_20d)?fmt(x.indicators.realized_vol_20d)+'%':'—'],['SMA20',s20],['SMA50',s50],['SMA200',s200],['WILDER RSI14',r],['MACD / SIGNAL',m===null||sig===null?'—':fmt(m)+' / '+fmt(sig)],['RELATIVE VOLUME',rv===null?'—':fmt(rv)+'×']].map(([k,val])=>`<div><small>${k}</small><b>${typeof val==='string'?val:fmt(val)}</b></div>`).join('');
 }
 function applyRates(){if(!rateRenderer)return;const source=$('#curveSource').value, full=source==='fred'?fred:treasury, all=full?.history||[];
 if(!all.length){rateRenderer({history:[]});$('#curveHistoryStatus').textContent=source==='fred'?(archiveError||'FRED history loading…'):'Treasury feed unavailable';return;}
 const range=$('#curveRange').value,first=all[0].date,last=all.at(-1).date;for(const id of ['#curveFrom','#curveTo']){$(id).min=first;$(id).max=last;}
 if(range!=='custom'){const end=new Date(last+'T00:00:00Z');if(Number(range))end.setUTCMonth(end.getUTCMonth()-Number(range));$('#curveFrom').value=Number(range)?(end.toISOString().slice(0,10)<first?first:end.toISOString().slice(0,10)):first;$('#curveTo').value=last;}
 const from=$('#curveFrom').value,to=$('#curveTo').value, chosen=all.filter(r=>r.date>=from&&r.date<=to);$('#curveHistoryStatus').textContent=from>to?'Start date must precede end date.':chosen.length?`${chosen.length.toLocaleString()} observed dates · archive ${first} → ${last}${full.status==='partial_cached'?' · partial / cached series':''} · source collected ${full.collected_at?full.collected_at.slice(0,10):'see snapshot'}`:'No observations in this date range.';
 rateRenderer({...full,history:chosen,as_of:chosen.at(-1)?.date});
 const link=$('.curve-stats .text-link');link.href=full.source_url;link.textContent=source==='fred'?'Federal Reserve / FRED source ↗':'U.S. Treasury source ↗';$('.curve-stats .eyebrow').textContent=source==='fred'?'FEDERAL RESERVE H.15 / FRED':'OFFICIAL U.S. TREASURY';
 }
 window.MDX_TECH={render,redraw:()=>render(security),indicators, setTreasury:(t,fn)=>{treasury=t;rateRenderer=fn;applyRates();}};
 document.addEventListener('DOMContentLoaded',()=>{
 $('#priceRange').addEventListener('change',()=>render(security));for(const id of ['#curveSource','#curveRange'])$(id).addEventListener('change',applyRates);for(const id of ['#curveFrom','#curveTo'])$(id).addEventListener('change',()=>{$('#curveRange').value='custom';applyRates();});
 fetch('data/treasury-history.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json();}).then(data=>{if(data.schema!=='market-dex.treasury-history.v1'||!Array.isArray(data.history)||!data.history.length)throw Error('Invalid archive');fred=data;applyRates();}).catch(()=>{archiveError='FRED history unavailable. Select the original U.S. Treasury feed.';applyRates();});
 });
})();
