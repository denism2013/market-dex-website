// Click-loaded artwork rides an observed chart segment; it never changes prices.
export function layout(g,direction,aspect=2/3){
 const pts=g.points,w=g.width,h=g.height;let end=pts.length-1,start=Math.max(0,end-5);
 for(let j=pts.length-1;j>=Math.max(2,pts.length-24);j--){const i=Math.max(0,j-5);if(direction*(pts[j].close-pts[i].close)>0){start=i;end=j;break;}}
 const route=pts.slice(start,end+1);const aboveSpace=Math.min(...route.map(p=>p.y))-18,belowSpace=h-32-Math.max(...route.map(p=>p.y));const above=true;
 const room=Math.max(38,above?aboveSpace:belowSpace),width=Math.min(145,Math.max(76,w*.23),room/aspect),height=width*aspect;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 return {width,height,above,route,positions:route.map(p=>({left:clamp(p.x-width*.74,12,Math.max(12,w-66-width)),top:clamp(above?p.y-height-9:p.y+9,14,Math.max(14,h-31-height))}))};
}
export function play(host,direction,bars,rule='Technical'){
 host.replaceChildren();const chart=document.getElementById('priceCanvas'),g=window.MDX_CHART_GEOMETRY;if(!chart||!direction||!g?.points?.length)return ()=>{};
 let wrap=chart.parentElement;if(!wrap.classList.contains('cinematic-chart-wrap')){wrap=document.createElement('div');wrap.className='cinematic-chart-wrap';wrap.style.cssText='position:relative;width:100%;isolation:isolate';chart.before(wrap);wrap.append(chart);}
 const layer=document.createElement('div');layer.className='cinematic-signal-overlay';layer.style.cssText='position:absolute;inset:0;pointer-events:none;overflow:hidden;border-radius:12px;z-index:2';wrap.append(layer);
 const bullish=direction>0,color=bullish?'#55ff35':'#ff3557',img=document.createElement('img');img.alt=bullish?'Small neon bull riding an observed rising price segment':'Small neon bear riding an observed falling price segment';img.src=bullish?'assets/cinematic-bull.png':'assets/cinematic-bear.png';img.style.cssText='position:absolute;height:auto;opacity:0;filter:drop-shadow(0 0 3px '+color+');transform-origin:70% 65%';layer.append(img);
 const caption=document.createElement('p');caption.style.cssText='font-size:11px;line-height:1.5;color:#a1b3cb';host.append(caption);const replay=document.createElement('button'),close=document.createElement('button');for(const b of [replay,close]){b.type='button';b.className='quiet-btn';host.append(b);}replay.textContent='Replay '+(bullish?'horn charge':'claw attack');close.textContent='Hide chart animal';
 function svgLayer(){const el=document.createElementNS('http://www.w3.org/2000/svg','svg');el.setAttribute('viewBox',`0 0 ${g.width} ${g.height}`);el.setAttribute('preserveAspectRatio','none');el.setAttribute('aria-hidden','true');el.style.cssText='position:absolute;inset:0;width:100%;height:100%';layer.append(el);return el;}
 const fx=svgLayer(),price=svgLayer();
 // Redraw the actual primary prices above the translucent animal so every close/candle stays legible.
 function shape(parent,tag,attrs){const el=document.createElementNS(parent.namespaceURI,tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);parent.append(el);return el;}
 if(!g.candles)shape(price,'polyline',{points:g.points.map(p=>p.x+','+p.y).join(' '),fill:'none',stroke:'#58edd4','stroke-width':1.8,'stroke-linejoin':'round'});
 else {const cw=Math.max(1,Math.min(12,(g.width-70)/g.points.length*.65));for(const p of g.points){if(!Number.isFinite(p.openY))continue;const col=p.close>=p.open?g.palette.up:g.palette.down;shape(price,'line',{x1:p.x,x2:p.x,y1:p.highY,y2:p.lowY,stroke:col,'stroke-width':1});shape(price,'rect',{x:p.x-cw/2,y:Math.min(p.y,p.openY),width:cw,height:Math.max(1,Math.abs(p.y-p.openY)),fill:col});}}
 let animations=[],closed=false;
 function clear(){for(const a of animations)a.cancel();animations=[];fx.replaceChildren();}
 function cleanup(){if(closed)return;closed=true;clear();layer.remove();host.replaceChildren();observer.disconnect();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('mdx:view-changed',cleanup);window.removeEventListener('resize',cleanup);window.MDX_CINEMATIC_HEADROOM=false;window.MDX_TECH?.redraw();}
 function visibility(){if(document.hidden)cleanup();}
 const observer=new MutationObserver(()=>{if(!host.isConnected||!host.childNodes.length)cleanup();});observer.observe(host,{childList:true});
 function animate(){if(closed)return;clear();const pos=layout(g,direction,img.naturalHeight/img.naturalWidth),a=pos.positions[0],last=pos.positions.at(-1),start=pos.route[0],end=pos.route.at(-1);img.style.width=(pos.width/g.width*100)+'%';img.style.left='0';img.style.top='0';img.style.opacity='.8';
 caption.textContent=rule+' · '+(bullish?'bullish':'bearish')+' rule match. Riding observed '+start.date+' → '+end.date+' prices; no forecast or invented future bars.';
 const transform=(p,dx=0,dy=0,r=0,s=1)=>`translate(${p.left+dx}px,${p.top+dy}px) rotate(${r}deg) scale(${s})`;
 if(matchMedia('(prefers-reduced-motion: reduce)').matches){img.style.transform=transform(last);replay.disabled=true;caption.textContent+=' Reduced motion: static artwork.';return;}
 const frames=[{offset:0,opacity:0,transform:transform(a,-8,0,0,.93)},{offset:.12,opacity:.8,transform:transform(a)},{offset:.28,opacity:.7,transform:transform(a,-8,bullish?5:-5,bullish?-9:-10,.94)},{offset:.39,opacity:.78,transform:transform(a,4,bullish?-9:9,bullish?7:10,1.02)}];
 pos.positions.forEach((p,i)=>frames.push({offset:.45+.45*i/(pos.positions.length-1||1),opacity:.8,transform:transform(p,0,0,0,1)}));frames.push({offset:1,opacity:.78,transform:transform(last)});
 animations.push(img.animate(frames,{duration:3400,easing:'ease-in-out',fill:'both'}));
 const hitX=Math.min(g.width-66,start.x+8),hitY=start.y;
 if(bullish){const ring=shape(fx,'ellipse',{cx:hitX,cy:hitY,rx:16,ry:12,fill:'none',stroke:color,'stroke-width':2});ring.style.transformOrigin=hitX+'px '+hitY+'px';animations.push(ring.animate([{opacity:0,transform:'scale(.2)'},{opacity:.9,transform:'scale(1)',offset:.25},{opacity:0,transform:'scale(2)'}],{duration:650,delay:1100,fill:'both'}));
 const horn=shape(fx,'path',{d:`M ${hitX-20} ${hitY+8} Q ${hitX+8} ${hitY-28} ${hitX+14} ${hitY-35}`,stroke:color,'stroke-width':2,fill:'none',pathLength:1});horn.style.strokeDasharray='1';animations.push(horn.animate([{opacity:0,strokeDashoffset:1},{opacity:1,strokeDashoffset:0,offset:.55},{opacity:0,strokeDashoffset:0}],{duration:600,delay:950,fill:'both'}));
 }else for(let i=0;i<3;i++){const slash=shape(fx,'path',{d:`M ${hitX-13+i*8} ${hitY-25} Q ${hitX+7+i*8} ${hitY-4} ${hitX-4+i*8} ${hitY+17}`,stroke:i===1?'#ffb6c4':color,'stroke-width':2.5,fill:'none','stroke-linecap':'round',pathLength:1});slash.style.strokeDasharray='1';animations.push(slash.animate([{strokeDashoffset:1,opacity:0},{strokeDashoffset:.6,opacity:.9,offset:.2},{strokeDashoffset:0,opacity:.85,offset:.55},{strokeDashoffset:0,opacity:0}],{duration:750,delay:1050+i*60,fill:'both'}));}
 }
 replay.onclick=animate;close.onclick=cleanup;document.addEventListener('visibilitychange',visibility);window.addEventListener('mdx:view-changed',cleanup);window.addEventListener('resize',cleanup);
 img.decode().then(()=>{if(!closed)animate();}).catch(()=>{cleanup();host.textContent='The cinematic artwork could not load. Please try again.';});return cleanup;
}
