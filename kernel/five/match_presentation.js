const {Time}=require('../core/lib/time.js');

function settleBall(ball){
 Object.assign(ball,{owner:null,vx:0,vy:0,vz:0,passRoute:null,z:0});
 ball.updateGlobalPos();
}

class FulltimePresentation {
 constructor(match){
  this.winner=match.winner;
  this.started=Time.time;
  const {sim}=match;
  this.players=[...sim.teamA.players,...sim.teamB.players].filter(player=>!player.isSentOff);
  for(const player of this.players){
   Object.assign(player,{vx:0,vy:0,vz:0,overheadPose:null,stepoverPose:null,teamFinishPose:null});
  }
  settleBall(sim.ball);
  this.step();
 }

 step(){
  const elapsed=Time.time-this.started;
  this.players.forEach((player,index)=>{
   const won=player.team===this.winner;
   const time=elapsed+index*.055;
   player.z=won?Math.abs(Math.sin(time*8))*.7:0;
   // Use the existing crouch sprite for the losing team's reaction.
   player.frame=won?12+Math.floor(time*7)%2:this.winner?9:0;
   player.orientation=4;
   player.updateGlobalPos();
  });
  return elapsed>=4;
 }
}

module.exports={FulltimePresentation};
