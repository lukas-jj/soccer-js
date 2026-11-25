const {KickUps,BALL_RADIUS,COURT_HEIGHT,FOOT_LIFT}=require('./kick_ups.js');
const {APPEARANCES,playerAppearance,appearanceBody}=require('../../five/appearances.js');
const {TEAM_DRILLS,teamMoveUnlocks,crossIsReady,facesAwayFromGoal}=require('../../five/team_moves.js');
const {FiveMatch,CHARACTERS,configureFive,loadKits}=require('../../five/match.js');
const {FantasyRun,RUN_LENGTH,GOBLIN_TEAM,HORDE_FC,FROST_GIANTS,SHAPESHIFTERS,OPPONENTS,SPECIAL_EVENTS,TEXT_EVENTS}=require('../../five/cup.js');
const {DRUID_FORMS,ARC_BEND_TICKS,STARTER_POWER_POOLS:starterClasses,RECRUIT_POWERS,GOAL_WARP,goalWarpTarget,bargeReach,bargeDirection,SPIN_RADIUS,SPIN_DURATION}=require('../../five/powers.js');
const {Settings}=require('../../settings.js');
const {Application}=require('../../engine.js');
const {Utils}=require('../../core/lib/utils.js');
const {Pitch}=require('../../core/entities/pitch.js');
const {paintBeast}=require('./beast_art.js');
const {Player,activeBeastForm}=require('../../core/entities/player.js');
const {SoundDB}=require('../../core/lib/sounddb.js');
const {CLUB_GEAR,MATCH_ITEMS,SHOP_ITEMS,TRAINING_STATS,statMax,statRating}=require('../../five/market.js');
const {streakerGuards}=require('../../five/slimers.js');
const {ICE_RADIUS,GIANT_COLORS}=require('../../five/frost_giants.js');
const {FulltimePresentation}=require('../../five/match_presentation.js');
const {squadNumber,starterStats}=require('../../five/characters.js');
const {Time,LOGIC_DT}=require('../../core/lib/time.js');
const {clearManualCharge,getManualChargePower}=require('../../core/lib/manual_control.js');
const {holdPower01}=require('../../core/lib/manual_commands.js');
const {manualAimScatter}=require('../../core/lib/ball_prediction.js');
const $=id=>document.getElementById(id);
let practice=false,run=null,testMode=false,activeOpponent=null,match=null,input=null,paused=false,loading=false,lastFrame=0,accumulator=0,preview=null,selected='cole',sound=true,view='select',raf=0,stickPointer=null,stickOrigin=null;
const drills={barge:'price',spin:'spin-kick',dash:'cole',arc:'mendes',tele:'tele-pass',portal:'portal-pass',warp:'goal-warp',nutmeg:'nutmeg',clone:'clone',stepover:'stepover',blaze:'blaze-slide',blast:'blast-shot',bear:'bear',wolf:'wolf',eagle:'eagle'};
let starterPowers={},draftNumbers={},draftLooks={},abilityPreview=null,guideDrill=null,abilityMatch=null;
let teamName='Spellside',teamColor='#f5b841';
let fulltimeScene=null,goldAnimation=null,kickUps=null;
let streetEvent=null;
let eventPractice=false;
let showcase=null,catalogType=null,redCardAim=false;
const cleanups=[];
const MAX_PITCH_PIXELS=4_000_000;
let lastPaintAt=-Infinity,lastPaintView,lastPaintMatch,lastPaintWidth,lastPaintHeight;
const matchup={home:1,away:1,homeKeeper:false,awayKeeper:false};
const practiceOpponent={name:'PRACTICE',color:'#a4b763'};
const testOpponent={...OPPONENTS[0],name:'TEST OPPONENTS',color:'#91b96d',frostGiants:false,speedScale:.83};
const testEncounters={slimers:GOBLIN_TEAM,orcs:HORDE_FC,frost:{...FROST_GIANTS,count:4,keeper:true},shifters:SHAPESHIFTERS};
let testEncounter='custom';
let trainingGround=false;
const TRAINING_GROUND_STATS=TRAINING_STATS.filter(([key])=>key!=='dribbling'&&key!=='goalkeeping');
const trainingOverrides=new Map();
let trainingPlayerIndex=-1,trainingDefaults=[];
const trainingSquad={home:1,away:0,homeKeeper:false,awayKeeper:false};
const trainingPowers={...RECRUIT_POWERS,...DRUID_FORMS};
let trainingAbility='',trainingLevel=1,trainingEnemiesFrozen=false;

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const portraitHair={
 crest:'M59 52V32L70 31 78 12 88 2 103 8 111 24 122 33V49L106 34 75 37Z',
 braid:'M58 52V33Q65 7 94 11Q124 15 123 46L109 33 76 34Z M113 35Q138 51 124 71L132 86 123 106 117 88 120 72 111 59Z',
 crop:'M60 41V32Q65 15 90 16Q114 16 120 33V42L106 34 74 36Z',
 bun:'M62 49V33Q66 14 89 16Q110 13 121 31V48L106 36 75 34Z M76 20Q72 3 87 1Q106 0 103 19Z',
 shaved:'',
 curls:'M58 46Q50 35 61 28Q55 18 68 16Q69 7 81 10Q89 1 100 10Q112 6 116 17Q130 18 123 33L120 48 108 35 74 39Z',
 swept:'M58 48V36Q61 18 82 14L108 3 103 15 125 11 117 27 124 42 113 48 107 32 74 39Z',
 pony:'M61 49V33Q69 10 94 13Q114 13 121 33V47L108 36 75 35Z M113 27Q145 32 141 54Q139 70 147 77Q126 75 127 57Q127 45 116 41Z',
 bob:'M60 72Q51 58 55 35Q60 10 91 11Q120 10 126 34Q132 56 121 73L110 68 115 41 103 32 70 42 72 68Z'
};
function portrait(c,number=c.number,shirt='#e8af3c',body=c.body,look=playerAppearance(c.id,c.appearance)){
 const skin=look?.skin??c.skin,hair=look?.hair??c.hair;
 const hairPath=look?portraitHair[look.style]:'M60 47V33Q62 9 90 11Q119 10 121 34V47L112 34Q93 40 76 30L68 49Z';
 const headgear={
  price:`<path d="m64 51-15-8 11 22m56-14 15-8-11 22" fill="${skin}" stroke="#101a2244" stroke-width="2"/><path d="m77 72 5-10 4 12m9 0 4-12 5 10" fill="#fff0cf"/>`,
  cole:'<path d="M59 47Q90 39 121 47v7Q90 46 59 54Z" fill="#252331"/><path d="m111 51 10 3-2 9-6-8Z" fill="#252331"/>',
  mendes:'<path d="m90 39 4 6-4 6-4-6Z" fill="#f0ecff" stroke="#513b81" stroke-width="1.5"/>',
  druid:'<path d="M57 47q5-33 33-34t33 34l-14-9-19 9-19-9Z M84 17 71 2 73 24m23-8 14-14-3 22" fill="#5e8046"/>',
  kowalski:'<path d="M61 46 63 26 80 15h26l15 15v17h-9l-5-10H76l-8 12Z" fill="#c9b28c"/>'
 }[c.id]||'';
 return `<svg viewBox="-20 -33 220 223" aria-hidden="true" class="portrait"><g transform="translate(90 190) scale(${body?.width??1} ${body?.height??1}) translate(-90 -190)"><ellipse cx="90" cy="185" rx="58" ry="8" fill="#000" opacity=".2"/><path d="M65 75 L44 86 19 126 41 141 58 114 57 190H123L122 114 139 141 161 126 136 86 115 75Z" data-shirt fill="${shirt}"/><path d="M19 126L41 141 35 160Q28 168 20 159L12 145Z M161 126L139 141 145 160Q152 168 160 159L168 145Z" fill="${skin}"/><path d="M71 66V84Q90 100 109 84V66" fill="${skin}"/><path d="M65 75Q90 97 115 75L111 89Q90 108 69 89Z" fill="#1d292c"/><path d="M58 109L51 94M122 109L129 94" stroke="#f4d277" stroke-width="4"/><path d="M59 43Q60 14 90 14Q120 14 121 43L116 64Q111 81 90 82Q69 81 64 64Z" fill="${skin}"/><path d="${hairPath}" fill="${hair}"/><path d="M78 57h4m16 0h4" stroke="#30271f" stroke-width="3" stroke-linecap="round"/><path d="M84 70q6 3 12 0" fill="none" stroke="#7d4f3e" stroke-width="2"/>${headgear}<text x="90" y="163" fill="#1b292d" font-family="Impact,Arial Black,sans-serif" font-size="54" text-anchor="middle">${number}</text><path d="M60 184H120" stroke="#f4cf68" stroke-width="3"/></g></svg>`;}
function icon(name){const paths={bear:'<path d="M5 9a3 3 0 1 1 3-4m8 0a3 3 0 1 1 3 4M4 13c0-11 16-11 16 0 0 9-16 9-16 0Zm5 3 3 2 3-2"/>',wolf:'<path d="m4 3 5 5h6l5-5v11l-8 7-8-7Zm5 11 3 3 3-3"/>',eagle:'<path d="M3 4l8 6 1 3 1-3 8-6-3 11-6 5-6-5Z"/>',slime:'<path d="M4 17c0-4 4-5 5-9 1-3 5-3 6 0 1 4 5 5 5 9 0 3-16 3-16 0Z"/><path d="M10 14h.01m4 0h.01"/>',blast:'<path d="M3 12h8m-6-5h5m-5 10h5m6-11v3m4-1-2 2m4 2h-3m1 4-2-2m-2 4v-3"/><circle cx="15" cy="12" r="3"/>',nutmeg:'<path d="m7 4-3 15m13-15 3 15M9 9h6"/><circle cx="12" cy="16" r="2"/>',stepover:'<path d="M4 14c2-9 12-11 15-4m-4-1 4 1 1-4"/><circle cx="12" cy="16" r="3"/>',target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',music:'<path d="M9 18V5l10-2v13M5 18a2 2 0 1 0 4 0 2 2 0 1 0-4 0m10-2a2 2 0 1 0 4 0 2 2 0 1 0-4 0"/>',flask:'<path d="M9 3h6m-5 0v7l-5 8c-1 2 1 3 3 3h8c2 0 4-1 3-3l-5-8V3m-7 12h10"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',banner:'<path d="M6 21V4h13l-3 5 3 5H6"/>',coin:'<circle cx="12" cy="12" r="9"/><path d="M12 7v10m-3-8h5m-5 6h5"/>',card:'<rect x="6" y="3" width="12" height="18" rx="2"/>',clone:'<rect x="3" y="7" width="11" height="13" rx="2"/><path d="M8 4h11a2 2 0 0 1 2 2v10"/>',barge:'<path d="M3 12h14m-5-5 5 5-5 5M3 7h4M3 17h4m13-9v8"/>',dash:'<path d="m13 2-8 12h6l-1 8 9-12h-6l1-8Z"/>',overhead:'<path d="M4 18h4l5-7 4 2m-4-2 1-5m-1 5-5-2"/><circle cx="19" cy="5" r="2"/><circle cx="6" cy="7" r="1.5"/>',blaze:'<path d="M12 2c2 5 6 6 6 12a6 6 0 1 1-12 0c0-3 2-6 4-7 0 3 2 3 2 3Z"/>',spin:'<path d="M20 9a8 8 0 1 0 0 6m-5-5 5-1 1-5"/>',warp:'<path d="M5 19V6h14v13M9 12h6m-2-2 2 2-2 2"/>',portal:'<path d="M5 3c-4 2-4 16 0 18m14-18c4 2 4 16 0 18M6 12h12m-4-4 4 4-4 4"/>',tele:'<path d="M6 18a3 3 0 1 0 0 .01M9 15l8-8m-4 0h4v4M20 7a3 3 0 1 0 0 .01"/>',arc:'<path d="M3 18C3 5 13 3 20 8m-1-5 1 5-5 1"/>',pause:'<path d="M8 5v14M16 5v14"/>',sound:'<path d="M4 9h4l5-4v14l-5-4H4zM17 8q5 4 0 8"/>',muted:'<path d="M4 9h4l5-4v14l-5-4H4zM17 9l5 6m0-6l-5 6"/>',expand:'<path d="M4 9V4h5m6 0h5v5m0 6v5h-5M9 20H4v-5"/>'};return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[name]||''}</svg>`;}
function toast(text){$('message').textContent=text;}
function showSelection(draft=false){
 eventPractice=false;
 streetEvent=null;
 fulltimeScene=null;goldAnimation=null;showcase=null;catalogType=null;redCardAim=false;
 view=draft?'select':'home';paused=false;loading=false;practice=false;run=null;testMode=false;trainingGround=false;abilityPreview=null;guideDrill=null;abilityMatch=null;
 if(draft||!starterPowers[selected])starterPowers=Object.fromEntries(Object.entries(starterClasses).map(([id,powers])=>[id,powers[Math.floor(Math.random()*powers.length)]]));
 if(!starterPowers[selected])selected='cole';
 if(draft){
  const used=new Set();
  draftLooks=Object.fromEntries(Object.keys(starterClasses).map(id=>{
   const looks=APPEARANCES[id];
   return [id,looks[Math.floor(Math.random()*looks.length)].id];
  }));
  draftNumbers=Object.fromEntries(Object.keys(starterClasses).map(id=>[id,squadNumber(Math.random,used)]));
 }
 if(match){match.destroy();match=null;input=null;}
 SoundDB.stopCrowd();
 $('hud').hidden=true;$('touch').hidden=true;$('overlay').hidden=false;
 $('overlay').classList.remove('tavern-room','upgrade-room','market-room');
 if(!draft){
  $('overlay').innerHTML=`<section class="match-overlay"><h1>Spellside Cup</h1><div class="overlay-buttons"><button class="play" data-action="new-run">NEW RUN</button><button class="secondary" data-action="events-catalog">EVENTS</button><button class="secondary" data-action="practice">ABILITIES</button><button class="secondary" data-action="club-gear">PERKS</button><button class="secondary" data-action="match-items">SINGLE-USE ITEMS</button><button class="secondary" data-action="training-ground">TRAINING GROUND</button><button class="secondary" data-action="matchup">TEST MATCH</button></div></section>`;
  $('message').textContent='';
  return;
 }
 renderStarterSelection();
}
function starterPortrait(base){
 const look=playerAppearance(base.id,draftLooks[base.id]);
 return portrait(base,draftNumbers[base.id],teamColor,appearanceBody(base.body,look),look);
}
function renderStarterSelection(){
 view='select';paused=false;
 $('hud').hidden=true;$('touch').hidden=true;$('overlay').hidden=false;
 $('overlay').innerHTML=`<div class="selection"><div class="selection-top"><span class="wordmark">SPELLSIDE<span> / CUP</span></span><span class="edition">SOLO START</span></div><div class="selection-heading"><p class="kicker">PICK YOUR PLAYER TO START</p><h1>Spellside Cup</h1></div><div class="team-setup"><label>Team name<input id="team-name" type="text" maxlength="24" value="${esc(teamName)}"></label><label>Shirt color<input id="team-color" type="color" value="${teamColor}"></label></div><div class="characters">${CHARACTERS.filter(c=>starterPowers[c.id]).map(c=>`<div class="starter-card" style="--recruit:${c.color}"><button class="character ${selected===c.id?'selected':''}" style="--accent:${c.color}" data-character="${c.id}" title="${esc(RECRUIT_POWERS[starterPowers[c.id]].hint)}" aria-pressed="${selected===c.id}"><span class="character-art"><span class="starter-portrait" id="starter-portrait-${c.id}">${starterPortrait(c)}</span><span class="jersey-number">${draftNumbers[c.id]}</span></span><span class="character-name">${c.label}</span><span class="tavern-power" data-ability="${RECRUIT_POWERS[starterPowers[c.id]].icon}"><span class="tavern-ability-icon">${icon(RECRUIT_POWERS[starterPowers[c.id]].icon)}</span>${RECRUIT_POWERS[starterPowers[c.id]].name}</span></button>${playerRatings({stats:starterStats(c.stats)},{collapsible:true})}</div>`).join('')}</div><div class="selection-bottom"><div class="selection-controls"><span><kbd>W A S D</kbd> Move</span><span><kbd>J</kbd> Pass / tackle</span><span><kbd>K</kbd> Hold to shoot</span><span><kbd>Q</kbd> Nearest defender</span><span><kbd>SPACE</kbd> Power</span><span><kbd>⇧</kbd> Sprint</span></div><div class="start-actions"><button class="secondary" data-action="choose">BACK</button><button class="secondary" data-action="preview-starter">Preview ability</button><button class="play" data-action="play">Play match <span>↗</span></button></div></div><div class="selection-foot"><span>Mouse aims · Left click passes / tackles · Right click shoots / shoves · Hold and release to power kicks</span></div></div>`;
 $('message').textContent='';
 }
function abilityGroups(current){
 return Object.entries({...starterClasses,druid:Object.keys(DRUID_FORMS)}).map(([id,powers])=>{
  const {label}=CHARACTERS.find(character=>character.id===id);
  return `<section class="ability-group" style="--class-color:${classColors[id]}"><h2>${label}</h2><div>${powers.map(key=>{
   const ability=RECRUIT_POWERS[key]??DRUID_FORMS[key],drill=drills[key];
   return `<button type="button" data-practice-player="${drill}" aria-pressed="${current===drill}" title="${esc(ability.hint)}">${icon(ability.icon)}<span>${ability.name}</span></button>`;
  }).join('')}</div></section>`;
 }).join('');
}
function teamAbilityGroup(current){
 return `<section class="ability-group team-ability-group"><h2>Team Abilities</h2><div>${Object.entries(TEAM_DRILLS).map(([drill,ability])=>
  `<button type="button" data-practice-player="${drill}" aria-pressed="${current===drill}" title="${esc(ability.hint)}">${icon(ability.icon)}
   <span>${ability.name}<small>${ability.requirement}</small></span><kbd>${ability.key}</kbd></button>`
 ).join('')}</div></section>`;
}
const classColors=Object.fromEntries(CHARACTERS.map(({id,color})=>[id,color]));
const guideAbilities={
 ...Object.fromEntries(Object.entries(drills).map(([id,drill])=>[drill,RECRUIT_POWERS[id]??DRUID_FORMS[id]])),
 ...TEAM_DRILLS
};
function showAbilityGuide(drill,player){
 guideDrill=drill;
 const ability=guideAbilities[drill];
 const backLabel=abilityPreview?.source==='tavern'?'Back to tavern':player?'Back to starter selection':'Back to abilities';
 $('overlay').classList.remove('tavern-room');
 $('overlay').innerHTML=`<section class="ability-menu ability-guide" aria-labelledby="ability-guide-title">
  <h1 id="ability-guide-title">${esc(ability.name)}</h1>
  ${player?`<p>Training as ${esc(player.name)} · #${player.number}</p>`:''}
  ${abilityPreview?.source==='starter'?`<div class="starter-guide-ratings" style="--recruit:${player.color}">${playerRatings(player,{ratings:TRAINING_STATS.filter(([id])=>id!=='goalkeeping')})}</div>`:''}
  <p>${esc(ability.hint)}</p>
  ${ability.requirement?`<p>${esc(ability.requirement)}</p>`:''}
  ${ability.level2?`<p><strong>Level 2</strong> · ${esc(ability.level2)}</p>`:''}
  <div class="overlay-buttons"><button class="play" data-action="ability-go-to-game">Play preview match</button>
   <button class="secondary" data-action="start-ability-preview">Practice drill</button>
   <button class="text-button" data-action="${player?'back-ability-preview':'ability-list'}">${backLabel}</button></div>
 </section>`;
 $('overlay').querySelector?.('button')?.focus();
}
function showAbilities(){
 view='abilities';
 guideDrill=null;
 if(abilityPreview){
  const {player}=abilityPreview;
  showAbilityGuide(drills[player.power==='overhead'?'nutmeg':player.power],player);
  return;
 }
 const current=practice?match?.practiceCharacter:undefined;
 $('overlay').innerHTML=`<section class="ability-menu"><h1>Abilities</h1><div class="ability-groups">${abilityGroups(current)}${teamAbilityGroup(current)}</div><button class="secondary" data-action="choose">BACK</button></section>`;
 $('overlay').querySelector?.('button')?.focus();
}
function trainingPlayerOptions(){
 return match.sim.players.map((player,index)=>player.isSentOff?'':`<option value="${index}" ${index===trainingPlayerIndex?'selected':''}>${player.team==='A'?'Your team':'Opponent'} · #${player.jersey} ${esc(player.characterName||player.name)}${player.role==='GK'?' (GK)':''}</option>`).join('');
}
function refreshTrainingStatEditor(){
 const players=match.sim.players;
 if(!players[trainingPlayerIndex]||players[trainingPlayerIndex].isSentOff){
  trainingPlayerIndex=players.indexOf(match.player);
 }
 const select=$('training-player');
 if(!select)return;
 select.innerHTML=trainingPlayerOptions();
 for(const [key] of TRAINING_GROUND_STATS){
  const value=statRating(players[trainingPlayerIndex].stats,key);
  $('training-stat-'+key).value=value;
  $('training-value-'+key).textContent=value;
 }
}
function trainingSettings(){
 const trainingStats=match.sim.players[trainingPlayerIndex].stats;
 const sideControls=(side,label)=>`<fieldset><legend>${label}</legend>
 <label>Outfielders <select data-training-side="${side}" id="training-${side}">${(side==='away'?[0,1,2,3,4]:[1,2,3,4]).map(n=>`<option ${trainingSquad[side]===n?'selected':''}>${n}</option>`).join('')}</select></label>
 <label><input type="checkbox" data-training-side="${side}Keeper" id="training-${side}-keeper" ${trainingSquad[side+'Keeper']?'checked':''}> Goalkeeper</label></fieldset>`;
 return `<details class="training-ground-menu"><summary>Training settings</summary>
 <div class="training-ground-content">
 <div class="training-ground-sides">${sideControls('home','Your team')}${sideControls('away','Opponents')}</div>
 <div class="training-ground-loadout">
 <label>Ability <select id="training-ability"><option value="">Default</option>${Object.entries(trainingPowers).map(([id,power])=>`<option value="${id}" ${id===trainingAbility?'selected':''}>${power.name}</option>`).join('')}</select></label>
 <label>Level <select id="training-level" ${trainingPowers[trainingAbility]?.level2?'':'disabled'}><option value="1" ${trainingLevel===1?'selected':''}>1</option><option value="2" ${trainingLevel===2?'selected':''}>2</option></select></label>
 <button class="secondary" id="training-freeze" data-action="training-freeze" aria-pressed="${trainingEnemiesFrozen}">${trainingEnemiesFrozen?'Unfreeze opponents':'Freeze opponents'}</button>
 <label>Player <select id="training-player">${trainingPlayerOptions()}</select></label>
 </div>
 <div class="training-ground-stats">${TRAINING_GROUND_STATS.map(([key,label,description])=>`<div>
 <label for="training-stat-${key}">${label}<output id="training-value-${key}" for="training-stat-${key}">${statRating(trainingStats,key)}</output></label>
 <input id="training-stat-${key}" data-training-stat="${key}" type="range" min="1" max="${statMax(key)}" value="${statRating(trainingStats,key)}" ${description?`aria-describedby="training-help-${key}"`: ''}>
 ${description?`<small id="training-help-${key}">${description}</small>`: ''}
 </div>`).join('')}</div>
 <div class="training-ground-actions"><button class="secondary" data-action="training-ground-reset">Reset player stats</button>
 <button class="secondary" data-action="retry">Restart match</button></div></div></details>`;
}
function applyTrainingStats(){
 trainingDefaults=match.sim.players.map(player=>({...player.stats}));
 for(const [index,stats] of trainingOverrides)Object.assign(match.sim.players[index].stats,stats);
}
function applyTrainingSquads(){
 match.setTrainingSquads(trainingSquad);
 refreshTrainingStatEditor();
 for(const id of ['touch-keeper','training-keeper-key']){
  const control=$(id);
  if(control)control.hidden=!trainingSquad.homeKeeper;
 }
}
function showMatchup(){
 $('overlay').classList.remove('tavern-room');
 view='matchup';
 const sizes=(selected)=>Array.from({length:5},(_,i)=>`<option value="${i+1}" ${selected===i+1?'selected':''}>${i+1}</option>`).join('');
 $('overlay').innerHTML=`<section class="match-overlay matchup-menu"><h1>Test match</h1>
 <label for="test-encounter">Encounter</label>
 <select id="test-encounter"><option value="custom" ${testEncounter==='custom'?'selected':''}>Custom</option>
 <option value="slimers" ${testEncounter==='slimers'?'selected':''}>Slimers</option>
 <option value="orcs" ${testEncounter==='orcs'?'selected':''}>Horde FC</option>
 <option value="frost" ${testEncounter==='frost'?'selected':''}>Frost Giants</option>
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
 const warmup=match.sandbox==='warmup';
 const street=streetEvent?.kind??'';
 $('hud').dataset.street=street;
 $('touch').dataset.street=street;
 const teamMoves=`<div id="team-moves" class="team-moves" hidden><button id="cross-power" data-team-move="KeyR" title="Cross to a teammate for a power shot. Press E or click when the marker turns green.">${practice?'':'<kbd>R</kbd> '}Cross for Power Shot</button><button id="cross-header" data-team-move="KeyF" title="Cross to a teammate for a header. Press E or click when the marker turns green.">${practice?'':'<kbd>F</kbd> '}Cross for Header</button><button id="cross-overhead" data-team-move="KeyT" title="${esc(TEAM_DRILLS['overhead-kick'].hint)}"><kbd>T</kbd> Cross for Overhead Kick</button><button id="cross-finish" data-team-move="KeyE" hidden></button></div>`;
 $('hud').innerHTML=`<div class="hud-brand" id="round-label">${warmup?'WARMUP':abilityMatch?'ABILITY PREVIEW':showcase?'PRACTICE':practice?'PRACTICE':trainingGround?'TRAINING GROUND':testMode?'TEST MATCH':`${run.opponent.boss?'BOSS FIXTURE':'LEAGUE FIXTURE'} · ${run.round+1}/${RUN_LENGTH}`}</div><div id="item-dock" class="item-dock" role="group" aria-label="Single-use items" ${warmup||practice&&catalogType!=='item'?'hidden':''}><span class="item-dock-label">Items</span><div id="match-items-bar" class="match-items-bar"></div></div><div id="scoreboard" class="scoreboard" ${warmup||practice&&!abilityMatch&&(!showcase||!match.timed)?"hidden":""}><span class="team-label home" style="color:${run?.teamColor||'#f5b841'}">${esc(run?.teamName||'Spellside')}</span><b id="home-score">0</b><span class="score-divider">:</span><b id="away-score">0</b><span class="team-label away" style="color:${activeOpponent.color}">${activeOpponent.name}</span><span id="clock">1:00</span></div>${warmup?'<div class="scoreboard warmup-controls"><button class="secondary" data-action="kickoff">Kick off</button></div>':''}<div class="hud-actions"><button data-action="sound" id="sound" aria-label="Mute sound">${icon(sound?'sound':'muted')}</button><button data-action="fullscreen" aria-label="Toggle fullscreen">${icon('expand')}</button><button data-action="pause" aria-label="Pause match">${icon('pause')}</button></div><div class="player-hud"><span id="call-feedback" role="status" aria-live="polite"></span><span class="player-number" id="player-number"></span><div class="player-identity"><b id="player-name"></b><span id="direction">ATTACK →</span><span id="player-power" class="power-chip" tabindex="0" aria-describedby="power-help" hidden><span id="power-icon" class="power-glyph"></span><span id="power-name"></span><span id="power-timer"></span><span id="power-level" hidden>LV 2</span><span id="power-help" role="tooltip"></span></span></div><div class="condition-bars"><label>SPRINT <meter id="stamina" min="0" max="1" low=".25" optimum="1" value="1"></meter></label><label id="power-label"><span id="power-text">KICK POWER</span><meter id="charge" min="0" max="1" value="0"></meter></label></div></div><div class="desktop-controls"><span><kbd>WASD</kbd> MOVE</span><span><kbd>J</kbd> PASS / TACKLE</span><span><kbd>K</kbd> HOLD TO SHOOT</span><span><kbd>L</kbd> LOB</span><span><kbd>Q</kbd> SWITCH</span>${trainingGround?`<span id="training-keeper-key" ${trainingSquad.homeKeeper?'':'hidden'}><kbd>G</kbd> KEEPER</span>`:match.sim.teamA.getGoalkeeper()?' <span><kbd>G</kbd> KEEPER</span>':''}<span><kbd>SPACE</kbd> POWER</span><span><kbd>E</kbd> TEAM ABILITY</span><span><kbd>⇧</kbd> SPRINT</span></div>${practice&&!abilityMatch&&!showcase?'':teamMoves}<div id="announcement" aria-live="polite"></div>${trainingGround?trainingSettings():''}${showcase?showcasePanel():abilityMatch?`<div class="practice-controls"><button data-action="ability-preview-guide">Ability guide</button></div>`:practice?`<div class="practice-controls"><div class="practice-buttons">${abilityPreview?`<button data-action="practice-menu">Ability guide</button><button data-action="back-ability-preview">${abilityPreview.source==='tavern'?'Back to tavern':'Back to starter selection'}</button>`:'<button data-action="practice-menu">Abilities</button>'}<button id="team-drill-reset" data-action="reset-team-drill" hidden>Reset drill</button></div><div id="practice-levels" class="practice-buttons" hidden><button id="practice-level-1" data-practice-level="1">Level 1</button><button id="practice-level-2" data-practice-level="2">Level 2</button></div><div id="practice-tip"></div><label class="practice-cooldowns"><input id="cooldowns-off" type="checkbox" ${match.sim.cooldownsOff?'checked':''}> Disable cooldowns</label>${teamMoves}</div>`:''}`;
 $('hud').hidden=false;
 $('touch').hidden=false;
 renderMatchItems();
 const keeperButton=$('touch-keeper');if(keeperButton)keeperButton.hidden=trainingGround?!trainingSquad.homeKeeper:!match.sim.teamA.getGoalkeeper();
}
async function start(practiceDrill,{kickoff=false}={}){
 const street=streetEvent;
 fulltimeScene=null;goldAnimation=null;redCardAim=false;
 $('overlay').classList.remove('tavern-room','upgrade-room','market-room');
 if(loading)return;loading=true;paused=true;toast('Loading pitch…');

 activeOpponent=street?(street.challenger??{name:'CROSSBAR',color:'#f5b841'}):practice?practiceOpponent:trainingGround?testOpponent:testMode?(testEncounters[testEncounter]||testOpponent):run.opponent;
 try{
  if(match){match.destroy();match=null;input=null;}
  const previewPlayer=abilityMatch?.player??abilityPreview?.player;
  const options=street?{
   squad:true,practice:true,streetChallenge:street.kind,sandbox:'street',
   roster:[street.player],matchup:{home:1,away:street.kind==='duel'?2:1,awayKeeper:street.kind==='duel'},
   opponent:street.challenger,gear:eventPractice?[]:street.kind==='duel'?run.gear.filter(id=>id==='crossbar'):run.gear
  }:{
   squad:true,practice:practice&&!abilityMatch,practiceDrill:practiceDrill??drills[previewPlayer?.power==='overhead'?'nutmeg':previewPlayer?.power],practicePreview:previewPlayer,starterPower:testMode?starterPowers[selected]:undefined,leagueFixture:!practice&&!testMode&&run?.status==='playing',opponent:practice?undefined:activeOpponent,
   sandbox:showcase?(catalogType==='item'?'items':showcase.id==='crossbar'?'crossbar':'showcase'):undefined,
   teamAbilities:abilityMatch?(abilityMatch.teamMove?[abilityMatch.teamMove]:[]):trainingGround?Object.values(TEAM_DRILLS).map(({kind})=>kind):testMode?['power','header']:run?.teamAbilities,
   gear:showcase&&catalogType==='gear'?[showcase.id]:practice?[]:run?.gear,
   bardCurse:!practice&&!testMode?run?.bardCurse:undefined,
   items:showcase&&catalogType==='item'?{[showcase.id]:1}:practice?{}:run?.items,
   roster:!abilityMatch&&!practice?run?.roster:undefined,matchup:trainingGround?{home:5,away:5,homeKeeper:true,awayKeeper:true}:showcase?(showcase.id==='crossbar'?{home:1,away:1}:{home:5,away:5,homeKeeper:true,awayKeeper:true}):testMode?{
    ...matchup,away:testEncounters[testEncounter]?.count??matchup.away,awayKeeper:testEncounters[testEncounter]?.keeper??matchup.awayKeeper
   }:undefined
  };
  const homeCount=options.matchup?.home??options.roster?.length??5;
  const awayCount=options.matchup?.away??options.opponent?.count??5;
  const warmup=!kickoff&&!street&&!practice&&!trainingGround&&(homeCount>1||awayCount>1);
  if(warmup)Object.assign(options,{
   practice:true,sandbox:'warmup',leagueFixture:false,opponent:undefined,gear:[],items:{}
  });
  SoundDB.stopCrowd();SoundDB.resume();
  match=await FiveMatch.create(street?.player.characterId??previewPlayer?.characterId??selected,trainingGround?42:run?.matchSeed??Date.now(),options);
  Settings.soundsMuted=!sound;
  if(trainingGround){
   applyTrainingStats();
   applyTrainingSquads();
   match.setTrainingFreeze(trainingEnemiesFrozen);
   if(trainingAbility)match.setTrainingAbility(trainingAbility,trainingLevel);
   match.sim.resetTrainingBall();
  }
  await loadKits(match.sim,abilityPreview?.source==='starter'?teamColor:run?.teamColor);
  if(street){
   match.sim.pitch.render=g=>paintStreetCourt(g,match.streetChallenge);
  }
  if(match.frostGiants){
   const {sim}=match;
   const renderPitch=sim.pitch.render.bind(sim.pitch);
   sim.pitch.render=g=>{renderPitch(g);paintIceTrails(g,sim.iceTrails);};
  }
  if(showcase)match.setupShowcase(showcase.id);
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
    if(p.slimedUntil>Time.time){
     const at=Utils.toScreen(p.x,p.y);
     const scale=Settings.camera.scale;
     g.fillStyle='#8bd84580';
     g.beginPath();g.ellipse(at.x,at.y,scale*.76,scale*.32,0,0,Math.PI*2);g.fill();
    }
    const form=activeBeastForm(p);
    if(form&&!p.isSentOff)paintBeast(g,p,form);
    else if(p.isSlimer)paintSlimer(g,p);else render(g);
    if(burning)g.restore();
   };
  }
  input=match.input;input.attach(window);input.resolvePointerAim=pointerAim;
  try{localStorage.setItem('soccer-five-character',selected);}catch(_){}
  match.introUntil=street||practice||warmup?0:Time.time+1.35;
  paused=false;loading=false;view='play';$('overlay').hidden=true;hud();toast('');
  if(street){
   $('round-label').textContent=street.title;
   $('item-dock').hidden=true;
   $('scoreboard').hidden=street.kind==='crossbar';
  }
  accumulator=0;lastFrame=performance.now();$('pitch').focus({preventScroll:true});
 }catch(e){
  if(match){match.destroy();match=null;input=null;}
  loading=false;view='loading-error';$('overlay').hidden=false;$('hud').hidden=true;
  $('overlay').innerHTML=`<div class="match-overlay"><button class="play" data-action="retry">RETRY MATCH</button><button class="text-button" data-action="${street?'forfeit-street':abilityPreview?'back-ability-preview':'choose'}">${street?'Forfeit challenge':abilityPreview?(abilityPreview.source==='tavern'?'BACK TO TAVERN':'BACK TO STARTER SELECTION'):'BACK TO MENU'}</button></div>`;
  toast(`Could not start: ${e.message}`);
 }
}
function overlay(kind){
 view=kind;paused=true;input?.reset();if(match){clearManualCharge(match.sim);match.sim.arcCast=null;match.sim.teleCast=null;}
 $('touch').hidden=true;$('overlay').hidden=false;
 if(abilityMatch){
  const {scoreA,scoreB}=match.sim;
  $('overlay').innerHTML=`<div class="match-overlay"><h1>${kind==='paused'?'Paused':'Match over'}</h1>
   ${kind==='paused'?'':`<div class="final-score"><strong>${scoreA} : ${scoreB}</strong></div>`}
   <div class="overlay-buttons"><button class="play" data-action="${kind==='paused'?'resume':'retry'}">${kind==='paused'?'Resume':'Rematch'}</button>
   <button class="text-button" data-action="ability-preview-guide">Ability guide</button></div></div>`;
 }else if(kind==='paused'&&streetEvent){
  $('overlay').innerHTML='<div class="match-overlay"><h1>Paused</h1><div class="overlay-buttons"><button class="play" data-action="resume">Resume</button><button class="text-button" data-action="forfeit-street">Forfeit challenge</button></div></div>';
 }else if(kind==='paused'){
  $('overlay').innerHTML=`<div class="match-overlay"><h1>Paused</h1><div class="overlay-buttons"><button class="play" data-action="resume">RESUME</button><button class="text-button" data-action="${abilityPreview?'back-ability-preview':'choose'}">${abilityPreview?(abilityPreview.source==='tavern'?'BACK TO TAVERN':'BACK TO STARTER SELECTION'):practice?'LEAVE PRACTICE':testMode?'LEAVE TEST MATCH':'ABANDON RUN'}</button></div></div>`;
 }else{
  const {scoreA,scoreB}=match.sim;
  const scoreLine=`${scoreA} : ${scoreB}`;
  if(showcase){
   const gold=match.club.finish();
   $('overlay').innerHTML=`<div class="match-overlay"><h1>${match.winner?'Match over':'Draw'}</h1><div class="final-score"><strong>${scoreLine}</strong></div>
    ${gold?`<p>Bonus gold · ${gold}</p>`:''}
    <div class="overlay-buttons"><button class="play" data-action="reset-showcase">Try again</button><button class="text-button" data-action="back-catalog">Back</button></div></div>`;
   $('overlay').querySelector?.('button')?.focus();
   return;
  }
  if(testMode){
   $('overlay').innerHTML=`<div class="match-overlay"><h1>${match.winner?'Match over':'Draw'}</h1><div class="final-score"><strong>${scoreLine}</strong></div><div class="overlay-buttons"><button class="play" data-action="retry">REMATCH</button><button class="text-button" data-action="${trainingGround?'choose':'matchup'}">${trainingGround?'BACK TO MENU':'CHANGE MATCHUP'}</button></div></div>`;
   $('overlay').querySelector?.('button')?.focus();
   return;
  }
  const crossbarGold=match.club.crossbarGold;
  run.finish(scoreA,scoreB,match.winner,match.club.finish()-crossbarGold,match.sim.teamB.players,crossbarGold);
  showMatchRewards(scoreLine);
  return;
 }
 $('overlay').querySelector?.('button')?.focus();
}
function animateGold(){
 const change=run.goldChange;
 const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const before=run.gold-change;
 goldAnimation=change&&!reducedMotion?{before,after:run.gold,started:lastFrame}:null;
 return `<strong id="gold-total" class="gold-total">${goldAnimation?before:run.gold} gold</strong> ${change?`<span class="gold-change gain">+${change}</span>`: ''}`;
}
function updateGold(now){
 if(!goldAnimation)return;
 const total=$('gold-total');
 if(!total){goldAnimation=null;return;}
 const {before,after,started}=goldAnimation;
 const progress=Math.min(1,Math.max(0,(now-started)/900));
 total.textContent=`${Math.round(before+(after-before)*(1-(1-progress)**2))} gold`;
 if(progress===1)goldAnimation=null;
}
function showMatchRewards(scoreLine){
 view='reward';paused=true;
 $('hud').hidden=true;$('touch').hidden=true;$('overlay').hidden=false;
 $('overlay').classList.add('upgrade-room');

 $('overlay').innerHTML=`<section class="upgrade-draft" aria-labelledby="upgrade-heading">
  <header>
   <div class="upgrade-result"><strong>${run.lastWin?'Win':run.lastDraw?'Draw':'Loss'} · ${scoreLine} · +${run.lastPoints} ${run.lastPoints===1?'point':'points'} · ${run.league[0].points} total</strong><div>${animateGold()}</div></div>
   <h1 id="upgrade-heading">Upgrade a player</h1>
   ${run.upgradeCards.length?'':'<p>All player stats are maxed.</p>'}
  </header>
  <div id="upgrade-cards" class="upgrade-cards"></div>
  <div id="rival-recruit" class="upgrade-draft-actions" hidden></div>
  <div class="upgrade-draft-actions"><button id="post-match-continue" class="play" data-action="${run.seasonComplete?'league-results':'rest'}" disabled>
   ${run.seasonComplete?'Final standings':'Rest'} <span aria-hidden="true">→</span></button></div>
 </section>`;
 renderUpgradeCards();
 renderRivalRecruit();
 $('overlay').querySelector?.('[data-upgrade-card]')?.focus();
}
function renderRivalRecruit(){
 const slot=$('rival-recruit');
 const recruit=run.rivalRecruit;
 slot.hidden=!run.canConfirmUpgrade||!recruit;
 slot.innerHTML=slot.hidden?'':`<button class="secondary" data-action="sign-rival">Sign ${esc(recruit.name)} from ${esc(run.opponent.name)} · Free</button>`;
}
function playerRatings(player,{ratings,collapsible=false}={}){
 const outfield=TRAINING_STATS.slice(0,5);
 const stats=ratings??(player.keeper?[TRAINING_STATS.at(-1),...outfield.filter(([id])=>id!=='tackling')]:outfield);
 const best=Math.max(...stats.map(([id])=>statRating(player.stats,id)));
 const rows=stats.map(([id,label])=>{
  const rating=statRating(player.stats,id);
  return `<div${rating===best?' class="best-rating"':''}><dt>${label}</dt><dd>
   <meter min="0" max="100" value="${rating}" aria-label="${label}" aria-valuetext="${rating} out of 100"></meter>
   <span aria-hidden="true">${rating}</span>
  </dd></div>`;
 }).join('');
 const list=`<dl class="recruit-stats">${rows}</dl>`;
 if(collapsible)return `<details class="rating-panel"><summary>Player stats</summary>${list}</details>`;
 return `<section class="rating-panel" aria-label="Player ratings">
  <div class="rating-panel-heading"><span>Player ratings</span><span>0–100</span></div>
  ${list}
 </section>`;
}
function showTavern(){
 view='tavern';paused=true;
 $('overlay').classList.add('tavern-room');
 $('hud').hidden=true;$('touch').hidden=true;$('overlay').hidden=false;
 $('overlay').innerHTML=`<div class="tavern-scene" aria-hidden="true"><div class="tavern-hearth"></div><div class="tavern-window"></div></div><section class="tavern tavern-content"><header><h1>Tavern</h1><div><strong>${run.gold} gold</strong> <span>${run.goldChange>=0?'+':''}${run.goldChange}</span></div></header>
 <p class="tavern-next">Next · ${esc(run.nextOpponent.name)}</p>
 <div class="tavern-recruits${run.offers.length>3?' with-keeper':''}">${run.offers.map(recruit=>{
  const base=CHARACTERS.find(c=>c.id===recruit.characterId);
  const power=RECRUIT_POWERS[recruit.power];
  return `<article class="tavern-card tier-${recruit.rarity}"><div class="tavern-player"><span class="tavern-portrait">${portrait(base,recruit.number,run.teamColor,recruit.body,playerAppearance(recruit.characterId,recruit.appearance))}</span><h2>${recruit.keeper?`${base.label} Keeper`:`${esc(recruit.name)} · ${base.label}`}</h2></div>
  <div class="tavern-power" data-ability="${power?.icon||''}"${power?` title="${esc(power.hint)}"`: ''}>${power?`<span class="tavern-ability-icon">${icon(power.icon)}</span>`:''}<span>${power?.name||'No ability'}</span></div>
  ${playerRatings(recruit,{collapsible:true})}
  <button class="secondary" data-hire="${recruit.id}" ${run.gold<recruit.price||run.roster.length>=5?'disabled':''}>Buy · ${recruit.price} gold</button>
  ${power?`<button class="text-button" data-preview="${recruit.id}">Preview ability</button>`:''}</article>`;
 }).join('')}</div>
 <div class="tavern-actions"><button class="play" data-action="continue">Play next match</button></div></section>`;
 $('overlay').querySelector?.('button:not([disabled])')?.focus();
}
function dayScreen(title,content,backdrop=''){
 paused=true;
 $('hud').hidden=true;$('touch').hidden=true;$('overlay').hidden=false;
 $('overlay').classList.remove('tavern-room','upgrade-room');
 $('overlay').classList.toggle('market-room',!!backdrop);
 $('overlay').innerHTML=`${backdrop}<section class="ability-menu"><header class="day-header"><h1>${title}</h1><strong>${run.gold} gold</strong></header>${content}</section>`;
 $('overlay').querySelector?.('button:not([disabled])')?.focus();
}
function leagueTable(caption){
 const standings=run.standings;
 let rank=1;
 const rows=standings.map((team,index)=>{
  const previous=standings[index-1];
  if(previous&&(team.points!==previous.points||team.goalDifference!==previous.goalDifference||team.goalsFor!==previous.goalsFor))rank=index+1;
  const shift=run.previousStandings.indexOf(team)-index;
  const movement=shift>0?'up':shift<0?'down':'';
  const isHome=team===run.league[0];
  return `<tr class="${isHome?'your-club':''}" style="--rank-shift:${shift};--row-index:${index}">
   <td class="league-position">${rank}${movement?`<span class="league-movement ${movement}" aria-label="${movement} ${Math.abs(shift)} places">${shift>0?'▲':'▼'}</span>`:''}</td>
   <th scope="row">${esc(team.name)}</th><td>${team.played}</td><td>${team.goalsFor}</td><td>${team.goalDifference>0?'+':''}${team.goalDifference}</td><td class="league-points">${team.points}</td></tr>`;
 }).join('');
 return `<table class="league-table" style="--club-color:${run.teamColor}">
 <caption>${caption}</caption>
 <thead><tr><th scope="col">Pos</th><th scope="col">Club</th><th scope="col">P</th><th scope="col">GF</th><th scope="col">GD</th><th scope="col">Pts</th></tr></thead>
 <tbody>${rows}</tbody></table>`;
}
function showLeagueResults(){
 view='league-results';
 dayScreen(run.status==='won'?'Spellside Cup champions':'Spellside Cup complete',`${leagueTable('Final standings')}
 <button class="play" data-action="new-run">New run</button>`);
}
function showRoute(){
 view='route';
 const opponent=run.nextOpponent;
 dayScreen('Rest',`<p class="rest-opponent" style="--opponent:${opponent.color}">${opponent.boss?'Boss fixture':'Next match'} · ${esc(opponent.name)}</p>
 ${leagueTable('League standings')}
 <div class="route-choices">
 <button data-action="enter-tavern" ${run.roster.length>=5?'disabled':''}>${icon('barge')}<b>Tavern</b><span>Recruit a player</span></button>
 <button data-action="event">${icon('banner')}<b>Explore</b><span>Discover a random encounter</span></button>
 <button data-action="market">${icon('coin')}<b>Shop</b><span>Buy perks or single-use items</span></button></div>
 <button class="play rest-continue" data-action="continue">Skip rest activity</button>`);
}
function catalogCard(entry,market){
 const owned=run?.gear.includes(entry.id);
 const action=market?`<button class="secondary" data-buy="${entry.id}" ${owned||run.gold<entry.price?'disabled':''}>${owned?'Owned':`Buy · ${entry.price} gold`}</button>`:
  entry.id==='scouting-contract'?'':`<button class="secondary" data-showcase="${entry.id}">Try</button>`;
 return `<article class="catalog-card"><div>${icon(entry.icon)}<h2>${entry.name}</h2></div><p>${entry.description}</p>${action}</article>`;
}
function showMarket(){
 view='market';
 const group=(title,list)=>`<h2 class="catalog-heading">${title}</h2><div class="catalog-grid">${list.map(item=>catalogCard(item,true)).join('')}</div>`;
 const backdrop=`<div class="market-scene" aria-hidden="true">
  <div class="market-rooftops"></div><div class="market-paving"></div>
  <div class="market-stall market-stall-left"></div><div class="market-stall market-stall-right"></div>
  <div class="market-lights">${'<i></i>'.repeat(9)}</div>
 </div>`;
 dayScreen('Market',`${group('Perks',run.marketPerks)}${group('Single-use items',SHOP_ITEMS)}<button class="play catalog-back" data-action="continue">Play next match</button>`,backdrop);
}
function showEvents(){
 view='events-catalog';
 paused=true;
 eventPractice=false;
 run=null;
 const group=(title,events)=>`<h2 class="catalog-heading">${title}</h2><div class="catalog-grid">${events.map(event=>
  `<article class="catalog-card"><h3>${esc(event.name)}</h3><p>${esc(event.description)}</p>
   <button class="secondary" data-try-event="${esc(event.name)}" aria-label="Try ${esc(event.name)}">Try</button></article>`).join('')}</div>`;
 $('overlay').innerHTML=`<section class="ability-menu"><header class="day-header"><h1>Events</h1></header>
  ${group('Special Events',SPECIAL_EVENTS)}${group('Text Events',TEXT_EVENTS)}
  <button class="secondary" data-action="choose">Back</button></section>`;
 $('overlay').querySelector?.('button')?.focus();
}
function tryEvent(name){
 const seed=Date.now();
 const players=[['cole','dash',7],['price','barge',4],['mendes','arc',8]]
  .map(([character,power,number])=>new FantasyRun(seed,character,power,{number}).roster[0]);
 const trial=new FantasyRun(seed);
 if(!trial.previewEvent(name))return;
 trial.roster=players;
 trial.gold=300;
 run=trial;
 eventPractice=true;
 showEvent();
}
async function continueEvent(){
 if(eventPractice)showEvents();
 else await startLeagueMatch();
}
function eventContinueButton(action){
 return `<button class="play" data-action="${action}">${eventPractice?'Back to Events':'Play next match'}</button>`;
}
function showEvent(){
 view='event';
 const {name,description,choices,challenge,bard}=run.event;
 const back=eventPractice?'<button class="text-button" data-action="skip-event">Back to Events</button>':'';
 if(challenge){
  const rival=challenge==='duel'?run.duelChallenger:null;
  const rivalPower=rival&&(RECRUIT_POWERS[rival.power]??DRUID_FORMS[rival.power]);
  dayScreen(name,`<p class="event-copy">${description} ${rival?'A tie goes to the challenger.':'Move anywhere on the court to line up each shot. Adjust your aim and charge for the distance.'}</p>
   ${rival?`<p class="event-copy"><strong>${esc(rival.name)}</strong> · ${rival.quality.name} · ${rivalPower.name}</p>`:''}
   <h2>Choose your player</h2><div class="overlay-buttons event-choices">
   ${run.roster.map((player,index)=>{
    if(player.keeper)return '';
    const detail=challenge==='crossbar'
     ?` · Shot Speed ${statRating(player.stats,'shooting')} · Shot Accuracy ${statRating(player.stats,'shotAccuracy')}`
     :player.power?` · ${(RECRUIT_POWERS[player.power]??DRUID_FORMS[player.power])?.name??''}`:'';
    return `<button class="secondary" data-street-player="${index}">${esc(player.name)}${detail}</button>`;
   }).join('')}
   </div>${back||'<button class="text-button" data-action="skip-event">Keep walking</button>'}`);
  return;
 }
 const song=bard?`<blockquote class="event-copy">‘Valiant ${esc(run.teamName)}, so mighty and true, it is true I would play for you. As a fan, I could cheer for thee, but whatever you, do not just flee’</blockquote>`:'';
 dayScreen(name,`<p class="event-copy">${description}</p>${song}<div class="overlay-buttons event-choices">${choices.map((choice,index)=>`<button class="secondary" data-event-choice="${index}" ${run.canChooseEvent(choice)?'':'disabled'}>${choice.label}</button>`).join('')}</div>${back}`);
}
function showBardCurse(){
 view='bard-curse';
 dayScreen('A Song for the Road',`<p class="event-copy">As you walk away, the bard sings one last verse. Choose who hears it.</p>
  <div class="overlay-buttons event-choices">${run.roster.map((player,index)=>
   `<button class="secondary" data-bard-player="${index}">${esc(player.name)} · #${player.number}</button>`).join('')}</div>`);
}
function finishStreetEvent(forfeited=false){
 const {kind,title}=streetEvent;
 const result=match?.streetChallenge?.result??{home:0,away:0,hits:0};
 const earnedRelic=kind==='crossbar'&&!forfeited&&result.hits===3&&!run.gear.includes('crossbar');
 const reward=run.finishEventChallenge({...result,forfeited,crossbarGold:eventPractice?0:match?.club.crossbarGold??0});
 const summary=forfeited?'Challenge forfeited.':kind==='crossbar'?`${result.hits} / 3 crossbar hits.`:
  `${result.home>result.away?'You win!':result.home===result.away?'Draw · Challenger wins.':'Challenger wins.'} ${result.home} : ${result.away}`;
 match?.destroy();match=null;input=null;streetEvent=null;
 view='street-result';
 const duelReward=run.duelReward;
 const consolation=run.duelConsolation&&MATCH_ITEMS.find(item=>item.id===run.duelConsolation);
 if(duelReward){
  const full=run.roster.length>=5;
  dayScreen(title,`<p role="status">${summary}${reward?` · +${reward} gold`:''}</p>
   <p class="event-copy">“You’re pretty good... you looking for any new players?”</p>
   <div class="overlay-buttons event-choices">
    <button class="play" data-action="duel-gold">Take ${duelReward.gold} gold</button>
    <button class="secondary" data-action="duel-recruit" ${full?'disabled':''}>Recruit ${esc(duelReward.challenger.name)}</button>
   </div>${full?'<p>Your squad is full.</p>':''}`);
  return;
 }
 dayScreen(title,`<p role="status">${summary} · ${reward?'+':''}${reward} gold</p>
  ${consolation?`<p class="event-copy">“Good game. For your troubles.”</p><p>Received ${consolation.name}</p>`:''}
  ${earnedRelic?'<p>Crossbar Relic earned · 100 gold per crossbar hit</p>':''}
  ${eventContinueButton('street-continue')}`);
}
function showKickUps(){
 view='kick-ups';
 kickUps=new KickUps(run.kickUpTarget);
 dayScreen('Street Kick-Ups',`<p class="event-copy">Move your mouse or drag your finger to steer the boot. Flick it up into the falling ball.</p>
 <div class="kick-up-score">
  <p id="kick-up-count" role="status">0 / ${kickUps.target} kick-ups</p>
  <progress id="kick-up-progress" value="0" max="${kickUps.target}" aria-label="Challenge progress"></progress>
 </div>
 <div id="kick-up-field" class="kick-up-field" aria-hidden="true">
  <div id="kick-up-track" class="kick-up-track">
   <div id="kick-up-shadow" class="kick-up-shadow"></div>
   <div id="kick-up-boot"><div id="kick-up-leg"></div><span></span></div>
   <div id="kick-up-ball"><i></i><i></i><i></i><i></i></div>
  </div>
  <b id="kick-up-cue">Ready?</b>
 </div>
 <div class="kick-up-controls">
  <button id="kick-up-button" class="play" data-action="kick-up">Kick off</button>
  <button class="secondary" data-action="leave-kick-ups">Forfeit</button>
 </div>`);
 const field=$('kick-up-field');
 let drag=null;
 const moveBoot=event=>{
  if(view!=='kick-ups')return;
  const track=$('kick-up-track').getBoundingClientRect();
  const ballSize=$('kick-up-ball').offsetWidth||50;
  const scale=2*BALL_RADIUS/ballSize;
  kickUps.moveFoot((event.clientX-track.left-track.width/2)*scale,
   (track.top+track.height-event.clientY)*COURT_HEIGHT/track.height,
   Math.max(BALL_RADIUS,(track.width-ballSize)*scale/2));
 };
 field.addEventListener('pointerdown',event=>{
  if(event.pointerType==='mouse')return;
  if(drag!==null)return;
  drag=event.pointerId;
  field.setPointerCapture(drag);
  moveBoot(event);
 });
 field.addEventListener('pointermove',event=>{
  if(event.pointerType==='mouse'||event.pointerId===drag)moveBoot(event);
 });
 field.addEventListener('lostpointercapture',event=>{
  if(event.pointerId===drag)drag=null;
 });
 renderKickUps();
}
function finishKickUps(message){
 const {count,target}=kickUps;
 kickUps=null;
 const reward=run.finishKickUps(count);
 view='kick-up-result';
 dayScreen('Street Kick-Ups',`<p role="status">${message} ${count} / ${target} kick-ups · ${reward?`+${reward} gold`:'0 gold'}</p>
 ${eventContinueButton('kick-up-continue')}`);
}
function kickUp(){
 kickUps.kick();
}
function renderKickUps(){
 const ball=$('kick-up-ball'),boot=$('kick-up-boot'),shadow=$('kick-up-shadow');
 const lift=(kickUps.y-BALL_RADIUS)/COURT_HEIGHT;
 const drift=`calc(var(--ball-size) * ${kickUps.x/(BALL_RADIUS*2)})`;
 ball.style.bottom=`${lift*100}%`;
 ball.style.transform=`translateX(-50%) translateX(${drift}) rotate(${kickUps.rotation}deg)`;
 shadow.style.transform=`translateX(-50%) translateX(${drift}) scale(${1-lift*.45})`;
 shadow.style.opacity=1-lift*.7;
 boot.style.bottom=`${kickUps.footY/COURT_HEIGHT*100}%`;
 boot.style.transform=`translate(-76%, 100%) translateX(calc(var(--ball-size) * ${kickUps.footX/(BALL_RADIUS*2)}))`;
 $('kick-up-leg').style.transform=`rotate(${34-Math.min(1,kickUps.footY/FOOT_LIFT)*58}deg)`;
 $('kick-up-field').classList.toggle('kick-up-ready',!kickUps.pointer&&kickUps.ready);
 const count=`${kickUps.count} / ${kickUps.target} kick-ups`;
 if($('kick-up-count').textContent!==count){
  $('kick-up-count').textContent=count;
  $('kick-up-progress').value=kickUps.count;
  $('kick-up-button').textContent=kickUps.active?'Kick':'Kick off';
 }
 const cue=kickUps.resultTime!==null?(kickUps.count===kickUps.target?'Target reached':'Dropped'):
  kickUps.pointer?(kickUps.active?'Keep it up':'Flick the boot up'):
   kickUps.ready?'Kick now':kickUps.active?'Watch the ball':'Ready?';
 if($('kick-up-cue').textContent!==cue)$('kick-up-cue').textContent=cue;
}
function showCatalog(type){
 catalogType=type;view='catalog';paused=true;
 $('hud').hidden=true;$('touch').hidden=true;$('overlay').hidden=false;
 const list=type==='gear'?CLUB_GEAR:MATCH_ITEMS;
 $('overlay').innerHTML=`<section class="ability-menu"><h1>${type==='gear'?'Perks':'Single-use Items'}</h1><div class="catalog-grid">${list.map(entry=>catalogCard(entry,false)).join('')}</div><button class="secondary catalog-back" data-action="choose">Back</button></section>`;
}
function showcasePanel(){
 const id=showcase.id;
 const hint={
  crossbar:'Aim at the middle of the bar and release Shoot before full power.',
  whistle:'Use your player’s ability, then use the elixir from the item bar while the ability is recharging.',
  'red-card':'Select the Red Card in the item bar, then click an opponent on the pitch.'
 }[id];
 return `<div class="showcase-panel"><strong>${showcase.name}</strong><span>${showcase.description}</span>
 ${hint?`<span>${hint}</span>`:''}
 <span id="showcase-result" role="status"></span><div class="practice-buttons"><button data-action="reset-showcase">Reset</button><button data-action="back-catalog">Back</button></div></div>`;
}
function renderUpgradeCards(){
 const picked=run.upgradeSelection;
 $('post-match-continue').disabled=!run.canConfirmUpgrade;
 $('upgrade-cards').innerHTML=run.upgradeCards.map((card,index)=>{
  const player=run.roster[card.playerIndex];
  const base=CHARACTERS.find(c=>c.id===player.characterId);
  const selected=picked===index;
  const appearance=player.frostGiant?{...base,...GIANT_COLORS}:base;
  return `<button type="button" class="upgrade-card" data-upgrade-card="${index}" data-kind="stat" style="--accent:${base.color}"
   aria-pressed="${selected}">
   <span class="upgrade-card-emblem">${portrait(appearance,player.number,run.teamColor,player.body,player.frostGiant?null:playerAppearance(player.appearanceClass??player.characterId,player.appearance))}
    <span class="upgrade-card-recipient">${esc(player.name)} · #${player.number}<small>${base.label}</small></span>
   </span>
   <span class="upgrade-card-body"><strong>+${card.next-card.current}</strong><span class="upgrade-card-name">${card.name}</span>
    <span class="upgrade-card-detail">${card.current} → ${card.next}</span></span>
  </button>`;
 }).join('');
}
function renderMatchItems(){
 const items=match.club?.items??{};
 const bar=$('match-items-bar');
 if(!bar)return;
 bar.innerHTML=MATCH_ITEMS.filter(item=>items[item.id]).map(item=>`<button data-item="${item.id}" aria-label="${item.name}, ${items[item.id]} remaining" aria-pressed="${item.id==='red-card'&&redCardAim}" title="${item.description}">${icon(item.icon)}<span>${items[item.id]}</span></button>`).join('')||'<span class="item-dock-empty">No items</span>';
}
function useMatchItem(id,target){
 if(match.sandbox==='warmup'||!match.club?.use(id,target))return false;
 renderMatchItems();
 $('pitch').focus({preventScroll:true});
 return true;
}
function targetRedCard(event){
 if(!redCardAim)return false;
 const aim=pointerAim(event);
 const origin=match.sim.ball.owner?.team==='A'?match.sim.ball:match.player;
 const x=origin.x+aim.x,y=origin.y+aim.y;
 const opponents=match.sim.teamB.players.filter(player=>!player.isSentOff)
  .map(player=>({player,distance:Math.hypot(x-player.x,y-player.y)})).sort((a,b)=>a.distance-b.distance);
 if(opponents[0]?.distance<2){
  redCardAim=false;
  useMatchItem('red-card',opponents[0].player);
  renderMatchItems();
 }
 return true;
}
async function startRun(){
 teamName=$('team-name')?.value?.trim().slice(0,24)||(view==='abilities'?teamName.trim().slice(0,24):'')||'Spellside';
 const color=$('team-color')?.value;
 if(/^#[0-9a-f]{6}$/i.test(color||''))teamColor=color;
 run=new FantasyRun(Date.now(),selected,starterPowers[selected],{name:teamName,color:teamColor,number:draftNumbers[selected],appearance:draftLooks[selected]});
 await startLeagueMatch();
}
async function startLeagueMatch(){
 if(!run.startMatch())return;
 practice=false;
 await start();
}
function resume(){if(!match||match.finished||view!=='paused')return;paused=false;view='play';input.reset();$('overlay').hidden=true;$('touch').hidden=false;lastFrame=performance.now();$('pitch').focus({preventScroll:true});}
function camera(){
 const canvas=$('pitch'),rect=canvas.getBoundingClientRect();
 const dpr=Math.min(2,window.devicePixelRatio||1,Math.sqrt(MAX_PITCH_PIXELS/Math.max(1,rect.width*rect.height)));
 const w=Math.max(320,Math.round(rect.width*dpr)),h=Math.max(240,Math.round(rect.height*dpr));
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
 const touch=window.matchMedia?.('(pointer:coarse)').matches;
 const landscape=rect.width>rect.height*1.3;
 const margin=(touch&&landscape?140:35)*dpr,top=(landscape?80:110)*dpr,bottom=(touch?(landscape?38:170):80)*dpr;
 const {width,height}=Utils.getFieldBounds();
 const projectedWidth=width+height*.3;
 let scale=Math.max(2,Math.min((w-margin*2)/projectedWidth,(h-top-bottom)/(height*.8)));
 const portraitFollow=touch&&!landscape&&match&&!match.streetChallenge;
 if(portraitFollow)scale=Math.max(scale,11.5*dpr);
 let offsetX=(w-projectedWidth*scale)/2;
 if(portraitFollow){
  const p=match.player,b=match.sim.ball,targetX=(p.x*.65+b.x*.35)*scale+(p.y*.65+b.y*.35)*scale*.3;
  offsetX=Math.max(w-25*dpr-projectedWidth*scale,Math.min(25*dpr,w/2-targetX));
 }
 Settings.camera={...Settings.camera,type:'static',scale,offsetX,offsetY:top+Math.max(0,(h-top-bottom-height*.8*scale)/2)};
 Settings.showFPS=false;Settings.projectionMode='orthographic';Settings.HEADLESS=false;
 Application.canvas=canvas;Application.g=canvas.getContext('2d');Application.camX=0;Application.camY=0;Application.width=w;Application.height=h;Settings.app=Application;
 return {canvas,g:Application.g,dpr};
}
function paintSlimer(g,p){
 if(p.isSentOff)return;
 const keeper=p.role==='GK';
 const scale=Settings.camera.scale*(keeper?1.35:1),feet=Utils.toScreen(p.x,p.y,p.z||0);
 const width=scale*(p.body?.width??1),height=scale*(p.body?.height??1);
 const eye=Math.min(width,height)*.085;
 const wobble=Math.sin(Time.time*8+p.formationIndex)*.09;
 g.fillStyle='#08160f88';
 g.beginPath();g.ellipse(feet.x,feet.y,width*.83,scale*.3,0,0,Math.PI*2);g.fill();
 g.fillStyle=keeper?'#6ec9ad':p.slimeWindup?'#b5f17a':'#77c455';
 g.strokeStyle='#263f27';g.lineWidth=2;
 g.beginPath();g.ellipse(feet.x,feet.y-height*.56,width*(.82+wobble),height*(.68-wobble),0,0,Math.PI*2);g.fill();g.stroke();
 g.fillStyle='#182b22';
 g.beginPath();
 g.arc(feet.x-width*.24,feet.y-height*.74,eye,0,Math.PI*2);
 g.moveTo(feet.x+width*.24+eye,feet.y-height*.74);
 g.arc(feet.x+width*.24,feet.y-height*.74,eye,0,Math.PI*2);
 g.fill();
}
function paintStreaker(g,sim,dpr){
 const streaker=sim.slimerStreaker;
 paintSlimer(g,{...streaker,formationIndex:0});
 const frame=1+Math.floor(Time.time*10)%2;
 const orientation=streaker.direction>0?4:0;
 const keeper=sim.teamA.getGoalkeeper()??sim.teamA.players[0];
 g.save();
 for(const guard of streakerGuards(streaker)){
  Player.prototype.render.call({...guard,z:0,frame,orientation,getSpriteSheet:()=>keeper.getSpriteSheet()},g);
  const feet=Utils.toScreen(guard.x,guard.y);
  g.fillStyle='#ffe792';
  g.font=`bold ${9*dpr}px sans-serif`;
  g.textAlign='center';
  g.fillText('SECURITY',feet.x,feet.y-Settings.camera.scale*1.9);
 }
 g.restore();
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
function paintIceTrails(g,trails){
 if(!trails.length)return;
 const scale=Settings.camera.scale;
 g.save();
 g.lineCap='round';
 for(const trail of trails){
  const remaining=trail.until-Time.time;
  if(remaining<=0)continue;
  const from=Utils.toScreen(trail.from.x,trail.from.y);
  const to=Utils.toScreen(trail.to.x,trail.to.y);
  g.globalAlpha=Math.min(.62,remaining*.7);
  g.beginPath();g.moveTo(from.x,from.y);g.lineTo(to.x,to.y);
  g.strokeStyle='#b9efff';g.lineWidth=scale*ICE_RADIUS*1.55;g.stroke();
  g.strokeStyle='#73bfdc';g.lineWidth=scale*ICE_RADIUS*1.2;g.stroke();
  g.strokeStyle='#e6fbff';g.lineWidth=scale*.10;g.stroke();
 }
 g.restore();
}
function paintAbilityHazards(g,sim,dpr){
 for(const trail of sim.blazeTrails??[]){
  const a=Utils.toScreen(trail.from.x,trail.from.y),b=Utils.toScreen(trail.to.x,trail.to.y);
  g.strokeStyle=trail.until-Time.time<.5?'#e8754866':'#f96737b5';g.lineWidth=6*dpr;g.lineCap='round';
  g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.stroke();
 }
 g.lineCap='butt';

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
 g.strokeStyle=player.powerColor||classColors.price;g.lineWidth=2*dpr;
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
 if(match.streetChallenge?.kind==='crossbar')return;
 const streetDuel=match.streetChallenge?.kind==='duel';
 const {left,right}=sim.getGoals();
 if(streetDuel)board(0,0,0,ball.maxY);
 for(const goal of streetDuel?[right]:[left,right]){
  board(goal.lineX,0,goal.lineX,goal.yMin);
  board(goal.lineX,goal.yMax,goal.lineX,ball.maxY);
 }
}
function paintStreetCourt(g,challenge){
 const {width,height,centerY}=Utils.getFieldBounds();
 const {goal}=challenge;
 const path=(points,stroke,lineWidth,fill)=>{
  g.beginPath();
  points.forEach(([x,y,z],index)=>{
   const pt=Utils.toScreen(x,y,z);
   if(index)g.lineTo(pt.x,pt.y);
   else g.moveTo(pt.x,pt.y);
  });
  if(fill){g.closePath();g.fillStyle=fill;g.fill();}
  if(stroke){g.strokeStyle=stroke;g.lineWidth=lineWidth;g.stroke();}
 };
 const surface=challenge.kind==='duel'?'#354853':'#34483e';
 path([[0,0],[width,0],[width,height],[0,height],[0,0]],'#9ab6b4',2,surface);
 if(challenge.kind==='duel'){
  const boxX=width-7,mark=width-23;
  path([[width,centerY-6],[boxX,centerY-6],[boxX,centerY+6],[width,centerY+6]],'#a9bfbd',1.5);
  path([[mark,centerY-1.2],[mark,centerY+1.2]],'#f5bf50',2);
 }else{
  const spot=Utils.toScreen(width/2,centerY);
  const scale=Settings.camera.scale;
  g.beginPath();
  g.ellipse(spot.x,spot.y,scale*.9,scale*.36,0,Math.PI*2);
  g.strokeStyle=challenge.phase==='collect'?'#f5bf50':'#a9bfbd';
  g.lineWidth=1.5;
  g.stroke();
 }
 const back=width+goal.renderDepth,bar=goal.height,y0=goal.yMin,y1=goal.yMax;
 for(let row=0;row<=5;row++){
  const y=y0+(y1-y0)*row/5;
  path([[width,y,bar],[back,y,bar],[back,y]],'#98adb287',1);
 }
 for(let row=0;row<=4;row++){
  const z=bar*row/4;
  path([[width,y0,z],[back,y0,z],[back,y1,z],[width,y1,z]],'#98adb287',1);
 }
 path([[width,y0],[width,y0,bar],[width,y1,bar],[width,y1]],'#f5f4e9',3);
 if(challenge.spentBalls?.length){
  g.save();
  g.globalAlpha=.5;
  for(const ball of challenge.spentBalls)ball.render(g);
  g.restore();
 }
}
function paintAimRing(g,point,rx,ry,color,dpr){
 g.beginPath();
 g.ellipse(point.x,point.y,rx*dpr,ry*dpr,0,0,Math.PI*2);
 g.strokeStyle='#161222';
 g.lineWidth=7*dpr;
 g.stroke();
 g.strokeStyle=color;
 g.lineWidth=3.5*dpr;
 g.stroke();
}
function paintAccuracyCone(g,ball,aim,accuracy,color,dpr){
 const {minAngle,maxAngle}=manualAimScatter(accuracy);
 const distance=Math.hypot(aim.x,aim.y);
 const heading=Math.atan2(aim.y,aim.x);
 const start=Utils.toScreen(ball.x,ball.y);
 const edge=offset=>Utils.toScreen(ball.x+Math.cos(heading+offset)*distance,ball.y+Math.sin(heading+offset)*distance);
 g.save();
 g.fillStyle=color;g.strokeStyle=color;g.lineWidth=dpr;
 if(maxAngle>0){
  for(const side of [-1,1]){
   g.beginPath();g.moveTo(start.x,start.y);
   for(let step=0;step<=8;step++){
    const point=edge(side*(minAngle+(maxAngle-minAngle)*step/8));
    g.lineTo(point.x,point.y);
   }
   g.closePath();
   g.globalAlpha=.2;g.fill();
   g.globalAlpha=.65;g.stroke();
  }
 }
 const center=edge(0);
 g.globalAlpha=.8;g.setLineDash(maxAngle>0?[4*dpr,5*dpr]:[]);
 g.beginPath();g.moveTo(start.x,start.y);g.lineTo(center.x,center.y);g.stroke();
 g.restore();
}
function paint(){
 const {canvas,g,dpr}=camera();
 g.fillStyle='#121c20';g.fillRect(0,0,canvas.width,canvas.height);
 g.imageSmoothingEnabled=false;
 const active=match?.sim;
 if(active){
  active.renderAll(g);
  if(active.teamCross){
   const {meetingPoint}=active.teamCross;
   const p=Utils.toScreen(meetingPoint.x,meetingPoint.y);
   const scale=Settings.camera.scale;
   g.strokeStyle=crossIsReady(active)?'#83ffa4':'#ffe48b';
   g.lineWidth=2*dpr;
   g.beginPath();g.ellipse(p.x,p.y,scale*.85,scale*.35,0,0,Math.PI*2);g.stroke();
  }
  if(active.matchState==='play'&&!active.setPieceType){
   const scale=Settings.camera.scale;
   for(const player of active.teamA.players){
    if(!abilityReady(active,player,match.powerFor(player)))continue;
    const point=Utils.toScreen(player.x,player.y);
    g.save();
    g.globalAlpha=.34;g.strokeStyle=player.powerColor||'#f5bf50';g.shadowColor=g.strokeStyle;
    g.shadowBlur=8*dpr;g.lineWidth=2*dpr;
    g.beginPath();g.ellipse(point.x,point.y,scale*.91,scale*.43,0,0,Math.PI*2);g.stroke();
    g.restore();
   }
  }
  paintAbilityHazards(g,active,dpr);
  if(redCardAim){
   g.strokeStyle='#ff7969';g.lineWidth=2*dpr;
   for(const opponent of active.teamB.players.filter(player=>!player.isSentOff)){
    const point=Utils.toScreen(opponent.x,opponent.y);
    g.beginPath();g.ellipse(point.x,point.y,Settings.camera.scale*.8,Settings.camera.scale*.35,0,0,Math.PI*2);g.stroke();
   }
  }
  for(const clone of active.clones??[]){
   const ball=Utils.toScreen(clone.ball.x,clone.ball.y,.15);
   g.save();
   g.globalAlpha=Math.min(.66,Math.max(0,(clone.until-Time.time)*2));
   g.shadowColor=clone.player.powerColor||classColors.mendes;g.shadowBlur=9*dpr;
   Player.prototype.render.call({
    x:clone.x,y:clone.y,z:0,frame:clone.frame,orientation:clone.orientation,
    name:'Clone',body:clone.player.body,getSpriteSheet:()=>clone.player.getSpriteSheet()
   },g);
   g.fillStyle='#edf7ff';g.strokeStyle=clone.player.powerColor||classColors.mendes;g.lineWidth=1.5*dpr;
   g.beginPath();g.arc(ball.x,ball.y,Math.max(3*dpr,Settings.camera.scale*.2),0,Math.PI*2);
   g.fill();g.stroke();
   g.restore();
  }
  if(active.practiceFires?.length)paintPracticeFires(g,active.practiceFires);
  paintPitchBoards(g,active,dpr);
  if(active.slimerStreaker)paintStreaker(g,active,dpr);
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
  if(active.opponent?.hordeFC)paintBargeWindups(g,active,dpr);
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
  const teleCast=active.teleCast;
  const portalCaster=teleCast?.portal&&ball.owner===teleCast.player?teleCast.player:null;
  const pointer=portalCaster&&input?.getAim();
  const portalPreview=portalCaster&&teleCast.exit;
  const telePoints=portalCaster?[teleCast.end].filter(Boolean):teleCast
   ? [teleCast.first,teleCast.end].filter(Boolean)
   : [active.teleFlight?.route.end,active.teleFlight?.next].filter(Boolean);
  if(pointer&&input.pointer){
   const at=Utils.toScreen(ball.x+pointer.x,ball.y+pointer.y);
   paintAimRing(g,at,13,13,portalPreview?'#f7baff':'#c2afc6',dpr);
  }
  const teleTarget=telePoints[0];
  let previous=Utils.toScreen(ball.x,ball.y);
  for(const target of telePoints){
   const point=Utils.toScreen(target.x,target.y);
   g.strokeStyle='#d1bfff';g.lineWidth=4*dpr;
   g.setLineDash([8*dpr,6*dpr]);g.beginPath();g.moveTo(previous.x,previous.y);g.lineTo(point.x,point.y);g.stroke();g.setLineDash([]);
   paintAimRing(g,point,21,11,'#d1bfff',dpr);
   previous=point;
  }
  const portalExit=portalCaster?portalPreview:active.teleFlight?.exit;
  const flash=active.portalFlash;
  if(portalExit||flash?.until>Time.time){
   const exit=portalExit||flash.exit;
   const point=Utils.toScreen(exit.x,exit.y);
   const heading=Utils.toScreen(exit.x+exit.dx*6,exit.y+exit.dy*6);
   paintAimRing(g,point,25,14,'#f7baff',dpr);
   if(portalExit){
    g.beginPath();g.moveTo(point.x,point.y);g.lineTo(heading.x,heading.y);g.stroke();
   }else{
    const entry=Utils.toScreen(flash.entry.x,flash.entry.y);
    paintAimRing(g,entry,25,14,'#f7baff',dpr);
   }
  }
  const arcPreview=active.arcCast?.flight?.preview;
  if(arcPreview){
   const points=arcPreview.map(sample=>Utils.toScreen(sample.x,sample.y,sample.z||0));
   const tip=points.at(-1),before=points.at(-2);
   const angle=Math.atan2(tip.y-before.y,tip.x-before.x);
   g.strokeStyle=active.arcCast.flight.shot?classColors.mendes:active.arcCast.flight.clearance<1?'#ffa36e':active.arcCast.player.powerColor;g.lineWidth=5*dpr;
   g.beginPath();g.moveTo(points[0].x,points[0].y);
   for(const point of points.slice(1))g.lineTo(point.x,point.y);
   g.moveTo(tip.x-22*dpr*Math.cos(angle-.5),tip.y-22*dpr*Math.sin(angle-.5));
   g.lineTo(tip.x,tip.y);
   g.lineTo(tip.x-22*dpr*Math.cos(angle+.5),tip.y-22*dpr*Math.sin(angle+.5));
   g.stroke();
   const color=g.strokeStyle;
   paintAimRing(g,tip,21,11,color,dpr);
   const receiver=active.arcCast.previewTarget;
   if(receiver&&!active.arcCast.flight.shot){
    const marker=Utils.toScreen(receiver.x,receiver.y);
    paintAimRing(g,marker,24,13,color,dpr);
   }
  }
  const p=match.player,point=Utils.toScreen(p.x,p.y),scale=Settings.camera.scale;
  if(!p.isSentOff&&!fulltimeScene){
   g.strokeStyle=p.slimedUntil>Time.time?'#b4ef70':p.powerColor||'#ffcd61';g.lineWidth=2*dpr;g.beginPath();g.ellipse(point.x,point.y,scale*.72,scale*.32,0,0,Math.PI*2);g.stroke();
   const markerY=point.y-scale*(2.8*(p.body?.height??1))-(p.z||0)*scale;
   g.fillStyle=p.powerColor||'#ffcd61';g.beginPath();g.moveTo(point.x,markerY);g.lineTo(point.x-scale*.25,markerY-scale*.45);g.lineTo(point.x+scale*.25,markerY-scale*.45);g.closePath();g.fill();
   const aim=input?.getAim();
   const charge=active._manualCharge;
   const showAccuracy=(testMode||trainingGround)&&input?.pointer&&aim&&Math.hypot(aim.x,aim.y)>1e-4
     &&active.ball.owner===p&&active.matchState==='play'&&!active.setPieceType&&!arcPreview&&!teleTarget;
   if(showAccuracy){
    const pass=p.role==='GK'||charge?.action==='pass'||charge?.action==='lob';
    paintAccuracyCone(g,active.ball,aim,pass?p.effectivePassAccuracy:p.effectiveShotAccuracy,pass?'#8ce9ff':'#ffd479',dpr);
   }
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
   }else if(aim&&!showAccuracy&&active.ball.owner===p&&!arcPreview&&!teleTarget){
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
 const cover=match?.streetChallenge?.transitionCover;
 if(cover){
  g.fillStyle=`rgba(18,28,32,${cover})`;
  g.fillRect(0,0,canvas.width,canvas.height);
 }
}
function abilityReady(sim,player,ability){
 if(!ability||ability.passive||player.isSentOff||player.actionTimer>0||player.isSliding||player.burningUntil>Time.time)return false;
 const secondDash=ability.icon==='dash'&&player.shadowAgainUntil>Time.time;
 if(!sim.cooldownsOff&&player.powerReadyAt>Time.time&&!secondDash)return false;
 if(sim.arcCast?.player===player||sim.teleCast?.player===player||sim.bargeCharge?.player===player
  ||sim.goalWarp?.player===player)return false;
 if(ability.icon==='blaze')return sim.ball.owner!==player;
 if(['clone','stepover'].includes(ability.icon))return sim.ball.owner===player;
 return true;
}
function updateHud(){
 if(!match||!$('home-score'))return;
 const s=match.sim;
 $('home-score').textContent=s.scoreA;$('away-score').textContent=s.scoreB;
 const cross=s.teamCross,unlocks=teamMoveUnlocks(s);
 const showTeamMoves=(!practice||abilityMatch||!!s.practiceTeamMove)&&!s.lockedHumanPlayer&&!fulltimeScene&&(unlocks.power||unlocks.header||unlocks.overhead);
 $('team-moves').hidden=!showTeamMoves;
 if(showTeamMoves){
  const cooldown=s.cooldownsOff?0:Math.max(0,(s.teamMoveReadyAt??0)-Time.time);
  $('cross-power').hidden=!!cross||!unlocks.power;
  $('cross-header').hidden=!!cross||!unlocks.header;
  $('cross-overhead').hidden=!!cross||!unlocks.overhead;
  const canCross=!cooldown&&s.matchState==='play'&&!s.setPieceType&&s.ball.owner===match.player&&match.player.role!=='GK';
  $('cross-power').disabled=!canCross;
  $('cross-header').disabled=!canCross;
  $('cross-overhead').disabled=!canCross;
  const finish=$('cross-finish');
  finish.hidden=!cross;
  if(cross){
   const ready=crossIsReady(s);
   finish.dataset.ready=String(ready);
   const finishKey=cross.kind==='overhead'?'T':'E';
   const needsTurn=cross.kind==='overhead'&&!facesAwayFromGoal(s,cross.receiver);
   const label=needsTurn?'Turn the receiver away from goal':
    ready?`NOW · Click or press ${finishKey}`:'Wait for green';
   if(finish.textContent!==label)finish.textContent=label;
  }
 }
 const seconds=Math.ceil(match.secondsLeft-1e-8);
 const clock=$('clock');
 const countingDown=(match.timed||match.streetChallenge?.kind==='duel')&&!fulltimeScene&&seconds>=1&&seconds<=10;
 clock.dataset.countdown=countingDown?(seconds<=3?'final':seconds<=5?'urgent':'ready'):'';
 if(countingDown){
  const pulse=Math.max(0,1-(seconds-match.secondsLeft)/.32);
  const urgency=(10-seconds)/9;
  clock.style.setProperty?.('--clock-scale',String(1+urgency*.12+pulse*(.035+urgency*.055)));
 }
 clock.textContent=trainingGround?'FREE PLAY':fulltimeScene?'FULL TIME':`${match.extraTime?'EXTRA TIME · ':''}${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
 const player=match.player,character=match.activeCharacter,ability=fulltimeScene||s.practiceTeamMove?null:match.powerFor(player);
 const powerLabel=$('player-power');
 const charge=s._manualCharge;
 const arc=s.arcCast?.player===player?s.arcCast:null;
 const tele=s.teleCast?.player===player?s.teleCast:null;
 const arcTicks=arc?.ticks||0,portalTicks=tele?.shotTicks||0;
 const chargingPower=!!(arcTicks||portalTicks);
 powerLabel.dataset.ability=ability?.icon||'';
 $('player-number').textContent=character.number;
 $('player-number').style.color=player.powerColor||'';
 $('player-name').textContent=CHARACTERS.find(c=>c.id===player.characterId)?.label||(player.role==='GK'?'Keeper':character.short);
 powerLabel.hidden=!ability;
 $('power-level').hidden=player.powerLevel!==2;
 const hint=(player.powerLevel===2?ability?.level2:null)??ability?.hint;
 if(ability){
  const remaining=s.cooldownsOff?0:Math.max(0,player.powerReadyAt-Time.time);
  const graphic=$('power-icon'),timer=$('power-timer');
  if($('power-name').textContent!==ability.name)$('power-name').textContent=ability.name;
  const glyph=icon(ability.icon);
  if(graphic.innerHTML!==glyph)graphic.innerHTML=glyph;
  const secondDash=ability.icon==='dash'&&player.shadowAgainUntil>Time.time;
  const warp=ability===GOAL_WARP&&s.goalWarp;
  const beast=activeBeastForm(player);
  const active=beast||warp||s.bargeCharge?.player===player;
  const armed=arc||tele;
  const waitingForBall=['clone','stepover'].includes(ability.icon)&&s.ball.owner!==player;
  const carryingSlide=ability.icon==='blaze'&&s.ball.owner===player;
  const ready=abilityReady(s,player,ability);
  const nutmegBoost=ability.icon==='nutmeg'&&player.nutmegBoostUntil>Time.time;
  timer.textContent=nutmegBoost?`${Math.ceil(player.nutmegBoostUntil-Time.time)}s BOOST`:ability.passive?'PASSIVE':chargingPower?'CHARGING':secondDash?'DASH 2':warp?`${Math.ceil(warp.until-Time.time)}s ACTIVE`:beast?`${Math.ceil(player.beastUntil-Time.time)}s ACTIVE`:active?'ACTIVE':armed?'ARMED':remaining?`${Math.ceil(remaining)}s`:carryingSlide?'OFF BALL ONLY':waitingForBall?'NEEDS POSSESSION':ready?'READY · SPACE':'RECOVERING';
  powerLabel.dataset.state=ability.passive?'active':chargingPower?'charging':active||armed?'active':ready?'ready':'cooldown';
  powerLabel.style.setProperty?.('--recharge',`${player.powerCooldown ? remaining/player.powerCooldown*100 : 0}%`);
  const help=$('power-help');
  const description=player.powerLevel===2&&ability.level2&&ability.level2!==ability.hint
   ?`${ability.hint} Level 2: ${ability.level2}`:ability.hint;
  if(help.textContent!==description)help.textContent=description;
 }
 if(practice&&!streetEvent&&!abilityMatch&&!showcase){
  const tip=$('practice-tip');
  $('practice-levels').hidden=!ability?.level2;
  for(const level of [1,2])$('practice-level-'+level).setAttribute('aria-pressed',String(player.powerLevel===level));
  $('team-drill-reset').hidden=!s.practiceTeamMove&&!['nutmeg','blast-shot'].includes(match.practiceCharacter)&&!Object.hasOwn(DRUID_FORMS,match.practiceCharacter);
  const text=s.practiceTeamMove?.hint||hint||'';
  if(tip.textContent!==text)tip.textContent=text;
  tip.hidden=!text;
 }
 if(showcase){
  const stat=match.club.previewStat(showcase.id);
  const status=stat||((['crossbar','sheet','first-goal'].includes(showcase.id))?`Bonus gold · ${match.club.gold}`:
   showcase.id==='overtime'?`Clock · ${Math.round(match.secondsLeft)}s`:showcase.id==='tonic'?`Movement speed · ${Math.round((player.movementScale??1)*100)}%`:'');
  if($('showcase-result').textContent!==status)$('showcase-result').textContent=status;
 }
 $('stamina').value=match.sprintReserve;
 const power=portalTicks?holdPower01(portalTicks):arcTicks?Math.min(1,arcTicks/ARC_BEND_TICKS):getManualChargePower(s);
 $('charge').value=power;
 $('power-text').textContent=portalTicks?`SHOT POWER ${Math.round(power*100)}%`:arcTicks?`BEND ${Math.round(power*100)}%`:charge?`${charge.action==='shoot'?'SHOT':'KICK'} POWER ${Math.round(power*100)}%`:'KICK POWER';
 const chargeLabel=$('power-label');
 chargeLabel.dataset.ability=chargingPower?ability?.icon||'':'';
 chargeLabel.classList.toggle('charging',!!charge||chargingPower);
 $('direction').textContent=streetEvent?(streetEvent.kind==='crossbar'?(match.streetChallenge.phase==='collect'?'COLLECT THE NEW BALL':'HOLD TO SHOOT'):match.streetChallenge.attacking?'ATTACK →':'DEFEND →'):redCardAim?'SELECT AN OPPONENT · ESC TO CANCEL':player.slimedUntil>Time.time?`SLIMED · ${Math.ceil(player.slimedUntil-Time.time)}s`:player.role==='GK'?(s.ball.owner===player?'LEFT PASS · RIGHT CLEAR':'L · DIVE'):s.isSecondHalf()?'← ATTACK':'ATTACK →';
 const feedback=match.feedback;const callText=feedback&&feedback.until>Time.time?feedback.text:'';
 if($('call-feedback').textContent!==callText)$('call-feedback').textContent=callText;
 const labels={freekick:'FREE KICK'};
 const goal=s.matchState==='goal',intro=!goal&&!practice&&Time.time<match.introUntil;
 const announcement=$('announcement');
 const label=match.streetChallenge?.status??(fulltimeScene?(match.winner?'Full time':'Draw'):goal?'Goal':match.extraTimeAnnouncementUntil>Time.time?'Extra time':intro?`${run?.teamName||'Spellside'} vs ${activeOpponent.name}`:labels[s.matchState]||'');
 if(announcement.textContent!==label)announcement.textContent=label;
 announcement.classList.toggle('match-intro',intro);
 const cover=match.streetChallenge?.transitionCover;
 announcement.style.opacity=cover?String(1-cover):'';
 announcement.style.color=goal?(s.goalScoredTeam==='A'?'#f5bf50':activeOpponent.color):'';
}
function loop(now){
 try{
  const dt=Math.min(.12,(now-lastFrame)/1000||0);lastFrame=now;
  if(view==='kick-ups'){
   kickUps.step(dt);
   if(kickUps.done)finishKickUps(kickUps.count===kickUps.target?'Target reached.':'The ball hit the ground.');
   else renderKickUps();
  }
  if(match&&!paused&&view==='play'){
   accumulator+=dt;
   while(accumulator>=LOGIC_DT){
    accumulator-=LOGIC_DT;
    if(fulltimeScene){
     Time.advanceFixedLogicStep();
     if(fulltimeScene.step()){overlay('finished');break;}
    }else{
     match.step();
     if(match.streetChallenge?.done){finishStreetEvent();break;}
     if(match.finished){
      fulltimeScene=new FulltimePresentation(match);
      input?.reset();
      $('touch').hidden=true;
     }
    }
   }
   if(view==='play')updateHud();
  }
  updateGold(now);
  const width=window.innerWidth,height=window.innerHeight;
  const sceneChanged=lastPaintView!==view||lastPaintMatch!==match||lastPaintWidth!==width||lastPaintHeight!==height;
  if(sceneChanged||(match&&!paused&&view==='play'&&now-lastPaintAt>=16)){
   lastPaintAt=now;lastPaintView=view;lastPaintMatch=match;lastPaintWidth=width;lastPaintHeight=height;
   paint();
  }
 }catch(e){paused=true;toast(`Match paused: ${e.message}`);}
 raf=requestAnimationFrame(loop);
}
function pointerAim(e){
 const canvas=$('pitch'),r=canvas.getBoundingClientRect();
 const sx=(e.clientX-r.left)*canvas.width/r.width,sy=(e.clientY-r.top)*canvas.height/r.height;
 const targetHeight=match.streetChallenge?.kind==='crossbar'?match.streetChallenge.goal.height:0;
 const {scaleZ}=Utils.getOrthoScales(Settings.camera.scale);
 const w=Utils.worldDeltaFromScreenDelta(sx-Settings.camera.offsetX,sy-Settings.camera.offsetY+targetHeight*scaleZ);
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
 on(document,'input',e=>{
  const key=e.target.dataset?.trainingStat;
  if(!trainingGround||view!=='play'||!TRAINING_GROUND_STATS.some(([stat])=>stat===key))return;
  const value=Number(e.target.value);
  if(!Number.isInteger(value)||value<1||value>statMax(key))return;
  const player=match.sim.players[trainingPlayerIndex];
  if(!player||player.isSentOff)return;
  const stats=trainingOverrides.get(trainingPlayerIndex)||{};
  stats[key]=value;
  trainingOverrides.set(trainingPlayerIndex,stats);
  player.stats[key]=value;
  $('training-value-'+key).textContent=value;
 });
 on(document,'change',e=>{
  if(trainingGround&&view==='play'&&e.target.id==='training-player'){
   const index=Number(e.target.value);
   const player=match.sim.players[index];
   if(player&&!player.isSentOff){
    trainingPlayerIndex=index;
    refreshTrainingStatEditor();
   }
   return;
  }
  if(trainingGround&&view==='play'&&['training-ability','training-level'].includes(e.target.id)){
   if(e.target.id==='training-ability'){
    const ability=e.target.value;
    if(ability&&!Object.hasOwn(trainingPowers,ability))return;
    trainingAbility=ability;
    trainingLevel=1;
    $('training-level').value='1';
    $('training-level').disabled=!trainingPowers[ability]?.level2;
   }else trainingLevel=trainingPowers[trainingAbility]?.level2&&e.target.value==='2'?2:1;
   match.setTrainingAbility(trainingAbility,trainingLevel);
   return;
  }
  const side=e.target.dataset?.trainingSide;
  if(trainingGround&&view==='play'&&Object.hasOwn(trainingSquad,side)){
   const value=side.endsWith('Keeper')?e.target.checked:Number(e.target.value);
   if(typeof value==='boolean'||[1,2,3,4].includes(value)||side==='away'&&value===0){
    trainingSquad[side]=value;
    applyTrainingSquads();
   }
   return;
  }
  if(e.target.id==='team-color'&&view==='select'&&/^#[0-9a-f]{6}$/i.test(e.target.value)){
   teamColor=e.target.value;
   for(const shirt of $('overlay').querySelectorAll?.('[data-shirt]')||[])shirt.setAttribute('fill',teamColor);
  }
  if(e.target.id!=='cooldowns-off'||!practice||!match)return;
  match.sim.cooldownsOff=e.target.checked;
  $('pitch').focus({preventScroll:true});
 });
 on(document,'click',async e=>{
  if(loading)return;
  const teamMove=e.target.closest('[data-team-move]');
  if(teamMove&&view==='play'&&input){
   const code=teamMove.dataset.teamMove;
   input.press(code);input.release(code);
   $('pitch').focus({preventScroll:true});
   return;
  }
  const level=e.target.closest('[data-practice-level]');
  if(level&&practice&&view==='play'&&match.powerFor(match.player)?.level2){
   const selectedLevel=Number(level.dataset.practiceLevel);
   if(selectedLevel!==match.player.powerLevel)match.resetPractice(match.practiceCharacter,selectedLevel);
   $('pitch').focus({preventScroll:true});
   return;
  }
  const player=e.target.closest('[data-practice-player]');
  if(player&&view==='abilities'){
   const drill=player.dataset.practicePlayer;
   if(Object.hasOwn(guideAbilities,drill))showAbilityGuide(drill);
   return;
  }
  if(player&&practice&&!abilityPreview&&view==='play'){
   match.resetPractice(player.dataset.practicePlayer);
   for(const button of document.querySelectorAll('[data-practice-player]')){
    button.setAttribute('aria-pressed',String(button===player));
   }
   $('pitch').focus({preventScroll:true});
   return;
  }
  const purchase=e.target.closest('[data-buy]');
  if(view==='market'&&purchase){if(run.purchase(purchase.dataset.buy))showMarket();return;}
  const eventChoice=e.target.closest('[data-event-choice]');
  const bardPlayer=e.target.closest('[data-bard-player]');
  if(view==='bard-curse'&&bardPlayer){
   if(run.chooseBardCurse(Number(bardPlayer.dataset.bardPlayer)))await continueEvent();
   return;
  }
  const trialEvent=e.target.closest('[data-try-event]');
  if(view==='events-catalog'&&trialEvent){
   tryEvent(trialEvent.dataset.tryEvent);
   return;
  }
  const streetChoice=e.target.closest('[data-street-player]');
  if(view==='event'&&streetChoice){
   const player=run.roster[Number(streetChoice.dataset.streetPlayer)];
   const event=run.event;
   if(player&&!player.keeper&&run.beginEventChallenge()){
    streetEvent={kind:event.challenge,title:event.name,player,
     challenger:event.challenge==='duel'?run.duelChallenger:null};
    await start();
   }
   return;
  }
  if(view==='event'&&eventChoice){
   const index=Number(eventChoice.dataset.eventChoice);
   const {name,choices}=run.event;
   if(run.chooseEvent(index)){
    if(run.kickUpTarget)showKickUps();
    else if(run.pendingBardCurse)showBardCurse();
    else if(eventPractice){
     view='text-event-result';
     dayScreen(name,`<p role="status">You chose ${esc(choices[index].label)}.</p>${eventContinueButton('text-event-continue')}`);
    }
    else await startLeagueMatch();
   }
   return;
  }
  const trial=e.target.closest('[data-showcase]');
  if(view==='catalog'&&trial){
   showcase=(catalogType==='gear'?CLUB_GEAR:MATCH_ITEMS).find(entry=>entry.id===trial.dataset.showcase);
   if(showcase){practice=true;await start();}
   return;
  }
  const item=e.target.closest('[data-item]');
  if(view==='play'&&item){
   if(item.dataset.item==='red-card'){
    if(match.sim.matchState==='play'&&!match.sim.setPieceType){redCardAim=!redCardAim;renderMatchItems();}
    $('pitch').focus({preventScroll:true});
   }else useMatchItem(item.dataset.item);
   return;
  }
  const hire=e.target.closest('[data-hire]');
  if(view==='tavern'&&hire&&run.choose(hire.dataset.hire)){showTavern();return;}
  const previewOffer=e.target.closest('[data-preview]');
  if(view==='tavern'&&previewOffer){
   const recruit=run.offers.find(offer=>offer.id===previewOffer.dataset.preview);
   if(recruit?.power){abilityPreview={source:'tavern',player:recruit};showAbilities();}
   return;
  }
  const character=e.target.closest('[data-character]');
  if(character&&!loading){selected=character.dataset.character;for(const el of document.querySelectorAll('[data-character]')){el.classList.toggle('selected',el===character);el.setAttribute('aria-pressed',String(el===character));}return;}
  const card=e.target.closest('[data-upgrade-card]');
  if(view==='reward'&&card){
   const choice=Number(card.dataset.upgradeCard);
   if(run.selectUpgrade(choice)){
    renderUpgradeCards();
    renderRivalRecruit();
    $('overlay').querySelector?.(`[data-upgrade-card="${choice}"]`)?.focus();
   }
   return;
  }
  const action=e.target.closest('[data-action]')?.dataset.action;
  if(action==='back-ability-preview'&&abilityPreview){
   const {source}=abilityPreview;
   if(match){match.destroy();match=null;input=null;}
   SoundDB.stopCrowd();practice=false;abilityPreview=null;guideDrill=null;abilityMatch=null;
   if(source==='tavern')showTavern();
   else renderStarterSelection();
  }
  else if(action==='preview-starter'&&view==='select'){
   const starter=CHARACTERS.find(c=>c.id===selected);
   teamName=$('team-name')?.value??teamName;
   const color=$('team-color')?.value;
   if(/^#[0-9a-f]{6}$/i.test(color||''))teamColor=color;
   const look=playerAppearance(selected,draftLooks[selected]);
   abilityPreview={source:'starter',player:{...starter,stats:starterStats(starter.stats),characterId:selected,name:look.name.toUpperCase(),body:appearanceBody(starter.body,look),
    appearance:draftLooks[selected],number:draftNumbers[selected],power:starterPowers[selected]}};
   showAbilities();
  }
  else if(action==='ability-list'&&view==='abilities'){
   if(abilityMatch){
    match?.destroy();match=null;input=null;abilityMatch=null;practice=false;
    $('hud').hidden=true;
   }
   showAbilities();
  }
  else if(action==='ability-preview-guide'&&abilityMatch){
   paused=true;input?.reset();view='abilities';
   $('overlay').hidden=false;$('touch').hidden=true;
   showAbilityGuide(guideDrill,abilityPreview?.player);
  }
  else if(action==='start-ability-preview'&&view==='abilities'&&guideDrill){
   if(match&&practice&&!abilityPreview&&!abilityMatch){
    match.resetPractice(guideDrill);view='play';paused=false;
    $('overlay').hidden=true;$('touch').hidden=false;
    $('pitch').focus({preventScroll:true});
   }else{
    abilityMatch=null;practice=true;
    await start(guideDrill);
   }
  }
  else if(action==='ability-go-to-game'&&view==='abilities'&&guideDrill){
   const teamMove=TEAM_DRILLS[guideDrill]?.kind;
   const power=Object.keys(drills).find(key=>drills[key]===guideDrill);
   const characterId=Object.keys(starterClasses).find(id=>starterClasses[id].includes(power))??(teamMove?'price':'druid');
   const character=CHARACTERS.find(c=>c.id===characterId);
   const player=abilityPreview?.player??{...character,characterId,name:character.short,power};
   abilityMatch={player,teamMove};
   practice=true;
   await start();
  }
  else if(view==='reward'&&action==='sign-rival'&&run.signRival()){
   renderRivalRecruit();
   toast('Player signed');
   $('post-match-continue').focus();
  }
  else if(view==='reward'&&action==='rest'&&run.confirmUpgrade()&&run.choose('rest'))showRoute();
  else if(view==='reward'&&action==='league-results'&&run.confirmUpgrade())showLeagueResults();
  else if(view==='route'&&action==='enter-tavern'&&run.enterTavern())showTavern();
  else if(view==='route'&&action==='market'&&run.choose('market'))showMarket();
  else if(view==='home'&&action==='events-catalog')showEvents();
  else if(view==='route'&&action==='event'&&run.choose('event'))showEvent();
  else if(view==='event'&&action==='skip-event'&&run.finishRoute())await continueEvent();
  else if(view==='text-event-result'&&action==='text-event-continue')await continueEvent();
  else if(streetEvent&&!loading&&action==='forfeit-street')finishStreetEvent(true);
  else if(view==='street-result'&&(action==='duel-gold'||action==='duel-recruit')&&run.chooseDuelReward(action==='duel-gold'?'gold':'recruit'))await continueEvent();
  else if(view==='street-result'&&action==='street-continue')await continueEvent();
  else if(view==='kick-ups'&&action==='kick-up')kickUp();
  else if(view==='kick-ups'&&action==='leave-kick-ups')finishKickUps('Attempt forfeited.');
  else if(view==='kick-up-result'&&action==='kick-up-continue')await continueEvent();
  else if(['route','tavern','market'].includes(view)&&action==='continue'&&run.finishRoute())await startLeagueMatch();
  else if(action==='club-gear'||action==='match-items')showCatalog(action==='club-gear'?'gear':'item');
  else if(action==='back-catalog'&&showcase){
   match?.destroy();match=null;input=null;showcase=null;practice=false;showCatalog(catalogType);
  }
  else if(action==='reset-team-drill'&&(match?.sim.practiceTeamMove||['nutmeg','blast-shot'].includes(match?.practiceCharacter)||Object.hasOwn(DRUID_FORMS,match?.practiceCharacter))){
   match.resetPractice(match.practiceCharacter);
   $('pitch').focus({preventScroll:true});
  }
  else if(action==='reset-showcase'&&showcase)await start();
  else if(action==='training-ground'&&view==='home'){
   trainingGround=true;testMode=true;practice=false;
   Object.assign(trainingSquad,{home:1,away:0,homeKeeper:false,awayKeeper:false});
   trainingOverrides.clear();trainingPlayerIndex=-1;
   trainingAbility='';trainingLevel=1;trainingEnemiesFrozen=false;
   await start();
  }
  else if(trainingGround&&view==='play'&&action==='training-freeze'){
   trainingEnemiesFrozen=!trainingEnemiesFrozen;
   match.setTrainingFreeze(trainingEnemiesFrozen);
   const button=$('training-freeze');
   button.setAttribute('aria-pressed',String(trainingEnemiesFrozen));
   button.textContent=trainingEnemiesFrozen?'Unfreeze opponents':'Freeze opponents';
   $('pitch').focus({preventScroll:true});
  }
  else if(trainingGround&&view==='play'&&action==='training-ground-reset'){
   const player=match.sim.players[trainingPlayerIndex];
   for(const [key] of TRAINING_GROUND_STATS)player.stats[key]=trainingDefaults[trainingPlayerIndex][key];
   trainingOverrides.delete(trainingPlayerIndex);
   refreshTrainingStatEditor();
  }
  else if(action==='matchup'){
   trainingGround=false;
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
  else if(action==='practice'||action==='practice-menu'){paused=true;input?.reset();$('overlay').hidden=false;$('touch').hidden=true;showAbilities();}
  else if(action==='new-run'&&(view!=='reward'||run.upgradesComplete))showSelection(true);
  else if(action==='play'&&view==='select')await startRun();
  else if(action==='kickoff'&&view==='play'&&match?.sandbox==='warmup')await start(undefined,{kickoff:true});
  else if(action==='retry')await start();
  else if(action==='choose')showSelection();
  else if(action==='pause'&&!match?.finished)overlay('paused');
  else if(action==='resume')resume();
  else if(action==='sound'){sound=!sound;Settings.soundsMuted=!sound;$('sound').innerHTML=icon(sound?'sound':'muted');$('sound').setAttribute('aria-label',sound?'Mute sound':'Enable sound');if(sound)SoundDB.resume();else SoundDB.stopCrowd();}
  else if(action==='fullscreen'){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch(_){toast('Fullscreen is unavailable in this browser.');}}
 });
 on(document,'keydown',e=>{
  if(view!=='kick-ups'||e.code!=='Space')return;
  e.stopPropagation();
  if(e.target?.closest?.('[data-action="leave-kick-ups"]'))return;
  e.preventDefault();
  if(!e.repeat)kickUp();
 });
 on(window,'keydown',e=>{if(e.code==='Escape'&&redCardAim){redCardAim=false;renderMatchItems();e.preventDefault();return;}if(e.code==='Escape'&&(view==='play'||view==='paused')&&match&&!match.finished){e.preventDefault();if(paused)resume();else overlay('paused');}});
 on(window,'blur',()=>{input?.reset();if(match&&!match.finished&&view==='play')overlay('paused');});
 on(document,'visibilitychange',()=>{if(document.hidden&&match&&!match.finished&&view==='play')overlay('paused');});
 const pitch=$('pitch');
 const trackPointer=e=>{if(input&&view==='play')input.pointer={clientX:e.clientX,clientY:e.clientY};};
 on(pitch,'pointerdown',e=>{
  if(e.pointerType!=='touch'||view!=='play')return;
  e.preventDefault();
  if(match.streetChallenge?.kind==='crossbar')trackPointer(e);
  else targetRedCard(e);
 });
 on(pitch,'pointermove',e=>{if(e.pointerType!=='touch')trackPointer(e);});
 const draggingSwerve=()=>match?.sim.arcCast?.target||match?.sim.arcCast?.shot;
 on(window,'pointermove',e=>{if(e.target!==pitch&&e.pointerType!=='touch'&&draggingSwerve())trackPointer(e);});
 on(pitch,'mouseleave',()=>{if(input&&!draggingSwerve())input.pointer=null;});
 on(pitch,'contextmenu',e=>e.preventDefault());
 const mouseAction={0:'MouseLeft',2:'MouseRight'};
 on(pitch,'mousedown',e=>{
  const code=mouseAction[e.button];if(!code||!input||view!=='play'||e.sourceCapabilities?.firesTouchEvents)return;
  e.preventDefault();pitch.focus({preventScroll:true});if(targetRedCard(e))return;trackPointer(e);input.press(code);
 });
 on(window,'mouseup',e=>{const code=mouseAction[e.button];if(code){if(e.target===pitch)trackPointer(e);input?.release(code);}});
 bindTouch();lastFrame=performance.now();raf=requestAnimationFrame(loop);
 const drill=new URLSearchParams(window.location?.search).get('practice');
 if(drill!==null){
  const directDrills={'orc-barge':'price','orc-spin':'spin-kick','goal-warp':'goal-warp','tele-pass':'tele-pass',nutmeg:'nutmeg',clone:'clone',stepover:'stepover','blaze-slide':'blaze-slide','blast-shot':'blast-shot','orc-header':'cross-header'};
  const practiceDrill=Object.hasOwn(TEAM_DRILLS,drill)||Object.hasOwn(DRUID_FORMS,drill)?drill:directDrills[drill]??'portal-pass';
  selected=Object.hasOwn(DRUID_FORMS,drill)?'druid':['orc-spin','orc-barge','blaze-slide','blast-shot'].includes(drill)?'price':['nutmeg','stepover'].includes(drill)?'cole':'mendes';
  practice=true;
  start(practiceDrill);
 }
}
document.addEventListener('DOMContentLoaded',init);
module.exports={portrait};
