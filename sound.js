'use strict';
(() => {
 let context=null,enabled=true,introPlayed=false,unlocked=false;
 try{enabled=localStorage.getItem('mdx-arcade-sound')!=='off';}catch{}
 const notes=[72,76,79,81,79,76,74,84];
 function tone(midi,start,duration,gain=.035,type='square'){const oscillator=context.createOscillator(),amp=context.createGain();oscillator.type=type;oscillator.frequency.value=440*Math.pow(2,(midi-69)/12);amp.gain.setValueAtTime(0,start);amp.gain.linearRampToValueAtTime(gain,start+.008);amp.gain.setValueAtTime(gain*.7,start+duration*.55);amp.gain.exponentialRampToValueAtTime(.0001,start+duration);oscillator.connect(amp);amp.connect(context.destination);oscillator.start(start);oscillator.stop(start+duration+.02);}
 function paint(){const button=document.querySelector('#soundToggle');if(!button)return;button.textContent=!enabled?'♪ Sound off':unlocked?'♪ Sound on':'♪ Enable sound';button.setAttribute('aria-pressed',String(enabled&&unlocked));button.title='Original arcade chime and click sounds. Tap to enable or mute.';}
 function intro(){if(introPlayed||!enabled)return;introPlayed=true;const start=context.currentTime+.03;notes.forEach((note,i)=>tone(note,start+i*.14,i===7?.38:.12,.025));[48,55,60].forEach((note,i)=>tone(note,start+i*.42,.36,.018,'triangle'));}
 async function unlock(){if(!enabled)return false;try{if(!context)context=new (window.AudioContext||window.webkitAudioContext)();await context.resume();unlocked=context.state==='running';paint();if(unlocked)intro();return unlocked;}catch{paint();return false;}}
 function click(){if(!enabled||!unlocked||!context)return;const start=context.currentTime;tone(88,start,.025,.018);tone(95,start+.023,.035,.012);}
 document.addEventListener('pointerdown',event=>{if(event.target.closest('#soundToggle'))return;if(enabled&&!unlocked)unlock();},{capture:true,passive:true});
 document.addEventListener('keydown',event=>{if(enabled&&!unlocked&&['Enter',' '].includes(event.key))unlock();},{capture:true});
 document.addEventListener('click',event=>{if(event.target.closest('#soundToggle'))return;if(event.target.closest('button,a,select,summary,[role="tab"]'))click();},true);
 window.addEventListener('mdx:ui-click',click);
 document.addEventListener('DOMContentLoaded',()=>{paint();document.querySelector('#soundToggle').addEventListener('click',async()=>{if(enabled&&!unlocked){await unlock();return;}enabled=!enabled;try{localStorage.setItem('mdx-arcade-sound',enabled?'on':'off');}catch{}if(enabled)await unlock();else if(context)await context.suspend();paint();});if(enabled)unlock();});
})();
