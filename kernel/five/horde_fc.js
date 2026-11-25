const {Time}=require('../core/lib/time.js');
const {Utils}=require('../core/lib/utils.js');
const {applyActionLock,canTackleOwner}=require('../core/entities/player.js');
const {usePower}=require('./powers.js');

const NO_UPGRADES=new Set();
const BASH_RANGE=10;
const BASH_SPEED=24;
const WINDUP=.4;

function updateHordeFC(sim){
 const carrier=sim.ball.owner;
 const orcs=sim.teamB.getOutfieldPlayers().filter(player=>player.isOrc);
 if(sim.matchState!=='play'||sim.setPieceType){
  for(const orc of orcs)orc.bargeWindup=null;
  return;
 }
 const target=carrier?.team==='A'&&canTackleOwner(carrier)?carrier:null;
 const winding=orcs.find(orc=>orc.bargeWindup);
 if(winding){
  stepBash(sim,winding,target);
  return;
 }
 if(!target||sim.bargeFlights?.length)return;
 const {width,height}=Utils.getFieldBounds();
 for(const [i,orc] of orcs.entries()){
  if(orc.bargeOpeningAt==null)orc.bargeOpeningAt=Time.time+.65+i;
  if(orc.actionTimer>0||orc.burningUntil>Time.time||orc.isSliding||Time.time<Math.max(orc.powerReadyAt,orc.bargeOpeningAt))continue;
  const distance=Math.hypot(target.x-orc.x,target.y-orc.y);
  if(distance<.45||distance>BASH_RANGE)continue;
  const dx=(target.x-orc.x)/distance,dy=(target.y-orc.y)/distance;
  const wallX=dx>0?(width-.45-orc.x)/dx:dx<0?(.45-orc.x)/dx:Infinity;
  const wallY=dy>0?(height-.45-orc.y)/dy:dy<0?(.45-orc.y)/dy:Infinity;
  const range=Math.max(0,Math.min(BASH_RANGE,wallX,wallY));
  orc.vx=0;orc.vy=0;orc._currentSpeed=0;
  orc.bargeWindup={dx,dy,remaining:range,until:Time.time+WINDUP};
  break;
 }
}
function stepBash(sim,orc,target){
 const bash=orc.bargeWindup;
 if(orc.actionTimer>0||orc.burningUntil>Time.time||sim.ball.owner===orc){
  orc.bargeWindup=null;
  orc.powerReadyAt=Time.time+.65;
  return;
 }
 if(Time.time<bash.until)return;
 const {dx,dy}=bash;
 const step=Math.min(bash.remaining,BASH_SPEED*Time.deltaTime);
 if(target){
  const x=target.x-orc.x,y=target.y-orc.y;
  const forward=x*dx+y*dy,lateral=Math.abs(x*dy-y*dx);
  if(forward>=0&&forward<=step+.55&&lateral<=.95){
   orc.bargeWindup=null;
   usePower(sim,orc,{moveX:dx,moveY:dy},NO_UPGRADES);
   return;
  }
 }
 orc.x+=dx*step;orc.y+=dy*step;
 orc.updateGlobalPos();
 orc.frame=4;
 bash.remaining-=step;
 if(bash.remaining>1e-4)return;
 orc.bargeWindup=null;
 orc.powerReadyAt=Time.time+orc.powerCooldown;
 applyActionLock(orc,.45);
}
module.exports={updateHordeFC};
