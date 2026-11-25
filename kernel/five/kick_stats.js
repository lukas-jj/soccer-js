const {applyKickDirectionNoise}=require('../core/lib/ball_prediction.js');

function abilityKickAim(player,dir,shot,random,angleScale=.002){
 const accuracy=shot?player.effectiveShotAccuracy:player.effectivePassAccuracy;
 const {nx,ny}=applyKickDirectionNoise(dir.x,dir.y,Math.min(100,accuracy??70),{random,angleScale});
 return {x:nx,y:ny};
}

function abilityKickSpeed(player,speed,shot){
 const skill=shot?player.effectiveShooting:player.effectivePassing;
 return speed*(.65+.005*(skill??70));
}

module.exports={abilityKickAim,abilityKickSpeed};
