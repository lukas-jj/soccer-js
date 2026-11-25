const CLUB_GEAR=[
 {id:'scouting-contract',name:'Scouting Contract',icon:'banner',price:180,description:'After a win, you may sign one outfield player from the team you beat if your squad has room.'},
 {id:'crossbar',name:'Crossbar Relic',icon:'target',description:'Earn this relic by hitting all three shots in the Crossbar Challenge. It pays 100 gold per kick that hits the opposition crossbar in completed matches and events.'},
 {id:'bard',name:"Bard's Chant",icon:'music',price:190,description:'Each goal gives the scoring player +10 Speed and Dribbling Speed for the rest of the match.'},
 {id:'boots',name:'Sprint Boots',icon:'dash',price:140,description:'New boots for everyone.'},
 {id:'chalk',name:'Passing Chalk',icon:'arc',price:130,description:'Give every player on your team 8 extra passing.'},
 {id:'laces',name:'Striker Laces',icon:'spin',price:140,description:'Give every player on your team 7 extra shooting.'},
 {id:'gloves',name:'Keeper Gloves',icon:'warp',price:110,description:'Give your keeper 10 extra saving.'},
 {id:'tea',name:'Recovery Tea',icon:'flask',price:130,description:'Your team can sprint 30% longer.'},
 {id:'hourglass',name:'Hourglass',icon:'clock',price:170,description:'Reduce your team’s ability cooldowns by 15%.'},
 {id:'banner',name:'Comeback Banner',icon:'banner',price:170,description:'Restore your team’s sprint reserves whenever you concede.'},
 {id:'sheet',name:'Clean Sheet Purse',icon:'coin',price:140,description:'Earn 65 extra gold when you win without conceding in regulation.'},
 {id:'first-goal',name:'First Goal Purse',icon:'coin',price:145,description:'Earn 45 extra gold when your team scores and wins.'}
];
const MATCH_ITEMS=[
 {id:'slimer-streaker',name:'Slimer Streaker',icon:'slime',price:125,description:'A Slimer runs across the pitch pelting opponents with slime. The guards chasing it shove anyone in their path.'},
 {id:'water',name:'Sports Mead',icon:'flask',price:45,description:'Refill the squad’s sprint reserves and give them 10% more movement speed for the rest of the match. The speed boost applies once per match.'},
 {id:'whistle',name:'Ability Elixir',icon:'sound',price:60,description:'Make your controlled player’s ability ready immediately.'},
 {id:'tonic',name:'Speed Tonic',icon:'dash',price:65,description:'Give your controlled player 35% more movement speed for eight seconds.'},
 {id:'overtime',name:'Extra Time',icon:'clock',price:65,description:'Add 10 seconds to the match clock.'},
 {id:'red-card',name:'Red Card',icon:'card',description:'Select an opposing player and send them off for the rest of the match.'}
];

const SHOP_ITEMS=MATCH_ITEMS.filter(item=>item.price!==undefined);

const TRAINING_STATS=[
 ['speed','Speed'],
 ['shooting','Shot Speed'],
 ['passing','Pass Speed'],
 ['tackling','Tackling'],
 ['stamina','Stamina'],
 ['dribbling','Ball Control'],
 ['shotAccuracy','Shot Accuracy'],
 ['passAccuracy','Pass Accuracy'],
 ['dribblingSpeed','Dribbling Speed'],
 ['goalkeeping','Saving']
];

const statMax=key=>key==='shotAccuracy'||key==='passAccuracy'?100:99;

function statRating(stats,key){
 if(key==='shotAccuracy'||key==='passAccuracy')return stats[key]??stats.accuracy;
 if(key==='dribblingSpeed')return stats.dribblingSpeed??stats.speed;
 return stats[key];
}

const LAST_REF={name:'The Last Ref',description:'A pile of bones is all that remains of the other refs. The last one is hiding in the shadows and swears he’ll never call another game.',
  choices:[{label:'Pay 260 gold for one red card',cost:260,items:['red-card']},{label:'Leave him be'}]};

const EVENTS=[
 LAST_REF,
 {name:'A Song for the Road',description:'You come across a bard standing outside the pitch.',bard:true,
  choices:[{label:'Recruit bard',recruitBard:true},{label:"Pay the bard 150 for Bard's Chant perk: every time you score a goal, the scoring player receives a speed boost",cost:150,gear:'bard'},
   {label:'Ignore the bard and keep walking',bardCurse:true}]},
 {name:'Lost and Found',description:'Someone left a purse by the touchline. The groundkeeper offers a small reward if you bring it back.',
  choices:[{label:'Return it · Gain 45 gold',gold:45},{label:'Trade it for a Speed Tonic',items:['tonic']}]},
 {name:'The Bootmaker',description:'A cobbler offers to fit the whole squad between fixtures.',
  choices:[{label:'Buy Sprint Boots · 115 gold',cost:115,gear:'boots'},{label:'Keep walking'}]},
 {name:'A Helping Hand',description:'The market porter needs help unloading before the gates open.',
  choices:[{label:'Unload the crates · Gain 35 gold',gold:35},{label:'Take Sports Mead instead',items:['water']}]},
 {name:'The Groundskeeper',description:'The keeper of the training ground has a spare pair of match gloves.',
  choices:[{label:'Buy Keeper Gloves · 75 gold',cost:75,gear:'gloves'},{label:'Keep walking'}]}
];

module.exports={CLUB_GEAR,MATCH_ITEMS,SHOP_ITEMS,TRAINING_STATS,statMax,statRating,EVENTS,LAST_REF};
