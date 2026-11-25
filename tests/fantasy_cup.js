require('./mock_env.js');
const assert=require('node:assert/strict');
const {FantasyRun,RUN_LENGTH,GOBLIN_TEAM,HORDE_FC,FROST_GIANTS,SHAPESHIFTERS,OPPONENTS,generateEncounter}=require('../kernel/five/cup.js');
const {FiveMatch,CHARACTERS}=require('../kernel/five/match.js');
const {MatchStates}=require('../kernel/providers/simulator/simulator.js');
const {Settings}=require('../kernel/settings.js');
const {Time}=require('../kernel/core/lib/time.js');
const {Player,PlayerStates,attemptTackle,grantGkPossession}=require('../kernel/core/entities/player.js');
const {tickManualControl}=require('../kernel/core/lib/manual_control.js');
const {usePower,characterPower,updateBargeCharge}=require('../kernel/five/powers.js');
const {teamMoveUnlocks,crossIsReady}=require('../kernel/five/team_moves.js');
const {tryBallShotBlocking}=require('../kernel/core/lib/pass_safety.js');
const {predict3D,samplePassRoute}=require('../kernel/core/lib/ball_prediction.js');
const {updateSlimers,updateSlimerSlows,stepSlimeShots,stepStreaker,streakerGuards}=require('../kernel/five/slimers.js');
const {updateHordeFC}=require('../kernel/five/horde_fc.js');
const {KickUps}=require('../kernel/apps/soccer-rogue/kick_ups.js');
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
function kickOff(run){
 return run.startMatch();
}
(async()=>{
 const cup=new FantasyRun(8);
 assert.equal(cup.roster[0].characterId,'cole');
 assert.ok(cup.roster[0].number>=1&&cup.roster[0].number<=100);
 assert.ok(cup.opponent.count>=1&&cup.opponent.count<=5&&cup.opponent.bonus<=-25);
 assert.equal(cup.status,'ready');
 assert.deepEqual(cup.upgradeCards,[]);
 assert.equal(cup.claimUpgrade(0),false);
 assert.ok(kickOff(cup));
 assert.equal(cup.status,'playing');
 assert.equal(cup.startMatch(),false,'a fixture starts once');
 const openingGold=cup.gold;
 cup.finish(1,0);
 assert.equal(cup.status,'between');
 assert.equal(cup.gold-openingGold,145);
 assert.equal(cup.lastPoints,3);
 assert.equal(cup.upgradeCards.length,3);
 const sameSeed=new FantasyRun(8);
 kickOff(sameSeed);sameSeed.finish(1,0);
 assert.deepEqual(cup.upgradeCards,sameSeed.upgradeCards);
 assert.ok(cup.upgradeCards.every(card=>card.kind==='stat'&&card.playerIndex===0));
 assert.equal(cup.choose('rest'),false,'claim an upgrade before leaving the results');
 const statIndex=cup.upgradeCards.findIndex(card=>card.kind==='stat');
 const firstCard=cup.upgradeCards[statIndex];
 assert.ok(cup.claimUpgrade(statIndex));
 assert.equal(cup.roster[0].stats[firstCard.stat],firstCard.next);
 assert.equal(cup.claimUpgrade(1),false);
 assert.deepEqual(cup.offers,[]);
 assert.ok(cup.choose('rest'));
 assert.ok(cup.enterTavern());
 assert.equal(cup.status,'tavern');
 assert.equal(cup.enterTavern(),false);
 assert.equal(cup.choose('rest'),false);
 assert.equal(cup.offers.length,4);
 assert.equal(new Set(cup.offers.map(p=>p.id)).size,4);
 const balance=cup.gold;
 cup.finish(1,0);
 assert.equal(cup.gold,balance,'result only pays once');
 assert.equal(cup.choose('unknown'),false);
 assert.equal(cup.choose('train'),false);
 const recruit=cup.offers.find(p=>p.price<=cup.gold);
 const preview=cup.nextOpponent;
 assert.ok(cup.choose(recruit.id));
 assert.equal(cup.gold,balance-recruit.price);
 assert.ok(cup.choose('continue'));
 assert.equal(cup.round,1);
 assert.equal(cup.roster[1],recruit);
 assert.notEqual(cup.roster[0].number,recruit.number);
 assert.deepEqual(cup.opponent,preview);
 assert.equal(cup.opponent.id,HORDE_FC.id);
 assert.ok(kickOff(cup));
 cup.finish(3,0);
 assert.equal(cup.upgradeCards.length,3);
 assert.deepEqual(new Set(cup.upgradeCards.map(card=>card.playerIndex)),new Set([0,1]));
 const recruitChoice=cup.upgradeCards.findIndex(card=>card.playerIndex===1);
 const chosen=cup.upgradeCards[recruitChoice];
 const starterStats={...cup.roster[0].stats};
 const powers=cup.roster.map(player=>player.power);
 assert.ok(cup.claimUpgrade(recruitChoice));
 assert.equal(recruit.stats[chosen.stat],chosen.next);
 assert.deepEqual(cup.roster[0].stats,starterStats);
 assert.deepEqual(cup.roster.map(player=>player.power),powers);
 assert.equal(cup.claimUpgrade((recruitChoice+1)%3),false);
 assert.equal(cup.upgradesComplete,true);
 const licensed=await FiveMatch.create('cole',8,{squad:true,headless:true,roster:cup.roster,opponent:cup.opponent,rested:true});
 const hired=licensed.sim.teamA.players[1];
 assert.equal(hired.name,recruit.name);
 assert.equal(hired.stats.speed,recruit.stats.speed);
 assert.deepEqual(hired.body,recruit.body,'a recruit keeps their body proportions in the match');
 assert.equal(licensed.powerFor(hired)?.icon,recruit.power??undefined);
 assert.equal(licensed.staminaMultiplier,2);
 licensed.updateSprintReserve(true);
 assert.ok(Math.abs(licensed.sprintReserve-(1-Time.deltaTime/((2+licensed.player.stats.stamina/50)*2)))<1e-9);
 assert.ok(cup.choose('rest'));
 assert.ok(cup.choose('continue'));
 while(cup.round<RUN_LENGTH-1){
  assert.ok(kickOff(cup));
  cup.finish(3,0);
  assert.ok(cup.claimUpgrade(0));
  assert.ok(cup.choose('rest'));
  assert.ok(cup.choose('continue'));
 }
 assert.equal(cup.opponent.boss,true);
 assert.equal(cup.opponent.id,'mix-bag-fc');
 assert.deepEqual(cup.opponent.lineup.filter(Boolean).map(profile=>profile.id),[
  GOBLIN_TEAM.id,SHAPESHIFTERS.id,HORDE_FC.id
 ]);
 const finale=await FiveMatch.create('cole',8,{squad:true,headless:true,roster:cup.roster,opponent:cup.opponent});
 const finalists=finale.sim.teamB.players;
 assert.equal(finalists.length,4);
 assert.equal(finalists[0].role,'GK');
 assert.deepEqual(finalists.filter(player=>player.isSlimer),[finalists[1]]);
 const finalOrc=finalists[3];
 assert.deepEqual(finalists.filter(player=>player.isOrc),[finalOrc]);
 assert.ok(finalOrc.body.width>finalists[2].body.width);
 assert.equal(finalOrc.movementScale,.58);
 assert.equal(cup.opponent.hordeFC,true,'the boss runs the Orc Barge AI');
 assert.ok(finalOrc.bargeKnockback>0);
 assert.deepEqual(finalists.filter(player=>player.isShapeshifter),[finalists[2]]);
 kickOff(cup);cup.finish(3,2);assert.equal(cup.status,'won');assert.ok(cup.claimUpgrade(0));
 assert.equal(cup.league[0].points,12);
 assert.equal(cup.standings.length,5);
 assert.ok(cup.standings.every(team=>team.played===4));
 const lost=new FantasyRun(1),beforeLoss=lost.gold;
 kickOff(lost);lost.finish(0,1);
 assert.equal(lost.status,'between');assert.equal(lost.gold-beforeLoss,0);
 assert.ok(lost.claimUpgrade(0));
 assert.ok(lost.choose('rest'));
 assert.ok(lost.enterTavern());
 const beforePurchase=lost.gold;
 lost.gold=0;
 assert.equal(lost.choose(lost.offers[0].id),false);
 lost.gold=beforePurchase;
 assert.equal(lost.choose('rest'),false);
 assert.ok(lost.choose('continue'));assert.equal(lost.round,1);assert.equal(lost.opponent.id,HORDE_FC.id);
 for(let i=1;i<RUN_LENGTH;i++){
  assert.ok(kickOff(lost));lost.finish(0,1);assert.ok(lost.claimUpgrade(0));
  if(!lost.seasonComplete){assert.ok(lost.choose('rest'));assert.ok(lost.choose('continue'));}
 }
 assert.equal(lost.status,'lost');
 assert.equal(lost.lastPoints,0);
 assert.equal(lost.league[0].points,0);
 assert.equal(lost.gold,beforeLoss);
 const powersSeen=new Set(),tiers=[0,0,0];
 let keeperVisits=0,keeperRun;
 for(let i=0;i<400;i++){
  const sample=new FantasyRun(i,'mendes','portal');
  kickOff(sample);sample.finish(1,0);
  assert.ok(sample.claimUpgrade(0));
  sample.choose('rest');
  assert.ok(sample.enterTavern());
  for(const offer of sample.offers){
   assert.notEqual(offer.characterId,'kowalski');
   powersSeen.add(offer.power);tiers[offer.rarity]++;
   if(offer.power==='clone')assert.equal(offer.characterId,'mendes');
   assert.ok(Object.values(offer.stats).every(value=>value%10===0),'tavern ratings use increments of ten');
   if(offer.keeper){
    assert.equal(offer.stats.goalkeeping,50);
    keeperVisits++;keeperRun??={sample,offer};
   }else{
    const {stats}=CHARACTERS.find(character=>character.id===offer.characterId);
    assert.ok(['speed','shooting','passing','tackling','stamina'].every(stat=>offer.stats[stat]<=stats[stat]-9),
     'first-visit hires are weaker than their base characters');
   }
  }
 }
 assert.deepEqual([...powersSeen].sort(),['arc','barge','blast','blaze','clone','dash','nutmeg','portal','spin','stepover','tele','warp',null].sort());
 assert.ok(tiers[0]>tiers[1]&&tiers[1]>tiers[2]);
 assert.equal(keeperVisits,400);
 assert.ok(keeperRun.sample.choose(keeperRun.offer.id));
 const withKeeper=await FiveMatch.create('mendes',42,{squad:true,headless:true,roster:keeperRun.sample.roster,opponent:keeperRun.sample.opponent});
 const hiredKeeper=withKeeper.sim.teamA.getGoalkeeper();
 assert.ok(hiredKeeper);
 assert.equal(hiredKeeper.jersey,keeperRun.offer.number);
 hiredKeeper.recruitPower='blast';
 assert.equal(withKeeper.powerFor(hiredKeeper),null,'keepers cannot activate outfield abilities');
 const keeperDraftRun=keeperRun.sample;
 assert.ok(keeperDraftRun.choose('continue'));
 assert.ok(kickOff(keeperDraftRun));
 keeperDraftRun.finish(1,0);
 const keeperCards=keeperDraftRun.upgradeCards.filter(card=>keeperDraftRun.roster[card.playerIndex].keeper);
 assert.ok(keeperCards.length>0);
 assert.ok(keeperCards.every(card=>card.kind==='stat'||card.kind==='item'));
 for(const team of [withKeeper.sim.teamA,withKeeper.sim.teamB]){
  const numbers=team.players.map(player=>player.jersey);
  assert.ok(numbers.every(number=>Number.isInteger(number)&&number>=1&&number<=100));
  assert.equal(new Set(numbers).size,numbers.length);
 }
 let rareRun;
 for(let seed=0;seed<400&&!rareRun;seed++){
  const sample=new FantasyRun(seed);
  kickOff(sample);sample.finish(1,0);sample.claimUpgrade(0);sample.choose('rest');sample.choose('event');
  if(sample.event.name==='Varek Stonewall')rareRun=sample;
 }
 assert.ok(rareRun,'Explore the Area can reveal the rare keeper');
 assert.ok(rareRun.chooseEvent(0));
 const rareHire=rareRun.roster.find(p=>p.keeper);
 assert.equal(rareHire.stats.goalkeeping,84);
 assert.equal(rareRun.gold,80);
 const rareMatch=await FiveMatch.create('cole',42,{squad:true,headless:true,roster:rareRun.roster,opponent:rareRun.opponent});
 assert.equal(rareMatch.sim.teamA.getGoalkeeper().stats.goalkeeping,84);
 const scoutRun=new FantasyRun(2);
 kickOff(scoutRun);scoutRun.finish(1,0);scoutRun.claimUpgrade(0);scoutRun.choose('rest');scoutRun.choose('market');
 assert.ok(scoutRun.purchase('scouting-contract'));
 scoutRun.finishRoute();kickOff(scoutRun);
 const scoutedPlayers=rareMatch.sim.teamB.getOutfieldPlayers();
 scoutRun.finish(0,1,'B',0,scoutedPlayers);
 assert.equal(scoutRun.rivalRecruit,null);
 scoutRun.claimUpgrade(0);scoutRun.choose('rest');scoutRun.choose('continue');
 assert.ok(kickOff(scoutRun));
 scoutRun.finish(1,0,'A',0,scoutedPlayers);
 const prospect=scoutRun.rivalRecruit;
 assert.ok(scoutedPlayers.some(p=>p.name===prospect.name&&p.stats.speed===prospect.stats.speed));
 assert.equal(scoutRun.signRival(),false);
 scoutRun.claimUpgrade(0);
 const signingGold=scoutRun.gold;
 assert.ok(scoutRun.signRival());
 assert.equal(scoutRun.roster.at(-1),prospect);
 assert.equal(scoutRun.gold,signingGold);
 assert.equal(scoutRun.signRival(),false);
 const loadoutRun=new FantasyRun(21,'mendes','portal');
 const mageStarter=loadoutRun.roster[0];
 const arcHire={...mageStarter,number:undefined,name:'IONA',power:'arc'};
 const warriorHire={...mageStarter,number:undefined,name:'VORRA',characterId:'price',power:'spin'};
 const loadout=await FiveMatch.create('mendes',21,{squad:true,headless:true,
  roster:[mageStarter,arcHire,warriorHire],opponent:GOBLIN_TEAM});
 const [starterMage,arcMage,spinOrc]=loadout.sim.teamA.players;
 assert.deepEqual([starterMage,arcMage,spinOrc].map(p=>loadout.powerFor(p).name),['Portal Pass','Swerve','Spin']);
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
 kickOff(traineeRun);
 traineeRun.finish(1,0);
 assert.ok(traineeRun.upgradeCards.some(card=>card.kind==='stat'));
 assert.ok(traineeRun.claimUpgrade(0));
 assert.equal(traineeRun.roster[0].power,'tele');
 const capped=new FantasyRun(8);
 capped.roster[0].stats=Object.fromEntries(Object.keys(capped.roster[0].stats).map(key=>[key,99]));
 Object.assign(capped.roster[0].stats,{shotAccuracy:100,passAccuracy:100});
 kickOff(capped);capped.finish(1,0);
 assert.deepEqual(capped.upgradeCards,[]);
 assert.ok(capped.choose('rest'));
 for(const stat of ['shotAccuracy','passAccuracy']){
  const split=new FantasyRun(8);
  const stats=split.roster[0].stats;
  for(const key of Object.keys(stats))stats[key]=99;
  const other=stat==='shotAccuracy'?'passAccuracy':'shotAccuracy';
  stats[other]=100;
  kickOff(split);split.finish(1,0);
  assert.deepEqual(split.upgradeCards.map(({stat,current,next})=>[stat,current,next]),[[stat,99,100]]);
  assert.ok(split.claimUpgrade(0));
  assert.equal(split.roster[0].stats[stat],100);
  assert.equal(split.roster[0].stats.accuracy,99,'the split upgrade leaves the legacy rating intact');
  const nextMatch=await FiveMatch.create(split.roster[0].characterId,42,{headless:true,squad:true,roster:split.roster});
  assert.equal(nextMatch.player.stats[stat],100);
  nextMatch.destroy();
 }
 const crossClass=await setup('cole');
 const rogueCaster=crossClass.player;
 rogueCaster.recruitPower='arc';
 giveBall(crossClass.sim,rogueCaster,24,17);
 press(crossClass,'Space');
 assert.equal(crossClass.sim.arcCast?.player,rogueCaster,'a Rogue with a compatible loadout can cast Swerve');
 rogueCaster.recruitPower='barge';
 press(crossClass,'Space');
 assert.equal(crossClass.sim.bargeCharge?.player,rogueCaster,'a Rogue with a compatible loadout can cast Barge');
 traineeRun.choose('rest');
 traineeRun.choose('market');
 const stock=traineeRun.marketPerks.map(perk=>perk.id);
 assert.equal(new Set(stock).size,3);
 const unavailable=['crossbar','scouting-contract','boots','chalk'].find(id=>!stock.includes(id));
 assert.equal(traineeRun.purchase(unavailable),false);
 assert.ok(traineeRun.purchase(stock[0]));
 assert.equal(traineeRun.purchase(stock[0]),false);
 assert.deepEqual(traineeRun.marketPerks.map(perk=>perk.id),stock);
 assert.equal(traineeRun.purchase('red-card'),false);
 assert.ok(traineeRun.purchase('water'));
 assert.equal(traineeRun.items.water,1);
 traineeRun.choose('continue');
 assert.deepEqual(traineeRun.upgradeCards,[]);
 assert.equal(traineeRun.round,1);
 const eventRun=new FantasyRun(599);
 kickOff(eventRun);eventRun.finish(1,0);eventRun.claimUpgrade(0);eventRun.choose('rest');eventRun.choose('event');
 assert.equal(eventRun.event.name,'The Last Ref');
 assert.ok(eventRun.chooseEvent(0));
 assert.equal(eventRun.items['red-card'],1);
 assert.equal(eventRun.status,'ready');

 for(const [index,target] of [10,20,30].entries()){
  const jugglingRun=new FantasyRun(1167);
  kickOff(jugglingRun);jugglingRun.finish(1,0);jugglingRun.claimUpgrade(0);
  assert.ok(jugglingRun.choose('rest'));
  assert.ok(jugglingRun.choose('event'));
  assert.equal(jugglingRun.event.name,'Street Kick-Ups');
  const gold=jugglingRun.gold;
  assert.ok(jugglingRun.chooseEvent(index));
  assert.equal(jugglingRun.kickUpTarget,target);
  assert.equal(jugglingRun.chooseEvent(index),false);
  const challenge=new KickUps(target);
  challenge.kick();
  assert.equal(challenge.count,0,'input alone does not count as contact');
  for(let step=0;step<7000&&!challenge.done;step++){
   if(challenge.ready)challenge.kick();
   challenge.step(.01);
  }
  assert.equal(challenge.count,target);
  assert.equal(jugglingRun.finishKickUps(challenge.count),target*10);
  assert.equal(jugglingRun.finishKickUps(challenge.count),false);
  assert.equal(jugglingRun.gold,gold+target*10);
  assert.equal(jugglingRun.status,'ready');
 }
 const dropped=new KickUps(10);
 dropped.kick();
 dropped.step(.01);
 assert.ok(dropped.footY>0&&dropped.vy>0,'the rising foot launches the ball');
 dropped.step(.25);
 assert.ok(dropped.footY>0,'the foot follows through');
 dropped.step(.35);
 assert.equal(dropped.footY,0,'the foot returns to the ground');
 dropped.step(1.5);
 assert.ok(dropped.done);
 const mistimed=new KickUps(10);
 mistimed.kick();
 mistimed.step(.25);
 assert.equal(mistimed.ready,false,'the rising ball cannot be kicked');
 mistimed.kick();
 assert.equal(mistimed.done,false);
 assert.equal(mistimed.count,1);
 for(let step=0;step<220&&!mistimed.ready;step++)mistimed.step(.01);
 assert.ok(mistimed.ready);
 mistimed.kick();
 mistimed.step(.24);
 assert.equal(mistimed.count,2,'an early tap does not prevent the next kick');
 const directed=new KickUps(10);
 directed.moveFoot(.22,0,2);
 directed.step(.25);
 directed.moveFoot(.22,.3,2);
 directed.step(.12);
 assert.equal(directed.count,0,'lifting the boot beside the ball does not count');
 directed.moveFoot(0,0,2);
 directed.step(.25);
 directed.moveFoot(0,.05,2);
 directed.step(.01);
 assert.equal(directed.count,1,'lifting the boot under the ball makes contact');
 assert.ok(directed.vy>0);
 const clubTrial=await FiveMatch.create('cole',8,{squad:true,practice:true,sandbox:'crossbar',matchup:{home:1,away:1},headless:true,gear:['crossbar','bard','first-goal'],items:{water:2}});
 clubTrial.headless=false;
 clubTrial.setupShowcase('crossbar');
 clubTrial.player.stats.shotAccuracy=100;
 assert.equal(clubTrial.club.gold,0);
 clubTrial.input.pointer={};clubTrial.input.resolvePointerAim=()=>({x:1,y:0});
 clubTrial.input.press('KeyK');clubTrial.step(10);clubTrial.input.release('KeyK');
 for(let i=0;i<45&&clubTrial.club.gold===0;i++)clubTrial.step();
 assert.equal(clubTrial.club.gold,100,'a manually charged shot hits the crossbar and earns 100 gold');
 const scorer=clubTrial.player;
 const originalSpeed=scorer.stats.speed;
 clubTrial.club.goal('A',scorer);clubTrial.club.goal('A',scorer);
 assert.equal(scorer.stats.speed,originalSpeed+20);
 assert.equal(clubTrial.club.gold,145);
 const teammates=clubTrial.sim.teamA.players;
 const speeds=teammates.map(player=>player.movementScale??1);
 teammates.forEach(player=>{player.sprint.reserve=0;});
 assert.ok(clubTrial.club.use('water'));
 assert.ok(teammates.every(player=>player.sprint.reserve===1));
 assert.deepEqual(teammates.map(player=>player.movementScale),speeds.map(speed=>speed*1.1));
 clubTrial.step(200);
 scorer.sprint.reserve=0;
 assert.ok(clubTrial.club.use('water'));
 assert.equal(scorer.sprint.reserve,1);
 assert.deepEqual(teammates.map(player=>player.movementScale),speeds.map(speed=>speed*1.1));
 assert.equal(clubTrial.club.use('water'),false);
 const trained=await FiveMatch.create('mendes',8,{squad:true,headless:true,roster:traineeRun.roster,opponent:traineeRun.opponent,items:eventRun.items});
 assert.equal(trained.player.powerLevel,1);
 trained.sim.fsm.changeState(MatchStates.Play);
 trained.sim.setPieceType='';
 const [sentOff,remaining]=trained.sim.teamB.players;
 assert.ok(trained.club.use('red-card',sentOff));
 assert.equal(sentOff.isSentOff,true);
 assert.equal(trained.club.use('red-card',remaining),false);
 assert.equal(remaining.isSentOff,false);
 const streakerTrial=await FiveMatch.create('cole',8,{
  squad:true,practice:true,sandbox:'items',headless:true,
  matchup:{home:5,away:5,homeKeeper:true,awayKeeper:true},items:{'slimer-streaker':1}
 });
 const streakerSim=streakerTrial.sim;
 assert.ok(streakerTrial.club.use('slimer-streaker'));
 assert.equal(streakerTrial.club.items['slimer-streaker'],0);
 const streaker=streakerSim.slimerStreaker;
 streaker.y=10;
 const [firstGuard,secondGuard]=streakerGuards(streaker);
 const [homeBystander]=streakerSim.teamA.players;
 const [awayBystander,slimeTarget]=streakerSim.teamB.players;
 for(const p of streakerSim.players)Object.assign(p,{x:1,y:1});
 Object.assign(homeBystander,firstGuard);
 Object.assign(awayBystander,secondGuard);
 Object.assign(slimeTarget,{x:streaker.x+1.4,y:streaker.y+.35*streaker.direction});
 Time.advanceFixedLogicStep();stepStreaker(streakerSim);stepSlimeShots(streakerSim);
 assert.ok(homeBystander.x<firstGuard.x-2,'security pushes home players');
 assert.ok(awayBystander.x>secondGuard.x+2,'security pushes away players');
 assert.ok(slimeTarget.slimedUntil>Time.time,'the streaker hits opponents with slime');
 assert.ok(!(homeBystander.slimedUntil>Time.time),'the streaker leaves allies unslimed');
 for(let i=0;i<130&&streakerSim.slimerStreaker;i++){
  Time.advanceFixedLogicStep();stepStreaker(streakerSim);
 }
 assert.equal(streakerSim.slimerStreaker,null,'the streaker and guards leave the pitch');
 assert.ok(OPPONENTS.includes(FROST_GIANTS));
 const frost=await FiveMatch.create('cole',42,{
  squad:true,headless:true,opponent:FROST_GIANTS,matchup:{home:2,away:4}
 });
 const frostSim=frost.sim;
 const frostKeeper=frostSim.teamB.getGoalkeeper();
 assert.equal(frostKeeper?.name,'FROST KEEPER');
 assert.ok(frostKeeper.isFrostGiant);
 assert.ok(frostSim.teamB.getOutfieldPlayers().every(p=>p.isFrostGiant&&p.body.width>1.2&&p.movementScale===.62));
 frostSim.fsm.changeState(MatchStates.Play);
 frostSim.setPieceType='';
 frost.step(40);
 assert.ok(frostSim.iceTrails.length>0,'moving Frost Giants leave ice in a live match');
 const trail=frostSim.iceTrails.at(-1),skater=frost.player;
 frostSim.fsm.changeState(MatchStates.Play);
 frostSim.setPieceType='';
 const generatedTrails=frostSim.iceTrails;
 const previousPositions=frostSim.players.map(player=>({player,x:player.x,y:player.y}));
 for(const player of frostSim.players)if(player!==skater)Object.assign(player,{x:48,y:30});
 const crossingTrails=[{from:{x:22,y:15},to:{x:23,y:19},until:Time.time+10}];
 const walkAcross=(onIce,carrying)=>{
  frostSim.iceTrails=onIce?crossingTrails:[];
  Object.assign(skater,{x:20,y:17,z:0,vx:0,vy:0,orientation:2,actionTimer:0,currentStamina:1,_currentSpeed:0,iceMotion:null,
   humanControlled:true,_humanInput:{moveX:1,moveY:0,sprint:false}});
  Object.assign(frostSim.ball,{owner:carrying?skater:null,x:45,y:25,z:0,vx:0,vy:0});
  skater.fsm.changeState(carrying?PlayerStates.Dribble:PlayerStates.Idle);
  if(carrying)frostSim.ball.syncToOwner();
  const position=[];
  for(let i=0;i<24;i++){
   Time.advanceFixedLogicStep();
   skater.update();
   position.push(skater.x);
  }
  return position;
 };
 for(const carrying of [false,true]){
  const grass=walkAcross(false,carrying);
  const ice=walkAcross(true,carrying);
  assert.ok(ice.at(-1)>23,'manual movement crosses the trail');
  assert.ok(ice.every((position,i)=>position>=grass[i]-1e-9),'ice never slows a straight manual run');
 }
 for(const {player,x,y} of previousPositions)Object.assign(player,{x,y});
 frostSim.iceTrails=generatedTrails;
 Object.assign(skater,{x:trail.from.x,y:trail.from.y,z:0,actionTimer:0,isSliding:false,iceMotion:null});
 skater.fsm.changeState(PlayerStates.Idle);
 let dx=.2,dy=0;
 skater.fsm.update=()=>{skater.x+=dx;skater.y+=dy;};
 const move=()=>{Time.advanceFixedLogicStep();skater.update();};
 move();
 assert.ok(Math.abs(skater.x-trail.from.x-dx)<1e-9,'ice preserves forward movement');
 const beforeTurn={x:skater.x,y:skater.y};
 dx=0;dy=.2;move();
 assert.ok(skater.x>beforeTurn.x+.17&&skater.y<beforeTurn.y+.04,'ice keeps the previous momentum through a turn');
 assert.ok(Math.abs(Math.hypot(skater.x-beforeTurn.x,skater.y-beforeTurn.y)-.2)<1e-9,
  'turning on ice changes heading without cutting speed');
 const beforeReverse={x:skater.x,y:skater.y};
 dx=-.2;dy=0;move();
 assert.ok(skater.x>beforeReverse.x+.15,'reversing on ice keeps sliding forward');
 assert.ok(Math.abs(Math.hypot(skater.x-beforeReverse.x,skater.y-beforeReverse.y)-.2)<1e-9);
 const beforeStop=skater.x;
 dx=dy=0;move();
 assert.ok(skater.x>beforeStop+.17,'players coast when they release movement on ice');
 Object.assign(skater,{x:trail.from.x,y:trail.from.y,iceMotion:null});
 dx=.2;dy=.07;move();
 const beforeCorrection={x:skater.x,y:skater.y};
 dy=0;move();
 assert.ok(Math.abs(skater.y-beforeCorrection.y)<1e-9,'a shallow correction follows the intended direction');
 assert.ok(skater.x-beforeCorrection.x>=dx-1e-9,'a shallow correction keeps forward speed');
 const frostBall=frostSim.ball;
 const trails=frostSim.iceTrails;
 const ballSpeedAfter=(height,onIce)=>{
  frostSim.iceTrails=onIce?[{from:{x:20,y:17},to:{x:22,y:17},until:Time.time+2}]:[];
  Object.assign(frostBall,{owner:null,passRoute:null,x:20,y:17,z:height,vx:10,vy:0,vz:0,curveForce:0});
  const predicted=predict3D(frostBall,Time.deltaTime);
  frostBall.update();
  assert.ok(Math.abs(frostBall.vx-predicted.vx)<1e-9,'ball prediction accounts for ice');
  return frostBall.vx;
 };
 assert.equal(ballSpeedAfter(0,true),10,'rolling balls retain their speed on ice');
 assert.ok(ballSpeedAfter(0,false)<10,'rolling balls lose speed on grass');
 assert.equal(ballSpeedAfter(2,true),ballSpeedAfter(2,false),'airborne balls ignore the ice');
 frostSim.iceTrails=trails;
 Time.time+=5;
 frost.step();
 assert.ok(!frostSim.iceTrails.includes(trail),'patches melt after a few seconds');
 const cupOpening=generateEncounter(0,0);
 assert.equal(cupOpening.count,5);assert.equal(cupOpening.keeper,true);
 const sizes=new Set(),keepers=new Set();
 for(let i=0;i<100;i++){
  assert.deepEqual(generateEncounter(i,0),cupOpening);
  const encounter=generateEncounter(Math.imul(i+1,2654435761),2);
  if(encounter.id===FROST_GIANTS.id)assert.equal(encounter.keeper,true);
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
 const brothers=await FiveMatch.create('cole',12,{squad:true,headless:true,roster:['cole'],opponent:HORDE_FC});
 const orcSim=brothers.sim,[bruk,murg,gorr]=orcSim.teamB.getOutfieldPlayers();
 const orcKeeper=orcSim.teamB.getGoalkeeper();
 assert.equal(orcKeeper.name,'ORC KEEPER');
 assert.equal(orcKeeper.characterId,undefined);
 assert.equal(orcSim.teamB.players.length,4);
 assert.equal(new Set(orcSim.teamB.players.map(player=>player.appearance.skin)).size,4);
 assert.equal(new Set(orcSim.teamB.players.map(player=>player.appearance.style)).size,4);
 assert.deepEqual([bruk.name,murg.name,gorr.name],['BRUK','MURG','GORR']);
 assert.ok([bruk,murg,gorr].every(p=>p.characterId==='price'));
 assert.equal(bruk.movementScale,murg.movementScale);
 assert.ok(murg.movementScale<gorr.movementScale&&gorr.movementScale<1);
 const orcBody=CHARACTERS.find(c=>c.id==='price').body;
 assert.ok(orcSim.teamB.players.every(p=>p.body.width<orcBody.width&&p.body.height<orcBody.height));
 assert.notDeepEqual(bruk.body,murg.body);
 const drawSprite=body=>{
  let sprite;
  Player.prototype.render.call({x:0,y:0,frame:0,orientation:2,body,getSpriteSheet:()=>({})},
   {drawImage(...args){sprite=args.slice(5);},fillText(){}});
  return sprite;
 };
 const [,,normalWidth,normalHeight]=drawSprite();
 const [wideX,wideY,wideWidth,wideHeight]=drawSprite(bruk.body);
 const [normalX,normalY]=drawSprite();
 assert.ok(wideWidth>normalWidth&&wideHeight>normalHeight);
 assert.ok(Math.abs(wideX+wideWidth/2-(normalX+normalWidth/2))<1,'sprite width grows around its center');
 assert.ok(Math.abs(wideY+wideHeight-(normalY+normalHeight))<1,'sprite height grows upward from its feet');
 orcSim.matchState='play';orcSim.setPieceType='';
 const targetPlayer=brothers.player;
 giveBall(orcSim,targetPlayer,20,17);
 bruk.x=12;bruk.y=17;murg.x=8;murg.y=22;
 assert.ok(bruk.movementScale<orcKeeper.movementScale);
 updateHordeFC(orcSim);
 Time.time+=.7;updateHordeFC(orcSim);
 assert.ok(bruk.bargeWindup);
 targetPlayer.y=19;
 const chargeBeforeMiss={action:'shoot',ticks:4};
 orcSim._manualCharge=chargeBeforeMiss;
 Time.time+=.45;
 for(let i=0;i<15&&bruk.bargeWindup;i++){Time.advanceFixedLogicStep();updateHordeFC(orcSim);}
 assert.ok(bruk.x>=21.9,'a missed bash still travels ten metres');
 assert.ok(orcSim.ball.owner===targetPlayer,'a sidestep evades the committed barge');
 assert.equal(orcSim._manualCharge,chargeBeforeMiss,'an enemy miss leaves the current kick charge alone');
 murg.x=11.5;murg.y=19;
 Time.time+=1;updateHordeFC(orcSim);
 assert.ok(murg.bargeWindup);
 Time.time+=.45;
 for(let i=0;i<15&&murg.bargeWindup;i++){Time.advanceFixedLogicStep();updateHordeFC(orcSim);}
 assert.ok(orcSim.ball.owner===murg,'the second orc can hit and steal the ball');
 assert.ok(targetPlayer.actionTimer>0);
 assert.equal(orcSim.bargeFlights[0].opponent,targetPlayer);
 assert.equal(orcSim.bargeFlights[0].distance,4.5);
 assert.equal(murg.powerReadyAt,Time.time+5);

 for(const opponent of [undefined,GOBLIN_TEAM,HORDE_FC])for(const side of ['A','B']){
  const game=await FiveMatch.create('cole',11,{squad:true,headless:true,
   matchup:{home:1,away:opponent?.count??1,awayKeeper:opponent?.keeper},opponent});
  const {sim}=game;
  sim.fsm.setCurrentState(MatchStates.Play);sim.setPieceType='';
  assert.equal(game.secondsLeft,60);
  game.step(10);
  assert.ok(Math.abs(game.secondsLeft-59.5)<1e-8,'the match clock counts real seconds');
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
  sim[score]=2;
  scoreGoal();
  assert.equal(sim[score],3);
  assert.equal(sim.matchState,'kickoff');
  assert.equal(game.finished,false,'three goals do not end a match');
  scoreGoal();
  assert.equal(sim[score],4);
  assert.equal(game.finished,false);
  game.secondsLeft=Time.deltaTime;
  game.step();
  assert.ok(game.finished,'the leading team wins when the clock expires');
 }
 const tied=await FiveMatch.create('cole',29,{squad:true,headless:false,matchup:{home:1,away:1}});
 tied.secondsLeft=Time.deltaTime;
 tied.step();
 assert.equal(tied.extraTime,true);
 assert.equal(tied.secondsLeft,30);
 assert.equal(tied.sim.matchState,'kickoff');
 tied.secondsLeft=Time.deltaTime;
 tied.step();
 assert.ok(tied.finished);
 assert.equal(tied.secondsLeft,0);
 assert.equal(tied.winner,null);
 assert.equal(tied.sim.scoreA,tied.sim.scoreB);
 const leagueTie=await FiveMatch.create('cole',29,{squad:true,headless:true,leagueFixture:true,matchup:{home:1,away:1}});
 leagueTie.secondsLeft=Time.deltaTime;
 leagueTie.step();
 assert.ok(leagueTie.finished);
 assert.equal(leagueTie.winner,null);
 assert.equal(leagueTie.extraTime,undefined);
 leagueTie.destroy();
 const drawRun=new FantasyRun(1);
 const drawnOpponent=drawRun.opponent;
 kickOff(drawRun);
 drawRun.finish(0,0,tied.winner,10);
 assert.equal(drawRun.status,'between');
 assert.equal(drawRun.lastDraw,true);
 assert.equal(drawRun.lastWin,false);
 assert.equal(drawRun.matchesPlayed,1);
 assert.equal(drawRun.goldChange,0);
 assert.equal(drawRun.league[0].points,1);
 assert.equal(drawRun.lastPoints,1);
 assert.equal(drawRun.gold,155);
 assert.ok(drawRun.claimUpgrade(0));
 assert.ok(drawRun.choose('rest'));
 assert.ok(drawRun.choose('market'));
 assert.ok(drawRun.finishRoute());
 assert.equal(drawRun.round,1);
 assert.notEqual(drawRun.opponent,drawnOpponent);
 const timed=await FiveMatch.create('cole',29,{squad:true,headless:true,matchup:{home:1,away:1}});
 timed.sim.scoreB=1;
 timed.secondsLeft=Time.deltaTime;
 timed.step();
 assert.ok(timed.finished);
 assert.equal(timed.winner,'B');
 const overtime=await FiveMatch.create('cole',42,{squad:true,headless:true,matchup:{home:1,away:1}});
 overtime.secondsLeft=Time.deltaTime;
 overtime.step();
 overtime.sim.scoreA=1;
 overtime.step();
 assert.equal(overtime.finished,false,'a goal in extra time is not a golden goal');
 overtime.secondsLeft=Time.deltaTime;
 overtime.step();
 assert.ok(overtime.finished);
 assert.equal(overtime.winner,'A');
 const foulFree=await FiveMatch.create('cole',29,{squad:true,headless:true,matchup:{home:1,away:1}});
 const {sim:foulFreeSim}=foulFree;
 const tackler=foulFree.player,foulTarget=foulFreeSim.teamB.getOutfieldPlayers()[0];
 foulFreeSim.fsm.changeState(MatchStates.Play);
 foulFreeSim.setPieceType='';
 foulFreeSim.ball.owner=foulTarget;
 const originalTackleRandom=Math.random;
 try{
  let firstRoll=true;
  Math.random=()=>{
   if(!firstRoll)return 0;
   firstRoll=false;
   return .999;
  };
  assert.equal(attemptTackle(tackler,foulFreeSim.ball,'body'),false);
  assert.equal(foulFreeSim.ball.owner,foulTarget);
  assert.equal(foulFreeSim.matchState,'play','a failed tackle leaves play running');

  tackler.tackleAttemptCooldown=0;
  Math.random=()=>0;
  assert.equal(attemptTackle(tackler,foulFreeSim.ball,'body'),true);
  assert.equal(foulFreeSim.ball.owner,tackler);
  assert.equal(foulFreeSim.matchState,'play','a successful shoulder tackle also leaves play running');
  assert.equal(foulFreeSim._pendingAdvantage,null);
  assert.equal(tackler.yellowCards||0,0);
 }finally{Math.random=originalTackleRandom;}
 const openingRun=new FantasyRun(7,'mendes');
 const soloRun=await FiveMatch.create('mendes',openingRun.matchSeed,{
  squad:true,headless:true,roster:openingRun.roster,opponent:openingRun.opponent
 });
 assert.deepEqual(soloRun.sim.teamA.players.map(p=>p.characterId),['mendes']);
 assert.equal(soloRun.sim.teamB.players.length,openingRun.opponent.count);
 assert.equal(soloRun.sim.kickoffTeam,'A');
 assert.ok(soloRun.sim.teamB.players.every(p=>p.isSlimer));
 const slimerRangeTest=await FiveMatch.create('mendes',openingRun.matchSeed,{
  squad:true,headless:true,roster:openingRun.roster,opponent:openingRun.opponent
 });
 const rangeSim=slimerRangeTest.sim,{ball:rangeBall}=rangeSim;
 const [longShooter]=rangeSim.teamB.getOutfieldPlayers();
 const {left:homeGoal}=rangeSim.getGoals();
 rangeSim.fsm.setCurrentState(MatchStates.Play);
 rangeSim.setPieceType='';
 function trySlimerShot(distance,roll){
  rangeBall.start();
  giveBall(rangeSim,longShooter,distance,homeGoal.center.y);
  Object.assign(longShooter,{orientation:6,_currentSpeed:0});
  const random=Math.random;
  Math.random=()=>roll;
  try{
   longShooter.fsm.update();
   if(longShooter.fsm.currentState!==PlayerStates.Shoot)return null;
   for(let i=0;i<16&&rangeBall.owner;i++){
    Time.advanceFixedLogicStep();
    longShooter.fsm.update();
   }
   assert.ok(rangeBall.isShot);
   const speed=Math.hypot(rangeBall.vx,rangeBall.vy);
   for(let i=0;i<200&&Math.hypot(rangeBall.vx,rangeBall.vy)>.1;i++){
    rangeBall.update();
    if(homeGoal.scored(rangeBall))return {speed,scored:true};
   }
   return {speed,scored:false};
  }finally{Math.random=random;}
 }
 assert.equal(trySlimerShot(27,.1),null);
 assert.equal(trySlimerShot(24,.75),null);
 const accurateLongShot=trySlimerShot(24,.47);
 assert.ok(accurateLongShot.scored,'a weak shot from 24 metres can reach goal');
 assert.ok(accurateLongShot.speed<14,'the speculative shot has reduced pace');
 assert.equal(trySlimerShot(24,.25).scored,false,'the same shot can miss wide');

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
 assert.equal(soloRun.player.powerReadyAt,Time.time+soloRun.player.powerCooldown);
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
 giveBall(sim,enemy,23,17);
 Object.assign(orc,{x:20,y:17});
 Object.assign(rogue,{x:24,y:17});
 const keyboard={};
 game.input.attach({
  addEventListener:(type,handler)=>{keyboard[type]=handler;},
  removeEventListener:()=>{}
 });
 const keyEvent=code=>({code,target:{tagName:'CANVAS'},preventDefault(){}});
 for(const code of ['Tab','MetaLeft','MetaRight']){
  keyboard.keydown(keyEvent(code));
  tickManualControl(sim);
  keyboard.keyup(keyEvent(code));
  assert.ok(game.player===orc,`${code} leaves gameplay control alone`);
 }
 keyboard.keydown(keyEvent('KeyQ'));
 tickManualControl(sim);
 keyboard.keyup(keyEvent('KeyQ'));
 assert.ok(game.player===rogue,'Q jumps to the teammate closest to the ball');
 press(game,'KeyQ');
 assert.ok(game.player===rogue,'Q keeps the closest teammate selected');
 giveBall(sim,enemy,20,17);
 tickManualControl(sim);
 assert.ok(game.player===rogue,'manual defender stays selected');
 press(game,'KeyQ');
 assert.ok(game.player===orc,'Q picks the new nearest defender');
 giveBall(sim,orc,20,17);tickManualControl(sim);assert.ok(game.player===orc);
 press(game,'KeyQ');assert.ok(game.player===orc,'Q keeps the carrier during friendly possession');
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
 assert.equal(grum.powerCooldown,5.25);
 const chargeStart=Time.time;
 press(game,'Space');
 assert.equal(grum.x,20,'the barge starts without teleporting');
 Time.advanceFixedLogicStep();updateBargeCharge(sim);
 assert.ok(grum.x>20&&grum.x<20.65);
 assert.equal(grum.z,0);
 assert.ok([1,2].includes(grum.frame));
 assert.equal(sim.ball.owner,carrier);
 game.input.aim={x:0,y:1};
 runBarge(sim);
 assert.equal(grum.y,17,'the barge keeps its initial direction');
 assert.ok(sim.ball.owner===grum);assert.equal(grum.powerReadyAt,chargeStart+grum.powerCooldown);
 giveBall(sim,carrier,34,17);press(game,'Space');
 assert.match(game.feedback.text,/recharging/);
 assert.ok(sim.ball.owner===carrier);assert.equal(grum.actionTimer,0);
 Time.time=grum.powerReadyAt;
 press(game,'Space');
 assert.equal(grum.powerReadyAt,Time.time+grum.powerCooldown);
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
  assert.ok(defender.x>x+5);
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
 assert.ok(Math.abs(charger.x-23.6)<1e-8,'non-carriers do not stop the charge');

 const boosted=await setup('price',[],'price');
 boosted.player.powerLevel=2;
 giveBall(boosted.sim,boosted.player,18,17);
 boosted.input.aim={x:1,y:0};
 press(boosted,'Space');
 assert.equal(boosted.sim.bargeCharge.speed,14.5);
 runBarge(boosted.sim);
 assert.ok(Math.abs(boosted.player.x-26.8)<1e-8);
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
 assert.equal(nyx.sprint.reserve,1);assert.equal(nyx.powerReadyAt,Time.time+nyx.powerCooldown);

 const cloneGame=await setup('mendes',[],'clone');
 const cloneSim=cloneGame.sim,cloneMage=cloneGame.player;
 press(cloneGame,'Space');
 assert.equal(cloneSim.clones,undefined);
 assert.equal(cloneMage.powerReadyAt,0);
 giveBall(cloneSim,cloneMage,16,17);
 cloneGame.input.aim={x:1,y:0};
 press(cloneGame,'Space');
 assert.equal(cloneSim.clones.length,1);
 assert.equal(cloneSim.clones[0].until,Time.time+1.5);
 assert.ok(cloneSim.ball.owner===cloneMage,'Clone keeps the real ball with the caster');
 const {updateClones,followClone}=require('../kernel/five/clones.js');
 Time.advanceFixedLogicStep();updateClones(cloneSim);
 assert.ok(cloneSim.clones[0].x>cloneMage.x);
 assert.equal(cloneSim.clones[0].y,cloneMage.y);
 for(const team of [cloneSim.teamA,cloneSim.teamB]){
  const ai=team.players.find(player=>player!==cloneMage);
  let pursued;
  const move=ai.moveTo;
  ai.moveTo=target=>{pursued=target;};
  assert.equal(followClone(cloneSim,ai),true);
  ai.moveTo=move;
  assert.equal(pursued,cloneSim.clones[0].ball);
 }
 assert.equal(followClone(cloneSim,cloneMage),false);
 Time.time=cloneSim.clones[0].until;
 updateClones(cloneSim);
 assert.equal(cloneSim.clones.length,0);
 cloneMage.powerLevel=2;cloneMage.powerReadyAt=0;
 press(cloneGame,'Space');
 assert.equal(cloneSim.clones.length,1);
 assert.equal(cloneSim.clones[0].until,Time.time+5);
 assert.equal(characterPower('cole',undefined,'overhead').name,'Nutmeg','old Rogue slots use the replacement power');
 const nutmeg=await FiveMatch.create('cole',42,{squad:true,practice:true,practiceDrill:'nutmeg',cooldownsOff:true,headless:true});
 nutmeg.headless=false;
 nutmeg.sim.seededRandom=()=>.49;
 for(const level of [1,2]){
  nutmeg.resetPractice('nutmeg',level);
  nutmeg.player.stats.passAccuracy=100;
  const {sim:nutmegSim}=nutmeg;
  const defenders=nutmegSim.teamB.getOutfieldPlayers();
  const spots=defenders.map(p=>[p.x,p.y]);
  assert.equal(defenders.length,level);
  const play=code=>{nutmeg.input.press(code);nutmeg.step();nutmeg.input.release(code);};
  play('KeyJ');
  for(let i=0;i<90&&nutmeg.feedback?.text!==(level===2?'Double Nutmeg!':'Nutmeg!');i++)nutmeg.step();
  assert.equal(nutmeg.feedback?.text,level===2?'Double Nutmeg!':'Nutmeg!');
  assert.equal(nutmegSim.ball.nutmeg?.filter(target=>target.passed).length,level);
  assert.deepEqual(defenders.map(p=>[p.x,p.y]),spots);
  assert.equal(nutmeg.player.nutmegBoostUntil,Time.time+3);
 }

 const runnerAfterNutmeg=nutmeg.player;
 const moveAfterNutmeg=()=>{
  Object.assign(runnerAfterNutmeg,{x:25,y:17,vx:0,vy:0,_currentSpeed:0,currentStamina:1});
  runnerAfterNutmeg.moveTo({x:31,y:17});
  return runnerAfterNutmeg.x-25;
 };
 const boostedStep=moveAfterNutmeg();
 Time.time=runnerAfterNutmeg.nutmegBoostUntil;
 assert.ok(Math.abs(boostedStep/moveAfterNutmeg()-1.5)<1e-9);

 nutmeg.resetPractice('nutmeg');
 nutmeg.sim.seededRandom=()=>.5;
 nutmeg.input.press('KeyJ');nutmeg.step();nutmeg.input.release('KeyJ');
 for(let i=0;i<30;i++)nutmeg.step();
 assert.equal(nutmeg.sim.ball.nutmeg,null,'a roll at 50% goes through normal defending rules');
 assert.equal(nutmeg.player.nutmegBoostUntil,0);
 assert.equal(nutmeg.player.powerReadyAt,0);

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
 assert.equal(sim.ball.owner,null);assert.equal(wizard.powerReadyAt,Time.time+wizard.powerCooldown);
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

 const retarget=await setup('mendes',[],'mendes');
 const caster=retarget.player,field=retarget.sim;
 const [first,second,...others]=field.teamA.getOutfieldPlayers().filter(p=>p!==caster);
 others.forEach(p=>{p.isSentOff=true;});
 Object.assign(first,{x:27,y:13});
 Object.assign(second,{x:27,y:21});
 giveBall(field,caster,15,17);
 let point=first;
 retarget.input.pointer={};
 retarget.input.resolvePointerAim=()=>({x:point.x-field.ball.x,y:point.y-field.ball.y});
 press(retarget,'Space');
 retarget.input.press('MouseLeft');tickManualControl(field);
 assert.equal(field.arcCast.previewTarget,first);
 point=second;
 for(let i=0;i<8;i++){Time.advanceFixedLogicStep();tickManualControl(field);}
 assert.equal(field.arcCast.previewTarget,second,'dragging a held Swerve pass can pick another receiver');
 assert.ok(Math.abs(field.arcCast.flight.route.bend)>5);
 retarget.input.release('MouseLeft');tickManualControl(field);
 assert.equal(field.arcAssist.receiver,second);

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
  const initialEnd=shot.flight.route.end;
  practice.input.aim={x:1,y:.32};
  practice.step(8);
  assert.ok(shot.aim.y>.25,'dragging updates the held shot aim');
  assert.ok(Math.abs(shot.flight.route.end.y-initialEnd.y)>4,'the live preview moves with the new aim');
  const preview=shot.flight;
  assert.ok(Math.abs(preview.route.bend)>Math.max(4,Math.abs(initialBend)));
  assert.ok(preview.route.bend>0,'steering chooses the side of the opening bend');
  const route=preview.route;
  const sample=t=>samplePassRoute(route,t*route.duration);
  const pace=t=>Math.hypot(sample(t).vx,sample(t).vy);
  assert.ok(pace(.1)<pace(.5)&&pace(.5)<pace(.95),'shot accelerates from wind-up to finish');
  const lateral=t=>sample(t).vx*route.normal.x+sample(t).vy*route.normal.y;
  assert.ok(Math.abs(lateral(.4))>.1,'shot curves early');
  assert.ok(Math.abs(lateral(.85))<1e-8,'the finish runs straight toward the updated aim');
  assert.ok(preview.kick.vy>0,'launch uses the updated aim');
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
 twoLegRune.stats.passAccuracy=100;
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
  portalRune.stats.passAccuracy=portalRune.stats.shotAccuracy=100;
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
  if(kick==='MouseRight'){
   assert.equal(ball.vx,entry.vx);
   assert.equal(ball.vy,entry.vy);
  }else{
   assert.ok(Math.hypot(ball.vx,ball.vy)<Math.hypot(entry.vx,entry.vy),'the portal pass loses speed on the way to the exit');
   assert.ok(Math.abs(ball.vx*entry.vy-ball.vy*entry.vx)<1e-8,'the exit preserves the pass direction');
  }
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
 for(const direction of [-1,1]){
  practice.resetPractice('portal-pass',2);
  giveBall(practice.sim,practice.player,26,8);
  practice.player.stats.passAccuracy=practice.player.stats.shotAccuracy=100;
  practice.input.aim={x:direction,y:0};
  practice.input.press('Space');practice.step();practice.input.release('Space');
  const {end,exit}=practice.sim.teleCast;
  assert.equal(end.y,exit.y);
  assert.ok(Math.abs(end.x+exit.x-practice.sim.ball.maxX)<1e-6);
  practice.input.press('MouseRight');practice.step(10);practice.input.release('MouseRight');practice.step();
  assert.ok(practice.sim.teleFlight);
  for(let i=0;i<65&&practice.sim.teleFlight;i++)practice.step();
  assert.ok(Math.abs(practice.sim.ball.x-exit.x)<1e-6);
  assert.equal(practice.sim.ball.y,exit.y);
  assert.equal(Math.sign(practice.sim.ball.vx),direction);
  assert.equal(practice.sim.ball.isShot,true);
 }
 practice.resetPractice('portal-pass',2);
 giveBall(practice.sim,practice.player,26,17);
 practice.player.stats.passAccuracy=100;
 practice.input.aim={x:1,y:0};
 practice.input.press('Space');practice.step();practice.input.release('Space');
 assert.equal(practice.sim.teleCast.exit,null,'the mouth of a goal is not a portal wall');

 practice.resetPractice('portal-pass',2);
 giveBall(practice.sim,practice.player,26,17);
 const movingBall=practice.sim.ball;
 practice.input.pointer={};
 practice.input.resolvePointerAim=()=>({x:28-movingBall.x,y:4-movingBall.y});
 practice.input.press('Space');practice.step();practice.input.release('Space');
 const startingAim=practice.sim.teleCast.end.x;
 practice.input.press('MouseRight');
 practice.input.press('KeyD');practice.step(8);practice.input.release('KeyD');
 assert.ok(practice.player.x>26.5,'the portal charge leaves movement active');
 assert.ok(Math.abs(practice.sim.teleCast.end.x-startingAim)>.1,'the portal aim updates while moving');
 practice.input.release('MouseRight');practice.step();
 assert.ok(practice.sim.teleFlight);
 assert.ok(Math.abs(practice.sim.teleFlight.route.end.x-startingAim)>.1,'the shot follows the updated aim');
 practice.input.resolvePointerAim=null;
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
 function portalLaunch(shot,skill,accuracy,otherSkill,otherAccuracy){
  practice.resetPractice('portal-pass',2);
  giveBall(practice.sim,practice.player,26,17);
  const {stats}=practice.player;
  Object.assign(stats,shot
   ?{shooting:skill,shotAccuracy:accuracy,passing:otherSkill,passAccuracy:otherAccuracy}
   :{passing:skill,passAccuracy:accuracy,shooting:otherSkill,shotAccuracy:otherAccuracy});
  practice.input.aim={x:0,y:-1};
  const random=Math.random;
  Math.random=()=>.9;
  try{
   practice.input.press('Space');practice.step();practice.input.release('Space');
   const key=shot?'MouseRight':'MouseLeft';
   practice.input.press(key);practice.step();practice.input.release(key);
   if(shot)practice.step();
   const {route}=practice.sim.teleFlight;
   const {vx,vy}=samplePassRoute(route,0);
   return {speed:Math.hypot(vx,vy),error:Math.abs(Math.atan2(vx,-vy))};
  }finally{Math.random=random;}
 }
 for(const shot of [false,true]){
  const low=portalLaunch(shot,20,20,100,100);
  const fast=portalLaunch(shot,100,20,20,100);
  const accurate=portalLaunch(shot,20,100,100,20);
  assert.ok(fast.speed>low.speed*1.3,'portal kick power follows the matching kick stat');
  assert.ok(Math.abs(low.error-fast.error)<1e-8,'power does not change the aim error');
  assert.ok(low.error>.1&&accurate.error<1e-8,'portal aim follows the matching accuracy stat');
  assert.ok(Math.abs(low.speed-accurate.speed)<1e-8,'accuracy does not change the kick power');
 }
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
 assert.ok(opponent.x-impact>5.2&&opponent.x-impact<=5.5+1e-8,'the charge knocks the carrier farther back');
 assert.equal(opponent.z,0);
 const bargeLanding={x:opponent.x,y:opponent.y};
 assert.ok(opponent.actionTimer>0);
 practice.step(2);
 assert.equal(opponent.x,bargeLanding.x);
 assert.equal(opponent.y,bargeLanding.y);
 practice.step(14);
 assert.ok(Math.hypot(opponent.x-bargeLanding.x,opponent.y-bargeLanding.y)>.2,'runner resumes moving when the stun ends');
 assert.ok(practice.sim.ball.owner===barge);
 assert.match(practice.feedback.text,/Barge stunned/);
 Math.random=()=>.25;
 try{
  for(let i=0;i<50&&practice.sim.ball.owner===barge;i++)practice.step();
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
  assert.equal(practice.sim.bargeFlights[0].distance,level===2?10:5.5);
  assert.ok(level===2?carrier.actionTimer>1.5:carrier.actionTimer<1);
 }
 const cooldownPractice=await FiveMatch.create('cole',42,{squad:true,practice:true,headless:false});
 for(const [drill,cooldown] of [['cole',4.5],['price',7],['mendes',6],['tele-pass',7],['portal-pass',7],['goal-warp',5.5],['spin-kick',5.5],['blaze-slide',6.5],['clone',6],['nutmeg',0]]){
  cooldownPractice.resetPractice(drill);
  assert.equal(cooldownPractice.player.powerCooldown,cooldown);
  assert.equal(cooldownPractice.player.powerReadyAt,0);
 }
 practice.resetPractice('stepover');
 const stepper=practice.player,[closeDefender,farDefender]=practice.sim.teamB.getOutfieldPlayers();
 giveBall(practice.sim,stepper,22,17);
 Object.assign(closeDefender,{x:23,y:17});
 Object.assign(farDefender,{x:27,y:17});
 practice.input.press('Space');practice.step();practice.input.release('Space');
 assert.ok(closeDefender.actionTimer>.6);
 assert.equal(farDefender.actionTimer,0);
 assert.equal(practice.sim.ball.owner,stepper);
 assert.ok(stepper.stepoverPose);
 practice.resetPractice('blaze-slide');
 const slider=practice.player;
 const flameRival=practice.sim.teamB.getOutfieldPlayers()[0];
 const flameAlly=practice.sim.teamA.getOutfieldPlayers().find(p=>p!==slider);
 flameRival.x=slider.x+.8;flameRival.y=slider.y+.3;
 flameAlly.x=slider.x+1;flameAlly.y=slider.y-.3;
 giveBall(practice.sim,slider,slider.x,slider.y);
 press(practice,'Space');
 assert.equal(practice.sim.blazeSlides.length,0);
 assert.equal(practice.feedback.text,'Blazing Slide requires playing off the ball');
 practice.sim.ball.kick(0,0,0);
 practice.sim.ball.z=1.8;
 practice.input.aim={x:-1,y:0};
 practice.input.press('KeyD');
 practice.input.press('Space');practice.step();practice.input.release('Space');
 practice.input.release('KeyD');
 assert.ok(practice.sim.blazeSlides[0].dir.x>.9);
 for(let i=0;i<8&&(!flameAlly.burningUntil||!flameRival.burningUntil);i++)practice.step();
 assert.ok(flameAlly.burningUntil>Time.time&&flameRival.burningUntil>Time.time);
 assert.ok(flameAlly.hazardTarget&&flameRival.hazardTarget);
 assert.ok(practice.sim.blazeTrails[0].until-Time.time>2.7);
 practice.step(75);
 assert.equal(practice.sim.blazeTrails.length,0);
 assert.ok(flameAlly.burningUntil<=Time.time&&flameRival.burningUntil<=Time.time);

 const blast=await FiveMatch.create('price',42,{squad:true,practice:true,practiceDrill:'blast-shot',headless:true});
 blast.headless=false;
 const {sim:blastSim}=blast;
 const [inLane,offLane]=blastSim.teamB.getOutfieldPlayers(true);
 const defenderStart=inLane.x;
 blast.step(10);
 assert.ok(inLane.x<defenderStart-.2&&inLane.x>defenderStart-1.6,'the defender closes down the carrier slowly');
 assert.equal(blastSim.ball.owner,blast.player);
 Object.assign(offLane,{x:41,y:20,isSentOff:false,actionTimer:0});
 const launchKey=code=>{blast.input.press(code);blast.step();blast.input.release(code);};
 blast.player.stats.shotAccuracy=100;
 blast.input.pointer={};
 blast.input.resolvePointerAim=()=>({x:1,y:0});
 launchKey('KeyK');
 for(let i=0;i<25&&!inLane.actionTimer;i++)blast.step();
 const flight=blastSim.bargeFlights.find(({opponent})=>opponent===inLane);
 assert.ok(flight,'an ordinary shot launches the defender in its lane');
 assert.equal(inLane.actionTimer,3,'the impact stuns the defender for three seconds');
 assert.equal(blastSim.ball.isShot,false,'the ball deflects like a normal blocked shot');
 assert.ok(blastSim.ball.vx<0);
 assert.equal(blastSim.ball.onShotBlock,null);
 assert.equal(offLane.actionTimer,0);
 assert.equal(blast.player.powerReadyAt,0,'the passive never goes on cooldown');
 blast.step(7);
 const shove=Math.hypot(inLane.x-flight.x,inLane.y-flight.y);
 assert.ok(shove>.8&&shove<=1.001,'the impact only nudges the defender');
 assert.ok(inLane.actionTimer>0);
 const landed={x:inLane.x,y:inLane.y};
 blast.step(5);
 assert.deepEqual({x:inLane.x,y:inLane.y},landed,'the defender stays down during the stun');
 giveBall(blastSim,blast.player,36,17);
 blast.step(91);
 assert.equal(inLane.actionTimer,0);
 assert.ok(inLane.x<landed.x,'the defender resumes pressing after recovery');
 giveBall(blastSim,blast.player,36,17);
 Object.assign(inLane,{x:41,y:17,isSentOff:false,actionTimer:0});
 launchKey('KeyK');
 for(let i=0;i<25&&!inLane.actionTimer;i++)blast.step();
 assert.equal(inLane.actionTimer,3,'the next shot triggers the same passive without arming');

 const combos=await setup('price');
 combos.headless=false;
 const comboSim=combos.sim;
 comboSim.teamAbilities=['power'];
 comboSim.fsm.changeState(MatchStates.Play);
 const [crosser,finisher,...bench]=comboSim.teamA.getOutfieldPlayers();
 for(const player of [finisher,...bench])player.isSentOff=true;
 assert.deepEqual(teamMoveUnlocks(comboSim),{power:false,header:false,overhead:false});
 finisher.isSentOff=false;
 assert.deepEqual(teamMoveUnlocks(comboSim),{power:true,header:false,overhead:false});
 const placeCross=()=>{
  giveBall(comboSim,crosser,32,7);
  Object.assign(finisher,{x:40,y:16,actionTimer:0});
  crosser.actionTimer=0;
 };
 const playKey=code=>{
  combos.input.press(code);combos.step();combos.input.release(code);
 };
 const waitForCross=()=>{
  for(let i=0;i<65&&comboSim.teamCross&&!crossIsReady(comboSim);i++)combos.step();
  assert.ok(crossIsReady(comboSim));
  assert.equal(combos.player===finisher,true);
  assert.ok(finisher.x>41);
 };
 placeCross();
 playKey('KeyF');
 assert.equal(combos.feedback.text,'Team ability not learned');
 playKey('KeyE');
 assert.equal(comboSim.teamCross.receiver===finisher,true);
 playKey('KeyE');
 assert.match(combos.feedback.text,/Too early/);
 assert.equal(crosser.actionTimer,0,'a cross does not lock the passer');
 const initialY=finisher.y;
 combos.input.press('KeyW');
 combos.step(3);
 combos.input.release('KeyW');
 assert.ok(finisher.y<initialY,'the receiver can steer during the cross');
 waitForCross();
 assert.equal(comboSim.ball.isShot,false,'the early press was not queued');
 playKey('KeyE');
 assert.equal(combos.feedback.text,'Power Shot!');
 assert.equal(comboSim.ball.lastKicker===finisher,true);
 assert.ok(comboSim.ball.vx>40&&comboSim.ball.vx<48);
 const [secondBlocker,firstBlocker]=comboSim.teamB.getOutfieldPlayers();
 const comboBall=comboSim.ball;
 Object.assign(comboBall,{prevX:40,prevY:17,x:44,y:17,z:1,vx:47,vy:0});
 Object.assign(firstBlocker,{x:42,y:17});
 Object.assign(secondBlocker,{x:48,y:17});
 assert.equal(tryBallShotBlocking(comboSim),false);
 assert.ok(Math.abs(firstBlocker.y-17)>2);
 assert.equal(comboBall.vx,47);
 assert.equal(comboBall.pierceOpponent,null);
 Object.assign(comboBall,{prevX:44,prevY:17,x:49,y:17});
 assert.equal(tryBallShotBlocking(comboSim),true);
 assert.equal(comboBall.isShot,false);

 placeCross();
 comboSim.cooldownsOff=true;
 playKey('KeyR');
 waitForCross();
 press(combos,'MouseLeft');
 Object.assign(comboBall,{prevX:40,prevY:17,prevZ:1,x:49,y:17,z:1,vx:47,vy:0});
 Object.assign(firstBlocker,{x:42,y:17});
 Object.assign(secondBlocker,{x:48,y:17});
 assert.equal(tryBallShotBlocking(comboSim),true);
 assert.ok(Math.abs(firstBlocker.y-17)>2);
 assert.equal(secondBlocker.y,17);
 assert.equal(comboBall.pierceOpponent,null);

 placeCross();
 assert.notEqual(finisher.characterId,'price');
 comboSim.teamAbilities.push('header');
 assert.deepEqual(teamMoveUnlocks(comboSim),{power:true,header:true,overhead:false});
 playKey('KeyF');
 assert.equal(comboSim.teamCross.kind,'header');
 waitForCross();
 press(combos,'KeyE');
 assert.equal(combos.feedback.text,'Header!');
 assert.equal(comboBall.lastKicker===finisher,true);
 assert.equal(comboBall.pierceOpponent,null);
 placeCross();
 playKey('KeyF');
 for(let i=0;i<65&&comboSim.teamCross;i++)combos.step();
 assert.equal(combos.feedback.text,'Missed the cross');
 assert.equal(comboSim.teamCross,null);
 assert.ok(!comboBall.passRoute?.teamCross);

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

 async function cursorKick(code,restart,withReceiver=false,holdTicks=8,driven=true,accuracy=100){
  const game=await setup('mendes');
  game.headless=false;
  const {sim,input}=game;
  sim.drivenGroundPasses=driven;
  const previous=game.player,player=restart==='goalkick'||restart==='keeper'?sim.teamA.players[0]:previous;
  for(const p of sim.players){p.x=4;p.y=p.team==='A'?30:2;}
  giveBall(sim,player,25,restart==='throwin'?.6:15);
  if(restart==='keeper')grantGkPossession(player,sim.ball);
  // Give the other kick type the opposite rating to catch accidental cross-wiring.
  player.stats.shotAccuracy=code==='KeyK'?accuracy:101-accuracy;
  player.stats.passAccuracy=code==='KeyK'?101-accuracy:accuracy;
  if(accuracy===100)player.stats.shotAccuracy=player.stats.passAccuracy=100;
  const cursor={x:17,y:23};
  if(withReceiver){
   const receiver=sim.teamA.players[2];
   receiver.x=cursor.x;receiver.y=cursor.y;
  }
  input.pointer={};
  input.resolvePointerAim=()=>({x:cursor.x-sim.ball.x,y:cursor.y-sim.ball.y});
  const restartStates={freekick:MatchStates.Freekick,goalkick:MatchStates.Goalkick,
   throwin:MatchStates.Throwin,corner:MatchStates.Corner};
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
  const dot=launch.vx*launch.dx+launch.vy*launch.dy;
  const error=Math.abs(Math.atan2(cross,dot));
  if(accuracy===100)assert.ok(error<1e-6,'a fully accurate kick follows the cursor ray');
  assert.ok(dot>0);
  assert.equal(launch.curve,0);
  if(!restart&&withReceiver&&holdTicks<=2&&code==='KeyJ'&&driven){
   assert.equal(launch.vz,0);
   assert.equal(game.player,player,'a pass tap keeps control with the player who nudged the ball');
   assert.equal(sim._manualPendingReceiver,null);
   assert.ok(player.kickerClaimCooldown>Settings.AI.KICKER_CLAIM_COOLDOWN,
    'the passer has extra time to let a tap roll clear before reclaiming it');
  }
  if(restart)assert.equal(sim.setPieceType,'');
  if(restart==='freekick'&&code==='KeyJ')assert.equal(sim.ball.ifkActive,true);
  if(restart==='keeper')assert.ok(launch.kicker===player&&launch.vz>0&&!sim.ball.isShot);
  if(restart==='throwin')assert.ok(sim.ball.isThrowInFlight&&launch.vz>0);
  if(restart==='goalkick'){
   assert.ok(game.player.role!=='GK');
   assert.equal(launch.vz>0,code!=='KeyJ');
  }
  return accuracy===100?Math.hypot(launch.vx,launch.vy):error;
 }
 for(const [code,receiver,ticks] of [['KeyK',false,8],['KeyJ',false,1],['KeyJ',true,8],['KeyL',false,8]]){
  const low=await cursorKick(code,false,receiver,ticks,true,1);
  const high=await cursorKick(code,false,receiver,ticks,true,99);
  assert.ok(low>high,`${code} launches closer to the cursor at high accuracy (${low} vs ${high})`);
  assert.ok(low>Math.PI/6,`${code} misses the cursor by over 30 degrees at accuracy 1`);
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

 const warmup=await FiveMatch.create('price',42,{squad:true,practice:true,sandbox:'warmup',headless:true,
  matchup:{home:2,away:2,homeKeeper:true,awayKeeper:true}});
 const warmupKeeper=warmup.sim.teamA.getGoalkeeper();
 const warmupBox=warmup.sim.getKeeperBounds(warmupKeeper);
 assert.ok(warmupKeeper.x<warmupBox.xMax/2,'warmup keeper starts near their own goal');
 assert.equal(warmupKeeper.y,17);
 warmup.step(40);
 assert.ok(warmupKeeper.x>=warmupBox.xMin&&warmupKeeper.x<=warmupBox.xMax);

 const boxTestSim=defense.sim;
 for(const secondHalf of [false,true]){
  boxTestSim.isSecondHalf=()=>secondHalf;
  for(const team of [boxTestSim.teamA,boxTestSim.teamB]){
   const goalkeeper=team.getGoalkeeper(),box=boxTestSim.getKeeperBounds(goalkeeper);
   const defendsLeft=(goalkeeper.team==='A')!==secondHalf;
   assert.equal(box.side,defendsLeft?'left':'right');
   Object.assign(goalkeeper,{x:(box.xMin+box.xMax)/2,y:17});
   for(let i=0;i<100;i++)goalkeeper.moveTo({x:26,y:34});
   assert.ok(Math.abs(goalkeeper.x-(defendsLeft?box.xMax:box.xMin))<.15);
   assert.ok(Math.abs(goalkeeper.y-box.yMax)<.15);
  }
 }

 const keeperMatch=await FiveMatch.create('price',42,{squad:true,headless:false,
  matchup:{home:2,away:2,homeKeeper:true,awayKeeper:true}});
 const goalKickSim=keeperMatch.sim;
 const goalKickTaker=goalKickSim.teamA.getGoalkeeper();
 goalKickSim.setPieceType='goalkick';
 goalKickSim.setPieceSide='left';
 goalKickSim.setPieceKickingTeam='A';
 goalKickSim.setupSetPiecePositions('goalkick','left','A');
 goalKickSim.fsm.changeState(MatchStates.Goalkick);
 for(let i=0;i<45&&!goalKickSim.setPieceReadyPhase;i++)keeperMatch.step();
 assert.ok(goalKickSim.setPieceReadyPhase);
 keeperMatch.step(200);
 assert.equal(goalKickSim.matchState,'goalkick');
 assert.equal(goalKickSim.ball.owner,goalKickTaker);
 keeperMatch.secondsLeft=.1;
 keeperMatch.step(2);
 assert.ok(keeperMatch.extraTime,'waiting to take a goal kick does not delay extra time');

 const tap=await cursorKick('KeyJ',false,true,0);
 const mouseTap=await cursorKick('MouseLeft',false,false,1);
 const mid=await cursorKick('KeyJ',false,false,6);
 const charged=await cursorKick('KeyJ',false,false,12);
 assert.equal(tap,mouseTap,'keyboard and mouse taps have the same strength');
 assert.ok(tap>2&&tap<6,'a tap produces a gentle ground pass');
 assert.ok(mid>tap*2&&charged>mid*1.4,'holding the pass button progressively adds speed');
 console.info('Fantasy cup progression, defender switching, powered moves, and curved pass flight passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
