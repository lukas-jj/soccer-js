const {CONFIG,STATS,ARCHETYPES,TRAITS,TRAINING} = require('./data.js');
const clamp = (v,a=0,b=100) => Math.max(a,Math.min(b,v));
function random(s) { s.rng = (Math.imul(s.rng,1664525)+1013904223)>>>0; return s.rng/4294967296; }
const pick = (s, list) => list[Math.floor(random(s)*list.length)];
function createPlayer(s, archetype, strength=0) {
 const id = `p${s.nextId++}`;
 const first = ['Ari','Mika','Remy','Sam','Ash','Kit','Robin','Jules','Alex','River','Casey','Rowan','Eden','Quinn','Sky','Blair'];
 const last = ['Vale','Reed','Moss','Finch','Lake','Stone','Brook','West','Hart','Dale','Fern','Wren'];
 const stats = Object.fromEntries(STATS.map(k=>[k, Math.round(35+random(s)*15+strength)]));
 const weights=ARCHETYPES[archetype];
 for (const [k,w] of Object.entries(weights)) stats[k]=clamp(stats[k]+w*4,1,95);
 if (!/Keeper|Stopper/.test(archetype)) stats.goalkeeping = 10+Math.round(random(s)*15);
 const perks = random(s)<.35?[pick(s,Object.keys(TRAITS).filter(k=>TRAITS[k].kind==='perk'))]:[];
 const curses = random(s)<.3?[pick(s,Object.keys(TRAITS).filter(k=>TRAITS[k].kind==='curse'))]:[];
 return {id,name:`${pick(s,first)} ${pick(s,last)}`,archetype,stats,perks,curses,level:1,xp:0,pending:[],minutes:{GK:0,DF:0,MF:0,FW:0},fatigue:0,injury:null,reliefUntil:0};
}
function roleGroup(role) {
 if(role==='GK')return 'GK';
 if(/CB|LB|RB|WB|DF/.test(role))return 'DF';
 if(/FW|CF|ST|LW|RW|SS|WF|^LS$|^RS$/.test(role))return 'FW';
 return 'MF';
}
function proficiency(p,role) {return clamp((p.minutes[roleGroup(role)]||0)*CONFIG.proficiencyPerMinute);}
function activeCurse(s,p,key) {return p.curses.includes(key)&&!(p.reliefUntil>s.day);}
function effectiveStats(s,p,role,weather) {
 const factor=(.85+.15*proficiency(p,role)/100)*(1-p.fatigue*.0035);
 const stats=Object.fromEntries(STATS.map(k=>[k,clamp(p.stats[k]*factor,1,100)]));
 if(p.perks.includes('engine'))stats.stamina+=12;
 if(p.perks.includes('precision')){stats.passing+=8;stats.accuracy+=8;}
 if(activeCurse(s,p,'nerves')){stats.passing-=10;stats.shooting-=10;}
 if(s.perks.includes('rain')&&weather==='rainy'){stats.speed+=8;stats.stamina+=10;stats.shooting+=6;}
 if(s.perks.includes('snow')&&weather==='snowy'){stats.speed+=10;stats.accuracy+=10;}
 if(s.perks.includes('sunshine')&&weather==='fine'){stats.passing+=8;stats.shooting+=8;}
 for(const k of STATS) stats[k]=clamp(stats[k],1,100);
 return stats;
}
function levelChoices(s,p) {
 const remaining=STATS.slice(), choices=[];
 for(let i=0;i<3;i++) {
  const weights=remaining.map(k=>1+(ARCHETYPES[p.archetype][k]||0));
  let n=random(s)*weights.reduce((a,b)=>a+b,0), index=0;
  while(index<weights.length-1 && (n-=weights[index])>=0)index++;
  choices.push({stat:remaining.splice(index,1)[0],gain:3+Math.floor(random(s)*3)});
 }
 return choices;
}
function awardMinutes(s,p,role,minutes) {
 if(!Number.isFinite(minutes)||minutes<0)throw Error('Invalid minutes');
 p.minutes[roleGroup(role)]+=minutes;
 p.xp+=minutes*CONFIG.xpPerMinute*(s.perks.includes('academy')?1.25:1);
 while(p.xp>=CONFIG.xpLevel*p.level) {
  p.xp-=CONFIG.xpLevel*p.level; p.level++; p.pending.push(levelChoices(s,p));
 }
 p.fatigue=clamp(p.fatigue+minutes/90*CONFIG.matchFatigue*(1-p.stats.stamina/200)*(p.perks.includes('engine')?.8:1));
}
function chooseUpgrade(p,index) {
 const choice=p.pending[0]?.[index]; if(!choice)throw Error('Choose a pending upgrade');
 p.stats[choice.stat]=clamp(p.stats[choice.stat]+choice.gain,1,100);p.pending.shift();
}
function injuryRisk(s,p) {return (p.perks.includes('resilient')?.5:1)*(activeCurse(s,p,'fragile')?2:1);}
function injure(s,p,roll=()=>random(s)) {
 if(p.injury)return;
 const severe=roll()<.2;
 p.injury={name:severe?'Muscle strain':'Sprained ankle',days:severe?6:3,severity:severe?'severe':'moderate'};
 s.events.push(`${p.name}: ${p.injury.name}, out ${p.injury.days} days.`);
}
function trainPlayer(s,p,stats,roll=()=>random(s)) {
 if(p.injury)return;
 if(activeCurse(s,p,'party')&&roll()<.35) {p.fatigue=clamp(p.fatigue+45);s.events.push(`${p.name}'s late night adds 45 fatigue before training.`);}
 const gain=CONFIG.trainingGain*(p.fatigue>60?.5:1);
 for(const stat of stats)p.stats[stat]=clamp(p.stats[stat]+gain,1,100);
 p.fatigue=clamp(p.fatigue+CONFIG.trainingFatigue);
 if(roll()<CONFIG.trainingInjury*injuryRisk(s,p))injure(s,p,roll);
}
module.exports={clamp,random,pick,createPlayer,roleGroup,proficiency,effectiveStats,awardMinutes,chooseUpgrade,injuryRisk,injure,trainPlayer,activeCurse};
