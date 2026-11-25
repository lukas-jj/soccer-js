const {Utils}=require('../core/lib/utils.js');
const {Time}=require('../core/lib/time.js');
const {humanFacingDir}=require('../core/lib/manual_control.js');

const CLONE_DURATION=1.5;
const CLONE_SPEED=8;

function createClones(sim,player,command){
 const direction=humanFacingDir(player,command);
 const aim=Math.atan2(direction.y,direction.x);
 const otherClones=(sim.clones??[]).filter(clone=>clone.player!==player);
 sim.clones=[...otherClones,{
  player,x:player.x,y:player.y,z:0,dx:direction.x,dy:direction.y,
  orientation:(Math.round(aim/(Math.PI/4))+10)%8,
  frame:1,ball:{x:player.x,y:player.y},
  started:Time.time,until:Time.time+(player.powerLevel===2?5:CLONE_DURATION)
 }];
}

function updateClones(sim){
 if(!sim.clones?.length)return;
 const live=sim.matchState==='play'&&!sim.setPieceType;
 sim.clones=sim.clones.filter(clone=>live&&Time.time<clone.until);
 const {width,height}=Utils.getFieldBounds();
 const clamp=(value,extent)=>Math.max(.4,Math.min(extent-.4,value));
 const step=CLONE_SPEED*Time.deltaTime;
 for(const clone of sim.clones){
  clone.x=clamp(clone.x+clone.dx*step,width);
  clone.y=clamp(clone.y+clone.dy*step,height);
  clone.ball.x=clamp(clone.x+clone.dx*.8,width);
  clone.ball.y=clamp(clone.y+clone.dy*.8,height);
  clone.frame=1+Math.floor((Time.time-clone.started)*10)%2;
 }
}

function followClone(sim,player){
 if(!sim.clones?.length||sim.matchState!=='play'||sim.setPieceType||player.humanControlled||player.isSentOff||player.actionTimer>0||player.isSliding)return false;
 let target=null,nearest=Infinity;
 for(const clone of sim.clones){
  const distance=Math.hypot(player.x-clone.ball.x,player.y-clone.ball.y);
  if(distance<nearest){nearest=distance;target=clone.ball;}
 }
 player.moveTo(target,1.12,{arrive:true,separate:true});
 return true;
}

module.exports={createClones,updateClones,followClone};
