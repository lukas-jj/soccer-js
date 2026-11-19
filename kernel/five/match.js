const {updateHazards,moveHazardPlayer}=require('./hazards.js');
const {Utils}=require('../core/lib/utils.js');
const {tickManualControl,clearManualCharge,applyHumanCommand,isBusyKicking,humanFacingDir}=require('../core/lib/manual_control.js');
const {Simulator,MatchStates}=require('../providers/simulator/simulator.js');
const {Settings}=require('../settings.js');
const {Time}=require('../core/lib/time.js');
const {SoundDB}=require('../core/lib/sounddb.js');
const {getArchetypeFullValues}=require('../core/lib/ai_archetypes.js');
const {FiveInput}=require('./input.js');
const {PlayerStates,attemptTackle,isGkProtected,tryClaimLooseBall}=require('../core/entities/player.js');
const {estimatePassGroundSpeed,isPassSafeFromAllOpponents}=require('../core/lib/pass_safety.js');
const {characterPower,usePower,tickArcPass,tickSpacePower,updateTelePass,clearGoalWarp,clearBargeCharge,updateBargeCharge,SPIN_RADIUS}=require('./powers.js');
const {GOAL_TARGET}=require('./cup.js');
const {updateSlimers,updateSlimerSlows}=require('./slimers.js');
const {updateOrcBrothers}=require('./orc_brothers.js');
const {CHARACTERS}=require('./characters.js');
const FORMATION=[{role:'GK',x:6,y:50},{role:'CB',x:25,y:50},{role:'LM',x:43,y:24},{role:'RM',x:43,y:76},{role:'CF',x:65,y:50}];
const BASE={speed:77,stamina:86,passing:78,dribbling:77,shooting:78,tackling:75,goalkeeping:15,accuracy:81};
function smallFormation(count,keeper){
 const outfield=count-Number(keeper);
 const roles=['CF','CB','LM','RM','CM'];
 const shapes={
  1:[[44,50]],
  2:[[56,34],[29,66]],
  3:[[60,50],[27,50],[45,24]],
  4:[[64,50],[26,50],[45,24],[45,76]],
  5:[[64,50],[26,50],[44,24],[44,76],[44,50]]
 };
 const slots=shapes[outfield].map(([x,y],i)=>({x,y,role:roles[i]}));
 return keeper?[FORMATION[0],...slots]:slots;
}
function buildMatchRoster(character,options){
 if(!options.roster&&!options.matchup)return null;
 const {matchup,opponent}=options;
 const homeKeeper=!!matchup?.homeKeeper&&matchup.home>1;
 const homeCount=matchup?.home??options.roster.length;
 const ids=options.roster||[character.id,...CHARACTERS.map(c=>c.id).filter(id=>id!==character.id)];
 const home=[...(homeKeeper?[null]:[]),...Array.from({length:homeCount-Number(homeKeeper)},(_,i)=>ids[i]||'reserve')];
 const awayCount=matchup?.away??opponent.count;
 const awayKeeper=(matchup?.awayKeeper??opponent?.keeper??false)&&awayCount>1;
 return {home,homeKeeper,awayCount,awayKeeper};
}
function configureFive(headless=false,playerSpeed=1){
 Settings.HEADLESS=headless;Settings.soundsMuted=true;Settings.TIME_SPEED=1;Settings.SPRITE_SPEED=playerSpeed;
 Settings.BASE_FIELD_WIDTH=52;Settings.BASE_FIELD_HEIGHT=34;Settings.FIELD_SIZE_MULTIPLIER=1;
 Settings.weather='fine';Settings.projectionMode='orthographic';
 Settings.manualControl={...Settings.manualControl,teamA:true,teamB:false,autoSwitchOnPass:false,holdToPower:true,cameraFollow:false,screenAwareMove:true,aimAssist:true,shotAimAssist:true,recordInput:false};
 Settings.AI.A=Object.assign(Object.create(Settings.AI),getArchetypeFullValues('balanced'),{ALLOW_SLIDE_TACKLES:false});
 Settings.AI.B=Object.assign(Object.create(Settings.AI),getArchetypeFullValues('balanced'),{ALLOW_SLIDE_TACKLES:false});
 Settings.batchConfig=null;
 Time.time=0;Time.timeSinceLevelLoad=0;Time.deltaTime=.05;
}
class FiveSimulator extends Simulator {
 constructor(seed,duration,opponent,roster,upgrades){
  super({seed});this.playersPerTeam=5;this.fiveDuration=duration;this.goalTarget=duration==null?(opponent?.goalTarget??GOAL_TARGET):null;this.opponent=opponent;
  this.roster=roster;this.runUpgrades=upgrades;this.allowCorners=false;this.allowManualSlides=false;
  this.goalCelebrationSeconds=1.5;this.winningGoalCelebrationSeconds=.85;
  if(roster)this.teamPlayerCounts={A:roster.home.length,B:roster.awayCount};
 }
 readConfig(){this.teamAName='HOME';this.teamBName=this.opponent?.name||'AWAY';this.formationAName=this.roster?'home':'five';this.formationBName=this.roster?'away':'five';this.matchDuration=this.fiveDuration||180;}
 restoreMatchAIStrategySettings(){}
 processTeamDynamicStrategy(team,isLateGame){
  if(team==='B'&&this.opponent)return;
  super.processTeamDynamicStrategy(team,isLateGame);
 }
 async ensureActiveTeamSprites(){}
 async loadPresets(){
  this.defaultStats=BASE;this.formationsPreset={five:FORMATION};
  if(this.roster){
   const {home,homeKeeper,awayCount,awayKeeper}=this.roster;
   this.formationsPreset.home=smallFormation(home.length,homeKeeper);
   this.formationsPreset.away=smallFormation(awayCount,awayKeeper);
  }
  const keeper={...BASE,jersey:1,goalkeeping:90,traits:[]};
  if(this.opponent){
   const ease=-this.opponent.bonus;
   Object.assign(Settings.AI.B,{
    SHOOT_RANGE_REF:this.opponent.allowSlides===false?14:Settings.AI.SHOOT_RANGE_REF,
    DEFENSIVE_PRESS_INTENSITY:Math.max(.05,.45-ease*.018),
    COUNTERPRESS_DURATION:Math.max(1,4-ease*.2),
    COUNTERPRESS_MAX_SURGE:this.opponent.pressers||1,
    FOOT_TACKLE_SUCCESS_BASE:Math.max(.13,.58-ease*.009),
    ALLOW_SLIDE_TACKLES:false
   });
   if(this.opponent.style==='block'){
    Object.assign(Settings.AI.B,{FORMATION_HOLD:.79,DEFENSIVE_COMPRESS_BLEND:.58});
   }else if(this.opponent.style==='press'){
    Object.assign(Settings.AI.B,{DEFENSIVE_PRESS_INTENSITY:this.opponent.boss?.66:.43,
     COUNTERPRESS_DURATION:3.5,COUNTERPRESS_MAX_SURGE:this.opponent.boss?3:2});
   }else if(this.opponent.style==='shoot'){
    Settings.AI.B.SHOOT_RANGE_REF=this.opponent.boss?55:46;
   }
  }
  const rivalStats=(i,isKeeper)=>{
   const bonus=this.opponent?.bonus||0,variation=this.opponent?.variance?.[i]||{};
   const profile=(this.opponent?.lineup?.[i]??this.opponent)?.stats??{};
   const cap=value=>Math.max(10,Math.min(99,value));
   const stats=Object.fromEntries(Object.entries(BASE).map(([key,value])=>[key,cap(value+bonus+(profile[key]||0)+(variation[key]||0))]));
   return {...stats,jersey:this.opponent?.orcBrothers&&!this.opponent.lineup&&!isKeeper?i+3:i+1,goalkeeping:isKeeper?cap(88+bonus+(profile.goalkeeping||0)):15,traits:[]};
  };
  const roster=this.roster;
  const homeIds=roster?.home||[null,...CHARACTERS.map(c=>c.id)];
  const homeStats=homeIds.map((id,i)=>{
   if(!id)return keeper;
   const c=typeof id==='object'?id:CHARACTERS.find(c=>c.id===id)||{stats:BASE,number:10};
   const finishing=this.runUpgrades?.has('finish')?10:0;
   return {...c.stats,shooting:Math.min(100,c.stats.shooting+finishing),
    accuracy:Math.min(100,c.stats.accuracy+finishing),jersey:typeof id==='object'?(id.number??11+i):homeIds.indexOf(id)===i?c.number:10,traits:[]};
  });
  this.teamStatsPreset={HOME:homeStats,[this.teamBName]:Array.from({length:roster?.awayCount??5},
   (_,i)=>rivalStats(i,i===0&&(roster?.awayKeeper??true)))};

 }
 updateShapeshifters(){
  if(!this.opponent?.shapeshifters||this.matchState!=='play'||this.setPieceType)return;
  this.shapeshifterTime=(this.shapeshifterTime??0)+Time.deltaTime;
  const disguised=Math.floor((this.shapeshifterTime+1e-8)/5)%2===1;
  if(disguised===this.shapeshifted)return;
  this.shapeshifted=disguised;
  const sources=this.teamA.players.filter(p=>!p.isSentOff);
  this.teamB.players.forEach((player,index)=>{
   if(!player.isShapeshifter)return;
   const source=disguised&&sources[index%sources.length];
   if(source){
    player.shapeshifterBase={name:player.name,stats:player.stats,movementScale:player.movementScale};
    player.mimicPlayer=source;
    player.name=source.name;
    const copied=Object.fromEntries(Object.keys(BASE).map(stat=>[stat,Math.min(100,(source.stats[stat]??BASE[stat])+4)]));
    player.stats={...player.stats,...copied};
    player.movementScale=1.08*(source.movementScale??1);
   }else if(player.shapeshifterBase){
    Object.assign(player,player.shapeshifterBase);
    player.shapeshifterBase=null;player.mimicPlayer=null;
   }
  });
 }
 shouldPreserveAIState(player){
  if(player.team==='B'&&this.matchState==='play'&&!this.setPieceType&&this.ball?.owner?.team==='A'
    &&player.role!=='GK'&&player.actionTimer<=0&&!(player.kickTimer>0)){
   const state=player.fsm.getNameOfCurrentState();
   if(['Receive','SupportAttacker','GoHome','ReturnHome'].includes(state))return false;
  }
  return super.shouldPreserveAIState(player);
 }
 getActiveChasers(){
  const chasers=super.getActiveChasers();
  const carrier=this.ball.owner;
  if(this.matchState!=='play'||this.setPieceType||carrier?.team!=='A'){
   this.pressLeader=null;
   return chasers;
  }
  for(const player of chasers)if(player.team==='B')chasers.delete(player);
  const candidates=this.teamB.getOutfieldPlayers()
   .filter(p=>this.canBecomeChaser(p)&&!p.bargeWindup&&!p.slimeWindup&&!p.smokeBlind&&!(p.burningUntil>Time.time))
   .map(player=>({player,distance:Math.hypot(player.x-carrier.x,player.y-carrier.y)}))
   .sort((a,b)=>a.distance-b.distance);
  const nearest=candidates[0];
  const previous=candidates.find(entry=>entry.player===this.pressLeader);
  const leader=previous&&previous.distance<=nearest.distance+1.4?previous:nearest;
  this.pressLeader=leader?.player??null;
  if(!leader)return chasers;
  chasers.add(leader.player);
  const profile=this.opponent;
  const max=profile?.shapeshifters&&!profile.lineup?(this.shapeshifted?2:1)
   :profile?.pressers??(profile?.style==='press'||profile?.boss?2:1);
  const second=candidates.find(entry=>entry!==leader);
  if(max>=2&&second&&second.distance<=(profile?.secondPressRange??10))chasers.add(second.player);
  return chasers;
 }
 requestHumanPass(){
  const receiver=this.lockedHumanPlayer;
  const carrier=this.ball.owner;
  if(this.matchState!=='play'||this.setPieceType!==''||!receiver||receiver.isSentOff)return;
  if(this._humanCallUntil>Time.time||this._nextHumanCall>Time.time)return;
  this._nextHumanCall=Time.time+1;
  if(carrier===receiver){this.callFeedback('ON THE BALL');return;}
  if(this.passComingToHuman(carrier)){this.callFeedback('PASS COMING');return;}
  this._humanCallUntil=Time.time+3;
  this.callFeedback('CALLING');
  SoundDB.play('call_pass');
 }
 passComingToHuman(carrier){
  const receiver=this.lockedHumanPlayer;
  return (!carrier&&this.teamA.receivingPlayer===receiver)
   || (carrier?.passTarget===receiver&&carrier.fsm.getNameOfCurrentState()==='Pass');
 }
 callFeedback(text){
  this.humanCallFeedback={text,until:this._humanCallUntil||Time.time+1.8};
 }
 humanOutlet(carrier,requested=false){
  const receiver=this.lockedHumanPlayer;
  if(!receiver||receiver.isSentOff||!carrier||carrier===receiver||carrier.team!=='A')return null;
  const distance=Math.hypot(receiver.x-carrier.x,receiver.y-carrier.y);
  if(distance<2){if(requested)this.callFeedback('MAKE SPACE');return null;}
  if(distance>32){if(requested)this.callFeedback('MOVE CLOSER');return null;}
  // Prefer feet: the user controls their own run, not an AI support destination.
  const from={x:carrier.x,y:carrier.y},aim={x:receiver.x,y:receiver.y};
  const passType=distance>18?'long':'short';
  const speed=estimatePassGroundSpeed(from,aim,carrier,passType);
  if(!isPassSafeFromAllOpponents(from,aim,receiver,this.teamA.getOpponentPool(),speed)){
   if(requested)this.callFeedback('GET OPEN');return null;
  }
  return {teammate:receiver,type:passType,aim};
 }
 updatePlayerAIStates(){
  const carrier=this.ball.owner,receiver=this.lockedHumanPlayer;
  if(carrier!==this._humanCarrier){this._humanCarrier=carrier;this._humanCarrierSince=Time.time;}
  const inPlay=this.matchState==='play'&&this.setPieceType===''&&receiver&&!receiver.isSentOff;
  if(this._humanCallUntil&&(!inPlay||this._humanCallUntil<=Time.time)){
   this._humanCallUntil=0;
   if(inPlay)this.callFeedback('CALL EXPIRED');
   else this.humanCallFeedback=null;
  }
  const requested=this._humanCallUntil>Time.time;
  if(inPlay){
   if(requested&&this.passComingToHuman(carrier)){
    this._humanCallUntil=0;this.callFeedback('PASS COMING');
   }
   else if(carrier&&carrier.team==='A'&&carrier!==receiver){
    const state=carrier.fsm.getNameOfCurrentState();
    const busy=['Pass','Shoot','Header'].includes(state)||carrier.actionTimer>0||(carrier.role==='GK'&&isGkProtected(carrier));
    const natural=!requested&&Time.time-this._humanCarrierSince>=.45&&Time.time>=(this._nextHumanOutlet||0)&&!(carrier.lastPassFrom===receiver&&carrier.passLinkCooldown>0);
    if(!busy&&(requested||natural)){
     const decision=this.humanOutlet(carrier,requested);
     if(decision){
      carrier.passTarget=receiver;carrier.passType=decision.type;carrier.passAim=decision.aim;
      carrier.fsm.changeState(PlayerStates.Pass);
      this._humanCallUntil=0;this._nextHumanOutlet=Time.time+1.2;
      if(requested)this.callFeedback('PASS COMING');
     }
    }
   }else if(requested&&carrier===receiver){this._humanCallUntil=0;this.callFeedback('ON THE BALL');}
   else if(requested)this.callFeedback(carrier?'WIN POSSESSION':'WAITING FOR POSSESSION');
  }
  super.updatePlayerAIStates();
 }
 handleManualRestart(type){
  const taker=this.ball.owner;
  if(!this.manualDefensiveSwitch||Settings.HEADLESS||taker?.team!=='A'||(taker.role==='GK'&&type!=='goalkick'))return false;
  if(!['freekick','goalkick','throwin','corner','penalty'].includes(type))return false;
  if(this.manualRestartTaker!==taker){
   this.manualRestartTaker=taker;
   this.restartPreviousPlayer=this._manualControlled.A;
   clearManualCharge(this);
   taker.actionTimer=0;taker.isSliding=false;
  }
  this._manualControlled.A=taker;
  const {command}=this.manualInput.pollFrame();
  const aim=humanFacingDir(taker,command,this._manualCharge);
  if(type==='goalkick'||type==='throwin'||type==='corner'){
   command.lob||=command.shoot;
   command.lobDown||=command.shootDown;
   command.lobReleased||=command.shootReleased;
   command.shoot=command.shootDown=command.shootReleased=false;
  }else if(type==='penalty'){
   command.pass=command.passDown=command.passReleased=false;
   command.lob=command.lobDown=command.lobReleased=false;
  }
  const receiver=applyHumanCommand(taker,{...command,aimX:aim.x,aimY:aim.y,moveX:0,moveY:0,
   sprint:false,switchPlayer:false},this,'A');
  if(this.ball.owner!==taker||isBusyKicking(taker)){
   this._manualControlled.A=receiver?.role==='GK'?this.restartPreviousPlayer:receiver;
   this.activePlaybook=null;this.manualRestartTaker=null;
   if(type==='throwin')this.throwInTaker=null;
   this.fsm.changeState(MatchStates.Play);
  }
  return true;
 }
 checkBallCollisions(){
  this.ball.bounceOffTouchline();
  this.ball.bounceOffEndLine();
  if(this.practice&&this.ballEnteredGoal()){
   this.dropPracticeBall();
   return;
  }
  super.checkBallCollisions();
 }
 dropPracticeBall(){
  const {centerX,centerY}=Utils.getFieldBounds();
  Object.assign(this.ball,{x:centerX,y:centerY});
  this.ball.start();
  this.ball.z=1.8;
  this.ball.capturePrevPosition();
  this.ball.updateGlobalPos();
  this.lastTouchPlayer=null;
  this._pendingAdvantage=null;
  this.arcAssist=null;this.arcCast=null;this.teleCast=null;this.teleFlight=null;
  this.teamA.receivingPlayer=null;this.teamB.receivingPlayer=null;
  this._manualPendingReceiver=null;
 }
 ballEnteredGoal(){
  const {left,right}=this.getGoals();
  return left.isGoalEvent(this.ball)||right.isGoalEvent(this.ball);
 }
 moveHazardPlayer(player){return moveHazardPlayer(player);}
 updateHTMLStats(){}
 updateScrubberUI(){}
 // No offside in this small-sided ruleset; all other restarts use the engine.
 cacheOffsideLines(){this.offsideLineA=this.isSecondHalf()?0:52;this.offsideLineB=this.isSecondHalf()?52:0;this.ball.offsideReceiver=null;this.ball.offsideLineX=null;}
 triggerOffside(){this.ball.offsideReceiver=null;this.ball.offsideLineX=null;}
 checkForSubstitutions(){} // Five starters, no bench, no manager interface.
 render(){} // Score and restart announcements belong to the small, accessible HUD.
}
class FiveMatch {
 static async create(characterId,seed=Date.now(),options={}){
  const character=CHARACTERS.find(c=>c.id===characterId);if(!character)throw Error('Choose a character');
  configureFive(!!options.headless,options.squad ? 0.7 : 1);
  const match=new FiveMatch();match.character=character;match.headless=!!options.headless;match.squad=!!options.squad;match.practice=!!options.practice;match.practicePreview=options.practicePreview;
  match.upgrades=new Set(options.upgrades);
  match.staminaMultiplier=options.rested?2:1;
  Settings.manualControl.autoSwitchOnPass=match.squad;
  const roster=buildMatchRoster(character,options);
  match.input=new FiveInput();match.sim=new FiveSimulator(seed>>>0,options.duration,options.opponent,roster,match.upgrades);
  await match.sim.start();match.sim.active=true;match.sim._playbackRecordingStopped=true;
  match.sim.ball.touchlineBoards=true;
  match.sim.ball.endLineGoals=match.sim.getGoals();
  match.sim.cooldownsOff=!!options.cooldownsOff;
  if(options.roster&&options.opponent?.opening&&match.sim.kickoffTeam!=='A'){
   match.sim.kickoffTeam='A';
   match.sim.resetToKickoff();
  }
  const homeIds=roster?.home||[null,...CHARACTERS.map(c=>c.id)];
  match.sim.teamA.players.forEach((p,i)=>{
   const entry=homeIds[i],hire=entry&&typeof entry==='object'?entry:null;
   const c=CHARACTERS.find(c=>c.id===(hire?.characterId??entry));
   p.name=hire?.name??c?.short??(entry===null?'TURNER':'VALE');p.characterId=c?.id;
   p.powerLevel=hire?.powerLevel??1;
   if(hire)p.recruitPower=hire.power;
   else if(options.starterPower&&homeIds.indexOf(characterId)===i)p.recruitPower=options.starterPower;
   if(match.upgrades.has('runner'))p.movementScale=1.12;
  });
  const away=['SILVA','HUGHES','CLARKE','ROSSI','NOVAK'];match.sim.teamB.players.forEach((p,i)=>{
   const opponent=options.opponent;
   const profile=opponent?.lineup ? (opponent.lineup[i]??{}) : opponent;
   p.name=profile?.slimers?(p.role==='GK'?'SLIME KEEPER':`SLIMER ${i}`):away[i];
   p.isSlimer=!!profile?.slimers;
   p.isShapeshifter=!!profile?.shapeshifters;
   p.isOrc=!!profile?.orcBrothers;
   if(opponent?.lineup&&opponent.lineup[i]&&!p.isSlimer&&!p.isOrc)p.name=profile.name;
   if(p.isOrc){
    if(p.role==='GK')p.name='ORC KEEPER';
    else{
     p.name=(opponent.lineup||i===1)?'BRUK':'MURG';p.characterId='price';
     p.powerReadyAt=0;p.powerCooldown=5;
     p.bargeKnockback=4.5;
     p.powerColor='#f0a970';
    }
   }
   p.movementScale=p.isOrc&&p.role==='GK' ? .94 : (profile?.speedScale??opponent?.speedScale??1);
  });
  match.starter=match.sim.teamA.players.find(p=>p.characterId===characterId);
  match.sim.manualInput=match.input;
  for(const p of match.sim.teamA.players){
   p.sprint={reserve:1,exhausted:false,recoverAt:0};
   const power=match.powerFor(p);
   p.powerCooldown=power?power.cooldown*(match.upgrades.has(power.extra)?.75:1):0;
   p.powerReadyAt=0;
   p.powerColor=CHARACTERS.find(c=>c.id===p.characterId)?.color;
  }
  if(match.squad){
   match.input.squad=true;
   match.sim.manualDefensiveSwitch=true;
   match.sim.manualKeeper=!match.practice;
   match.sim.drivenGroundPasses=true;
   match.sim._manualControlled={A:match.starter,B:null};
   match.sim.tryManualPower=(player,cmd)=>{
    if(player.bargeCharging||player.blazeSliding||player.smokeBlind||player.burningUntil>Time.time)return true;
    cmd.sprint=cmd.sprint&&!player.sprint.exhausted;
    const power=match.powerFor(player);
    const cast=tickSpacePower(match.sim,player,cmd,power)
     ??(power?.icon==='arc'?tickArcPass(match.sim,player,cmd,match.upgrades):null);
    if(cast){
     if(cast.text)match.feedback={text:cast.text,until:Time.time+2};
     return cast.handled;
    }
    if(!cmd.usePower||cmd.switchPlayer||!(power?.icon==='barge'||power?.icon==='dash'))return false;
    const result=usePower(match.sim,player,cmd,match.upgrades);
    match.feedback={text:result.text||result,until:Time.time+2};
    return typeof result!=='string';
   };
   if(match.practice){match.sim.practice=true;match.resetPractice(options.practiceDrill??(characterId==='mendes'?'goal-warp':characterId==='price'?'spin-kick':characterId));}
   return match;
  }
  match.sim.lockedHumanPlayer=match.starter;
  match.input.canSprint=()=>!match.sprintExhausted;
  const choosePass=match.sim.teamA.findBestPassTarget.bind(match.sim.teamA);
  match.sim.teamA.findBestPassTarget=(carrier,opts={})=>{
   const target=match.sim.humanOutlet(carrier);
   const giveAndGo=carrier.lastPassFrom===match.player&&carrier.passLinkCooldown>0;
   if(target&&!giveAndGo&&(!opts.passType||opts.passType===target.type))return target;
   return choosePass(carrier,opts);
  };
  return match;
 }
 get player(){return this.sim._manualControlled?.A||this.starter;}
 powerFor(player){return characterPower(player.characterId,this.practiceCharacter,player.recruitPower);}
 get activeCharacter(){return {number:this.player.jersey,short:this.player.name};}
 get sprintReserve(){return this.player.sprint.reserve;}
 get sprintExhausted(){return this.player.sprint.exhausted;}
 get finished(){return !this.practice&&this.sim.matchState==='fulltime';}
 step(count=1){
  Settings.HEADLESS=this.headless;
  for(let i=0;i<count&&!this.finished;i++){
   const positions=this.sim.teamA.players.map(p=>({x:p.x,y:p.y}));
   const score=this.sim.scoreA;
   Time.advanceFixedLogicStep();
   updateHazards(this.sim);
   const barge=updateBargeCharge(this.sim);
   if(barge)this.feedback={text:barge,until:Time.time+2};
   if(this.sim.goalWarp?.until<=Time.time)clearGoalWarp(this.sim);
   if(this.sim.goalWarp&&this.sim.matchState!=='play')this.sim.goalWarp.steering=false;
   if(this.practice&&!['goal-warp','smoke-bomb','blaze-slide'].includes(this.practiceCharacter)&&!this.spinSparring)this.stepPractice();
   else {
    this.sim.updateShapeshifters();
    if(this.sim.opponent?.slimers)updateSlimerSlows(this.sim.teamA.players);
    this.sim.updateAll();
    this.updateBargeFlight();
    if(this.sim.opponent?.slimers)updateSlimers(this.sim);
    if(this.sim.opponent?.orcBrothers)updateOrcBrothers(this.sim);
   }
   this.sim.teamA.players.forEach((p,i)=>{
    const before=positions[i];
    const sprinting=this.sim.matchState==='play'&&p.humanControlled
     &&p._humanInput?.sprint&&Math.hypot(p.x-before.x,p.y-before.y)>1e-4;
    this.updateSprintReserve(sprinting,p);
   });
   updateTelePass(this.sim);
   const arc=this.sim.arcAssist,ball=this.sim.ball;
   if(this.sim.matchState!=='play')ball.passRoute=null;
   if(this.sim.arcCast&&(ball.owner!==this.sim.arcCast.player||this.sim.setPieceType||this.sim.matchState!=='play')){
    this.sim.arcCast=null;
   }
   if(arc&&!ball.owner&&ball.lastKicker===arc.wizard){
    arc.trail.push({x:ball.x,y:ball.y,z:ball.z});
    if(arc.trail.length>12)arc.trail.shift();
   }
   this.checkArcEncore(score);
   // Clear transient offside flags set by kicks in this tick.
   this.sim.ball.offsideReceiver=null;this.sim.ball.offsideLineX=null;
  }
 }
 resetPractice(drill=this.character.id,level=1){
  const s=this.sim;
  this.practiceCooldowns??=new Map();
  const previous=this.practiceAbilityPlayer;
  const previousPower=previous&&this.powerFor(previous);
  if(previousPower)this.practiceCooldowns.set(previousPower,previous.powerReadyAt);
  clearGoalWarp(s);
  clearBargeCharge(s);
  if(this.warpOpponent){
   for(const {player,stats,movementScale} of this.warpOpponent.original){
    player.stats=stats;player.movementScale=movementScale;
   }
   this.warpOpponent=null;
  }
  if(this.spinSparring){
   for(const {player,movementScale} of this.spinSparring)player.movementScale=movementScale;
   this.spinSparring=null;
  }
  s.lockedHumanPlayer=null;
  s.scoreA=0;s.scoreB=0;s.matchTimer=0;
  s.goalTarget=drill==='goal-warp'?Infinity:GOAL_TARGET;
  this.practiceCharacter=drill;
  const id=['tele-pass','portal-pass','goal-warp'].includes(drill)?'mendes':drill==='smoke-bomb'?'cole':['spin-kick','blaze-slide'].includes(drill)?'price':drill;
  s.slimeShots=[];
  s.blazeTrails=[];s.blazeSlides=[];s.smokeClouds=[];
  for(const p of s.players){
   p.smokeBlind=false;p.burningUntil=0;p.smokeBoostUntil=0;p.blazeSliding=false;p.isSliding=false;p.shadowAgainUntil=0;
  }
  s.practiceFires=[];
  for(const flight of s.bargeFlights??[])flight.opponent.z=0;
  s.bargeFlights=[];
  this.input.reset();
  clearManualCharge(s);
  s._manualPendingReceiver=null;
  s.teamA.receivingPlayer=null;
  s.arcAssist=null;s.arcCast=null;s.teleCast=null;s.teleFlight=null;s.portalFlash=null;s.powerEffect=null;this.feedback=null;
  s.fsm.setCurrentState(MatchStates.Play);
  s.matchState='play';s.setPieceType='';
  const spots=[[5,17],[18,17],[36,17],[21,17],[36,22]];
  s.teamA.players.forEach((p,i)=>{
   [p.x,p.y]=spots[i];p.orientation=2;p.vx=0;p.vy=0;p._currentSpeed=0;
   p.actionTimer=0;p.isSliding=false;p.slideTimer=0;p.humanControlled=false;p._humanInput=null;
   p.kickerClaimCooldown=0;p.tackleAttemptCooldown=0;
   p.spinUntil=0;p.slimedUntil=0;p.movementEffectScale=1;
   Object.assign(p.sprint,{reserve:1,exhausted:false,recoverAt:0});
   p.fsm.changeState(PlayerStates.Idle);
  });
  s.teamB.players.forEach((p,i)=>{
   p.x=44+(i===0?5:0);p.y=[17,7,14,20,27][i];
   p.orientation=6;p.isSlimer=false;p.slimeWindup=null;p.slimeReadyAt=null;
   p.fsm.changeState(PlayerStates.Idle);
  });
  for(const p of s.players)p.isSentOff=true;
  const player=s.teamA.players.find(p=>p.characterId===id);
  player.isSentOff=false;
  const power=this.powerFor(player);
  player.powerLevel=power?.level2&&level===2?2:1;
  player.powerCooldown=power?power.cooldown*(this.upgrades.has(power.extra)?.75:1):0;
  player.powerReadyAt=this.practiceCooldowns.get(power)??0;
  this.practiceAbilityPlayer=player;
  this.practiceRunner=null;
  if(drill==='mendes'){
   const receiver=s.teamA.players.find(p=>p.characterId==='cole');
   receiver.isSentOff=false;
  }
  player.x=23;player.y=17;
  s._manualControlled.A=player;
  s.dropPracticeBall();
  if(this.practicePreview?.characterId===id){
   player.name=this.practicePreview.name;
   player.stats={...player.stats,...this.practicePreview.stats};
  }
  if(drill==='smoke-bomb'||drill==='blaze-slide'){
   const [rival,second]=s.teamB.getOutfieldPlayers(true);
   Object.assign(rival,{x:25.4,y:17.6,isSentOff:false,actionTimer:0});
   if(drill==='smoke-bomb')Object.assign(second,{x:25,y:15,isSentOff:false,actionTimer:0});
   else{
    const ally=s.teamA.players.find(p=>p.characterId==='cole');
    Object.assign(ally,{x:26.8,y:17.3,isSentOff:false});
   }
   s.lockedHumanPlayer=player;
   s.goalTarget=Infinity;
  }
  if(drill==='goal-warp'){
   const ally=s.teamA.players.find(p=>p.characterId==='cole');
   const [rival]=s.teamB.getOutfieldPlayers(true);
   const original=[ally,rival].map(p=>({player:p,stats:p.stats,movementScale:p.movementScale}));
   this.warpOpponent={player:rival,original};
   for(const p of [ally,rival]){
    Object.assign(p,{z:0,vx:0,vy:0,_currentSpeed:0,actionTimer:0,isSentOff:false,
     movementScale:1.35,stats:{...p.stats,speed:99,shooting:99,accuracy:98}});
   }
   Object.assign(ally,{x:28,y:12});
   Object.assign(rival,{x:30,y:19});
   s.lockedHumanPlayer=player;
  }
  if(drill==='spin-kick'&&player.powerLevel===2){
   const ally=s.teamA.players.find(p=>p.characterId==='cole');
   const [opponent]=s.teamB.getOutfieldPlayers(true);
   this.spinSparring=[ally,opponent].map(p=>({player:p,movementScale:p.movementScale}));
   Object.assign(ally,{x:player.x-2,y:player.y+1,isSentOff:false,movementScale:.32});
   Object.assign(opponent,{x:player.x+2,y:player.y-1,z:0,vx:0,vy:0,_currentSpeed:0,
    actionTimer:0,kickerClaimCooldown:0,tackleAttemptCooldown:0,isSentOff:false,movementScale:.32});
   s.lockedHumanPlayer=player;
   s.goalTarget=Infinity;
  }else if(drill==='spin-kick'){
   const [north,south]=s.teamB.getOutfieldPlayers(true);
   Object.assign(north,{x:player.x-3,y:1.5,z:0,isSentOff:false,isSlimer:true,actionTimer:0});
   Object.assign(south,{x:player.x+3,y:s.ball.maxY-1.5,z:0,isSentOff:false,isSlimer:true,actionTimer:0});
   s.practiceFires=[[1.3,-1.7],[4.4,2.3],[9,-2.8]].map(([dx,dy])=>({x:player.x+dx,y:player.y+dy,relightAt:0}));
  }
  if(drill==='price'||drill==='cole'){
   const barge=id==='price';
   const runner=s.teamB.players[1];
   runner.isSentOff=false;
   runner.x=player.x+(barge?3.8:2.8);runner.y=player.y+(barge?0:2.2);
   runner.z=0;runner.actionTimer=0;runner._currentSpeed=0;
   runner.kickerClaimCooldown=0;runner.tackleAttemptCooldown=0;
   runner.stats.tackling=barge?98:76;
   this.practiceRunner=runner;
   this.practiceRoute={x:runner.x,y:runner.y,start:Time.time};
  }
 }
 stepPractice(){
  const s=this.sim;
  if(this.practiceCharacter==='spin-kick')updateSlimerSlows(s.teamA.players);
  tickManualControl(s);
  this.updateBargeFlight();
  if(this.practiceRunner)this.stepPracticeOpponent();
  const player=this.player,ball=s.ball,arc=s.arcAssist;
  player.updateGlobalPos();player.update();
  if(arc?.practiceReturning&&ball.passRoute){
   ball.passRoute.end={x:arc.wizard.x,y:arc.wizard.y};
  }
  ball.updateGlobalPos();ball.update();
  const scored=s.ballEnteredGoal();
  if(this.practiceCharacter==='spin-kick'){
   updateSlimers(s);
   if(player.spinUntil>Time.time){
    for(const fire of s.practiceFires){
     if(fire.relightAt<=Time.time&&Math.hypot(fire.x-player.x,fire.y-player.y)<=SPIN_RADIUS)fire.relightAt=Time.time+4;
    }
   }
  }
  s.msgDispatcher?.advanceTick();
  if(scored)s.dropPracticeBall();
  else if(arc)this.updatePracticeArc(arc);
 }
 stepPracticeOpponent(){
  const runner=this.practiceRunner,{ball,bargeFlights}=this.sim;
  runner.tackleAttemptCooldown=Math.max(0,runner.tackleAttemptCooldown-Time.deltaTime);
  runner.kickerClaimCooldown=Math.max(0,runner.kickerClaimCooldown-Time.deltaTime);
  runner.actionTimer=Math.max(0,runner.actionTimer-Time.deltaTime);
  if(bargeFlights?.some(flight=>flight.opponent===runner)||runner.actionTimer>0)return;
  if(ball.owner===runner){
   const {x,y,start}=this.practiceRoute;
   const phase=(Time.time-start)*.72;
   runner.moveTo({x:x+1.8*Math.cos(phase),y:y+3.4*Math.sin(phase)},.36);
  }else{
   const owner=ball.owner;
   const pressure=this.practiceCharacter==='price'?1.42:.48;
   runner.moveTo(owner?{x:owner.x+(owner.vx||0)*.16,y:owner.y+(owner.vy||0)*.16}:ball,pressure);
   if(owner&&Math.hypot(runner.x-ball.x,runner.y-ball.y)<=1){
    attemptTackle(runner,ball,'foot');
   }else if(!owner)tryClaimLooseBall(runner,ball);
  }
  runner.updateGlobalPos();
 }
 updatePracticeArc(arc){
  const {sim:s}=this,{ball}=s,{wizard,receiver}=arc;
  if(arc.practiceReturning){
   if(ball.owner===wizard||!ball.passRoute){
    receiver.frame=0;
    if(!ball.owner)tryClaimLooseBall(wizard,ball);
    if(ball.owner===wizard)this.feedback={text:'Arc Pass ready',until:Time.time+2};
    s.arcAssist=null;
   }
   return;
  }
  if(!ball.owner&&!ball.passRoute&&Math.hypot(ball.x-receiver.x,ball.y-receiver.y)<1.1){
   ball.owner=receiver;
   ball.syncToOwner();
   const start={x:ball.x,y:ball.y},end={x:wizard.x,y:wizard.y};
   const duration=Math.max(.25,Math.hypot(end.x-start.x,end.y-start.y)/20);
   ball.kick((end.x-start.x)/duration,(end.y-start.y)/duration,0);
   ball.passRoute={start,end,normal:{x:0,y:0},bend:0,height:0,duration,elapsed:0};
   receiver.frame=3;
   arc.practiceReturning=true;
   SoundDB.play('pass');
  }else if(ball.owner===wizard||Time.time>=arc.practiceReturnAt){
   s.arcAssist=null;
  }
 }
 updateBargeFlight(){
  const s=this.sim;
  if(!s.bargeFlights?.length)return;
  s.bargeFlights=s.bargeFlights.filter(({opponent,x,y,dir,distance,start,duration})=>{
   if(s.matchState!=='play'||opponent.isSentOff){
    opponent.z=0;
    return false;
   }
   const progress=Math.min(1,(Time.time-start)/duration);
   const travel=distance*(1-(1-progress)**1.5);
   opponent.x=x+dir.x*travel;opponent.y=y+dir.y*travel;
   opponent.z=progress===1?0:4*progress*(1-progress)*.45;
   opponent.frame=5;
   opponent.updateGlobalPos();
   if(s.ball.owner===opponent)s.ball.syncToOwner();
   return progress<1;
  });
 }
 updateSprintReserve(sprinting,player=this.player){
  const stamina=player.sprint,dt=Time.deltaTime;
  if(sprinting){
   const duration=(2+player.stats.stamina/50)*this.staminaMultiplier*(this.upgrades.has('engine')?1.3:1);
   stamina.reserve=Math.max(0,stamina.reserve-dt/duration);
   stamina.recoverAt=Time.time+.4;
   if(stamina.reserve===0)stamina.exhausted=true;
  }else if(Time.time>=stamina.recoverAt){
   stamina.reserve=Math.min(1,stamina.reserve+dt/(this.upgrades.has('engine')?2.2:3));
   if(stamina.reserve>=.25)stamina.exhausted=false;
  }
 }
 checkArcEncore(scoreBefore){
  const {sim}=this,assist=sim.arcAssist;
  if(!assist)return;
  if(this.upgrades.has('encore')&&assist.receiver!==assist.wizard&&sim.scoreA>scoreBefore
    &&Time.time<=assist.until&&sim.ball.lastKicker===assist.receiver){
   assist.wizard.powerReadyAt=Time.time;
   this.feedback={text:'Arc Encore restored Arc Pass',until:Time.time+3};
  }
  if(Time.time>assist.until||sim.scoreA>scoreBefore||(sim.ball.owner&&sim.ball.owner!==assist.receiver)){
   sim.arcAssist=null;
  }
 }
 destroy(){this.input.destroy();this.sim.active=false;}
}
function kit(color){return {outline:'#101a22',primary:color,primaryLight:color,primaryDark:'#34404a',shorts:'#18242b',shortsDark:'#10181c',socks:color};}
async function loadKits(opponent,roster=[]){
 const {registerPlayerSheetsFromPng}=require('../core/lib/sprite_sheets.js');
 const away=opponent?.name||'AWAY';
 const home=CHARACTERS.map(c=>({jersey:c.number,role:'MF',colors:{skin:c.skin,hair:c.hair}}));
 roster.forEach((hire,i)=>{
  if(typeof hire!=='object'||hire.number)return;
  const base=CHARACTERS.find(c=>c.id===hire.characterId);
  if(base)home.push({jersey:11+i,role:'MF',colors:{skin:base.skin,hair:base.hair}});
 });
 const teams={HOME:home};
 if(opponent?.orcBrothers){
  teams[away]=[
   {jersey:1,role:'GK',colors:{skin:'#879151',skinShadow:'#59663d',skinHighlight:'#bac074',hair:'#331e17'}},
   {jersey:4,role:'CF',colors:{skin:'#879151',skinShadow:'#59663d',skinHighlight:'#bac074',hair:'#331e17'}},
   {jersey:5,role:'CB',colors:{skin:'#729050',skinShadow:'#425e3b',skinHighlight:'#a5b562',hair:'#443129'}}
  ];
  if(opponent.lineup)teams[away]=[{...teams[away][1],jersey:opponent.lineup.findIndex(profile=>profile?.orcBrothers)+1}];
 }
 await registerPlayerSheetsFromPng({HOME:{main:kit('#f5b841'),gk:kit('#d9e3e7')},[away]:{main:kit(opponent?.color||'#68b4d0'),gk:kit('#dd8095')}},{teams},['HOME',away]);
}
module.exports={CHARACTERS,FORMATION,FiveMatch,FiveSimulator,configureFive,loadKits};
