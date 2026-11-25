const {Time}=require('../core/lib/time.js');
const {Utils}=require('../core/lib/utils.js');
const {SPIN_RADIUS}=require('./powers.js');
const {SoundDB}=require('../core/lib/sounddb.js');
const {applyActionLock}=require('../core/entities/player.js');

const SHOT_SPEED=8;
const WINDUP=.45;
const RELOAD=4.2;
const MAX_RANGE=18;
const HIT_RADIUS=1.05;
const SLOW_DURATION=2;
const STREAKER_SPEED=7;
const SECURITY_RADIUS=1.2;

function updateSlimerSlows(players){
 for(const p of players)p.movementEffectScale=p.slimedUntil > Time.time ? 0.5 : 1;
}

function stepSlimeShots(sim){
 if(!sim.slimeShots)sim.slimeShots=[];
 if(sim.matchState!=='play'||sim.setPieceType){
  sim.slimeShots.length=0;
  return;
 }
 const home=sim.teamA.players.filter(p=>!p.isSentOff);
 const away=sim.teamB.players.filter(p=>!p.isSentOff);
 const {width,height}=Utils.getFieldBounds();
 sim.slimeShots=sim.slimeShots.filter(shot=>{
  const targets=shot.team==='A'?away:home;
  const from={x:shot.x,y:shot.y};
  const step=SHOT_SPEED*Time.deltaTime;
  shot.x+=shot.dx*step;shot.y+=shot.dy*step;shot.distance+=step;
  const gapTo=target=>{
   const along=Math.max(0,Math.min(step,(target.x-from.x)*shot.dx+(target.y-from.y)*shot.dy));
   return Math.hypot(target.x-from.x-shot.dx*along,target.y-from.y-shot.dy*along);
  };
  if(targets.some(target=>target.spinUntil>Time.time&&gapTo(target)<=SPIN_RADIUS))return false;
  for(const target of targets){
   if(gapTo(target)<=HIT_RADIUS){
    target.slimedUntil=Time.time+SLOW_DURATION;
    target.movementEffectScale=.5;
    return false;
   }
  }
  return shot.distance<MAX_RANGE&&shot.x>=0&&shot.x<=width&&shot.y>=0&&shot.y<=height;
 });
}
function updateSlimers(sim){
 stepSlimeShots(sim);
 if(sim.matchState!=='play'||sim.setPieceType){
  for(const slimer of sim.teamB.players){
   slimer.slimeWindup=null;
   slimer.slimeReadyAt=null;
  }
  return;
 }
 const targets=sim.teamA.players.filter(p=>!p.isSentOff);
 sim.teamB.getOutfieldPlayers().filter(player=>!sim.opponent?.lineup||player.isSlimer).forEach((slimer,index)=>{
  if(slimer.isSentOff||slimer.actionTimer>0||slimer.burningUntil>Time.time){
   slimer.slimeWindup=null;
   return;
  }
  if(slimer.slimeWindup){
   if(Time.time<slimer.slimeWindup.fireAt)return;
   const {dx,dy}=slimer.slimeWindup;
   sim.slimeShots.push({x:slimer.x+dx*.45,y:slimer.y+dy*.45,dx,dy,distance:0});
   slimer.slimeWindup=null;
   slimer.slimeReadyAt=Time.time+RELOAD;
   return;
  }
  if(slimer.slimeReadyAt==null)slimer.slimeReadyAt=Time.time+.8+index*.9;
  if(Time.time<slimer.slimeReadyAt)return;
  const target=targets.reduce((nearest,p)=>{
   const distance=Math.hypot(p.x-slimer.x,p.y-slimer.y);
   return distance<nearest.distance?{p,distance}:nearest;
  },{distance:Infinity});
  if(target.distance<.9||target.distance>MAX_RANGE)return;
  slimer.vx=0;slimer.vy=0;slimer._currentSpeed=0;
  slimer.slimeWindup={dx:(target.p.x-slimer.x)/target.distance,dy:(target.p.y-slimer.y)/target.distance,
   fireAt:Time.time+WINDUP};
 });
}

function startStreaker(sim){
 const opponents=sim.teamB.getOutfieldPlayers();
 const {width,height,centerX,centerY}=Utils.getFieldBounds();
 const x=opponents.length?opponents.reduce((sum,p)=>sum+p.x,0)/opponents.length:centerX;
 const y=opponents.some(p=>p.y<centerY)?0:height;
 sim.slimerStreaker={
  x:Math.max(3,Math.min(width-3,x)),y,direction:y===0?1:-1,
  nextShotAt:Time.time,shoved:new Set()
 };
 SoundDB.play('whistle');
}

function stepStreaker(sim){
 const streaker=sim.slimerStreaker;
 if(!streaker)return;
 const {width,height}=Utils.getFieldBounds();
 if(sim.matchState!=='play'||sim.setPieceType||streaker.y<-4||streaker.y>height+4){
  sim.slimerStreaker=null;
  return;
 }
 const {x,direction,shoved}=streaker;
 const previousY=streaker.y;
 const y=streaker.y+=direction*STREAKER_SPEED*Time.deltaTime;
 if(y>=0&&y<=height&&Time.time>=streaker.nextShotAt){
  let target,range=MAX_RANGE;
  for(const opponent of sim.teamB.players){
   if(opponent.isSentOff||opponent.slimedUntil>Time.time)continue;
   const distance=Math.hypot(opponent.x-x,opponent.y-y);
   if(distance>=.1&&distance<range){target=opponent;range=distance;}
  }
  if(target){
   sim.slimeShots??=[];
   sim.slimeShots.push({team:'A',x,y,dx:(target.x-x)/range,dy:(target.y-y)/range,distance:0});
   streaker.nextShotAt=Time.time+.48;
  }
 }
 for(const guard of streakerGuards(streaker)){
  const previousGuardY=guard.y+previousY-y;
  for(const player of sim.players){
   if(player.isSentOff||shoved.has(player))continue;
   const nearestY=Math.max(Math.min(previousGuardY,guard.y),Math.min(Math.max(previousGuardY,guard.y),player.y));
   if(Math.hypot(player.x-guard.x,player.y-nearestY)>SECURITY_RADIUS)continue;
   const side=Math.sign(player.x-guard.x)||Math.sign(guard.x-x);
   player.x=Math.max(.45,Math.min(width-.45,player.x+side*2.4));
   applyActionLock(player,.45);
   player.updateGlobalPos();
   shoved.add(player);
   SoundDB.play('tackle');
  }
 }
}

function streakerGuards({x,y,direction}){
 return [{x:x-.95,y:y-direction*1.8},{x:x+.95,y:y-direction*2.8}];
}

module.exports={updateSlimers,updateSlimerSlows,stepSlimeShots,startStreaker,stepStreaker,streakerGuards};
