const {Time}=require('../core/lib/time.js');
const {SoundDB}=require('../core/lib/sounddb.js');
const {Utils}=require('../core/lib/utils.js');
const {clearIfkOnTouch}=require('../core/lib/match_rules.js');
const {samplePassRoute}=require('../core/lib/ball_prediction.js');
const {armKickerClaimCooldown}=require('../core/lib/logic_regulator.js');
const {clearManualCharge,isBusyKicking,orientationDir,applyHumanMovement}=require('../core/lib/manual_control.js');
const {PlayerStates,applyActionLock}=require('../core/entities/player.js');
const {abilityKickAim,abilityKickSpeed}=require('./kick_stats.js');

const CONTACT_PROGRESS=.83;
const TIMING_WINDOW=.17;
const CONTACT_RANGE=2.75;
const RECOVERY=5;
const TEAM_DRILLS={
 'power-shot':{kind:'power',name:'Cross into Power Shot',requirement:'Two outfield players',key:'E',icon:'target',
  hint:'Press E to cross, then press E again or click when the marker turns green.'},
 'cross-header':{kind:'header',name:'Cross into Header',requirement:'Two outfield players',key:'E',icon:'barge',
  hint:'Press E to cross, then press E again or click when the marker turns green.'},
 'overhead-kick':{kind:'overhead',name:'Cross into Overhead Kick',requirement:'Two outfield players',key:'T',icon:'overhead',
  hint:'Press T to cross. Face away from goal with the receiver, then press T or click when the marker turns green. Movement controls turn the receiver during the cross.'}
};

function outfield(sim){
 return sim.teamA.players.filter(p=>p.role!=='GK'&&!p.isSentOff);
}

function teamMoveUnlocks(sim){
 const hasPair=outfield(sim).length>=2;
 const available=sim.practiceTeamMove?[sim.practiceTeamMove.kind]:(sim.teamAbilities??[]);
 return {power:hasPair&&available.includes('power'),header:hasPair&&available.includes('header'),overhead:hasPair&&available.includes('overhead')};
}

function readyPlayer(p){
 return !p.isSentOff&&!(p.actionTimer>0)&&!p.isSliding&&!p.bargeCharging&&!p.bargeWindup
  &&!(p.burningUntil>Time.time)&&!isBusyKicking(p);
}

function attackGoal(sim){
 const {left,right}=sim.getGoals();
 return sim.isSecondHalf()?left:right;
}

function startCross(sim,player,kind){
 const {ball}=sim;
 const unlocked=teamMoveUnlocks(sim);
 if(!unlocked[kind])return outfield(sim).length<2?'Team abilities need two outfield players':'Team ability not learned';
 if(player.role==='GK'||ball.owner!==player)return 'Cross with an outfield player in possession';
 if(sim.setPieceType||!readyPlayer(player))return 'Team move unavailable during this play';
 if(!sim.cooldownsOff&&sim.teamMoveReadyAt>Time.time)return 'Team moves recharging';

 const goal=attackGoal(sim);
 const {width,height}=Utils.getFieldBounds();
 const direction=sim.isSecondHalf()?-1:1;
 const receivers=outfield(sim).filter(p=>p!==player&&readyPlayer(p));
 const score=p=>Math.hypot(p.x-player.x,p.y-player.y)*.55+goal.distanceTo(p.x,p.y)*.45;
 const receiver=receivers.sort((a,b)=>score(a)-score(b))[0];
 if(!receiver)return 'Wait for a teammate to recover';

 const start={x:ball.x,y:ball.y};
 const target={
  x:receiver.x+direction*2,
  y:receiver.y+Math.max(-1.5,Math.min(1.5,(goal.center.y-receiver.y)*.3))
 };
 const dx=target.x-start.x,dy=target.y-start.y,range=Math.hypot(dx,dy)||1;
 const aim=abilityKickAim(player,{x:dx/range,y:dy/range},false);
 const end={
  x:Math.max(.5,Math.min(width-.5,start.x+aim.x*range/CONTACT_PROGRESS)),
  y:Math.max(.5,Math.min(height-.5,start.y+aim.y*range/CONTACT_PROGRESS))
 };
 const distance=Math.hypot(end.x-start.x,end.y-start.y);
 const route={start,end,normal:{x:0,y:0},bend:0,height:kind==='power'?2.5:6.5,
  duration:1,elapsed:0,teamCross:true};
 const meetingPoint=samplePassRoute(route,CONTACT_PROGRESS);
 const runDistance=Math.hypot(meetingPoint.x-receiver.x,meetingPoint.y-receiver.y);
 const flightTime=Math.max(1.35,.7+distance/24);
 const runTime=(.45+runDistance/4)/CONTACT_PROGRESS;
 route.duration=flightTime/abilityKickSpeed(player,1,false)+Math.max(0,runTime-flightTime);
 const contactTime=route.duration*CONTACT_PROGRESS;
 const {vx,vy,vz}=samplePassRoute(route,0);
 ball.kick(vx,vy,vz);
 ball.passRoute=route;
 sim.teamCross={player,receiver,kind,sequence:ball.kickSequence,route,contactTime,meetingPoint};
 sim.teamMoveReadyAt=Time.time+RECOVERY;
 sim.teamA.receivingPlayer=receiver;
 sim._manualPendingReceiver=receiver;
 sim._manualPassSwitchTicks=0;
 receiver.fsm.changeState(PlayerStates.Idle);
 player.fsm.changeState(PlayerStates.Idle);
 player.teamFinishPose={header:false,started:Time.time};
 clearManualCharge(sim);
 SoundDB.play('lob');
 return {header:'Cross for Header',power:'Cross for Power Shot',overhead:'Cross for Overhead Kick'}[kind];
}

function clearCross(sim){
 const cross=sim.teamCross;
 if(!cross)return;
 cross.route.teamCross=false;
 if(sim.teamA.receivingPlayer===cross.receiver)sim.teamA.receivingPlayer=null;
 if(sim._manualPendingReceiver===cross.receiver)sim._manualPendingReceiver=null;
 sim.teamCross=null;
}

function updateTeamCross(sim){
 const {ball}=sim;
 if(ball.pierceOpponent&&(sim.matchState!=='play'||sim.setPieceType||ball.owner
  ||!ball.isShot||Math.hypot(ball.vx,ball.vy)<15))ball.pierceOpponent=null;
 const cross=sim.teamCross;
 if(!cross)return;
 const {route,receiver,sequence,contactTime}=cross;
 const interrupted=sim.matchState!=='play'||sim.setPieceType||receiver.isSentOff
  ||ball.owner||ball.kickSequence!==sequence||(ball.passRoute!==route&&route.elapsed<route.duration);
 if(!interrupted&&route.elapsed<route.duration&&route.elapsed<=contactTime+TIMING_WINDOW)return;
 clearCross(sim);
 return interrupted?'Cross interrupted':'Missed the cross';
}

function facesAwayFromGoal(sim,player){
 const goal=attackGoal(sim);
 const dx=goal.lineX-player.x,dy=goal.center.y-player.y;
 const facing=orientationDir(player);
 return dx*facing.x+dy*facing.y<-.7*Math.hypot(dx,dy);
}

function crossIsReady(sim){
 const cross=sim.teamCross;
 if(!cross)return false;
 const {receiver,route,contactTime,kind}=cross;
 const {ball}=sim;
 const contactHeight=kind==='overhead'?ball.z>=.8&&ball.z<=2.6:ball.z<=(kind==='header'?4.5:1.25);
 if(kind==='overhead'&&!facesAwayFromGoal(sim,receiver))return false;
 return Math.abs(route.elapsed-contactTime)<=TIMING_WINDOW
  &&contactHeight&&Math.hypot(ball.x-receiver.x,ball.y-receiver.y)<=CONTACT_RANGE
  &&readyPlayer(receiver);
}

function pierceOpponent(opponent,nx,ny,side){
 const {width,height}=Utils.getFieldBounds();
 opponent.x=Math.min(width-.45,Math.max(.45,opponent.x-ny*side*3));
 opponent.y=Math.min(height-.45,Math.max(.45,opponent.y+nx*side*3));
 opponent.fsm.changeState(opponent.role==='GK'?PlayerStates.Goalkeeper:PlayerStates.Idle);
 applyActionLock(opponent,.65);
 opponent.updateGlobalPos();
 SoundDB.play('tackle');
}

function finishCross(sim){
 const {ball,teamCross:cross}=sim;
 const {receiver,kind}=cross;
 const goal=attackGoal(sim),dx=goal.lineX-ball.x,dy=goal.center.y-ball.y;
 const distance=Math.hypot(dx,dy)||1;
 const aim=abilityKickAim(receiver,{x:dx/distance,y:dy/distance},true);
 const speed=abilityKickSpeed(receiver,kind==='power'?47:kind==='overhead'?37:30,true);
 ball.kick(aim.x*speed,aim.y*speed,kind==='header'?-1.4:-.35);
 ball.lastKicker=receiver;
 ball.isShot=true;
 sim.onShot?.(receiver);
 clearIfkOnTouch(ball,receiver);
 if(kind==='power')ball.pierceOpponent=pierceOpponent;
 sim.powerEffect={origin:{x:ball.x,y:ball.y},x:ball.x-dx/distance*4,y:ball.y-dy/distance*4,
  color:kind==='power'?'#ffe48b':'#ff917f',until:Time.time+.28};
 armKickerClaimCooldown(receiver,false);
 if(kind==='overhead')receiver.overheadPose={facing:orientationDir(receiver),started:Time.time,duration:.35};
 else receiver.orientation=(Math.round(Math.atan2(dy,dx)/(Math.PI/4))+10)%8;
 if(kind!=='overhead')receiver.teamFinishPose={header:kind==='header',started:Time.time};

 clearCross(sim);
 SoundDB.play(kind==='header'?'header':'shot');
 return {header:'Header!',power:'Power Shot!',overhead:'Overhead Kick!'}[kind];
}

function tickTeamMove(sim,player,cmd){
 if(sim.teamCross){
  const cross=sim.teamCross;
  const finish=cmd.teamMove||cmd.pass||cmd.shoot;
  if(cross.receiver!==player)return {text:null};
  player._humanInput={moveX:cmd.moveX||0,moveY:cmd.moveY||0,sprint:!!cmd.sprint};
  if(cross.kind==='overhead'){
   if(Math.hypot(cmd.moveX,cmd.moveY)>.1){
    player.orientation=(Math.round(Math.atan2(cmd.moveY,cmd.moveX)/(Math.PI/4))+10)%8;
   }
   if(finish&&!facesAwayFromGoal(sim,player))return {text:'Face away from goal for the Overhead Kick'};
  }
  if(!finish)return {text:null};
  if(crossIsReady(sim))return {text:finishCross(sim)};
  return {text:cross.route.elapsed<cross.contactTime?'Too early · wait for green':'Out of reach or too late'};
 }
 if(!cmd.teamMove||sim.lockedHumanPlayer||sim.matchState!=='play')return null;
 const drill=sim.practiceTeamMove?.kind;
 const unlocked=teamMoveUnlocks(sim);
 const kind=cmd.teamMove==='auto'
  ?drill||Object.keys(unlocked).find(key=>unlocked[key])||'power'
  :cmd.teamMove;
 if(sim.practice&&!sim.warmup&&kind!==drill)return {text:null};
 return {text:startCross(sim,player,kind)};
}

function runToTeamCross(sim,player){
 if(sim.teamCross?.receiver!==player||!readyPlayer(player))return false;
 const {moveX=0,moveY=0}=player._humanInput??{};
 if(player.humanControlled&&Math.hypot(moveX,moveY)>.1)return applyHumanMovement(player);
 const orientation=player.orientation;
 player.moveTo(sim.teamCross.meetingPoint,1.15,{arrive:true,deceleration:1});
 if(sim.teamCross.kind==='overhead')player.orientation=orientation;
 return true;
}

module.exports={TEAM_DRILLS,teamMoveUnlocks,tickTeamMove,updateTeamCross,runToTeamCross,crossIsReady,facesAwayFromGoal};
