const {CONFIG,CLUBS,CLUB_PERKS,ARCHETYPES,FORMATIONS,TRAINING} = require('./data.js');
const P=require('./players.js');
function applyClubIdentity(s) {
 const adjustments = {harbor:{stamina:7,tackling:5,shooting:-5},orchard:{passing:8,accuracy:5,speed:-4,tackling:-4},summit:{speed:5,shooting:8,tackling:-6}}[s.clubId];
 for (const p of s.squad) for (const [stat,gain] of Object.entries(adjustments)) p.stats[stat]=P.clamp(p.stats[stat]+gain,1,100);
}
const ensure=(condition,message)=>{if(!condition)throw Error(message);};
function addEvent(s,text){s.events.push(text);s.events=s.events.slice(-60);}
function price(s,amount){return Math.round(amount*(1+s.division*.4));}
function recruitPrice(s,p,scouted=false){return price(s,Math.round((p.stats.speed+p.stats.passing+p.stats.shooting+p.stats.goalkeeping)*2*(scouted?.65:1)));}
function charge(s,amount,label){ensure(Number.isFinite(amount)&&amount>=0,'Invalid expense');s.money-=amount;s.ledger.push({day:s.day,amount:-amount,label});if(s.money<0){s.phase='gameover';s.ending='Bankruptcy: your club could not pay its fixture operating costs.';}}
function spend(s,amount,label){ensure(s.money>=amount,'Not enough funds');charge(s,amount,label);}
function earn(s,amount,label){s.money+=amount;s.ledger.push({day:s.day,amount,label});}
function makeSquad(s,bias,strength=0){
 const types=['Shot Stopper','Enforcer','Workhorse','Enforcer','Speedster','Playmaker','All-Rounder','Workhorse','Speedster','Finisher','Finisher','Sweeper Keeper',bias,bias,'All-Rounder','Finisher'];
 return types.map((type,i)=>P.createPlayer(s,i===6?bias:type,strength));
}
function schedule(ids){
 // Circle round robin, each pair exactly once; one fixture per club per round.
 const rotation=ids.slice(),rounds=[];
 for(let r=0;r<ids.length-1;r++){
  const pairs=[];for(let i=0;i<ids.length/2;i++)pairs.push([rotation[i],rotation[ids.length-1-i]]);
  rounds.push(pairs);rotation.splice(1,0,rotation.pop());
 }return rounds;
}
function setupSeason(s){
 const names=['Copper Borough','Willow Athletic','Ember United'];
 s.opponents=names.map((name,i)=>({id:`r${i}`,name,squad:makeSquad(s,Object.keys(ARCHETYPES)[i+1],s.division*7+Math.min(s.season-1,5))}));
 s.table=[{id:s.clubId,name:s.clubName},...s.opponents.map(o=>({id:o.id,name:o.name}))].map(t=>({...t,played:0,w:0,d:0,l:0,points:0,gf:0,ga:0}));
 s.schedule=schedule(s.table.map(t=>t.id));s.round=0;s.results=[];s.prepLeft=CONFIG.prepDays;s.phase='prep';s.visit=null;s.match=null;
 s.forecast=P.pick(s,['fine','rainy','snowy']);
}
function newRun(clubId,seed=Date.now()){
 const club=CLUBS.find(c=>c.id===clubId);ensure(club,'Choose a club');
 const s={version:CONFIG.version,rng:seed>>>0,nextId:1,clubId,clubName:club.name,money:CONFIG.startingMoney,division:0,season:1,day:0,
  perks:[club.perk],perkChoices:[],staff:[],inventory:{},formation:'4-4-2',tactic:'balanced',squad:[],lineup:[],events:[],ledger:[],won:false,lastReport:null};
 s.squad=makeSquad(s,club.bias);applyClubIdentity(s);s.lineup=s.squad.slice(0,11).map(p=>p.id);setupSeason(s);
 addEvent(s,'Welcome. Choose one activity on each of three preparation days. Squad changes are free. Matches award XP; training adds stats directly.');return s;
}
function trainingUnlocked(s,type){return ['passing','running'].includes(type)||(['shooting','dribbling'].includes(type)&&s.staff.includes('technique'))||(['tackling','goalkeeping'].includes(type)&&s.staff.includes('defence'));}
function available(s){ensure(s.phase==='prep'&&s.prepLeft>0,'No preparation days left');}
function passDay(s){
 s.day++;s.prepLeft--;s.visit=null;
 for(const p of s.squad){
  p.fatigue=P.clamp(p.fatigue-CONFIG.dailyRecovery);
  if(p.injury){p.injury.days-=s.staff.includes('medic')?2:1;if(p.injury.days<=0){p.injury=null;addEvent(s,`${p.name} has recovered.`);}}
 }
}
function activity(s,action,options={}){
 available(s);ensure(['train','rest','scout','market','shop'].includes(action),'Unknown activity');
 if(action==='train'){
  ensure(trainingUnlocked(s,options.type),'Hire the required coach first');
  if(options.split){ensure(s.staff.includes('split')&&trainingUnlocked(s,options.split),'Split training is locked');ensure(Array.isArray(options.group)&&options.group.length>0&&options.group.length<s.squad.length,'Choose players for both groups');ensure(options.group.every(id=>s.squad.some(p=>p.id===id)),'Invalid training group');}
 }
 passDay(s);
 if(action==='rest'){
  const recovery=CONFIG.restRecovery+(s.perks.includes('recovery')?12:0);
  s.squad.forEach(p=>p.fatigue=P.clamp(p.fatigue-recovery));addEvent(s,`Rest: squad fatigue reduced by ${recovery} (plus daily recovery).`);
 }else if(action==='train'){
  s.squad.forEach(p=>P.trainPlayer(s,p,TRAINING[options.split&&options.group.includes(p.id)?options.split:options.type]));
  addEvent(s,`Training: +${CONFIG.trainingGain} to each trained attribute (half for fatigue over 60), +${CONFIG.trainingFatigue} fatigue. No overall XP.`);
 }else if(action==='scout'||action==='market'){
  s.visit=action;s.offers=Array.from({length:action==='scout'?3:6},()=>{
   const player=P.createPlayer(s,P.pick(s,Object.keys(ARCHETYPES)),s.division*7+(action==='market'?6:Math.floor(P.random(s)*10)-5));
   return {player,price:recruitPrice(s,player,action==='scout'),scouted:action==='scout',estimates:Object.fromEntries(Object.entries(player.stats).map(([k,v])=>[k,P.clamp(v+Math.floor(P.random(s)*17)-8,1,100)]))};
  });addEvent(s,action==='scout'?'Scout returned 3 prospects: lower fees, attribute estimates ±8 until signed.':'Market opened: 6 fully assessed players at premium fees.');
 }else {s.visit='shop';addEvent(s,'Shop open: purchases go into inventory. Use items whenever outside a match.');}
 const event=P.random(s);
 if(event<.07){earn(s,price(s,130),'Community fundraiser');addEvent(s,'Local supporters raised funds for the club.');}
 else if(event<.11){const p=P.pick(s,s.squad.filter(p=>!p.injury));if(p)P.injure(s,p);}
 else if(event<.14){const p=P.pick(s,s.squad);if(!p.perks.includes('resilient')){p.perks.push('resilient');addEvent(s,`${p.name} learned better recovery habits: Resilient gained.`);}}
}
function buy(s,key){ensure(s.phase==='prep'&&s.visit==='shop','Visit Shop as a daily activity first');const item=CONFIG.items[key];ensure(item,'Unknown item');spend(s,price(s,item.price),item.name);s.inventory[key]=(s.inventory[key]||0)+1;}
function hire(s,key){ensure(s.phase==='prep','Staff can be hired in preparation');const staff=CONFIG.staff[key];ensure(staff&&!s.staff.includes(key),'Staff unavailable');if(key==='split')ensure(s.staff.includes('technique')&&s.staff.includes('defence'),'Hire both coaches first');spend(s,price(s,staff.price),staff.name);s.staff.push(key);addEvent(s,`Hired ${staff.name}. ${staff.description}`);}
function useItem(s,key,id,curse){
 ensure(s.phase==='prep','Items can be used during preparation');ensure((s.inventory[key]||0)>0,'Item not in inventory');const p=s.squad.find(p=>p.id===id);ensure(p,'Choose a player');
 if(key==='spray')p.fatigue=P.clamp(p.fatigue-30);
 else if(key==='treatment'){ensure(p.injury,'Player is not injured');p.injury.days-=3;if(p.injury.days<=0)p.injury=null;}
 else if(key==='relief'){ensure(p.curses.length,'Player has no curse');p.reliefUntil=s.day+4;}
 else if(key==='cleanse'){ensure(p.curses.includes(curse),'Choose a curse');p.curses=p.curses.filter(c=>c!==curse);}
 else throw Error('Unknown item');s.inventory[key]--;addEvent(s,`${CONFIG.items[key].name} used on ${p.name}.`);
}
function sign(s,id){ensure(s.phase==='prep'&&['scout','market'].includes(s.visit),'Visit scouting or market first');const offer=s.offers.find(o=>o.player.id===id);ensure(offer,'Player unavailable');ensure(s.squad.length<CONFIG.squadMax,'Squad full (22)');spend(s,offer.price,`Recruit ${offer.player.name}`);s.squad.push(offer.player);s.offers=s.offers.filter(o=>o!==offer);}
function removePlayer(s,id,release=false){ensure(s.phase==='prep','Manage transfers in preparation');ensure(s.squad.length>CONFIG.squadMin,'Need at least 11 players');ensure(!s.lineup.includes(id),'Move the player to the bench first');const p=s.squad.find(p=>p.id===id);ensure(p,'Unknown player');s.squad=s.squad.filter(x=>x.id!==id);if(!release)earn(s,Math.round(recruitPrice(s,p)*.4),`Sell ${p.name}`);addEvent(s,`${p.name} ${release?'released':'sold'}.`);}
function assign(s,slot,id){ensure(s.phase==='prep','Use live substitutions during a match');ensure(Number.isInteger(slot)&&slot>=0&&slot<11,'Invalid slot');ensure(s.squad.some(p=>p.id===id&&!p.injury),'Player injured or unavailable');const old=s.lineup[slot],other=s.lineup.indexOf(id);s.lineup[slot]=id;if(other>=0)s.lineup[other]=old;}
function setFormation(s,name){ensure(s.phase==='prep'&&FORMATIONS[name],'Invalid formation');s.formation=name;}
function nextOpponent(s){const pair=s.schedule[s.round]?.find(p=>p.includes(s.clubId));return s.opponents.find(o=>pair?.includes(o.id));}
function beginMatch(s){ensure(s.phase==='prep'&&s.prepLeft===0,'Complete preparation first');ensure(s.lineup.length===11&&new Set(s.lineup).size===11,'Select 11 unique players');ensure(s.lineup.every(id=>s.squad.some(p=>p.id===id&&!p.injury)),'Replace injured starters');s.phase='match';s.match={seed:Math.floor(P.random(s)*4294967296),weather:s.forecast,opponentId:nextOpponent(s).id,ticks:0,commands:[]};}
function sortedTable(s){return s.table.slice().sort((a,b)=>b.points-a.points||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf||a.id.localeCompare(b.id));}
function recordResult(s,a,b,ga,gb){
 ensure(Number.isInteger(ga)&&Number.isInteger(gb)&&ga>=0&&gb>=0,'Invalid score');
 const home=s.table.find(t=>t.id===a),away=s.table.find(t=>t.id===b);ensure(home&&away,'Unknown team');
 home.played++;away.played++;home.gf+=ga;home.ga+=gb;away.gf+=gb;away.ga+=ga;
 if(ga===gb){home.d++;away.d++;home.points++;away.points++;}else{const w=ga>gb?home:away,l=ga>gb?away:home;w.w++;w.points+=3;l.l++;}
 s.results.push({round:s.round,a,b,ga,gb});
}
function applyMatchReport(s,report){
 ensure(s.phase==='match','No active fixture');ensure(report.minute>=90,'Match is unfinished');
 const changes=[];
 for(const p of s.squad){
  const before={level:p.level,xp:p.xp,fatigue:p.fatigue};let total=0;
  for(const [role,min]of Object.entries(report.minutes[p.id]||{})){P.awardMinutes(s,p,role,min);total+=min;}
  if(total&&P.random(s)<CONFIG.matchInjuryPer90*total/90*P.injuryRisk(s,p))P.injure(s,p);
  if(total)changes.push({id:p.id,name:p.name,minutes:Math.round(total),xp:Math.round(total*CONFIG.xpPerMinute*(s.perks.includes('academy')?1.25:1)),levels:p.level-before.level,fatigue:Math.round(p.fatigue-before.fatigue)});
 }
 const opponent=nextOpponent(s);recordResult(s,s.clubId,opponent.id,report.scoreA,report.scoreB);
 const earnings=price(s,CONFIG.gate+(report.scoreA>report.scoreB?CONFIG.winBonus:0))+(s.perks.includes('gate')?100:0);
 earn(s,earnings,'Fixture earnings');charge(s,price(s,CONFIG.upkeep),'Fixture operating costs');
 s.lastReport={...report,changes,earnings,cost:price(s,CONFIG.upkeep)};s.match=null;
 if(s.phase!=='gameover')s.phase='results';
}
function finishRound(s,otherResults){
 ensure(s.phase==='results','Resolve your fixture first');
 const pairs=s.schedule[s.round].filter(p=>!p.includes(s.clubId));ensure(otherResults.length===pairs.length,'Missing league results');
 for(let i=0;i<pairs.length;i++){const [a,b]=pairs[i];recordResult(s,a,b,otherResults[i].scoreA,otherResults[i].scoreB);}
 s.round++;
 if(s.round>=s.schedule.length)endSeason(s);
 else{s.phase='prep';s.prepLeft=CONFIG.prepDays;s.visit=null;s.forecast=P.pick(s,['fine','rainy','snowy']);}
}
function endSeason(s){
 const table=sortedTable(s),rank=table.findIndex(t=>t.id===s.clubId);
 s.seasonSummary={season:s.season,division:s.division,table,rank:rank+1};
 if(rank===table.length-1){if(s.division===0){s.phase='gameover';s.ending='Relegated out of the District League.';return;}s.division--;s.seasonSummary.message='Relegated. Rebuild and come back stronger.';}
 else if(rank===0){if(s.division<2){s.division++;s.seasonSummary.message='Champions! Promoted to the next division.';}else if(!s.won){s.won=true;s.phase='victory';s.ending='Premier League champions! Your first top-flight title completes Soccer Rogue.';return;}else s.seasonSummary.message='Premier League champions again!';}
 else s.seasonSummary.message='Division retained. Another season awaits.';
 s.phase='season';s.perkChoices=Object.keys(CLUB_PERKS).filter(k=>!s.perks.includes(k)).slice(0,3);
}
function choosePerk(s,key){ensure(['season','victory'].includes(s.phase)&&s.perkChoices.includes(key),'Perk unavailable');s.perks.push(key);s.perkChoices=[];}
function continueSeason(s){ensure(['season','victory'].includes(s.phase),'Season is not over');if(s.phase==='victory'){s.phase='season';s.perkChoices=Object.keys(CLUB_PERKS).filter(k=>!s.perks.includes(k)).slice(0,3);return;}ensure(!s.perkChoices.length,'Choose a club perk first');s.season++;setupSeason(s);}
function encodeSave(s){return JSON.stringify(s);}
function decodeSave(raw){const s=JSON.parse(raw);ensure(s&&s.version===CONFIG.version,'Unsupported save version');ensure(CLUBS.some(c=>c.id===s.clubId)&&Array.isArray(s.squad)&&s.squad.length>=11&&s.squad.length<=22&&Array.isArray(s.lineup)&&s.lineup.length===11&&new Set(s.lineup).size===11&&s.lineup.every(id=>s.squad.some(p=>p.id===id))&&Number.isFinite(s.money)&&Array.isArray(s.schedule)&&Array.isArray(s.table)&&['prep','match','results','season','victory','gameover'].includes(s.phase),'Invalid career save');return s;}
module.exports={newRun,activity,trainingUnlocked,buy,hire,useItem,sign,sell:removePlayer,assign,setFormation,nextOpponent,beginMatch,sortedTable,recordResult,applyMatchReport,finishRound,endSeason,choosePerk,continueSeason,encodeSave,decodeSave,charge,price,recruitPrice,schedule};
