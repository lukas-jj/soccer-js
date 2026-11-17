const C=require('../../rogue/career.js');
const P=require('../../rogue/players.js');
const D=require('../../rogue/data.js');
const {careerMatch,simulateOther,registerKits}=require('../../rogue/match.js');
const {Settings}=require('../../settings.js');
const {Application}=require('../../engine.js');
const {Utils}=require('../../core/lib/utils.js');
const KEY='soccer-rogue-v1';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>`${Math.round(n).toLocaleString()} cr`;
const title=s=>s.charAt(0).toUpperCase()+s.slice(1);
const weather=w=>({fine:'☀ Fine',rainy:'☂ Rain',snowy:'❄ Snow'}[w]||w);
let state=null,view='club',live=null,paused=false,speed=8,busy=false,lastSave=0,raf=0,accumulator=0,lastFrame=0;
function notice(text,error=false){$('notice').textContent=text;$('notice').className=error?'error':'';}
function persist(){if(!state)return;try{localStorage.setItem(KEY,C.encodeSave(state));}catch(e){notice(`Could not save: ${e.message}. Export your career below.`,true);}}
function btn(label,action,data='',disabled=false,cls=''){return `<button class="${cls}" data-action="${action}" ${data} ${disabled?'disabled':''}>${label}</button>`;}
function options(list,value){return list.map(([v,t])=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(t)}</option>`).join('');}
function playerOptions(players,selected){return options(players.map(p=>[p.id,`${p.name} · ${p.archetype}${p.injury?' · INJURED':''}`]),selected);}
function actionAllowed(){return state.phase==='prep'&&state.prepLeft>0&&!busy;}
function startScreen(){
 $('rogue').innerHTML=`<section class="hero"><p class="eyebrow">ONE CLUB. THREE DIVISIONS. YOUR STORY.</p><h1>From the district.<br><em>To the extraordinary.</em></h1><p>Build a squad. Take a chance. Watch your decisions come alive on the pitch.</p></section><div class="section-title"><h2>Choose your club</h2><span>A permanent identity. A fresh start.</span></div><div class="clubs">${D.CLUBS.map((c,i)=>`<article class="club" style="--club:${c.color}"><div class="crest">${['⚓','✦','▲'][i]}</div><p class="eyebrow">FOUNDING CLUB ${String(i+1).padStart(2,'0')}</p><h2>${c.name}</h2><p>${c.description}</p><div class="perk"><b>${D.CLUB_PERKS[c.perk].name}</b><p>${D.CLUB_PERKS[c.perk].description}</p></div>${btn('Take the reins →','new',`data-id="${c.id}"`,false,'primary')}</article>`).join('')}</div><section class="panel onboarding"><h2>Your first season</h2><p>Prepare for each fixture over three days. Training raises attributes directly; matches earn XP and your choice of level upgrades. Rotate tired players, balance the books and finish first to climb. Finish last in the bottom division or fail to pay fixture costs and the run ends.</p><p>Four clubs per division, three fixtures per season. Start with 2,600 credits. No wages or contracts.</p></section>`;
}
function nav(){return `<nav aria-label="Career panels">${[['club','Clubhouse'],['squad','Squad & tactics'],['training','Training & staff'],['recruits','Recruitment'],['shop','Shop & inventory'],['table','League']].map(([k,label])=>btn(label,'nav',`data-view="${k}" aria-current="${view===k?'page':'false'}"`,false,view===k?'active':'')).join('')}</nav>`;}
function render(){
 if(!state){startScreen();return;}
 const s=state,c=D.CLUBS.find(c=>c.id===s.clubId);
 $('rogue').innerHTML=`<section class="clubhead" style="--club:${c.color}"><div><p class="eyebrow">SEASON ${s.season} / ${D.DIVISIONS[s.division]}</p><h1>${esc(s.clubName)}</h1><span>${s.perks.map(k=>`<span class="tag" title="${esc(D.CLUB_PERKS[k].description)}">${D.CLUB_PERKS[k].name}</span>`).join(' ')}</span></div><div class="balance"><small>CLUB BALANCE</small><strong>${money(s.money)}</strong><small>${s.squad.length}/${D.CONFIG.squadMax} PLAYERS · DAY ${s.day}</small></div></section>${s.phase==='match'?'':nav()}<div id="content"></div><details class="save-tools"><summary>Save & run controls</summary><p>Automatically saved after every decision. A live match resumes from its saved seed and command history.</p>${btn('Export save','export')}${btn('Import save','import')}${btn('New run / Reset','reset')}<input id="save-file" type="file" accept="application/json" hidden></details>`;
 const content=$('content');
 if(s.phase==='match'){content.innerHTML=matchPanel();return;}
 if(['victory','gameover','season'].includes(s.phase)){content.innerHTML=endingPanel();return;}
 if(s.phase==='results'){content.innerHTML=reportPanel()+btn('Resolve league round →','round','',busy,'primary');return;}
 content.innerHTML=({club:dashboard,squad:squadPanel,training:trainingPanel,recruits:recruitPanel,shop:shopPanel,table:tablePanel}[view]||dashboard)();
}
function dashboard(){
 const s=state,o=C.nextOpponent(s),round=s.round+1;
 return `<div class="dashboard"><section class="fixture panel"><p class="eyebrow">NEXT FIXTURE · ROUND ${round}/${s.schedule.length}</p><h2>${esc(s.clubName)}<span class="versus">vs</span>${esc(o.name)}</h2><div class="fixture-meta"><span>${weather(s.forecast)}</span><span>${s.formation} · ${title(s.tactic.replaceAll('_',' '))}</span><span>3 substitutions</span></div><p>Expected gate ${money(C.price(s,D.CONFIG.gate))} · Operating costs ${money(C.price(s,D.CONFIG.upkeep))} · Win bonus ${money(C.price(s,D.CONFIG.winBonus))}</p>${s.prepLeft===0?btn('Enter the match →','match','',busy,'primary'): `<div class="day-track">${Array.from({length:D.CONFIG.prepDays},(_,i)=>`<span class="${i<D.CONFIG.prepDays-s.prepLeft?'done':''}">Day ${i+1}${i<D.CONFIG.prepDays-s.prepLeft?' ✓':''}</span>`).join('')}</div><p>${s.prepLeft} preparation ${s.prepLeft===1?'day':'days'} remaining. One main activity per day; selection and staff are free to manage.</p>`}</section><section class="panel"><p class="eyebrow">SQUAD READINESS</p><div class="readiness"><strong>${s.squad.filter(p=>!p.injury&&p.fatigue<50).length}</strong><span>fit and fresh</span><strong>${s.squad.filter(p=>p.injury).length}</strong><span>injured</span></div>${btn('Manage squad →','nav','data-view="squad"')}${s.squad.some(p=>p.pending.length)?'<p class="highlight">Level upgrades await your choice in Squad.</p>':''}</section></div><div class="section-title"><h2>Make today count</h2><span>${s.prepLeft?`Choose your next activity`:'Preparation complete'}</span></div><div class="activities">${[['Train','Direct attribute gains, at a fatigue cost.','nav','training'],['Rest','Restore squad fatigue.','rest',''],['Scout','3 uncertain prospects; cheaper recruitment.','scout',''],['Transfer Market','6 fully assessed players; higher fees.','market',''],['Shop','Buy recovery and curse-care supplies.','visit-shop','']].map(([name,desc,act,v])=>`<article class="panel"><h3>${name}</h3><p>${desc}</p>${btn(name==='Train'?'Choose session →':'Spend a day →',act,v?`data-view="${v}"`:'',!actionAllowed())}</article>`).join('')}</div><section class="panel"><h2>Club journal</h2><ul class="journal">${s.events.slice(-8).reverse().map(e=>`<li>${esc(e)}</li>`).join('')}</ul></section>${reportPanel(true)}`;
}
function squadPanel(){
 const s=state;return `<section class="panel"><div class="section-title"><h2>Your match plan</h2><span>Changes cost no preparation days</span></div><div class="controls"><label>Formation<select id="formation">${options(Object.keys(D.FORMATIONS).map(f=>[f,f]),s.formation)}</select></label><label>Tactical style<select id="tactic">${options(Object.entries(require('../../../presets/ai_archetypes.json')).map(([k,v])=>[k,v.label]),s.tactic)}</select></label></div><p>Archetypes are stat distributions, not positions. Anyone can play anywhere. Actual minutes grow proficiency independently in GK, defence, midfield and forward. Goalkeeping ability remains essential in goal.</p><div class="lineup">${D.FORMATIONS[s.formation].map((slot,i)=>`<label><b>${slot.role}</b><select data-slot="${i}" aria-label="${slot.role} starter">${playerOptions(s.squad,s.lineup[i])}</select></label>`).join('')}</div></section><div class="section-title"><h2>The squad</h2><span>${s.squad.length} players · injured players cannot start</span></div><div class="players">${s.squad.map(playerCard).join('')}</div>`;
}
function playerCard(p){
 const s=state;return `<article class="player panel"><div class="player-heading"><div><span class="tag">${s.lineup.includes(p.id)?'STARTER':'BENCH'}</span><h3>${esc(p.name)}</h3><small>${p.archetype}</small></div><span class="level">LV ${p.level}</span></div><div class="xp"><span style="width:${100*p.xp/(D.CONFIG.xpLevel*p.level)}%"></span></div><small>${Math.round(p.xp)} / ${D.CONFIG.xpLevel*p.level} XP · ${p.pending.length} upgrade(s) pending</small><div class="stats">${D.STATS.map(k=>`<div><span>${title(k)}</span><b>${p.stats[k].toFixed(1)}</b><meter min="0" max="100" value="${p.stats[k]}" aria-label="${k}"></meter></div>`).join('')}</div><div class="condition ${p.fatigue>60?'warning':''}">Fatigue <b>${Math.round(p.fatigue)} / 100</b> · ${p.injury?`<strong>${p.injury.name}: ${p.injury.days} day(s) out${s.staff.includes('medic')?' · medic doubles healing':''}</strong>`:'Fit to play'}</div><details><summary>Position experience & traits</summary><p>${['GK','DF','MF','FW'].map(k=>`${k}: ${P.proficiency(p,k).toFixed(1)}% (${Math.round(p.minutes[k])} min)`).join('<br>')}</p><p>Proficiency adds up to 15 percentage points to effective attributes in that position. Fatigue further reduces them.</p>${[...p.perks,...p.curses].map(k=>`<p class="trait ${D.TRAITS[k].kind}"><b>${D.TRAITS[k].name}</b> · ${D.TRAITS[k].description}${p.curses.includes(k)&&p.reliefUntil>s.day?' (suppressed)':''}</p>`).join('')||'<p>No perks or curses.</p>'}</details>${p.pending.length?`<div class="upgrades"><b>Choose level upgrade</b>${p.pending[0].map((c,i)=>btn(`+${c.gain} ${title(c.stat)}`,'upgrade',`data-id="${p.id}" data-choice="${i}"`)).join('')}</div>`:''}${!s.lineup.includes(p.id)?`<div class="controls">${btn(`Sell · ${money(Math.round(C.recruitPrice(s,p)*.4))}`,'sell',`data-id="${p.id}"`)}${btn('Release','release',`data-id="${p.id}"`)}</div>`:''}</article>`;
}
function trainingPanel(){
 const s=state,types=Object.keys(D.TRAINING).filter(t=>C.trainingUnlocked(s,t));
 return `<section class="panel"><p class="eyebrow">BETTER EVERY DAY</p><h2>Training ground</h2><p>One whole-squad session costs one day. Gain +${D.CONFIG.trainingGain} in each listed attribute and +${D.CONFIG.trainingFatigue} fatigue. Fatigue over 60 halves gains. Injured players sit out. <b>Training gives no overall XP.</b></p><label>Main session<select id="train-type">${options(types.map(t=>[t,`${title(t)} · ${D.TRAINING[t].join(' + ')}`]),'passing')}</select></label>${s.staff.includes('split')?`<details><summary>Split training (optional)</summary><label>Second session<select id="split-type"><option value="">Whole squad, no split</option>${options(types.map(t=>[t,title(t)]),'')}</select></label><p>Checked players take the second session. Everyone else takes the main session.</p><div class="split-list">${s.squad.map(p=>`<label><input type="checkbox" name="train-group" value="${p.id}">${esc(p.name)}</label>`).join('')}</div></details>`:'<p>Hire both specialist coaches, then an assistant to unlock Split Training.</p>'}${btn('Train · spend 1 day','train','',!actionAllowed(),'primary')}</section><div class="section-title"><h2>Your backroom team</h2><span>Hiring uses funds, not preparation days</span></div><div class="staff">${Object.entries(D.CONFIG.staff).map(([k,v])=>`<article class="panel"><h3>${v.name}</h3><p>${v.description}</p>${btn(s.staff.includes(k)?'Hired ✓':`Hire · ${money(C.price(s,v.price))}`,'hire',`data-id="${k}"`,s.staff.includes(k)||s.money<C.price(s,v.price)||(k==='split'&&(!s.staff.includes('technique')||!s.staff.includes('defence'))))}</article>`).join('')}</div>`;
}
function recruitPanel(){
 const s=state;return `<section class="panel"><h2>Find the next club legend</h2><p>Scouting offers lower fees and approximate attributes (±8). The market reveals exact attributes at higher fees. Visiting either costs one day. Signing from that visit costs only funds. Squad limit: 22.</p><div class="controls">${btn('Scout · spend 1 day','scout','',!actionAllowed())}${btn('Market · spend 1 day','market','',!actionAllowed())}</div></section>${['scout','market'].includes(s.visit)?`<div class="players">${(s.offers||[]).map(o=>`<article class="panel"><span class="tag">${o.scouted?'SCOUT ESTIMATE ±8':'FULL ASSESSMENT'}</span><h3>${esc(o.player.name)}</h3><p>${o.player.archetype}</p><div class="stats">${D.STATS.map((k,i)=>`<div><span>${title(k)}</span><b>${o.scouted?`~${o.estimates[k]}`:o.player.stats[k]}</b></div>`).join('')}</div><p>${[...o.player.perks,...o.player.curses].map(k=>D.TRAITS[k].name).join(' · ')||'No traits'}</p>${btn(`Recruit · ${money(o.price)}`,'sign',`data-id="${o.player.id}"`,s.money<o.price||s.squad.length>=D.CONFIG.squadMax,'primary')}</article>`).join('')||'<p>No prospects left from this visit.</p>'}</div>`:'<p class="empty">Spend a scouting or market day to see available players.</p>'}`;
}
function shopPanel(){
 const s=state;return `<section class="panel"><h2>The club shop</h2><p>Visiting consumes a preparation day. Purchases stay available until your next activity. Stored items can be used freely during preparation.</p>${btn('Visit Shop · spend 1 day','visit-shop','',!actionAllowed())}</section><div class="staff">${Object.entries(D.CONFIG.items).map(([k,v])=>`<article class="panel"><h3>${v.name}</h3><p>${v.description}</p>${btn(`Buy · ${money(C.price(s,v.price))}`,'buy',`data-id="${k}"`,s.visit!=='shop'||s.money<C.price(s,v.price))}<p>In inventory: <b>${s.inventory[k]||0}</b></p></article>`).join('')}</div><section class="panel"><h2>Use inventory</h2><div class="controls"><label>Player<select id="item-player">${playerOptions(s.squad,s.squad[0].id)}</select></label><label>Item<select id="item-key">${options(Object.entries(D.CONFIG.items).map(([k,v])=>[k,`${v.name} (${s.inventory[k]||0})`]),'spray')}</select></label><label>Curse to remove (Fresh start)<select id="item-curse">${options(Object.entries(D.TRAITS).filter(([,t])=>t.kind==='curse').map(([k,v])=>[k,v.name]),'party')}</select></label>${btn('Use stored item','use')}</div></section>`;
}
function tablePanel(table=C.sortedTable(state)){
 const s=state;return `<section class="panel"><div class="section-title"><h2>${D.DIVISIONS[s.seasonSummary&&['season','victory','gameover'].includes(s.phase)?s.seasonSummary.division:s.division]}</h2><span>1st promoted · last relegated</span></div><div class="table-scroll"><table><thead><tr><th># / Club</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>Pts</th></tr></thead><tbody>${table.map((t,i)=>`<tr class="${t.id===s.clubId?'ours':''}"><th>${i+1} · ${esc(t.name||t.id)}</th>${['played','w','d','l','gf','ga','points'].map(k=>`<td>${t[k]??0}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p>3 points for a win, 1 for a draw. Ties: goal difference, goals scored, club ID.</p></section><section class="panel"><h2>Fixture calendar</h2>${s.schedule.map((pairs,r)=>`<div class="calendar-round"><b>Round ${r+1}</b>${pairs.map(([a,b])=>{const result=s.results.find(x=>x.round===r&&x.a===a&&x.b===b);const name=id=>s.table.find(t=>t.id===id)?.name||id;return `<p>${esc(name(a))} <b>${result?`${result.ga} – ${result.gb}`:'vs'}</b> ${esc(name(b))}</p>`;}).join('')}</div>`).join('')}</section><section class="panel"><h2>Club accounts</h2><p>Fixture earnings are paid before operating costs. Purchases cannot create debt. An unpaid operating bill ends the run.</p>${s.ledger.slice(-15).reverse().map(e=>`<p class="ledger"><span>Day ${e.day} · ${esc(e.label)}</span><b class="${e.amount<0?'negative':'positive'}">${e.amount>0?'+':''}${money(e.amount)}</b></p>`).join('')||'<p>No transactions yet.</p>'}</section>`;
}
function reportPanel(compact=false){
 const r=state.lastReport;if(!r)return '';
 return `<section class="panel report"><p class="eyebrow">${compact?'LAST FIXTURE':'FULL TIME'}</p><h2>${r.scoreA} – ${r.scoreB}</h2><p>90 minutes · ${weather(r.weather)} · ${r.substitutions} substitutions · Earned ${money(r.earnings)}, costs ${money(r.cost)}</p>${compact?'':`<div class="table-scroll"><table><thead><tr><th>Player</th><th>Minutes</th><th>XP gained</th><th>Levels</th><th>Fatigue added</th></tr></thead><tbody>${r.changes.map(p=>`<tr><th>${esc(p.name)}</th><td>${p.minutes}</td><td>+${p.xp}</td><td>+${p.levels}</td><td>+${p.fatigue}</td></tr>`).join('')}</tbody></table></div><p>Level upgrades await your choice in Squad. Injuries and proficiency are shown on player cards.</p>`}</section>`;
}
function endingPanel(){
 const s=state;return `<section class="hero ending"><p class="eyebrow">${s.phase==='victory'?'THE UNDERDOGS DID IT':s.phase==='gameover'?'THE FINAL WHISTLE':'SEASON COMPLETE'}</p><h1>${s.phase==='victory'?'Champions.':s.phase==='gameover'?'A story worth playing.':`Season ${s.season}`}</h1><p>${esc(s.ending&&s.phase!=='season'?s.ending:s.seasonSummary?.message)}</p>${s.phase==='gameover'?btn('Choose a new club','reset','',false,'primary'):s.phase==='victory'?btn('Continue Career →','continue','',false,'primary'):`<h2>Choose one club perk</h2><div class="staff">${s.perkChoices.map(k=>`<article class="panel"><h3>${D.CLUB_PERKS[k].name}</h3><p>${D.CLUB_PERKS[k].description}</p>${btn('Choose perk','perk',`data-id="${k}"`)}</article>`).join('')}</div>${btn('Start next season →','continue','',s.perkChoices.length>0,'primary')}`}</section>${s.seasonSummary?tablePanel(s.seasonSummary.table):''}`;
}
function matchPanel(){return `<section class="panel live"><div class="section-title"><h2 id="match-score">Preparing the pitch…</h2><span id="match-clock">${weather(state.match.weather)}</span></div><canvas id="match-canvas" width="1100" height="680" aria-label="Live automatic football match"></canvas><div class="controls">${btn(paused?'Play':'Pause','pause')}<label>Match speed<select id="match-speed">${options([1,4,8,16,32].map(n=>[String(n),`${n}×`]),String(speed))}</select></label>${btn('Simulate rapidly →','fast','',false)}<span>Footballers play automatically.</span></div><div id="live-changes"></div></section>`;}
function refreshLive(){
 if(!live||!$('match-score'))return;
 const t=live.sim.teamA;
 $('match-score').textContent=`${state.clubName} ${live.sim.scoreA} – ${live.sim.scoreB} ${live.options.b.name}`;
 $('match-clock').textContent=`${Math.min(90,Math.floor(live.sim.matchTimer/60))}′ · ${weather(state.match.weather)} · ${live.sim.matchState}`;
 const signature=t.players.map(p=>`${p.careerId}:${p.role}:${p.isSentOff}`).join()+'|'+t.substitutionsMade+'|'+live.queue.length;
 if($('live-changes').dataset.signature!==signature){
  $('live-changes').dataset.signature=signature;
  const active=t.players.filter(p=>!p.isSentOff);
  $('live-changes').innerHTML=`<h3>Touchline decisions · ${t.substitutionsMade}/${D.CONFIG.subLimit} substitutions used</h3><p>Changes happen at the next stoppage. Sent-off players cannot be replaced. ${live.queue.length} change(s) queued.</p><div class="controls"><label>Off<select id="sub-out">${options(active.map(p=>[p.careerId,`${p.name} · ${p.role}`]),'')}</select></label><label>On<select id="sub-in">${options(t.bench.map(p=>[p.careerId,p.name]),'')}</select></label>${btn('Queue substitution','sub','',!t.bench.length||t.substitutionsMade>=D.CONFIG.subLimit)}</div><details><summary>Switch positions during the match</summary><p>Actual minutes and proficiency split between the positions played.</p><div class="controls"><select id="swap-a" aria-label="First player">${options(active.map(p=>[p.careerId,`${p.name} · ${p.role}`]),'')}</select><select id="swap-b" aria-label="Second player">${options(active.map(p=>[p.careerId,`${p.name} · ${p.role}`]),active[1]?.careerId)}</select>${btn('Queue position swap','swap')}</div></details>`;
 }
}
function paint(){
 if(!live||!$('match-canvas'))return;
 const canvas=$('match-canvas'),g=canvas.getContext('2d');
 Application.canvas=canvas;Application.g=g;Application.currentLevel=live.sim;Application.levelReady=true;Application.gameStatus='running';
 Settings.app=Application;Settings.projectionMode='orthographic';Settings.camera.type='static';Settings.camera.scale=7.5;Settings.camera.offsetX=45;Settings.camera.offsetY=80;
 Application.camX=0;Application.camY=0;
 g.clearRect(0,0,canvas.width,canvas.height);g.fillStyle='#10231e';g.fillRect(0,0,canvas.width,canvas.height);
 Settings.HEADLESS=false;try{Application.render();}finally{Settings.HEADLESS=true;}
}
async function openMatch(){
 busy=true;notice('Preparing match and restoring saved decisions…');
 try{
  if(!state.match)C.beginMatch(state);persist();render();
  live=await careerMatch(state);const target=state.match.ticks;
  while(live.ticks<target&&!live.finished){live.step(Math.min(500,target-live.ticks));await new Promise(r=>setTimeout(r,0));}
  await registerKits(live);paused=false;lastFrame=performance.now();accumulator=0;busy=false;notice('Match ready. Your team plays automatically.');refreshLive();raf=requestAnimationFrame(frame);
 }catch(e){busy=false;notice(e.message,true);}
}
function frame(now){
 try{
  if(!live)return;
  const elapsed=Math.min(.2,(now-lastFrame)/1000);lastFrame=now;
  if(!paused){accumulator+=elapsed*20*speed;const count=Math.min(600,Math.floor(accumulator));accumulator-=count;if(count)live.step(count);}
  state.match.ticks=live.ticks;
  if(now-lastSave>1000){persist();lastSave=now;}
  refreshLive();paint();
  if(live.finished){finishLive();return;}
  raf=requestAnimationFrame(frame);
 }catch(e){paused=true;notice(e.message,true);}
}
function finishLive(){const report=live.report();C.applyMatchReport(state,report);live=null;persist();render();notice('Full time. Review your squad’s match progression.');}
async function resolveRound(){
 busy=true;render();notice('Playing the other league fixture with the same match engine…');
 try{const pairs=state.schedule[state.round].filter(p=>!p.includes(state.clubId)),results=[];
  for(let i=0;i<pairs.length;i++)results.push(await simulateOther(state,...pairs[i],(state.rng+state.round*197+i)>>>0));
  C.finishRound(state,results);persist();busy=false;view='club';render();notice('League round complete.');
 }catch(e){busy=false;render();notice(e.message,true);}
}
async function handle(action,el){
 if(busy&&!['export'].includes(action))return;
 const id=el.dataset.id;
 if(action==='new'){state=C.newRun(id);view='club';}
 else if(action==='nav'){view=el.dataset.view;}
 else if(action==='reset'){if(!confirm('End this career and choose a new club? Export your save first to keep it.'))return;cancelAnimationFrame(raf);live=null;state=null;localStorage.removeItem(KEY);render();return;}
 else if(action==='export'){const blob=new Blob([C.encodeSave(state)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='soccer-rogue-save.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);return;}
 else if(action==='import'){$('save-file').click();return;}
 else if(action==='rest')C.activity(state,'rest');
 else if(action==='scout'||action==='market'){C.activity(state,action);view='recruits';}
 else if(action==='visit-shop'){C.activity(state,'shop');view='shop';}
 else if(action==='train'){C.activity(state,'train',{type:$('train-type').value,split:$('split-type')?.value||null,group:[...document.querySelectorAll('[name="train-group"]:checked')].map(e=>e.value)});}
 else if(action==='hire')C.hire(state,id);
 else if(action==='buy')C.buy(state,id);
 else if(action==='use')C.useItem(state,$('item-key').value,$('item-player').value,$('item-curse').value);
 else if(action==='sign')C.sign(state,id);
 else if(action==='sell'||action==='release')C.sell(state,id,action==='release');
 else if(action==='upgrade')P.chooseUpgrade(state.squad.find(p=>p.id===id),Number(el.dataset.choice));
 else if(action==='perk')C.choosePerk(state,id);
 else if(action==='continue')C.continueSeason(state);
 else if(action==='match'){C.beginMatch(state);await openMatch();return;}
 else if(action==='round'){await resolveRound();return;}
 else if(action==='pause'){paused=!paused;el.textContent=paused?'Play':'Pause';return;}
 else if(action==='fast'){speed=512;paused=false;notice('Rapid simulation: same engine, same fixture and accounting.');return;}
 else if(action==='sub'){live.command('sub',{out:$('sub-out').value,in:$('sub-in').value});persist();notice('Substitution queued for the next stoppage.');return;}
 else if(action==='swap'){live.command('swap',{a:$('swap-a').value,b:$('swap-b').value});persist();notice('Position switch queued for the next stoppage.');return;}
 persist();render();
}
document.addEventListener('DOMContentLoaded',()=>{
 try{const saved=localStorage.getItem(KEY);if(saved)state=C.decodeSave(saved);}catch(e){notice(`Save could not be loaded: ${e.message}. Your stored save has not been overwritten.`,true);}
 render();if(state?.phase==='match')openMatch();
 $('rogue').addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b&&!b.disabled)Promise.resolve(handle(b.dataset.action,b)).catch(e=>notice(e.message,true));});
 $('rogue').addEventListener('change',async e=>{
  try{
   if(e.target.id==='save-file'){const file=e.target.files[0];if(!file)return;const imported=C.decodeSave(await file.text());cancelAnimationFrame(raf);live=null;state=imported;persist();render();if(state.phase==='match')await openMatch();return;}
   if(e.target.dataset.slot!==undefined)C.assign(state,Number(e.target.dataset.slot),e.target.value);
   else if(e.target.id==='formation')C.setFormation(state,e.target.value);
   else if(e.target.id==='tactic')state.tactic=e.target.value;
   else if(e.target.id==='match-speed'){speed=Number(e.target.value);return;}else return;
   persist();render();
  }catch(err){notice(err.message,true);render();}
 });
 window.addEventListener('beforeunload',()=>{if(live&&state.match)state.match.ticks=live.ticks;persist();});
});
