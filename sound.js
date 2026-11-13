'use strict';
(() => {
 let context=null,enabled=true,introPlayed=false,unlocked=false;
 try{enabled=localStorage.getItem('mdx-arcade-sound')!=='off';}catch{}
 const notes=[72,76,79,81,79,76,74,84];
 function tone(midi,start,duration,gain=.065,type='square'){const oscillator=context.createOscillator(),amp=context.createGain();oscillator.type=type;oscillator.frequency.value=440*Math.pow(2,(midi-69)/12);amp.gain.setValueAtTime(0,start);amp.gain.linearRampToValueAtTime(gain,start+.008);amp.gain.setValueAtTime(gain*.7,start+duration*.55);amp.gain.exponentialRampToValueAtTime(.0001,start+duration);oscillator.connect(amp);amp.connect(context.destination);oscillator.start(start);oscillator.stop(start+duration+.02);}
 function paint(message){unlocked=!!context&&context.state==='running';const button=document.querySelector('#soundToggle');if(!button)return;button.textContent=!enabled?'♪ Sound off':unlocked?'♪ Sound on':'♪ Enable sound';button.setAttribute('aria-pressed',String(enabled&&unlocked));button.title='Enable or mute original arcade sounds. Use Test sound to replay the tune.';const status=document.querySelector('#soundStatus');if(status)status.textContent=message||(!enabled?'Sound muted.':unlocked?'Audio ready.':'Click Enable sound or Test sound to allow playback.');}
 function intro(replay=false){if((introPlayed&&!replay)||!enabled||!unlocked)return;introPlayed=true;const start=context.currentTime+.03;notes.forEach((note,i)=>tone(note,start+i*.14,i===7?.38:.12,.06));[48,55,60].forEach((note,i)=>tone(note,start+i*.42,.36,.045,'triangle'));}
 function save(){try{localStorage.setItem('mdx-arcade-sound',enabled?'on':'off');}catch{}}
 async function unlock(replay=false){if(!enabled)return false;try{if(!context){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw new Error('Audio unavailable');context=new Audio();context.onstatechange=()=>paint();}if(context.state!=='running')await context.resume();paint();if(unlocked)intro(replay);return unlocked;}catch{paint('Audio could not start. Check browser or device sound settings, then click Test sound.');return false;}}
 function click(){if(!enabled||!context||context.state!=='running')return;const start=context.currentTime;tone(88,start,.035,.05);tone(95,start+.03,.045,.035);}
 document.addEventListener('pointerdown',event=>{if(event.target.closest('#soundToggle,#soundReplay'))return;if(enabled&&(!context||context.state!=='running'))unlock();},{capture:true,passive:true});
 document.addEventListener('keydown',event=>{if(enabled&&(!context||context.state!=='running')&&['Enter',' '].includes(event.key))unlock();},{capture:true});
 document.addEventListener('click',event=>{if(event.target.closest('#soundToggle,#soundReplay'))return;if(event.target.closest('button,a,select,summary,[role="tab"]'))click();},true);
 window.addEventListener('mdx:ui-click',click);
 document.addEventListener('DOMContentLoaded',()=>{paint();document.querySelector('#soundToggle').addEventListener('click',async()=>{if(enabled&&context&&context.state==='running'){enabled=false;save();await context.suspend();paint();}else{enabled=true;save();await unlock();}});document.querySelector('#soundReplay').addEventListener('click',async()=>{enabled=true;save();if(await unlock(true))paint('Startup tune played. If silent, check device volume and whether this browser tab is muted.');});});
})();
