require('./mock_env.js');
const assert=require('node:assert/strict');
const {Settings}=require('../kernel/settings.js');
const {Time}=require('../kernel/core/lib/time.js');
const {PlayerStates,getPassReceiverPosition}=require('../kernel/core/entities/player.js');
const {FiveMatch}=require('../kernel/five/match.js');
Settings.app={camX:0,camY:0,canvas:{width:1280,height:800}};
async function setup(){
 const m=await FiveMatch.create('cole',55,{headless:true});const s=m.sim,p=m.player;
 s.matchState='play';s.setPieceType='';
 const carrier=s.teamA.players.find(x=>x!==p&&x.role!=='GK');
 for(const o of s.teamB.players){o.x=46;o.y=3;}
 for(const t of s.teamA.players){t.x=4;t.y=30;}
 p.x=14;p.y=20;carrier.x=24;carrier.y=20;
 s.ball.owner=carrier;s.ball.x=carrier.x;s.ball.y=carrier.y;s.ball.z=0;
 s.teamA.controllingPlayer=carrier;carrier.fsm.changeState(PlayerStates.Dribble);
 return {m,s,p,carrier};
}
(async()=>{
 let {m,s,p,carrier}=await setup();
 assert.deepEqual(getPassReceiverPosition(p,carrier,s),{x:p.x,y:p.y},'human pass target is actual player, not AI support position');
 s.requestHumanPass();s.updatePlayerAIStates();
 assert.equal(carrier.passTarget,p,'E call selects chosen player even for a backward pass');
 assert.equal(carrier.fsm.getNameOfCurrentState(),'Pass');
 assert.ok(Math.hypot(carrier.passAim.x-p.x,carrier.passAim.y-p.y)<1);
 assert.equal(s.ball.owner,carrier,'request does not teleport possession');
 let released=false,received=false;
 for(let i=0;i<180;i++){
  // Keep an uncontested test lane; still execute the real kick, flight and first touch.
  for(const o of s.teamB.players){o.x=46;o.y=3;}
  m.step();if(s.ball.owner!==carrier)released=true;if(s.ball.owner===p){received=true;break;}
 }
 assert.ok(released,'teammate physically kicks ball');assert.ok(received,'called ball reaches the chosen player');
 ({m,s,p,carrier}=await setup());s._humanCarrier=carrier;s._humanCarrierSince=Time.time-1;s.updatePlayerAIStates();
 assert.equal(carrier.passTarget,p,'open human gets natural passes without pressing E');
 ({m,s,p,carrier}=await setup());
 carrier.fsm.changeState(PlayerStates.Shoot);s.requestHumanPass();s.updatePlayerAIStates();
 assert.equal(carrier.fsm.getNameOfCurrentState(),'Shoot','call waits for committed kick');
 assert.ok(s._humanCallUntil>Time.time,'call remains queued');
 carrier.fsm.changeState(PlayerStates.Dribble);s.updatePlayerAIStates();assert.equal(carrier.passTarget,p,'queued call retried when teammate can pass');
 ({m,s,p,carrier}=await setup());s.ball.owner=s.teamB.players[1];s.requestHumanPass();s.updatePlayerAIStates();assert.notEqual(carrier.passTarget,p,'no forced possession from opponents');
 ({m,s,p,carrier}=await setup());
 const marker=s.teamB.players[1];marker.x=19;marker.y=20;
 s.requestHumanPass();s.updatePlayerAIStates();
 assert.equal(s.humanCallFeedback.text,'GET OPEN');assert.ok(s._humanCallUntil>Time.time,'blocked call waits rather than forcing a pass through defender');
 const deadline=s._humanCallUntil;
 Time.time+=1.5;s.requestHumanPass();
 assert.equal(s._humanCallUntil,deadline,'repeated calls do not renew the request');
 s.updatePlayerAIStates();assert.equal(s.humanCallFeedback.text,'GET OPEN');
 marker.x=46;marker.y=3;s.updatePlayerAIStates();
 assert.equal(s.humanCallFeedback.text,'PASS COMING','moving into space satisfies the original call');
 ({m,s,p,carrier}=await setup());p.x=50;p.y=30;carrier.x=5;carrier.y=20;
 s.requestHumanPass();s.updatePlayerAIStates();assert.equal(s.humanCallFeedback.text,'MOVE CLOSER');
 console.info('5v5 requested, backward, natural and physically received passes passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
