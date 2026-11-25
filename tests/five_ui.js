require('./mock_env.js');
const assert=require('node:assert/strict');
const baseCreate=document.createElement;
const originalCreate=tag=>{const c=baseCreate(tag);if(tag==='canvas'){const get=c.getContext.bind(c);c.getContext=type=>{const ctx=get(type);return new Proxy(ctx,{get:(t,k)=>typeof t[k]!=='undefined'?t[k]:(()=>{})});};}return c;};
document.createElement=originalCreate;
const nodes=new Map(),listeners=new Map();
let focusedNode;
const accuracyFills=[];
const classes=()=>({toggle(){},add(){},remove(){}});
function makeNode(id){
 if(nodes.has(id))return nodes.get(id);
 const canvas=id==='pitch'?originalCreate('canvas'):null;
 const n={id,dataset:{},style:{},hidden:false,classList:classes(),textContent:'',width:1280,height:800,
  setAttribute(){},focus(){focusedNode=this;},setPointerCapture(){},getBoundingClientRect:()=>({left:0,top:0,width:1280,height:800}),
  addEventListener(type,fn){listeners.set(id+':'+type,fn);},removeEventListener(){}};
 let html='';Object.defineProperty(n,'innerHTML',{get:()=>html,set:v=>{html=v;for(const m of v.matchAll(/id="([^"]+)"/g))makeNode(m[1]);}});
 if(canvas){const context=canvas.getContext('2d');const gradient={addColorStop(){}};
  n.getContext=()=>new Proxy(context,{get:(target,key)=>key==='fill'?()=>{
   if((target.fillStyle==='#ffd479'||target.fillStyle==='#8ce9ff')&&target.globalAlpha===.2)accuracyFills.push(target.fillStyle);
   target.fill?.();
  }:key==='ellipse'?(...args)=>assert.ok(args.length>=7,'Canvas ellipse requires seven arguments'):key==='createRadialGradient'||key==='createLinearGradient'?()=>gradient:typeof target[key]!=='undefined'?target[key]:(()=>{})});
 }
 nodes.set(id,n);return n;
}
for(const id of ['pitch','hud','touch','overlay','message','joystick','stick-nub'])makeNode(id);
let nextFrame;
global.requestAnimationFrame=fn=>{nextFrame=fn;return 1;};global.cancelAnimationFrame=()=>{};
global.localStorage={getItem:()=>null,setItem(){}};
global.window.addEventListener=(type,fn)=>listeners.set('window:'+type,fn);
global.window.removeEventListener=()=>{};global.window.devicePixelRatio=1;global.window.matchMedia=()=>({matches:false});
global.document.getElementById=id=>nodes.get(id)||null;
global.document.addEventListener=(type,fn)=>listeners.set('document:'+type,fn);
global.document.removeEventListener=()=>{};
global.document.querySelectorAll=selector=>selector==='[data-key]'?['Digit1','Digit2','Digit3','ShiftLeft','Space'].map(code=>({...makeNode('touch-'+code),dataset:{key:code}})):[];
let activeMatch,fulltime;
if(process.env.FIVE_TEST_BUNDLE)require('node:vm').runInThisContext(require('node:fs').readFileSync(require('node:path').join(__dirname,'../build/rogue.bundle.js'),'utf8'));
else {
 const {FiveMatch}=require('../kernel/five/match.js');
 const {MatchStates}=require('../kernel/providers/simulator/simulator.js');
 const create=FiveMatch.create.bind(FiveMatch);
 FiveMatch.create=async(...args)=>activeMatch=await create(...args);
 fulltime=(home,away)=>{
  const {sim}=activeMatch;
  sim.scoreA=home;sim.scoreB=away;sim.fsm.changeState(MatchStates.Fulltime);
 };
 require('../kernel/apps/soccer-rogue/app.js');
}
const clickData=async(key,value)=>{await listeners.get('document:click')({target:{closest:selector=>selector===`[data-${key}]`?{dataset:{[key.replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]:value}}:null}});};
const click=action=>clickData('action',action);
const pickUpgrade=async(index=0)=>{
 assert.equal((nodes.get('upgrade-cards').innerHTML.match(/data-upgrade-card=/g)||[]).length,3);
 assert.doesNotMatch(nodes.get('upgrade-cards').innerHTML,/data-kind="(?:item|power)"/);
 assert.equal((nodes.get('upgrade-cards').innerHTML.match(/class="upgrade-card-detail"/g)||[]).length,3);
 assert.equal(nodes.get('hud').hidden,true);
 await clickData('upgrade-card',String(index));
 assert.match(nodes.get('upgrade-cards').innerHTML,/aria-pressed="true"/);
 assert.equal(nodes.get('post-match-continue').disabled,false);
};
const kickOff=async()=>{
 assert.match(nodes.get('hud').innerHTML,/WARMUP[\s\S]*data-action="kickoff"/);
 assert.equal(nodes.get('overlay').hidden,true);
 if(activeMatch){
  assert.equal(activeMatch.sim.warmup,true);
  assert.equal(activeMatch.timed,false);
  assert.ok(activeMatch.sim.teamB.players.every(player=>player.isSentOff));
  activeMatch.sim.scoreA=7;
 }
 await click('kickoff');
 assert.doesNotMatch(nodes.get('hud').innerHTML,/data-action="kickoff"/);
 if(activeMatch){
  assert.equal(activeMatch.timed,true);
  assert.equal(activeMatch.secondsLeft,60);
  assert.equal(activeMatch.sim.scoreA,0);
 }
};
const assertMatchStarted=()=>{
 assert.equal(nodes.get('overlay').hidden,true);
 assert.match(nodes.get('hud').innerHTML,/(?:LEAGUE|BOSS) FIXTURE/);
 assert.doesNotMatch(nodes.get('hud').innerHTML,/Disable cooldowns/);
 if(activeMatch){
  assert.equal(activeMatch.sim.cooldownsOff,false);
  assert.ok(activeMatch.sim.teamB.players.some(p=>!p.isSentOff));
 }
};
let frameTime=0;
const tick=(ms=100)=>{frameTime=Math.max(frameTime,performance.now())+ms;nextFrame(frameTime);};
(async()=>{
 listeners.get('document:DOMContentLoaded')();assert.match(nodes.get('overlay').innerHTML,/data-action="new-run"/);
 await click('events-catalog');
 assert.match(nodes.get('overlay').innerHTML,/Special Events[\s\S]*Street 1v1[\s\S]*Text Events[\s\S]*Varek Stonewall/);
 assert.equal((nodes.get('overlay').innerHTML.match(/data-try-event=/g)||[]).length,10);
 await clickData('try-event','Lost and Found');
 await clickData('event-choice','0');
 assert.match(nodes.get('overlay').innerHTML,/345 gold/);
 await click('text-event-continue');
 await clickData('try-event','A Song for the Road');
 assert.match(nodes.get('overlay').innerHTML,/You come across a bard standing outside the pitch/);
 assert.match(nodes.get('overlay').innerHTML,/Valiant Spellside, so mighty and true/);
 await clickData('event-choice','2');
 assert.match(nodes.get('overlay').innerHTML,/data-bard-player="0"/);
 assert.doesNotMatch(nodes.get('overlay').innerHTML,/half speed|stamina|remove.*ability/i);
 await clickData('bard-player','0');
 await clickData('try-event','Street Kick-Ups');
 await clickData('event-choice','0');
 const moveBoot=listeners.get('kick-up-field:pointermove');
 moveBoot({pointerType:'mouse',clientX:640,clientY:710});
 tick(10);
 assert.equal(nodes.get('kick-up-count').textContent,'1 / 10 kick-ups');
 await click('leave-kick-ups');
 await click('kick-up-continue');
 for(const challenge of ['Crossbar Challenge','Street 1v1']){
  await clickData('try-event',challenge);
  assert.match(nodes.get('overlay').innerHTML,/Choose your player/);
  await clickData('street-player','1');
  assert.equal(nodes.get('overlay').hidden,true);
  if(activeMatch&&challenge==='Street 1v1'){
   activeMatch.sim.scoreB=1;
   activeMatch.streetChallenge.done=true;
   tick();
   assert.match(nodes.get('overlay').innerHTML,/Good game\. For your troubles\./);
   assert.match(nodes.get('overlay').innerHTML,/Received (Speed Tonic|Ability Elixir|Sports Mead)/);
  }else{
   await click('pause');
   await click('forfeit-street');
  }
  await click('street-continue');
  assert.match(nodes.get('overlay').innerHTML,/Special Events/);
 }
 await click('choose');
 tick();
 await click('training-ground');tick();
 assert.equal(nodes.get('overlay').hidden,true);
 assert.match(nodes.get('hud').innerHTML,/TRAINING GROUND/);
 assert.match(nodes.get('hud').innerHTML,/Training settings/);
 assert.equal((nodes.get('hud').innerHTML.match(/data-training-stat=/g)||[]).length,8);
 const trainingMatch=activeMatch;
 if(trainingMatch){
  assert.equal(trainingMatch.sim.teamA.getOutfieldPlayers().length,1);
  assert.equal(trainingMatch.sim.teamB.members().length,0);
  assert.ok(trainingMatch.sim.ball.owner===trainingMatch.player);
  assert.ok(!trainingMatch.sim.teamA.members().some(p=>p.role==='GK'));
 }
 const setTrainingStat=(key,value)=>listeners.get('document:input')({target:{dataset:{trainingStat:key},value:String(value)}});
 const setTrainingSide=(key,value)=>listeners.get('document:change')({target:{dataset:{trainingSide:key},value:String(value),checked:value}});
 assert.match(nodes.get('hud').innerHTML,/data-training-stat="shotAccuracy"[^>]*max="100"/);
 assert.match(nodes.get('hud').innerHTML,/data-training-stat="passAccuracy"[^>]*max="100"/);
 if(trainingMatch){
  const aim={clientX:950,clientY:400,pointerType:'mouse'};
  listeners.get('pitch:pointermove')(aim);
  setTrainingStat('shotAccuracy',1);
  accuracyFills.length=0;
  tick();
  assert.ok(accuracyFills.includes('#ffd479'),'low shot accuracy draws a shot cone');
  setTrainingStat('shotAccuracy',100);
  accuracyFills.length=0;
  tick();
  assert.equal(trainingMatch.player.effectiveShotAccuracy,100);
  assert.equal(accuracyFills.includes('#ffd479'),false,'perfect accuracy has no filled spread');
  setTrainingStat('passAccuracy',1);
  trainingMatch.input.press('KeyJ');
  accuracyFills.length=0;
  tick();
  assert.ok(accuracyFills.includes('#8ce9ff'),'charging a pass draws the pass cone');
  setTrainingStat('passAccuracy',100);
  accuracyFills.length=0;
  tick();
  assert.equal(trainingMatch.player.effectivePassAccuracy,100);
  assert.equal(accuracyFills.includes('#8ce9ff'),false,'perfect pass accuracy has no filled spread');
  trainingMatch.input.reset();
  trainingMatch.sim._manualCharge=null;
  await click('training-ground-reset');
 }
 const originalSpeed=trainingMatch?.player.stats.speed;
 const selectTrainingPlayer=player=>listeners.get('document:change')({target:{
  id:'training-player',value:String(trainingMatch.sim.players.indexOf(player))
 }});
 setTrainingStat('speed',92);
 setTrainingSide('home',3);
 setTrainingSide('away',2);
 setTrainingSide('homeKeeper',true);
 assert.equal(nodes.get('training-value-speed').textContent,92);
 if(trainingMatch){
  assert.ok(activeMatch===trainingMatch,'training changes keep the same match instance');
  assert.equal(trainingMatch.sim.teamA.getOutfieldPlayers().length,3);
  assert.equal(trainingMatch.sim.teamB.getOutfieldPlayers().length,2);
  const keeper=trainingMatch.sim.teamA.getGoalkeeper();
  const rival=trainingMatch.sim.teamB.members()[0];
  const teammate=trainingMatch.sim.teamA.getOutfieldPlayers().find(p=>p!==trainingMatch.player);
  assert.equal(trainingMatch.player.stats.speed,92);
  assert.notEqual(teammate.stats.speed,92);
  setTrainingStat('dribblingSpeed',24);
  assert.equal(trainingMatch.player.stats.dribblingSpeed,24);
  assert.equal(trainingMatch.player.stats.speed,92);
  assert.notEqual(teammate.stats.dribblingSpeed,24);
  selectTrainingPlayer(keeper);
  setTrainingStat('speed',37);
  assert.equal(keeper.stats.speed,37);
  selectTrainingPlayer(rival);
  setTrainingStat('shotAccuracy',1);
  setTrainingStat('passAccuracy',99);
  assert.equal(rival.stats.shotAccuracy,1);
  assert.equal(rival.stats.passAccuracy,99);
  assert.notEqual(trainingMatch.player.stats.shotAccuracy,1);
  assert.notEqual(trainingMatch.player.stats.passAccuracy,99);
  selectTrainingPlayer(trainingMatch.player);
  assert.equal(nodes.get('training-value-speed').textContent,92);
 }
 const changeTraining=(id,value)=>listeners.get('document:change')({target:{id,value}});
 changeTraining('training-ability','portal');
 changeTraining('training-level','2');
 await click('training-freeze');
 if(trainingMatch){
  assert.equal(trainingMatch.powerFor(trainingMatch.player).name,'Portal Pass');
  assert.equal(trainingMatch.player.powerLevel,2);
  assert.equal(trainingMatch.sim.trainingEnemiesFrozen,true);
  const enemies=trainingMatch.sim.teamB.getOutfieldPlayers();
  const positions=enemies.map(p=>[p.x,p.y]);
  const clock=trainingMatch.secondsLeft;
  for(let i=0;i<10;i++)tick();
  assert.deepEqual(enemies.map(p=>[p.x,p.y]),positions);
  assert.equal(trainingMatch.secondsLeft,clock);
 }
 await click('training-freeze');
 if(trainingMatch)assert.equal(trainingMatch.sim.trainingEnemiesFrozen,false);
 setTrainingSide('away',0);
 if(trainingMatch)assert.equal(trainingMatch.sim.teamB.members().length,0);
 setTrainingSide('home',1);
 setTrainingSide('homeKeeper',false);
 await click('training-ground-reset');
 if(trainingMatch){
  assert.equal(trainingMatch.sim.teamA.getOutfieldPlayers().length,1);
  assert.ok(!trainingMatch.sim.teamA.members().some(p=>p.role==='GK'));
  assert.equal(trainingMatch.player.stats.speed,originalSpeed);
 }
 await click('choose');
 const randomForLook=Math.random;
 try{
  Math.random=()=>.2;
  await click('new-run');
  const firstDraft=nodes.get('overlay').innerHTML;
  Math.random=()=>.7;
  await click('new-run');
  assert.notEqual(nodes.get('overlay').innerHTML,firstDraft);
 }finally{Math.random=randomForLook;}
 assert.ok(nodes.get('overlay').innerHTML.includes('PICK YOUR PLAYER'));
 assert.doesNotMatch(nodes.get('overlay').innerHTML,/starter-look|>Appearance</);
 assert.equal((nodes.get('overlay').innerHTML.match(/data-character=/g)||[]).length,3);
 assert.equal((nodes.get('overlay').innerHTML.match(/<details class="rating-panel"><summary>Player stats<\/summary>/g)||[]).length,3);
 assert.equal((nodes.get('overlay').innerHTML.match(/<meter /g)||[]).length,15);
 const starterCard=nodes.get('overlay').innerHTML.match(/data-character="([^"]+)"[^>]*aria-pressed="true"[\s\S]*?<span class="jersey-number">(\d+)<\/span>/);
 assert.ok(starterCard);
 const {APPEARANCES}=require('../kernel/five/appearances.js');
 for(const looks of Object.values(APPEARANCES)){
  assert.equal(new Set(looks.map(look=>look.skin)).size,5);
  assert.equal(new Set(looks.map(look=>look.style)).size,5);
 }
 const chosenLook=APPEARANCES[starterCard[1]][3];
 assert.match(nodes.get('overlay').innerHTML,new RegExp(`id="starter-portrait-${starterCard[1]}"[\\s\\S]*?fill="${chosenLook.skin}"`));
 nodes.get('team-name').value='Preview Eleven';
 await click('preview-starter');
 assert.match(nodes.get('overlay').innerHTML,/Training as .* · #/);
 assert.match(nodes.get('overlay').innerHTML,/data-action="start-ability-preview"/);
 assert.doesNotMatch(nodes.get('overlay').innerHTML,/data-example=/);
 assert.match(nodes.get('overlay').innerHTML,/>Play preview match<[\s\S]*>Practice drill</);
 const starterGuide=nodes.get('overlay').innerHTML;
 const {CHARACTERS}=require('../kernel/five/characters.js');
 const baseStarter=CHARACTERS.find(character=>character.id===starterCard[1]);
 const startingSpeed=baseStarter.stats.speed-5;
 assert.ok(starterGuide.includes(`value="${startingSpeed}" aria-label="Speed"`));
 assert.equal((starterGuide.match(/<meter /g)||[]).length,9);
 await click('ability-go-to-game');tick();
 assert.equal(nodes.get('overlay').hidden,true);
 assert.match(nodes.get('hud').innerHTML,/ABILITY PREVIEW/);
 assert.equal(nodes.get('scoreboard').hidden,false);
 if(activeMatch){
  assert.equal(activeMatch.practice,false);
  assert.ok(activeMatch.timed);
  assert.equal(activeMatch.sim.teamB.members().length,5);
  assert.ok(activeMatch.sim.ball.owner===activeMatch.player,'the preview player starts with possession');
  assert.equal(activeMatch.player.characterId,starterCard[1]);
  assert.equal(activeMatch.player.jersey,Number(starterCard[2]));
  assert.equal(activeMatch.player.stats.speed,startingSpeed);
  assert.ok(activeMatch.player.appearance===chosenLook,'the chosen appearance is used');
  const sheet=activeMatch.player.getSpriteSheet();
  const pixels=sheet.getContext('2d').getImageData(0,0,sheet.width,sheet.height).data;
  const [r,g,b]=chosenLook.skin.slice(1).match(/../g).map(channel=>parseInt(channel,16));
  assert.ok(pixels.some((channel,i)=>i%4===0&&channel===r&&pixels[i+1]===g&&pixels[i+2]===b&&pixels[i+3]===255),
   'the match sprite contains the selected skin tone');
  assert.ok(starterGuide.includes(activeMatch.powerFor(activeMatch.player).name));
 }
 await click('ability-preview-guide');
 assert.ok(nodes.get('overlay').innerHTML===starterGuide,'returning shows the starter guide');
 await click('back-ability-preview');
 assert.match(nodes.get('overlay').innerHTML,/value="Preview Eleven"/);
 assert.match(nodes.get('overlay').innerHTML,new RegExp(`jersey-number">${starterCard[2]}<`));
 await click('play');
 await kickOff();assertMatchStarted();
 if(activeMatch)assert.equal(activeMatch.player.stats.speed,startingSpeed);
 assert.equal(nodes.get('overlay').hidden,true);assert.equal(nodes.get('hud').hidden,false);
 assert.equal(nodes.get('message').textContent,'');
 tick();assert.equal(nodes.get('message').textContent,'','live engine render does not throw');
 await click('pause');assert.equal(nodes.get('overlay').hidden,false);assert.ok(nodes.get('overlay').innerHTML.includes('RESUME'));
 await click('resume');assert.equal(nodes.get('overlay').hidden,true);
 listeners.get('window:blur')();assert.equal(nodes.get('overlay').hidden,false,'losing focus pauses');
 const retiredSheets=activeMatch?.sim.playerSheets;
 if(retiredSheets)assert.ok(retiredSheets.size>0,'live kit canvases belong to the match');
 await click('choose');assert.match(nodes.get('overlay').innerHTML,/data-action="new-run"/);assert.equal(nodes.get('hud').hidden,true);
 if(retiredSheets)assert.equal(retiredSheets.size,0,'leaving the match releases its kit canvases');
 if(fulltime){
  const now=Date.now;
  Date.now=()=>0;
  const random=Math.random;
  Math.random=()=>0;
  try{
   await click('new-run');
   nodes.get('team-name').value='Blue Hawks';
   nodes.get('team-color').value='#4466dd';
   await click('play');
   await kickOff();assertMatchStarted();
   assert.deepEqual(activeMatch.sim.teamAbilities,[]);
  }finally{Date.now=now;Math.random=random;}
  assert.match(nodes.get('hud').innerHTML,/#4466dd[^>]*>Blue Hawks/);
  assert.match(nodes.get('hud').innerHTML,/LEAGUE FIXTURE · 1\/4/);
  assert.equal(activeMatch.sim.teamA.players.length,1);
  assert.ok(activeMatch.sim.teamA.getGoalkeeper()===null,'solo home side has no keeper');
  tick();
  assert.equal(nodes.get('power-timer').textContent,'READY · SPACE');
  const {Time}=require('../kernel/core/lib/time.js');
  activeMatch.player.powerReadyAt=Time.time+5;
  tick();
  assert.equal(nodes.get('power-timer').textContent,'5s');

  assert.match(nodes.get('hud').innerHTML,/id="clock">1:00/);
  assert.equal(nodes.get('announcement').textContent,'Blue Hawks vs SLIMERS');
  const {MatchStates}=require('../kernel/providers/simulator/simulator.js');
  activeMatch.sim.goalScoredTeam='B';
  activeMatch.sim.fsm.changeState(MatchStates.Goal);
  tick();
  assert.equal(nodes.get('announcement').textContent,'Goal');
  assert.equal(nodes.get('announcement').style.color,'#a4cf72');
  const home=activeMatch.sim.teamA.players;
  const away=activeMatch.sim.teamB.players;
  const players=[...home,...away];
  const positions=()=>players.map(({x,y})=>[x,y]);
  fulltime(1,0);
  const positionsAtWhistle=positions();
  tick();
  assert.equal(nodes.get('announcement').textContent,'Full time');
  assert.equal(nodes.get('overlay').hidden,true);
  assert.ok(home.every(player=>[12,13].includes(player.frame)),'winning players celebrate immediately');
  assert.ok(away.every(player=>player.frame===9),'losing players crouch immediately');
  assert.deepEqual(positions(),positionsAtWhistle);
  for(let i=0;i<30;i++){
   tick();
   assert.deepEqual(positions(),positionsAtWhistle,'both teams react where the match ended');
  }
  assert.equal(nodes.get('overlay').hidden,true);
  for(let i=0;i<16&&nodes.get('overlay').hidden;i++)tick();
  assert.match(nodes.get('overlay').innerHTML,/data-action="rest"/);
  assert.doesNotMatch(nodes.get('overlay').innerHTML,/data-hire=/);
  assert.match(nodes.get('overlay').innerHTML,/\+3 points · 3 total/);
  assert.equal(nodes.get('gold-total').textContent,'155 gold');
  for(let i=0;i<10;i++)tick();
  assert.equal(nodes.get('gold-total').textContent,'300 gold');
  assert.match(nodes.get('overlay').innerHTML,/<h1 id="upgrade-heading">Upgrade a player<\/h1>/);
  assert.match(nodes.get('overlay').innerHTML,/data-action="rest" disabled>\s*Rest/);
  await click('rest');
  assert.match(nodes.get('overlay').innerHTML,/Upgrade a player/);
  const statCard=/data-upgrade-card="(\d)" data-kind="stat"[\s\S]*?<span class="upgrade-card-name">([^<]+)<\/span>\s*<span class="upgrade-card-detail">\d+ → (\d+)<\/span>/.exec(nodes.get('upgrade-cards').innerHTML);
  assert.ok(statCard);
  const finalChoice=Number(statCard[1]);
  await pickUpgrade((finalChoice+1)%3);
  await pickUpgrade(finalChoice);
  const selectedCards=[...nodes.get('upgrade-cards').innerHTML.matchAll(/data-upgrade-card="(\d+)"[^>]+aria-pressed="true"/g)];
  assert.deepEqual(selectedCards.map(card=>Number(card[1])),[finalChoice]);
  assert.doesNotMatch(nodes.get('upgrade-cards').innerHTML,/\bdisabled\b/);
  await click('rest');
  assert.match(nodes.get('overlay').innerHTML,/<caption>League standings<\/caption>[\s\S]*Tavern[\s\S]*Explore[\s\S]*Shop/);
  await click('enter-tavern');
  const tavern=nodes.get('overlay').innerHTML;
  assert.match(tavern,/<h1>Tavern<\/h1>/);
  assert.match(tavern, /class="tavern-scene" aria-hidden="true"/);
  const offers=[...tavern.matchAll(/data-hire="([^"]+)"([^>]*)/g)];
  assert.equal(offers.length,4);
  assert.ok(offers.some(offer=>offer[1]==='keeper'));
  assert.doesNotMatch(tavern,/data-train=|data-action="rest"/);
  assert.equal((tavern.match(/class="tavern-portrait"/g)||[]).length,4);
  assert.equal((tavern.match(/<meter /g)||[]).length,20);
  assert.equal((tavern.match(/<details class="rating-panel"><summary>Player stats<\/summary>/g)||[]).length,4);
  assert.ok((tavern.match(/class="best-rating"/g)||[]).length>=3);
  assert.doesNotMatch(tavern,/DEFENDER|PLAYMAKER|STRIKER/);
  const practiceOffer=tavern.match(/data-preview="([^"]+)"/);
  assert.ok(practiceOffer);
  await clickData('preview',practiceOffer[1]);
  const recruitGuide=nodes.get('overlay').innerHTML;
  assert.match(recruitGuide,/data-action="start-ability-preview"/);
  assert.doesNotMatch(recruitGuide,/data-example=/);
  assert.ok(recruitGuide.includes(`Training as ${practiceOffer[1]}`));
  await click('ability-go-to-game');tick();
  assert.equal(activeMatch.practice,false);
  assert.equal(activeMatch.sim.teamB.members().length,5);
  assert.equal(activeMatch.player.name,practiceOffer[1]);
  const ability=activeMatch.powerFor(activeMatch.player);
  assert.ok(recruitGuide.includes(ability.name));
  assert.ok(recruitGuide.includes(`#${activeMatch.player.jersey}`));
  assert.ok(tavern.includes(ability.name));
  await click('ability-preview-guide');
  await click('back-ability-preview');
  assert.ok(nodes.get('overlay').innerHTML===tavern,'returning shows the tavern');
  const affordable=offers.find(offer=>!offer[2].includes('disabled'));
  assert.ok(affordable);
  await clickData('hire',affordable[1]);
  await click('continue');
  await kickOff();assertMatchStarted();
  assert.ok(activeMatch.sim.teamA.players.some(p=>p.name===affordable[1]));
  const upgradedStat={Speed:'speed','Dribbling Speed':'dribblingSpeed','Shot Speed':'shooting','Pass Speed':'passing',Tackling:'tackling',Stamina:'stamina','Ball Control':'dribbling','Shot Accuracy':'shotAccuracy','Pass Accuracy':'passAccuracy'}[statCard[2]];
  assert.equal(activeMatch.player.stats[upgradedStat],Number(statCard[3]));
  assert.match(nodes.get('hud').innerHTML,/LEAGUE FIXTURE · 2\/4/);
  assert.match(nodes.get('hud').innerHTML,/HORDE FC/);
  assert.match(nodes.get('hud').innerHTML,/id="clock">1:00/);
  fulltime(0,2);tick();
  for(let i=0;i<45&&nodes.get('overlay').hidden;i++)tick();
  assert.doesNotMatch(nodes.get('overlay').innerHTML,/gold-change/);
  assert.match(nodes.get('overlay').innerHTML,/Upgrade a player/);
  const options=nodes.get('upgrade-cards').innerHTML;
  assert.equal((options.match(/class="upgrade-card-emblem"><svg/g)||[]).length,3);
  assert.match(options,/<small>(Mage|Rogue|Warrior)<\/small>/);
  assert.doesNotMatch(options,/data-kind="(?:power|item)"/);
  for(const player of activeMatch.sim.teamA.players){
   assert.ok(options.includes(`${player.name} · #${player.jersey}`));
  }
  await pickUpgrade();
  assert.doesNotMatch(nodes.get('overlay').innerHTML,/data-action="next-upgrade"/);
  await click('rest');await click('market');
  const market=nodes.get('overlay').innerHTML;
  assert.match(market,/market-scene/);
  const perks=market.split('>Perks</h2>')[1].split('>Single-use items</h2>')[0];
  assert.equal((perks.match(/data-buy=/g)||[]).length,3);
  await click('continue');await kickOff();assertMatchStarted();
  assert.equal(activeMatch.sim.teamAbilities.length,0);
  assert.equal(activeMatch.staminaMultiplier,1);
  assert.doesNotMatch(nodes.get('hud').innerHTML,/HORDE FC/);
  fulltime(2,2);tick();
  for(let i=0;i<45&&nodes.get('overlay').hidden;i++)tick();
  assert.match(nodes.get('overlay').innerHTML,/Draw · 2 : 2 · \+1 point · 4 total/);
  assert.doesNotMatch(nodes.get('overlay').innerHTML,/gold-change/);
  await pickUpgrade();
  await click('rest');
  assert.match(nodes.get('overlay').innerHTML,/Boss fixture · MIX BAG FC/);
  await click('event');
  const event=nodes.get('overlay').innerHTML;
  assert.match(event,/Street Kick-Ups/);
  assert.match(event,/10 kick-ups · 100 gold[\s\S]*20 kick-ups · 200 gold[\s\S]*30 kick-ups · 300 gold/);
  await clickData('event-choice','0');
  assert.match(nodes.get('overlay').innerHTML,/id="kick-up-boot"/);
  await click('kick-up');
  tick(10);
  assert.ok(parseFloat(nodes.get('kick-up-boot').style.bottom)>0);
  assert.equal(nodes.get('kick-up-count').textContent,'1 / 10 kick-ups');
  const pressSpace=()=>listeners.get('document:keydown')({code:'Space',stopPropagation(){},preventDefault(){}});
  for(let count=1;count<10;count++){
   for(let i=0;i<220&&nodes.get('kick-up-cue').textContent!=='Kick now';i++)tick(10);
   assert.equal(nodes.get('kick-up-cue').textContent,'Kick now');
   pressSpace();
   for(let i=0;i<30&&nodes.get('kick-up-count').textContent!==`${count+1} / 10 kick-ups`;i++)tick(10);
  }
  for(let i=0;i<50&&nodes.get('overlay').innerHTML.includes('id="kick-up-field"');i++)tick(10);
  assert.match(nodes.get('overlay').innerHTML,/Target reached\. 10 \/ 10 kick-ups · \+100 gold/);
  await click('kick-up-continue');await kickOff();assertMatchStarted();
  fulltime(4,0);tick();
  for(let i=0;i<45&&nodes.get('overlay').hidden;i++)tick();
  await pickUpgrade();
  await click('league-results');
  assert.match(nodes.get('overlay').innerHTML,/<caption>Final standings<\/caption>/);
  assert.equal((nodes.get('overlay').innerHTML.match(/scope="row"/g)||[]).length,5);
  assert.match(nodes.get('overlay').innerHTML,/class="your-club"[^>]*>[\s\S]*?<th scope="row">Blue Hawks<\/th>/);
  await click('choose');assert.equal(nodes.get('hud').hidden,true);
 }
 assert.doesNotMatch(nodes.get('overlay').innerHTML,/cooldowns-off/);
 await click('matchup');
 assert.match(nodes.get('overlay').innerHTML,/Your players/);
 nodes.get('test-home').value='1';nodes.get('test-away').value='1';
 await click('test-play');
 assert.match(nodes.get('hud').innerHTML,/TEST MATCH/);
 assert.doesNotMatch(nodes.get('hud').innerHTML,/data-action="kickoff"/);
 await click('matchup');
 nodes.get('test-home').value='2';nodes.get('test-away').value='5';
 nodes.get('test-home-keeper').checked=true;nodes.get('test-away-keeper').checked=false;
 await click('test-play');await kickOff();tick();
 assert.match(nodes.get('hud').innerHTML,/TEST MATCH/);
 if(activeMatch){
  assert.equal(activeMatch.sim.teamA.players.length,2);
  assert.equal(activeMatch.sim.cooldownsOff,false);
  assert.equal(activeMatch.sim.teamB.players.length,5);
  assert.ok(activeMatch.sim.teamA.getGoalkeeper());
  assert.ok(activeMatch.sim.teamB.getGoalkeeper()===null,'custom away side has no keeper');
  assert.match(nodes.get('match-items-bar').innerHTML,/No items/);
  assert.match(nodes.get('hud').innerHTML,/id="item-dock".*aria-label="Single-use items"/);
  const {SoundDB}=require('../kernel/core/lib/sounddb.js');
  const playSound=SoundDB.play;
  const cues=[];
  SoundDB.play=(name,options)=>{cues.push({name,options});};
  try{
   activeMatch.secondsLeft=10.01;tick();tick();
   assert.equal(nodes.get('clock').textContent,'0:10');
   assert.equal(nodes.get('clock').dataset.countdown,'ready');
   activeMatch.secondsLeft=1.01;tick();tick();
   assert.equal(nodes.get('clock').textContent,'0:01');
   assert.equal(nodes.get('clock').dataset.countdown,'final');
   activeMatch.secondsLeft=.05;tick();
  }finally{SoundDB.play=playSound;}
  const countdownCues=cues.filter(cue=>cue.name==='clock_tick'||cue.name==='whistle_long');
  assert.deepEqual(countdownCues.map(cue=>cue.name),['clock_tick','clock_tick','whistle_long']);
  assert.ok(countdownCues[1].options.volume>countdownCues[0].options.volume);
  assert.equal(nodes.get('clock').dataset.countdown,'');
  assert.match(nodes.get('clock').textContent,/EXTRA TIME · 0:30/);
  assert.equal(nodes.get('announcement').textContent,'Extra time');
  activeMatch.secondsLeft=.05;
  tick();
  assert.equal(nodes.get('announcement').textContent,'Draw');
  assert.ok(activeMatch.finished);
  assert.equal(activeMatch.winner,null);
  assert.equal(nodes.get('clock').textContent,'FULL TIME');
  for(let i=0;i<45&&nodes.get('overlay').hidden;i++)tick();
  assert.match(nodes.get('overlay').innerHTML,/<h1>Draw<\/h1>.*0 : 0/);
  assert.equal(nodes.get('message').textContent,'');
  await click('retry');await kickOff();
  assert.match(nodes.get('hud').innerHTML,/TEST MATCH/);
 }
 await click('choose');
 await click('matchup');
 nodes.get('test-encounter').value='orcs';
 await click('test-play');await kickOff();tick();
 assert.match(nodes.get('hud').innerHTML,/HORDE FC.*id="clock">1:00/);
 if(activeMatch){
  assert.equal(activeMatch.sim.teamB.players.length,4);
  assert.equal(activeMatch.sim.teamB.getGoalkeeper().name,'ORC KEEPER');
 }
 await click('choose');
 await click('matchup');
 assert.match(nodes.get('overlay').innerHTML,/value="frost"/);
 nodes.get('test-encounter').value='frost';
 await click('test-play');await kickOff();tick();
 assert.match(nodes.get('hud').innerHTML,/FROST GIANTS/);
 for(let i=0;i<30;i++)tick();
 assert.equal(nodes.get('message').textContent,'');
 if(activeMatch)assert.ok(activeMatch.sim.iceTrails.length>0);
 await click('choose');await click('matchup');
 assert.match(nodes.get('overlay').innerHTML,/value="shifters"/);
 nodes.get('test-encounter').value='shifters';
 await click('test-play');await kickOff();tick();
 assert.match(nodes.get('hud').innerHTML,/SHAPESHIFTERS/);
 if(activeMatch)assert.equal(activeMatch.sim.teamB.players.length,3);
 await click('choose');
 await click('practice');
 assert.equal((nodes.get('overlay').innerHTML.match(/data-practice-player=/g)||[]).length,18);
 assert.match(nodes.get('overlay').innerHTML,/Team Abilities[\s\S]*Cross into Power Shot[\s\S]*Cross into Header[\s\S]*Cross into Overhead Kick/);
 const allDrills=[...nodes.get('overlay').innerHTML.matchAll(/data-practice-player="([^"]+)"/g)];
 for(const [,drill] of allDrills){
  await clickData('practice-player',drill);
  const guide=nodes.get('overlay').innerHTML;
  assert.doesNotMatch(guide,/data-example=|data-actor=/);
  assert.match(guide,/>Play preview match<[\s\S]*>Practice drill</);
  await click('ability-list');
 }
 await clickData('practice-player','cross-header');
 await click('ability-go-to-game');
 assert.match(nodes.get('hud').innerHTML,/ABILITY PREVIEW/);
 if(activeMatch){
  assert.equal(activeMatch.practice,false);
  assert.equal(activeMatch.sim.practiceTeamMove,undefined);
  assert.deepEqual(activeMatch.sim.teamAbilities,['header']);
 }
 await click('ability-preview-guide');
 await click('ability-list');
 await click('choose');
 await click('practice');
 for(const [drill,label] of [['bear','Bear Form'],['wolf','Wolf Form'],['eagle','Eagle Form']]){
  await clickData('practice-player',drill);await click('start-ability-preview');tick();
  assert.equal(nodes.get('power-name').textContent,label);
  const event={code:'Space',target:nodes.get('pitch'),preventDefault(){}};
  listeners.get('window:keydown')(event);tick();
  listeners.get('window:keyup')(event);
  assert.match(nodes.get('power-timer').textContent,/3s ACTIVE/);
  assert.equal(nodes.get('message').textContent,'');
  if(activeMatch)assert.equal(activeMatch.player.beastForm,drill);
  await click('practice-menu');
 }
 if(activeMatch){
  for(const [drill,label,key] of [['power-shot','Power Shot!','KeyE'],['cross-header','Header!','KeyE'],['overhead-kick','Overhead Kick!','KeyT']]){
   await clickData('practice-player',drill);await click('start-ability-preview');tick();
   const {sim}=activeMatch;
   const players=sim.teamA.getOutfieldPlayers();
   for(const player of players)player.stats.passAccuracy=player.stats.shotAccuracy=100;
   assert.equal(players.length,2);
   assert.equal(sim.ball.owner===activeMatch.player,true);
   assert.equal(nodes.get('team-drill-reset').hidden,false);
   if(drill==='cross-header')assert.ok(players.some(p=>p.characterId!=='price'));
   const blocker=sim.teamB.getOutfieldPlayers()[0],blockerY=blocker?.y;
   const keyDown=code=>listeners.get('window:keydown')({code,target:nodes.get('pitch'),preventDefault(){}});
   const keyUp=code=>listeners.get('window:keyup')({code,target:nodes.get('pitch'),preventDefault(){}});
   keyDown(key);tick();keyUp(key);
   assert.ok(sim.teamCross);
   if(drill==='overhead-kick'){
    const receiver=sim.teamCross.receiver;
    receiver.orientation=2;
    keyDown(key);tick();keyUp(key);
    assert.match(nodes.get('call-feedback').textContent,/Face away from goal/);
    keyDown('KeyA');tick();keyUp('KeyA');
    assert.equal(receiver.orientation,6);
   }
   for(let i=0;i<25&&nodes.get('cross-finish').dataset.ready!=='true';i++)tick();
   assert.equal(nodes.get('cross-finish').dataset.ready,'true');
   keyDown(key);tick();keyUp(key);
   assert.equal(nodes.get('call-feedback').textContent,label);
   if(blocker){
    for(let i=0;i<5&&blocker.y===blockerY;i++)tick();
    assert.ok(Math.abs(blocker.y-blockerY)>2,'the drill defender is knocked aside');
   }
   await click('reset-team-drill');tick();
   assert.equal(sim.ball.owner===activeMatch.player,true);
   assert.ok(sim.teamCross===null,'reset clears the cross');
   await click('practice-menu');
  }
 }
 assert.match(nodes.get('overlay').innerHTML,/Warrior.*Rogue.*Mage/);
 await clickData('practice-player','mendes');await click('start-ability-preview');
 const event={code:'Space',target:nodes.get('pitch'),preventDefault(){}};
 const collect=()=>{
  const movement={...event,code:'KeyD'};
  listeners.get('window:keydown')(movement);
  for(let i=0;i<10;i++)tick();
  listeners.get('window:keyup')(movement);
  tick();
 };
 collect();
 assert.equal(nodes.get('player-power').dataset.ability,'arc');
 assert.equal(nodes.get('player-power').dataset.state,'ready');
 assert.match(nodes.get('power-timer').textContent,/READY/);
 listeners.get('window:keydown')(event);tick();
 listeners.get('window:keyup')(event);
 assert.equal(nodes.get('power-timer').textContent,'ARMED');
 const pointer={button:0,clientX:900,clientY:400,target:nodes.get('pitch'),preventDefault(){}};
 listeners.get('pitch:mousedown')(pointer);tick();
 assert.match(nodes.get('power-text').textContent,/BEND/);
 assert.equal(nodes.get('player-power').dataset.state,'charging');
 assert.equal(nodes.get('power-label').dataset.ability,'arc');
 listeners.get('window:mouseup')(pointer);tick();
 assert.equal(nodes.get('player-power').dataset.state,'cooldown');
 assert.equal(nodes.get('call-feedback').textContent,'Swerve Pass');
 assert.equal(nodes.get('message').textContent,'','Swerve effect renders without pausing the match');
 await click('practice-menu');await clickData('practice-player','tele-pass');await click('start-ability-preview');tick();collect();
 assert.match(nodes.get('practice-tip').textContent,/Press Space.*left click/);
 const alt=event;
 listeners.get('window:keydown')(alt);tick();listeners.get('window:keyup')(alt);
 assert.equal(nodes.get('power-timer').textContent,'ARMED');
 const pass={...event,code:'KeyJ'};
 listeners.get('window:keydown')(pass);tick();listeners.get('window:keyup')(pass);
 assert.equal(nodes.get('call-feedback').textContent,'Tele-Pass');
 for(let i=0;i<8;i++)tick();
 assert.equal(nodes.get('message').textContent,'','Tele-Pass renders through arrival');
 await clickData('practice-level','2');tick();
 assert.match(nodes.get('practice-tip').textContent,/click two spots/);
 assert.match(nodes.get('power-help').textContent,/teleports to meet the ball.*click two spots/);
 assert.equal(nodes.get('power-level').hidden,false);
 await clickData('practice-level','1');tick();
 assert.equal(nodes.get('power-level').hidden,true);
 await click('practice-menu');await clickData('practice-player','portal-pass');await click('start-ability-preview');tick();collect();
 assert.match(nodes.get('practice-tip').textContent,/opposite side/);
 listeners.get('window:keydown')(alt);tick();listeners.get('window:keyup')(alt);
 assert.equal(nodes.get('power-timer').textContent,'ARMED');
 assert.equal(nodes.get('message').textContent,'');
 await click('practice-menu');await clickData('practice-player','goal-warp');await click('start-ability-preview');tick();
 assert.match(nodes.get('practice-tip').textContent,/five seconds/);
 assert.match(nodes.get('hud').innerHTML,/id="scoreboard" class="scoreboard" hidden/);
 await clickData('practice-level','2');tick();
 const warpAim={...pointer,clientX:1170,clientY:175};
 listeners.get('pitch:pointermove')(warpAim);
 listeners.get('window:keydown')(event);tick();listeners.get('window:keyup')(event);
 assert.match(nodes.get('power-timer').textContent,/ACTIVE/);
 assert.equal(nodes.get('message').textContent,'');
 await click('practice-menu');
 assert.doesNotMatch(nodes.get('overlay').innerHTML,/Smoke Bomb/);
 await clickData('practice-player','cole');await click('start-ability-preview');tick();
 assert.equal(nodes.get('power-name').textContent,'Shadow Step');
 listeners.get('window:keydown')(alt);tick();listeners.get('window:keyup')(alt);tick();
 assert.equal(nodes.get('call-feedback').textContent,'Shadow Step');
 assert.match(nodes.get('power-timer').textContent,/^\d+s$/);
 assert.match(nodes.get('power-help').textContent,/Hold a direction and press Space to dash/);
 const cooldownCheckbox=nodes.get('cooldowns-off');
 cooldownCheckbox.focus();
 cooldownCheckbox.checked=true;
 listeners.get('document:change')({target:cooldownCheckbox});
 assert.equal(focusedNode,nodes.get('pitch'),'changing cooldowns returns keyboard focus to the pitch');
 tick();
 assert.equal(nodes.get('power-timer').textContent,'READY · SPACE');
 if(activeMatch)assert.equal(activeMatch.sim.cooldownsOff,true);
 await click('practice-menu');await clickData('practice-player','blaze-slide');await click('start-ability-preview');tick();
 assert.equal(nodes.get('power-name').textContent,'Blazing Slide');
 listeners.get('window:keydown')(alt);tick();listeners.get('window:keyup')(alt);tick();
 assert.equal(nodes.get('call-feedback').textContent,'Blazing Slide');
 await click('practice-menu');await clickData('practice-player','blast-shot');await click('start-ability-preview');tick();
 assert.equal(nodes.get('power-name').textContent,'Orc Blast Shot');
 assert.equal(nodes.get('team-drill-reset').hidden,false);
 listeners.get('window:keydown')(alt);tick();listeners.get('window:keyup')(alt);tick();
 assert.equal(nodes.get('power-timer').textContent,'PASSIVE');
 assert.match(nodes.get('practice-tip').textContent,/three seconds/);
 await click('practice-menu');await clickData('practice-player','spin-kick');await click('start-ability-preview');tick();
 assert.match(nodes.get('practice-tip').textContent,/toe-punt a carried or loose ball/);
 assert.equal(nodes.get('power-name').textContent,'Spin');
 listeners.get('window:keydown')(alt);tick();listeners.get('window:keyup')(alt);
 assert.equal(nodes.get('call-feedback').textContent,'Spin');
 assert.equal(nodes.get('message').textContent,'','Spin renders without pausing the match');
 await click('practice-menu');await clickData('practice-player','nutmeg');await click('start-ability-preview');tick();
 assert.equal(nodes.get('power-name').textContent,'Nutmeg');
 assert.equal(nodes.get('player-power').dataset.state,'active');
 assert.equal(nodes.get('power-timer').textContent,'PASSIVE');
 assert.match(nodes.get('practice-tip').textContent,/50% chance.*3 seconds/);
 if(activeMatch)assert.equal(activeMatch.sim.teamB.getOutfieldPlayers().length,1);
 await clickData('practice-level','2');tick();
 assert.match(nodes.get('practice-tip').textContent,/up to two defenders/i);
 if(activeMatch)assert.equal(activeMatch.sim.teamB.getOutfieldPlayers().length,2);
 await click('practice-menu');await clickData('practice-player','clone');await click('start-ability-preview');tick();
 assert.equal(nodes.get('power-name').textContent,'Clone');
 if(activeMatch)assert.equal(activeMatch.player.characterId,'mendes');
 await clickData('practice-level','2');tick();
 listeners.get('window:keydown')(alt);tick();listeners.get('window:keyup')(alt);
 assert.equal(nodes.get('call-feedback').textContent,'Clone');
 assert.equal(nodes.get('message').textContent,'');
 if(activeMatch)assert.equal(activeMatch.sim.clones.length,1);
 await click('choose');await click('club-gear');
 assert.ok((nodes.get('overlay').innerHTML.match(/data-showcase=/g)||[]).length>=10);
 assert.doesNotMatch(nodes.get('overlay').innerHTML,/keeper-watch/);
 await clickData('showcase','crossbar');tick();
 assert.doesNotMatch(nodes.get('hud').innerHTML,/Set up a crossbar hit/);
 if(activeMatch){
  const {Utils}=require('../kernel/core/lib/utils.js');
  const goal=activeMatch.sim.getGoals().right;
  activeMatch.player.stats.shotAccuracy=100;
  const point=Utils.toScreen(goal.lineX,goal.center.y);
  const shot={button:2,clientX:point.x,clientY:point.y,target:nodes.get('pitch'),preventDefault(){}};
  assert.equal(nodes.get('showcase-result').textContent,'Bonus gold · 0');
  listeners.get('pitch:mousedown')(shot);
  for(let i=0;i<10;i++)tick(50);
  listeners.get('window:mouseup')(shot);
  for(let i=0;i<25&&activeMatch.club.gold===0;i++)tick();
  assert.equal(nodes.get('showcase-result').textContent,'Bonus gold · 100');
 }

 await click('back-catalog');
 assert.match(nodes.get('overlay').innerHTML,/Perks/);
 await click('choose');await click('match-items');
 await clickData('showcase','water');tick();
 if(activeMatch){
  assert.equal(activeMatch.sim.teamA.players.filter(p=>!p.isSentOff).length,5);
  assert.equal(activeMatch.sim.teamB.players.filter(p=>!p.isSentOff).length,5);
 }
 assert.match(nodes.get('match-items-bar').innerHTML,/data-item="water"/);
 await clickData('item','water');tick();
 assert.equal(nodes.get('call-feedback').textContent,'Sports Mead');
 assert.doesNotMatch(nodes.get('match-items-bar').innerHTML,/data-item="water"/);
 await click('back-catalog');
 await clickData('showcase','slimer-streaker');tick();
 await clickData('item','slimer-streaker');tick();
 assert.equal(nodes.get('call-feedback').textContent,'Slimer Streaker');
 assert.doesNotMatch(nodes.get('match-items-bar').innerHTML,/data-item="slimer-streaker"/);
 if(activeMatch)assert.ok(activeMatch.sim.slimerStreaker);
 assert.equal(nodes.get('message').textContent,'');
 if(activeMatch){
  await click('back-catalog');await clickData('showcase','overtime');tick();
  const startingClock=activeMatch.secondsLeft;
  await clickData('item','overtime');
  assert.equal(activeMatch.secondsLeft,startingClock+10);
  tick();
  assert.ok(activeMatch.secondsLeft<startingClock+10,'the showcase clock keeps running');
  await click('back-catalog');await clickData('showcase','tonic');tick();
  const boosted=activeMatch.player,originalSpeed=boosted.movementScale??1;
  await clickData('item','tonic');
  assert.equal(boosted.movementScale,originalSpeed*1.35);
  activeMatch.step(170);
  assert.ok(Math.abs(boosted.movementScale-originalSpeed)<1e-9);
  await click('back-catalog');await clickData('showcase','whistle');tick();
  const player=activeMatch.player;
  await clickData('item','whistle');
  assert.equal(activeMatch.club.items.whistle,1,'the elixir can only recharge an ability on cooldown');
  const powerInput={code:'Space',target:nodes.get('pitch'),preventDefault(){}};
  listeners.get('window:keydown')(powerInput);tick();listeners.get('window:keyup')(powerInput);
  assert.ok(player.powerReadyAt>require('../kernel/core/lib/time.js').Time.time);
  await clickData('item','whistle');
  assert.equal(activeMatch.club.items.whistle,0);
  await click('back-catalog');await clickData('showcase','red-card');tick();
  const {Utils}=require('../kernel/core/lib/utils.js');
  const target=activeMatch.sim.teamB.players[0],point=Utils.toScreen(target.x,target.y);
  await clickData('item','red-card');
  listeners.get('pitch:mousedown')({button:0,clientX:point.x,clientY:point.y,target:nodes.get('pitch'),preventDefault(){}});
  assert.equal(target.isSentOff,true);
  assert.equal(activeMatch.club.items['red-card'],0);

  await click('choose');
  const now=Date.now;
  Date.now=()=>0;
  try{
   await click('new-run');
   await click('play');
  }finally{Date.now=now;}
  await kickOff();assertMatchStarted();
  fulltime(2,0);tick();
  for(let i=0;i<45&&nodes.get('overlay').hidden;i++)tick();
  await pickUpgrade();
  await click('rest');await click('event');
  assert.match(nodes.get('overlay').innerHTML,/Street 1v1[\s\S]*Choose your player/);
  await clickData('street-player','0');tick();
  assert.equal(activeMatch.sim.ball.maxX,34);
  assert.equal(nodes.get('hud').dataset.street,'duel');
  assert.doesNotMatch(nodes.get('hud').innerHTML,/data-action="kickoff"/);
  assert.match(nodes.get('announcement').textContent,/Check pass/);
  assert.equal(nodes.get('message').textContent,'');
  const beaten=activeMatch.streetChallenge.rival;
  activeMatch.sim.scoreA=2;
  activeMatch.streetChallenge.done=true;
  tick();
  const duelResult=nodes.get('overlay').innerHTML;
  assert.match(duelResult,/You’re pretty good\.\.\. you looking for any new players\?/);
  assert.match(duelResult,/Take 250 gold/);
  assert.ok(duelResult.includes(`Recruit ${beaten.name}`));
  await click('duel-recruit');
  await kickOff();assertMatchStarted();
  const signed=activeMatch.sim.teamA.players.find(player=>player.name===beaten.name);
  assert.ok(signed);
  assert.equal(signed.recruitPower,beaten.recruitPower);
  assert.equal(signed.stats.speed,beaten.stats.speed);
 }
 console.info('5v5 selection, pitch rendering, pause, resume and cup interface tests passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
