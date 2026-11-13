(() => {
 const stage=document.getElementById('expStage'), frame=document.getElementById('expFrame'), status=document.getElementById('expLoading'), title=document.getElementById('expStageTitle'), link=document.getElementById('expPopout');
 if(!stage||!frame)return;
 const allowed=new Set(['sp500-roulette.html','sector-galaxy.html']);
 document.querySelectorAll('.exp-launch').forEach(btn=>btn.addEventListener('click',()=>{
  const file=btn.dataset.experiment;if(!allowed.has(file))return;
  title.textContent=btn.dataset.title||'Experimental View';
  const path='experiments/'+file;link.href=path;
  stage.hidden=false;status.hidden=false;status.textContent='Loading original visualization…';
  frame.title=title.textContent;frame.src=path;
  stage.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
 }));
 frame.addEventListener('load',()=>{status.hidden=true});
 document.getElementById('expClose')?.addEventListener('click',()=>{
  frame.src='about:blank';stage.hidden=true;
  document.getElementById('experiments')?.scrollIntoView({block:'start'});
 });
})();