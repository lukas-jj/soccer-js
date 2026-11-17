const {FiveMatch,CHARACTERS,configureFive,loadKits}=require('../../five/match.js');
const {Settings}=require('../../settings.js');
const {Application}=require('../../engine.js');
const {Utils}=require('../../core/lib/utils.js');
const {Pitch}=require('../../core/entities/pitch.js');
const {SoundDB}=require('../../core/lib/sounddb.js');
const {Time}=require('../../core/lib/time.js');
const $=id=>document.getElementById(id);
let match=null,input=null,paused=false,loading=false,lastFrame=0,accumulator=0,preview=null,selected='cole',sound=true,view='select',raf=0,stickPointer=null,stickOrigin=null;
const cleanups=[];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function portrait(c){return `<svg viewBox="0 0 180 190" aria-hidden="true" class="portrait"><ellipse cx="90" cy="185" rx="58" ry="8" fill="#000" opacity=".2"/><path d="M65 75 L44 86 19 126 41 141 58 114 57 190H123L122 114 139 141 161 126 136 86 115 75Z" fill="#e8af3c"/><path d="M19 126L41 141 35 160Q28 168 20 159L12 145Z M161 126L139 141 145 160Q152 168 160 159L168 145Z" fill="${c.skin}"/><path d="M71 66V84Q90 100 109 84V66" fill="${c.skin}"/><path d="M65 75Q90 97 115 75L111 89Q90 108 69 89Z" fill="#1d292c"/><path d="M58 109L51 94M122 109L129 94" stroke="#f4d277" stroke-width="4"/><path d="M59 43Q60 14 90 14Q120 14 121 43L116 64Q111 81 90 82Q69 81 64 64Z" fill="${c.skin}"/><path d="M60 47V33Q62 9 90 11Q119 10 121 34V47L112 34Q93 40 76 30L68 49Z" fill="${c.hair}"/><path d="M78 57h4m16 0h4" stroke="#30271f" stroke-width="3" stroke-linecap="round"/><path d="M84 70q6 3 12 0" fill="none" stroke="#7d4f3e" stroke-width="2"/><text x="90" y="163" fill="#1b292d" font-family="Impact,Arial Black,sans-serif" font-size="54" text-anchor="middle">${c.number}</text><path d="M60 184H120" stroke="#f4cf68" stroke-width="3"/></svg>`;}
function icon(name){const paths={pause:'<path d="M8 5v14M16 5v14"/>',sound:'<path d="M4 9h4l5-4v14l-5-4H4zM17 8q5 4 0 8"/>',muted:'<path d="M4 9h4l5-4v14l-5-4H4zM17 9l5 6m0-6l-5 6"/>',expand:'<path d="M4 9V4h5m6 0h5v5m0 6v5h-5M9 20H4v-5"/>'};return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[name]||''}</svg>`;}
function toast(text){$('message').textContent=text;}
function showSelection(){
 view='select';paused=false;loading=false;
 if(match){match.destroy();match=null;input=null;}
 SoundDB.stopCrowd();
 $('hud').hidden=true;$('touch').hidden=true;$('overlay').hidden=false;
 $('overlay').innerHTML=`<div class="selection"><div class="selection-top"><span class="wordmark">SOCCER<span> / FIVE</span></span><span class="edition">5 A SIDE · 3 MINUTES</span></div><div class="selection-heading"><p class="kicker">PICK YOUR PLAYER</p><h1>Own the pitch.</h1></div><div class="characters">${CHARACTERS.map(c=>`<button class="character ${selected===c.id?'selected':''}" style="--accent:${c.color}" data-character="${c.id}" aria-pressed="${selected===c.id}"><span class="character-role">${c.role}</span><span class="character-art">${portrait(c)}<span class="jersey-number">${c.number}</span></span><span class="character-name">${c.short}</span><span class="full-name">${esc(c.name)}</span><span class="character-trait">${c.strength}<span>${Math.max(...Object.values(c.stats))}</span></span></button>`).join('')}</div><div class="selection-bottom"><div class="selection-controls"><span><kbd>W A S D</kbd> Move</span><span><kbd>J</kbd> Pass / tackle</span><span><kbd>K</kbd> Shoot</span><span><kbd>⇧</kbd> Sprint</span></div><button class="play" data-action="play">PLAY <span>↗</span></button></div><div class="selection-foot"><span>One player. Your team.</span><span>Mouse aims · Hold to charge</span></div></div>`;
 $('message').textContent='';
 }
function hud(){
 $('hud').innerHTML=`<div class="hud-brand">S<span>/</span>5</div><div class="scoreboard"><span class="team-label home">GOLD</span><b id="home-score">0</b><span class="score-divider">:</span><b id="away-score">0</b><span class="team-label away">BLUE</span><time id="clock">3:00</time></div><div class="hud-actions"><button data-action="sound" id="sound" aria-label="Mute sound">${icon(sound?'sound':'muted')}</button><button data-action="fullscreen" aria-label="Toggle fullscreen">${icon('expand')}</button><button data-action="pause" aria-label="Pause match">${icon('pause')}</button></div><div class="player-hud"><span id="call-feedback" role="status" aria-live="polite"></span><span class="player-number">${match.character.number}</span><div><b>${match.character.short}</b><span id="direction">ATTACK →</span></div><div class="condition-bars"><div class="stamina-track" title="Stamina"><span id="stamina"></span></div><div class="charge-track" title="Kick power"><span id="charge"></span></div></div></div><div class="desktop-controls"><span><kbd>WASD</kbd> MOVE</span><span><kbd>J</kbd> PASS / TACKLE</span><span><kbd>K</kbd> SHOOT</span><span><kbd>L</kbd> LOB / SLIDE</span><span><kbd>E</kbd> CALL</span><span><kbd>⇧</kbd> SPRINT</span></div><div id="announcement" aria-live="polite"></div>`;
 $('hud').hidden=false;
 $('touch').hidden=false;
}
async function start(){
 if(loading)return;loading=true;toast('Loading pitch…');
 try{
  if(match)match.destroy();
  SoundDB.stopCrowd();SoundDB.resume();match=await FiveMatch.create(selected);Settings.soundsMuted=!sound;
  await loadKits();
  // The custom selection marker replaces debug/AI rings in this mode only.
  for(const p of match.sim.players)p.preRender=()=>{};
  input=match.input;input.attach(window);
  try{localStorage.setItem('soccer-five-character',selected);}catch(_){}
  paused=false;loading=false;view='play';$('overlay').hidden=true;hud();toast('');
  accumulator=0;lastFrame=performance.now();$('pitch').focus({preventScroll:true});
 }catch(e){loading=false;view='select';toast(`Could not start: ${e.message}`);}
}
function overlay(kind){
 view=kind;paused=true;input?.reset();
 $('touch').hidden=true;$('overlay').hidden=false;
 const finished=kind==='finished',sentOff=match?.player.isSentOff;
 const won=match&&match.sim.scoreA>match.sim.scoreB,draw=match&&match.sim.scoreA===match.sim.scoreB;
 $('overlay').innerHTML=`<div class="match-overlay"><p class="kicker">${finished?'FULL TIME':'TIME OUT'}</p><h1>${finished?(sentOff?'Sent off.':draw?'Honours even.':won?'That’s your game.':'Run it back.'):'Paused.'}</h1>${finished?`<div class="final-score"><span>GOLD</span><strong>${match.sim.scoreA} : ${match.sim.scoreB}</strong><span>BLUE</span></div>`:''}<div class="overlay-buttons">${finished?'': '<button class="play" data-action="resume">RESUME →</button>'}<button class="${finished?'play':'secondary'}" data-action="restart">${finished?'PLAY AGAIN →':'RESTART'}</button><button class="text-button" data-action="choose">CHANGE PLAYER</button></div></div>`;
}
function resume(){if(!match||match.finished)return;paused=false;view='play';input.reset();$('overlay').hidden=true;$('touch').hidden=false;lastFrame=performance.now();}
function camera(){
 const canvas=$('pitch'),rect=canvas.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);
 const w=Math.max(320,Math.round(rect.width*dpr)),h=Math.max(240,Math.round(rect.height*dpr));
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
 const touch=window.matchMedia?.('(pointer:coarse)').matches;
 const landscape=rect.width>rect.height*1.3;
 const margin=(touch&&landscape?140:35)*dpr,top=(landscape?80:110)*dpr,bottom=(touch?(landscape?38:170):80)*dpr;
 let scale=Math.max(2,Math.min((w-margin*2)/(52+34*.3),(h-top-bottom)/(34*.8)));
 const portraitFollow=touch&&!landscape&&match;
 if(portraitFollow)scale=Math.max(scale,11.5*dpr);
 let offsetX=(w-(52+34*.3)*scale)/2;
 if(portraitFollow){
  const p=match.player,b=match.sim.ball,targetX=(p.x*.65+b.x*.35)*scale+(p.y*.65+b.y*.35)*scale*.3;
  offsetX=Math.max(w-25*dpr-(52+34*.3)*scale,Math.min(25*dpr,w/2-targetX));
 }
 Settings.camera={...Settings.camera,type:'static',scale,offsetX,offsetY:top+Math.max(0,(h-top-bottom-34*.8*scale)/2)};
 Settings.showFPS=false;Settings.projectionMode='orthographic';Settings.HEADLESS=false;
 Application.canvas=canvas;Application.g=canvas.getContext('2d');Application.camX=0;Application.camY=0;Application.width=w;Application.height=h;Settings.app=Application;
 return {canvas,g:Application.g,dpr};
}
function paint(){
 const {canvas,g,dpr}=camera();
 g.fillStyle='#121c20';g.fillRect(0,0,canvas.width,canvas.height);
 g.imageSmoothingEnabled=false;
 const active=match?.sim;
 if(active){
  active.renderAll(g);
  const p=match.player,point=Utils.toScreen(p.x,p.y),scale=Settings.camera.scale;
  if(!p.isSentOff){
   g.strokeStyle='#ffcd61';g.lineWidth=2*dpr;g.beginPath();g.ellipse(point.x,point.y,scale*.72,scale*.32,0,0,Math.PI*2);g.stroke();
   g.fillStyle='#ffcd61';g.beginPath();g.moveTo(point.x,point.y-scale*2.8);g.lineTo(point.x-scale*.25,point.y-scale*3.25);g.lineTo(point.x+scale*.25,point.y-scale*3.25);g.closePath();g.fill();
   if(input?.aim&&active.ball.owner===p){
    const len=Math.hypot(input.aim.x,input.aim.y)||1,end=Utils.toScreen(p.x+input.aim.x/len*4,p.y+input.aim.y/len*4);
    g.globalAlpha=.55;g.setLineDash([4*dpr,5*dpr]);g.beginPath();g.moveTo(point.x,point.y);g.lineTo(end.x,end.y);g.stroke();g.setLineDash([]);g.globalAlpha=1;
   }
  }
 }else{
  if(!preview)preview=new Pitch();preview.render(g);
 }
 // A gentle stadium vignette; the engine pitch and animated sprites stay intact.
 const vignette=g.createRadialGradient(canvas.width/2,canvas.height/2,canvas.width*.22,canvas.width/2,canvas.height/2,canvas.width*.75);
 vignette.addColorStop(0,'#0000');vignette.addColorStop(1,'#02090d99');g.fillStyle=vignette;g.fillRect(0,0,canvas.width,canvas.height);
}
function updateHud(){
 if(!match||!$('home-score'))return;
 const s=match.sim,remaining=Math.max(0,Math.ceil((5400-s.matchTimer)/5400*s.matchDuration));
 $('home-score').textContent=s.scoreA;$('away-score').textContent=s.scoreB;$('clock').textContent=`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`;
 $('stamina').style.width=`${match.player.currentStamina*100}%`;
 const charge=s._manualCharge;$('charge').style.width=`${charge?Math.min(100,charge.ticks*.05/.6*100):0}%`;
 $('direction').textContent=s.isSecondHalf()?'← ATTACK':'ATTACK →';
 const feedback=s.humanCallFeedback;const callText=feedback&&feedback.until>Time.time?feedback.text:'';
 if($('call-feedback').textContent!==callText)$('call-feedback').textContent=callText;
 const labels={kickoff:'KICK OFF',goal:s.goalScoredTeam==='A'?'GOAL!':'BLUE SCORES',halftime:'HALF TIME · SWITCH ENDS',corner:'CORNER',throwin:'THROW IN',freekick:'FREE KICK',goalkick:'GOAL KICK',penalty:'PENALTY',foul:'FOUL',card:s.cardType==='red'?'RED CARD':'YELLOW CARD'};
 const label=labels[s.matchState]||'';
 if($('announcement').textContent!==label)$('announcement').textContent=label;
}
function loop(now){
 try{
  const dt=Math.min(.12,(now-lastFrame)/1000||0);lastFrame=now;
  if(match&&!paused&&view==='play'){
   accumulator+=dt;while(accumulator>=.05){match.step();accumulator-=.05;if(match.finished||match.player.isSentOff){overlay('finished');break;}}
   updateHud();
  }
  paint();
 }catch(e){paused=true;toast(`Match paused: ${e.message}`);}
 raf=requestAnimationFrame(loop);
}
function pointerAim(e){
 if(!input||e.pointerType==='touch'||view!=='play')return;
 const canvas=$('pitch'),r=canvas.getBoundingClientRect();
 const sx=(e.clientX-r.left)*canvas.width/r.width,sy=(e.clientY-r.top)*canvas.height/r.height;
 const w=Utils.worldDeltaFromScreenDelta(sx-Settings.camera.offsetX,sy-Settings.camera.offsetY);
 input.aim={x:w.ox-match.player.x,y:w.oy-match.player.y};
}
function bindTouch(){
 const stick=$('joystick'),nub=$('stick-nub');
 const clearStick=()=>{stickPointer=null;stickOrigin=null;nub.style.transform='translate(0px,0px)';if(input)input.move=null;};
 const move=e=>{
  if(e.pointerId!==stickPointer||!input||!stickOrigin)return;e.preventDefault();
  let x=e.clientX-stickOrigin.x,y=e.clientY-stickOrigin.y;const len=Math.hypot(x,y),limit=36;
  if(len>limit){x=x/len*limit;y=y/len*limit;}
  nub.style.transform=`translate(${x}px,${y}px)`;input.move={x:x/limit,y:y/limit};input.aim=null;
 };
 stick.addEventListener('pointerdown',e=>{if(!input||view!=='play')return;e.preventDefault();stickPointer=e.pointerId;const r=stick.getBoundingClientRect();stickOrigin={x:r.left+r.width/2,y:r.top+r.height/2};stick.setPointerCapture(e.pointerId);move(e);});
 stick.addEventListener('pointermove',move);stick.addEventListener('pointerup',clearStick);stick.addEventListener('pointercancel',clearStick);stick.addEventListener('lostpointercapture',clearStick);
 for(const button of document.querySelectorAll('[data-key]')){
  const code=button.dataset.key;
  const release=e=>{e.preventDefault();input?.release(code);button.classList.remove('held');};
  button.addEventListener('pointerdown',e=>{if(!input||view!=='play')return;e.preventDefault();button.setPointerCapture(e.pointerId);input.press(code);button.classList.add('held');});
  button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
 }
}
function on(target,event,fn){target.addEventListener(event,fn);cleanups.push(()=>target.removeEventListener(event,fn));}
function init(){
 configureFive(false);
 try{const saved=localStorage.getItem('soccer-five-character');if(CHARACTERS.some(c=>c.id===saved))selected=saved;}catch(_){}
 showSelection();
 on(document,'click',async e=>{
  const character=e.target.closest('[data-character]');
  if(character&&!loading){selected=character.dataset.character;for(const el of document.querySelectorAll('[data-character]')){el.classList.toggle('selected',el===character);el.setAttribute('aria-pressed',String(el===character));}return;}
  const action=e.target.closest('[data-action]')?.dataset.action;
  if(action==='play'||action==='restart')await start();
  else if(action==='choose')showSelection();
  else if(action==='pause')overlay('paused');
  else if(action==='resume')resume();
  else if(action==='sound'){sound=!sound;Settings.soundsMuted=!sound;$('sound').innerHTML=icon(sound?'sound':'muted');$('sound').setAttribute('aria-label',sound?'Mute sound':'Enable sound');if(sound)SoundDB.resume();else SoundDB.stopCrowd();}
  else if(action==='fullscreen'){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch(_){toast('Fullscreen is unavailable in this browser.');}}
 });
 on(window,'keydown',e=>{if(e.code==='Escape'&&match&&!match.finished){e.preventDefault();if(paused)resume();else overlay('paused');}});
 on(window,'blur',()=>{input?.reset();if(match&&view==='play')overlay('paused');});
 on(document,'visibilitychange',()=>{if(document.hidden&&match&&view==='play')overlay('paused');});
 on($('pitch'),'pointermove',pointerAim);
 on($('pitch'),'contextmenu',e=>e.preventDefault());
 on($('pitch'),'pointerdown',e=>{if(!input||view!=='play'||e.pointerType==='touch')return;e.preventDefault();pointerAim(e);$('pitch').setPointerCapture(e.pointerId);input.press(e.button===2?'Digit3':'Digit1');});
 on($('pitch'),'pointerup',e=>{input?.release(e.button===2?'Digit3':'Digit1');});
 on($('pitch'),'pointercancel',()=>input?.reset());
 bindTouch();lastFrame=performance.now();raf=requestAnimationFrame(loop);
}
document.addEventListener('DOMContentLoaded',init);
module.exports={portrait};
