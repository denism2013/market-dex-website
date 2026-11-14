export async function play(host,direction,bars){
 host.replaceChildren();const frame=document.createElement('iframe');frame.title=direction>0?'Market-DEX cinematic bull chart signal':'Market-DEX cinematic bear chart signal';frame.setAttribute('sandbox','allow-scripts');frame.style.cssText='width:100%;height:min(80vw,560px);border:0;border-radius:16px';
 frame.src='assets/chart-cinematic.html#'+encodeURIComponent(JSON.stringify({direction,closes:bars.map(b=>b.close)}));
 const close=document.createElement('button');close.type='button';close.className='quiet-btn';close.textContent='Close cinematic scene';close.onclick=()=>host.replaceChildren();host.append(close,frame);
}
