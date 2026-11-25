const BASE_STATS={speed:58,dribblingSpeed:58,stamina:58,passing:58,dribbling:58,shooting:58,tackling:58,goalkeeping:18,accuracy:58};

const BODY_RANGES={
 price:{width:[1.08,1.22],height:[1.03,1.13]},
 cole:{width:[.85,1.03],height:[.88,.97]},
 mendes:{width:[.85,.97],height:[.91,1.12]},
 kowalski:{width:[.93,1.08],height:[.94,1.07]},
 druid:{width:[.92,1.04],height:[.97,1.06]},
 keeper:{width:[1.01,1.12],height:[1,1.09]},
 slimer:{width:[.92,1.08],height:[.9,1.09]}
};

const CHARACTERS=[
 {id:'price',name:'Grum Ironhide',short:'GRUM',label:'Warrior',number:4,slot:1,color:'#ff917f',skin:'#799653',hair:'#251e20',
  body:{width:1.16,height:1.09},
  stats:{...BASE_STATS,speed:49,dribblingSpeed:49,stamina:62,dribbling:53,shooting:65,tackling:73}},
 {id:'cole',name:'Nyx Quickstep',short:'NYX',label:'Rogue',number:7,slot:2,color:'#82c8ff',skin:'#875536',hair:'#17171b',
  body:{width:.93,height:.92},
  stats:{...BASE_STATS,speed:72,dribblingSpeed:72,stamina:70,dribbling:65,shooting:55,tackling:50}},
 {id:'mendes',name:'Rune Ashstaff',short:'RUNE',label:'Mage',number:8,slot:3,color:'#b6a2ff',skin:'#d69d73',hair:'#30271b',
  body:{width:.91,height:1.07},
  stats:{...BASE_STATS,passing:73,shooting:67,tackling:49,accuracy:65}},
 {id:'kowalski',name:'Asha Brightblade',short:'ASHA',label:'Warrior',number:9,slot:4,color:'#f08e94',skin:'#edbf9c',hair:'#6d422b',
  body:{width:1,height:1},
  stats:{...BASE_STATS,shooting:71,accuracy:68}},
 {id:'druid',name:'Rowan Wildroot',short:'ROWAN',label:'Druid',number:12,slot:5,color:'#a4d37d',skin:'#b67856',hair:'#463527',
  body:{width:.98,height:1.02},
  stats:{...BASE_STATS,speed:61,dribblingSpeed:61,stamina:67,dribbling:63,accuracy:64}}
];
function starterStats(stats){
 return Object.fromEntries(Object.entries(stats).map(([stat,value])=>[stat,stat==='goalkeeping'?value:value-5]));
}
function seededRandom(seed){
 return ()=>{
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  return seed/0x100000000;
 };
}
function rollBody(id,random){
 const {width,height}=BODY_RANGES[id]??BODY_RANGES.kowalski;
 const sample=([min,max])=>min+(max-min)*random();
 return {width:sample(width),height:sample(height)};
}
function squadNumber(random,used){
 const available=Array.from({length:100},(_,index)=>index+1).filter(number=>!used.has(number));
 const number=available[Math.floor(random()*available.length)];
 used.add(number);
 return number;
}
module.exports={CHARACTERS,squadNumber,seededRandom,rollBody,starterStats};
