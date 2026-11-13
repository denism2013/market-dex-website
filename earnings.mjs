import {prepareTranscript,noteBatches,reportLines,bytes,PART_BYTES,MAX_TRANSCRIPT_BYTES} from './earnings-core.mjs';
const $=id=>document.getElementById(id);let controller=null,session=0,report=null,sources=new Map(),pdfTask=null,objectURLs=new Set(),reading=false;
const status=(text,error=false)=>{$('analysisStatus').textContent=text;$('analysisStatus').classList.toggle('error',error);};
function busy(value){$('runAnalysis').disabled=value;$('cancelAnalysis').hidden=!value;$('analysisProgress').hidden=!value;for(const id of ['company','ticker','quarter','transcript','transcriptFile','consent'])$(id).disabled=value;}
function discardReport(){report=null;sources.clear();$('report').replaceChildren();$('reportPanel').hidden=true;}
function clearSession(){session++;controller?.abort();controller=null;pdfTask?.destroy().catch(()=>{});pdfTask=null;reading=false;discardReport();$('earningsForm').reset();$('textCount').textContent='0 characters · not uploaded';$('fileStatus').textContent='';for(const url of objectURLs)URL.revokeObjectURL(url);objectURLs.clear();busy(false);status('Session cleared. Transcript, extracted evidence and report removed from this workspace.');}
$('clearSession').addEventListener('click',clearSession);
window.addEventListener('pagehide',clearSession);
window.addEventListener('pageshow',e=>{if(e.persisted)clearSession();});
window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===window.parent&&e.data?.type==='mdx:clear-session')clearSession();});
$('cancelAnalysis').addEventListener('click',()=>{session++;controller?.abort();controller=null;busy(false);status('Analysis cancelled. Your input is still in this tab; use Clear Session to erase it.');});
function count(){const t=$('transcript').value;$('textCount').textContent=`${t.length.toLocaleString()} characters · ${bytes(t).toLocaleString()} UTF-8 bytes · not uploaded`;}
$('transcript').addEventListener('input',()=>{count();discardReport();});
for(const id of ['company','ticker','quarter'])$(id).addEventListener('input',discardReport);
async function fileText(file,run){
 const kind=file.name.split('.').pop().toLowerCase();
 if(file.size>15*1024*1024)throw Error('File exceeds 15 MB. Use a smaller text-based transcript.');
 if(!['txt','pdf','docx'].includes(kind))throw Error('Choose TXT, PDF or DOCX. Old .doc files are not supported.');
 if(kind==='txt')return await file.text();
 const data=new Uint8Array(await file.arrayBuffer());if(run!==session)throw Error('CANCELLED');
 if(kind==='docx'){
  const {unzipSync,strFromU8}=await import('./assets/earnings-vendor/fflate.mjs');
  const zip=unzipSync(data,{filter:f=>{if(f.name==='word/document.xml'&&f.originalSize>5*1024*1024)throw Error('DOCX text content is too large.');return f.name==='word/document.xml';}});
  if(!zip['word/document.xml'])throw Error('No readable Word document found.');const raw=strFromU8(zip['word/document.xml']);
  if(/<!DOCTYPE|<!ENTITY/i.test(raw))throw Error('Unsupported XML declarations in DOCX.');
  const xml=new DOMParser().parseFromString(raw,'application/xml');if(xml.querySelector('parsererror'))throw Error('The DOCX could not be parsed.');
  return [...xml.getElementsByTagNameNS('*','p')].map(p=>[...p.getElementsByTagNameNS('*','t')].map(t=>t.textContent).join('')).join('\n');
 }
 const pdf=await import('./assets/earnings-vendor/pdf.mjs');pdf.GlobalWorkerOptions.workerSrc=new URL('./assets/earnings-vendor/pdf.worker.mjs',import.meta.url).href;
 pdfTask=pdf.getDocument({data,isEvalSupported:false,disableFontFace:true,useSystemFonts:false,stopAtErrors:true,verbosity:0});
 let doc;
 try{doc=await pdfTask.promise;if(doc.numPages>100)throw Error('PDF exceeds 100 pages. Import just the earnings call.');let pages=[],total=0;for(let i=1;i<=doc.numPages;i++){
  if(run!==session)throw Error('CANCELLED');const page=await doc.getPage(i);const text=await page.getTextContent();let lines='',previousY=null;
  for(const item of text.items){if(!('str' in item))continue;const y=item.transform?.[5];if(previousY!==null&&Math.abs(y-previousY)>3)lines+='\n';lines+=item.str+(item.hasEOL?'\n':' ');previousY=y;}
  total+=bytes(lines);if(total>MAX_TRANSCRIPT_BYTES)throw Error('Extracted PDF text exceeds 250 KB. Split it into separate sessions.');pages.push(lines);page.cleanup();
 }return pages.join('\n\n');}finally{if(doc)await doc.destroy();else await pdfTask?.destroy();pdfTask=null;}
}
$('transcriptFile').addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file)return;const run=++session;discardReport();reading=true;$('runAnalysis').disabled=true;$('fileStatus').textContent='Extracting on this device…';
 try{const text=await fileText(file,run);if(run!==session)return;if(bytes(text)>MAX_TRANSCRIPT_BYTES)throw Error('Extracted text exceeds 250 KB. Split the transcript into separate sessions.');if(text.trim().length<100)throw Error('Little or no readable text found. Scanned PDFs need OCR; paste a text version instead.');$('transcript').value=text;count();$('fileStatus').textContent='Extracted locally. Review the text before analyzing.';status('Text extracted. Review speaker labels, numbers and page breaks before sending.');}
 catch{if(run===session){$('fileStatus').textContent='Extraction failed: use a text-based TXT/PDF/DOCX within the stated limits, or paste the transcript.';status('No new text was submitted. Your previous pasted text, if any, remains. Scanned/encrypted PDFs may need a text export.',true);}}
 finally{if(run===session){reading=false;$('runAnalysis').disabled=false;$('transcriptFile').value='';}}
});
async function api(stage,input,meta,signal){
 const r=await fetch('/api/earnings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({stage,input,...meta}),cache:'no-store',credentials:'same-origin',signal});
 const type=r.headers.get('content-type')||'';if(!type.includes('application/json'))throw Error('Analysis service is not configured yet. Your transcript has not been analyzed.');const d=await r.json();if(!r.ok||!d.result)throw Error(typeof d.error==='string'?d.error:'Analysis unavailable. Try again later.');return d;
}
$('earningsForm').addEventListener('submit',async e=>{
 e.preventDefault();if(reading)return;if(!$('consent').checked){status('Review the processing note and check the consent box before sending text.',true);$('consent').focus();return;}
 const meta={company:$('company').value.trim(),ticker:$('ticker').value.trim().toUpperCase(),quarter:$('quarter').value.trim()};
 if(!meta.company&&!meta.ticker){status('Enter the company name or ticker.',true);$('company').focus();return;}
 if(!meta.quarter){status('Enter the reporting quarter so periods remain clear.',true);$('quarter').focus();return;}
 let prepared;try{prepared=prepareTranscript($('transcript').value);}catch(err){status(err.message,true);return;}
 const run=++session;controller?.abort();controller=new AbortController();const signal=controller.signal;discardReport();sources=prepared.sources;busy(true);$('analysisProgress').value=0;
 let notes=[],gaps=[],reductions=0;
 try{
  for(let i=0;i<prepared.chunks.length;i++){
   status(`Reading transcript part ${i+1} of ${prepared.chunks.length}… No content is being stored.`);
   const d=await api('extract',prepared.chunks[i],meta,signal);if(run!==session)return;notes.push(...d.result.notes);gaps.push(...d.result.gaps);$('analysisProgress').value=Math.round(65*(i+1)/prepared.chunks.length);
  }
  // Every part is processed. Hierarchical compression retains references; it is disclosed.
  let input=JSON.stringify({notes,gaps:[...new Set(gaps)].slice(0,8)});
  for(let round=0;bytes(input)>PART_BYTES;round++){
   if(round>=5)throw Error('Evidence could not fit safely without dropping coverage. Analyze smaller transcript sections in separate sessions.');
   const batches=noteBatches(notes);let next=[];status(`Condensing evidence, pass ${round+1} (${batches.length} groups)…`);
   for(const batch of batches){const d=await api('reduce',JSON.stringify({notes:batch}),meta,signal);if(run!==session)return;next.push(...d.result.notes);gaps.push(...d.result.gaps);reductions++;}
   notes=next;input=JSON.stringify({notes,gaps:[...new Set(gaps)].slice(0,6)});
  }
  status('Building the research brief and recomputing supported financial arithmetic…');$('analysisProgress').value=85;
  const pack=await api('analyze',input,meta,signal);if(run!==session)return;
  report={...pack,...meta,coverage:{parts:prepared.chunks.length,paragraphs:sources.size,reductions,scope:'User-supplied transcript; all parts processed, evidence condensed for synthesis. No independent earnings release, consensus or event reaction verification.'}};
  if(reductions)report.result.gaps.push(`Evidence was condensed in ${reductions} compression passes; lower-priority detail may be absent. Verify against the source transcript.`);
  report.result.gaps.push('Model-produced evidence and inputs require human verification. Paragraph references confirm location, not the truth of the claim.');render(report);$('analysisProgress').value=100;status('Analysis complete. Download it if needed; Clear Session erases this workspace.');$('reportPanel').scrollIntoView({behavior:'smooth',block:'start'});
 }catch(err){if(run===session)status(signal.aborted?'Analysis cancelled.':(err.message||'Analysis failed. Retry or Clear Session.'),true);}
 finally{if(run===session){busy(false);controller=null;}prepared=null;notes=[];gaps=[];}
});
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(cls)n.className=cls;return n;}
function block(title){const n=el('article',undefined,'report-block');n.append(el('h3',title));$('report').append(n);return n;}
function refs(host,row){
 const valid=(row.sources||[]).filter(id=>sources.has(id));if(!valid.length)return;
 const region=el('div');for(const id of valid){const b=el('button',id,'source-button');b.type='button';b.setAttribute('aria-expanded','false');b.addEventListener('click',()=>{const old=region.querySelector('.source-excerpt');old?.remove();const open=b.getAttribute('aria-expanded')!=='true';for(const x of region.querySelectorAll('button'))x.setAttribute('aria-expanded','false');if(open){b.setAttribute('aria-expanded','true');region.append(el('div',`[${id}] ${sources.get(id)}`,'source-excerpt'));}});region.append(b);}host.append(region);
}
function render(p){
 $('report').replaceChildren();$('reportPanel').hidden=false;const r=p.result;const intro=block(`${p.company||p.ticker} · ${p.quarter}`);intro.append(el('p',r.verdict.summary),el('div',`Evidence confidence: ${r.verdict.confidence} · ${p.coverage.parts} source parts · ${p.coverage.reductions} compression passes`,'layer'));
 for(const f of r.findings){const n=block(f.title);n.append(el('div',f.layer,'layer'),el('p',f.detail));refs(n,f);}
 if(r.dashboard.length){const n=block('Earnings dashboard'),wrap=el('div',undefined,'table-wrap'),table=el('table'),head=el('tr');for(const t of ['Metric','Actual','Comparison','Period / units'])head.append(el('th',t));table.append(head);for(const row of r.dashboard){const tr=el('tr');for(const t of [row.metric,row.actual,row.comparison,`${row.period} / ${row.units}`])tr.append(el('td',t));table.append(tr);refs(n,row);}wrap.append(table);n.prepend(wrap);}
 for(const s of r.sections){const n=block(s.title);n.append(el('div',s.layer,'layer'),el('p',s.body));refs(n,s);}
 if(r.calculations.length){const n=block('Guidance math / recomputed arithmetic');for(const c of r.calculations){n.append(el('h4',c.label),el('p',`${c.operation}(${c.a}, ${c.b}) = ${c.result} ${c.units}\n${c.period}\n${c.verification}`));refs(n,c);}}
 if(r.qa.length){const n=block('Management Q&A');for(const q of r.qa){n.append(el('h4',`${q.analyst} · ${q.rating}`),el('p',`Question: ${q.question}\nResponse: ${q.answer}\nAssessment: ${q.why}`));refs(n,q);}}
 if(r.scenarios.length){const n=block('Conditional scenarios');for(const s of r.scenarios){n.append(el('h4',s.case),el('p',`${s.assumptions}\nCatalyst: ${s.catalyst}\nInvalidation: ${s.invalidation}`));refs(n,s);}}
 if(r.watchlist.length){const n=block('Next-quarter watchlist');for(const w of r.watchlist){n.append(el('h4',w.item),el('p',`Threshold: ${w.threshold}`));refs(n,w);}}
 const q=block('Unanswered questions / evidence gaps');for(const t of [...r.questions,...r.gaps])q.append(el('p','• '+t));const m=block('Public Market-DEX context');m.append(el('p',p.market?.available?`${p.market.symbol}: ${p.market.close} ${p.market.currency} · observed ${p.market.as_of}\n${p.market.provider}\n${p.market.warning}`:p.market?.reason||'Not available.'));
}
function download(blob,name){const url=URL.createObjectURL(blob);objectURLs.add(url);const a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>{URL.revokeObjectURL(url);objectURLs.delete(url);},1000);}
const filename=()=>`Market-DEX_Earnings_${(report?.ticker||'Company').replace(/[^A-Z0-9-]/g,'')}_${(report?.quarter||'Report').replace(/[^A-Za-z0-9-]/g,'_')}`;
$('downloadJSON').addEventListener('click',()=>{if(report)download(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),filename()+'.json');});
async function loadPDFExport(){if(window.jspdf)return;await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='assets/earnings-vendor/jspdf.umd.min.js';script.onload=resolve;script.onerror=reject;document.head.append(script);});}
$('downloadPDF').addEventListener('click',async()=>{
 if(!report)return;const run=session;
 try{await loadPDFExport();if(run!==session||!report)return;const doc=new window.jspdf.jsPDF({unit:'pt',format:'a4',compress:true});const width=doc.internal.pageSize.getWidth(),height=doc.internal.pageSize.getHeight();let y=58;
  doc.setProperties({title:'Market-DEX Earnings Intelligence',author:'Market-DEX',subject:'Session report downloaded by user'});
  // Text is rendered as text, never HTML. Standard font export normalizes unsupported typography.
  for(const raw of reportLines(report)){const text=raw.replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[–—]/g,'-').replace(/→/g,' -> ').replace(/•/g,'-').replace(/[^\x20-\x7e\u00a0-\u00ff\n]/g,'?');const heading=!!text&&text===text.toUpperCase()&&text.length<70;doc.setFont('helvetica',heading?'bold':'normal');doc.setFontSize(heading?12:10);doc.setTextColor(heading?26:50,heading?50:60,heading?78:75);for(const line of doc.splitTextToSize(text,width-100)){if(y>height-60){doc.addPage();y=55;}doc.text(line,50,y);y+=14;}y+=8;}
  const pages=doc.getNumberOfPages();for(let i=1;i<=pages;i++){doc.setPage(i);doc.setFontSize(8);doc.setTextColor(110);doc.text(`MARKET-DEX / AI-assisted research / ${i} of ${pages}`,50,height-28);}download(doc.output('blob'),filename()+'.pdf');
 }catch{status('PDF export could not finish. Your report remains in this tab; JSON download is available.',true);}
});
fetch('/api/earnings',{cache:'no-store'}).then(async r=>{const d=r.ok&&r.headers.get('content-type')?.includes('application/json')?await r.json():null;$('backendStatus').textContent=d?.available?'Workers AI connected · session only':'AI service not connected yet';}).catch(()=>{$('backendStatus').textContent='AI service status unavailable';});
// Never serialize transcript/report state to storage, URLs, telemetry, cookies or logs.
