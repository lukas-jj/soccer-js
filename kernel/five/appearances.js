// Each class has five named looks. Palettes and silhouettes are shared by the portrait and match sprite.
const APPEARANCES={
 price:[
  ['Grum','#809451','#292221','crest'],
  ['Vorra','#497b54','#231f2e','braid'],
  ['Dren','#a1b967','#694031','crop'],
  ['Ashk','#648d36','#302528','bun'],
  ['Garr','#38745b','#c6c4a7','shaved']
 ],
 cole:[
  ['Nyx','#815036','#201820','curls'],
  ['Fen','#ca996e','#211f23','swept'],
  ['Vesper','#e7af8e','#a05035','pony'],
  ['Mist','#ab714e','#28202d','bob'],
  ['Quill','#543123','#18151b','crop']
 ],
 mendes:[
  ['Rune','#7296df','#e4ddf4','swept'],
  ['Sable','#76539f','#282035','bob'],
  ['Iona','#5199b8','#d8e8ed','bun'],
  ['Eldin','#9f78c9','#4a3269','braid'],
  ['Lyra','#505ba6','#e0accd','crest']
 ]
};
const BUILD_SCALE=[[1,1],[.96,1.02],[1.06,.97],[1.02,1.055],[.94,.96]];
for(const [race,looks] of Object.entries(APPEARANCES)){
 APPEARANCES[race]=looks.map(([name,skin,hair,style],index)=>({id:index,name,skin,hair,style,race}));
}
function playerAppearance(classId,variant){
 return APPEARANCES[classId]?.[variant]??APPEARANCES[classId]?.[0];
}
function appearanceBody(body,look){
 if(!look)return body;
 const [width,height]=BUILD_SCALE[look.id];
 return {width:body.width*width,height:body.height*height};
}
function appearanceColors({skin,hair}){
 const shade=(hex,target,amount)=>'#'+hex.slice(1).match(/../g).map(channel=>
  Math.round(parseInt(channel,16)*(1-amount)+target*amount).toString(16).padStart(2,'0')
 ).join('');
 return {skin,hair,skinShadow:shade(skin,0,.28),skinHighlight:shade(skin,255,.24),hairDark:shade(hair,0,.32)};
}

module.exports={APPEARANCES,playerAppearance,appearanceBody,appearanceColors};
