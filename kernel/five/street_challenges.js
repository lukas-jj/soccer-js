const {Utils}=require('../core/lib/utils.js');
const {Time}=require('../core/lib/time.js');
const {SoundDB}=require('../core/lib/sounddb.js');
const {Ball}=require('../core/entities/ball.js');
const {PlayerStates,attemptTackle,tryClaimLooseBall,getGoalkeeperBaseX}=require('../core/entities/player.js');
const {tickManualControl,clearManualCharge,isBusyKicking}=require('../core/lib/manual_control.js');
const {tryBallShotBlocking}=require('../core/lib/pass_safety.js');
const {characterPower,usePower,tickSpacePower,clearGoalWarp,clearBargeCharge}=require('./powers.js');
const {CHARACTERS,seededRandom,rollBody}=require('./characters.js');
const {APPEARANCES,playerAppearance}=require('./appearances.js');

const ATTEMPTS=3;
const ATTACK_TIME=10;
const CHECK_TIME=.55;
const TURN_FADE_TIME=.42;
const GOAL_RESULT_TIME=2.35;
const CROSSBAR_REBOUND_TIME=.8;
const CROSSBAR_MISS_TIME=1.35;
const CROSSBAR_DROP_HEIGHT=2.5;
const CHALLENGER_POWERS={price:['barge','blast'],cole:['dash','blaze'],mendes:['clone','blast'],kowalski:['blast','barge'],druid:['wolf','bear']};
const DIFFICULTIES=[
 {name:'Contender',stats:14,speed:.96,reaction:.28},
 {name:'Elite',stats:23,speed:1.04,reaction:.18},
 {name:'Ace',stats:32,speed:1.12,reaction:.10}
];

function rollStreetChallenger(seed){
 const random=seededRandom(seed^0xbee64a95);
 const pick=entries=>entries[Math.floor(random()*entries.length)];
 const character=pick(CHARACTERS);
 const look=pick(APPEARANCES[character.id]??[{name:character.short}]);
 const rolls=random();
 const quality=DIFFICULTIES[rolls<.45?0:rolls<.85?1:2];
 const power=pick(CHALLENGER_POWERS[character.id]);
 return {
  name:look.name.toUpperCase(),color:character.color,characterId:character.id,appearance:look.id,
  body:rollBody(character.id,random),power,quality,bonus:quality.stats,
  stats:Object.fromEntries(Object.entries(character.stats).map(([name,value])=>
   [name,Math.max(10,Math.min(95,value+quality.stats+Math.floor(random()*9)-4))]))
 };
}

class StreetChallenge {
 constructor(match,kind,challenger){
  this.match=match;
  this.kind=kind;
  this.challenger=challenger;
  this.index=0;
  this.hits=0;
  this.done=false;
  const s=match.sim;
  this.goal=s.getGoals().right;
  s.lockedHumanPlayer=match.starter;
  s.manualKeeper=false;
  if(kind==='duel'){
   s.ball.touchlineBoards=true;
   s.ball.endLineGoals={left:{isGoalEvent:()=>false},right:this.goal};
   s.ball.onCrossbarHit=(goal,ball)=>{
    if(this.attacking)s.onCrossbarHit?.(goal,ball);
   };
   this.rival=s.teamB.getOutfieldPlayers()[0];
   this.keeper=s.teamB.getGoalkeeper();
   const {name,characterId,appearance,body,power,stats,quality,color}=challenger;
   Object.assign(this.rival,{
    name,characterId,appearance:playerAppearance(characterId,appearance),
    body,recruitPower:power,powerColor:color,movementScale:quality.speed
   });
   Object.assign(this.rival.stats,stats);
   this.power=characterPower(characterId,null,power);
   this.rival.powerCooldown=this.power.cooldown;
   this.keeper.name='COURT KEEPER';
   this.keeper.stats.goalkeeping=66;
   this.keeper.movementScale=.85;
   this.keeper.neutralKeeper=true;
  }else{
   s.ball.endLineGoals=null;
   this.spentBalls=[];
   this.goal.height=2.44;
   s.onShot=null;
   s.teamB.players.forEach(player=>{player.isSentOff=true;});
   const awardCrossbar=s.onCrossbarHit;
   s.onCrossbarHit=(goal,ball)=>{
    if(!this.done&&this.phase==='shot'&&goal===this.goal&&ball.lastKicker===match.starter){
     awardCrossbar?.(goal,ball);
     this.hits++;
     this.endCrossbarShot('Hit');
    }
   };
  }
  this.resetAttempt();
 }

 get attacking(){return this.index%2===0;}
 get attempt(){return this.kind==='duel'?Math.floor(this.index/2)+1:this.index+1;}
 get transitionCover(){
  if(this.kind!=='duel')return 0;
  const progress=this.phase==='result'?1-(this.nextAt-Time.time)/TURN_FADE_TIME:
   this.phase==='check'&&this.index>0&&!this.restart?1-(Time.time-this.checkStarted)/TURN_FADE_TIME:0;
  const t=Math.max(0,Math.min(1,progress));
  return t*t*(3-2*t);
 }
 get status(){
  if(this.kind==='crossbar'&&this.phase==='rebound')return this.message;
  if(this.phase==='collect')return `Shot ${this.attempt}/3 · Collect the ball at midfield`;
  if(this.phase==='result')return this.message;
  if(this.kind==='crossbar')return `Shot ${this.attempt}/3 · ${this.hits} hits`;
  const action=this.phase==='check'?'Check pass':this.attacking?'Attack':'Defend';
  return `${action} · Round ${this.attempt}/3`;
 }

 resetAttempt(restart=false){
  const {sim:s,starter,input}=this.match;
  const {ball}=s,{centerY}=Utils.getFieldBounds();
  this.celebrationStarted=null;
  clearManualCharge(s);
  clearGoalWarp(s);
  clearBargeCharge(s);
  s.bargeFlights=[];s.clones=[];s.blazeSlides=[];s.blazeTrails=[];s.powerEffect=null;
  s.dropPracticeBall();
  input.reset();
  const place=(player,x,y,orientation=2,state=PlayerStates.Idle)=>{
   player.fsm.changeState(state);
   Object.assign(player,{x,y,z:0,vx:0,vy:0,_currentSpeed:0,orientation,frame:0,
    actionTimer:0,kickerClaimCooldown:0,tackleAttemptCooldown:0,isSliding:false,
    spinUntil:0,beastUntil:0,stepoverPose:null,blazeSliding:false,burningUntil:0,
    shadowAgainUntil:0,nutmegBoostUntil:0,hazardTarget:null,
    gkReleaseCooldown:0,gkClaimTimer:0,gkHoldTimer:0});
   if(!restart){
    player.powerReadyAt=0;
    if(player.sprint)Object.assign(player.sprint,{reserve:1,exhausted:false,recoverAt:0});
   }
   player.updateGlobalPos();
  };
  if(!restart){
   this.started=Time.time;
   this.match.secondsLeft=this.kind==='duel'?ATTACK_TIME:0;
   this.usedPower=false;
  }
  if(this.kind==='crossbar'){
   place(starter,this.goal.lineX-25,centerY,2,PlayerStates.Dribble);
   ball.owner=starter;ball.syncToOwner();
   this.phase='ready';
   return;
  }
  const attacker=this.attacking?starter:this.rival;
  const defender=this.attacking?this.rival:starter;
  this.attacker=attacker;
  this.defender=defender;
  this.lane=this.index%4<2?-1:1;
  place(attacker,this.goal.lineX-23,centerY);
  place(defender,this.goal.lineX-15,centerY,6);
  place(this.keeper,getGoalkeeperBaseX(s,this.keeper.team),centerY,6,PlayerStates.Goalkeeper);
  ball.owner=defender;ball.syncToOwner();
  const start={x:ball.x,y:ball.y},end={x:attacker.x,y:attacker.y};
  ball.kick((end.x-start.x)/CHECK_TIME,(end.y-start.y)/CHECK_TIME,0);
  ball.passRoute={start,end,normal:{x:0,y:0},bend:0,height:0,duration:CHECK_TIME,elapsed:0};
  this.checkStarted=Time.time;
  this.restart=restart;
  this.phase='check';
 }

 endAttempt(message){
  this.phase='result';
  this.message=message;
  this.nextAt=Time.time+(this.celebrationStarted===null?1.2:GOAL_RESULT_TIME);
  this.match.input.reset();
 }

 endCrossbarShot(message){
  this.phase='rebound';
  this.message=message;
  this.nextAt=Time.time+(message==='Hit'?CROSSBAR_REBOUND_TIME:CROSSBAR_MISS_TIME);
 }

 dropCrossbarBall(){
  if(++this.index===ATTEMPTS){this.done=true;return;}
  const {sim:s}=this.match;
  const spent=s.ball;
  spent.destroy();
  this.spentBalls.push(spent);
  const ball=new Ball();
  ball.touchlineBoards=spent.touchlineBoards;
  const {centerX,centerY}=Utils.getFieldBounds();
  Object.assign(ball,{x:centerX,y:centerY});
  s.insertChild(ball);
  ball.z=CROSSBAR_DROP_HEIGHT;
  ball.capturePrevPosition();
  s.ball=ball;
  this.phase='collect';
 }

 advanceCrossbarBall(ball,onHit){
  ball.update();
  if(!this.goal.resolveSweptCrossbar(ball,ball,onHit))this.goal.resolveBallCollisions(ball,onHit);
  const entered=this.goal.isGoalEvent(ball);
  if(entered)ball.crossbarInNet=true;
  if(ball.crossbarInNet&&ball.x>this.goal.netBackX()&&ball.vx>0){
   ball.x=this.goal.netBackX();
   ball.vx*=-.15;
   ball.vy*=.5;
  }
  ball.updateGlobalPos();
  return entered;
 }

 stepCrossbar(s,starter,input){
  const {ball}=s;
  for(const spent of this.spentBalls){
   if(!spent.vx&&!spent.vy&&!spent.vz&&!spent.z)continue;
   this.advanceCrossbarBall(spent);
   // Keep spent balls visible in the area around the court after long misses.
   const x=Math.max(-.5,Math.min(this.goal.lineX+this.goal.renderDepth+.5,spent.x));
   const y=Math.max(-.5,Math.min(ball.maxY+.5,spent.y));
   if(x!==spent.x)spent.vx=0;
   if(y!==spent.y)spent.vy=0;
   spent.x=x;spent.y=y;
   spent.updateGlobalPos();
  }
  const canShoot=this.phase==='ready';
  tickManualControl(s,{keyboard:{pollFrame:()=>{
   const {command}=input.pollFrame();
   return {command:{...command,aimX:command.aimX??1,aimY:command.aimY??0,directPointerAim:true,
    usePower:false,pass:false,passDown:false,passReleased:false,tackleFoot:false,tackleBody:false,
    lob:false,lobDown:false,lobReleased:false,shoot:canShoot&&command.shoot,
    shootDown:canShoot&&command.shootDown,shootReleased:canShoot&&command.shootReleased}};
  }}});
  starter.update();
  starter.updateGlobalPos();
  if(this.phase==='collect'&&ball.owner===starter)this.phase='ready';
  if(canShoot&&!ball.owner){
   this.phase='shot';
   ball.claimable=false;
   this.started=Time.time;
  }
  if(ball.owner||this.phase==='collect'){
   ball.update();
   ball.updateGlobalPos();
   return;
  }
  const entered=this.advanceCrossbarBall(ball,s.onCrossbarHit);
  if(this.phase==='shot'&&(entered||ball.x>this.goal.lineX||ball.vx<0||
   Time.time-this.started>=2.6))this.endCrossbarShot('Miss');
  if(this.phase==='rebound'&&Time.time>=this.nextAt)this.dropCrossbarBall();
 }

 step(){
  if(this.done)return;
  const {sim:s,starter,input}=this.match;
  const {ball}=s;
  if(this.phase==='result'){
   if(Time.time<this.nextAt){
    if(!ball.owner){
     ball.update();
     if(this.celebrationStarted!==null)s.checkGoalNetCollisions();
     ball.updateGlobalPos();
    }
    if(this.celebrationStarted!==null){
     const elapsed=Time.time-this.celebrationStarted;
     this.attacker.frame=12+Math.floor(elapsed*10)%2;
     this.attacker.z=Math.abs(Math.sin(elapsed*Math.PI*3))*.65*(1-this.transitionCover);
     this.attacker.updateGlobalPos();
    }
    return;
   }
   this.index++;
   const attempts=ATTEMPTS*2;
   const clinched=this.index%2===0&&
    Math.abs(s.scoreA-s.scoreB)>ATTEMPTS-this.index/2;
   if(this.index===attempts||clinched)this.done=true;
   else this.resetAttempt();
   return;
  }
  if(this.kind==='duel'&&(this.phase==='live'||this.restart)){
   this.match.secondsLeft=Math.max(0,ATTACK_TIME-(Time.time-this.started));
   if(this.match.secondsLeft<=1e-8){
    this.endAttempt('Time up');
    return;
   }
  }
  if(this.phase==='check'){
   ball.update();ball.updateGlobalPos();
   if(Time.time-this.checkStarted>=CHECK_TIME){
    ball.owner=this.attacker;
    ball.syncToOwner();
    if(this.attacking)this.attacker.fsm.changeState(PlayerStates.Dribble);
    if(!this.restart)this.started=Time.time;
    this.phase='live';
   }
   return;
  }
  if(this.kind==='crossbar'){this.stepCrossbar(s,starter,input);return;}
  tickManualControl(s);
  this.match.updateBargeFlight();
  this.stepRival();
  for(const player of [starter,this.rival,this.keeper]){
   player.update();
   player.updateGlobalPos();
  }
  ball.update();ball.updateGlobalPos();
  const onHit=this.attacking?s.onCrossbarHit:undefined;
  if(!ball.owner&&!this.goal.resolveSweptCrossbar(ball,ball,onHit))this.goal.resolveBallCollisions(ball,onHit);
  tryBallShotBlocking(s);
  s.msgDispatcher?.advanceTick();
  const goal=this.goal.isGoalEvent(ball);
  if(goal&&ball.lastKicker===this.attacker){
   if(this.attacking)s.scoreA++;
   else s.scoreB++;
   this.celebrationStarted=Time.time;
   SoundDB.play('net');
   SoundDB.play('roar');
   this.endAttempt(this.attacking?'Goal!':`${this.rival.name} scores`);
  }else if(goal||ball.owner===this.keeper){
   this.resetAttempt(true);
  }
 }

 stepRival(){
  const {rival,match,power}=this,{sim:s}=match,{ball}=s;
  rival.humanControlled=true;
  rival._humanInput=null;
  if(rival.actionTimer>0||rival.blazeSliding||s.bargeFlights?.some(flight=>flight.opponent===rival)||isBusyKicking(rival))return;
  if(Time.time-this.started<this.challenger.quality.reaction)return;
  const owns=ball.owner===rival;
  const nearGoal=this.goal.lineX-rival.x<11;
  const other=this.attacking?this.attacker:this.defender;
  const separation=Math.hypot(other.x-rival.x,other.y-rival.y);
  const wing=this.goal.center.y+this.lane*5;
  const target=owns?(this.attacking?this.escapeTarget(other):{x:this.goal.lineX-6,y:nearGoal?this.goal.center.y:wing}):
   this.attacking&&ball.owner===other?this.markingTarget(other,separation):ball;
  const dir={moveX:target.x-rival.x,moveY:target.y-rival.y,usePower:true};
  const canCast=power.icon==='blaze'?!owns:power.icon==='clone'?owns:!power.passive;
  if(!this.usedPower&&separation<4.8&&canCast){
   if(power.icon==='barge'||power.icon==='dash')usePower(s,rival,dir,match.upgrades,power);
   else tickSpacePower(s,rival,dir,power);
   this.usedPower=true;
   if(rival.blazeSliding)return;
  }
  if(owns&&!this.attacking&&(nearGoal||Time.time-this.started>8.4)){
   const farSide=this.keeper.y>this.goal.center.y?-1:1;
   rival.shotAim={x:this.goal.lineX,y:this.goal.center.y+farSide*(this.goal.yMax-this.goal.yMin)*.34};
   rival.fsm.changeState(PlayerStates.Shoot);
   return;
  }
  const distance=Math.hypot(dir.moveX,dir.moveY);
  if(owns&&this.attacking&&separation<2.25&&distance>.2){
   // Clear into open court when there isn't room to turn and dribble.
   const dx=dir.moveX/distance,dy=dir.moveY/distance;
   rival.fsm.changeState(PlayerStates.Idle);
   rival.orientation=(Math.round(Math.atan2(dy,dx)/(Math.PI/4))+10)%8;
   rival.frame=5;
   rival.actionTimer=.24;
   ball.syncToOwner();
   ball.kick(dx*12,dy*12,1.5);
   SoundDB.play('lob');
   return;
  }
  if(distance>.2)rival._humanInput={moveX:dir.moveX/distance,moveY:dir.moveY/distance,
   sprint:this.attacking&&(owns?separation<5:separation>4)};
  if(ball.owner===other&&Math.hypot(ball.x-rival.x,ball.y-rival.y)<1.2){
   attemptTackle(rival,ball,'foot');
  }else if(!ball.owner){
   tryClaimLooseBall(rival,ball);
  }
 }

 markingTarget(attacker,separation){
  const {lineX,center}=this.goal;
  const dx=lineX-attacker.x,dy=center.y-attacker.y;
  const length=Math.hypot(dx,dy)||1;
  const cushion=separation<2.6?.22:Math.min(2.5,length*.42);
  return {x:attacker.x+dx/length*cushion,y:attacker.y+dy/length*cushion};
 }

 escapeTarget(attacker){
  const {rival}=this,{width,height}=Utils.getFieldBounds();
  let best=null,bestScore=-Infinity;
  for(let i=0;i<8;i++){
   const angle=i*Math.PI/4;
   const x=rival.x+Math.cos(angle)*4,y=rival.y+Math.sin(angle)*4;
   if(x<2||x>width-4||y<2||y>height-2)continue;
   const clearance=Math.hypot(x-attacker.x,y-attacker.y);
   const edge=Math.min(x,width-x,y,height-y);
   const score=clearance+Math.min(6,edge)*.55+(rival.x-x)*.25;
   if(score>bestScore){
    best={x,y};
    bestScore=score;
   }
  }
  return best??{x:width/2,y:height/2};
 }

 get result(){
  return {home:this.match.sim.scoreA,away:this.match.sim.scoreB,hits:this.hits};
 }
}

module.exports={StreetChallenge,rollStreetChallenger};
