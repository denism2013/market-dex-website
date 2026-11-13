'use strict';
(() => {
 const $=id=>document.querySelector(id);let enabled=true,volume=.65,started=false,intro=null,pool=[],cursor=0;
 try{enabled=localStorage.getItem('mdx-arcade-sound')!=='off';const raw=localStorage.getItem('mdx-arcade-volume'),saved=Number(raw);if(raw!==null&&saved>=0&&saved<=1)volume=saved;}catch{}
 function save(){try{localStorage.setItem('mdx-arcade-sound',enabled?'on':'off');localStorage.setItem('mdx-arcade-volume',String(volume));}catch{}}
 function status(message){$('#soundStatus').textContent=message;$('#audioPlaybackStatus').textContent=message;}
 function paint(){const b=$('#soundToggle');b.textContent=enabled?'♪ Sound on':'♪ Sound off';b.setAttribute('aria-pressed',String(enabled));b.title='Enable or mute arcade audio. Test sound opens a real audio player.';}
 function volumes(){for(const a of [intro,...pool])if(a){a.volume=volume;a.muted=!enabled;}$('#soundVolume').value=String(Math.round(volume*100));$('#soundVolumeValue').textContent=Math.round(volume*100)+'%';}
 function failed(error){started=false;status(error?.name==='NotAllowedError'?'Autoplay blocked. Tap anywhere, press Enter, or use Test sound to start the logo and melody.':'Audio could not play. Try opening the tune directly below.');}
 function playIntro(){enabled=true;save();paint();volumes();intro.pause();intro.currentTime=0;const promise=intro.play();promise?.catch(failed);}
 function click(){if(!enabled||!started)return;const a=pool[cursor++%pool.length];a.currentTime=0;a.play()?.catch(()=>{});}
 function activate(event){if(event.target.closest('#soundToggle,#soundReplay,#soundSettings,#soundDialog'))return;if(intro&&enabled&&!started){playIntro();}}
 document.addEventListener('pointerdown',activate,{capture:true,passive:true});document.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key))activate(event);},true);
 document.addEventListener('click',event=>{if(!event.target.closest('#soundToggle,#soundReplay,#soundSettings,#soundDialog')&&event.target.closest('button,a,select,summary,[role="tab"]'))click();},true);window.addEventListener('mdx:ui-click',click);
 document.addEventListener('DOMContentLoaded',()=>{
  intro=$('#startupAudio');pool=Array.from({length:3},()=>{const a=new Audio('assets/arcade-click.wav');a.preload='auto';return a;});paint();volumes();status(enabled?'Sound enabled. First interaction starts the tune; Test sound opens the player.':'Sound muted.');
  intro.addEventListener('playing',()=>{started=true;const logo=document.querySelector('.hero-logo');if(logo){logo.classList.remove('startup-playing');void logo.offsetWidth;logo.classList.add('startup-playing');}status('Playing the original 4.25-second epic startup theme.');});intro.addEventListener('ended',()=>{document.querySelector('.hero-logo')?.classList.remove('startup-playing');status('Startup tune finished. Interface click sounds are enabled.');});intro.addEventListener('error',()=>failed());intro.addEventListener('play',()=>{enabled=true;save();paint();volumes();});
  $('#soundToggle').addEventListener('click',()=>{if(enabled){enabled=false;for(const a of [intro,...pool])a.pause();document.querySelector('.hero-logo')?.classList.remove('startup-playing');save();paint();volumes();status('Sound muted.');}else{playIntro();}});
  $('#soundReplay').addEventListener('click',()=>{$('#soundDialog').showModal();started=true;playIntro();});$('#soundSettings').addEventListener('click',()=>$('#soundDialog').showModal());$('#soundVolume').addEventListener('input',event=>{volume=Number(event.target.value)/100;save();volumes();});
  if(enabled)playIntro();
 });
})();
