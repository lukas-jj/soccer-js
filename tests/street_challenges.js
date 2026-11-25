require('./mock_env.js');
const assert=require('node:assert/strict');
const {FantasyRun}=require('../kernel/five/cup.js');
const {FiveMatch}=require('../kernel/five/match.js');
const {rollStreetChallenger}=require('../kernel/five/street_challenges.js');
const {tryClaimLooseBall}=require('../kernel/core/entities/player.js');
const {Time}=require('../kernel/core/lib/time.js');

function openEvent(seed){
 const run=new FantasyRun(seed);
 run.status='route';
 assert.ok(run.choose('event'));
 assert.equal(run.status,'event');
 return run;
}

async function createChallenge(kind,seed,player,gear=[]){
 return FiveMatch.create(player.characterId,seed,{
  headless:true,squad:true,practice:true,sandbox:'street',streetChallenge:kind,gear,
  roster:[player],matchup:{home:1,away:kind==='duel'?2:1,awayKeeper:kind==='duel'},
  opponent:kind==='duel'?rollStreetChallenger(seed):undefined
 });
}

(async()=>{
 const bardRun=new FantasyRun(12,'cole','dash');
 assert.ok(bardRun.previewEvent('A Song for the Road'));
 assert.ok(bardRun.chooseEvent(0));
 const bard=bardRun.roster.find(player=>player.bard);
 assert.ok(Object.values(bard.stats).every(value=>value===10));
 const bardMatch=await FiveMatch.create('cole',12,{headless:true,squad:true,roster:bardRun.roster,opponent:bardRun.opponent});
 const players=bardMatch.sim.teamA.players;
 const speed=players.map(player=>player.stats.speed);
 bardMatch.club.goal('A',players[0]);
 assert.deepEqual(players.map(player=>player.stats.speed),speed.map(value=>value+10));
 assert.equal(bard.stats.speed,10,'the live boost does not change the roster');
 bardMatch.destroy();
 const chantRun=new FantasyRun(12);
 chantRun.previewEvent('A Song for the Road');
 const startingGold=chantRun.gold;
 assert.ok(chantRun.chooseEvent(1));
 assert.equal(chantRun.gold,startingGold-150);
 assert.ok(chantRun.gear.includes('bard'));
 const curses=new Map();
 for(let i=0;i<128&&curses.size<3;i++){
  const run=new FantasyRun(Math.imul(i,2654435761),'cole','dash');
  run.previewEvent('A Song for the Road');
  assert.ok(run.chooseEvent(2));
  assert.equal(run.finishRoute(),false);
  assert.ok(run.chooseBardCurse(0));
  curses.set(run.bardCurse.kind,run);
 }
 assert.equal(curses.size,3);
 for(const [kind,run] of curses){
  const match=await FiveMatch.create('cole',run.matchSeed,{
   headless:true,squad:true,roster:run.roster,opponent:run.opponent,bardCurse:run.bardCurse
  });
  if(kind==='speed')assert.equal(match.starter.movementScale,.5);
  if(kind==='ability')assert.ok(!match.powerFor(match.starter));
  if(kind==='stamina'){
   assert.equal(match.starter.stats.stamina,0);
   match.updateSprintReserve(false);
   assert.equal(match.starter.sprint.reserve,0);
  }
  assert.ok(run.startMatch());
  run.finish(0,0);
  assert.equal(run.bardCurse,null);
  match.destroy();
 }

 const specials=new Map(),texts=new Set(),challengers=new Set(),strengths=new Set();
 for(let i=0;i<1024;i++){
  const seed=Math.imul(i,2654435761)>>>0;
  const event=openEvent(seed).event;
  if(event.challenge||event.choices.some(choice=>choice.kickUpTarget)){
   specials.set(event.name,(specials.get(event.name)??0)+1);
  }else texts.add(event.name);
  const rival=rollStreetChallenger(seed);
  assert.ok(rival.quality.stats>=14);
  challengers.add(rival.name);
  strengths.add(rival.quality.name);
 }
 assert.equal(specials.size,3);
 assert.ok(specials.get('Street 1v1')>[...specials.values()].reduce((a,b)=>a+b,0)/2);
 assert.equal(texts.size,7);
 assert.ok(challengers.size>10);
 assert.equal(strengths.size,3);

 const duelRun=openEvent(0);
 assert.equal(duelRun.event.name,'Street 1v1');
 assert.ok(duelRun.beginEventChallenge());
 assert.equal(duelRun.beginEventChallenge(),false);
 assert.equal(duelRun.finishRoute(),false);
 const duel=await createChallenge('duel',duelRun.matchSeed,duelRun.roster[0]);
 const challenge=duel.streetChallenge,{ball}=duel.sim;
 assert.equal(ball.maxX,34);
 assert.equal(ball.maxY,26);
 assert.equal(duel.sim.teamA.getGoalkeeper(),null);
 assert.equal(challenge.keeper.stats.goalkeeping,66);
 duel.headless=false;
 duel.step(20);
 assert.equal(ball.owner,duel.starter,'the defender checks the ball to the user');
 assert.ok(duel.secondsLeft>9&&duel.secondsLeft<=10);
 ball.owner=challenge.defender;
 duel.step();
 assert.equal(challenge.phase,'live','a tackle leaves the attack live');
 assert.equal(challenge.index,0);
 const defender=challenge.defender;
 Object.assign(defender,{x:6,y:8});
 Object.assign(challenge.attacker,{x:18,y:8});
 ball.syncToOwner();
 duel.step(10);
 assert.ok(Math.hypot(defender.x-6,defender.y-8)>.5,'the defender carries away instead of waiting in the corner');
 Object.assign(challenge.attacker,{x:defender.x+1.6,y:defender.y});
 challenge.usedPower=true;
 duel.step();
 assert.equal(ball.lastKicker,defender,'the defender clears when the attacker presses');
 assert.equal(ball.owner,null);
 const secondsBeforeSave=duel.secondsLeft;
 ball.owner=challenge.keeper;
 challenge.keeper.gkHoldTimer=1;
 duel.step();
 assert.equal(challenge.phase,'check');
 duel.step(20);
 assert.equal(challenge.phase,'live');
 assert.ok(duel.secondsLeft<secondsBeforeSave,'a restart preserves the running clock');
 const {goal}=challenge;
 const beforeRebounds=duel.secondsLeft;
 challenge.keeper.isSentOff=true;
 challenge.rival.actionTimer=1;
 for(const [x,y,z,vx,vy,axis] of [
  [goal.lineX-.1,goal.yMax+4,.35,14,0,'vx'],
  [goal.lineX-.1,goal.center.y,goal.height+2,14,0,'vx'],
  [.1,goal.center.y,.35,-14,0,'vx'],
  [ball.maxX/2,.1,.35,0,-14,'vy'],
  [ball.maxX/2,ball.maxY-.1,.35,0,14,'vy']
 ]){
  ball.kick(vx,vy,0);
  Object.assign(ball,{x,y,z});
  ball.capturePrevPosition();
  duel.step();
  assert.ok(ball[axis]*(axis==='vx'?vx:vy)<0,JSON.stringify({wall:[x,y,z],vx:ball.vx,vy:ball.vy,x:ball.x,y:ball.y,owner:ball.owner?.name,phase:challenge.phase}));
  assert.ok(ball.x>=0&&ball.x<=ball.maxX&&ball.y>=0&&ball.y<=ball.maxY);
  assert.equal(challenge.phase,'live','a wall rebound keeps the attack live');
  assert.equal(challenge.index,0);
 }
 assert.ok(duel.secondsLeft<beforeRebounds);
 challenge.keeper.isSentOff=false;
 ball.owner=challenge.defender;
 for(let step=0;step<240&&challenge.phase!=='result';step++)duel.step();
 assert.equal(challenge.message,'Time up');
 assert.equal(duel.secondsLeft,0);
 for(let step=0;step<40&&challenge.index===0;step++)duel.step();
 assert.equal(challenge.phase,'check');
 assert.equal(challenge.attacking,false);
 duel.step(20);
 assert.equal(ball.owner,challenge.rival,'the challenger receives on the next turn');
 challenge.keeper.actionTimer=1;
 ball.kick(12,0,0);
 Object.assign(ball,{x:challenge.goal.lineX-.2,y:challenge.goal.center.y,z:.35});
 duel.step();
 assert.equal(duel.sim.scoreB,1);
 const scoredX=ball.x;
 duel.step(3);
 assert.notEqual(ball.x,scoredX,'the ball moves in the net during the celebration');
 assert.ok(challenge.rival.z>0,'the scorer celebrates');
 const goalTurn=challenge.index;
 for(let step=0;step<40&&challenge.nextAt-Time.time>1;step++)duel.step();
 assert.equal(challenge.phase,'result','the goal celebration gets time to breathe');
 assert.equal(challenge.transitionCover,0);
 for(let step=0;step<40&&challenge.transitionCover<.5;step++)duel.step();
 assert.equal(challenge.phase,'result','the court fades before players are repositioned');
 for(let step=0;step<20&&challenge.index===goalTurn;step++)duel.step();
 assert.equal(challenge.phase,'check');
 assert.equal(challenge.transitionCover,1,'the next turn is set up with the court covered');
 duel.step(3);
 assert.ok(challenge.transitionCover>0&&challenge.transitionCover<1,'the check pass fades in');
 const gold=duelRun.gold;
 assert.equal(duelRun.finishEventChallenge({home:1,away:1}),0);
 assert.equal(duelRun.gold,gold);
 assert.ok(['tonic','whistle','water'].includes(duelRun.duelConsolation));
 assert.equal(duelRun.items[duelRun.duelConsolation],1);
 assert.equal(duelRun.finishEventChallenge({home:3,away:0}),false);
 assert.equal(duelRun.status,'ready');
 for(let step=0;step<1800&&!challenge.done;step++)duel.step();
 assert.ok(challenge.done);
 assert.ok(challenge.index>=4&&challenge.index<=6,'the duel ends after equal attacks');
 assert.equal(challenge.index%2,0);
 duel.destroy();

 const crossbarRun=openEvent(1103);
 assert.equal(crossbarRun.event.name,'Crossbar Challenge');
 assert.ok(crossbarRun.beginEventChallenge());
 crossbarRun.roster[0].stats.shotAccuracy=100;
 const crossbar=await createChallenge('crossbar',crossbarRun.matchSeed,crossbarRun.roster[0]);
 const target=crossbar.streetChallenge;
 assert.equal(crossbar.starter.effectiveShotAccuracy,100);
 assert.equal(crossbar.sim.manualAimUsesAccuracy,true);
 crossbar.headless=false;
 const startX=crossbar.starter.x;
 crossbar.input.press('KeyD');
 crossbar.step(10);
 assert.ok(crossbar.starter.x>startX,'the shooter can dribble before taking an attempt');
 assert.ok(crossbar.sim.ball.owner===crossbar.starter);
 assert.equal(target.index,0);
 target.resetAttempt();
 const shootingSpot={x:crossbar.starter.x,y:crossbar.starter.y,orientation:2};
 const collectBall=game=>{
  const key=game.starter.x>game.sim.ball.x?'KeyA':'KeyD';
  game.input.press(key);
  for(let step=0;step<240&&game.streetChallenge.phase==='collect';step++)game.step();
  game.input.release(key);
  assert.ok(game.sim.ball.owner===game.starter,'the player can walk to midfield and claim the new ball: '+JSON.stringify([game.starter.x,game.starter.y,game.sim.ball.x,game.sim.ball.y,game.sim.ball.z,game.streetChallenge.phase]));
  assert.equal(game.streetChallenge.phase,'ready');
 };
 for(let attempt=0;attempt<3;attempt++){
  const outgoing=crossbar.sim.ball;
  crossbar.input.press('KeyK');
  crossbar.step(10);
  crossbar.input.release('KeyK');
  for(let step=0;step<100&&target.phase!=='rebound';step++)crossbar.step();
  assert.equal(target.status,'Hit');
  const impactX=outgoing.x;
  crossbar.step(5);
  assert.notEqual(outgoing.x,impactX,'the ball keeps moving after contact');
  const shooter={x:crossbar.starter.x,y:crossbar.starter.y,orientation:crossbar.starter.orientation};
  for(let step=0;step<100&&target.index===attempt;step++)crossbar.step();
  assert.equal(target.index,attempt+1,'each shot uses one attempt');
  assert.deepEqual({x:crossbar.starter.x,y:crossbar.starter.y,orientation:crossbar.starter.orientation},shooter);
  if(attempt===2)break;
  const fresh=crossbar.sim.ball;
  assert.equal(target.phase,'collect');
  assert.ok(fresh!==outgoing&&target.spentBalls[attempt]===outgoing);
  assert.deepEqual([fresh.x,fresh.y,fresh.owner],[fresh.maxX/2,fresh.maxY/2,null]);
  assert.ok(fresh.z>0,'the next ball starts above the center spot');
  assert.equal(crossbar.sim.children.includes(outgoing),false,'the spent ball is outside the playable entity tree');
  assert.equal(tryClaimLooseBall(crossbar.starter,outgoing),false);
  const droppedAt=fresh.z;
  crossbar.step();
  assert.ok(fresh.z<droppedAt);
  Object.assign(outgoing,{x:shooter.x,y:shooter.y,z:0,vx:0,vy:0,vz:0});
  crossbar.input.press('KeyK');crossbar.step(10);crossbar.input.release('KeyK');
  assert.ok(fresh.lastKicker===null,'shooting near a spent ball has no effect');
  assert.equal(outgoing.owner,null,'the spent ball stays unclaimed under the player');
  collectBall(crossbar);
  Object.assign(crossbar.starter,shootingSpot);
  fresh.syncToOwner();
 }
 assert.ok(target.done);
 assert.equal(target.hits,3);
 assert.equal(crossbarRun.finishEventChallenge({...target.result,crossbarGold:300}),300,'the newly earned relic does not pay retroactively');
 assert.ok(crossbarRun.gear.includes('crossbar'),'a perfect challenge awards the relic');
 const priorGold=crossbarRun.gold;
 assert.ok(crossbarRun.startMatch());
 crossbarRun.finish(0,1,'B',65,[],100);
 assert.equal(crossbarRun.gold,priorGold+100,'the relic pays even when the team loses');
 crossbar.destroy();

 const missedRun=openEvent(1103);
 assert.ok(missedRun.beginEventChallenge());
 const missed=await createChallenge('crossbar',missedRun.matchSeed,missedRun.roster[0]);
 const missSpot={x:missed.starter.x,y:missed.starter.y,orientation:2};
 missed.headless=false;
 missed.sim.manualAimUsesAccuracy=false;
 for(let attempt=0;attempt<3;attempt++){
  missed.input.press('KeyK');missed.step(40);missed.input.release('KeyK');
  for(let step=0;step<100&&missed.streetChallenge.phase!=='rebound';step++)missed.step();
  assert.equal(missed.streetChallenge.status,'Miss','full power overshoots from the opening position');
  const missedBall=missed.sim.ball,goalLine=missed.streetChallenge.goal.lineX;
  assert.ok(missedBall.x>goalLine&&missedBall.vx>0,'the miss travels through the end line');
  let bounced=false;
  for(let step=0;step<25&&missed.streetChallenge.phase==='rebound';step++){
   missed.step();
   if(missedBall.x>goalLine&&missedBall.z===0&&missedBall.vz>0)bounced=true;
  }
  assert.ok(bounced,'the miss bounces off the ground behind the goal');
  for(let step=0;step<100&&!missed.streetChallenge.done&&missed.streetChallenge.index===attempt;step++)missed.step();
  if(attempt<2){
   collectBall(missed);
   Object.assign(missed.starter,missSpot);
   missed.sim.ball.syncToOwner();
  }
 }
 assert.equal(missed.streetChallenge.hits,0);
 missed.destroy();
 const offTarget=await createChallenge('crossbar',missedRun.matchSeed,missedRun.roster[0]);
 offTarget.headless=false;
 offTarget.input.press('KeyW');offTarget.step(8);offTarget.input.release('KeyW');offTarget.step();
 const shootingPosition={x:offTarget.starter.x,y:offTarget.starter.y};
 offTarget.input.aim={x:1,y:.7};
 offTarget.input.press('KeyK');offTarget.step(9);offTarget.input.release('KeyK');
 for(let step=0;step<100&&offTarget.streetChallenge.phase!=='rebound';step++)offTarget.step();
 assert.equal(offTarget.streetChallenge.status,'Miss');
 for(let step=0;step<100&&offTarget.streetChallenge.phase==='rebound';step++)offTarget.step();
 assert.equal(offTarget.streetChallenge.phase,'collect');
 assert.equal(offTarget.sim.ball.owner,null);
 assert.deepEqual({x:offTarget.starter.x,y:offTarget.starter.y},shootingPosition,'the player stays in their chosen position');
 assert.deepEqual(offTarget.input.aim,{x:1,y:.7},'dropping the ball preserves aim');
 assert.equal(missedRun.finishEventChallenge({hits:2}),100);
 assert.ok(!missedRun.gear.includes('crossbar'));
 offTarget.destroy();

 const relicRun=openEvent(0);
 relicRun.gear.push('crossbar');
 assert.ok(relicRun.beginEventChallenge());
 const relicDuel=await createChallenge('duel',relicRun.matchSeed,relicRun.roster[0],relicRun.gear);
 relicDuel.headless=false;
 relicDuel.step(20);
 relicDuel.streetChallenge.keeper.isSentOff=true;
 const duelBall=relicDuel.sim.ball,duelGoal=relicDuel.streetChallenge.goal;
 const shootAtBar=()=>{
  duelBall.owner=relicDuel.starter;
  Object.assign(duelBall,{x:duelGoal.lineX-.7,y:duelGoal.center.y,z:duelGoal.height});
  duelBall.kick(32,0,0);
  relicDuel.step();
 };
 shootAtBar();
 assert.equal(relicDuel.club.crossbarGold,100,'a real 1v1 crossbar collision pays the relic');
 relicDuel.step();
 relicDuel.sim.onCrossbarHit(duelGoal,duelBall);
 assert.equal(relicDuel.club.crossbarGold,100,'later contacts from the same kick do not pay again');
 shootAtBar();
 assert.equal(relicDuel.club.crossbarGold,200,'a new kick can earn another reward');
 assert.equal(relicRun.finishEventChallenge({home:0,away:1,crossbarGold:relicDuel.club.crossbarGold}),200);
 assert.equal(relicRun.finishEventChallenge({crossbarGold:200}),false,'event gold can only be settled once');
 relicDuel.destroy();
 const forfeitedRun=openEvent(0);
 forfeitedRun.gear.push('crossbar');
 assert.ok(forfeitedRun.beginEventChallenge());
 assert.equal(forfeitedRun.finishEventChallenge({forfeited:true,crossbarGold:200}),0);
 assert.deepEqual(forfeitedRun.items,{});
 for(const choice of ['gold','recruit']){
  const winner=openEvent(0);
  const challenger=winner.duelChallenger;
  const startingGold=winner.gold,starterNumber=winner.roster[0].number;
  assert.ok(winner.beginEventChallenge());
  assert.equal(winner.finishEventChallenge({home:2,away:1}),0);
  assert.equal(winner.gold,startingGold);
  assert.equal(winner.finishRoute(),false,'the winner must choose a reward before the next match');
  assert.equal(winner.beginEventChallenge(),false);
  assert.ok(winner.chooseDuelReward(choice));
  assert.equal(winner.chooseDuelReward(choice),false,'only one reward can be collected');
  assert.equal(winner.status,'ready');
  assert.equal(winner.gold,startingGold+(choice==='gold'?250:0));
  assert.equal(winner.roster.length,choice==='recruit'?2:1);
  if(choice==='recruit'){
   const signed=winner.roster[1];
   assert.equal(signed.name,challenger.name);
   assert.equal(signed.power,challenger.power);
   assert.equal(signed.appearance,challenger.appearance);
   assert.notEqual(signed.number,starterNumber);
   assert.deepEqual(signed.stats,challenger.stats);
  }
 }
 const fullSquad=openEvent(0);
 fullSquad.roster=Array(5).fill(fullSquad.roster[0]);
 assert.ok(fullSquad.beginEventChallenge());
 fullSquad.finishEventChallenge({home:1});
 assert.equal(fullSquad.chooseDuelReward('recruit'),false);
 assert.ok(fullSquad.chooseDuelReward('gold'));

 const training=await FiveMatch.create('cole',42,{squad:true,practice:true,headless:true,gear:['crossbar']});
 training.sim.ball.lastKicker=training.starter;
 training.sim.onCrossbarHit(training.sim.getGoals().right,training.sim.ball);
 assert.equal(training.club.crossbarGold,0,'training cannot earn relic gold');
 training.destroy();
 console.info('Street challenges and event categories passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
