const {FiveMatch,CHARACTERS,configureFive,loadKits}=require('../../five/match.js');
const {FantasyRun,RUN_LENGTH,GOBLIN_TEAM,ORC_BROTHERS,SHAPESHIFTERS,OPPONENTS}=require('../../five/cup.js');
const {ARC_BEND_TICKS,RECRUIT_POWERS,GOAL_WARP,goalWarpTarget,bargeReach,bargeDirection,SPIN_RADIUS,SPIN_DURATION}=require('../../five/powers.js');
const {Settings}=require('../../settings.js');
const {Application}=require('../../engine.js');
const {Utils}=require('../../core/lib/utils.js');
const {Pitch}=require('../../core/entities/pitch.js');
const {SoundDB}=require('../../core/lib/sounddb.js');
const {Time,LOGIC_DT}=require('../../core/lib/time.js');
const {clearManualCharge,getManualChargePower}=require('../../core/lib/manual_control.js');
const {SMOKE_RADIUS}=require('../../five/hazards.js');
const {holdPower01}=require('../../core/lib/manual_commands.js');
const $=id=>document.getElementById(id);
let practice=false,run=null,testMode=false,activeOpponent=null,match=null,input=null,paused=false,loading=false,lastFrame=0,accumulator=0,preview=null,selected='cole',sound=true,view='select',raf=0,stickPointer=null,stickOrigin=null;
const starterClasses={price:['barge','spin','blaze'],cole:['dash','smoke'],mendes:['arc','tele','portal','warp']};
const drills={barge:'price',spin:'spin-kick',dash:'cole',arc:'mendes',tele:'tele-pass',portal:'portal-pass',warp:'goal-warp',smoke:'smoke-bomb',blaze:'blaze-slide'};
let starterPowers={},tavernPreview=null;
const cleanups=[];
const matchup={home:1,away:1,homeKeeper:false,awayKeeper:false};
const practiceOpponent={name:'PRACTICE',color:'#a4b763'};
const testOpponent={...OPPONENTS[0],name:'TEST OPPONENTS'};
const testEncounters={slimers:GOBLIN_TEAM,orcs:ORC_BROTHERS,shifters:SHAPESHIFTERS};
let testEncounter='custom';

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function portrait(c){
 const headgear={
  price:'<path d="m63 51-13-8 10 21m57-13 13-8-10 21" fill="#799653"/><path d="m77 71 4-8 3 11m12 0 3-11 4 8" fill="#fff0cf"/>',
  cole:'<path d="M56 63 54 38 66 20 91 8 116 22 126 45 123 67 111 48 104 36 76 40 67 61Z" fill="#473257"/><path d="M65 62q25 9 51 0l-7 17q-20 13-39-3Z" fill="#473257"/>',
  mendes:'<path d="m63 45 65-2-23-12-6-11 9-17-24 11-13 19-22 8Z" fill="#594478"/><path d="m70 66 20 4 21-4-8 24-13 12-12-17Z" fill="#e5dfde"/>',
  kowalski:'<path d="M61 46 63 26 80 15h26l15 15v17h-9l-5-10H76l-8 12Z" fill="#c9b28c"/>'
 }[c.id]||'';
 return `<svg viewBox="0 0 180 190" aria-hidden="true" class="portrait"><ellipse cx="90" cy="185" rx="58" ry="8" fill="#000" opacity=".2"/><path d="M65 75 L44 86 19 126 41 141 58 114 57 190H123L122 114 139 141 161 126 136 86 115 75Z" fill="#e8af3c"/><path d="M19 126L41 141 35 160Q28 168 20 159L12 145Z M161 126L139 141 145 160Q152 168 160 159L168 145Z" fill="${c.skin}"/><path d="M71 66V84Q90 100 109 84V66" fill="${c.skin}"/><path d="M65 75Q90 97 115 75L111 89Q90 108 69 89Z" fill="#1d292c"/><path d="M58 109L51 94M122 109L129 94" stroke="#f4d277" stroke-width="4"/><path d="M59 43Q60 14 90 14Q120 14 121 43L116 64Q111 81 90 82Q69 81 64 64Z" fill="${c.skin}"/><path d="M60 47V33Q62 9 90 11Q119 10 121 34V47L112 34Q93 40 76 30L68 49Z" fill="${c.hair}"/><path d="M78 57h4m16 0h4" stroke="#30271f" stroke-width="3" stroke-linecap="round"/><path d="M84 70q6 3 12 0" fill="none" stroke="#7d4f3e" stroke-width="2"/>${headgear}<text x="90" y="163" fill="#1b292d" font-family="Impact,Arial Black,sans-serif" font-size="54" text-anchor="middle">${c.number}</text><path d="M60 184H120" stroke="#f4cf68" stroke-width="3"/></svg>`;}
function icon(name){const paths={barge:'<path d="M3 12h14m-5-5 5 5-5 5M3 7h4M3 17h4m13-9v8"/>',dash:'<path d="m13 2-8 12h6l-1 8 9-12h-6l1-8Z"/>',smoke:'<path d="M5 19a4 4 0 0 1 0-8 5 5 0 0 1 9-4 6 6 0 0 1 4 12ZM8 23h8"/>',blaze:'<path d="M12 2c2 5 6 6 6 12a6 6 0 1 1-12 0c0-3 2-6 4-7 0 3 2 3 2 3Z"/>',spin:'<path d="M20 9a8 8 0 1 0 0 6m-5-5 5-1 1-5"/>',warp:'<path d="M5 19V6h14v13M9 12h6m-2-2 2 2-2 2"/>',portal:'<path d="M5 3c-4 2-4 16 0 18m14-18c4 2 4 16 0 18M6 12h12m-4-4 4 4-4 4"/>',tele:'<path d="M6 18a3 3 0 1 0 0 .01M9 15l8-8m-4 0h4v4M20 7a3 3 0 1 0 0 .01"/>',arc:'<path d="M3 18C3 5 13 3 20 8m-1-5 1 5-5 1"/>',pause:'<path d="M8 5v14M16 5v14"/>',sound:'<path d="M4 9h4l5-4v14l-5-4H4zM17 8q5 4 0 8"/>',muted:'<path d="M4 9h4l5-4v14l-5-4H4zM17 9l5 6m0-6l-5 6"/>',expand:'<path d="M4 9V4h5m6 0h5v5m0 6v5h-5M9 20H4v-5"/>'};return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[name]||''}</svg>`;}
function toast(text){$('message').textContent=text;}
function showSelection(){
 view='select';paused=false;loading=false;practice=false;run=null;testMode=false;tavernPreview=null;
 starterPowers=Object.fromEntries(Object.entries(starterClasses).map(([id,powers])=>[id,powers[Math.floor(Math.random()*powers.length)]]));
 if(!starterPowers[selected])selected='cole';
 if(match){match.destroy();match=null;input=null;}
 SoundDB.stopCrowd();
 $('hud').hidden=true;$('touch').hidden=true;$('overlay').hidden=false;
 $('overlay').innerHTML=`<div class="selection"><div class="selection-top"><span class="wordmark">SPELLSIDE<span> / CUP</span></span><span class="edition">SOLO START</span></div><div class="selection-heading"><p class="kicker">PICK YOUR PLAYER TO START</p><h1>Spellside Cup</h1></div><div class="characters">${CHARACTERS.filter(c=>starterPowers[c.id]).map(c=>`<button class="character ${selected===c.id?'selected':''}" style="--accent:${c.color}" data-character="${c.id}" aria-pressed="${selected===c.id}"><span class="character-role">${c.role}</span><span class="character-art">${portrait(c)}<span class="jersey-number">${c.number}</span></span><span class="character-name">${c.short}</span><span class="full-name">${esc(c.name)}</span><span class="character-trait">${RECRUIT_POWERS[starterPowers[c.id]].name}</span></button>`).join('')}</div><div class="selection-bottom"><div class="selection-controls"><span><kbd>W A S D</kbd> Move</span><span><kbd>J</kbd> Pass / tackle</span><span><kbd>K</kbd> Hold to shoot</span><span><kbd>Tab</kbd> Switch defender</span><span><kbd>SPACE</kbd> Power</span><span><kbd>⇧</kbd> Sprint</span></div><div class="start-actions"><button class="secondary" data-action="practice">ABILITIES</button><button class="secondary" data-action="matchup">TEST MATCH</button><button class="play" data-action="play">NEW RUN <span>↗</span></button></div></div><div class="selection-foot"><span>Mouse aims · Left click passes / tackles · Right click shoots / shoves · Hold and release to power kicks</span></div></div>`;
 $('message').textContent='';
 }
function showMatchup(){
 view='matchup';
 const sizes=(selected)=>Array.from({length:5},(_,i)=>`<option value="${i+1}" ${selected===i+1?'selected':''}>${i+1}</option>`).join('');
 $('overlay').innerHTML=`<section class="match-overlay matchup-menu"><h1>Test match</h1>
 <label for="test-encounter">Encounter</label>
 <select id="test-encounter"><option value="custom" ${testEncounter==='custom'?'selected':''}>Custom</option>
 <option value="slimers" ${testEncounter==='slimers'?'selected':''}>Goblin Slimers · Golden goal</option>
 <option value="orcs" ${testEncounter==='orcs'?'selected':''}>Orc Brothers · First to 2</option>
 <option value="shifters" ${testEncounter==='shifters'?'selected':''}>Shapeshifters</option></select>
 <div class="matchup-fields">
 <div><label for="test-home">Your players</label><select id="test-home">${sizes(matchup.home)}</select>
 <label class="keeper-choice"><input type="checkbox" id="test-home-keeper" ${matchup.homeKeeper?'checked':''}> Include keeper</label></div>
 <div id="test-away-options"><label for="test-away">Opponents</label><select id="test-away">${sizes(matchup.away)}</select>
 <label class="keeper-choice"><input type="checkbox" id="test-away-keeper" ${matchup.awayKeeper?'checked':''}> Include keeper</label></div>
 </div><p class="matchup-note">A keeper takes one slot and needs at least one outfielder.</p>
 <div class="overlay-buttons"><button class="play" data-action="test-play">PLAY MATCH</button>
 <button class="text-button" data-action="choose">BACK</button></div></section>`;
 const syncKeeper=(side)=>{
  const size=$('test-'+side),keeper=$('test-'+side+'-keeper');
  keeper.disabled=Number(size.value)<2;
  size.addEventListener('change',()=>{keeper.disabled=Number(size.value)<2;});
 };
 syncKeeper('home');syncKeeper('away');
 const encounter=$('test-encounter');
 const syncEncounter=()=>{$('test-away-options').hidden=!!testEncounters[encounter.value];};
 encounter.addEventListener('change',syncEncounter);syncEncounter();
 encounter.focus();
}
function hud(){
 $('hud').innerHTML=`<div class="hud-brand" id="round-label">${practice?'PRACTICE':testMode?'TEST MATCH':`${run.opponent.boss?'BOSS':'RUN'} · ${run.round+1}/${RUN_LENGTH}`}</div><div id="scoreboard" class="scoreboard" ${practice?"hidden":""}><span class="team-label home">SPELLSIDE</span><b id="home-score">0</b><span class="score-divider">:</span><b id="away-score">0</b><span class="team-label away" style="color:${activeOpponent.color}">${activeOpponent.name}</span><span id="clock">${match.sim.goalTarget===1?'GOLDEN GOAL':`FIRST TO ${match.sim.goalTarget}`}</span></div><div class="hud-actions"><button data-action="sound" id="sound" aria-label="Mute sound">${icon(sound?'sound':'muted')}</button><button data-action="fullscreen" aria-label="Toggle fullscreen">${icon('expand')}</button><button data-action="pause" aria-label="Pause match">${icon('pause')}</button></div><div class="player-hud"><span id="call-feedback" role="status" aria-live="polite"></span><span class="player-number" id="player-number"></span><div class="player-identity"><b id="player-name"></b><span id="direction">ATTACK →</span><span id="player-power" class="power-chip" hidden><span id="power-icon" class="power-glyph"></span><span id="power-name"></span><span id="power-timer"></span><span id="power-level" hidden>LV 2</span></span></div><div class="condition-bars"><label>SPRINT <meter id="stamina" min="0" max="1" low=".25" optimum="1" value="1"></meter></label><label id="power-label"><span id="power-text">KICK POWER</span><meter id="charge" min="0" max="1" value="0"></meter></label></div></div><div class="desktop-controls"><span><kbd>WASD</kbd> MOVE</span><span><kbd>J</kbd> PASS / TACKLE</span><span><kbd>K</kbd> HOLD TO SHOOT</span><span><kbd>L</kbd> LOB</span><span><kbd>Tab</kbd> SWITCH</span>${match.sim.teamA.getGoalkeeper()?' <span><kbd>G</kbd> KEEPER</span>':''}<span><kbd>SPACE</kbd> POWER</span><span><kbd>⇧</kbd> SPRINT</span></div><div id="announcement" aria-live="polite"></div>${practice?`<div class="practice-controls"><div class="practice-buttons">${tavernPreview?'<button data-action="back-tavern">Back to tavern</button>':`<button data-practice-player="cole" aria-pressed="${match.practiceCharacter==='cole'}">Shadow Step · Nyx</button><button data-practice-player="mendes" aria-pressed="${match.practiceCharacter==='mendes'}">Arc Pass · Rune</button><button data-practice-player="tele-pass" aria-pressed="${match.practiceCharacter==='tele-pass'}">Tele-Pass · Rune</button><button data-practice-player="portal-pass" aria-pressed="${match.practiceCharacter==='portal-pass'}">Portal Pass · Rune</button><button data-practice-player="goal-warp" aria-pressed="${match.practiceCharacter==='goal-warp'}">Goal Warp · Rune</button><button data-practice-player="price" aria-pressed="${match.practiceCharacter==='price'}">Orc Barge · Grum</button><button data-practice-player="spin-kick" aria-pressed="${match.practiceCharacter==='spin-kick'}">Orc Spin · Grum</button><button data-practice-player="smoke-bomb" aria-pressed="${match.practiceCharacter==='smoke-bomb'}">Smoke Bomb · Nyx</button><button data-practice-player="blaze-slide" aria-pressed="${match.practiceCharacter==='blaze-slide'}">Blaze Slide · Grum</button>`}</div><div id="practice-levels" class="practice-buttons" hidden><button id="practice-level-1" data-practice-level="1">Level 1</button><button id="practice-level-2" data-practice-level="2">Level 2</button></div><div id="practice-tip"></div><label class="practice-cooldowns"><input id="cooldowns-off" type="checkbox" ${match.sim.cooldownsOff?'checked':''}> Disable cooldowns</label></div>`:''}`;
 $('hud').hidden=false;
 $('touch').hidden=false;
 const keeperButton=$('touch-keeper');if(keeperButton)keeperButton.hidden=!match.sim.teamA.getGoalkeeper();
}
async function start(practiceDrill){
 if(loading)return;loading=true;paused=true;toast('Loading pitch…');
 if(!practice&&!testMode&&!run)run=new FantasyRun(Date.now(),selected,starterPowers[selected]);
 activeOpponent=practice?practiceOpponent:testMode?(testEncounters[testEncounter]||testOpponent):run.opponent;
 try{
  if(match){match.destroy();match=null;input=null;}
  SoundDB.stopCrowd();SoundDB.resume();match=await FiveMatch.create(tavernPreview?.characterId??selected,run?.matchSeed??Date.now(),{
   squad:true,practice,practiceDrill:practiceDrill??drills[tavernPreview?.power],practicePreview:tavernPreview,starterPower:testMode?starterPowers[selected]:undefined,rested:!practice&&run?.rested,opponent:practice?undefined:activeOpponent,
   roster:practice?undefined:run?.roster,matchup:testMode?{
    ...matchup,away:activeOpponent.count??matchup.away,awayKeeper:activeOpponent.keeper??matchup.awayKeeper
   }:undefined
  });Settings.soundsMuted=!sound;
  await loadKits(practice?undefined:activeOpponent,practice?undefined:run?.roster);
  // The custom selection marker replaces debug/AI rings in this mode only.
  for(const p of match.sim.players){
   p.preRender=()=>{};
   const render=p.render.bind(p);
   p.render=g=>{
    const burning=p.burningUntil>Time.time;
    if(burning){
     g.save();g.shadowColor='#ff2919';g.shadowBlur=15;
     const at=Utils.toScreen(p.x,p.y);
     g.fillStyle='#ff3b2770';
     g.beginPath();g.ellipse(at.x,at.y,Settings.camera.scale*.8,Settings.camera.scale*.34,0,0,Math.PI*2);g.fill();
    }
    if(p.isSlimer)paintSlimer(g,p);else render(g);
    if(burning)g.restore();
   };
  }
  input=match.input;input.gameSurface=$('pitch');input.attach(window);input.resolvePointerAim=pointerAim;
  try{localStorage.setItem('soccer-five-character',selected);}catch(_){}
  match.introUntil=practice?0:Time.time+1.35;
  paused=false;loading=false;view='play';$('overlay').hidden=true;hud();toast('');
  accumulator=0;lastFrame=performance.now();$('pitch').focus({preventScroll:true});
 }catch(e){
  if(match){match.destroy();match=null;input=null;}
  loading=false;view='loading-error';$('overlay').hidden=false;$('hud').hidden=true;
  $('overlay').innerHTML=`<div class="match-overlay"><button class="play" data-action="retry">RETRY MATCH</button><button class="text-button" data-action="${tavernPreview?'back-tavern':'choose'}">${tavernPreview?'BACK TO TAVERN':'BACK TO MENU'}</button></div>`;
  toast(`Could not start: ${e.message}`);
 }
}
function overlay(kind){
 view=kind;paused=true;input?.reset();if(match){clearManualCharge(match.sim);match.sim.arcCast=null;match.sim.teleCast=null;}
 $('touch').hidden=true;$('overlay').hidden=false;
 if(kind==='paused'){
  $('overlay').innerHTML=`<div class="match-overlay"><h1>Paused</h1><div class="overlay-buttons"><button class="play" data-action="resume">RESUME</button><button class="text-button" data-action="${tavernPreview?'back-tavern':'choose'}">${tavernPreview?'BACK TO TAVERN':practice?'LEAVE PRACTICE':testMode?'LEAVE TEST MATCH':'ABANDON RUN'}</button></div></div>`;
 }else{
  const {scoreA,scoreB}=match.sim;
  if(testMode){
   $('overlay').innerHTML=`<div class="match-overlay"><h1>Match over</h1><div class="final-score"><strong>${scoreA} : ${scoreB}</strong></div><div class="overlay-buttons"><button class="play" data-action="retry">REMATCH</button><button class="text-button" data-action="matchup">CHANGE MATCHUP</button></div></div>`;
   $('overlay').querySelector?.('button')?.focus();
   return;
  }
  run.finish(scoreA,scoreB);
  if(run.status==='between'){showBetweenMatches(scoreA,scoreB);return;}
  $('overlay').innerHTML=`<div class="match-overlay"><h1>Run won</h1><div class="final-score"><strong>${scoreA} : ${scoreB}</strong></div><p>${run.gold} gold</p><div class="overlay-buttons"><button class="play" data-action="choose">NEW RUN</button></div></div>`;

 }
 $('overlay').querySelector?.('button')?.focus();
}
function showBetweenMatches(scoreA,scoreB){
 view='between';paused=true;
 $('hud').hidden=true;$('touch').hidden=true;$('overlay').hidden=false;
 const train=run.trainable.map(({player,index})=>`<button class="secondary" data-train="train-${index}">Train ${esc(player.name)} <span>${RECRUIT_POWERS[player.power].name} · Level 2</span></button>`).join('');
 $('overlay').innerHTML=`<section class="tavern between-matches"><header><h1>${run.lastWin?'Win':'Loss'}</h1><div><strong>${run.gold} gold</strong> <span>${run.goldChange>=0?'+':''}${run.goldChange}</span></div></header>
 <p class="tavern-next">${scoreA} : ${scoreB} · ${run.lastWin?'Next':'Rematch'} · ${esc(run.nextOpponent.name)}</p>
 <div class="tavern-actions"><button class="secondary" data-action="enter-tavern" ${run.roster.length>=5?'disabled':''}>Tavern</button><button class="secondary" data-action="rest">Rest <span>2× sprint stamina next match</span></button>${train||'<button class="secondary" disabled>Train</button>'}<button class="play" data-action="continue">${run.lastWin?'NEXT MATCH':'REMATCH'}</button></div></section>`;
 $('overlay').querySelector?.('button:not([disabled])')?.focus();
}
function showTavern(){
 view='tavern';paused=true;
 $('hud').hidden=true;$('touch').hidden=true;$('overlay').hidden=false;
 const stats=[['speed','Pace'],['shooting','Shot'],['passing','Pass'],['tackling','Tackle'],['stamina','Stamina']];
 $('overlay').innerHTML=`<section class="tavern"><header><h1>Tavern</h1><div><strong>${run.gold} gold</strong> <span>${run.goldChange>=0?'+':''}${run.goldChange}</span></div></header>
 <p class="tavern-next">${run.lastWin?'Next':'Rematch'} · ${esc(run.nextOpponent.name)}</p>
 <div class="tavern-recruits">${run.offers.map(recruit=>{
  const base=CHARACTERS.find(c=>c.id===recruit.characterId);
  const power=RECRUIT_POWERS[recruit.power];
  return `<article class="tavern-card tier-${recruit.rarity}"><div class="tavern-player"><span class="tavern-portrait" aria-hidden="true" style="background-position:${recruit.portrait%5*25}% ${Math.floor(recruit.portrait/5)*50}%"></span><div><span class="character-role">${base.role}</span><h2>${esc(recruit.name)}</h2></div></div>
  <span class="tavern-power">${power?power.name:'No ability'}</span>
  <dl>${stats.map(([id,label])=>`<div><dt>${label}</dt><dd>${recruit.stats[id]}</dd></div>`).join('')}</dl>
  <button class="secondary" data-hire="${recruit.id}" ${run.gold<recruit.price||run.roster.length>=5?'disabled':''}>Buy · ${recruit.price} gold</button>
  ${power?`<button class="text-button" data-preview="${recruit.id}">Practice ability</button>`:''}</article>`;
 }).join('')}</div>
 <div class="tavern-actions"><button class="play" data-action="continue">${run.lastWin?'NEXT MATCH':'REMATCH'}</button></div></section>`;
 $('overlay').querySelector?.('button:not([disabled])')?.focus();
}
function resume(){if(!match||match.finished||view!=='paused')return;paused=false;view='play';input.reset();$('overlay').hidden=true;$('touch').hidden=false;lastFrame=performance.now();$('pitch').focus({preventScroll:true});}
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
function paintSlimer(g,p){
 if(p.isSentOff)return;
 const keeper=p.role==='GK';
 const scale=Settings.camera.scale*(keeper?1.35:1),feet=Utils.toScreen(p.x,p.y,p.z||0);
 const wobble=Math.sin(Time.time*8+p.formationIndex)*.09;
 g.fillStyle='#08160f88';
 g.beginPath();g.ellipse(feet.x,feet.y,scale*.83,scale*.3,0,0,Math.PI*2);g.fill();
 g.fillStyle=keeper?'#6ec9ad':p.slimeWindup?'#b5f17a':'#77c455';
 g.strokeStyle='#263f27';g.lineWidth=2;
 g.beginPath();g.ellipse(feet.x,feet.y-scale*.56,scale*(.82+wobble),scale*(.68-wobble),0,0,Math.PI*2);g.fill();g.stroke();
 g.fillStyle='#182b22';
 g.beginPath();
 g.arc(feet.x-scale*.24,feet.y-scale*.74,scale*.085,0,Math.PI*2);
 g.moveTo(feet.x+scale*.32,feet.y-scale*.74);
 g.arc(feet.x+scale*.24,feet.y-scale*.74,scale*.085,0,Math.PI*2);
 g.fill();
}
function paintSlimeShots(g,sim,dpr){
 for(const slimer of sim.teamB.players){
  const windup=slimer.slimeWindup;
  if(!windup)continue;
  const from=Utils.toScreen(slimer.x,slimer.y,.55);
  const to=Utils.toScreen(slimer.x+windup.dx*5,slimer.y+windup.dy*5,.55);
  g.strokeStyle='#c8f581b0';g.lineWidth=2*dpr;
  g.setLineDash([4*dpr,5*dpr]);
  g.beginPath();g.moveTo(from.x,from.y);g.lineTo(to.x,to.y);g.stroke();
  g.setLineDash([]);
 }
 for(const shot of sim.slimeShots||[]){
  const point=Utils.toScreen(shot.x,shot.y,.55);
  const tail=Utils.toScreen(shot.x-shot.dx*.85,shot.y-shot.dy*.85,.55);
  g.strokeStyle='#70ce627a';g.lineWidth=6*dpr;g.lineCap='round';
  g.beginPath();g.moveTo(tail.x,tail.y);g.lineTo(point.x,point.y);g.stroke();
  g.fillStyle='#cafa84';g.strokeStyle='#285434';g.lineWidth=1.5*dpr;
  g.beginPath();g.arc(point.x,point.y,7*dpr,0,Math.PI*2);g.fill();g.stroke();
 }
 g.lineCap='butt';
}
function paintAbilityHazards(g,sim,dpr){
 for(const trail of sim.blazeTrails??[]){
  const a=Utils.toScreen(trail.from.x,trail.from.y),b=Utils.toScreen(trail.to.x,trail.to.y);
  g.strokeStyle=trail.until-Time.time<.5?'#e8754866':'#f96737b5';g.lineWidth=6*dpr;g.lineCap='round';
  g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.stroke();
 }
 g.lineCap='butt';
 for(const cloud of sim.smokeClouds??[]){
  const at=Utils.toScreen(cloud.x,cloud.y);
  const radius=SMOKE_RADIUS*Settings.camera.scale;
  g.fillStyle='#92a1ab6b';
  g.beginPath();g.ellipse(at.x,at.y,radius,radius*.8,0,0,Math.PI*2);g.fill();
  g.fillStyle='#66768177';
  g.beginPath();g.ellipse(at.x,at.y-radius*.1,radius*.76,radius*.59,0,0,Math.PI*2);g.fill();
 }
}
function paintPracticeFires(g,fires){
 const scale=Settings.camera.scale;
 for(const [i,fire] of fires.entries()){
  if(fire.relightAt>Time.time)continue;
  const {x,y}=Utils.toScreen(fire.x,fire.y);
  const flicker=.85+Math.sin(Time.time*13+i)*.15;
  g.fillStyle='#f9733255';
  g.beginPath();g.ellipse(x,y,scale*.85,scale*.32,0,0,Math.PI*2);g.fill();
  for(const [width,height,color] of [[.56,1.15,'#f66e38'],[.29,.68,'#ffce65']]){
   g.fillStyle=color;g.beginPath();
   g.moveTo(x-width*scale,y);
   g.quadraticCurveTo(x-width*scale,y-scale*.46,x+width*scale*.3,y-height*scale*flicker);
   g.quadraticCurveTo(x+width*scale,y-scale*.54,x+width*scale,y);
   g.quadraticCurveTo(x,y+scale*.28,x-width*scale,y);g.fill();
  }
 }
}
function paintBargeWindups(g,sim,dpr){
 for(const orc of sim.teamB.players){
  const windup=orc.bargeWindup;
  if(!windup)continue;
  const start=Utils.toScreen(orc.x,orc.y);
  const end=Utils.toScreen(orc.x+windup.dx*windup.remaining,orc.y+windup.dy*windup.remaining);
  g.strokeStyle='#fa985e';g.lineWidth=3*dpr;
  if(Time.time<windup.until)g.setLineDash([5*dpr,4*dpr]);
  g.beginPath();g.moveTo(start.x,start.y);g.lineTo(end.x,end.y);g.stroke();
  g.setLineDash([]);
 }
}
function paintBargeLine(g,player,dir,length,dpr){
 const {width,height}=Utils.getFieldBounds();
 const a=Utils.toScreen(player.x,player.y),b=Utils.toScreen(
  Math.max(.45,Math.min(width-.45,player.x+dir.x*length)),
  Math.max(.45,Math.min(height-.45,player.y+dir.y*length)));
 g.strokeStyle='#63d4e8b0';g.lineWidth=2*dpr;
 g.setLineDash([6*dpr,4*dpr]);
 g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.stroke();g.setLineDash([]);
}
function paintPitchBoards(g,sim,dpr){
 const {ball}=sim;
 const board=(x1,y1,x2,y2)=>{
  const start=Utils.toScreen(x1,y1),end=Utils.toScreen(x2,y2);
  const topStart=Utils.toScreen(x1,y1,.45),topEnd=Utils.toScreen(x2,y2,.45);
  g.fillStyle='#152b27';g.strokeStyle='#77948a';g.lineWidth=dpr;
  g.beginPath();g.moveTo(start.x,start.y);g.lineTo(end.x,end.y);
  g.lineTo(topEnd.x,topEnd.y);g.lineTo(topStart.x,topStart.y);g.closePath();g.fill();g.stroke();
 };
 for(const y of [0,ball.maxY])board(0,y,ball.maxX,y);
 for(const goal of Object.values(sim.getGoals())){
  board(goal.lineX,0,goal.lineX,goal.yMin);
  board(goal.lineX,goal.yMax,goal.lineX,ball.maxY);
 }
}
function paint(){
 const {canvas,g,dpr}=camera();
 g.fillStyle='#121c20';g.fillRect(0,0,canvas.width,canvas.height);
 g.imageSmoothingEnabled=false;
 const active=match?.sim;
 if(active){
  active.renderAll(g);
  paintAbilityHazards(g,active,dpr);
  if(active.practiceFires?.length)paintPracticeFires(g,active.practiceFires);
  paintPitchBoards(g,active,dpr);
  if(active.slimeShots?.length||active.opponent?.slimers||match.practiceCharacter==='spin-kick')paintSlimeShots(g,active,dpr);
  for(const player of active.teamA.players){
   if(player.isSentOff||!(player.spinUntil>Time.time))continue;
   const progress=1-(player.spinUntil-Time.time)/SPIN_DURATION;
   g.strokeStyle=player.powerColor;g.lineWidth=4*dpr;g.globalAlpha=1-progress;
   g.beginPath();
   for(let i=0;i<=24;i++){
    const angle=(progress+i/32)*Math.PI*2;
    const at=Utils.toScreen(player.x+Math.cos(angle)*SPIN_RADIUS,player.y+Math.sin(angle)*SPIN_RADIUS,.22);
    if(i===0)g.moveTo(at.x,at.y);else g.lineTo(at.x,at.y);
   }
   g.stroke();g.globalAlpha=1;
  }
  if(active.bargeCharge){
   const {player,dir,remaining}=active.bargeCharge;
   paintBargeLine(g,player,dir,remaining,dpr);
  }
  if(active.opponent?.orcBrothers)paintBargeWindups(g,active,dpr);
  const shooter=match.warpOpponent?.player;
  if(shooter?.shotAim&&active.ball.owner===shooter){
   const from=Utils.toScreen(active.ball.x,active.ball.y);
   const to=Utils.toScreen(shooter.shotAim.x,shooter.shotAim.y);
   g.strokeStyle='#ffa36e';g.lineWidth=2*dpr;g.setLineDash([5*dpr,5*dpr]);
   g.beginPath();g.moveTo(from.x,from.y);g.lineTo(to.x,to.y);g.stroke();g.setLineDash([]);
  }
  if(active.goalWarp){
   const {goal}=active.goalWarp;
   const a=Utils.toScreen(goal.lineX,goal.yMin),b=Utils.toScreen(goal.lineX,goal.yMax);
   g.strokeStyle='#b6a2ff';g.lineWidth=4*dpr;
   g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.stroke();
  }
  const effect=active.powerEffect;
  if(effect?.until>Time.time){
   const from=Utils.toScreen(effect.origin.x,effect.origin.y),to=Utils.toScreen(effect.x,effect.y);
   const remaining=(effect.until-Time.time)/.48;
   g.globalAlpha=remaining;
   g.strokeStyle=effect.color;g.lineWidth=4*dpr;
   g.beginPath();g.moveTo(from.x,from.y);g.lineTo(to.x,to.y);g.stroke();
   g.beginPath();g.ellipse(to.x,to.y,(18-10*remaining)*dpr,(9-4*remaining)*dpr,0,0,Math.PI*2);g.stroke();
   g.globalAlpha=1;
  }
  const ball=active.ball;
  if(active.arcAssist&&!ball.owner&&ball.lastKicker===active.arcAssist.wizard){
   const point=Utils.toScreen(ball.x,ball.y,ball.z);
   g.strokeStyle=active.arcAssist.wizard.powerColor;
   g.lineWidth=2*dpr;
   g.globalAlpha=.65;
   g.beginPath();
   active.arcAssist.trail.forEach((sample,i)=>{
    const at=Utils.toScreen(sample.x,sample.y,sample.z||0);
    if(i===0)g.moveTo(at.x,at.y);
    else g.lineTo(at.x,at.y);
   });
   g.stroke();g.globalAlpha=1;
   g.beginPath();g.ellipse(point.x,point.y,7*dpr,5*dpr,0,0,Math.PI*2);g.stroke();
  }
  const telePoints=active.teleCast
   ? [active.teleCast.first,active.teleCast.end].filter(Boolean)
   : [active.teleFlight?.route.end,active.teleFlight?.next].filter(Boolean);
  const teleTarget=telePoints[0];
  let previous=Utils.toScreen(ball.x,ball.y);
  for(const target of telePoints){
   const point=Utils.toScreen(target.x,target.y);
   g.strokeStyle='#b6a2ff';g.lineWidth=2*dpr;
   g.setLineDash([4*dpr,5*dpr]);g.beginPath();g.moveTo(previous.x,previous.y);g.lineTo(point.x,point.y);g.stroke();g.setLineDash([]);
   g.beginPath();g.ellipse(point.x,point.y,10*dpr,5*dpr,0,0,Math.PI*2);g.stroke();
   previous=point;
  }
  const portalExit=active.teleCast?.exit||active.teleFlight?.exit;
  const flash=active.portalFlash;
  if(portalExit||flash?.until>Time.time){
   const exit=portalExit||flash.exit;
   const point=Utils.toScreen(exit.x,exit.y);
   const heading=Utils.toScreen(exit.x+exit.dx*4,exit.y+exit.dy*4);
   g.strokeStyle='#f7baff';g.lineWidth=3*dpr;
   g.beginPath();g.ellipse(point.x,point.y,12*dpr,6*dpr,0,0,Math.PI*2);g.stroke();
   if(portalExit){
    g.beginPath();g.moveTo(point.x,point.y);g.lineTo(heading.x,heading.y);g.stroke();
   }else{
    const entry=Utils.toScreen(flash.entry.x,flash.entry.y);
    g.beginPath();g.ellipse(entry.x,entry.y,12*dpr,6*dpr,0,0,Math.PI*2);g.stroke();
   }
  }
  const arcPreview=active.arcCast?.flight?.preview;
  if(arcPreview){
   const points=arcPreview.map(sample=>Utils.toScreen(sample.x,sample.y,sample.z||0));
   const tip=points.at(-1),before=points.at(-2);
   const angle=Math.atan2(tip.y-before.y,tip.x-before.x);
   g.strokeStyle=active.arcCast.flight.shot?'#ffe1a0':active.arcCast.flight.clearance<1?'#ffa36e':active.arcCast.player.powerColor;g.lineWidth=3*dpr;
   g.beginPath();g.moveTo(points[0].x,points[0].y);
   for(const point of points.slice(1))g.lineTo(point.x,point.y);
   g.moveTo(tip.x-11*dpr*Math.cos(angle-.5),tip.y-11*dpr*Math.sin(angle-.5));
   g.lineTo(tip.x,tip.y);
   g.lineTo(tip.x-11*dpr*Math.cos(angle+.5),tip.y-11*dpr*Math.sin(angle+.5));
   g.stroke();
   g.lineWidth=1.5*dpr;g.beginPath();g.ellipse(tip.x,tip.y,9*dpr,5*dpr,0,0,Math.PI*2);g.stroke();
  }
  const p=match.player,point=Utils.toScreen(p.x,p.y),scale=Settings.camera.scale;
  if(!p.isSentOff){
   g.strokeStyle=p.slimedUntil>Time.time?'#b4ef70':p.powerColor||'#ffcd61';g.lineWidth=2*dpr;g.beginPath();g.ellipse(point.x,point.y,scale*.72,scale*.32,0,0,Math.PI*2);g.stroke();
   g.fillStyle=p.powerColor||'#ffcd61';g.beginPath();g.moveTo(point.x,point.y-scale*2.8);g.lineTo(point.x-scale*.25,point.y-scale*3.25);g.lineTo(point.x+scale*.25,point.y-scale*3.25);g.closePath();g.fill();
   const aim=input?.getAim();
   if(aim&&match.powerFor(p)?.icon==='barge'&&active.matchState==='play'&&!active.bargeCharge
     &&(active.cooldownsOff||p.powerReadyAt<=Time.time)){
    const dir=bargeDirection(active,p,{aimX:aim.x,aimY:aim.y,directPointerAim:!!input.pointer});
    paintBargeLine(g,p,dir,bargeReach(match.upgrades,p,active.ball),dpr);
   }else if(aim&&match.powerFor(p)===GOAL_WARP
     &&active.matchState==='play'&&(active.cooldownsOff||p.powerReadyAt<=Time.time)){
    const target=goalWarpTarget(active,p,{aimX:aim.x,aimY:aim.y,directPointerAim:!!input.pointer});
    if(target){
     const {goal,y,half}=target;
     const center=Utils.toScreen(goal.lineX,y),a=Utils.toScreen(goal.lineX,y-half),b=Utils.toScreen(goal.lineX,y+half);
     g.strokeStyle='#b6a2ff';g.lineWidth=2*dpr;g.setLineDash([4*dpr,5*dpr]);
     g.beginPath();g.moveTo(point.x,point.y);g.lineTo(center.x,center.y);g.stroke();g.setLineDash([]);
     g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.stroke();
    }
   }else if(aim&&active.ball.owner===p&&!arcPreview&&!teleTarget){
    const ball=active.ball,start=Utils.toScreen(ball.x,ball.y),end=Utils.toScreen(ball.x+aim.x,ball.y+aim.y);
    g.globalAlpha=.55;g.setLineDash([4*dpr,5*dpr]);g.beginPath();g.moveTo(start.x,start.y);g.lineTo(end.x,end.y);g.stroke();g.setLineDash([]);g.globalAlpha=1;
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
 const s=match.sim;
 $('home-score').textContent=s.scoreA;$('away-score').textContent=s.scoreB;
 const player=match.player,character=match.activeCharacter,ability=match.powerFor(player);
 const powerLabel=$('player-power');
 $('player-number').textContent=character.number;
 $('player-number').style.color=player.powerColor||'';
 $('player-name').textContent=character.short;
 powerLabel.hidden=!ability;
 $('power-level').hidden=player.powerLevel!==2;
 const hint=player.powerLevel===2?ability?.level2:ability?.hint;
 if(ability){
  const remaining=s.cooldownsOff?0:Math.max(0,player.powerReadyAt-Time.time);
  const graphic=$('power-icon'),timer=$('power-timer');
  if($('power-name').textContent!==ability.name)$('power-name').textContent=ability.name;
  const glyph=icon(ability.icon);
  if(graphic.innerHTML!==glyph)graphic.innerHTML=glyph;
  timer.textContent=ability.icon==='dash'&&player.shadowAgainUntil>Time.time?'DASH 2':s.goalWarp&&ability.name==='Goal Warp'?`${Math.ceil(s.goalWarp.until-Time.time)}s ACTIVE`:(s.arcCast?.player===player||s.teleCast?.player===player)?'ARMED':remaining?`${Math.ceil(remaining)}s`:'SPACE';
  powerLabel.classList.toggle('power-ready',!remaining);
  powerLabel.style.setProperty?.('--recharge',`${player.powerCooldown ? remaining/player.powerCooldown*100 : 0}%`);
  powerLabel.title=`${ability.name} · ${remaining?Math.ceil(remaining)+'s':hint}`;
 }
 if(practice){
  const tip=$('practice-tip');
  $('practice-levels').hidden=!ability?.level2;
  for(const level of [1,2])$('practice-level-'+level).setAttribute('aria-pressed',String(player.powerLevel===level));
  const text=hint||'';
  if(tip.textContent!==text)tip.textContent=text;
  tip.hidden=!text;
 }
 $('stamina').value=match.sprintReserve;
 const charge=s._manualCharge,arcTicks=s.arcCast?.ticks||0,portalTicks=s.teleCast?.shotTicks||0;
 const power=portalTicks?holdPower01(portalTicks):arcTicks?Math.min(1,arcTicks/ARC_BEND_TICKS):getManualChargePower(s);
 $('charge').value=power;
 $('power-text').textContent=portalTicks?`SHOT POWER ${Math.round(power*100)}%`:arcTicks?`BEND ${Math.round(power*100)}%`:charge?`${charge.action==='shoot'?'SHOT':'KICK'} POWER ${Math.round(power*100)}%`:'KICK POWER';
 $('power-label').classList.toggle('charging',!!charge||!!arcTicks||!!portalTicks);
 $('direction').textContent=player.slimedUntil>Time.time?`SLIMED · ${Math.ceil(player.slimedUntil-Time.time)}s`:player.role==='GK'?(s.ball.owner===player?'LEFT PASS · RIGHT CLEAR':'L · DIVE'):s.isSecondHalf()?'← ATTACK':'ATTACK →';
 const feedback=match.feedback;const callText=feedback&&feedback.until>Time.time?feedback.text:'';
 if($('call-feedback').textContent!==callText)$('call-feedback').textContent=callText;
 const labels={freekick:'FREE KICK',penalty:'PENALTY',foul:'FOUL',card:s.cardType==='red'?'RED CARD':'YELLOW CARD'};
 const goal=s.matchState==='goal',intro=!goal&&!practice&&Time.time<match.introUntil;
 const announcement=$('announcement');
 const label=goal?'Goal':intro?`Spellside vs ${activeOpponent.name}`:labels[s.matchState]||'';
 if(announcement.textContent!==label)announcement.textContent=label;
 announcement.classList.toggle('match-intro',intro);
 announcement.style.color=goal?(s.goalScoredTeam==='A'?'#f5bf50':activeOpponent.color):'';
}
function loop(now){
 try{
  const dt=Math.min(.12,(now-lastFrame)/1000||0);lastFrame=now;
  if(match&&!paused&&view==='play'){
   accumulator+=dt;while(accumulator>=LOGIC_DT){match.step();accumulator-=LOGIC_DT;if(match.finished){overlay('finished');break;}}
   updateHud();
  }
  paint();
 }catch(e){paused=true;toast(`Match paused: ${e.message}`);}
 raf=requestAnimationFrame(loop);
}
function pointerAim(e){
 const canvas=$('pitch'),r=canvas.getBoundingClientRect();
 const sx=(e.clientX-r.left)*canvas.width/r.width,sy=(e.clientY-r.top)*canvas.height/r.height;
 const w=Utils.worldDeltaFromScreenDelta(sx-Settings.camera.offsetX,sy-Settings.camera.offsetY);
 const ball=match.sim.ball,origin=ball.owner?.team==='A'?ball:match.player;
 return {x:w.ox-origin.x,y:w.oy-origin.y};
}
function bindTouch(){
 const stick=$('joystick'),nub=$('stick-nub');
 const clearStick=()=>{stickPointer=null;stickOrigin=null;nub.style.transform='translate(0px,0px)';if(input)input.move=null;};
 const move=e=>{
  if(e.pointerId!==stickPointer||!input||!stickOrigin)return;e.preventDefault();
  let x=e.clientX-stickOrigin.x,y=e.clientY-stickOrigin.y;const len=Math.hypot(x,y),limit=36;
  if(len>limit){x=x/len*limit;y=y/len*limit;}
  nub.style.transform=`translate(${x}px,${y}px)`;input.move={x:x/limit,y:y/limit};input.aim=null;input.pointer=null;
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
 on(document,'change',e=>{
  if(e.target.id!=='cooldowns-off'||!practice||!match)return;
  match.sim.cooldownsOff=e.target.checked;
 });
 on(document,'click',async e=>{
  if(loading)return;
  const level=e.target.closest('[data-practice-level]');
  if(level&&practice&&view==='play'&&match.powerFor(match.player)?.level2){
   const selectedLevel=Number(level.dataset.practiceLevel);
   if(selectedLevel!==match.player.powerLevel)match.resetPractice(match.practiceCharacter,selectedLevel);
   $('pitch').focus({preventScroll:true});
   return;
  }
  const player=e.target.closest('[data-practice-player]');
  if(player&&practice&&!tavernPreview&&view==='play'){
   match.resetPractice(player.dataset.practicePlayer);
   for(const button of document.querySelectorAll('[data-practice-player]')){
    button.setAttribute('aria-pressed',String(button===player));
   }
   $('pitch').focus({preventScroll:true});
   return;
  }
  const train=e.target.closest('[data-train]');
  if(view==='between'&&train&&run.choose(train.dataset.train)){await start();return;}
  const hire=e.target.closest('[data-hire]');
  if(view==='tavern'&&hire&&run.choose(hire.dataset.hire)){await start();return;}
  const previewOffer=e.target.closest('[data-preview]');
  if(view==='tavern'&&previewOffer){
   const recruit=run.offers.find(offer=>offer.id===previewOffer.dataset.preview);
   if(recruit?.power){tavernPreview=recruit;practice=true;await start(drills[recruit.power]);}
   return;
  }
  const character=e.target.closest('[data-character]');
  if(character&&!loading){selected=character.dataset.character;for(const el of document.querySelectorAll('[data-character]')){el.classList.toggle('selected',el===character);el.setAttribute('aria-pressed',String(el===character));}return;}
  const action=e.target.closest('[data-action]')?.dataset.action;
  if(action==='back-tavern'&&tavernPreview){
   if(match){match.destroy();match=null;input=null;}
   SoundDB.stopCrowd();practice=false;tavernPreview=null;showTavern();
  }
  else if(view==='between'&&action==='enter-tavern'&&run.enterTavern())showTavern();
  else if((view==='between'||view==='tavern')&&(action==='rest'||action==='continue')){
   if(run.choose(action))await start();
  }
  else if(action==='matchup'){
   if(match){match.destroy();match=null;input=null;}
   $('hud').hidden=true;$('touch').hidden=true;$('overlay').hidden=false;
   showMatchup();
  }
  else if(action==='test-play'){
   testEncounter=$('test-encounter').value||'custom';
   for(const side of ['home','away']){
    const value=Number($('test-'+side).value);
    matchup[side]=Number.isInteger(value)?Math.max(1,Math.min(5,value)):1;
    matchup[side+'Keeper']=matchup[side]>1&&$('test-'+side+'-keeper').checked;
   }
   practice=false;run=null;testMode=true;await start();
  }
  else if(action==='practice'){practice=true;await start(drills[starterPowers[selected]]);}
  else if(action==='play'||action==='retry')await start();
  else if(action==='choose')showSelection();
  else if(action==='pause')overlay('paused');
  else if(action==='resume')resume();
  else if(action==='sound'){sound=!sound;Settings.soundsMuted=!sound;$('sound').innerHTML=icon(sound?'sound':'muted');$('sound').setAttribute('aria-label',sound?'Mute sound':'Enable sound');if(sound)SoundDB.resume();else SoundDB.stopCrowd();}
  else if(action==='fullscreen'){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch(_){toast('Fullscreen is unavailable in this browser.');}}
 });
 on(window,'keydown',e=>{if(e.code==='Escape'&&(view==='play'||view==='paused')&&match&&!match.finished){e.preventDefault();if(paused)resume();else overlay('paused');}});
 on(window,'blur',()=>{input?.reset();if(match&&view==='play')overlay('paused');});
 on(document,'visibilitychange',()=>{if(document.hidden&&match&&view==='play')overlay('paused');});
 const pitch=$('pitch');
 const trackPointer=e=>{if(input&&view==='play')input.pointer={clientX:e.clientX,clientY:e.clientY};};
 on(pitch,'pointerdown',e=>{if(e.pointerType==='touch'&&view==='play')e.preventDefault();});
 on(pitch,'pointermove',e=>{if(e.pointerType!=='touch')trackPointer(e);});
 on(pitch,'mouseleave',()=>{if(input)input.pointer=null;});
 on(pitch,'contextmenu',e=>e.preventDefault());
 const mouseAction={0:'MouseLeft',2:'MouseRight'};
 on(pitch,'mousedown',e=>{
  const code=mouseAction[e.button];if(!code||!input||view!=='play'||e.sourceCapabilities?.firesTouchEvents)return;
  e.preventDefault();pitch.focus({preventScroll:true});trackPointer(e);input.press(code);
 });
 on(window,'mouseup',e=>{const code=mouseAction[e.button];if(code){if(e.target===pitch)trackPointer(e);input?.release(code);}});
 bindTouch();lastFrame=performance.now();raf=requestAnimationFrame(loop);
 const drill=new URLSearchParams(window.location?.search).get('practice');
 if(drill!==null){
  const directDrills={'orc-barge':'price','orc-spin':'spin-kick','goal-warp':'goal-warp','tele-pass':'tele-pass','smoke-bomb':'smoke-bomb','blaze-slide':'blaze-slide'};
  const practiceDrill=directDrills[drill]??'portal-pass';
  selected=['orc-spin','orc-barge','blaze-slide'].includes(drill)?'price':drill==='smoke-bomb'?'cole':'mendes';
  practice=true;
  start(practiceDrill);
 }
}
document.addEventListener('DOMContentLoaded',init);
module.exports={portrait};
