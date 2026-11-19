const {RECRUIT_POWERS}=require('./powers.js');
const {CHARACTERS}=require('./characters.js');
const GOBLIN_TEAM={
 id:'goblins',name:'GOBLIN SLIMERS',color:'#a4cf72',description:'Four Slimers fire slowing globs while a bulky Slime Keeper guards the goal.',
 opening:true,slimers:true,goalTarget:1,count:5,keeper:true,boss:false,bonus:-27,speedScale:.91,
 pressers:1,allowSlides:false,stats:{shooting:-7,goalkeeping:17}
};
const ORC_BROTHERS={
 id:'orc-brothers',name:'ORC BROTHERS',color:'#a58b63',
 description:'Bruk and Murg move slowly, then bash across the pitch. The Orc Keeper guards the goal.',
 orcBrothers:true,goalTarget:2,count:3,keeper:true,boss:false,bonus:-16,speedScale:.62,
 pressers:1,allowSlides:false,stats:{tackling:18}
};
const SHAPESHIFTERS={
 id:'shapeshifters',name:'SHAPESHIFTERS',color:'#97b7dc',shapeshifters:true,
 count:3,keeper:false,boss:false,bonus:-12,speedScale:.34,secondPressRange:11,
 description:'Copy your players every five seconds.'
};
const OPPONENTS=[
 {id:'wall',style:'block',counter:'mendes',name:'IRON TUSKS',color:'#91b96d',bonus:-13,speedScale:.83,pressers:1,
  stats:{tackling:13,dribbling:-5},description:'Heavy defenders hold their shape. Bend a pass around them or sprint past.'},
 {id:'hunters',style:'press',counter:'cole',name:'NIGHT VEIL',color:'#ac96ed',bonus:-13,speedScale:.96,
  stats:{speed:12,shooting:-8},description:'Quick pressers hunt the ball. Shadow Step opens space.'},
 {id:'strikers',style:'shoot',counter:'price',name:'EMBER CROWN',color:'#ec8268',bonus:-11,speedScale:.91,
  stats:{shooting:16,tackling:-8},description:'Dangerous when given a shot. Close them down before they shoot.'},
 SHAPESHIFTERS
];
const DUSK_HOUNDS={
 id:'hounds',style:'press',counter:'cole',name:'THE DUSK HOUNDS',color:'#cf91e3',bonus:-5,speedScale:1,
 stats:{speed:14,stamina:10,shooting:-4},description:'Fast hunters press alongside one player from each team you faced.'
};
const RUN_LENGTH=4;
const GOAL_TARGET=3;
const RECRUITS=[
 ['KARG','price','barge'],['VORRA','price','spin'],['DREN','price','barge'],
 ['VESPER','cole','dash'],['SABLE','cole','dash'],['FEN','cole','dash'],
 ['IONA','mendes','arc'],['ELDIN','mendes','tele'],['MAEL','mendes','portal'],['LYRA','mendes','warp'],
 ['BRIEL','kowalski'],['TORIN','kowalski'],['MARA','kowalski'],['ASHK','price','blaze'],['MIST','cole','smoke']
];
const POWER_COST={barge:36,spin:40,dash:30,arc:32,tele:54,portal:65,warp:78,smoke:48,blaze:50};
const INITIAL_GOLD=155,WIN_GOLD=145,LOSS_GOLD=65;
function tavernOffers(seed,roster){
 const random=seededRandom(seed);
 const owned=new Set(roster.map(p=>p.name));
 const candidates=RECRUITS.filter(([name])=>!owned.has(name));
 return Array.from({length:3},()=>{
  const [name,characterId,ability]=candidates.splice(Math.floor(random()*candidates.length),1)[0];
  const base=CHARACTERS.find(c=>c.id===characterId);
  const roll=random(),rarity=roll<.62?0:roll<.9?1:2;
  const power=ability&&random()<[.36,.62,.86][rarity]?ability:null;
  const stats=Object.fromEntries(Object.entries(base.stats).map(([stat,value])=>[
   stat,Math.max(10,Math.min(99,value+[-16,-6,3][rarity]+Math.floor(random()*17)-8))
  ]));
  const quality=Object.entries(stats).filter(([stat])=>stat!=='goalkeeping').reduce((sum,[,value])=>sum+value,0)/7;
  const price=Math.round((100+Math.max(0,quality-60)*4+[0,25,70][rarity]+(POWER_COST[power]??0))/5)*5;
  return {id:name,name,characterId,rarity,power,price,stats,portrait:RECRUITS.findIndex(([id])=>id===name)};
 });
}
function seededRandom(seed){
 return ()=>{
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  return seed/0x100000000;
 };
}
function generateEncounter(seed,round,previousId){
 if(round===0)return {...GOBLIN_TEAM};
 if(round===1)return {...ORC_BROTHERS};
 const random=seededRandom(seed);
 const pick=list=>list[Math.floor(random()*list.length)];
 const boss=round===RUN_LENGTH-1;
 const profile=boss?DUSK_HOUNDS:pick(OPPONENTS.filter(p=>p.id!==previousId));
 if(profile.shapeshifters)return {...profile};
 const count=boss?5:2+Math.floor(random()*4);
 const keeper=boss||(count>1&&random()<.48);
 const variance=Array.from({length:count},()=>({
  speed:Math.floor(random()*9)-4,passing:Math.floor(random()*9)-4,
  shooting:Math.floor(random()*9)-4,tackling:Math.floor(random()*9)-4
 }));
 if(!boss)return {...profile,count,keeper,boss,variance};
 const rival=OPPONENTS.find(p=>p.id===previousId)??generateEncounter((seed-2654435761)>>>0,round-1);
 const lineup=[null,GOBLIN_TEAM,ORC_BROTHERS,rival,null];
 return {...profile,count,keeper,boss,variance,lineup,slimers:true,orcBrothers:true,shapeshifters:!!rival.shapeshifters};
}
class FantasyRun {
 constructor(seed=Date.now(),starter='cole',power){
  this.seed=seed>>>0;
  const base=CHARACTERS.find(c=>c.id===starter);
  this.roster=[power&&base?{...base,characterId:starter,name:base.short,power}:starter];
  this.round=0;this.status='playing';this.offers=[];
  this.gold=INITIAL_GOLD;this.goldChange=0;this.attempts=0;this.rested=false;
  this.opponent=generateEncounter(this.roundSeed,this.round);
 }
 get roundSeed(){return (this.seed+Math.imul(this.round+1,2654435761))>>>0;}
 get nextOpponent(){
  if((this.status==='between'||this.status==='tavern')&&!this.lastWin)return this.opponent;
  return this.round<RUN_LENGTH-1?generateEncounter((this.roundSeed+2654435761)>>>0,this.round+1,this.opponent.id):null;
 }
 get matchSeed(){return (this.roundSeed+Math.imul(this.attempts,374761393))>>>0;}
 finish(home,away){
  if(this.status!=='playing'||home===away||Math.max(home,away)<(this.opponent.goalTarget??GOAL_TARGET))return;
  this.lastWin=home>away;
  this.goldChange=this.lastWin?WIN_GOLD:-Math.min(LOSS_GOLD,this.gold);
  this.gold+=this.goldChange;
  if(this.lastWin&&this.round===RUN_LENGTH-1){this.status='won';return;}
  this.status='between';
 }
 enterTavern(){
  if(this.status!=='between'||this.roster.length>=5)return false;
  this.offers=tavernOffers(this.matchSeed^0x6ac690c5,this.roster);
  this.status='tavern';
  return true;
 }
 get trainable(){
  return this.roster.flatMap((player,index)=>RECRUIT_POWERS[player.power]?.level2&&player.powerLevel!==2?[{player,index}]:[]);
 }
 choose(id){
  const between=this.status==='between';
  if(!between&&this.status!=='tavern')return false;
  const recruit=!between&&this.offers.find(p=>p.id===id);
  const trainee=between&&this.trainable.find(({index})=>id===`train-${index}`);
  if(id!=='continue'&&!(between&&id==='rest')&&!trainee&&(!recruit||recruit.price>this.gold))return false;
  if(recruit){this.gold-=recruit.price;this.roster.push(recruit);}
  if(trainee)trainee.player.powerLevel=2;
  this.rested=id==='rest';
  const next=this.nextOpponent;
  if(this.lastWin){this.round++;this.attempts=0;}else this.attempts++;
  this.opponent=next;
  this.offers=[];this.status='playing';
  return true;
 }
}
module.exports={FantasyRun,RUN_LENGTH,GOAL_TARGET,GOBLIN_TEAM,ORC_BROTHERS,SHAPESHIFTERS,OPPONENTS,generateEncounter};
