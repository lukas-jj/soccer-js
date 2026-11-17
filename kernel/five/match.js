const {Simulator}=require('../providers/simulator/simulator.js');
const {Settings}=require('../settings.js');
const {Time}=require('../core/lib/time.js');
const {getArchetypeFullValues}=require('../core/lib/ai_archetypes.js');
const {FiveInput}=require('./input.js');
const CHARACTERS=[
 {id:'price',name:'Daniel Price',short:'PRICE',number:4,role:'DEFENDER',slot:1,color:'#63d4e8',skin:'#b77c55',hair:'#251e20',strength:'TACKLING',stats:{speed:74,stamina:90,passing:77,dribbling:67,shooting:63,tackling:94,goalkeeping:18,accuracy:79}},
 {id:'cole',name:'Marcus Cole',short:'COLE',number:7,role:'WINGER',slot:2,color:'#ffb94f',skin:'#875536',hair:'#17171b',strength:'PACE',stats:{speed:96,stamina:84,passing:75,dribbling:90,shooting:78,tackling:63,goalkeeping:15,accuracy:80}},
 {id:'mendes',name:'Luís Mendes',short:'MENDES',number:8,role:'PLAYMAKER',slot:3,color:'#b6a2ff',skin:'#d69d73',hair:'#302120',strength:'PASSING',stats:{speed:79,stamina:85,passing:96,dribbling:89,shooting:76,tackling:65,goalkeeping:14,accuracy:93}},
 {id:'kowalski',name:'Adam Kowalski',short:'KOWALSKI',number:9,role:'STRIKER',slot:4,color:'#f08e94',skin:'#edbf9c',hair:'#6d422b',strength:'FINISHING',stats:{speed:85,stamina:80,passing:73,dribbling:80,shooting:96,tackling:58,goalkeeping:12,accuracy:94}}
];
const FORMATION=[{role:'GK',x:6,y:50},{role:'CB',x:25,y:50},{role:'LM',x:43,y:24},{role:'RM',x:43,y:76},{role:'CF',x:65,y:50}];
const BASE={speed:77,stamina:86,passing:78,dribbling:77,shooting:78,tackling:75,goalkeeping:15,accuracy:81};
function configureFive(headless=false){
 Settings.HEADLESS=headless;Settings.soundsMuted=true;Settings.TIME_SPEED=1;
 Settings.BASE_FIELD_WIDTH=52;Settings.BASE_FIELD_HEIGHT=34;Settings.FIELD_SIZE_MULTIPLIER=1;
 Settings.weather='fine';Settings.projectionMode='orthographic';
 Settings.manualControl={...Settings.manualControl,teamA:true,teamB:false,autoSwitchOnPass:false,holdToPower:true,cameraFollow:false,screenAwareMove:true,aimAssist:true,shotAimAssist:true,recordInput:false};
 Settings.AI.A=Object.assign(Object.create(Settings.AI),getArchetypeFullValues('balanced'));
 Settings.AI.B=Object.assign(Object.create(Settings.AI),getArchetypeFullValues('balanced'));
 Settings.batchConfig=null;
 Time.time=0;Time.timeSinceLevelLoad=0;Time.deltaTime=.05;
}
class FiveSimulator extends Simulator {
 constructor(seed,duration){super({seed});this.playersPerTeam=5;this.fiveDuration=duration;}
 readConfig(){this.teamAName='HOME';this.teamBName='AWAY';this.formationAName='five';this.formationBName='five';this.matchDuration=this.fiveDuration||180;}
 restoreMatchAIStrategySettings(){}
 async ensureActiveTeamSprites(){}
 async loadPresets(){
  this.defaultStats=BASE;this.formationsPreset={five:FORMATION};
  const keeper={...BASE,jersey:1,goalkeeping:90,traits:[]};
  this.teamStatsPreset={HOME:[keeper,...CHARACTERS.map(c=>({...c.stats,jersey:c.number,traits:[]}))],AWAY:Array.from({length:5},(_,i)=>({...BASE,jersey:i+1,goalkeeping:i===0?88:15,traits:[]}))};
 }
 updateHTMLStats(){}
 updateScrubberUI(){}
 // No offside in this small-sided ruleset; all other restarts use the engine.
 cacheOffsideLines(){this.offsideLineA=this.isSecondHalf()?0:52;this.offsideLineB=this.isSecondHalf()?52:0;this.ball.offsideReceiver=null;this.ball.offsideLineX=null;}
 triggerOffside(){this.ball.offsideReceiver=null;this.ball.offsideLineX=null;}
 checkForSubstitutions(){} // Five starters, no bench, no manager interface.
 render(){} // Score and restart announcements belong to the small, accessible HUD.
}
class FiveMatch {
 static async create(characterId,seed=Date.now(),options={}){
  const character=CHARACTERS.find(c=>c.id===characterId);if(!character)throw Error('Choose a character');
  configureFive(!!options.headless);
  const match=new FiveMatch();match.character=character;match.headless=!!options.headless;
  match.input=new FiveInput();match.sim=new FiveSimulator(seed>>>0,options.duration);
  await match.sim.start();match.sim.active=true;match.sim._playbackRecordingStopped=true;
  match.sim.teamA.players.forEach((p,i)=>{p.name=i?CHARACTERS[i-1].short:'TURNER';if(i)p.characterId=CHARACTERS[i-1].id;});
  const away=['SILVA','HUGHES','CLARKE','ROSSI','NOVAK'];match.sim.teamB.players.forEach((p,i)=>p.name=away[i]);
  match.player=match.sim.teamA.players[character.slot];match.sim.lockedHumanPlayer=match.player;match.sim.manualInput=match.input;
  return match;
 }
 get finished(){return this.sim.matchState==='fulltime';}
 step(count=1){
  Settings.HEADLESS=this.headless;
  for(let i=0;i<count&&!this.finished;i++){
   Time.advanceFixedLogicStep();this.sim.updateAll();
   // Clear transient offside flags set by kicks in this tick.
   this.sim.ball.offsideReceiver=null;this.sim.ball.offsideLineX=null;
  }
 }
 destroy(){this.input.destroy();this.sim.active=false;}
}
function kit(color){return {outline:'#101a22',primary:color,primaryLight:color,primaryDark:'#34404a',shorts:'#18242b',shortsDark:'#10181c',socks:color};}
async function loadKits(){
 const {registerPlayerSheetsFromPng}=require('../core/lib/sprite_sheets.js');
 const home=CHARACTERS.map(c=>({jersey:c.number,role:'MF',colors:{skin:c.skin,hair:c.hair}}));
 await registerPlayerSheetsFromPng({HOME:{main:kit('#f5b841'),gk:kit('#d9e3e7')},AWAY:{main:kit('#68b4d0'),gk:kit('#dd8095')}},{teams:{HOME:home}},['HOME','AWAY']);
}
module.exports={CHARACTERS,FORMATION,FiveMatch,FiveSimulator,configureFive,loadKits};
