require('./mock_env.js');
const assert=require('node:assert/strict');
const {FantasyRun,RUN_LENGTH,GOBLIN_TEAM,ORC_BROTHERS,SHAPESHIFTERS,OPPONENTS,generateEncounter}=require('../kernel/five/cup.js');
const {FiveMatch}=require('../kernel/five/match.js');
const {MatchStates}=require('../kernel/providers/simulator/simulator.js');
const {Settings}=require('../kernel/settings.js');
const {Time}=require('../kernel/core/lib/time.js');
const {PlayerStates,grantGkPossession}=require('../kernel/core/entities/player.js');
const {tickManualControl}=require('../kernel/core/lib/manual_control.js');
const {usePower,characterPower,updateBargeCharge}=require('../kernel/five/powers.js');
const {predict3D,samplePassRoute}=require('../kernel/core/lib/ball_prediction.js');
const {updateSlimers,updateSlimerSlows}=require('../kernel/five/slimers.js');
const {updateOrcBrothers}=require('../kernel/five/orc_brothers.js');
Settings.app={camX:0,camY:0,canvas:{width:1280,height:800}};

async function setup(id,upgrades=[],drill){
 const game=await FiveMatch.create(id,42,{squad:true,upgrades,headless:true});
 const {sim}=game;
 if(drill){
  game.practiceCharacter=drill;
  const power=characterPower(id,drill);
  game.player.powerCooldown=power.cooldown*(upgrades.includes(power.extra)?.75:1);
 }
 Settings.HEADLESS=false;
 sim.matchState='play';sim.setPieceType='';
 for(const p of sim.players){p.x=3;p.y=p.team==='A'?29:3;p.actionTimer=0;}
 return game;
}
function giveBall(sim,player,x,y){
 player.x=x;player.y=y;
 sim.ball.owner=player;sim.ball.syncToOwner();
 player.fsm.changeState(PlayerStates.Dribble);
}
function press(game,code){
 game.input.press(code);tickManualControl(game.sim);game.input.release(code);
}
function runBarge(sim){
 for(let i=0;i<20&&sim.bargeCharge;i++){
  Time.advanceFixedLogicStep();
  updateBargeCharge(sim);
 }
}
(async()=>{
 const cup=new FantasyRun(8);
 assert.deepEqual(cup.roster,['cole']);
 assert.ok(cup.opponent.count>=1&&cup.opponent.count<=5&&cup.opponent.bonus<=-25);
 cup.finish(0,0);
 assert.equal(cup.status,'playing');
 const openingGold=cup.gold;
 cup.finish(1,0);
 assert.equal(cup.status,'between');
 assert.ok(cup.gold>openingGold);
 assert.deepEqual(cup.offers,[]);
 assert.ok(cup.enterTavern());
 assert.equal(cup.status,'tavern');
 assert.equal(cup.enterTavern(),false);
 assert.equal(cup.choose('rest'),false);
 assert.equal(cup.offers.length,3);
 assert.equal(new Set(cup.offers.map(p=>p.id)).size,3);
 const balance=cup.gold;
 cup.finish(1,0);
 assert.equal(cup.gold,balance,'result only pays once');
 assert.equal(cup.choose('unknown'),false);
 assert.equal(cup.choose('train'),false);
 const recruit=cup.offers.find(p=>p.price<=cup.gold);
 const preview=cup.nextOpponent;
 assert.ok(cup.choose(recruit.id));
 assert.equal(cup.gold,balance-recruit.price);
 assert.equal(cup.round,1);
 assert.deepEqual(cup.roster,['cole',recruit]);
 assert.deepEqual(cup.opponent,preview);
 assert.equal(cup.opponent.id,ORC_BROTHERS.id);
 const licensed=await FiveMatch.create('cole',8,{squad:true,headless:true,roster:cup.roster,opponent:cup.opponent,rested:true});
 const hired=licensed.sim.teamA.players[1];
 assert.equal(hired.name,recruit.name);
 assert.equal(hired.stats.speed,recruit.stats.speed);
 assert.equal(licensed.powerFor(hired)?.icon,recruit.power??undefined);
 assert.equal(licensed.staminaMultiplier,2);
 licensed.updateSprintReserve(true);
 assert.ok(Math.abs(licensed.sprintReserve-(1-Time.deltaTime/((2+licensed.player.stats.stamina/50)*2)))<1e-9);
 cup.finish(1,0);assert.equal(cup.status,'playing');
 let previousOpponent;
 while(cup.round<RUN_LENGTH-1){
  previousOpponent=cup.opponent;
  cup.finish(cup.opponent.goalTarget??3,0);
  assert.ok(cup.choose(cup.round===1?'rest':'continue'));
  assert.equal(cup.rested,cup.round===2);
 }
 assert.equal(cup.opponent.boss,true);
 assert.equal(cup.opponent.id,'hounds');
 assert.deepEqual(cup.opponent.lineup.filter(Boolean).map(profile=>profile.id),[
  GOBLIN_TEAM.id,ORC_BROTHERS.id,previousOpponent.id
 ]);
 const finale=await FiveMatch.create('cole',8,{squad:true,headless:true,roster:cup.roster,opponent:cup.opponent});
 const finalists=finale.sim.teamB.players;
 assert.equal(finalists.length,5);
 assert.equal(finalists[0].role,'GK');
 assert.deepEqual(finalists.filter(player=>player.isSlimer),[finalists[1]]);
 assert.deepEqual(finalists.filter(player=>player.isOrc),[finalists[2]]);
 assert.deepEqual(finalists.filter(player=>player.isShapeshifter),previousOpponent.shapeshifters?[finalists[3]]:[]);
 cup.finish(3,2);assert.equal(cup.status,'won');
 const lost=new FantasyRun(1),beforeLoss=lost.gold;
 lost.finish(0,1);
 assert.equal(lost.status,'between');assert.ok(lost.gold<beforeLoss);
 assert.ok(lost.enterTavern());
 const pricey=lost.offers.find(offer=>offer.price>lost.gold);
 assert.ok(pricey&&!lost.choose(pricey.id));
 assert.equal(lost.choose('rest'),false);
 assert.ok(lost.choose('continue'));assert.equal(lost.round,0);assert.equal(lost.opponent.id,GOBLIN_TEAM.id);
 for(let i=0;i<5;i++){lost.finish(0,1);lost.choose('continue');}
 assert.equal(lost.gold,0);
 const powersSeen=new Set(),tiers=[0,0,0];
 for(let i=0;i<140;i++){
  const sample=new FantasyRun(i,'mendes','portal');
  sample.finish(1,0);
  assert.ok(sample.enterTavern());
  for(const offer of sample.offers){powersSeen.add(offer.power);tiers[offer.rarity]++;}
 }
 assert.deepEqual([...powersSeen].sort(),['arc','barge','blaze','dash','portal','smoke','spin','tele','warp',null].sort());
 assert.ok(tiers[0]>tiers[1]&&tiers[1]>tiers[2]);
 const loadoutRun=new FantasyRun(21,'mendes','portal');
 const mageStarter=loadoutRun.roster[0];
 const arcHire={...mageStarter,number:undefined,name:'IONA',power:'arc'};
 const warriorHire={...mageStarter,number:undefined,name:'VORRA',characterId:'price',power:'spin'};
 const loadout=await FiveMatch.create('mendes',21,{squad:true,headless:true,
  roster:[mageStarter,arcHire,warriorHire],opponent:GOBLIN_TEAM});
 const [starterMage,arcMage,spinOrc]=loadout.sim.teamA.players;
 assert.deepEqual([starterMage,arcMage,spinOrc].map(p=>loadout.powerFor(p).name),['Portal Pass','Swerve','Orc Spin']);
 Settings.HEADLESS=false;loadout.sim.fsm.setCurrentState(MatchStates.Play);
 loadout.sim.matchState='play';loadout.sim.setPieceType='';
 loadout.input.aim={x:1,y:-2};
 giveBall(loadout.sim,starterMage,15,17);
 press(loadout,'Space');
 assert.ok(loadout.sim.teleCast?.exit,'the starting loadout arms the selected portal power');
 giveBall(loadout.sim,arcMage,15,17);
 press(loadout,'Space');
 assert.equal(loadout.sim.arcCast?.player,arcMage,'Space arms the recruited mage’s Swerve');
 const traineeRun=new FantasyRun(8,'mendes','tele');
 traineeRun.finish(1,0);
 assert.equal(traineeRun.trainable.length,1);
 assert.ok(traineeRun.choose('train-0'));
 assert.equal(traineeRun.roster[0].powerLevel,2);
 assert.equal(traineeRun.trainable.length,0);
 assert.equal(traineeRun.round,1);
 const trained=await FiveMatch.create('mendes',8,{squad:true,headless:true,roster:traineeRun.roster,opponent:traineeRun.opponent});
 assert.equal(trained.player.powerLevel,2);
 const cupOpening=generateEncounter(0,0);
 assert.equal(cupOpening.count,5);assert.equal(cupOpening.keeper,true);assert.equal(cupOpening.goalTarget,1);
 const sizes=new Set(),keepers=new Set();
 for(let i=0;i<100;i++){
  assert.deepEqual(generateEncounter(i,0),cupOpening);
  const encounter=generateEncounter(Math.imul(i+1,2654435761),2);
  sizes.add(encounter.count);keepers.add(encounter.keeper);
  assert.deepEqual(encounter,generateEncounter(Math.imul(i+1,2654435761),2));
 }
 assert.equal(sizes.size,4);assert.equal(keepers.size,2);
 const rival=await FiveMatch.create('cole',1,{opponent:OPPONENTS[1],headless:true});
 const opener=await FiveMatch.create('cole',1,{opponent:new FantasyRun().opponent,headless:true});
 assert.ok(opener.sim.teamB.players[1].stats.speed<rival.sim.teamB.players[1].stats.speed);

 const rookie=opener.sim;
 rookie.matchState='play';rookie.setPieceType='';
 giveBall(rookie,opener.player,27,17);
 rookie.teamB.players.slice(1).forEach((p,i)=>{p.x=30+i;p.y=17;p.fsm.changeState(PlayerStates.Idle);});
 const countPressers=()=>[...rookie.getActiveChasers()].filter(p=>p.team==='B').length;
 assert.equal(countPressers(),1,'even the opener sends one defender immediately');
 const firstPresser=[...rookie.getActiveChasers()].find(p=>p.team==='B');
 rookie.updatePlayerAIStates();
 assert.ok(firstPresser.fsm.isInState(PlayerStates.ChaseBall));
 const initialGap=Math.hypot(firstPresser.x-rookie.ball.x,firstPresser.y-rookie.ball.y);
 for(let i=0;i<12;i++)firstPresser.fsm.update();
 assert.ok(Math.hypot(firstPresser.x-rookie.ball.x,firstPresser.y-rookie.ball.y)<initialGap-.15);
 giveBall(rookie,rookie.teamA.players[3],27,17);
 assert.equal(countPressers(),1,'a pass does not stop the press');
 giveBall(rookie,opener.player,5,2);
 assert.equal(countPressers(),1,'the presser closes down even from across the pitch');
 assert.equal(Settings.AI.B.ALLOW_SLIDE_TACKLES,false);
 assert.ok(rookie.teamB.players[1].movementScale<rival.sim.teamB.players[1].movementScale);

 const slideGame=await setup('cole');
 const slideSim=slideGame.sim,defender=slideSim.teamB.players[1];
 giveBall(slideSim,slideGame.player,25,17);
 slideSim.ball.x=25;slideSim.ball.y=17;
 defender.x=23.2;defender.y=17;defender.fsm.changeState(PlayerStates.ChaseBall);
 defender.fsm.update();
 assert.equal(defender.isSliding,false);

 for(const roster of [['cole'],['cole','price']]){
  const shifterMatch=await FiveMatch.create('cole',42,{squad:true,headless:true,roster,opponent:SHAPESHIFTERS});
  const s=shifterMatch.sim;
  s.matchState='play';s.setPieceType='';
  const originals=s.teamB.players.map(p=>p.stats);
  const times=(ticks)=>{for(let i=0;i<ticks;i++)s.updateShapeshifters();};
  giveBall(s,shifterMatch.player,21,17);
  s.teamB.players.forEach((p,i)=>{p.x=24+i;p.y=17;p.fsm.changeState(PlayerStates.Idle);});
  const pressCount=()=>[...s.getActiveChasers()].filter(p=>p.team==='B').length;
  times(99);
  assert.ok(s.teamB.players.every(p=>!p.mimicPlayer&&p.movementScale<.5));
  assert.equal(pressCount(),1);
  times(1);
  assert.equal(pressCount(),2);
  s.teamB.players.forEach((p,i)=>{
   const source=s.teamA.players[i%roster.length];
   assert.equal(p.mimicPlayer,source);
   assert.equal(p.name,source.name);
   assert.equal(p.stats.shooting,Math.min(100,source.stats.shooting+4));
   assert.ok(p.movementScale>(source.movementScale??1));
  });
  times(100);
  assert.equal(pressCount(),1);
  s.teamB.players.forEach((p,i)=>{
   assert.equal(p.mimicPlayer,null);
   assert.equal(p.stats,originals[i]);
   assert.equal(p.movementScale,SHAPESHIFTERS.speedScale);
  });
  times(100);
  assert.ok(s.teamB.players.every(p=>p.mimicPlayer));
 }

 for(let home=1;home<=5;home++)for(let away=1;away<=5;away++){
  const game=await FiveMatch.create('cole',10,{squad:true,headless:true,matchup:{home,away,awayKeeper:away>1}});
  assert.equal(game.sim.teamA.players.length,home);
  assert.equal(game.sim.teamB.players.length,away);
  assert.equal(game.sim.teamA.getGoalkeeper(),null);
  assert.equal(!!game.sim.teamB.getGoalkeeper(),away>1);
  for(let i=0;i<100&&(game.sim.matchState!=='play'||game.sim.setPieceType==='kickoff');i++)game.step();
  assert.equal(game.sim.matchState,'play');
  assert.equal(game.sim.setPieceType,'');
 }
 const brothers=await FiveMatch.create('cole',12,{squad:true,headless:true,roster:['cole'],opponent:ORC_BROTHERS});
 const orcSim=brothers.sim,[bruk,murg]=orcSim.teamB.getOutfieldPlayers();
 const orcKeeper=orcSim.teamB.getGoalkeeper();
 assert.equal(orcKeeper.name,'ORC KEEPER');
 assert.equal(orcKeeper.characterId,undefined);
 assert.equal(orcSim.teamB.players.length,3);
 assert.deepEqual([bruk.name,murg.name],['BRUK','MURG']);
 assert.ok([bruk,murg].every(p=>p.characterId==='price'));
 orcSim.matchState='play';orcSim.setPieceType='';
 const targetPlayer=brothers.player;
 giveBall(orcSim,targetPlayer,20,17);
 bruk.x=12;bruk.y=17;murg.x=8;murg.y=22;
 assert.ok(bruk.movementScale<orcKeeper.movementScale);
 updateOrcBrothers(orcSim);
 Time.time+=.7;updateOrcBrothers(orcSim);
 assert.ok(bruk.bargeWindup);
 targetPlayer.y=19;
 const chargeBeforeMiss={action:'shoot',ticks:4};
 orcSim._manualCharge=chargeBeforeMiss;
 Time.time+=.45;
 for(let i=0;i<15&&bruk.bargeWindup;i++){Time.advanceFixedLogicStep();updateOrcBrothers(orcSim);}
 assert.ok(bruk.x>=21.9,'a missed bash still travels ten metres');
 assert.ok(orcSim.ball.owner===targetPlayer,'a sidestep evades the committed barge');
 assert.equal(orcSim._manualCharge,chargeBeforeMiss,'an enemy miss leaves the current kick charge alone');
 murg.x=11.5;murg.y=19;
 Time.time+=1;updateOrcBrothers(orcSim);
 assert.ok(murg.bargeWindup);
 Time.time+=.45;
 for(let i=0;i<15&&murg.bargeWindup;i++){Time.advanceFixedLogicStep();updateOrcBrothers(orcSim);}
 assert.ok(orcSim.ball.owner===murg,'the second orc can hit and steal the ball');
 assert.ok(targetPlayer.actionTimer>0);
 assert.equal(orcSim.bargeFlights[0].opponent,targetPlayer);
 assert.equal(orcSim.bargeFlights[0].distance,4.5);
 assert.equal(murg.powerReadyAt,Time.time+5);

 for(const opponent of [undefined,GOBLIN_TEAM,ORC_BROTHERS])for(const side of ['A','B']){
  const game=await FiveMatch.create('cole',11,{squad:true,headless:true,
   matchup:{home:1,away:opponent?.count??1,awayKeeper:opponent?.keeper},opponent});
  const {sim}=game;
  sim.fsm.setCurrentState(MatchStates.Play);sim.setPieceType='';
  sim.matchTimer=0;game.step(100);
  assert.equal(sim.matchTimer,0,'goal-target matches do not run a countdown');
  const score=side==='A'?'scoreA':'scoreB';
  const goal=side==='A'?sim.getGoals().right:sim.getGoals().left;
  const scoreGoal=()=>{
   sim.fsm.setCurrentState(MatchStates.Play);sim.setPieceType='';
   const y=(goal.yMin+goal.yMax)/2;
   Object.assign(sim.ball,{owner:null,x:goal.lineX-goal.facingX*.5,y,z:0,
    prevX:goal.lineX+goal.facingX*.5,prevY:y,prevZ:0});
   sim.checkBallCollisions();
   assert.equal(sim.matchState,'goal');
   sim.stateTimer=0;game.step();
  };
  const target=opponent?.goalTarget??3;
  if(target>1){
   sim[score]=target-2;scoreGoal();
   assert.equal(sim[score],target-1);assert.equal(sim.matchState,'kickoff');
  }
  scoreGoal();
  assert.equal(sim[score],target);assert.ok(game.finished);
 }
 const openingRun=new FantasyRun(7,'mendes');
 const soloRun=await FiveMatch.create('mendes',openingRun.matchSeed,{
  squad:true,headless:true,roster:openingRun.roster,opponent:openingRun.opponent
 });
 assert.deepEqual(soloRun.sim.teamA.players.map(p=>p.characterId),['mendes']);
 assert.equal(soloRun.sim.teamB.players.length,openingRun.opponent.count);
 assert.equal(soloRun.sim.kickoffTeam,'A');
 assert.ok(soloRun.sim.teamB.players.every(p=>p.isSlimer));
 const slimerSim=soloRun.sim,target=soloRun.player;
 slimerSim.fsm.setCurrentState(MatchStates.Play);slimerSim.setPieceType='';
 target.x=20;target.y=17;
 for(const [i,shooter] of slimerSim.teamB.players.entries()){
  shooter.x=15;shooter.y=17+i*2;
 }
 updateSlimers(slimerSim);
 Time.time+=.81;updateSlimers(slimerSim);
 assert.ok(slimerSim.teamB.players[1].slimeWindup);
 Time.time+=.46;updateSlimers(slimerSim);
 assert.equal(slimerSim.slimeShots.length,1);
 assert.ok(slimerSim.teamB.getGoalkeeper());
 assert.equal(slimerSim.teamB.getGoalkeeper().slimeWindup,undefined);
 target.y=20;
 for(let i=0;i<25;i++){Time.advanceFixedLogicStep();updateSlimers(slimerSim);}
 assert.ok(!(target.slimedUntil>Time.time),'a sidestep dodges the fixed shot');
 target.y=17;
 slimerSim.slimeShots=[{x:19.7,y:17,dx:1,dy:0,distance:4}];
 updateSlimers(slimerSim);
 assert.equal(target.slimedUntil,Time.time+2);
 assert.equal(target.movementEffectScale,.5);
 const until=target.slimedUntil;
 Time.time=until-.01;updateSlimerSlows([target]);
 assert.equal(target.movementEffectScale,.5);
 Time.time=until;updateSlimerSlows([target]);
 assert.equal(target.movementEffectScale,1);
 const moveFromRest=scale=>{
  target.movementEffectScale=scale;
  target.x=20;target.y=17;target._currentSpeed=0;target.currentStamina=1;
  target.moveTo({x:25,y:17});
  return target.x-20;
 };
 const normalStep=moveFromRest(1),slowedStep=moveFromRest(.5);
 assert.ok(Math.abs(slowedStep-normalStep/2)<1e-8);
 target.movementEffectScale=1;

 soloRun.step(75);
 const soloSim=soloRun.sim;
 soloSim.setupSetPiecePositions('goalkick','left','A');
 assert.ok(soloSim.ball.owner===soloRun.player,'outfield player takes the goal kick without a keeper');
 assert.ok(soloSim.ball.x<8);
 soloSim.matchState='play';soloSim.setPieceType='';
 giveBall(soloSim,soloRun.player,15,17);
 Settings.HEADLESS=false;
 soloRun.input.aim={x:-1,y:-.35};
 const matchGoal=soloSim.getGoals().left,centerBefore=matchGoal.center.y;
 press(soloRun,'Space');
 assert.ok(matchGoal.center.y<centerBefore,'Space casts Goal Warp in a match');
 assert.equal(soloRun.player.powerReadyAt,Time.time+6);
 const keeperTest=await FiveMatch.create('cole',10,{squad:true,headless:true,
  matchup:{home:2,away:2,homeKeeper:true,awayKeeper:true}});
 const keeperSim=keeperTest.sim,homeKeeper=keeperSim.teamA.getGoalkeeper();
 keeperSim.fsm.setCurrentState(MatchStates.Play);keeperSim.setPieceType='';
 homeKeeper.x=5;homeKeeper.y=17;
 keeperSim.ball.x=5.5;keeperSim.ball.y=17;keeperSim.ball.z=0;
 keeperSim.ball.owner=null;keeperSim.ball.lastKicker=keeperTest.player;
 keeperSim.ball.vx=-13;keeperSim.ball.vy=0;
 homeKeeper.fsm.changeState(PlayerStates.Goalkeeper);
 homeKeeper.fsm.update();
 assert.ok(keeperSim.ball.owner===homeKeeper,'keeper settles an incoming back-pass standing');
 assert.equal(homeKeeper.fsm.getNameOfCurrentState(),'Goalkeeper');
 keeperSim.ball.syncToOwner();
 const kickOrigin=keeperSim.ball.x;
 keeperSim.ball.kick(20,0,4);
 for(let i=0;i<10;i++){
  Time.advanceFixedLogicStep();homeKeeper.update();keeperSim.ball.update();
  assert.ok(keeperSim.ball.owner!==homeKeeper);
  assert.equal(homeKeeper.fsm.getNameOfCurrentState(),'Goalkeeper');
 }
 assert.ok(keeperSim.ball.x>kickOrigin+5,'keeper distribution travels away without a self-save');

 let game=await setup('price',['charge'],'price');
 let {sim}=game;
 const orc=game.player,enemy=sim.teamB.players[1],rogue=sim.teamA.players[2];
 giveBall(sim,enemy,23,17);orc.x=20;orc.y=17;
 press(game,'Tab');
 assert.notEqual(game.player,orc);
 tickManualControl(sim);assert.notEqual(game.player,orc,'manual defender stays selected');
 giveBall(sim,orc,20,17);tickManualControl(sim);assert.equal(game.player,orc);
 press(game,'Tab');assert.equal(game.player,orc,'Tab keeps the carrier during friendly possession');
 rogue.x=30;rogue.y=17;game.input.aim={x:1,y:0};
 game.input.press('KeyJ');
 for(let i=0;i<7;i++)tickManualControl(sim);
 game.input.release('KeyJ');tickManualControl(sim);
 assert.equal(game.player,rogue,'normal pass selects its intended receiver');
 assert.equal(orc.passTarget,rogue);

 game=await setup('price',['charge'],'price');
 sim=game.sim;
 const grum=game.player,carrier=sim.teamB.players[1];
 giveBall(sim,carrier,23,17);grum.x=20;grum.y=17;game.input.aim={x:1,y:0};
 assert.equal(grum.powerCooldown,9);
 const chargeStart=Time.time;
 press(game,'Space');
 assert.equal(grum.x,20,'the barge starts without teleporting');
 Time.advanceFixedLogicStep();updateBargeCharge(sim);
 assert.ok(grum.x>20&&grum.x<20.5);
 assert.equal(grum.z,0);
 assert.ok([1,2].includes(grum.frame));
 assert.equal(sim.ball.owner,carrier);
 game.input.aim={x:0,y:1};
 runBarge(sim);
 assert.equal(grum.y,17,'the barge keeps its initial direction');
 assert.ok(sim.ball.owner===grum);assert.equal(grum.powerReadyAt,chargeStart+9);
 giveBall(sim,carrier,34,17);press(game,'Space');
 assert.match(game.feedback.text,/recharging/);
 assert.ok(sim.ball.owner===carrier);assert.equal(grum.actionTimer,0);
 Time.time=grum.powerReadyAt;
 press(game,'Space');
 assert.equal(grum.powerReadyAt,Time.time+9);
 runBarge(sim);
 assert.ok(sim.ball.owner===carrier);assert.equal(grum.actionTimer,0);

 for(const possession of ['loose','teammate','self']){
  const bargeGame=await setup('price',[],'price');
  const defender=bargeGame.player,{sim}=bargeGame;
  defender.x=18;defender.y=17;defender.orientation=2;
  const owner=possession==='self'?defender:possession==='teammate'?sim.teamA.players[2]:null;
  sim.ball.owner=owner;
  const x=defender.x;
  bargeGame.input.press('Space');
  const frame=bargeGame.input.pollFrame().command;
  assert.equal(frame.usePower,true);
  assert.equal(frame.shoot,false);
  bargeGame.input.release('Space');
  if(possession==='teammate')usePower(sim,defender,frame,bargeGame.upgrades);
  else press(bargeGame,'Space');
  runBarge(sim);
  assert.ok(defender.x>x+2);
  assert.equal(sim.ball.owner,possession==='self'?null:owner);
  if(possession==='self'){
   assert.ok(sim.ball.x>defender.x&&sim.ball.x-defender.x<1);
   assert.ok(sim.ball.vx>0&&defender.kickerClaimCooldown>0);
  }
  assert.ok(defender.powerReadyAt>Time.time);
 }

 const carryingBarge=await setup('price',[],'price');
 const {player:ballCarrier,sim:carryingSim}=carryingBarge;
 giveBall(carryingSim,ballCarrier,18,17);
 const blockerOnBarge=carryingSim.teamB.getOutfieldPlayers()[0];
 blockerOnBarge.x=21;blockerOnBarge.y=17;
 carryingBarge.input.aim={x:1,y:0};
 press(carryingBarge,'Space');
 runBarge(carryingSim);
 assert.equal(carryingSim.bargeFlights[0].opponent,blockerOnBarge);
 assert.equal(carryingSim.ball.owner,null);
 assert.ok(carryingSim.ball.x>ballCarrier.x&&carryingSim.ball.x-ballCarrier.x<1);
 const collisionGame=await setup('price',[],'price');
 const collisionSim=collisionGame.sim,charger=collisionGame.player;
 charger.x=18;charger.y=17;
 const friendly=collisionSim.teamA.getOutfieldPlayers().find(p=>p!==charger);
 const foe=collisionSim.teamB.getOutfieldPlayers()[0];
 friendly.x=19.2;friendly.y=17.3;foe.x=20.6;foe.y=16.7;
 collisionSim.ball.owner=null;
 collisionGame.input.aim={x:1,y:0};
 press(collisionGame,'Space');runBarge(collisionSim);
 assert.deepEqual(collisionSim.bargeFlights.map(f=>f.opponent),[friendly,foe]);
 assert.equal(collisionSim.ball.owner,null);
 assert.ok(Math.abs(charger.x-21.2)<1e-8,'non-carriers do not stop the charge');

 const boosted=await setup('price',[],'price');
 boosted.player.powerLevel=2;
 giveBall(boosted.sim,boosted.player,18,17);
 boosted.input.aim={x:1,y:0};
 press(boosted,'Space');
 assert.equal(boosted.sim.bargeCharge.speed,8.3);
 runBarge(boosted.sim);
 assert.ok(Math.abs(boosted.player.x-22.8)<1e-8);
 assert.equal(boosted.sim.ball.owner,null);
 assert.ok(boosted.sim.ball.x>boosted.player.x);
 game=await setup('price',['outlet'],'price');
 sim=game.sim;
 const outletOrc=game.player,outletReceiver=sim.teamA.players[2];
 giveBall(sim,sim.teamB.players[1],22,17);
 game.input.aim={x:1,y:0};
 outletOrc.x=20;outletOrc.y=17;outletReceiver.x=14;outletReceiver.y=17;
 press(game,'Space');
 runBarge(sim);
 assert.equal(sim.ball.owner,null);
 assert.equal(sim._manualPendingReceiver,outletReceiver);

 game=await setup('cole',['shadow','second-wind']);
 sim=game.sim;
 const nyx=game.player;
 giveBall(sim,nyx,20,17);nyx.sprint.reserve=.1;
 game.input.press('KeyD');press(game,'Space');
 assert.ok(nyx.x>24);assert.equal(sim.ball.owner,nyx);
 assert.equal(nyx.sprint.reserve,1);assert.equal(nyx.powerReadyAt,Time.time+6);

 game=await setup('mendes',['encore'],'mendes');
 sim=game.sim;
 const wizard=game.player,receiver=sim.teamA.players[2];
 wizard.x=15;wizard.y=17;receiver.x=30;receiver.y=17;
 const blocker=sim.teamB.players[1];blocker.x=22;blocker.y=17;
 press(game,'Space');assert.equal(wizard.powerReadyAt,0,'casting away from the ball leaves the power ready');
 giveBall(sim,wizard,15,17);game.input.aim={x:1,y:0};
 press(game,'Space');
 assert.ok(sim.ball.owner===wizard,'Space arms Swerve without kicking');
 assert.ok(sim.arcCast.flight.preview.length>2,'arming shows the curved route immediately');
 game.input.press('MouseLeft');tickManualControl(sim);
 const initialCurve=Math.abs(sim.arcCast.flight.curveForce);
 for(let i=0;i<13;i++){Time.advanceFixedLogicStep();tickManualControl(sim);}
 assert.ok(Math.abs(sim.arcCast.flight.curveForce)>initialCurve*1.4,'holding adds bend to the preview');
 assert.ok(sim.ball.owner===wizard,'charging keeps possession');
 const previewedRoute=sim.arcCast.flight.route;
 const pace=(t)=>{
  const sample=samplePassRoute(previewedRoute,t*previewedRoute.duration);
  return Math.hypot(sample.vx,sample.vy);
 };
 assert.ok(Math.abs(pace(.1)-pace(.3))<1e-8,'Swerve maintains the same speed through the bend');
 game.input.release('MouseLeft');tickManualControl(sim);
 assert.ok(sim.ball.passRoute===previewedRoute,'release uses the route last shown by the arrow');
 assert.equal(sim.ball.owner,null);assert.equal(wizard.powerReadyAt,Time.time+10);
 assert.ok(Math.abs(sim.ball.curveForce)>1);
 assert.equal(sim._manualPendingReceiver,receiver);
 tickManualControl(sim);assert.equal(game.player,receiver);
 let clearance=0,loft=0;
 for(let i=0;i<60&&sim.ball.x<blocker.x;i++){Time.advanceFixedLogicStep();sim.ball.update();clearance=Math.abs(sim.ball.y-blocker.y);loft=sim.ball.z;}
 assert.ok(clearance>1&&loft>.6,JSON.stringify({clearance,loft}));
 for(let i=0;i<60&&sim.ball.x<receiver.x-.6;i++){Time.advanceFixedLogicStep();sim.ball.update();}
 assert.ok(Math.hypot(sim.ball.x-receiver.x,sim.ball.y-receiver.y)<1.2,'the curve brings the pass back to its target');
 const shownLanding=sim.arcAssist.landing;
 for(let i=0;i<30&&sim.ball.passRoute;i++){Time.advanceFixedLogicStep();sim.ball.update();}
 assert.ok(Math.hypot(sim.ball.x-shownLanding.x,sim.ball.y-shownLanding.y)<1e-8,
  'the actual ball lands at exactly the endpoint the arrow showed');
 sim.ball.lastKicker=receiver;sim.scoreA=1;game.checkArcEncore(0);
 assert.equal(wizard.powerReadyAt,Time.time);

 async function passThroughScreen(arc){
  const game=await setup('mendes',[],arc?'mendes':undefined);
  game.headless=false;
  const {sim,input}=game;
  sim.fsm.setCurrentState(MatchStates.Play);
  const wizard=game.player,receiver=sim.teamA.players[2];
  for(const opponent of sim.teamB.players)opponent.isSentOff=true;
  const defender=sim.teamB.players[1];
  defender.isSentOff=false;defender.x=22;defender.y=17;
  defender.fsm.changeState(PlayerStates.Idle);
  giveBall(sim,wizard,15,17);
  receiver.x=29;receiver.y=17;
  input.aim={x:1,y:0};
  if(arc)press(game,'Space');
  input.press('MouseLeft');input.release('MouseLeft');tickManualControl(sim);
  if(arc){
   assert.ok(Math.abs(sim.ball.curveForce)>=8&&sim.ball.passRoute.height>.5,'a tap curves and lifts around the defender');
   assert.ok(sim._manualPendingReceiver===receiver);
  }
  for(let i=0;i<65&&(!sim.ball.owner||sim.ball.owner===wizard);i++)game.step();
  return {owner:sim.ball.owner,receiver,defender};
 }
 const straight=await passThroughScreen(false);
 assert.ok(straight.owner===straight.defender,'the screen intercepts the normal pass');
 const arced=await passThroughScreen(true);
 assert.ok(arced.owner===arced.receiver,'Swerve beats the same defender and reaches its receiver');

 const practice=await FiveMatch.create('cole',42,{squad:true,practice:true,headless:true,cooldownsOff:true});
 practice.headless=false;
 for(const drill of ['cole','price','mendes','tele-pass','portal-pass','goal-warp','spin-kick']){
  practice.resetPractice(drill);
  const {ball}=practice.sim;
  assert.equal(ball.owner,null);
  assert.deepEqual([ball.x,ball.y,ball.z],[26,17,1.8]);
  Object.assign(ball,{x:51.6,y:17,z:0,vx:20,vy:0,vz:0});
  practice.step(2);
  assert.equal(practice.sim.matchState,'play');
  assert.equal(practice.sim.scoreA,0);
  assert.equal(ball.owner,null);
  assert.deepEqual([ball.x,ball.y],[26,17]);
  assert.ok(ball.z>0);
 }
 practice.resetPractice('cole');
 const practicePossession=()=>{
  const player=practice.player;
  giveBall(practice.sim,player,player.x,player.y);
 };
 practicePossession();
 assert.equal(practice.sim.teamB.players.filter(p=>!p.isSentOff).length,1);
 assert.equal(practice.sim.teamA.players.filter(p=>!p.isSentOff).length,1);
 const slowDefender=practice.practiceRunner,practiceNyx=practice.player;
 const beforePress=Math.hypot(slowDefender.x-practiceNyx.x,slowDefender.y-practiceNyx.y);
 practice.step(10);
 const approach=beforePress-Math.hypot(slowDefender.x-practiceNyx.x,slowDefender.y-practiceNyx.y);
 assert.ok(approach>.15&&approach<1.5,'the Shadow Step opponent closes in slowly');
 const random=Math.random;
 Math.random=()=>.25;
 try{
  for(let i=0;i<80&&practice.sim.ball.owner===practiceNyx;i++)practice.step();
  assert.ok(practice.sim.ball.owner===slowDefender,'the slow defender actually tackles');
 }finally{Math.random=random;}
 practice.resetPractice('cole');
 const runner=practice.player,x=runner.x;
 practice.input.press('KeyD');practice.input.press('Space');practice.step();
 assert.ok(runner.x>x+3);assert.equal(runner.powerReadyAt,0);
 practice.resetPractice('mendes');
 practicePossession();
 const castInPractice=()=>{
  practice.input.press('Space');practice.step();practice.input.release('Space');
  practice.input.press('MouseLeft');practice.step(14);
  practice.input.release('MouseLeft');practice.step();
 };
 castInPractice();
 assert.ok(Math.abs(practice.sim.ball.curveForce)>1);
 const practiceRune=practice.player;
 const buddy=practice.sim.arcAssist.receiver;
 let returnKick=false;
 for(let i=0;i<150&&practice.sim.ball.owner!==practiceRune;i++){
  practice.step();
  if(practice.sim.ball.lastKicker===buddy){
   returnKick=true;
   assert.ok(practice.sim.arcAssist?.practiceReturning||practice.sim.ball.owner===practiceRune);
  }
 }
 assert.ok(returnKick,'the practice buddy physically kicks the ball back');
 assert.ok(practice.player===practiceRune,"Rune stays controlled after Swerve");
 assert.ok(practice.sim.ball.owner===practiceRune,"Rune gets the ball back after Swerve");
 assert.match(practice.feedback.text,/ready/);
 const position=runner.x;
 castInPractice();
 assert.ok(Math.abs(practice.sim.ball.curveForce)>1,'Swerve can cast again without resetting the pitch');
 assert.equal(practice.sim.teamA.players.filter(p=>!p.isSentOff).length,2);
 for(const level of [1,2]){
  practice.resetPractice('mendes',level);
  practicePossession();
  practice.input.aim={x:1,y:0};
  const arcShotBall=practice.sim.ball;
  practice.input.press('Space');practice.step();practice.input.release('Space');
  practice.input.press('MouseRight');practice.step();
  assert.equal(arcShotBall.owner,practice.player,'holding Shoot keeps possession');
  const shot=practice.sim.arcCast.shot;
  const initialBend=shot.flight.route.bend;
  practice.input.aim={x:0,y:1};
  practice.step(8);
  assert.deepEqual(shot.aim,{x:1,y:0},'steering shapes the bend without moving the locked shot aim');
  const preview=shot.flight;
  assert.ok(Math.abs(preview.route.bend)>Math.abs(initialBend));
  assert.ok(preview.route.bend>0,'steering chooses the side of the opening bend');
  const route=preview.route;
  const sample=t=>samplePassRoute(route,t*route.duration);
  const pace=t=>Math.hypot(sample(t).vx,sample(t).vy);
  assert.ok(pace(.1)<pace(.5)&&pace(.5)<pace(.95),'shot accelerates from wind-up to finish');
  assert.ok(Math.abs(sample(.4).vy)>.1,'shot curves early');
  assert.equal(sample(.85).vy,0,'the finish runs straight toward the aim');
  assert.ok(Math.abs(preview.kick.vx)>Math.abs(preview.kick.vy),'the shot still travels toward the original aim');
  practice.input.aim={x:-1,y:0};
  practice.input.release('MouseRight');practice.step();
  assert.equal(arcShotBall.isShot,true);
  assert.equal(practice.feedback.text,'Swerve Shot');
  assert.ok(Math.abs(arcShotBall.x-preview.preview[1].x)<1e-8);
  assert.ok(Math.abs(arcShotBall.y-preview.preview[1].y)<1e-8);
  practice.step(8);
  assert.ok(Math.abs(arcShotBall.x-preview.preview[9].x)<1e-8);
  assert.ok(Math.abs(arcShotBall.y-preview.preview[9].y)<1e-8);

 }
 practice.resetPractice('mendes');
 practicePossession();
 practice.input.aim={x:1,y:0};
 practice.input.press('Space');practice.step();practice.input.release('Space');
 const movingRune=practice.player;
 const runStart={x:movingRune.x,y:movingRune.y};
 practice.input.press('KeyD');practice.input.press('MouseRight');practice.step(5);
 assert.ok(Math.hypot(movingRune.x-runStart.x,movingRune.y-runStart.y)>.2,'Rune can run while shaping the shot');
 const releaseX=movingRune.x,releaseY=movingRune.y;
 practice.input.release('MouseRight');practice.step();
 assert.ok(Math.hypot(movingRune.x-releaseX,movingRune.y-releaseY)>.01,'Rune keeps running through release');
 assert.equal(practice.sim.ball.isShot,true);
 practice.input.release('KeyD');
 practice.resetPractice('tele-pass');
 practicePossession();
 assert.equal(practice.sim.teamA.getOutfieldPlayers().length,1);
 const teleRune=practice.player;
 assert.equal(practice.sim.teamB.players.filter(p=>!p.isSentOff).length,0);
 for(let i=0;i<2;i++){
  practice.input.aim={x:1,y:0};
  practice.input.press('Space');practice.step();practice.input.release('Space');
  const end=practice.sim.teleCast.end,origin=teleRune.x;
  practice.input.press('MouseLeft');practice.step();practice.input.release('MouseLeft');
  assert.equal(practice.sim.ball.owner,null);
  assert.equal(teleRune.x,origin,'Rune waits for the ball to arrive');
  practice.step(20);
  assert.equal(practice.sim.ball.owner,teleRune);
  assert.ok(Math.abs(teleRune.x-end.x)<1e-6);
 }
 assert.equal(teleRune.powerReadyAt,0);
 practice.resetPractice('tele-pass',2);
 practicePossession();
 const twoLegBall=practice.sim.ball,twoLegRune=practice.player;
 assert.equal(twoLegRune.powerLevel,2);
 const firstSpot={x:twoLegRune.x+5,y:twoLegRune.y-3};
 const secondSpot={x:firstSpot.x+4,y:firstSpot.y+5};
 let aimSpot=firstSpot;
 practice.input.pointer={};
 practice.input.resolvePointerAim=()=>({x:aimSpot.x-twoLegBall.x,y:aimSpot.y-twoLegBall.y});
 practice.input.press('Space');practice.step();practice.input.release('Space');
 const selectSpot=()=>{
  practice.input.press('MouseLeft');practice.step();practice.input.release('MouseLeft');practice.step();
 };
 selectSpot();
 assert.equal(twoLegBall.owner,twoLegRune,'the first click only places a marker');
 assert.ok(Math.abs(practice.sim.teleCast.first.x-firstSpot.x)<1e-6);
 aimSpot=secondSpot;selectSpot();
 assert.equal(twoLegBall.owner,null);
 for(let i=0;i<30&&practice.sim.teleFlight?.next;i++)practice.step();
 assert.ok(Math.abs(twoLegRune.x-firstSpot.x)<1e-6,'Rune reaches the first spot before launching the second leg');
 assert.equal(twoLegBall.owner,null);
 for(let i=0;i<30&&practice.sim.teleFlight;i++)practice.step();
 assert.equal(twoLegBall.owner,twoLegRune);
 assert.ok(Math.hypot(twoLegRune.x-secondSpot.x,twoLegRune.y-secondSpot.y)<1e-6);
 practice.input.resolvePointerAim=null;
 practice.resetPractice('portal-pass');
 practicePossession();
 const portalRune=practice.player;
 assert.equal(practice.sim.teamA.getOutfieldPlayers().length,1);
 assert.ok(practice.sim.teamB.players.every(p=>p.isSentOff));
 practice.input.aim={x:.2,y:-1};
 practice.input.press('Space');practice.step();practice.input.release('Space');
 practice.input.press('MouseRight');practice.step();practice.input.release('MouseRight');
 assert.ok(!practice.sim.teleFlight,'Level 1 Shoot cannot send the ball through a portal');
 for(const [level,kick,side] of [[1,'MouseLeft',-1],[2,'MouseRight',1],[2,'MouseLeft',-1]]){
  practice.resetPractice('portal-pass',level);
  practicePossession();
  practice.input.aim={x:.2,y:side};
  practice.input.press('Space');practice.step();practice.input.release('Space');
  const exit=practice.sim.teleCast.exit;
  const startX=portalRune.x;
  practice.input.press(kick);practice.step();practice.input.release(kick);
  if(kick==='MouseRight'){
   assert.equal(practice.sim.ball.owner,portalRune,'the portal shot waits for release');
   practice.step();
  }
  assert.ok(practice.sim.teleFlight);
  const entry=samplePassRoute(practice.sim.teleFlight.route,0);
  for(let i=0;i<45&&practice.sim.teleFlight;i++)practice.step();
  const ball=practice.sim.ball;
  assert.equal(ball.x,exit.x);
  assert.equal(ball.y,exit.y);
  assert.equal(ball.vx,entry.vx);
  assert.equal(ball.vy,entry.vy);
  assert.equal(ball.vz,entry.vz);
  assert.equal(Math.sign(ball.vy),side);
  assert.equal(ball.isShot,kick==='MouseRight');
  assert.equal(portalRune.x,startX);
  assert.equal(portalRune.powerReadyAt,0);
  Object.assign(ball,{owner:null,x:14,y:7,z:0,vx:0,vy:0,vz:0});
  practice.step(100);
  assert.equal(ball.owner,null);
  assert.deepEqual([ball.x,ball.y],[14,7],'a stopped portal ball stays on the pitch');
 }
 const portalSpeed=(ticks)=>{
  practice.resetPractice('portal-pass',2);practicePossession();
  practice.input.aim={x:.2,y:-1};
  practice.input.press('Space');practice.step();practice.input.release('Space');
  practice.input.press('MouseRight');practice.step(ticks);
  assert.equal(practice.sim.ball.owner,practice.player);
  practice.input.release('MouseRight');practice.step();
  const entry=samplePassRoute(practice.sim.teleFlight.route,0);
  return Math.hypot(entry.vx,entry.vy);
 };
 assert.ok(portalSpeed(14)>portalSpeed(1)+7,'holding Shoot builds portal shot power');
 practice.resetPractice('goal-warp');
 const warpRune=practice.player;
 const warpRivals=practice.sim.teamB.players.filter(p=>!p.isSentOff);
 const warpHome=practice.sim.teamA.getOutfieldPlayers();
 assert.equal(warpHome.length,2);
 assert.equal(warpRivals.length,1);
 for(const p of [warpHome.find(p=>p!==warpRune),warpRivals[0]]){
  assert.ok(p.movementScale>1&&p.stats.speed>=95&&p.stats.shooting>=95);
 }
 const warpGoals=practice.sim.getGoals(),original=warpGoals.right.center.y;
 const castWarp=(x,y)=>{
  practice.input.aim={x,y};
  practice.input.press('Space');practice.step();practice.input.release('Space');
 };
 castWarp(1,-.25);
 assert.ok(!practice.sim.goalWarp,'Level 1 cannot move the opponent goal');
 castWarp(-1,-.3);
 assert.equal(practice.sim.goalWarp.goal,warpGoals.left);
 practice.resetPractice('goal-warp',2);
 practice.sim.pitch.cacheCanvas={width:1};
 practice.input.aim={x:1,y:-.25};
 practice.input.press('Space');practice.step();
 assert.equal(practice.sim.pitch.cacheCanvas,null,'warping invalidates the cached goal art');
 const firstPosition=warpGoals.right.center.y;
 practice.input.aim={x:1,y:-.42};practice.step();
 assert.ok(warpGoals.right.center.y<firstPosition,'holding Space moves the goal with the aim');
 const heldPosition=warpGoals.right.center.y;
 practice.input.release('Space');
 practice.input.aim={x:1,y:.25};practice.step();
 assert.equal(warpGoals.right.center.y,heldPosition,'releasing Space leaves the goal in place');
 assert.ok(warpGoals.right.center.y<original);
 assert.equal(warpGoals.left.center.y,original);
 const moved=warpGoals.right.center.y;
 assert.ok(warpGoals.right.isGoalEvent({prevX:51,x:53,prevY:moved,y:moved,prevZ:0,z:0}));
 assert.ok(!warpGoals.right.isGoalEvent({prevX:51,x:53,prevY:original,y:original,prevZ:0,z:0}));
 const practiceGoalBall=practice.sim.ball;
 Object.assign(practiceGoalBall,{owner:null,prevX:51,x:53,prevY:moved,y:moved,prevZ:0,z:0});
 practice.sim.checkBallCollisions();
 assert.equal(practice.sim.scoreA,0);
 assert.equal(practice.sim.matchState,'play');
 assert.equal(practice.sim.setPieceType,'');
 assert.equal(practiceGoalBall.owner,null);
 assert.deepEqual([practiceGoalBall.x,practiceGoalBall.y],[26,17]);

 castWarp(-1,.38);
 assert.ok(warpGoals.left.center.y>original);
 assert.equal(warpGoals.right.center.y,original);
 assert.equal(practice.sim.goalWarp.until,Time.time+5);
 practice.step(102);
 assert.equal(warpGoals.left.center.y,original);
 assert.equal(warpRune.powerReadyAt,0);
 practice.resetPractice('goal-warp');
 const warpShooter=warpRivals[0],warpBall=practice.sim.ball;
 giveBall(practice.sim,warpShooter,9,17);
 for(let i=0;i<35&&!warpBall.isShot;i++)practice.step();
 assert.ok(warpBall.isShot&&warpBall.lastKicker===warpShooter,'the practice opponent shoots after gaining possession');
 assert.equal(practice.sim.scoreB,0);
 practice.resetPractice('spin-kick');
 const spinner=practice.player;
 const sidelineSlimers=practice.sim.teamB.getOutfieldPlayers();
 assert.equal(sidelineSlimers.length,2);
 assert.ok(sidelineSlimers.every(p=>p.isSlimer));
 assert.deepEqual(sidelineSlimers.map(p=>p.y),[1.5,practice.sim.ball.maxY-1.5]);
 assert.equal(practice.sim.teamA.players.filter(p=>!p.isSentOff).length,1);
 const spinBall=practice.sim.ball;
 const sequenceBefore=spinBall.kickSequence;
 practice.step(110);
 assert.deepEqual([spinBall.x,spinBall.y],[26,17]);
 assert.equal(spinBall.kickSequence,sequenceBefore,'there are no timed crosses');
 const [nearFire,farFire]=practice.sim.practiceFires;
 practice.input.aim={x:1,y:0};
 for(let i=0;i<45&&(Math.hypot(spinBall.x-spinner.x,spinBall.y-spinner.y)>3.2||spinBall.z>1.65);i++)practice.step();
 const seededRandom=Math.random;
 Math.random=()=>.88;
 try{
  practice.input.press('Space');practice.step();practice.input.release('Space');
 }finally{Math.random=seededRandom;}
 assert.ok(Math.abs(spinBall.curveForce)>16,'a high roll produces a strongly bending toe punt');
 assert.ok(nearFire.relightAt>Time.time);
 assert.equal(farFire.relightAt,0);
 assert.equal(spinBall.owner,null);
 assert.ok(Math.hypot(spinBall.vx,spinBall.vy)>24);
 assert.equal(spinner.powerReadyAt,0);
 giveBall(practice.sim,spinner,spinner.x,spinner.y);
 const possessionKick=spinBall.kickSequence;
 practice.input.press('Space');practice.step();practice.input.release('Space');
 assert.equal(spinBall.owner,null);
 assert.equal(spinBall.kickSequence,possessionKick+1);
 assert.equal(spinBall.lastKicker,spinner);
 assert.ok(spinBall.isShot);

 practice.resetPractice('spin-kick',2);
 const spinTwo=practice.player;
 const ally=practice.sim.teamA.getOutfieldPlayers().find(p=>p!==spinTwo);
 const rivals=practice.sim.teamB.getOutfieldPlayers();
 assert.equal(rivals.length,1);
 assert.equal(practice.sim.teamA.getOutfieldPlayers().length,2);
 const [nearEnemy]=rivals;
 assert.ok(ally.movementScale<=.32&&nearEnemy.movementScale<=.32);
 const distanceToSpin=p=>Math.hypot(p.x-spinTwo.x,p.y-spinTwo.y);
 const gaps=[ally,nearEnemy].map(distanceToSpin);
 practice.input.press('Space');practice.step();practice.input.release('Space');
 assert.ok(distanceToSpin(ally)>gaps[0]+3);
 assert.ok(distanceToSpin(nearEnemy)>gaps[1]+3);
 const enemyAfterSpin={x:nearEnemy.x,y:nearEnemy.y};
 practice.step(40);
 assert.ok(Math.hypot(nearEnemy.x-enemyAfterSpin.x,nearEnemy.y-enemyAfterSpin.y)>.1);
 giveBall(practice.sim,ally,ally.x,ally.y);
 practice.step();
 assert.equal(practice.player,spinTwo,'Grum stays controlled when his ally receives');
 const sparringBall=practice.sim.ball;
 Object.assign(sparringBall,{owner:null,prevX:51,x:53,prevY:17,y:17,prevZ:0,z:0});
 practice.sim.checkBallCollisions();
 assert.equal(practice.sim.matchState,'play');
 assert.equal(practice.sim.scoreA,0);
 assert.deepEqual([sparringBall.x,sparringBall.y],[26,17]);
 practice.resetPractice('price');
 assert.equal(practice.sim.teamA.players.filter(p=>!p.isSentOff).length,1);
 const enemies=practice.sim.teamB.players.filter(p=>!p.isSentOff);
 assert.equal(enemies.length,1);
 const opponent=enemies[0];
 for(let i=0;i<60&&!practice.sim.ball.owner;i++)practice.step();
 assert.ok(practice.sim.ball.owner===opponent);
 const start={x:opponent.x,y:opponent.y};
 practice.step(7);
 assert.ok(Math.hypot(opponent.x-start.x,opponent.y-start.y)>.1);
 const barge=practice.player;
 barge.x=opponent.x-1.5;barge.y=opponent.y;practice.input.aim={x:1,y:0};
 practice.input.press('Space');practice.step();practice.input.release('Space');
 for(let i=0;i<15&&practice.sim.bargeCharge;i++)practice.step();
 assert.ok(practice.sim.ball.owner===barge);
 const impact=opponent.x;
 practice.step(3);
 assert.ok(opponent.z>0&&opponent.z<=.45,'barge gives the carrier a small hop');
 practice.step(4);
 assert.ok(opponent.x-impact>3.8&&opponent.x-impact<=4.2+1e-8,'barge knockback stays local');
 assert.equal(opponent.z,0);
 const bargeLanding={x:opponent.x,y:opponent.y};
 assert.ok(opponent.actionTimer>0);
 practice.step(2);
 assert.equal(opponent.x,bargeLanding.x);
 assert.equal(opponent.y,bargeLanding.y);
 practice.step(14);
 assert.ok(Math.hypot(opponent.x-bargeLanding.x,opponent.y-bargeLanding.y)>.2,'runner resumes moving when the stun ends');
 assert.ok(practice.sim.ball.owner===barge);
 assert.match(practice.feedback.text,/Orc Barge stunned/);
 Math.random=()=>.25;
 try{
  for(let i=0;i<30&&practice.sim.ball.owner===barge;i++)practice.step();
  assert.ok(practice.sim.ball.owner===opponent,'the runner presses and takes the ball back');
 }finally{Math.random=random;}
 const recoveryRun={x:opponent.x,y:opponent.y};
 practice.step(10);
 assert.ok(Math.hypot(opponent.x-recoveryRun.x,opponent.y-recoveryRun.y)<1.2,'the runner slows down once carrying');

 for(const level of [1,2]){
  practice.resetPractice('price',level);
  const [carrier]=practice.sim.teamB.getOutfieldPlayers();
  giveBall(practice.sim,carrier,practice.player.x+3.5,practice.player.y);
  carrier.actionTimer=1;
  practice.input.aim={x:1,y:0};
  practice.input.press('Space');practice.step();practice.input.release('Space');
  for(let i=0;i<15&&practice.sim.bargeCharge;i++)practice.step();
  assert.equal(practice.sim.ball.owner,practice.player,'the increased reach hits at 3.5 metres');
  assert.equal(practice.sim.bargeFlights[0].distance,level===2?8.5:4.2);
  assert.ok(level===2?carrier.actionTimer>1.25:carrier.actionTimer<.8);
 }
 const cooldownPractice=await FiveMatch.create('cole',42,{squad:true,practice:true,headless:false});
 for(const [drill,cooldown] of [['cole',8],['price',12],['mendes',10],['tele-pass',12],['portal-pass',12],['goal-warp',6],['spin-kick',9],['smoke-bomb',11],['blaze-slide',10]]){
  cooldownPractice.resetPractice(drill);
  assert.equal(cooldownPractice.player.powerCooldown,cooldown);
  assert.equal(cooldownPractice.player.powerReadyAt,0);
 }
 cooldownPractice.resetPractice('smoke-bomb',2);
 cooldownPractice.input.press('Space');cooldownPractice.step();cooldownPractice.input.release('Space');
 assert.equal(cooldownPractice.player.powerReadyAt,Time.time+11);
 assert.equal(cooldownPractice.player.smokeBoostUntil,Time.time+3.5);
 cooldownPractice.input.press('Space');cooldownPractice.step();cooldownPractice.input.release('Space');
 assert.equal(cooldownPractice.feedback.text,'Smoke Bomb recharging');
 assert.equal(cooldownPractice.sim.smokeClouds.length,1);
 const smokeReadyAt=cooldownPractice.player.powerReadyAt;
 cooldownPractice.resetPractice('blaze-slide');
 cooldownPractice.resetPractice('smoke-bomb',1);
 assert.equal(cooldownPractice.player.powerReadyAt,smokeReadyAt);
 cooldownPractice.input.press('Space');cooldownPractice.step();cooldownPractice.input.release('Space');
 assert.equal(cooldownPractice.feedback.text,'Smoke Bomb recharging');
 assert.equal(cooldownPractice.sim.smokeClouds.length,0);

 practice.resetPractice('smoke-bomb',2);
 const smokeRogue=practice.player,smokeEnemy=practice.sim.teamB.getOutfieldPlayers()[0];
 practice.input.press('Space');practice.step();practice.input.release('Space');practice.step();
 assert.ok(smokeEnemy.smokeBlind&&smokeEnemy.hazardTarget);
 assert.ok(smokeRogue.smokeBoostUntil>Time.time&&!smokeRogue.smokeBlind);
 smokeEnemy.x=40;practice.step();
 assert.equal(smokeEnemy.smokeBlind,false);

 practice.resetPractice('blaze-slide');
 const slider=practice.player;
 const flameRival=practice.sim.teamB.getOutfieldPlayers()[0];
 const flameAlly=practice.sim.teamA.getOutfieldPlayers().find(p=>p!==slider);
 flameRival.x=slider.x+.8;flameRival.y=slider.y+.3;
 flameAlly.x=slider.x+1;flameAlly.y=slider.y-.3;
 practice.input.aim={x:1,y:0};
 practice.input.press('Space');practice.step();practice.input.release('Space');
 for(let i=0;i<8&&(!flameAlly.burningUntil||!flameRival.burningUntil);i++)practice.step();
 assert.ok(flameAlly.burningUntil>Time.time&&flameRival.burningUntil>Time.time);
 assert.ok(flameAlly.hazardTarget&&flameRival.hazardTarget);
 assert.ok(practice.sim.blazeTrails[0].until-Time.time>2.7);
 practice.step(75);
 assert.equal(practice.sim.blazeTrails.length,0);
 assert.ok(flameAlly.burningUntil<=Time.time&&flameRival.burningUntil<=Time.time);

 const noSlide=await setup('cole');
 const opposingCarrier=noSlide.sim.teamB.getOutfieldPlayers()[0];
 giveBall(noSlide.sim,opposingCarrier,20,17);
 noSlide.player.x=18;noSlide.player.y=17;
 press(noSlide,'KeyL');
 assert.equal(noSlide.player.isSliding,false);
 assert.equal(noSlide.sim.ball.owner,opposingCarrier);
 assert.equal(Settings.AI.A.ALLOW_SLIDE_TACKLES,false);
 assert.equal(Settings.AI.B.ALLOW_SLIDE_TACKLES,false);

 const dashGame=await setup('cole');
 const dashPlayer=dashGame.player;
 dashPlayer.powerLevel=2;giveBall(dashGame.sim,dashPlayer,16,17);
 dashGame.input.press('KeyD');
 press(dashGame,'Space');
 const dashFirst=dashPlayer.x;
 assert.ok(dashFirst>20);
 press(dashGame,'Space');
 assert.ok(dashPlayer.x>dashFirst+4);
 const dashSecond=dashPlayer.x;
 press(dashGame,'Space');
 assert.equal(dashPlayer.x,dashSecond);
 dashGame.sim.cooldownsOff=true;
 press(dashGame,'Space');
 assert.ok(dashPlayer.x>dashSecond+4);
 const boarded=await setup('cole');
 const {sim:boardSim}=boarded,boardBall=boardSim.ball;
 for(const top of [true,false]){
  Object.assign(boardBall,{owner:null,x:25,y:top?.3:33.7,z:1,vx:2,vy:top?-12:12,vz:0});
  const prediction=predict3D(boardBall,Time.deltaTime);
  boardBall.update();boardSim.checkBallCollisions();
  assert.ok(boardBall.y>0&&boardBall.y<34);
  assert.equal(Math.sign(boardBall.vy),top?1:-1);
  assert.ok(Math.abs(boardBall.y-prediction.y)<1e-9);
  assert.equal(boardSim.matchState,'play','the ball stays in play after a wall rebound');
 }
 for(const side of ['left','right']){
  const left=side==='left';
  const vx=left?-16:16;
  for(const [y,z] of [[6,0],[17,4]]){
   Object.assign(boardBall,{owner:null,x:left?.4:51.6,y,z,vx,vy:0,vz:0,passRoute:null});
   const prediction=predict3D(boardBall,Time.deltaTime);
   boardBall.update();boardSim.checkBallCollisions();
   assert.equal(boardSim.matchState,'play');
   assert.equal(boardSim.setPieceType,'');
   assert.equal(Math.sign(boardBall.vx),-Math.sign(vx));
   assert.ok(Math.abs(boardBall.x-prediction.x)<1e-9);
  }
  Object.assign(boardBall,{owner:null,x:left?.4:51.6,y:17,z:0,vx,vy:0,vz:0,passRoute:null});
  boardBall.update();boardSim.checkBallCollisions();
  assert.equal(boardSim.matchState,'goal','the opening still scores on either end');
  assert.equal(boardSim.stateTimer,1.5);
  boardSim.fsm.setCurrentState(MatchStates.Play);
  boardSim.matchState='play';boardSim.setPieceType='';
 }

 async function cursorKick(code,restart,withReceiver=false,holdTicks=8,driven=true){
  const game=await setup('mendes');
  game.headless=false;
  const {sim,input}=game;
  sim.drivenGroundPasses=driven;
  const previous=game.player,player=restart==='goalkick'||restart==='keeper'?sim.teamA.players[0]:previous;
  for(const p of sim.players){p.x=4;p.y=p.team==='A'?30:2;}
  giveBall(sim,player,25,restart==='throwin'?.6:15);
  if(restart==='keeper')grantGkPossession(player,sim.ball);
  const cursor={x:17,y:23};
  if(withReceiver){
   const receiver=sim.teamA.players[2];
   receiver.x=cursor.x;receiver.y=cursor.y;
  }
  input.pointer={};
  input.resolvePointerAim=()=>({x:cursor.x-sim.ball.x,y:cursor.y-sim.ball.y});
  const restartStates={freekick:MatchStates.Freekick,goalkick:MatchStates.Goalkick,
   throwin:MatchStates.Throwin,corner:MatchStates.Corner,penalty:MatchStates.Penalty};
  sim.fsm.setCurrentState(restartStates[restart]||MatchStates.Play);
  if(restartStates[restart]){
   if(restart==='throwin'){
    sim._setPieceBallSpot={x:25,y:.6};
    sim.throwInTaker=player;
   }
   if(restart==='corner'){
    sim._setPieceBallSpot={x:.6,y:.6};
    sim.setPieceSide='left';
    sim.setPieceCornerY=0;
   }
   sim.setPieceType=restart;
   sim.setPieceIndirect=restart==='freekick'&&code==='KeyJ';
   sim.setPieceKickingTeam='A';
   sim.stateTimer=0;
   game.step(30);
   assert.equal(sim.matchState,restart,'our restart waits for input');
   assert.ok(sim.ball.owner===player);
  }
  let launch;
  const kick=sim.ball.kick.bind(sim.ball);
  sim.ball.kick=(vx,vy,vz,curve)=>{
   launch={vx,vy,vz,curve,kicker:sim.ball.owner,dx:cursor.x-sim.ball.x,dy:cursor.y-sim.ball.y};
   return kick(vx,vy,vz,curve);
  };
  input.press(code);game.step(holdTicks);
  input.release(code);
  for(let i=0;i<30&&!launch;i++)game.step();
  assert.ok(launch,'cursor kick releases the ball');
  const cross=launch.vx*launch.dy-launch.vy*launch.dx;
  assert.ok(Math.abs(cross)<1e-6,'launch follows the cursor ray from the ball');
  assert.ok(launch.vx*launch.dx+launch.vy*launch.dy>0);
  assert.equal(launch.curve,0);
  if(restart)assert.equal(sim.setPieceType,'');
  if(restart==='freekick'&&code==='KeyJ')assert.equal(sim.ball.ifkActive,true);
  if(restart==='keeper')assert.ok(launch.kicker===player&&launch.vz>0&&!sim.ball.isShot);
  if(restart==='throwin')assert.ok(sim.ball.isThrowInFlight&&launch.vz>0);
  if(restart==='goalkick'){
   assert.ok(game.player.role!=='GK');
   assert.equal(launch.vz>0,code!=='KeyJ');
  }
  return Math.hypot(launch.vx,launch.vy);
 }
 await cursorKick('KeyK',false);
 await cursorKick('KeyJ',false,true);
 await cursorKick('KeyL',false);
 await cursorKick('KeyK','freekick');
 await cursorKick('KeyJ','freekick');
 await cursorKick('KeyJ','goalkick',true);
 await cursorKick('KeyK','goalkick');
 await cursorKick('MouseRight','keeper');
 await cursorKick('MouseLeft','throwin');
 await cursorKick('KeyJ','throwin',true);
 await cursorKick('KeyK','penalty');
 await cursorKick('KeyL','corner');
 const defense=await setup('price');
 const keeper=defense.sim.teamA.players[0],attacker=defense.sim.teamB.players[1];
 giveBall(defense.sim,attacker,12,17);
 press(defense,'KeyG');
 assert.ok(defense.player===keeper,'G selects the goalkeeper while defending');
 const startX=keeper.x;
 defense.input.press('KeyD');tickManualControl(defense.sim);keeper.update();
 assert.ok(keeper.x>startX,'the selected keeper responds to movement');
 defense.input.release('KeyD');
 const ball=defense.sim.ball;
 ball.kick(-8,0,0);ball.x=keeper.x+4;ball.y=keeper.y;
 press(defense,'MouseLeft');
 press(defense,'MouseRight');
 assert.equal(keeper.fsm.getNameOfCurrentState(),'Goalkeeper');
 press(defense,'KeyL');
 assert.equal(keeper.fsm.getNameOfCurrentState(),'GkDive');
 press(defense,'KeyG');
 assert.ok(defense.player!==keeper,'G returns control to the outfield');

 const oldTap=await cursorKick('KeyJ',false,false,0,false);
 const tap=await cursorKick('KeyJ',false,false,0);
 const charged=await cursorKick('KeyJ',false,false,12);
 assert.ok(tap>oldTap*1.4,'ground pass taps launch at least 40% faster');
 assert.ok(charged>tap*1.2,'holding still gives the pass more speed');
 console.info('Fantasy cup progression, defender switching, powered moves, and curved pass flight passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
