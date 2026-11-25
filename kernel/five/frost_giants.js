const {Time}=require('../core/lib/time.js');
const {isBusyKicking}=require('../core/lib/manual_control.js');

const ICE_RADIUS=1.15;
const ICE_LIFETIME=4.5;
const ICE_BALL_FRICTION=1;
const GIANT_SPEED=.62;
const GIANT_BODY={width:1.28,height:1.22};
const GIANT_COLORS={skin:'#71b6e4',skinShadow:'#3c73a5',skinHighlight:'#b1d9f3',hair:'#e2eef7'};

function updateIceTrails(sim,giants){
 const live=sim.matchState==='play'&&!sim.setPieceType;
 sim.iceTrails=sim.iceTrails.filter(trail=>trail.until>Time.time);
 for(const giant of giants){
  if(!live||giant.isSentOff){
   giant.iceTrailStart=null;
   continue;
  }
  const to={x:giant.x,y:giant.y};
  const from=giant.iceTrailStart??to;
  const distance=Math.hypot(to.x-from.x,to.y-from.y);
  if(distance>=.55&&distance<=2.5)sim.iceTrails.push({from,to,until:Time.time+ICE_LIFETIME});
  if(!giant.iceTrailStart||distance>=.55)giant.iceTrailStart=to;
 }
}

function isOnIce(sim,x,y){
 return sim.iceTrails.some(({from,to})=>{
  const dx=to.x-from.x,dy=to.y-from.y;
  const t=Math.max(0,Math.min(1,((x-from.x)*dx+(y-from.y)*dy)/(dx*dx+dy*dy)));
  return Math.hypot(x-from.x-dx*t,y-from.y-dy*t)<=ICE_RADIUS;
 });
}

function iceBallFriction(sim,x,y){
 if(sim.matchState==='play'&&!sim.setPieceType&&isOnIce(sim,x,y))return ICE_BALL_FRICTION;
}

function applyIceTraction(sim,player,startX,startY){
 if(sim.matchState!=='play'||sim.setPieceType||player.isFrostGiant||player.actionTimer>0
    ||player.isSliding||player.z>0||isBusyKicking(player)||player.gkDiveTimer>0){
  player.iceMotion=null;
  return;
 }
 let dx=player.x-startX,dy=player.y-startY;
 if(isOnIce(sim,startX,startY)){
  const previous=player.iceMotion;
  const momentum=previous?Math.hypot(previous.dx,previous.dy):0;
  if(momentum>.001&&Time.time-previous.at<=Time.deltaTime*1.5){
   const requested=Math.hypot(dx,dy);
   let heading=Math.atan2(previous.dy,previous.dx);
   if(requested>.001){
    const turn=Math.atan2(dy,dx)-heading;
    const correction=Math.atan2(Math.sin(turn),Math.cos(turn));
    // Follow small corrections immediately; carry momentum through sharp turns.
    heading+=Math.abs(correction)<=Math.PI/6?correction:correction*.10;
   }
   // Turn the momentum without blending opposing vectors, which cancels speed.
   const distance=Math.max(requested,momentum*.985);
   dx=Math.cos(heading)*distance;
   dy=Math.sin(heading)*distance;
   player.x=startX+dx;
   player.y=startY+dy;
  }
 }
 player.iceMotion={dx,dy,at:Time.time};
}

module.exports={ICE_RADIUS,ICE_LIFETIME,GIANT_SPEED,GIANT_BODY,GIANT_COLORS,updateIceTrails,applyIceTraction,iceBallFriction};
