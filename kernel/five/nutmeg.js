const {Time}=require('../core/lib/time.js');

const LANE_RADIUS=.55;

function launchNutmeg(sim,player){
 const {ball}=sim;
 if(player.team!=='A'||sim.setPieceType||sim.matchState!=='play')return;
 const speed=Math.hypot(ball.vx,ball.vy);
 if(!speed)return;
 const nx=ball.vx/speed,ny=ball.vy/speed;
 const defenders=sim.teamB.getOutfieldPlayers().map(defender=>{
  const dx=defender.x-ball.x,dy=defender.y-ball.y;
  return {defender,ahead:dx*nx+dy*ny,offset:Math.abs(dx*ny-dy*nx)};
 });
 const targets=defenders.filter(({ahead,offset})=>ahead>0&&offset<=LANE_RADIUS)
  .sort((a,b)=>a.ahead-b.ahead).slice(0,player.powerLevel===2?2:1);
 if(targets.length&&(sim.seededRandom??Math.random)()<.5)ball.nutmeg=targets;
}

function updateNutmeg(sim){
 const {ball}=sim;
 if(!ball.nutmeg?.length)return;
 if(ball.owner||sim.matchState!=='play'||sim.setPieceType||ball.z>.2){
  ball.nutmeg=null;
  return;
 }
 const dx=ball.x-ball.prevX,dy=ball.y-ball.prevY;
 const distance=Math.hypot(dx,dy);
 if(!distance){
  ball.nutmeg=null;
  return;
 }
 const nx=dx/distance,ny=dy/distance;
 let hit=0;
 for(const target of ball.nutmeg){
  const {defender}=target;
  if(target.passed||defender.isSentOff)continue;
  const x=defender.x-ball.prevX,y=defender.y-ball.prevY;
  const along=x*nx+y*ny;
  if(along<0||along>distance||Math.abs(x*ny-y*nx)>LANE_RADIUS)continue;
  target.passed=true;
  hit++;
  sim.powerEffect={origin:{x:defender.x-nx*.5,y:defender.y-ny*.5},x:defender.x+nx,y:defender.y+ny,
   color:'#82c8ff',until:Time.time+.35};
 }
 if(!hit)return;
 const passer=ball.lastKicker;
 if(passer)passer.nutmegBoostUntil=Time.time+3;
 return ball.nutmeg.filter(target=>target.passed).length>1?'Double Nutmeg!':'Nutmeg!';
}

module.exports={launchNutmeg,updateNutmeg};
