const {APPEARANCES,playerAppearance,appearanceBody}=require('./appearances.js');
const {CHARACTERS,squadNumber,seededRandom,rollBody,starterStats}=require('./characters.js');
const {CLUB_GEAR,SHOP_ITEMS,TRAINING_STATS,statMax,statRating,EVENTS,LAST_REF}=require('./market.js');
const {rollStreetChallenger}=require('./street_challenges.js');
const GOBLIN_TEAM={
 id:'goblins',name:'SLIMERS',color:'#a4cf72',description:'Slimers try weak shots from distance and fire slowing globs. A bulky Slime Keeper guards their goal.',
 opening:true,slimers:true,count:5,keeper:true,boss:false,bonus:-27,speedScale:.91,
 pressers:1,allowSlides:false,stats:{shooting:-7,goalkeeping:17}
};
const HORDE_FC={
 id:'horde-fc',name:'HORDE FC',color:'#a58b63',
 description:'Bruk and Murg move slowly, Gorr moves at medium pace, and all three can barge. The Orc Keeper guards the goal.',
 hordeFC:true,count:4,keeper:true,boss:false,bonus:-16,speedScale:.62,
 pressers:1,allowSlides:false,stats:{tackling:18}
};
const SHAPESHIFTERS={
 id:'shapeshifters',name:'SHAPESHIFTERS',color:'#97b7dc',shapeshifters:true,
 count:3,keeper:false,boss:false,bonus:-12,speedScale:.34,secondPressRange:11,
 description:'Copy your players every five seconds.'
};
const FROST_GIANTS={id:'frost-giants',style:'block',counter:'mendes',name:'FROST GIANTS',color:'#75b4df',
 frostGiants:true,keeper:true,bonus:-13,pressers:1,stats:{tackling:13,dribbling:-5},
 description:'Frost Giants leave ice trails. Players slide through turns and stops, and the ball rolls farther.'
};
const OPPONENTS=[
 FROST_GIANTS,
 {id:'hunters',style:'press',counter:'cole',name:'NIGHT VEIL',color:'#ac96ed',bonus:-13,speedScale:.96,
  stats:{speed:12,shooting:-8},description:'Quick pressers hunt the ball. Shadow Step opens space.'},
 {id:'strikers',style:'shoot',counter:'price',name:'EMBER CROWN',color:'#ec8268',bonus:-11,speedScale:.91,
  stats:{shooting:16,tackling:-8},description:'Dangerous when given a shot. Close them down before they shoot.'},
 SHAPESHIFTERS
];
const MIX_BAG_FC={
 id:'mix-bag-fc',style:'press',counter:'cole',name:'MIX BAG FC',color:'#cf91e3',bonus:-5,speedScale:1,
 count:4,keeper:true,boss:true,slimers:true,shapeshifters:true,hordeFC:true,
 lineup:[null,GOBLIN_TEAM,SHAPESHIFTERS,
  {...HORDE_FC,hordePlayer:{name:'BRUK',body:{width:1.31,height:1.14},speed:.58}}],
 stats:{speed:14,stamina:10,shooting:-4},description:'A shapeshifter copies your players, a Slimer fires slowing globs, and a slow, heavy Orc uses Barge to stun. A keeper guards the goal.'
};
const RUN_LENGTH=4;
// Index zero is the player club. The final two rival fixtures are played on its bye.
const RIVAL_FIXTURES=[[[2,3]],[[3,4]],[[4,1]],[[1,2],[1,3],[2,4]]];
function recordResult(home,away,homeGoals,awayGoals){
 for(const [team,scored,conceded] of [[home,homeGoals,awayGoals],[away,awayGoals,homeGoals]]){
  team.played++;
  team.goalsFor+=scored;
  team.goalDifference+=scored-conceded;
  team.points+=matchPoints(scored,conceded);
 }
}
const matchPoints=(scored,conceded)=>scored>conceded?3:scored===conceded?1:0;
const leagueOrder=(a,b)=>b.points-a.points||b.goalDifference-a.goalDifference||b.goalsFor-a.goalsFor;
const RECRUITS=[
 ['KARG','price','barge','Grum'],['VORRA','price','spin'],['DREN','price','barge'],
 ['VESPER','cole','dash'],['SABLE','mendes','clone'],['FEN','cole','nutmeg'],
 ['IONA','mendes','arc'],['ELDIN','mendes','tele'],['MAEL','mendes','portal','Rune'],['LYRA','mendes','warp'],
 ['ASHK','price','blaze'],['GARR','price','blast'],['MIST','cole'],['QUILL','cole','stepover']
];
const POWER_COST={barge:36,spin:40,dash:30,arc:32,tele:54,portal:65,warp:78,blaze:50,blast:55,nutmeg:50,clone:58,stepover:44};
const RARE_KEEPER={id:'varek',name:'Varek Stonewall',keeper:true,characterId:'kowalski',rarity:2,power:null,price:220};
const INITIAL_GOLD=155,WIN_GOLD=145;
function tavernStats(stats,scale){
 return Object.fromEntries(Object.entries(stats).map(([stat,value])=>[stat,Math.round(value*scale/10)*10]));
}
function tavernOffers(seed,roster,firstTavern){
 const random=seededRandom(seed);
 const owned=new Set(roster.map(p=>p.name));
 const used=new Set(roster.map(p=>p.number));
 const numbers=seededRandom(Math.imul(seed,0x9e3779b1)^0xc795a2d1);
 const bodies=seededRandom(seed^0xc31e40b9);
 const hasKeeper=roster.some(p=>p.keeper);
 const candidates=RECRUITS.filter(([name])=>!owned.has(name));
 const offers=Array.from({length:3},()=>{
  const [name,characterId,ability,lookName=name]=candidates.splice(Math.floor(random()*candidates.length),1)[0];
  const base=CHARACTERS.find(c=>c.id===characterId);
  const appearance=APPEARANCES[characterId].find(look=>look.name.toUpperCase()===lookName.toUpperCase()).id;
  const roll=random(),rarity=roll<.62?0:roll<.9?1:2;
  const power=ability&&random()<[.36,.62,.86][rarity]?ability:null;
  const stats=tavernStats(base.stats,firstTavern?[.6,.68,.76][rarity]:1);
  const quality=Object.entries(stats).filter(([stat])=>stat!=='goalkeeping'&&stat!=='dribblingSpeed').reduce((sum,[,value])=>sum+value,0)/7;
  const price=Math.round((100+Math.max(0,quality-44)*4+[0,25,70][rarity]+(POWER_COST[power]??0))/5)*5;
  return {id:name,name,characterId,appearance,rarity,power,price,stats,number:squadNumber(numbers,used),body:rollBody(characterId,bodies)};
 });
 if(!hasKeeper){
  offers.push({id:'keeper',name:'Orc Keeper',keeper:true,characterId:'price',appearance:4,rarity:0,power:null,price:240,
   number:squadNumber(numbers,used),body:rollBody('keeper',bodies),stats:tavernStats({...CHARACTERS[0].stats,shooting:49,goalkeeping:73},firstTavern ? .7 : 1)});
 }
 return offers;
}
function draftSquadUpgrades(roster,random){
 const take=pool=>pool.splice(Math.floor(random()*pool.length),1)[0];
 const eligible=roster.map((player,playerIndex)=>({
  player,playerIndex,stats:TRAINING_STATS.filter(([stat])=>statRating(player.stats,stat)<statMax(stat)&&(stat!=='goalkeeping'||player.keeper))
 })).filter(entry=>entry.stats.length);
 const queue=[];
 while(eligible.length)queue.push(take(eligible));
 const cards=[];
 while(cards.length<3&&queue.length){
  const entry=queue.shift();
  const [stat,name]=take(entry.stats);
  const current=statRating(entry.player.stats,stat);
  cards.push({kind:'stat',playerIndex:entry.playerIndex,stat,name,current,
   next:Math.min(statMax(stat),current+6+2*Math.floor(random()*3))});
  if(entry.stats.length)queue.push(entry);
 }
 return cards;
}
function generateEncounter(seed,round,previousId){
 if(round===0)return {...GOBLIN_TEAM};
 if(round===1)return {...HORDE_FC};
 const random=seededRandom(seed);
 const pick=list=>list[Math.floor(random()*list.length)];
 const boss=round===RUN_LENGTH-1;
 const profile=boss?MIX_BAG_FC:pick(OPPONENTS.filter(p=>p.id!==previousId));
 if(!boss&&profile.shapeshifters)return {...profile};
 const count=profile.count??2+Math.floor(random()*4);
 const keeper=profile.keeper??(count>1&&random()<.48);
 const variance=Array.from({length:count},()=>({
  speed:Math.floor(random()*9)-4,passing:Math.floor(random()*9)-4,
  shooting:Math.floor(random()*9)-4,tackling:Math.floor(random()*9)-4
 }));
 return {...profile,count,keeper,boss,variance};
}
const KICK_UP_EVENT={
 name:'Street Kick-Ups',
 description:'Pick a target and keep the ball off the ground. One attempt.',
 choices:[
  ...[10,20,30].map(target=>({label:`${target} kick-ups · ${target*10} gold`,kickUpTarget:target})),
  {label:'Keep walking'}
 ]
};
const CROSSBAR_EVENT={challenge:'crossbar',name:'Crossbar Challenge',
 description:'Earn 50 gold per hit, or 300 gold and the Crossbar Relic for hitting all three. The relic pays 100 gold per crossbar hit in future matches and events.'};
const DUEL_WIN_GOLD=250;
const DUEL_POTIONS=['tonic','whistle','water'];
const DUEL_EVENT={challenge:'duel',name:'Street 1v1',
 description:`Pick a player. Take turns attacking one goal against a defender and a neutral keeper. Use the walls to keep the ball in play. You each get up to three 10-second attacks. Win outright to choose ${DUEL_WIN_GOLD} gold or recruit your opponent.`};
const SPECIAL_EVENTS=[DUEL_EVENT,KICK_UP_EVENT,CROSSBAR_EVENT];
const VAREK_EVENT={name:RARE_KEEPER.name,description:'A rare goalkeeper with 84 Saving.'};
const TEXT_EVENTS=[...EVENTS,VAREK_EVENT];
class FantasyRun {
 constructor(seed=Date.now(),starter='cole',power,{name='Spellside',color='#f5b841',number,appearance}={}){
  this.seed=seed>>>0;
  const base=CHARACTERS.find(c=>c.id===starter);
  this.teamName=name;this.teamColor=color;
  const look=playerAppearance(starter,appearance);
  this.roster=[{...base,stats:starterStats(base.stats),characterId:starter,appearance:look?.id,body:appearanceBody(base.body,look),name:look?.name.toUpperCase()??base.short,power,number:number??squadNumber(seededRandom(this.seed^0x765d44d3),new Set())}];
  this.round=0;this.status='ready';this.offers=[];this.marketPerks=[];
  this.matchesPlayed=0;this.gear=[];this.items={};this.teamAbilities=[];
  this.gold=INITIAL_GOLD;this.goldChange=0;
  this.schedule=Array.from({length:RUN_LENGTH},(_,round)=>generateEncounter(this.fixtureSeed(round),round));
  this.opponent=this.schedule[0];
  this.league=[{name},...this.schedule].map(({name})=>({name,played:0,points:0,goalsFor:0,goalDifference:0}));
  this.rivalRecruit=null;
  this.upgradeCards=[];
  this.upgradePick=null;
  this.upgradeSelection=null;
 }
 fixtureSeed(round){return (this.seed+Math.imul(round+1,2654435761))>>>0;}
 get nextOpponent(){return this.schedule[this.round+1]??null;}
 get matchSeed(){return this.fixtureSeed(this.round);}
 get duelChallenger(){return rollStreetChallenger(this.matchSeed);}
 get standings(){return [...this.league].sort(leagueOrder);}
 get seasonComplete(){return this.matchesPlayed===RUN_LENGTH;}
 finish(home,away,winner=home>away?'A':away>home?'B':null,bonus=0,opponents=[],crossbarGold=0){
  if(this.status!=='playing')return;
  this.bardCurse=null;
  this.previousStandings=this.standings;
  this.lastPoints=matchPoints(home,away);
  this.matchesPlayed++;
  this.lastWin=winner==='A';
  this.lastDraw=winner===null;
  this.goldChange=crossbarGold+(this.lastWin?WIN_GOLD+bonus:0);
  recordResult(this.league[0],this.league[this.round+1],home,away);
  const results=seededRandom(this.matchSeed^0x002be7d3);
  for(const [a,b] of RIVAL_FIXTURES[this.round]){
   recordResult(this.league[a],this.league[b],Math.floor(results()*4),Math.floor(results()*4));
  }
  this.gold+=this.goldChange;
  this.rivalRecruit=this.createRivalOffer(opponents);
  const random=seededRandom(this.matchSeed^0x53ea4f81);
  this.upgradeCards=draftSquadUpgrades(this.roster,random);
  this.upgradePick=null;
  this.upgradeSelection=null;
  if(this.seasonComplete){this.status=leagueOrder(this.league[0],this.standings[0])===0?'won':'lost';return;}
  this.status='between';
 }
 createRivalOffer(opponents){
  if(!this.lastWin||!this.gear.includes('scouting-contract')||this.roster.length>=5)return null;
  const candidates=opponents.filter(p=>p.role!=='GK'&&!this.roster.some(entry=>entry.name===p.name));
  if(!candidates.length)return null;
  const random=seededRandom(this.matchSeed^0x6faccba1);
  const player=candidates[Math.floor(random()*candidates.length)];
  const characterId=player.characterId??(player.isSlimer?'cole':'kowalski');
  const base=CHARACTERS.find(c=>c.id===characterId);
  const stats=Object.fromEntries(TRAINING_STATS.map(([id])=>[id,statRating(player.stats,id)??statRating(base.stats,id)]));
  return {id:`rival-${this.opponent.id}-${player.jersey}`,name:player.name,number:squadNumber(random,new Set(this.roster.map(p=>p.number))),
   characterId,appearance:player.appearance?.id,appearanceClass:player.appearance?.race,rarity:1,body:player.body,stats,power:player.isOrc?'barge':null,
   ...(player.isFrostGiant?{frostGiant:true}:{})};
 }
 signRival(){
  if(!['between','won','lost'].includes(this.status)||!this.canConfirmUpgrade||!this.rivalRecruit||this.roster.length>=5)return false;
  this.roster.push(this.rivalRecruit);
  this.rivalRecruit=null;
  return true;
 }
 enterTavern(){
  if(this.status!=='route'||this.roster.length>=5)return false;
  this.offers=tavernOffers(this.matchSeed^0x6ac690c5,this.roster,this.round===0);
  this.status='tavern';
  return true;
 }
 get event(){
  if(this.previewEncounter)return this.previewEncounter;
  const random=seededRandom(this.matchSeed^0x42b593cf);
  if(seededRandom(this.matchSeed^0x45e55e43)()<.4){
   const roll=random();
   return roll<.6?DUEL_EVENT:roll<.82?KICK_UP_EVENT:CROSSBAR_EVENT;
  }
  if(random()<.02)return LAST_REF;
  const keeper=this.roster.find(player=>player.keeper);
  if(random()<.12&&keeper?.id!==RARE_KEEPER.id&&(keeper||this.roster.length<5)){
   return this.varekEvent(keeper);
  }
  return EVENTS[1+Math.floor(random()*(EVENTS.length-1))];
 }
 varekEvent(keeper){
  return {...VAREK_EVENT,
   choices:[{label:`Sign Varek · 220 gold${keeper?' · Replaces your keeper':''}`,cost:RARE_KEEPER.price,recruit:RARE_KEEPER},
    {label:'Leave him be'}]};
 }
 previewEvent(name){
  const event=[...SPECIAL_EVENTS,...TEXT_EVENTS].find(entry=>entry.name===name);
  if(!event)return false;
  this.previewEncounter=event===VAREK_EVENT?this.varekEvent():event;
  this.status='event';
  return true;
 }
 startMatch(){
  if(this.status!=='ready')return false;
  this.status='playing';
  return true;
 }
 get upgradesComplete(){return this.upgradePick!==null||this.upgradeCards.length===0;}
 get canConfirmUpgrade(){return this.upgradesComplete||this.upgradeSelection!==null;}
 selectUpgrade(choice){
  if(!Number.isInteger(choice)||!['between','won','lost'].includes(this.status)||this.upgradePick!==null||!this.upgradeCards[choice])return false;
  this.upgradeSelection=choice;
  return true;
 }
 confirmUpgrade(){
  return this.upgradesComplete||this.claimUpgrade(this.upgradeSelection);
 }
 claimUpgrade(choice){
  if(!this.selectUpgrade(choice))return false;
  const card=this.upgradeCards[choice];
  const player=this.roster[card.playerIndex];
  const stats=player.stats;
  player.stats={...stats,dribblingSpeed:statRating(stats,'dribblingSpeed'),[card.stat]:card.next};
  this.upgradePick=choice;
  this.upgradeSelection=null;
  return true;
 }
 purchase(id){
  if(this.status!=='market')return false;
  const gear=this.marketPerks.find(entry=>entry.id===id);
  const item=gear||SHOP_ITEMS.find(entry=>entry.id===id);
  if(!item||this.gold<item.price||gear&&this.gear.includes(id))return false;
  this.gold-=item.price;
  if(gear)this.gear.push(id);
  else this.addItem(id);
  return true;
 }
 addItem(id){this.items[id]=(this.items[id]??0)+1;}
 canChooseEvent(choice){
  return !!choice&&this.gold>=(choice.cost??0)&&(!choice.gear||!this.gear.includes(choice.gear))
   &&(!choice.recruitBard||this.roster.length<5&&!this.roster.some(player=>player.bard));
 }
 chooseEvent(index){
  if(this.status!=='event'||this.kickUpTarget||this.eventChallenge||this.pendingBardCurse||!this.event.choices)return false;
  const choice=this.event.choices[index];
  if(!this.canChooseEvent(choice))return false;
  if(choice.bardCurse){
   this.pendingBardCurse=true;
   return true;
  }
  if(choice.recruitBard){
   const random=seededRandom(this.matchSeed^0x4c302766);
   this.roster.push({id:'bard',bard:true,name:'BARD',characterId:'mendes',power:null,
    stats:Object.fromEntries(TRAINING_STATS.map(([stat])=>[stat,10])),
    body:rollBody('mendes',random),number:squadNumber(random,new Set(this.roster.map(player=>player.number)))});
  }
  if(choice.kickUpTarget){
   this.kickUpTarget=choice.kickUpTarget;
   return true;
  }
  if(choice.recruit){
   const keeperIndex=this.roster.findIndex(player=>player.keeper);
   if(keeperIndex<0&&this.roster.length>=5)return false;
   const random=seededRandom(this.matchSeed^0x15e44239);
   const recruit={...choice.recruit,number:squadNumber(random,new Set(this.roster.map(p=>p.number))),
    body:rollBody('keeper',random),stats:{...CHARACTERS[3].stats,speed:59,dribblingSpeed:59,shooting:46,passing:70,goalkeeping:84}};
   if(keeperIndex<0)this.roster.push(recruit);
   else this.roster[keeperIndex]=recruit;
  }
  this.gold+=(choice.gold??0)-(choice.cost??0);
  if(choice.gear)this.gear.push(choice.gear);
  for(const item of choice.items??[])this.addItem(item);
  return this.finishRoute();
 }
 chooseBardCurse(index){
  const player=this.roster[index];
  if(this.status!=='event'||!this.pendingBardCurse||!Number.isInteger(index)||!player)return false;
  const kinds=['speed','ability','stamina'];
  const random=seededRandom(this.matchSeed^0x74f92b21);
  this.bardCurse={number:player.number,kind:kinds[Math.floor(random()*kinds.length)]};
  this.pendingBardCurse=false;
  return this.finishRoute();
 }
 finishKickUps(count){
  if(this.status!=='event'||!this.kickUpTarget||!Number.isInteger(count)||count<0)return false;
  const reward=count>=this.kickUpTarget?this.kickUpTarget*10:0;
  this.kickUpTarget=null;
  this.gold+=reward;
  this.finishRoute();
  return reward;
 }
 beginEventChallenge(){
  if(this.status!=='event'||this.eventChallenge||this.duelReward||!this.event.challenge)return false;
  this.duelConsolation=null;
  this.eventChallenge=this.event.challenge;
  return true;
 }
 finishEventChallenge({home=0,away=0,hits=0,forfeited=false,crossbarGold=0}){
  if(this.status!=='event'||!this.eventChallenge)return false;
  if(![home,away,hits].every(value=>Number.isInteger(value)&&value>=0&&value<=3))return false;
  const crossbar=this.eventChallenge==='crossbar';
  const hasRelic=this.gear.includes('crossbar');
  if(!Number.isSafeInteger(crossbarGold)||crossbarGold<0||crossbarGold%100)return false;
  const base=crossbar?(hits===3?300:hits*50):0;
  const reward=forfeited?0:base+(hasRelic?crossbarGold:0);
  if(crossbar&&!forfeited&&hits===3&&!hasRelic)this.gear.push('crossbar');
  this.eventChallenge=null;
  this.gold+=reward;
  if(!forfeited&&!crossbar){
   if(home>away){
    this.duelReward={gold:DUEL_WIN_GOLD,challenger:this.duelChallenger};
    return reward;
   }
   const random=seededRandom(this.matchSeed^0x7a88ae61);
   this.duelConsolation=DUEL_POTIONS[Math.floor(random()*DUEL_POTIONS.length)];
   this.addItem(this.duelConsolation);
  }
  this.finishRoute();
  return reward;
 }
 chooseDuelReward(choice){
  if(this.status!=='event'||!this.duelReward)return false;
  const {gold,challenger}=this.duelReward;
  if(choice==='gold')this.gold+=gold;
  else if(choice==='recruit'&&this.roster.length<5){
   const {name,characterId,appearance,body,power,stats}=challenger;
   const number=squadNumber(seededRandom(this.matchSeed^0xbb13c1fc),new Set(this.roster.map(player=>player.number)));
   this.roster.push({id:`street-${this.matchSeed}`,name,characterId,appearance,body:{...body},power,stats:{...stats},number});
  }else return false;
  this.duelReward=null;
  return this.finishRoute();
 }
 finishRoute(){
  if(this.kickUpTarget||this.eventChallenge||this.duelReward||this.pendingBardCurse||!['route','tavern','market','event'].includes(this.status))return false;
  const next=this.nextOpponent;
  this.round++;
  this.opponent=next;
  this.offers=[];this.marketPerks=[];this.rivalRecruit=null;this.status='ready';
  this.upgradeCards=[];
  this.upgradePick=null;
  this.upgradeSelection=null;
  return true;
 }
 choose(id){
  if(this.status==='between'&&this.upgradesComplete&&id==='rest'){this.status='route';return true;}
  if(this.status==='route'&&id==='market'){
   const random=seededRandom(this.matchSeed^0x571a9c3b);
   const eligible=CLUB_GEAR.filter(perk=>perk.price!==undefined&&!this.gear.includes(perk.id));
   this.marketPerks=Array.from({length:Math.min(3,eligible.length)},
    ()=>eligible.splice(Math.floor(random()*eligible.length),1)[0]);
   this.status='market';
   return true;
  }
  if(this.status==='route'&&id==='event'){this.status='event';return true;}
  if(this.status==='tavern'&&id!=='continue'){
   const recruit=this.offers.find(p=>p.id===id);
   if(!recruit||recruit.price>this.gold||this.roster.length>=5)return false;
   this.gold-=recruit.price;
   this.roster.push(recruit);
   this.offers=this.offers.filter(offer=>offer!==recruit);
   return true;
  }
  return id==='continue'&&this.finishRoute();
 }
}
module.exports={FantasyRun,RUN_LENGTH,GOBLIN_TEAM,HORDE_FC,FROST_GIANTS,SHAPESHIFTERS,OPPONENTS,generateEncounter,SPECIAL_EVENTS,TEXT_EVENTS};
