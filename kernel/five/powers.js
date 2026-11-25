const {Settings}=require('../settings.js');
const {Time}=require('../core/lib/time.js');
const {Utils}=require('../core/lib/utils.js');
const {SoundDB}=require('../core/lib/sounddb.js');
const {PlayerStates,applyActionLock,canTackleOwner}=require('../core/entities/player.js');
const {humanFacingDir,orientationDir,isBusyKicking,clearManualCharge}=require('../core/lib/manual_control.js');
const {estimatePassGroundSpeed,isPassSafeFromAllOpponents}=require('../core/lib/pass_safety.js');
const {armKickerClaimCooldown}=require('../core/lib/logic_regulator.js');
const {getGroundFrictionBase,samplePassRoute}=require('../core/lib/ball_prediction.js');

const {holdPower01,slideLaunchDir}=require('../core/lib/manual_commands.js');
const {startBlazeSlide}=require('./hazards.js');
const {createClones}=require('./clones.js');
const {abilityKickAim,abilityKickSpeed}=require('./kick_stats.js');

const ARC_BEND_TICKS=6;
const TELE_PASS={name:'Tele-Pass',hint:'Press Space with the ball, aim, then pass with J or left click. Rune teleports to meet the ball.',cooldown:7,icon:'tele',level2:'Press Space, then click two spots to pass and teleport through both.'};
const PORTAL_PASS={name:'Portal Pass',hint:'Press Space with the ball, aim at a touchline, then pass through to the opposite side.',cooldown:7,icon:'portal',level2:'Press Space to arm. Pass through a sideline, or aim at a sideline or back wall and hold Shoot, then release.'};
const GOAL_WARP={name:'Goal Warp',hint:'Hold Space and aim at your own end to move your goal for five seconds.',cooldown:5.5,icon:'warp',level2:'Hold Space and aim to move either goal for five seconds.'};
const SPIN_KICK={name:'Spin',hint:'Press Space to toe-punt a carried or loose ball and clear nearby hazards.',cooldown:5.5,icon:'spin',level2:'Press Space to launch the ball and knock back nearby players on both teams.'};
const STEPOVER={name:'Stepover',hint:'With the ball, press Space to briefly stun nearby defenders.',cooldown:5.5,icon:'stepover'};
const CLONE={name:'Clone',hint:'With the ball, aim and press Space. A decoy draws players for 1.5 seconds.',level2:'The decoy lasts five seconds.',cooldown:6,icon:'clone'};
const NUTMEG={name:'Nutmeg',hint:'Ground passes aimed between a defender’s legs have a 50% chance to slip through. A nutmeg grants 50% more movement speed for 3 seconds.',level2:'A ground pass has a 50% chance to slip through up to two defenders in its path. Each nutmeg grants 50% more movement speed for 3 seconds.',cooldown:0,passive:true,icon:'nutmeg'};
const BLAST_SHOT={name:'Orc Blast Shot',hint:'Every shot knocks the first defender it hits aside and stuns them for three seconds.',cooldown:0,passive:true,icon:'blast'};
const BLAZE_SLIDE={name:'Blazing Slide',hint:'Move and press Space off the ball to slide tackle in your direction of travel. The fire trail makes either team run in panic.',cooldown:6.5,icon:'blaze'};
const DRUID_FORMS={
 bear:{name:'Bear Form',form:'bear',hint:'Press Space to become a bear and resist tackles for 3 seconds.',cooldown:8,icon:'bear'},
 wolf:{name:'Wolf Form',form:'wolf',hint:'Press Space to become a wolf and move 25% faster for 3 seconds.',cooldown:7,icon:'wolf'},
 eagle:{name:'Eagle Form',form:'eagle',hint:'Press Space to become an eagle for 3 seconds. Shoot while transformed to aim at a corner automatically.',cooldown:8,icon:'eagle'}
};
const SPIN_RADIUS=3.2,SPIN_DURATION=.38;
const CLASSIC_POWERS={
 druid:DRUID_FORMS.bear,
 price:{name:'Barge',hint:'Aim and press Space to charge through players on either team. Your ball spills ahead.',extra:'charge',cooldown:7,icon:'barge',level2:'Press Space to charge with more knockback and a longer stun. Carrying the ball makes the charge faster and longer.'},
 cole:{name:'Shadow Step',hint:'Hold a direction and press Space to dash.',extra:'shadow',cooldown:4.5,icon:'dash',level2:'Hold a direction and press Space to dash. Press Space again for a second dash.'},
 mendes:{name:'Swerve',hint:'Press Space, hold Pass or Shoot, then drag to aim and shape the bend. Release to kick.',extra:'swerve',cooldown:6,icon:'arc',level2:'Swerve shots can bend more at full charge.'}
};
const POWERS={...CLASSIC_POWERS,price:SPIN_KICK,mendes:GOAL_WARP};
const RECRUIT_POWERS={
 barge:CLASSIC_POWERS.price,spin:SPIN_KICK,dash:CLASSIC_POWERS.cole,
 arc:CLASSIC_POWERS.mendes,tele:TELE_PASS,portal:PORTAL_PASS,warp:GOAL_WARP,blaze:BLAZE_SLIDE,blast:BLAST_SHOT,nutmeg:NUTMEG,clone:CLONE,stepover:STEPOVER
};
const STARTER_POWER_POOLS={
 price:['barge','spin','blaze','blast'],
 cole:['dash','nutmeg','stepover'],
 mendes:['arc','tele','portal','warp','clone']
};
function characterPower(id,drill,recruitPower){
 if(recruitPower!==undefined)return RECRUIT_POWERS[recruitPower==='overhead'?'nutmeg':recruitPower]??DRUID_FORMS[recruitPower];

 if(id==='druid'&&Object.hasOwn(DRUID_FORMS,drill))return DRUID_FORMS[drill];
 if(id==='mendes'&&drill==='tele-pass')return TELE_PASS;
 if(id==='mendes'&&drill==='portal-pass')return PORTAL_PASS;
 if(id==='mendes'&&drill==='clone')return CLONE;
 if(id==='cole'&&drill==='stepover')return STEPOVER;
 if(id==='cole'&&drill==='nutmeg')return NUTMEG;
 if(id==='price'&&drill==='blast-shot')return BLAST_SHOT;
 if(id==='price'&&drill==='blaze-slide')return BLAZE_SLIDE;
 return drill===id?CLASSIC_POWERS[id]:POWERS[id];
}
function advance(player,dir,distance){
 const field=Utils.getFieldBounds();
 player.x=Math.max(.45,Math.min(field.width-.45,player.x+dir.x*distance));
 player.y=Math.max(.45,Math.min(field.height-.45,player.y+dir.y*distance));
 player.vx=0;player.vy=0;player._currentSpeed=0;
}
function passTo(sim,player,target,flight,follow=true){
 const ball=sim.ball;
 ball.passFromX=ball.x;ball.passFromY=ball.y;
 ball.kick(flight.vx,flight.vy,flight.vz??0,flight.curveForce);
 if(flight.route)ball.passRoute=flight.route;
 sim.teamA.receivingPlayer=target;
 sim._manualPendingReceiver=follow?target:null;
 sim._manualPassSwitchTicks=0;
 player.fsm.changeState(PlayerStates.Idle);
}
function outlet(sim,player){
 const opponents=sim.teamB.players.filter(p=>!p.isSentOff);
 const from={x:sim.ball.x,y:sim.ball.y};
 const targets=sim.teamA.players.filter(p=>p!==player&&p.role!=='GK'&&!p.isSentOff)
  .sort((a,b)=>Math.hypot(a.x-from.x,a.y-from.y)-Math.hypot(b.x-from.x,b.y-from.y));
 for(const target of targets){
  const dx=target.x-from.x,dy=target.y-from.y,distance=Math.hypot(dx,dy);
  if(distance<3||distance>16)continue;
  const speed=estimatePassGroundSpeed(from,target,player,'short');
  if(!isPassSafeFromAllOpponents(from,target,target,opponents,speed))continue;
  const dir=abilityKickAim(player,{x:dx/distance,y:dy/distance},false);
  passTo(sim,player,target,{vx:dir.x*speed,vy:dir.y*speed,curveForce:0});
  return true;
 }
 return false;
}
function aimFromPlayer(sim,player,cmd){
 const ball=sim.ball;
 return cmd.directPointerAim&&ball.owner?.team==='A'
  ? {...cmd,aimX:cmd.aimX+ball.x-player.x,aimY:cmd.aimY+ball.y-player.y}
  : cmd;
}
function bargeDirection(sim,player,cmd){
 return humanFacingDir(player,aimFromPlayer(sim,player,cmd));
}
function bargeReach(upgrades,player,ball){
 const upgraded=player?.powerLevel===2;
 if(player?.team==='B')return (upgrades.has('charge')?3.9:3.2)+(upgraded&&ball?.owner===player?1.6:0);
 const carryBonus=upgraded&&ball?.owner===player?2.4:0;
 return (upgraded?6.4:5.6)+(upgrades.has('charge')?1:0)+carryBonus;
}
function findBargeImpacts(players,player,dir,reach){
 return players.filter(p=>p!==player&&!p.isSentOff&&canTackleOwner(p)).map(opponent=>{
  const dx=opponent.x-player.x,dy=opponent.y-player.y;
  return {opponent,forward:dx*dir.x+dy*dir.y,lateral:Math.abs(dx*dir.y-dy*dir.x)};
 }).filter(({forward,lateral})=>forward>=0&&forward<=reach+.5&&lateral<=.95)
  .sort((a,b)=>a.forward-b.forward);
}
function finishBarge(sim,player,dir,impact,upgrades){
 const ball=sim.ball;
 if(impact)knockBackBargeTarget(sim,player,impact.opponent,dir);
 if(ball.owner===player){
  const {width,height}=Utils.getFieldBounds();
  ball.x=Math.max(ball.radius,Math.min(width-ball.radius,player.x+dir.x*.8));
  ball.y=Math.max(ball.radius,Math.min(height-ball.radius,player.y+dir.y*.8));
  ball.z=0;
  ball.kick(dir.x*7,dir.y*7,0);
  ball.capturePrevPosition();
  player.fsm.changeState(PlayerStates.Idle);
  return {text:'Barge',sound:impact?'tackle':'pass'};
 }
 if(!impact){
  if(player.team!=='A')applyActionLock(player,.7);
  return {text:'Barge'};
 }
 ball.owner=player;
 ball.syncToOwner();
 player.fsm.changeState(PlayerStates.Dribble);
 player.frame=1;
 const passed=upgrades.has('outlet')&&outlet(sim,player);
 return {text:passed?'Breakaway Outlet':'Barge stunned the carrier',sound:'tackle'};
}
function charge(sim,player,cmd,upgrades){
 const dir=bargeDirection(sim,player,cmd);
 const reach=bargeReach(upgrades,player,sim.ball);
 player.actionTimer=0;player.isSliding=false;player.slideTimer=0;
 if(player.team==='A'){
  player.fsm.changeState(sim.ball.owner===player?PlayerStates.Dribble:PlayerStates.Idle);
  player.bargeCharging=true;
  player.orientation=(Math.round(Math.atan2(dir.y,dir.x)/(Math.PI/4))+10)%8;
  player.z=0;player.frame=1;
 const speed=player.powerLevel===2?(sim.ball.owner===player?14.5:13.2):11.8;
  sim.bargeCharge={player,dir,remaining:reach,speed,hit:new Set(),started:Time.time,upgrades};
  return {text:'Barge'};
 }
 const carrier=sim.ball.owner;
 const impact=carrier&&carrier.team!==player.team?findBargeImpacts([carrier],player,dir,reach)[0]:null;
 advance(player,dir,impact?Math.max(0,impact.forward-.65):reach);
 return finishBarge(sim,player,dir,impact,upgrades);
}
function clearBargeCharge(sim){
 if(!sim.bargeCharge)return;
 sim.bargeCharge.player.bargeCharging=false;
 sim.bargeCharge=null;
}
function updateBargeCharge(sim){
 const barge=sim.bargeCharge;
 if(!barge)return null;
 const {player,dir,upgrades}=barge;
 if(sim.matchState!=='play'||sim.setPieceType||player.isSentOff||player.actionTimer>0||player.burningUntil>Time.time){
  clearBargeCharge(sim);
  return null;
 }
 const step=Math.min(barge.remaining,Time.deltaTime*barge.speed);
 const carrier=sim.ball.owner;
 const opponents=sim.players.filter(p=>!barge.hit.has(p));
 let impact;
 for(const contact of findBargeImpacts(opponents,player,dir,step)){
  const target=contact.opponent;
  if(target===carrier&&target.team!==player.team){
   impact=contact;
   break;
  }
  barge.hit.add(target);
  knockBackBargeTarget(sim,player,target,dir);
  SoundDB.play('tackle');
 }
 const x=player.x,y=player.y;
 advance(player,dir,impact?Math.max(0,Math.min(step,impact.forward-.65)):step);
 player.updateGlobalPos();
 if(sim.ball.owner===player)sim.ball.syncToOwner();
 barge.remaining-=step;
 if(impact||barge.remaining<=1e-6||(step>0&&Math.hypot(player.x-x,player.y-y)<1e-6)){
  clearBargeCharge(sim);
  const result=finishBarge(sim,player,dir,impact,upgrades);
  if(result.sound)SoundDB.play(result.sound);
  return result.text;
 }
 player.frame=1+(Math.floor((Time.time-barge.started)/.09)%2);
 return null;
}
function knockBackBargeTarget(sim,player,opponent,dir){
 const upgraded=player.powerLevel===2;
 const distance=player.bargeKnockback??(player.team==='A'?(upgraded?10:5.5):(upgraded?8.5:4.2));
 const stun=player.team==='A'?(upgraded?1.35:.65):(upgraded?1.1:.45);
 launchKnockback(sim,opponent,dir,distance,stun);
}
function launchKnockback(sim,opponent,dir,distance,stun,duration=.32){
 const {width,height}=Utils.getFieldBounds();
 const rangeX=dir.x>0?(width-.5-opponent.x)/dir.x:dir.x<0?(.5-opponent.x)/dir.x:Infinity;
 const rangeY=dir.y>0?(height-.5-opponent.y)/dir.y:dir.y<0?(.5-opponent.y)/dir.y:Infinity;
 sim.bargeFlights??=[];
 sim.bargeFlights=sim.bargeFlights.filter(flight=>flight.opponent!==opponent);
 sim.bargeFlights.push({opponent,x:opponent.x,y:opponent.y,dir,
  distance:Math.max(0,Math.min(distance,rangeX,rangeY)),start:Time.time,duration});
 applyActionLock(opponent,duration+stun);
 opponent.fsm.changeState(opponent.role==='GK'?PlayerStates.Goalkeeper:PlayerStates.Idle);
}
function launchBlastShot(sim,player){
 sim.ball.onShotBlock=(opponent,nx,ny,side)=>{
  const dir={x:(nx-ny*side)*Math.SQRT1_2,y:(ny+nx*side)*Math.SQRT1_2};
  const knockbackDuration=.18;
  launchKnockback(sim,opponent,dir,1,3-knockbackDuration,knockbackDuration);
  sim.powerEffect={origin:{x:opponent.x,y:opponent.y},x:opponent.x+dir.x,y:opponent.y+dir.y,
   color:player.powerColor||'#ff917f',until:Time.time+.4};
 };
}
function arcFlight(from,target,opponents,curve,side,speed){
 const dx=target.x-from.x,dy=target.y-from.y,distance=Math.hypot(dx,dy);
 const field=Utils.getFieldBounds();
 const forward={x:dx/distance,y:dy/distance};
 const normal={x:-forward.y,y:forward.x};
 const end={x:target.x,y:target.y};
 const screened=opponents.some(p=>{
  const x=p.x-from.x,y=p.y-from.y,along=x*forward.x+y*forward.y;
  return along>1&&along<distance-1&&Math.abs(x*normal.x+y*normal.y)<1.4;
 });
 const flights=[];
 for(const sign of side?[-side]:[-1,1]){
  const bend=Math.min(distance*.54,curve*.48)*sign;
  const lengths=[0];
  let previous=0;
  for(let i=1;i<=24;i++){
   const sideOffset=bend*Math.sin(Math.PI*i/24)**2;
   lengths.push(lengths[i-1]+Math.hypot(distance/24,sideOffset-previous));
   previous=sideOffset;
  }
  const duration=Math.max(.28,lengths.at(-1)/speed+.12);
  const route={start:from,end,normal,bend,duration,lengths,height:screened?.8:.18,elapsed:0};
  const preview=Array.from({length:19},(_,i)=>samplePassRoute(route,duration*i/18));
  if(preview.some(p=>p.x<.15||p.x>field.width-.15||p.y<.15||p.y>field.height-.15))continue;
  let clearance=Infinity;
  for(let i=2;i<preview.length;i++){
   const point=preview[i],time=duration*i/18;
   for(const p of opponents){
    const settle=Math.min(.25,time);
    const gap=Math.hypot(p.x+(p.vx||0)*settle-point.x,p.y+(p.vy||0)*settle-point.y);
    clearance=Math.min(clearance,gap-Math.max(0,time-.22)*1.8);
   }
  }
  flights.push({route,clearance,preview,duration,curveForce:sign*curve,...preview[0]});
 }
 flights.sort((a,b)=>b.clearance-a.clearance);
 return flights[0];
}
function pickArcTarget(sim,player,cmd,minAlignment=-1){
 const dir=humanFacingDir(player,cmd);
 const from=sim.ball;
 return sim.teamA.players.filter(p=>p!==player&&p.role!=='GK'&&!p.isSentOff)
  .map(p=>{
   const dx=p.x-from.x,dy=p.y-from.y,distance=Math.hypot(dx,dy);
   return {p,distance,alignment:(dx*dir.x+dy*dir.y)/(distance||1)};
  }).filter(p=>p.distance>=3&&p.distance<=22&&p.alignment>=minAlignment)
  .sort((a,b)=>Number(b.alignment>=.15)-Number(a.alignment>=.15)
   || (b.alignment-a.alignment)*18+a.distance-b.distance)[0]?.p;
}
function powerUnavailable(sim,player,power){
 if(!sim.cooldownsOff&&player.powerReadyAt>Time.time&&!(power===CLASSIC_POWERS.cole&&player.shadowAgainUntil>Time.time))return `${power.name} recharging`;
 if(sim.matchState!=='play'||sim.setPieceType||
  (power!==CLASSIC_POWERS.price&&(player.actionTimer>0||player.isSliding||isBusyKicking(player)))){
  return 'Power unavailable during this play';
 }
 return '';
}
function clearGoalWarp(sim){
 const warp=sim.goalWarp;
 if(!warp)return;
 if(sim.pitch)sim.pitch.drawLiveGoals=false;
 warp.goal.setCenterY(warp.originalY);
 sim.goalWarp=null;
}
function goalWarpTarget(sim,player,cmd){
 const dir=humanFacingDir(player,aimFromPlayer(sim,player,cmd));
 if(Math.abs(dir.x)<.08)return null;
 const {left,right}=sim.getGoals();
 const goal=dir.x<0?left:right;
 if(player.powerLevel!==2&&goal.defendingTeam(sim.isSecondHalf())!==player.team)return null;
 const half=(goal.yMax-goal.yMin)*.5;
 const {height}=Utils.getFieldBounds();
 const aimY=player.y+dir.y*(goal.lineX-player.x)/dir.x;
 const y=Math.max(half+.5,Math.min(height-half-.5,aimY));
 return {goal,y,half};
}
function steerGoalWarp(warp,{goal,y}){
 if(warp.goal!==goal){
  warp.goal.setCenterY(warp.originalY);
  warp.goal=goal;
  warp.originalY=goal.center.y;
 }
 if(Math.abs(goal.center.y-y)>.01)goal.setCenterY(y);
}
function warpGoal(sim,player,cmd){
 const unavailable=powerUnavailable(sim,player,GOAL_WARP);
 if(unavailable)return {text:unavailable,handled:false};
 const target=goalWarpTarget(sim,player,cmd);
 if(!target)return {text:player.powerLevel===2?'Aim toward either goal line':'Aim toward your own goal line',handled:false};
 clearGoalWarp(sim);
 const {goal}=target;
 const warp={goal,originalY:goal.center.y,until:Time.time+5,player,steering:cmd.powerDown};
 sim.goalWarp=warp;
 if(sim.pitch){
  sim.pitch.drawLiveGoals=true;
  sim.pitch.invalidateRenderCache();
 }
 steerGoalWarp(warp,target);
 if(!sim.cooldownsOff)player.powerReadyAt=Time.time+player.powerCooldown;
 SoundDB.play('lob');
 return {text:'Goal Warp · 5s',handled:false};
}
function wallDistances(start,dir,width,height){
 return {
  x:dir.x>0?(width-.8-start.x)/dir.x:dir.x<0?(.8-start.x)/dir.x:Infinity,
  y:dir.y>0?(height-.8-start.y)/dir.y:dir.y<0?(.8-start.y)/dir.y:Infinity
 };
}
function portalAim(sim,dir,canUseBackWall){
 const {ball}=sim;
 const {width,height}=Utils.getFieldBounds();
 const walls=wallDistances(ball,dir,width,height);
 const backWall=canUseBackWall&&walls.x<walls.y;
 const range=backWall?walls.x:walls.y;
 if(!Number.isFinite(range)||range<=0||range>walls.x)return null;
 const end={x:ball.x+dir.x*range,y:ball.y+dir.y*range};
 if(backWall&&Object.values(sim.getGoals()).some(goal=>end.y>=goal.yMin-ball.radius&&end.y<=goal.yMax+ball.radius))return null;
 return {end,backWall,exit:{x:backWall?width-end.x:end.x,y:backWall?end.y:height-end.y,dx:dir.x,dy:dir.y}};
}

function tickSpacePower(sim,player,cmd,power){
 if(power?.form&&cmd.usePower&&!cmd.switchPlayer&&!cmd.switchKeeper){
  const unavailable=powerUnavailable(sim,player,power);
  if(unavailable)return {text:unavailable,handled:false};
  player.beastForm=power.form;
  player.beastUntil=Time.time+3;
  if(!sim.cooldownsOff)player.powerReadyAt=Time.time+player.powerCooldown;
  SoundDB.play('lob');
  return {text:power.name,handled:false};
 }
 const warp=sim.goalWarp;
 if(warp?.steering){
  if(!cmd.powerDown||player!==warp.player||cmd.switchPlayer||cmd.switchKeeper)warp.steering=false;
  else if(!cmd.usePower){
   const target=goalWarpTarget(sim,player,cmd);
   if(target)steerGoalWarp(warp,target);
  }
 }
 if((power===BLAZE_SLIDE||power===CLONE||power===STEPOVER)&&cmd.usePower&&!cmd.switchPlayer&&!cmd.switchKeeper){
  const unavailable=powerUnavailable(sim,player,power);
  if(unavailable)return {text:unavailable,handled:false};
  if(power===STEPOVER){
   if(sim.ball.owner!==player)return {text:'Stepover needs possession',handled:false};
   for(const defender of sim.teamB.players){
    if(defender.isSentOff||Math.hypot(defender.x-player.x,defender.y-player.y)>2.3)continue;
    defender.fsm.changeState(PlayerStates.Idle);
    applyActionLock(defender,Math.max(defender.actionTimer,.8));
   }
   player.stepoverPose={started:Time.time,orientation:player.orientation};
  }
  else if(power===CLONE){
   if(sim.ball.owner!==player)return {text:'Clone needs possession',handled:false};
   createClones(sim,player,cmd);
  }
  else {
   if(sim.ball.owner===player)return {text:'Blazing Slide requires playing off the ball',handled:false};
   const lastMove=player._humanInput;
   const facing=slideLaunchDir(player,lastMove,null,orientationDir(player));
   startBlazeSlide(sim,player,slideLaunchDir(player,cmd,null,facing));
  }
  clearManualCharge(sim);
  player._humanInput=null;
  if(!sim.cooldownsOff)player.powerReadyAt=Time.time+player.powerCooldown;
  SoundDB.play(power===BLAZE_SLIDE?'slide':'lob');
  return {text:power.name,handled:power!==CLONE&&power!==STEPOVER};
 }
 if(power===GOAL_WARP&&cmd.usePower&&!cmd.switchPlayer&&!cmd.switchKeeper)return warpGoal(sim,player,cmd);
 if(cmd.usePower&&!cmd.switchPlayer&&!cmd.switchKeeper&&power===SPIN_KICK){
  const unavailable=powerUnavailable(sim,player,SPIN_KICK);
  if(unavailable)return {text:unavailable,handled:false};
  return spinKick(sim,player,cmd);
 }
 if(power!==TELE_PASS&&power!==PORTAL_PASS)return null;
 const portal=power===PORTAL_PASS;
 const canChargeShot=portal&&player.powerLevel===2;
 if(cmd.switchPlayer||cmd.switchKeeper||cmd.lob||(cmd.shoot&&!canChargeShot&&!cmd.pass)){
  sim.teleCast=null;
  return null;
 }
 if(cmd.usePower){
  if(sim.teleCast){
   sim.teleCast=null;
   return {text:`${power.name} cancelled`,handled:false};
  }
  const unavailable=powerUnavailable(sim,player,power);
  if(unavailable)return {text:unavailable,handled:false};
  if(sim.ball.owner!==player)return {text:`${power.name} needs possession`,handled:false};
  sim.arcCast=null;
  sim.teleCast={player,portal,aimRoll:Math.random()};
  clearManualCharge(sim);
 }
 const cast=sim.teleCast,ball=sim.ball;
 if(!cast||ball.owner!==player)return null;
 const origin={x:ball.x,y:ball.y};
 const start=cast.first??origin;
 const aim=cast.first&&cmd.directPointerAim
  ? {...cmd,aimX:cmd.aimX+origin.x-start.x,aimY:cmd.aimY+origin.y-start.y}
  : cmd;
 const intendedDir=humanFacingDir(player,aim);
 if(canChargeShot&&cmd.shootDown)cast.shotTicks=(cast.shotTicks??0)+1;
 if(canChargeShot&&cmd.shoot)cast.shotTicks=Math.max(1,cast.shotTicks??0);
 const portalShot=canChargeShot&&cmd.shootReleased&&cast.shotTicks>0&&!cmd.pass;
 const shotPower=portalShot?holdPower01(cast.shotTicks):null;
 const launch=cmd.pass||portalShot;
 const charging=canChargeShot&&cast.shotTicks>0&&!launch;
 if(charging)cmd.shoot=cmd.shootDown=cmd.shootReleased=false;
 if(portalShot)cast.shotTicks=0;
 const dir=abilityKickAim(player,intendedDir,portalShot||charging,()=>cast.aimRoll);
 const preview=portal?portalAim(sim,dir,canChargeShot):null;
 let end=preview?.end;
 if(!portal){
  const distance=aim.directPointerAim?Math.min(10,Math.hypot(aim.aimX,aim.aimY)):8;
  const {width,height}=Utils.getFieldBounds();
  const walls=wallDistances(start,dir,width,height);
  const range=Math.min(distance,walls.x,walls.y);
  if(range>=2)end={x:start.x+dir.x*range,y:start.y+dir.y*range};
 }
 if(!end){
  cast.end=null;cast.exit=null;
  return launch?{text:portal?(canChargeShot?'Aim at a sideline or back wall outside the goal':'Aim toward a touchline'):'Aim farther away',handled:true}
   :cmd.usePower?{text:`${power.name} armed`,handled:false}:null;
 }
 cast.end=end;
 cast.exit=preview?.exit??null;
 if(preview?.backWall&&cmd.pass)return {text:'Hold Shoot to use a back-wall portal',handled:true};
 if(!launch)return cmd.usePower?{text:`${power.name} armed`,handled:false}:null;
 if(power===TELE_PASS&&player.powerLevel===2&&!cast.first){
  cast.first=end;
  cast.end=null;
  return {text:'Pick the second spot',handled:true};
 }
 launchTeleLeg(sim,player,origin,cast.first??end,cast.exit&&{...cast.exit,shot:portalShot,speed:abilityKickSpeed(player,portalShot?14+shotPower*15:24,portalShot)},cast.first?end:null);
 sim.teleCast=null;
 if(!sim.cooldownsOff)player.powerReadyAt=Time.time+player.powerCooldown;
 return {text:power.name,handled:true};
}
function launchTeleLeg(sim,player,start,end,exit,next){
 const dx=end.x-start.x,dy=end.y-start.y,range=Math.hypot(dx,dy);
 const duration=exit?range/exit.speed:.22+range/abilityKickSpeed(player,24,false);
 const route={start,end,normal:{x:0,y:0},bend:0,duration,height:0,elapsed:0};
 passTo(sim,player,null,{route,...samplePassRoute(route,0)},false);
 player._humanInput=null;
 player.kickerClaimCooldown=Math.max(player.kickerClaimCooldown,duration+Time.deltaTime);
 sim.teleFlight={player,route,exit,next,kickSequence:sim.ball.kickSequence};
 SoundDB.play('lob');
}
function updateTelePass(sim){
 const ball=sim.ball;
 if(sim.teleCast&&(ball.owner!==sim.teleCast.player||sim.matchState!=='play'||sim.setPieceType))sim.teleCast=null;
 const flight=sim.teleFlight;
 if(!flight)return;
 const {player,route,kickSequence}=flight;
 if(ball.owner||ball.kickSequence!==kickSequence||sim.matchState!=='play'||sim.setPieceType||player.isSentOff){
  sim.teleFlight=null;
  return;
 }
 if(route.elapsed<route.duration){
  if(ball.passRoute!==route)sim.teleFlight=null;
  return;
 }
 sim.teleFlight=null;
 if(flight.exit){
  const {x,y,shot}=flight.exit;
  const entry=samplePassRoute(route,0);
  // The scripted approach skips ground friction. Carry that speed loss into the exit pass.
  const retainedSpeed=shot?1:Math.pow(getGroundFrictionBase(),route.duration);
  Object.assign(ball,{x,y,z:0});
  ball.kick(entry.vx*retainedSpeed,entry.vy*retainedSpeed,entry.vz);
  ball.lastKicker=player;ball.isShot=!!shot;
  ball.capturePrevPosition();
  armKickerClaimCooldown(player,false);
  SoundDB.play('lob');
  sim.portalFlash={entry:route.end,exit:flight.exit,until:Time.time+.55};
  return;
 }
 const origin={x:player.x,y:player.y};
 Object.assign(player,{x:ball.x,y:ball.y,z:0,vx:0,vy:0,_currentSpeed:0,kickerClaimCooldown:0});
 ball.owner=player;
 player.fsm.changeState(PlayerStates.Dribble);
 ball.syncToOwner();
 SoundDB.play('lob');
 sim.powerEffect={origin,x:player.x,y:player.y,color:player.powerColor,until:Time.time+.48};
 if(flight.next)launchTeleLeg(sim,player,{x:ball.x,y:ball.y},flight.next,null,null);
}
function spinKick(sim,player,cmd){
 const ball=sim.ball;
 const dir=humanFacingDir(player,cmd);
 const canKick=ball.owner===player||(!ball.owner&&ball.z<=1.65&&Math.hypot(ball.x-player.x,ball.y-player.y)<=SPIN_RADIUS);
 if(canKick){
  const roll=Math.random();
  const aim=abilityKickAim(player,dir,true,Math.random,.012);
  const speed=abilityKickSpeed(player,30+Math.random()*13,true);
  const lift=roll<.2?8+Math.random()*4:.3+Math.random()*3.5;
  const curve=roll>.72?(Math.random()<.5?-1:1)*(16+Math.random()*10):(Math.random()-.5)*7;
  ball.kick(aim.x*speed,aim.y*speed,lift,curve);
  armKickerClaimCooldown(player,false);
  ball.lastKicker=player;
  ball.isShot=true;
  sim.teamA.receivingPlayer=null;sim._manualPendingReceiver=null;
  player.fsm.changeState(PlayerStates.Idle);
 }
 clearManualCharge(sim);
 player._humanInput=null;
 player.spinUntil=Time.time+SPIN_DURATION;
 if(player.powerLevel===2){
  for(const target of sim.players){
   if(target===player||target.isSentOff)continue;
   const dx=target.x-player.x,dy=target.y-player.y,distance=Math.hypot(dx,dy);
   if(distance>SPIN_RADIUS)continue;
   const away=distance>.01?{x:dx/distance,y:dy/distance}:dir;
   advance(target,away,3.4);
   applyActionLock(target,.28);
   if(ball.owner===target)ball.syncToOwner();
  }
 }
 if(!sim.cooldownsOff)player.powerReadyAt=Time.time+player.powerCooldown;
 SoundDB.play(canKick?'lob':'slide');
 return {text:SPIN_KICK.name,handled:true};
}
function arcShotFlight(sim,player,dir,side=dir.y>0?-1:1,ticks=0){
 const ball=sim.ball;
 const {maxX,maxY}=ball;
 const xRange=dir.x>0?(maxX+ball.radius-ball.x)/dir.x:dir.x<0?(-ball.radius-ball.x)/dir.x:Infinity;
 const yRange=dir.y>0?(maxY-ball.radius-ball.y)/dir.y:dir.y<0?(ball.radius-ball.y)/dir.y:Infinity;
 const range=Math.max(.15,Math.min(32,xRange,yRange));
 const charge=Math.min(1,ticks/ARC_BEND_TICKS);
 const normal={x:-dir.y,y:dir.x};
 let bend=Math.min(7,range*(.15+charge*(player.powerLevel===2?.19:.15)));
 // Keep the opening bend on the pitch even when aiming close to a touchline.
 for(let i=1;i<12;i++){
  const t=i/12,progress=.58*t,weight=Math.sin(Math.PI*t)**2;
  const x=ball.x+dir.x*range*progress,y=ball.y+dir.y*range*progress;
  const sx=normal.x*side,sy=normal.y*side;
  if(sx)bend=Math.min(bend,((sx>0?maxX:0)-x)/(sx*weight));
  if(sy)bend=Math.min(bend,((sy>0?maxY:0)-y)/(sy*weight));
 }
 bend=Math.max(0,bend)*side;
 const {SHOOT_SPEED_BASE=11,SHOOT_SPEED_STAT_SCALE=6}=Settings.physics;
 const speed=SHOOT_SPEED_BASE+(player.effectiveShooting||65)*SHOOT_SPEED_STAT_SCALE/100;
 const route={
  start:{x:ball.x,y:ball.y,z:ball.z},
  end:{x:ball.x+dir.x*range,y:ball.y+dir.y*range},
  normal,bend,duration:range/speed,height:.42,elapsed:0,shot:true
 };
 const preview=Array.from({length:Math.ceil(route.duration/.05)+1},(_,i)=>samplePassRoute(route,i*.05));
 return {route,preview,shot:true,kick:{...preview[0],route}};
}
function shootArc(sim,player,flight){
 passTo(sim,player,null,flight.kick,false);
 sim.ball.isShot=true;
 sim.arcAssist=null;
 if(!sim.cooldownsOff)player.powerReadyAt=Time.time+player.powerCooldown;
 SoundDB.play('shot');
 return {text:'Swerve Shot',handled:false};
}
function tickArcPass(sim,player,cmd,upgrades){
 let cast=sim.arcCast;
 if(cast&&(cast.player!==player||sim.ball.owner!==player||cmd.switchPlayer)){
  sim.arcCast=null;cast=null;
 }
 if(cmd.usePower){
  if(cast){sim.arcCast=null;return {text:'Swerve cancelled',handled:!!(cast.target||cast.shot)};}
  const unavailable=powerUnavailable(sim,player,CLASSIC_POWERS.mendes);
  if(unavailable)return {text:unavailable,handled:false};
  if(sim.ball.owner!==player)return {text:'Swerve needs possession',handled:false};
  cast=sim.arcCast={player,ticks:0,aimRoll:Math.random()};
  clearManualCharge(sim);
 }
 if(!cast)return null;
 if(cmd.lob){sim.arcCast=null;return null;}
 if(!cast.target&&(cmd.shoot||cast.shot)){
  const aim=humanFacingDir(player,cmd);
  const shot=cast.shot??={initialAim:aim,aim,side:aim.y>0?-1:1,ticks:0};
  const {shootReleased,shootDown}=cmd;
  cmd.shoot=cmd.shootDown=cmd.shootReleased=cmd.tackleBody=false;
  cmd.pass=cmd.passDown=cmd.passReleased=cmd.tackleFoot=false;
  if(shootReleased){
   sim.arcCast=null;
   return shootArc(sim,player,shot.flight??arcShotFlight(sim,player,abilityKickAim(player,shot.aim,true,()=>cast.aimRoll),shot.side,shot.ticks));
  }
  if(!shootDown){sim.arcCast=null;return {handled:false};}
  const steer=shot.initialAim.x*aim.y-shot.initialAim.y*aim.x;
  if(Math.abs(steer)>.035)shot.side=Math.sign(steer);
  shot.aim=aim;
  cast.ticks=++shot.ticks;
  cast.flight=shot.flight=arcShotFlight(sim,player,abilityKickAim(player,shot.aim,true,()=>cast.aimRoll),shot.side,shot.ticks);
  return {handled:false};
 }
 if(player.powerLevel===2&&!cast.target&&!cmd.pass){
  cast.flight=arcShotFlight(sim,player,abilityKickAim(player,humanFacingDir(player,cmd),true,()=>cast.aimRoll));
  return cmd.usePower?{text:'Swerve armed',handled:false}:null;
 }
 const shownFlight=cast.target&&cmd.passReleased?cast.flight:null;
 if(cast.target&&cmd.passDown&&cmd.directPointerAim){
  const aimed=pickArcTarget(sim,player,cmd,.985);
  if(aimed&&aimed!==cast.target){cast.target=aimed;cast.side=null;}
 }
 const teammate=cast.target||pickArcTarget(sim,player,cmd);
 const solo=(!teammate||teammate===player)&&sim.teamA.getOutfieldPlayers().length===1;
 const target=teammate||(solo?player:null);
 cast.previewTarget=target===player?null:target;
 if(!target){
  cast.flight=null;
  return cmd.pass?{text:'Aim at a teammate in passing range',handled:true}
   :cmd.usePower?{text:'Swerve armed',handled:false}:null;
 }
 if(cmd.pass)cast.target=target;
 if(cast.target&&!cmd.passDown&&!cmd.passReleased){sim.arcCast=null;return {handled:true};}
 if(cast.target&&cmd.passDown)cast.ticks++;
 const from={x:sim.ball.x,y:sim.ball.y};
 const dir=humanFacingDir(player,cmd);
 const field=Utils.getFieldBounds();
 const destination=solo?{
  x:Math.max(.4,Math.min(field.width-.4,from.x+dir.x*5)),
  y:Math.max(.4,Math.min(field.height-.4,from.y+dir.y*5))
 }:target;
 const dx=destination.x-from.x,dy=destination.y-from.y,distance=Math.hypot(dx,dy);
 if(target.isSentOff||distance<2){
  sim.arcCast=null;return {text:'Aim at a teammate in passing range',handled:!!cast.target};
 }
 const cross=(dx*dir.y-dy*dir.x)/distance;
 if(cast.target&&Math.abs(cross)>.045)cast.side=-Math.sign(cross);
 const maxCurve=upgrades.has('swerve')?23:20;
 const curve=10+(maxCurve-10)*Math.min(1,cast.ticks/ARC_BEND_TICKS);
 const opponents=sim.teamB.players.filter(p=>!p.isSentOff);
 const passAim=abilityKickAim(player,{x:dx/distance,y:dy/distance},false,()=>cast.aimRoll,.0015);
 const landing={
  x:Math.max(.15,Math.min(field.width-.15,from.x+passAim.x*distance)),
  y:Math.max(.15,Math.min(field.height-.15,from.y+passAim.y*distance))
 };
 const speed=abilityKickSpeed(player,19,false);
 cast.flight=shownFlight||arcFlight(from,landing,opponents,curve,cast.side,speed)
  ||arcFlight(from,landing,opponents,curve*.7,cast.side,speed)
  ||arcFlight(from,landing,opponents,curve*.45,cast.side,speed);
 if(!cast.target)return cmd.usePower?{text:'Swerve armed',handled:false}:null;
 if(!cmd.passReleased)return {handled:true};
 sim.arcCast=null;
 if(!cast.flight)return {text:'No room for that bend',handled:true};
 passTo(sim,player,target,cast.flight,!sim.practice&&!solo);
 if(!sim.practice&&!isBusyKicking(target)&&target.actionTimer<=0)target.fsm.changeState(PlayerStates.Idle);
 sim.arcAssist={receiver:target,wizard:player,until:Time.time+8,
  practiceReturnAt:Time.time+cast.flight.duration+.4,
  receiveAt:Time.time+cast.flight.duration+(solo?.55:0),landing:cast.flight.preview.at(-1),trail:[from]};
 if(!sim.cooldownsOff)player.powerReadyAt=Time.time+player.powerCooldown;
 SoundDB.play('lob');
 return {text:'Swerve Pass',handled:true};
}
function usePower(sim,player,cmd,upgrades,power=CLASSIC_POWERS[player.characterId]){
 if(!power)return 'This player has no special power';
 const unavailable=powerUnavailable(sim,player,power);
 if(unavailable)return unavailable;
 const origin={x:player.x,y:player.y};
 let result;
 if(power.icon==='barge'){
  if(player.team==='A'&&sim.bargeCharge)return 'Barge in progress';
  result=charge(sim,player,cmd,upgrades);
 }
 else{
  const facing=orientationDir(player);
  const dir=Math.hypot(cmd.moveX,cmd.moveY)>.1
   ? humanFacingDir(player,{moveX:cmd.moveX,moveY:cmd.moveY})
   : {x:-facing.y,y:facing.x};
  advance(player,dir,upgrades.has('shadow')?5.7:4.6);
  if(player.powerLevel===2){
   if(player.shadowAgainUntil>Time.time)player.shadowAgainUntil=0;
   else player.shadowAgainUntil=Time.time+1.25;
  }
  if(sim.ball.owner===player)sim.ball.syncToOwner();
  if(upgrades.has('second-wind'))Object.assign(player.sprint,{reserve:1,exhausted:false,recoverAt:0});
  result={text:'Shadow Step',sound:'slide'};
 }
 if(typeof result==='string')return result;
 if(!sim.cooldownsOff)player.powerReadyAt=Time.time+player.powerCooldown;
 player._humanInput=null;
 if(player.team==='A'||sim.ball.owner===player)clearManualCharge(sim);
 if(result.sound)SoundDB.play(result.sound);
 if(!sim.bargeCharge||sim.bargeCharge.player!==player){
  sim.powerEffect={origin,x:player.x,y:player.y,color:player.powerColor,until:Time.time+.48};
 }
 return result;
}
module.exports={portalAim,DRUID_FORMS,STARTER_POWER_POOLS,launchBlastShot,ARC_BEND_TICKS,POWERS,TELE_PASS,SPIN_KICK,SPIN_RADIUS,SPIN_DURATION,characterPower,usePower,tickArcPass,tickSpacePower,updateTelePass,clearGoalWarp,GOAL_WARP,goalWarpTarget,RECRUIT_POWERS,bargeReach,bargeDirection,clearBargeCharge,updateBargeCharge};
