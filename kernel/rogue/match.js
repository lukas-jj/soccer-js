// Adapter around the real Simulator. No score generation and no forked football rules.
const {Simulator}=require('../providers/simulator/simulator.js');
const {Settings}=require('../settings.js');
const {Time}=require('../core/lib/time.js');
const {getArchetypeFullValues}=require('../core/lib/ai_archetypes.js');
const {CONFIG,FORMATIONS,CLUBS}=require('./data.js');
const {effectiveStats,roleGroup}=require('./players.js');
class CareerSimulator extends Simulator {
 constructor(options){super({seed:options.seed});this.careerOptions=options;}
 readConfig(){const o=this.careerOptions;this.teamAName=o.a.name;this.teamBName=o.b.name;this.formationAName=o.a.formation;this.formationBName=o.b.formation;this.matchDuration=o.duration||CONFIG.matchSeconds;}
 restoreMatchAIStrategySettings(){}
 async ensureActiveTeamSprites(){} // Fictional kits are registered by the browser after bootstrap.
 async loadPresets(){
  this.defaultStats={speed:50,stamina:50,passing:50,dribbling:50,shooting:50,tackling:50,goalkeeping:30,accuracy:50};
  this.formationsPreset=FORMATIONS;this.teamStatsPreset={};
  for(const side of ['a','b']){
   const team=this.careerOptions[side],slots=FORMATIONS[team.formation];
   this.teamStatsPreset[team.name]=team.players.map((p,i)=>({...effectiveStats(team.state,p,slots[i]?.role||'MF',this.careerOptions.weather),jersey:i+1,traits:[],role:slots[i]?.role||'MF'}));
  }
 }
}
function teamInput(s,opponent=null){
 if(opponent)return {name:opponent.name,formation:'4-4-2',tactic:'balanced',players:opponent.squad,state:{perks:[],day:s.day}};
 const ordered=[...s.lineup.map(id=>s.squad.find(p=>p.id===id)),...s.squad.filter(p=>!s.lineup.includes(p.id)&&!p.injury)];
 return {name:s.clubName,formation:s.formation,tactic:s.tactic,players:ordered,state:s};
}
class RogueMatch {
 static async create(options){const m=new RogueMatch(options);await m.init();return m;}
 constructor(options){this.options=options;this.ticks=0;this.minutes={};this.commands=options.commands||[];this.commandCursor=0;this.queue=[];this.finished=false;}
 async init(){
  const o=this.options;Settings.HEADLESS=true;Settings.soundsMuted=true;Settings.weather=o.weather;Settings.batchConfig=null;
  Settings.manualControl.teamA=false;Settings.manualControl.teamB=false;
  Settings.AI.A=Object.assign(Object.create(Settings.AI),getArchetypeFullValues(o.a.tactic)||{});
  Settings.AI.B=Object.assign(Object.create(Settings.AI),getArchetypeFullValues(o.b.tactic)||{});
  Time.time=0;Time.timeSinceLevelLoad=0;Time.deltaTime=.05;
  this.sim=new CareerSimulator(o);await this.sim.start();this.sim.active=true;
  this.sim.teamA.managerControlled=!!o.manager;
  for(const side of ['a','b']){
   const team=side==='a'?this.sim.teamA:this.sim.teamB;
   [...team.players,...team.bench].forEach((ep,i)=>{const cp=o[side].players[i];ep.careerId=cp.id;ep.name=cp.name;ep.currentStamina=Math.max(.3,1-cp.fatigue/125);});
  }
 }
 command(type,data){
  if(this.finished)throw Error('Match has ended');
  if(type==='sub')this.validateSub(data.out,data.in);
  else if(type==='swap'){
   const t=this.sim.teamA;
   if(data.a===data.b||!t.players.some(p=>p.careerId===data.a&&!p.isSentOff)||!t.players.some(p=>p.careerId===data.b&&!p.isSentOff))throw Error('Choose two different active players');
  }else throw Error('Unknown match command');
  this.commands.push({tick:this.ticks,type,...data});
 }
 validateSub(out,incoming){
  const t=this.sim.teamA;
  if(!t.managerControlled)throw Error('Not a manager-controlled team');
  if(t.substitutionsMade+[...this.queue,...this.commands.slice(this.commandCursor)].filter(c=>c.type==='sub').length>=CONFIG.subLimit)throw Error('No substitutions left');
  if(!t.players.some(p=>p.careerId===out&&!p.isSentOff))throw Error('Outgoing player unavailable');
  if(!t.bench.some(p=>p.careerId===incoming&&!p.isSentOff))throw Error('Incoming player unavailable');
  if([...this.queue,...this.commands.slice(this.commandCursor)].some(c=>c.out===out||c.in===incoming))throw Error('Substitution already queued');
 }
 executeQueued(){
  const t=this.sim.teamA;
  // Dead-ball changes preserve the engine's possession and set-piece rules.
  if(['play','fulltime'].includes(this.sim.matchState))return;
  while(this.queue.length){
   const c=this.queue.shift();
   if(c.type==='sub'){
    const old=t.players.find(p=>p.careerId===c.out),fresh=t.bench.find(p=>p.careerId===c.in);
    if(!old||!fresh||old.isSentOff||t.substitutionsMade>=CONFIG.subLimit)continue;
    fresh.role=old.role;this.sim.executeSubstitution(t,old,fresh,'manager');
    const cp=this.options.a.players.find(p=>p.id===fresh.careerId);fresh.currentStamina=Math.max(.3,1-cp.fatigue/125);
    fresh.stats={...effectiveStats(this.options.a.state,cp,fresh.role,this.options.weather),jersey:fresh.stats.jersey,traits:[]};fresh._cachedSpriteSheet=null;
   }else{
    const a=t.players.find(p=>p.careerId===c.a),b=t.players.find(p=>p.careerId===c.b);if(!a||!b||a.isSentOff||b.isSentOff)continue;
    for(const key of ['role','formationIndex','baseX','baseY','formationBaseX','formationBaseY','defaultRegionId','homeRegionId','regionFineOffsetX','regionFineOffsetY']){const temp=a[key];a[key]=b[key];b[key]=temp;}
    for(const ep of [a,b]){const cp=this.options.a.players.find(p=>p.id===ep.careerId);const stamina=ep.currentStamina,yellows=ep.yellowCards;ep.stats={...effectiveStats(this.options.a.state,cp,ep.role,this.options.weather),jersey:ep.stats.jersey,traits:[]};ep.start();ep.currentStamina=stamina;ep.yellowCards=yellows;ep._cachedSpriteSheet=null;}
   }
  }
 }
 step(count=1){
  Settings.HEADLESS=true;Settings.weather=this.options.weather;
  for(let i=0;i<count&&!this.finished;i++){
   while(this.commandCursor<this.commands.length&&this.commands[this.commandCursor].tick<=this.ticks)this.queue.push(this.commands[this.commandCursor++]);
   this.executeQueued();
   const before=this.sim.matchTimer;
   Time.advanceFixedLogicStep();this.sim.updateAll();this.ticks++;
   const dt=Math.max(0,Math.min(5400,this.sim.matchTimer)-before)/60;
   if(dt>0)for(const ep of this.sim.teamA.players){
    if(ep.isSentOff)continue;
    const m=this.minutes[ep.careerId]||(this.minutes[ep.careerId]={GK:0,DF:0,MF:0,FW:0});m[roleGroup(ep.role)]+=dt;
   }
   this.finished=this.sim.matchState==='fulltime';
   // Fail visibly rather than inventing a result if an engine match stalls.
   if(this.ticks>120000)throw Error('Match exceeded engine tick limit. Reload to resume the saved fixture.');
  }
 }
 report(){if(!this.finished)throw Error('Match not finished');return {minute:90,scoreA:this.sim.scoreA,scoreB:this.sim.scoreB,minutes:this.minutes,ticks:this.ticks,substitutions:this.sim.teamA.substitutionsMade,weather:this.options.weather};}
}
async function careerMatch(s){const rival=s.opponents.find(o=>o.id===s.match.opponentId);return RogueMatch.create({a:teamInput(s),b:teamInput(s,rival),weather:s.match.weather,seed:s.match.seed,manager:true,commands:s.match.commands});}
async function simulateOther(s,a,b,seed){
 const m=await RogueMatch.create({a:teamInput(s,s.opponents.find(o=>o.id===a)),b:teamInput(s,s.opponents.find(o=>o.id===b)),weather:s.forecast,seed,manager:false});
 while(!m.finished){m.step(400);await new Promise(resolve=>setTimeout(resolve,0));}return m.report();
}
function kit(color){return {outline:'#102029',primary:color,primaryLight:color,primaryDark:'#25434b',shorts:'#17313b',shortsDark:'#0b1822',socks:color};}
async function registerKits(m){
 const {registerPlayerSheetsFromPng}=require('../core/lib/sprite_sheets.js');
 const club=CLUBS.find(c=>c.name===m.options.a.name);
 const palettes={[m.options.a.name]:{main:kit(club?.color||'#35d4bb'),gk:kit('#ffe177')},[m.options.b.name]:{main:kit('#f68088'),gk:kit('#a0b4ff')}};
 Settings.HEADLESS=false;try{await registerPlayerSheetsFromPng(palettes,{},Object.keys(palettes));}finally{Settings.HEADLESS=true;}
}
module.exports={RogueMatch,careerMatch,simulateOther,registerKits,teamInput};
