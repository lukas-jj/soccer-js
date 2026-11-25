const {playerAppearance,appearanceColors}=require('./appearances.js');
const {launchNutmeg,updateNutmeg}=require('./nutmeg.js');
const {TEAM_DRILLS,tickTeamMove,updateTeamCross,runToTeamCross}=require('./team_moves.js');
const {updateHazards,moveHazardPlayer}=require('./hazards.js');
const {updateClones,followClone}=require('./clones.js');
const {Utils}=require('../core/lib/utils.js');
const {defendingGoalSide,getPenaltyArea}=require('../core/lib/match_rules.js');
const {tickManualControl,clearManualCharge,applyHumanCommand,isBusyKicking,humanFacingDir}=require('../core/lib/manual_control.js');
const {Simulator,MatchStates}=require('../providers/simulator/simulator.js');
const {Settings}=require('../settings.js');
const {Time}=require('../core/lib/time.js');
const {SoundDB}=require('../core/lib/sounddb.js');
const {getArchetypeFullValues}=require('../core/lib/ai_archetypes.js');
const {FiveInput}=require('./input.js');
const {PlayerStates,attemptTackle,getGoalkeeperBaseX,isGkProtected,tryClaimLooseBall}=require('../core/entities/player.js');
const {estimatePassGroundSpeed,isPassSafeFromAllOpponents,tryBallShotBlocking}=require('../core/lib/pass_safety.js');
const {DRUID_FORMS,launchBlastShot,characterPower,usePower,tickArcPass,tickSpacePower,updateTelePass,clearGoalWarp,clearBargeCharge,updateBargeCharge,SPIN_RADIUS}=require('./powers.js');
const {ClubEffects}=require('./club_effects.js');
const {StreetChallenge}=require('./street_challenges.js');
const {updateSlimers,updateSlimerSlows,stepSlimeShots,stepStreaker}=require('./slimers.js');
const {updateHordeFC}=require('./horde_fc.js');
const {GIANT_SPEED,GIANT_BODY,GIANT_COLORS,updateIceTrails,applyIceTraction,iceBallFriction}=require('./frost_giants.js');
const {CHARACTERS,squadNumber,seededRandom,rollBody}=require('./characters.js');
const EXTRA_TIME_SECONDS=30;
const DEFAULT_HOME=[null,'price','cole','mendes','kowalski'];
const SLIMER_SHOT={range:24,chance:.5,speedMultiplier:.56,angleNoise:.014};
const FORMATION=[{role:'GK',x:6,y:50},{role:'CB',x:25,y:50},{role:'LM',x:43,y:24},{role:'RM',x:43,y:76},{role:'CF',x:65,y:50}];
const BASE={speed:77,dribblingSpeed:77,stamina:86,passing:78,dribbling:77,shooting:78,tackling:75,goalkeeping:15,accuracy:81};
const AWAY_BUILDS={
 block:['price','kowalski','price'],
 press:['cole','mendes','cole'],
 shoot:['mendes','kowalski','cole'],
 mixed:['kowalski','cole','price','mendes']
};
const HORDE_OUTFIELD=[
 {name:'BRUK',appearance:0,body:{width:1.12,height:1.04},speed:.62},
 {name:'MURG',appearance:1,body:{width:1.09,height:1.06},speed:.62},
 {name:'GORR',appearance:2,body:{width:1.07,height:1.02},speed:.84}
];
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
 if(!options.roster&&!options.matchup){
  if(!options.practice&&!options.practicePreview&&character.id!=='druid')return null;
  const preview=options.practicePreview;
  let home=[...DEFAULT_HOME.slice(0,4),'druid'].map(id=>id===preview?.characterId?preview:id);
  if(preview&&!options.practice)home=[null,preview,...home.filter(entry=>entry&&entry!==preview)];
  return {home,homeKeeper:true,awayCount:5,awayKeeper:true};
 }
 const {matchup,opponent}=options;
 const keeper=options.roster?.find(player=>player.keeper);
 const homeKeeper=!!keeper||!!matchup?.homeKeeper&&matchup.home>1;
 const homeCount=matchup?.home??options.roster.length;
 const ids=options.roster?.filter(player=>!player.keeper)||[character.id,...CHARACTERS.map(c=>c.id).filter(id=>id!==character.id)];
 const home=[...(homeKeeper?[keeper??null]:[]),...Array.from({length:homeCount-Number(homeKeeper)},(_,i)=>ids[i]||'reserve')];
 const awayCount=matchup?.away??opponent?.count??5;
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
  super({seed});this.playersPerTeam=5;this.fiveDuration=duration??60;this.goalTarget=Infinity;this.opponent=opponent;
  this.manualAimUsesAccuracy=true;
  this.roster=roster;this.runUpgrades=upgrades;this.allowCorners=false;this.allowManualSlides=false;this.allowTackleFouls=false;
  this.goalCelebrationSeconds=1.5;this.winningGoalCelebrationSeconds=.85;
  if(roster)this.teamPlayerCounts={A:roster.home.length,B:roster.awayCount};
 }
 readConfig(){this.teamAName='HOME';this.teamBName=this.opponent?.name||'AWAY';this.formationAName=this.roster?'home':'five';this.formationBName=this.roster?'away':'five';this.matchDuration=this.fiveDuration;}
 restoreMatchAIStrategySettings(){}
 processTeamDynamicStrategy(team,isLateGame){
  if(team==='B'&&this.opponent)return;
  super.processTeamDynamicStrategy(team,isLateGame);
 }
 async ensureActiveTeamSprites(){}
 getKeeperBounds(player){
  // The pitch uses horizontal field scaling for both axes of the painted box.
  return getPenaltyArea(defendingGoalSide(this,player.team),null,Utils.scaleFieldX);
 }
 keepGoalkeepersInBox(){
  for(const team of [this.teamA,this.teamB]){
   const keeper=team.getGoalkeeper();
   if(!keeper)continue;
   const {xMin,xMax,yMin,yMax}=this.getKeeperBounds(keeper);
   const x=Math.max(xMin,Math.min(xMax,keeper.x));
   const y=Math.max(yMin,Math.min(yMax,keeper.y));
   if(x===keeper.x&&y===keeper.y)continue;
   Object.assign(keeper,{x,y,vx:0,vy:0});
   keeper.updateGlobalPos();
   if(this.ball.owner===keeper)this.ball.syncToOwner();
  }
 }
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
   stats.dribblingSpeed=cap(BASE.dribblingSpeed+bonus+(profile.dribblingSpeed??profile.speed??0)+(variation.dribblingSpeed??variation.speed??0));
   return {...stats,jersey:this.opponent?.hordeFC&&!this.opponent.lineup&&!isKeeper?i+3:i+1,goalkeeping:isKeeper?cap(88+bonus+(profile.goalkeeping||0)):15,traits:[]};
  };
  const roster=this.roster;
  const homeIds=roster?.home||DEFAULT_HOME;
  const homeStats=homeIds.map((id,i)=>{
   if(!id)return keeper;
   const c=typeof id==='object'?id:CHARACTERS.find(c=>c.id===id)||{stats:BASE,number:10};
   const finishing=this.runUpgrades?.has('finish')?10:0;
   return {...c.stats,shooting:Math.min(100,c.stats.shooting+finishing),
    shotAccuracy:Math.min(100,(c.stats.shotAccuracy??c.stats.accuracy??BASE.accuracy)+finishing),
    passAccuracy:Math.min(100,(c.stats.passAccuracy??c.stats.accuracy??BASE.accuracy)+finishing),jersey:typeof id==='object'?(id.number??11+i):homeIds.indexOf(id)===i?c.number:10,traits:[]};
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
    copied.shotAccuracy=Math.min(100,(source.stats.shotAccuracy??source.stats.accuracy??BASE.accuracy)+4);
    copied.passAccuracy=Math.min(100,(source.stats.passAccuracy??source.stats.accuracy??BASE.accuracy)+4);
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
   .filter(p=>this.canBecomeChaser(p)&&!p.bargeWindup&&!p.slimeWindup&&!(p.burningUntil>Time.time))
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
  if(!['freekick','goalkick','throwin','corner'].includes(type))return false;
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
 resetTrainingBall(){
  this.fsm.setCurrentState(MatchStates.Play);
  this.setPieceType='';
  this.dropPracticeBall();
  const player=this._manualControlled.A;
  const carrier=player?.team==='A'&&!player.isSentOff&&player.role!=='GK'?player:this.teamA.getOutfieldPlayers()[0];
  this._manualControlled.A=carrier;
  this.ball.owner=carrier;
  carrier.fsm.changeState(PlayerStates.Dribble);
  this.ball.syncToOwner();
 }
 checkBallCollisions(){
  this.ball.bounceOffTouchline();
  this.ball.bounceOffEndLine();
  if(this.trainingGround&&this.ballEnteredGoal()){
   const goals=this.getGoals();
   const goal=goals.left.scored(this.ball)?goals.left:goals.right;
   if(goal.scoringTeam(this.isSecondHalf())==='A')this.scoreA++;
   else this.scoreB++;
   this.resetTrainingBall();
   return;
  }
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
 moveHazardPlayer(player){return moveHazardPlayer(player)||runToTeamCross(this,player)||followClone(this,player);}
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
  if(options.streetChallenge==='duel'){
   Settings.BASE_FIELD_WIDTH=34;
   Settings.BASE_FIELD_HEIGHT=26;
  }
  const match=new FiveMatch();match.character=character;match.headless=!!options.headless;match.squad=!!options.squad;match.practice=!!options.practice;match.practicePreview=options.practicePreview;
  match.sandbox=options.sandbox;
  match.leagueFixture=!!options.leagueFixture;
  match.upgrades=new Set(options.upgrades);
  match.staminaMultiplier=options.rested?2:1;
  Settings.manualControl.autoSwitchOnPass=match.squad;
  const roster=buildMatchRoster(character,options);
  match.input=new FiveInput();match.sim=new FiveSimulator(seed>>>0,options.duration,options.opponent,roster,match.upgrades);
  match.sim.teamAbilities=[...(options.teamAbilities??[])];
  match.secondsLeft=match.sim.fiveDuration;
  await match.sim.start();match.sim.active=true;match.sim._playbackRecordingStopped=true;
  match.sim.ball.touchlineBoards=true;
  match.sim.ball.endLineGoals=match.sim.getGoals();
  match.sim.ball.onCrossbarHit=(goal,ball)=>match.sim.onCrossbarHit?.(goal,ball);
  match.sim.cooldownsOff=!!options.cooldownsOff;
  if((options.roster&&options.opponent?.opening||options.practicePreview&&!options.practice)&&match.sim.kickoffTeam!=='A'){
   match.sim.kickoffTeam='A';
   match.sim.resetToKickoff();
  }
  const homeIds=roster?.home||DEFAULT_HOME;
  const homeNumbers=new Set(homeIds.map(entry=>entry?.number).filter(Boolean));
  const awayNumbers=new Set();
  const random=match.sim.seededRandom||Math.random;
  const bodies=seededRandom(seed^0x79ac88c5);
  match.sim.teamA.players.forEach((p,i)=>{
   const entry=homeIds[i],hire=entry&&typeof entry==='object'?entry:null;
   const c=CHARACTERS.find(c=>c.id===(hire?.characterId??entry));
   p.name=hire?.name??c?.short??(entry===null?'TURNER':'VALE');p.characterId=c?.id;
   p.appearance=playerAppearance(hire?.appearanceClass??c?.id,hire?.appearance);
   p.body=hire?.body??(p.role==='GK'?rollBody('keeper',bodies):c?.body??rollBody('kowalski',bodies));
   p.stats.jersey=hire?.number??squadNumber(random,homeNumbers);
   p.powerLevel=hire?.powerLevel??1;
   if(hire){
    p.recruitPower=hire.power;
    p.isBard=!!hire.bard;
    if(hire.frostGiant){p.isFrostGiant=true;p.movementScale=GIANT_SPEED;}
   }
   else if(options.starterPower&&homeIds.indexOf(characterId)===i)p.recruitPower=options.starterPower;
   if(match.upgrades.has('runner'))p.movementScale=(p.movementScale??1)*1.12;
  });
  const away=['SILVA','HUGHES','CLARKE','ROSSI','NOVAK'];match.sim.teamB.players.forEach((p,i)=>{
   const opponent=options.opponent;
   const profile=opponent?.lineup ? (opponent.lineup[i]??{}) : opponent;
   p.name=profile?.slimers?(p.role==='GK'?'SLIME KEEPER':`SLIMER ${i}`):away[i];
   p.isSlimer=!!profile?.slimers;
   if(p.isSlimer&&p.role!=='GK')p.longShotProfile=SLIMER_SHOT;
   p.isShapeshifter=!!profile?.shapeshifters;
   p.isOrc=!!profile?.hordeFC;
   p.isFrostGiant=!!profile?.frostGiants;
   const builds=AWAY_BUILDS[profile?.style]??AWAY_BUILDS.mixed;
   const bodyType=p.isSlimer?'slimer':p.role==='GK'?'keeper':builds[i%builds.length];
   if(opponent?.lineup&&opponent.lineup[i]&&!p.isSlimer&&!p.isOrc)p.name=profile.name;
   const outfieldIndex=i-Number(roster?.awayKeeper??true);
   const hordePlayer=p.isOrc&&p.role!=='GK'
    ?profile.hordePlayer??HORDE_OUTFIELD[outfieldIndex%HORDE_OUTFIELD.length]
    :null;
   p.appearance=p.isOrc?playerAppearance('price',p.role==='GK'?3:hordePlayer.appearance)
    :!p.isSlimer&&!p.isFrostGiant?playerAppearance(bodyType,i):undefined;
   if(p.isOrc){
    if(p.role==='GK')p.name='ORC KEEPER';
    else{
     p.name=hordePlayer.name;p.characterId='price';
     p.powerReadyAt=0;p.powerCooldown=5;
     p.bargeKnockback=4.5;
     p.powerColor='#f0a970';
    }
   }
   if(p.isFrostGiant)p.name=p.role==='GK'?'FROST KEEPER':`FROST GIANT ${i+1}`;
   p.body=p.isFrostGiant?GIANT_BODY:hordePlayer?.body??(p.isOrc?{width:1.11,height:1.06}:rollBody(bodyType,bodies));
   p.stats.jersey=squadNumber(random,awayNumbers);
   p.movementScale=p.isFrostGiant?GIANT_SPEED:hordePlayer?.speed??(p.isOrc ? .94 : profile?.speedScale??opponent?.speedScale??1);
  });
  const giants=match.sim.players.filter(player=>player.isFrostGiant);
  if(giants.length){
   match.frostGiants=giants;
   match.sim.iceTrails=[];
   match.sim.ball.groundFrictionAt=(x,y)=>iceBallFriction(match.sim,x,y);
   match.sim.applyGroundTraction=(player,x,y)=>applyIceTraction(match.sim,player,x,y);
  }
  match.starter=match.sim.teamA.players.find(p=>p.characterId===characterId&&p.role!=='GK');
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
   match.sim.onShot=player=>{
    if(match.powerFor(player)?.icon==='blast')launchBlastShot(match.sim,player);
   };
   match.sim.onGroundPass=player=>{
    if(match.powerFor(player)?.icon==='nutmeg')launchNutmeg(match.sim,player);
   };
   match.sim.tryManualPower=(player,cmd)=>{
    if(player.bargeCharging||player.blazeSliding||player.burningUntil>Time.time)return true;
    cmd.sprint=cmd.sprint&&!player.sprint.exhausted;
    const teamMove=tickTeamMove(match.sim,player,cmd);
    if(teamMove){
     if(teamMove.text)match.feedback={text:teamMove.text,until:Time.time+1.3};
     return true;
    }
    const power=match.powerFor(player);
    const cast=tickSpacePower(match.sim,player,cmd,power)
     ??(power?.icon==='arc'?tickArcPass(match.sim,player,cmd,match.upgrades):null);
    if(cast){
     if(cast.text)match.feedback={text:cast.text,until:Time.time+2};
     return cast.handled;
    }
    if(!cmd.usePower||cmd.switchPlayer||!(power?.icon==='barge'||power?.icon==='dash'))return false;
    const result=usePower(match.sim,player,cmd,match.upgrades,power);
    match.feedback={text:result.text||result,until:Time.time+2};
    return typeof result!=='string';
   };
   if(match.practice){
    match.sim.practice=true;
    match.sim.warmup=match.sandbox==='warmup';
    if(options.streetChallenge){
     match.sim.fsm.setCurrentState(MatchStates.Play);
     match.sim.setPieceType='';
    }else if(match.sandbox)match.resetSandbox();
    else match.resetPractice(options.practiceDrill??(characterId==='mendes'?'goal-warp':characterId==='price'?'spin-kick':characterId));
   }
   match.club=new ClubEffects(match,options.gear,options.items);
   const curse=options.bardCurse;
   const cursed=curse&&match.sim.teamA.players.find(player=>player.jersey===curse.number);
   if(cursed){
    if(curse.kind==='speed')cursed.movementScale=(cursed.movementScale??1)*.5;
    if(curse.kind==='ability'){cursed.recruitPower=null;cursed.powerCooldown=0;}
    if(curse.kind==='stamina'){
     cursed.stats.stamina=0;
     cursed.bardFatigued=true;
     Object.assign(cursed.sprint,{reserve:0,exhausted:true,recoverAt:Infinity});
    }
   }
   if(options.streetChallenge)match.streetChallenge=new StreetChallenge(match,options.streetChallenge,options.opponent);
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
 powerFor(player){return player.role==='GK'||this.streetChallenge?.kind==='crossbar'?null:characterPower(player.characterId,this.practiceCharacter,player.recruitPower);}
 get activeCharacter(){return {number:this.player.jersey,short:this.player.name};}
 get sprintReserve(){return this.player.sprint.reserve;}
 get sprintExhausted(){return this.player.sprint.exhausted;}
 get timed(){return !this.practice||this.sandbox==='showcase'||this.sandbox==='items';}
 get finished(){return this.timed&&this.sim.matchState==='fulltime';}
 get winner(){
  return this.forfeitWinner??(this.sim.scoreA>this.sim.scoreB?'A':this.sim.scoreB>this.sim.scoreA?'B':null);
 }
 step(count=1){
  Settings.HEADLESS=this.headless;
  for(let i=0;i<count&&!this.finished;i++){
   const positions=this.sim.teamA.players.map(p=>({x:p.x,y:p.y}));
   const score=this.sim.scoreA,against=this.sim.scoreB;
   Time.advanceFixedLogicStep();
   if(this.frostGiants)updateIceTrails(this.sim,this.frostGiants);
   updateHazards(this.sim);
   this.club?.step();
   updateClones(this.sim);
   const barge=updateBargeCharge(this.sim);
   if(barge)this.feedback={text:barge,until:Time.time+2};
   if(this.sim.goalWarp?.until<=Time.time)clearGoalWarp(this.sim);
   if(this.sim.goalWarp&&this.sim.matchState!=='play')this.sim.goalWarp.steering=false;
   updateSlimerSlows(this.sim.players);
   if(this.streetChallenge)this.streetChallenge.step();
   else if(!this.timed&&!['goal-warp','blaze-slide','clone','stepover'].includes(this.practiceCharacter)&&!this.spinSparring)this.stepPractice();
   else {
    this.sim.updateShapeshifters();
    this.sim.updateAll();
    this.updateBargeFlight();
    if(this.sim.opponent?.slimers)updateSlimers(this.sim);
    if(this.sim.opponent?.hordeFC)updateHordeFC(this.sim);
   }
   stepStreaker(this.sim);
   if(!this.sim.opponent?.slimers&&this.practiceCharacter!=='spin-kick'&&this.sim.slimeShots?.length)stepSlimeShots(this.sim);
   this.sim.keepGoalkeepersInBox();
   this.sim.teamA.players.forEach((p,i)=>{
    const before=positions[i];
    const sprinting=this.sim.matchState==='play'&&p.humanControlled
     &&p._humanInput?.sprint&&Math.hypot(p.x-before.x,p.y-before.y)>1e-4;
    this.updateSprintReserve(sprinting,p);
   });
   const nutmeg=updateNutmeg(this.sim);
   if(nutmeg)this.feedback={text:nutmeg,until:Time.time+1.3};
   const crossFeedback=updateTeamCross(this.sim);
   if(crossFeedback)this.feedback={text:crossFeedback,until:Time.time+1.3};
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
   if(this.timed&&this.sim.scoreA>score)this.club?.goal('A',this.sim.ball.lastKicker);
   if(this.timed&&this.sim.scoreB>against)this.club?.goal('B',this.sim.ball.lastKicker);
   if(this.timed&&!this.sim.trainingGround&&!this.finished){
    this.secondsLeft=Math.max(0,this.secondsLeft-Time.deltaTime);
    const countdown=Math.ceil(this.secondsLeft-1e-8);
    if(countdown!==this.countdownSecond){
     this.countdownSecond=countdown;
     if(countdown>=1&&countdown<=10){
      const urgency=(10-countdown)/9;
      SoundDB.play('clock_tick',{volume:.35+urgency*.65,playbackRate:1+urgency*.4});
     }
    }
    if(this.secondsLeft<1e-8){
     this.secondsLeft=0;
     if(this.winner||this.extraTime||this.leagueFixture)this.sim.fsm.changeState(MatchStates.Fulltime);
     else {
      this.extraTime=true;
      this.extraTimeAnnouncementUntil=Time.time+1.5;
      this.secondsLeft=EXTRA_TIME_SECONDS;
      clearManualCharge(this.sim);
      this.input.reset();
      this.sim.kickoffTeam=this.sim.kickoffTeam==='A'?'B':'A';
      this.sim.resetToKickoff();
      this.sim.fsm.changeState(MatchStates.Kickoff);
      SoundDB.play('whistle_long');
     }
    }
   }
   // Clear transient offside flags set by kicks in this tick.
   this.sim.ball.offsideReceiver=null;this.sim.ball.offsideLineX=null;
  }
 }
 setTrainingAbility(id,level){
  const s=this.sim;
  clearManualCharge(s);
  clearBargeCharge(s);
  clearGoalWarp(s);
  s.teleCast=null;s.arcCast=null;
  for(const player of s.teamA.getOutfieldPlayers(true)){
   player.recruitPower=id||player.trainingDefaultPower;
   player.powerLevel=level;
   player.powerCooldown=this.powerFor(player)?.cooldown??0;
   player.powerReadyAt=0;player.shadowAgainUntil=0;
  }
 }
 setTrainingFreeze(frozen){
  const s=this.sim;
  s.trainingEnemiesFrozen=frozen;
  if(!frozen)return;
  for(const player of s.teamB.members()){
   Object.assign(player,{z:0,vx:0,vy:0,vz:0,_currentSpeed:0,isSliding:false});
   player.fsm.changeState(PlayerStates.Idle);
  }
  if(s.ball.owner?.team==='B'){
   if(s.setPieceType)s.resetTrainingBall();
   else s.ball.kick(0,0,0);
  }
 }
 setTrainingSquads(squads){
  const s=this.sim;
  if(!s.trainingGround){
   for(const player of s.teamA.getOutfieldPlayers(true))player.trainingDefaultPower=player.recruitPower;
   s.trainingGround=true;
  }
  for(const [key,team] of [['home',s.teamA],['away',s.teamB]]){
   team.allowSentOffKeeperFallback=false;
   const outfield=team.getOutfieldPlayers(true);
   const keeper=team.getGoalkeeper(true);
   const active=new Set(outfield.slice(0,squads[key]));
   if(keeper&&squads[key+'Keeper'])active.add(keeper);
   for(const player of team.players){
    const playing=active.has(player);
    if(player.isSentOff===!playing)continue;
    player.isSentOff=!playing;
    player.humanControlled=false;
    player._humanInput=null;
    if(playing){
     Object.assign(player,{x:player.baseX,y:player.baseY,z:0,actionTimer:0,vx:0,vy:0,vz:0,_currentSpeed:0});
     player.fsm.changeState(player.role==='GK'?PlayerStates.Goalkeeper:PlayerStates.Idle);
     player.updateGlobalPos();
    }
   }
   if(team.receivingPlayer?.isSentOff)team.receivingPlayer=null;
  }
  if(s._manualPendingReceiver?.isSentOff)s._manualPendingReceiver=null;
  if(s._manualControlled.A?.isSentOff){
   s._manualControlled.A=this.starter;
   s.manualKeeperSelected=false;
   clearManualCharge(s);
  }
  if(s.ball.owner?.isSentOff){
   if(s.setPieceType)s.resetTrainingBall();
   else s.ball.kick(0,0,0);
  }
 }
 resetSandbox(){
  const s=this.sim;
  s.fsm.setCurrentState(MatchStates.Play);
  s.setPieceType='';
  s.goalTarget=Infinity;
  if(!this.timed){
   for(const player of s.teamB.players)player.isSentOff=true;
   s.teamA.players.forEach((player,index)=>{
    if(player.role==='GK'){
     const side=defendingGoalSide(s,player.team);
     Object.assign(player,{x:getGoalkeeperBaseX(s,player.team),y:Utils.getFieldBounds().centerY,z:0,orientation:side==='left'?2:6});
     player.fsm.changeState(PlayerStates.Goalkeeper);
    }else{
     Object.assign(player,{x:22-index*2,y:17+(index%2?-1:1)*index*2,z:0,orientation:2});
    }
    player.updateGlobalPos();
   });
  }
  s.dropPracticeBall();
  s.ball.owner=this.starter;
  s.ball.syncToOwner();
  this.starter.fsm.changeState(PlayerStates.Dribble);
  this.sim._manualControlled.A=this.starter;
 }
 setupShowcase(id){
  const {sim,player}=this,{ball}=sim;
  if(id==='crossbar'||['bard','first-goal','sheet'].includes(id)){
   const goal=sim.getGoals().right;
   const distance=id==='crossbar'?25:8;
   Object.assign(player,{x:goal.lineX-distance,y:goal.center.y,orientation:2});
   player.updateGlobalPos();
   ball.owner=player;
   ball.syncToOwner();
  }else if(id==='water'||id==='banner'){
   for(const teammate of sim.teamA.players)Object.assign(teammate.sprint,{reserve:0,exhausted:true,recoverAt:Time.time+20});
  }else if(id==='hourglass'){
   player.powerReadyAt=Time.time+player.powerCooldown;
  }
 }
 resetPractice(drill=this.character.id,level=1){
  const s=this.sim;
  this.practiceCooldowns??=new Map();
  s.practiceTeamMove=TEAM_DRILLS[drill]??null;
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
  s.goalTarget=Infinity;
  this.practiceCharacter=drill;
  const druidDrill=Object.hasOwn(DRUID_FORMS,drill);
  const id=druidDrill?'druid':s.practiceTeamMove?'price':['tele-pass','portal-pass','goal-warp','clone'].includes(drill)?'mendes':['nutmeg','stepover'].includes(drill)?'cole':['spin-kick','blaze-slide','blast-shot'].includes(drill)?'price':drill;
  s.slimeShots=[];s.clones=[];
  s.blazeTrails=[];s.blazeSlides=[];
  for(const p of s.players){
   p.beastUntil=0;p.beastForm=null;
   p.burningUntil=0;p.nutmegBoostUntil=0;p.blazeSliding=false;p.isSliding=false;p.shadowAgainUntil=0;
  }
  s.practiceFires=[];
  for(const flight of s.bargeFlights??[])flight.opponent.z=0;
  s.bargeFlights=[];
  this.input.reset();
  clearManualCharge(s);
  s._manualPendingReceiver=null;
  s.teamA.receivingPlayer=null;
  s.teamCross=null;s.teamMoveReadyAt=0;s.arcAssist=null;s.arcCast=null;s.teleCast=null;s.teleFlight=null;s.portalFlash=null;s.powerEffect=null;this.feedback=null;
  s.fsm.setCurrentState(MatchStates.Play);
  s.matchState='play';s.setPieceType='';
  const spots=[[5,17],[18,17],[36,17],[21,17],[36,22]];
  s.teamA.players.forEach((p,i)=>{
   [p.x,p.y]=spots[i];p.orientation=2;p.vx=0;p.vy=0;p._currentSpeed=0;
   p.actionTimer=0;p.isSliding=false;p.slideTimer=0;p.stepoverPose=null;p.teamFinishPose=null;p.humanControlled=false;p._humanInput=null;
   p.kickerClaimCooldown=0;p.tackleAttemptCooldown=0;
   p.spinUntil=0;p.slimedUntil=0;p.movementEffectScale=1;p.overheadPose=null;
   Object.assign(p.sprint,{reserve:1,exhausted:false,recoverAt:0});
   p.fsm.changeState(PlayerStates.Idle);
  });
  s.teamB.players.forEach((p,i)=>{
   p.x=44+(i===0?5:0);p.y=[17,7,14,20,27][i];
   p.orientation=6;p.isSlimer=false;p.slimeWindup=null;p.slimeReadyAt=null;
   p.fsm.changeState(PlayerStates.Idle);
  });
  for(const p of s.players)p.isSentOff=true;
  const player=s.teamA.players.find(p=>p.characterId===(this.practicePreview?.characterId??id));
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
  if(s.practiceTeamMove){
   const receiver=s.teamA.players.find(p=>p.characterId==='cole');
   Object.assign(player,{x:32,y:7});
   Object.assign(receiver,{x:40,y:16,isSentOff:false});
   if(s.practiceTeamMove.kind==='overhead')receiver.orientation=6;
   if(s.practiceTeamMove.kind==='power'){
    const [defender]=s.teamB.getOutfieldPlayers(true);
    Object.assign(defender,{x:46,y:16.5,z:0,isSentOff:false,actionTimer:0});
   }
  }
  if(drill==='nutmeg'){
   const defenders=s.teamB.getOutfieldPlayers(true).slice(0,player.powerLevel);
   defenders.forEach((defender,i)=>Object.assign(defender,{x:player.x+3+i*3,y:player.y,z:0,orientation:6,isSentOff:false,actionTimer:0}));
  }
  if(drill==='bear'){
   const [defender]=s.teamB.getOutfieldPlayers(true);
   Object.assign(defender,{x:player.x+7,y:player.y,isSentOff:false,actionTimer:0,tackleAttemptCooldown:0,kickerClaimCooldown:0});
   this.practiceRunner=defender;
   this.practiceRoute={x:defender.x,y:defender.y,start:Time.time};
  }
  if(drill==='eagle')Object.assign(player,{x:36,y:17});
  if(drill==='blast-shot'){
   const [defender]=s.teamB.getOutfieldPlayers(true);
   Object.assign(player,{x:36,y:17});
   Object.assign(defender,{x:41,y:17,z:0,vx:0,vy:0,_currentSpeed:0,isSentOff:false,
    actionTimer:0,tackleAttemptCooldown:0,kickerClaimCooldown:0});
   this.practiceRunner=defender;
   this.practiceRoute={x:defender.x,y:defender.y,start:Time.time};
  }
  if(druidDrill||drill==='clone'||drill==='nutmeg'||drill==='blast-shot'||s.practiceTeamMove){
   s.ball.owner=player;
   s.ball.syncToOwner();
   player.fsm.changeState(PlayerStates.Dribble);
  }
  if(['blaze-slide','clone','stepover'].includes(drill)){
   const [rival,second]=s.teamB.getOutfieldPlayers(true);
   Object.assign(rival,{x:25.4,y:17.6,isSentOff:false,actionTimer:0});
   if(drill!=='blaze-slide')Object.assign(second,{x:25,y:15,isSentOff:false,actionTimer:0});
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
     movementScale:1.35,stats:{...p.stats,speed:99,dribblingSpeed:99,shooting:99,shotAccuracy:98,passAccuracy:98}});
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
  const blastDrill=this.practiceCharacter==='blast-shot';
  tickManualControl(s);
  this.updateBargeFlight();
  if(this.practiceRunner)this.stepPracticeOpponent();
  const player=this.player,ball=s.ball,arc=s.arcAssist;
  const players=this.sandbox||s.practiceTeamMove?s.teamA.players:[player];
  for(const active of players){
   active.updateGlobalPos();active.update();
  }
  if(arc?.practiceReturning&&ball.passRoute){
   ball.passRoute.end={x:arc.wizard.x,y:arc.wizard.y};
  }
  ball.updateGlobalPos();ball.update();
  if(this.sandbox||s.practiceTeamMove||blastDrill)s.resolveGoalFrameCollisions();
  if(s.practiceTeamMove||blastDrill)tryBallShotBlocking(s);
  if(this.practiceCharacter==='nutmeg'&&!ball.owner)s.teamB.getOutfieldPlayers().some(p=>tryClaimLooseBall(p,ball));
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
  if(scored){
   if(this.sandbox){
    const side=s.getGoals().right.scored(ball)?'A':'B';
    this.club?.goal(side,ball.lastKicker);
    if(side==='A')s.scoreA++;
    else s.scoreB++;
   }
   s.dropPracticeBall();
  }
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
   if(this.practiceCharacter==='blast-shot'){
    if(!owner&&ball.isShot&&Math.hypot(ball.vx,ball.vy)>8){runner.frame=0;return;}
    const {width}=Utils.getFieldBounds();
    const target=owner?{x:Math.min(width-.5,owner.x+2),y:owner.y}:ball;
    runner.moveTo(target,.32,{arrive:true});
   }else{
    const pressure=this.practiceCharacter==='price'?1.42:.48;
    runner.moveTo(owner?{x:owner.x+(owner.vx||0)*.16,y:owner.y+(owner.vy||0)*.16}:ball,pressure);
   }
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
    if(ball.owner===wizard)this.feedback={text:'Swerve ready',until:Time.time+2};
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
  if(player.bardFatigued)return;
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
   this.feedback={text:'Arc Encore restored Swerve',until:Time.time+3};
  }
  if(Time.time>assist.until||sim.scoreA>scoreBefore||(sim.ball.owner&&sim.ball.owner!==assist.receiver)){
   sim.arcAssist=null;
  }
 }
 destroy(){
  this.input.destroy();
  this.sim.active=false;
  this.sim.playerSheets?.clear();
  for(const player of this.sim.players)player._cachedSpriteSheet=null;
 }
}
function kit(color){return {outline:'#101a22',primary:color,primaryLight:color,primaryDark:'#34404a',shorts:'#18242b',shortsDark:'#10181c',socks:color};}
async function loadKits(sim,teamColor='#f5b841'){
 const {registerPlayerSheetsFromPng}=require('../core/lib/sprite_sheets.js');
 const away=sim.teamBName;
 const sheets=team=>team.players.map(player=>{
  const base=CHARACTERS.find(c=>c.id===player.characterId);
  const colors=player.isFrostGiant?GIANT_COLORS:player.appearance?appearanceColors(player.appearance):base?{skin:base.skin,hair:base.hair}:undefined;
  return {jersey:player.jersey,role:player.role,colors,head:!player.isFrostGiant?player.appearance:undefined};
 });
 const teams={HOME:sheets(sim.teamA),[away]:sheets(sim.teamB)};
 const playerSheets=new Map();
 const imageDB={get:key=>playerSheets.get(key),register:(key,sheet)=>playerSheets.set(key,sheet)};
 await registerPlayerSheetsFromPng({HOME:{main:kit(teamColor),gk:kit('#d9e3e7')},[away]:{main:kit(sim.opponent?.color||'#68b4d0'),gk:kit('#dd8095')}},{teams},['HOME',away],{refresh:true,imageDB});
 if(!sim.active)return;
 sim.playerSheets=playerSheets;
 for(const player of sim.players)player._cachedSpriteSheet=null;
}

module.exports={CHARACTERS,FORMATION,FiveMatch,FiveSimulator,configureFive,loadKits};
