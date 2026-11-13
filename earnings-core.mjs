export const MAX_TRANSCRIPT_BYTES=250000,PART_BYTES=11000;
export const bytes=s=>new TextEncoder().encode(s).length;
export function splitBytes(text,max){
 const out=[];let part='',size=0;for(const c of text){let n=bytes(c);if(size+n>max){out.push(part);part='';size=0;}part+=c;size+=n;}if(part)out.push(part);return out;
}
export function prepareTranscript(text){
 text=text.replace(/\u0000/g,'').replace(/\r\n?/g,'\n').trim();
 if(bytes(text)>MAX_TRANSCRIPT_BYTES)throw Error('Transcript exceeds 250 KB of extracted text. Split it into separate sessions; nothing has been silently truncated.');
 if(text.length<100)throw Error('Provide at least 100 characters of transcript text. Scanned PDFs need OCR before importing.');
 const paragraphs=text.split(/\n+/).filter(x=>x.trim()).flatMap(line=>splitBytes(line.trim(),3500));
 const sources=new Map(paragraphs.map((text,i)=>['P'+(i+1),text]));let chunks=[],chunk='';
 for(const [id,text] of sources){const row=`[${id}] ${text}\n`;if(bytes(chunk+row)>PART_BYTES){chunks.push(chunk);chunk='';}chunk+=row;}if(chunk)chunks.push(chunk);
 return {sources,chunks,bytes:bytes(text)};
}
export function noteBatches(notes,max=10500){let out=[],batch=[];for(const item of notes){if(bytes(JSON.stringify([item]))>max)throw Error('Evidence note exceeded the safe context budget.');if(batch.length&&bytes(JSON.stringify([...batch,item]))>max){out.push(batch);batch=[];}batch.push(item);}if(batch.length)out.push(batch);return out;}
const label=x=>String(x??'').trim();
export function reportLines(pack){
 const r=pack.result,lines=[`MARKET-DEX / EARNINGS INTELLIGENCE`,`${pack.company||pack.ticker||'Company'} | ${pack.ticker||'Ticker not supplied'} | ${pack.quarter||'Period not supplied'}`,`Prepared ${pack.generated_at} | ${pack.model}`,`AI-assisted research. Verify against primary filings.`, `Coverage: ${pack.coverage.parts} transcript parts; ${pack.coverage.paragraphs} source paragraphs; ${pack.coverage.reductions} evidence-compression passes.`, '', 'EXECUTIVE VERDICT',r.verdict.summary,`Evidence confidence: ${r.verdict.confidence}`];
 const refs=row=>row.sources?.length?'Source paragraphs: '+row.sources.join(', '):'';
 for(const row of r.findings)lines.push('',row.title,`${row.layer}: ${row.detail}`,refs(row));
 if(r.dashboard.length){lines.push('','EARNINGS DASHBOARD');for(const row of r.dashboard)lines.push(`${row.metric}: ${row.actual} | ${row.comparison} | ${row.period} | ${row.units}`,refs(row));}
 for(const row of r.sections)lines.push('',row.title,`${row.layer}: ${row.body}`,refs(row));
 if(r.calculations.length){lines.push('','RECOMPUTED ARITHMETIC');for(const c of r.calculations)lines.push(`${c.label}: ${c.operation}(${c.a}, ${c.b}) = ${c.result} ${c.units} | ${c.period}`,c.verification,refs(c));}
 if(r.qa.length){lines.push('','MANAGEMENT Q&A');for(const q of r.qa)lines.push(`${q.analyst}: ${q.question}`,`Response: ${q.answer}`,`${q.rating}: ${q.why}`,refs(q));}
 if(r.scenarios.length){lines.push('','CONDITIONAL SCENARIOS');for(const s of r.scenarios)lines.push(`${s.case}: ${s.assumptions}`,`Catalyst: ${s.catalyst}`,`Invalidation: ${s.invalidation}`,refs(s));}
 if(r.watchlist.length){lines.push('','NEXT-QUARTER WATCHLIST');for(const w of r.watchlist)lines.push(w.item,`Threshold: ${w.threshold}`,refs(w));}
 lines.push('','UNANSWERED QUESTIONS',...r.questions,'','EVIDENCE GAPS',...r.gaps,'','PUBLIC MARKET CONTEXT');
 lines.push(pack.market?.available?`${pack.market.symbol}: ${pack.market.close} ${pack.market.currency} | observed ${pack.market.as_of} | ${pack.market.provider} | ${pack.market.source_url} | ${pack.market.warning}`:pack.market?.reason||'Not available.');
 lines.push('','Source references point to session transcript paragraphs. No raw transcript is included in this export. Missing consensus/filings and condensed evidence limit confidence. No verified earnings-event stock reaction is supplied by the daily market feed.');return lines.map(label);
}
