// Each track shows the setup, activation, and result at five points in the loop.
const track=(kind,...positions)=>({kind,positions});
const player=(...positions)=>track('player',...positions);
const rival=(...positions)=>track('rival',...positions);
const ball=(...positions)=>track('ball',...positions);
const effect=(kind,x,y)=>track(kind,[x,y,0],[x,y,1],[x,y,1],[x,y,0],[x,y,0]);

const examples={
 price:[
  player([22,56],[30,56],[50,56],[72,56],[73,56]),
  rival([51,56],[51,56],[56,52],[63,26],[63,26]),
  ball([26,56],[34,56],[54,56],[78,62],[83,64])
 ],
 'spin-kick':[
  track('spin-player',[37,56],[38,56],[41,56],[41,56],[41,56]),
  effect('shockwave',41,56),
  ball([43,56],[43,56],[53,56],[83,46],[89,46])
 ],
 cole:[
  player([22,56],[25,56],[70,56],[76,56],[78,56]),
  effect('dash-trail',51,56),
  ball([26,56],[29,56],[74,56],[80,56],[82,56])
 ],
 mendes:[
  player([19,65]),rival([49,57]),
  ball([24,65],[25,65],[46,81],[68,66],[94,47])
 ],
 'tele-pass':[
  track('teleport',[20,64],[20,64],[20,64,0],[68,37],[77,39]),
  effect('portal',68,37),
  ball([25,64],[31,60],[54,49],[73,39],[82,39])
 ],
 'portal-pass':[
  player([25,71]),effect('portal',37,93),effect('portal',37,7),
  ball([30,74],[35,90],[37,96,0],[49,17],[73,39])
 ],
 'goal-warp':[
  player([24,66]),rival([57,50]),
  effect('portal',5,21),
  track('moving-goal',[4,50],[4,50,0],[4,21],[4,21],[4,21]),
  ball([51,50],[49,50],[38,50],[13,50],[7,50])
 ],
 nutmeg:[
  player([20,56],[23,56],[26,56],[53,70],[69,64]),rival([49,56]),
  track('teammate',[76,56]),
  ball([25,56],[33,56],[49,56],[69,56],[76,56])
 ],
 clone:[
  player([27,55],[30,55],[44,68],[65,75],[81,72]),
  track('decoy',[27,55,0],[30,55],[48,32],[61,26],[61,26,0]),
  rival([66,48],[62,45],[55,38],[58,27],[59,26]),
  ball([32,55],[35,55],[49,68],[70,75],[86,72])
 ],
 stepover:[
  player([26,56],[33,56],[38,56],[61,69],[79,63]),
  rival([49,56]),effect('stun',49,43),
  ball([31,56],[36,62],[41,50],[66,69],[84,63])
 ],
 'blaze-slide':[
  player([19,59],[26,59],[47,59],[64,59],[68,59]),
  rival([50,59],[50,59],[55,48],[69,31],[82,25]),
  effect('fire-trail',43,60),
  ball([55,59],[55,59],[52,61],[67,64],[73,65])
 ],
 'blast-shot':[
  player([19,55]),rival([53,55],[53,55],[56,55],[65,34],[70,31]),
  effect('shockwave',53,55),
  ball([24,55],[38,55],[53,55],[74,52],[95,49])
 ],
 bear:[
  track('bear',[26,56],[29,56],[39,56],[58,56],[72,56]),
  rival([59,56],[56,56],[51,56],[44,35],[45,29]),
  ball([31,56],[34,56],[44,56],[63,56],[77,56])
 ],
 wolf:[
  track('wolf',[20,62],[25,62],[43,62],[68,62],[84,62]),
  rival([21,44],[25,44],[33,44],[43,44],[53,44]),
  ball([25,62],[30,62],[48,62],[73,62],[89,62])
 ],
 eagle:[
  track('eagle',[34,55],[35,51],[40,44],[47,47],[47,53]),
  ball([39,55],[40,54],[50,50],[76,43],[96,36])
 ]
};

function cross(finish,shot){
 return [
  player([22,77]),track(finish,[64,50],[63,50],[63,46],[66,50],[67,52]),
  effect('timing',64,58),ball([26,75],[38,54],[63,40],...shot)
 ];
}
examples['power-shot']=cross('volley',[[81,49],[96,51]]);
examples['cross-header']=cross('header',[[79,33],[96,41]]);
examples['overhead-kick']=cross('overhead',[[83,35],[96,45]]);

function abilityExample(drill){
 const tracks=examples[drill];
 if(!tracks)return '';
 const movingGoal=drill==='goal-warp';
 return `<figure class="ability-example" aria-label="Animated example">
  <input id="pause-ability-example" class="example-pause" type="checkbox"><label for="pause-ability-example">Pause example</label>
  <div class="example-pitch" data-example="${drill}" aria-hidden="true">
   <i class="example-midfield"></i><i class="example-box left"></i><i class="example-box right"></i>
   ${movingGoal?'':'<i class="example-goal left"></i>'}<i class="example-goal right"></i>
   ${tracks.map(({kind,positions})=>{
    const style=Array.from({length:5},(_,i)=>{
     const [x,y,opacity=1]=positions[Math.min(i,positions.length-1)];
     return `--x${i}:${x}%;--y${i}:${y}%;--opacity${i}:${opacity}`;
    }).join(';');
    return `<i class="example-actor" data-actor="${kind}" style="${style}"><span></span></i>`;
   }).join('')}
  </div>
 </figure>`;
}

module.exports={abilityExample};
