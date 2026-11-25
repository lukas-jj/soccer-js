const {Time}=require('../core/lib/time.js');
const {Utils}=require('../core/lib/utils.js');
const {PlayerStates,attemptTackle}=require('../core/entities/player.js');

const BLAZE_RADIUS=.8;

function startBlazeSlide(sim,player,dir){
 player.fsm.changeState(sim.ball.owner===player?PlayerStates.Dribble:PlayerStates.Idle);
 player.blazeSliding=true;
 player.isSliding=true;
 player.orientation=(Math.round(Math.atan2(dir.y,dir.x)/(Math.PI/4))+10)%8;
 player.frame=4;
 sim.blazeSlides??=[];
 sim.blazeSlides.push({player,dir,remaining:4.3,ignited:new Set()});
}

function slideStep(sim,slide){
 const {player,dir}=slide;
 if(player.isSentOff||player.actionTimer>0||player.burningUntil>Time.time)return false;
 const {width,height}=Utils.getFieldBounds();
 const step=Math.min(slide.remaining,9.5*Time.deltaTime);
 const from={x:player.x,y:player.y};
 player.x=Math.max(.45,Math.min(width-.45,player.x+dir.x*step));
 player.y=Math.max(.45,Math.min(height-.45,player.y+dir.y*step));
 player.z=0;player.frame=4;player.updateGlobalPos();
 const carrier=sim.ball.owner;
 if(carrier&&carrier.team!==player.team&&Math.hypot(carrier.x-player.x,carrier.y-player.y)<1){
  attemptTackle(player,sim.ball,'slide');
  slide.remaining=0;
 }
 if(sim.ball.owner===player)sim.ball.syncToOwner();
 const distance=Math.hypot(player.x-from.x,player.y-from.y);
 if(distance>.01){
  sim.blazeTrails.push({from,to:{x:player.x,y:player.y},owner:player,ignited:slide.ignited,until:Time.time+3});
 }
 slide.remaining-=step;
 return slide.remaining>1e-5&&distance>.01;
}

function distanceToTrail(player,trail){
 const {from,to}=trail,dx=to.x-from.x,dy=to.y-from.y;
 const t=Math.max(0,Math.min(1,((player.x-from.x)*dx+(player.y-from.y)*dy)/(dx*dx+dy*dy)));
 return Math.hypot(player.x-from.x-dx*t,player.y-from.y-dy*t);
}

function startWandering(player){
 player.fsm.changeState(PlayerStates.Idle);
 player._humanInput=null;
 player.isSliding=false;
 player.hazardTarget=null;
}

function updateHazards(sim){
 if(!sim.blazeSlides?.length&&!sim.blazeTrails?.length
    &&!sim.players.some(p=>p.burningUntil>Time.time))return;
 const live=sim.matchState==='play'&&!sim.setPieceType;
 sim.blazeTrails=(sim.blazeTrails??[]).filter(t=>t.until>Time.time);
 sim.blazeSlides=(sim.blazeSlides??[]).filter(slide=>{
  if(live&&slideStep(sim,slide))return true;
  slide.player.blazeSliding=false;slide.player.isSliding=false;
  return false;
 });
 for(const player of sim.players){
  if(player.isSentOff)continue;
  if(!live)continue;
  for(const trail of sim.blazeTrails){
   if(player===trail.owner||trail.ignited.has(player)||distanceToTrail(player,trail)>BLAZE_RADIUS)continue;
   trail.ignited.add(player);
   player.burningUntil=Time.time+2.5;
   startWandering(player);
  }
 }
}

function moveHazardPlayer(player){
 if(player.blazeSliding)return true;
 if(!(player.burningUntil>Time.time))return false;
 const target=player.hazardTarget;
 if(!target||target.until<=Time.time||Math.hypot(target.x-player.x,target.y-player.y)<.45){
  const angle=Math.random()*Math.PI*2;
  const {width,height}=Utils.getFieldBounds();
  player.hazardTarget={x:Math.max(.5,Math.min(width-.5,player.x+Math.cos(angle)*4)),
   y:Math.max(.5,Math.min(height-.5,player.y+Math.sin(angle)*4)),until:Time.time+.45};
 }
 player.actionTimer=0;
 player.moveTo(player.hazardTarget,1.45);
 return true;
}

module.exports={startBlazeSlide,updateHazards,moveHazardPlayer};
