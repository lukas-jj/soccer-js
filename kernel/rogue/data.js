// Balance is intentionally centralized. Attribute scale is the engine's 1–100.
const CONFIG = {
 version: 1, prepDays: 3, squadMin: 11, squadMax: 22, subLimit: 3,
 matchSeconds: 180, xpPerMinute: 1.5, xpLevel: 100, proficiencyPerMinute: .025,
 trainingGain: .65, trainingFatigue: 10, restRecovery: 24, dailyRecovery: 3,
 matchFatigue: 38, trainingInjury: .025, matchInjuryPer90: .08,
 upkeep: 280, startingMoney: 2600, gate: 200, winBonus: 160,
 items: {
  spray: { name: 'Recovery spray', price: 90, description: 'Remove 30 fatigue.' },
  treatment: { name: 'Treatment kit', price: 160, description: 'Heal 3 injury days.' },
  relief: { name: 'Focus tonic', price: 120, description: 'Suppress curses for 4 preparation days.' },
  cleanse: { name: 'Fresh start', price: 650, description: 'Permanently remove one chosen curse.' }
 },
 staff: {
  technique: { name:'Technical coach', price:650, description:'Unlock Shooting and Dribbling sessions.' },
  defence: { name:'Defensive coach', price:650, description:'Unlock Tackling and Goalkeeping sessions.' },
  split: { name:'Assistant coach', price:900, description:'Unlock two training groups. Requires both coaches.' },
  medic: { name:'Club medic', price:700, description:'Injuries heal 2 days per preparation day.' }
 }
};
const STATS = ['speed','stamina','passing','dribbling','shooting','tackling','goalkeeping','accuracy'];
const ARCHETYPES = {
 'Speedster': {speed:5,dribbling:3,stamina:2}, 'Playmaker':{passing:5,accuracy:3,dribbling:2},
 'Finisher':{shooting:5,accuracy:4,speed:1}, 'Enforcer':{tackling:6,stamina:3,passing:1},
 'Workhorse':{stamina:6,speed:2,tackling:2}, 'All-Rounder':{speed:2,stamina:2,passing:2,shooting:2,tackling:2},
 'Shot Stopper':{goalkeeping:8,accuracy:1,stamina:1}, 'Sweeper Keeper':{goalkeeping:5,passing:3,speed:2}
};
const TRAITS = {
 engine:{name:'Endless Engine',kind:'perk',description:'+12 stamina in matches; 20% less career fatigue from minutes.'},
 precision:{name:'Precision',kind:'perk',description:'+8 passing and accuracy in matches.'},
 resilient:{name:'Resilient',kind:'perk',description:'Half the chance of training and match injury.'},
 party:{name:'Party Animal',kind:'curse',description:'35% chance before training to gain 45 fatigue (substantially reduced match stamina).'},
 fragile:{name:'Fragile',kind:'curse',description:'Double the chance of training and match injury.'},
 nerves:{name:'Match Nerves',kind:'curse',description:'−10 shooting and passing in matches.'}
};
const CLUB_PERKS = {
 rain:{name:'Storm Chasers',description:'In rain: +8 speed, +10 stamina, +6 shooting for every player.'},
 academy:{name:'Learning Culture',description:'25% more XP from actual match minutes.'},
 recovery:{name:'Mountain Air',description:'Rest removes 12 extra fatigue.'},
 snow:{name:'Winter Boots',description:'In snow: +10 speed and +10 accuracy.'},
 sunshine:{name:'Solar Football',description:'In fine weather: +8 passing and shooting.'},
 gate:{name:'Packed Stands',description:'Earn 100 extra per fixture.'}
};
const CLUBS = [
 {id:'harbor',name:'Harbor Lanterns',color:'#35d4bb',perk:'rain',bias:'Workhorse',description:'Tireless runners and tough defenders. Strong in rain; finishing needs work.'},
 {id:'orchard',name:'Orchard Comets',color:'#ffb65c',perk:'academy',bias:'Playmaker',description:'Accurate young passers who level faster. Less pace and tackling.'},
 {id:'summit',name:'Summit Rovers',color:'#a79bff',perk:'recovery',bias:'Finisher',description:'Quick attackers and restorative rest days. A thinner defensive unit.'}
];
const TRAINING = {passing:['passing','accuracy'],running:['speed','stamina'],shooting:['shooting','accuracy'],dribbling:['dribbling','speed'],tackling:['tackling','stamina'],goalkeeping:['goalkeeping','passing']};
const DIVISIONS = ['District League','Regional League','Premier League'];
const FORMATIONS = require('../../presets/formations.json');
module.exports = {CONFIG, STATS, ARCHETYPES, TRAITS, CLUB_PERKS, CLUBS, TRAINING, DIVISIONS, FORMATIONS};
