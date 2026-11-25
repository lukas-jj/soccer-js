const {Time}=require('../core/lib/time.js');
const {SoundDB}=require('../core/lib/sounddb.js');
const {MatchStates}=require('../providers/simulator/simulator.js');
const {MATCH_ITEMS,TRAINING_STATS}=require('./market.js');

const {startStreaker}=require('./slimers.js');

const STAT_GEAR={boots:['speed',6],chalk:['passing',8],laces:['shooting',7],gloves:['goalkeeping',10]};
function refillSprint(players){
 for(const player of players){
  if(!player.bardFatigued)Object.assign(player.sprint,{reserve:1,exhausted:false,recoverAt:0});
 }
}
function boostSpeed(player){
 player.stats.dribblingSpeed=(player.stats.dribblingSpeed??player.stats.speed)+10;
 player.stats.speed+=10;
}

class ClubEffects {
 constructor(match,gear=[],items={}){
  this.match=match;
  this.gear=new Set(gear);
  this.items=items;
  this.gold=0;
  this.crossbarGold=0;
  this.tonics=new Map();
  this.meadBoosted=false;
  this.firstGoal=false;
  this.earnedCleanSheet=false;
  const {sim}=match;
  if(this.gear.has('tea'))match.staminaMultiplier*=1.3;
  for(const player of sim.teamA.players){
   for(const id of this.gear){
    const boost=STAT_GEAR[id];
    if(!boost||id==='gloves'&&player.role!=='GK')continue;
    const [stat,amount]=boost;
    player.stats[stat]=Math.min(100,player.stats[stat]+amount);
   }
   if(this.gear.has('hourglass'))player.powerCooldown*=.85;
  }
  const rewardedKicks=new WeakMap();
  sim.onCrossbarHit=(goal,ball)=>{
   const eligible=!match.practice||match.sandbox==='crossbar'||match.streetChallenge;
   if(!eligible||!this.gear.has('crossbar')||ball.lastKicker?.team!=='A'||
    goal.defendingTeam(sim.isSecondHalf())==='A'||rewardedKicks.get(ball)===ball.kickSequence)return;
   rewardedKicks.set(ball,ball.kickSequence);
   this.crossbarGold+=100;
   this.award(100,'Crossbar');
  };
 }

 feedback(text){this.match.feedback={text,until:Time.time+2.5};}
 award(amount,label){this.gold+=amount;this.feedback(`${label} · +${amount} gold`);}

 goal(side,scorer){
  if(side==='B'){
   if(this.gear.has('banner')){
    refillSprint(this.match.sim.teamA.players);
    this.feedback('Comeback Banner · Sprint restored');
   }
   return;
  }
  const players=this.match.sim.teamA.players;
  const bardPlaying=players.some(player=>player.isBard&&!player.isSentOff);
  const chant=this.gear.has('bard')&&scorer?.team==='A';
  if(bardPlaying||chant){
   SoundDB.play('bard');
   if(bardPlaying)players.filter(player=>!player.isSentOff).forEach(boostSpeed);
   if(chant)boostSpeed(scorer);
   this.feedback(bardPlaying?'Bard · Team speed increased':"Bard’s Chant · Scorer speed increased");
  }
  if(this.gear.has('first-goal')&&!this.firstGoal){
   this.firstGoal=true;
   this.award(45,'First Goal Purse');
  }
 }

 finish(){
  const {match}=this;
  if(this.gear.has('sheet')&&!this.earnedCleanSheet&&match.winner==='A'&&match.sim.scoreB===0){
   this.earnedCleanSheet=true;
   this.award(65,'Clean sheet');
  }
  return this.gold;
 }

 previewStat(id){
  const boost=STAT_GEAR[id];
  if(!boost)return '';
  const [stat,amount]=boost;
  const player=id==='gloves'?this.match.sim.teamA.getGoalkeeper():this.match.player;
  const label=TRAINING_STATS.find(([key])=>key===stat)[1];
  return player?`${label} · ${player.stats[stat]} (+${amount})`:'';
 }

 step(){
  for(const [player,until] of this.tonics){
   if(Time.time<until)continue;
   player.movementScale/=1.35;
   this.tonics.delete(player);
  }
 }

 use(id,target){
  const {match,items}=this,{sim,player}=match;
  if(!items[id]||sim.matchState!=='play'||sim.setPieceType)return false;
  switch(id){
   case 'slimer-streaker':
    if(sim.slimerStreaker)return false;
    startStreaker(sim);break;
   case 'water':
    refillSprint(sim.teamA.players);
    if(!this.meadBoosted){
     for(const teammate of sim.teamA.players)teammate.movementScale=(teammate.movementScale??1)*1.1;
     this.meadBoosted=true;
    }
    break;
   case 'whistle':
    const ability=match.powerFor(player);
    if(!ability||ability.passive||player.powerReadyAt<=Time.time)return false;
    player.powerReadyAt=Time.time;break;
   case 'tonic':
    if(!this.tonics.has(player))player.movementScale=(player.movementScale??1)*1.35;
    this.tonics.set(player,Time.time+8);break;
   case 'overtime':match.secondsLeft+=10;break;
   case 'red-card':
    if(!target||target.team!=='B'||target.isSentOff)return false;
    target.isSentOff=true;
    if(sim.ball.owner===target){
     sim.ball.owner=null;
     sim.ball.lastKicker=null;
    }
    if(!match.practice&&sim.teamB.players.every(p=>p.isSentOff)){
     match.forfeitWinner='A';
     sim.fsm.changeState(MatchStates.Fulltime);
    }
    break;
   default:return false;
  }
  items[id]--;
  this.feedback(MATCH_ITEMS.find(item=>item.id===id).name);
  return true;
 }
}

module.exports={ClubEffects};
