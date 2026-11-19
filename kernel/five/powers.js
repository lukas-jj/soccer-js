const {Settings}=require('../settings.js');
const {Time}=require('../core/lib/time.js');
const {Utils}=require('../core/lib/utils.js');
const {SoundDB}=require('../core/lib/sounddb.js');
const {PlayerStates,applyActionLock,canTackleOwner}=require('../core/entities/player.js');
const {humanFacingDir,orientationDir,isBusyKicking,clearManualCharge}=require('../core/lib/manual_control.js');
const {estimatePassGroundSpeed,isPassSafeFromAllOpponents}=require('../core/lib/pass_safety.js');
const {armKickerClaimCooldown}=require('../core/lib/logic_regulator.js');
const {samplePassRoute,predict3D}=require('../core/lib/ball_prediction.js');

const {holdPower01}=require('../core/lib/manual_commands.js');
const {deploySmoke,startBlazeSlide}=require('./hazards.js');

const ARC_BEND_TICKS=6;
const TELE_PASS={name:'Tele-Pass',hint:'Press Space with the ball, aim, then pass with J or left click. Rune teleports to meet the ball.',cooldown:12,icon:'tele',level2:'Press Space, then click two spots to pass and teleport through both.'};
const PORTAL_PASS={name:'Portal Pass',hint:'Press Space with the ball, aim at a touchline, then pass through to the opposite side.',cooldown:12,icon:'portal',level2:'Press Space, aim at a touchline, then pass or hold Shoot and release for a charged portal shot.'};
const GOAL_WARP={name:'Goal Warp',hint:'Hold Space and aim at your own end to move your goal for five seconds.',cooldown:6,icon:'warp',level2:'Hold Space and aim to move either goal for five seconds.'};
const SPIN_KICK={name:'Orc Spin',hint:'Press Space to toe-punt a carried or loose ball and clear nearby hazards.',cooldown:9,icon:'spin',level2:'Press Space to launch the ball and knock back nearby players on both teams.'};
const SMOKE_BOMB={name:'Smoke Bomb',hint:'Press Space to blind enemies in the smoke and make them wander.',cooldown:11,icon:'smoke',level2:'Press Space to drop smoke and move 65% faster for 3.5 seconds.'};
const BLAZE_SLIDE={name:'Blaze Slide',hint:'Aim and press Space to slide tackle. The fire trail makes either team run in panic.',cooldown:10,icon:'blaze'};
const SPIN_RADIUS=3.2,SPIN_DURATION=.38;
const CLASSIC_POWERS={
 price:{name:'Orc Barge',hint:'Aim and press Space to charge through players on either team. Your ball spills ahead.',extra:'charge',cooldown:12,icon:'barge',level2:'Press Space to charge with more knockback and a longer stun. Carrying the ball makes the charge faster and longer.'},
 cole:{name:'Shadow Step',hint:'Hold a direction and press Space to dash.',extra:'shadow',cooldown:8,icon:'dash',level2:'Hold a direction and press Space to dash. Press Space again for a second dash.'},
 mendes:{name:'Swerve',hint:'Press Space, then hold Pass or Shoot. Steer the bend and release to kick.',extra:'swerve',cooldown:10,icon:'arc',level2:'Swerve shots can bend more at full charge.'}
};
const POWERS={...CLASSIC_POWERS,price:SPIN_KICK,mendes:GOAL_WARP};
const RECRUIT_POWERS={
 barge:CLASSIC_POWERS.price,spin:SPIN_KICK,dash:CLASSIC_POWERS.cole,
 arc:CLASSIC_POWERS.mendes,tele:TELE_PASS,portal:PORTAL_PASS,warp:GOAL_WARP,smoke:SMOKE_BOMB,blaze:BLAZE_SLIDE
};
function characterPower(id,drill,recruitPower){
 if(recruitPower!==undefined)return RECRUIT_POWERS[recruitPower];

 if(id==='mendes'&&drill==='tele-pass')return TELE_PASS;
 if(id==='mendes'&&drill==='portal-pass')return PORTAL_PASS;
 if(id==='cole'&&drill==='smoke-bomb')return SMOKE_BOMB;
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
  passTo(sim,player,target,{vx:dx/distance*speed,vy:dy/distance*speed,curveForce:0});
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
 const carryBonus=player?.powerLevel===2&&ball?.owner===player?1.6:0;
 return (upgrades.has('charge')?3.9:3.2)+carryBonus;
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
  return {text:'Orc Barge',sound:impact?'tackle':'pass'};
 }
 if(!impact){
  if(player.team!=='A')applyActionLock(player,.7);
  return {text:'Orc Barge'};
 }
 ball.owner=player;
 ball.syncToOwner();
 player.fsm.changeState(PlayerStates.Dribble);
 player.frame=1;
 const passed=upgrades.has('outlet')&&outlet(sim,player);
 return {text:passed?'Breakaway Outlet':'Orc Barge stunned the carrier',sound:'tackle'};
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
  const speed=player.powerLevel===2&&sim.ball.owner===player?8.3:7;
  sim.bargeCharge={player,dir,remaining:reach,speed,hit:new Set(),started:Time.time,upgrades};
  return {text:'Orc Barge'};
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
 if(sim.matchState!=='play'||sim.setPieceType||player.isSentOff||player.actionTimer>0||player.smokeBlind||player.burningUntil>Time.time){
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
 const duration=.32;
 const upgraded=player.powerLevel===2;
 const knockback=player.bargeKnockback??(upgraded?8.5:4.2);
 const {width,height}=Utils.getFieldBounds();
 const rangeX=dir.x>0?(width-.5-opponent.x)/dir.x:dir.x<0?(.5-opponent.x)/dir.x:Infinity;
 const rangeY=dir.y>0?(height-.5-opponent.y)/dir.y:dir.y<0?(.5-opponent.y)/dir.y:Infinity;
 sim.bargeFlights??=[];
 sim.bargeFlights=sim.bargeFlights.filter(flight=>flight.opponent!==opponent);
 sim.bargeFlights.push({opponent,x:opponent.x,y:opponent.y,dir,
  distance:Math.max(0,Math.min(knockback,rangeX,rangeY)),start:Time.time,duration});
 applyActionLock(opponent,duration+(upgraded?1.1:.45));
 opponent.fsm.changeState(PlayerStates.Idle);
}
function arcFlight(from,target,opponents,curve,side){
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
  const bend=Math.min(distance*.37,curve*.34)*sign;
  const lengths=[0];
  let previous=0;
  for(let i=1;i<=24;i++){
   const sideOffset=bend*Math.sin(Math.PI*i/24)**2;
   lengths.push(lengths[i-1]+Math.hypot(distance/24,sideOffset-previous));
   previous=sideOffset;
  }
  const duration=Math.max(.28,lengths.at(-1)/19+.12);
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
function pickArcTarget(sim,player,cmd){
 const dir=humanFacingDir(player,cmd);
 const from=sim.ball;
 return sim.teamA.players.filter(p=>p!==player&&p.role!=='GK'&&!p.isSentOff)
  .map(p=>{
   const dx=p.x-from.x,dy=p.y-from.y,distance=Math.hypot(dx,dy);
   return {p,distance,alignment:(dx*dir.x+dy*dir.y)/(distance||1)};
  }).filter(p=>p.distance>=3&&p.distance<=22)
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
function tickSpacePower(sim,player,cmd,power){
 const warp=sim.goalWarp;
 if(warp?.steering){
  if(!cmd.powerDown||player!==warp.player||cmd.switchPlayer||cmd.switchKeeper)warp.steering=false;
  else if(!cmd.usePower){
   const target=goalWarpTarget(sim,player,cmd);
   if(target)steerGoalWarp(warp,target);
  }
 }
 if((power===SMOKE_BOMB||power===BLAZE_SLIDE)&&cmd.usePower&&!cmd.switchPlayer&&!cmd.switchKeeper){
  const unavailable=powerUnavailable(sim,player,power);
  if(unavailable)return {text:unavailable,handled:false};
  if(power===SMOKE_BOMB)deploySmoke(sim,player);
  else startBlazeSlide(sim,player,bargeDirection(sim,player,cmd));
  clearManualCharge(sim);
  player._humanInput=null;
  if(!sim.cooldownsOff)player.powerReadyAt=Time.time+player.powerCooldown;
  SoundDB.play(power===SMOKE_BOMB?'lob':'slide');
  return {text:power.name,handled:true};
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
  sim.teleCast={player};
  clearManualCharge(sim);
 }
 const cast=sim.teleCast,ball=sim.ball;
 if(!cast||ball.owner!==player)return null;
 const origin={x:ball.x,y:ball.y};
 const start=cast.first??origin;
 const aim=cast.first&&cmd.directPointerAim
  ? {...cmd,aimX:cmd.aimX+origin.x-start.x,aimY:cmd.aimY+origin.y-start.y}
  : cmd;
 const dir=humanFacingDir(player,aim);
 const distance=aim.directPointerAim?Math.min(10,Math.hypot(aim.aimX,aim.aimY)):8;
 const {width,height}=Utils.getFieldBounds();
 const wallX=dir.x>0?(width-.8-start.x)/dir.x:dir.x<0?(.8-start.x)/dir.x:Infinity;
 const wallY=dir.y>0?(height-.8-start.y)/dir.y:dir.y<0?(.8-start.y)/dir.y:Infinity;
 if(canChargeShot&&cmd.shootDown)cast.shotTicks=(cast.shotTicks??0)+1;
 if(canChargeShot&&cmd.shoot)cast.shotTicks=Math.max(1,cast.shotTicks??0);
 const portalShot=canChargeShot&&cmd.shootReleased&&cast.shotTicks>0&&!cmd.pass;
 const shotPower=portalShot?holdPower01(cast.shotTicks):null;
 const launch=cmd.pass||portalShot;
 const charging=canChargeShot&&cast.shotTicks>0&&!launch;
 if(charging)cmd.shoot=cmd.shootDown=cmd.shootReleased=false;
 if(portalShot)cast.shotTicks=0;
 const range=portal?wallY:Math.max(0,Math.min(distance,wallX,wallY));
 const valid=portal?Number.isFinite(range)&&range>=0&&range<=wallX:range>=2;
 if(!valid){
  cast.end=null;cast.exit=null;
  return launch?{text:portal?'Aim toward a touchline':'Aim farther away',handled:true}
   :cmd.usePower?{text:`${power.name} armed`,handled:false}:null;
 }
 const end={x:start.x+dir.x*range,y:start.y+dir.y*range};
 cast.end=end;
 cast.exit=portal?{x:end.x,y:height-end.y,dx:dir.x,dy:dir.y}:null;
 if(!launch)return cmd.usePower?{text:`${power.name} armed`,handled:false}:null;
 if(power===TELE_PASS&&player.powerLevel===2&&!cast.first){
  cast.first=end;
  cast.end=null;
  return {text:'Pick the second spot',handled:true};
 }
 launchTeleLeg(sim,player,origin,cast.first??end,cast.exit&&{...cast.exit,shot:portalShot,speed:portalShot?14+shotPower*15:24},cast.first?end:null);
 sim.teleCast=null;
 if(!sim.cooldownsOff)player.powerReadyAt=Time.time+player.powerCooldown;
 return {text:power.name,handled:true};
}
function launchTeleLeg(sim,player,start,end,exit,next){
 const dx=end.x-start.x,dy=end.y-start.y,range=Math.hypot(dx,dy);
 const duration=exit?Math.max(.15,range/exit.speed):.22+range/24;
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
  Object.assign(ball,{x,y,z:0});
  ball.kick(entry.vx,entry.vy,entry.vz);
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
  const angle=Math.atan2(dir.y,dir.x)+(Math.random()-.5)*1.75;
  const speed=30+Math.random()*13;
  const lift=roll<.2?8+Math.random()*4:.3+Math.random()*3.5;
  const curve=roll>.72?(Math.random()<.5?-1:1)*(16+Math.random()*10):(Math.random()-.5)*7;
  ball.kick(Math.cos(angle)*speed,Math.sin(angle)*speed,lift,curve);
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
 const xRange=dir.x>0?(maxX-ball.x)/dir.x:dir.x<0?-ball.x/dir.x:Infinity;
 const yRange=dir.y>0?(maxY-ball.y)/dir.y:dir.y<0?-ball.y/dir.y:Infinity;
 const range=Math.min(20,xRange,yRange);
 const charge=Math.min(1,ticks/ARC_BEND_TICKS);
 const curveForce=side*(8+charge*(player.powerLevel===2?8:5));
 const angle=Math.atan2(dir.y,dir.x)-Math.sign(curveForce)*Math.min(.5,Math.max(0,range)*.016*Math.abs(curveForce)/8);
 const {SHOOT_SPEED_BASE=11,SHOOT_SPEED_STAT_SCALE=6}=Settings.physics;
 const speed=SHOOT_SPEED_BASE+(player.effectiveShooting||65)*SHOOT_SPEED_STAT_SCALE/100;
 const kick={vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,vz:1.5,curveForce};
 const sample={...ball,...kick,owner:null,passRoute:null};
 const preview=[{x:ball.x,y:ball.y,z:ball.z}];
 for(let i=1;i<=24;i++){
  const point=predict3D(sample,i*.05);
  preview.push(point);
  if(point.x<=0||point.x>=maxX||point.vx*kick.vx<0||point.vy*kick.vy<0&&point.y<=ball.radius*2)break;
 }
 return {kick,preview,shot:true};
}
function shootArc(sim,player,flight){
 passTo(sim,player,null,flight.kick,false);
 sim.ball.isShot=true;
 sim.arcAssist=null;
 if(!sim.cooldownsOff)player.powerReadyAt=Time.time+player.powerCooldown;
 SoundDB.play('shot');
 return {text:'Swerve Shot',handled:true};
}
function tickArcPass(sim,player,cmd,upgrades){
 let cast=sim.arcCast;
 if(cast&&(cast.player!==player||sim.ball.owner!==player||cmd.switchPlayer)){
  sim.arcCast=null;cast=null;
 }
 if(player.characterId!=='mendes')return null;
 if(cmd.usePower){
  if(cast){sim.arcCast=null;return {text:'Swerve cancelled',handled:!!(cast.target||cast.shot)};}
  const unavailable=powerUnavailable(sim,player,CLASSIC_POWERS.mendes);
  if(unavailable)return {text:unavailable,handled:false};
  if(sim.ball.owner!==player)return {text:'Swerve needs possession',handled:false};
  cast=sim.arcCast={player,ticks:0};
  clearManualCharge(sim);
 }
 if(!cast)return null;
 if(cmd.lob){sim.arcCast=null;return null;}
 if(!cast.target&&(cmd.shoot||cast.shot)){
  const aim=humanFacingDir(player,cmd);
  const shot=cast.shot??={aim,side:aim.y>0?-1:1,ticks:0};
  if(cmd.shootReleased){
   sim.arcCast=null;
   return shootArc(sim,player,shot.flight??arcShotFlight(sim,player,shot.aim,shot.side));
  }
  if(!cmd.shootDown){sim.arcCast=null;return {handled:true};}
  const steer=shot.aim.x*aim.y-shot.aim.y*aim.x;
  if(Math.abs(steer)>.2)shot.side=-Math.sign(steer);
  cast.ticks=++shot.ticks;
  cast.flight=shot.flight=arcShotFlight(sim,player,shot.aim,shot.side,shot.ticks);
  return {handled:true};
 }
 if(player.powerLevel===2&&!cast.target&&!cmd.pass){
  cast.flight=arcShotFlight(sim,player,humanFacingDir(player,cmd));
  return cmd.usePower?{text:'Swerve armed',handled:false}:null;
 }
 const shownFlight=cast.target&&cmd.passReleased?cast.flight:null;
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
 if(cast.target&&Math.abs(cross)>.12)cast.side=-Math.sign(cross);
 const maxCurve=upgrades.has('swerve')?18:15;
 const curve=9+(maxCurve-9)*Math.min(1,cast.ticks/ARC_BEND_TICKS);
 const opponents=sim.teamB.players.filter(p=>!p.isSentOff);
 cast.flight=shownFlight||arcFlight(from,destination,opponents,curve,cast.side)
  ||arcFlight(from,destination,opponents,curve*.7,cast.side)
  ||arcFlight(from,destination,opponents,curve*.45,cast.side);
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
function usePower(sim,player,cmd,upgrades){
 const power=CLASSIC_POWERS[player.characterId];
 if(!power)return 'This player has no special power';
 const unavailable=powerUnavailable(sim,player,power);
 if(unavailable)return unavailable;
 const origin={x:player.x,y:player.y};
 let result;
 if(player.characterId==='price'){
  if(player.team==='A'&&sim.bargeCharge)return 'Orc Barge in progress';
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
module.exports={ARC_BEND_TICKS,POWERS,TELE_PASS,SPIN_KICK,SPIN_RADIUS,SPIN_DURATION,characterPower,usePower,tickArcPass,tickSpacePower,updateTelePass,clearGoalWarp,GOAL_WARP,goalWarpTarget,RECRUIT_POWERS,bargeReach,bargeDirection,clearBargeCharge,updateBargeCharge};
