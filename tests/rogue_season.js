require('./mock_env.js');
const assert=require('node:assert/strict');
const C=require('../kernel/rogue/career.js');
const {careerMatch,simulateOther}=require('../kernel/rogue/match.js');
const {Settings}=require('../kernel/settings.js');
Settings.app={camX:0,camY:0,canvas:{width:1000,height:650}};
(async()=>{
 let s=C.newRun('orchard',8675309);
 for(let round=0;round<3;round++){
  for(let d=0;d<3;d++)C.activity(s,'rest');
  for(let i=0;i<s.lineup.length;i++)if(s.squad.find(p=>p.id===s.lineup[i]).injury){const fit=s.squad.find(p=>!p.injury&&!s.lineup.includes(p.id));assert.ok(fit);C.assign(s,i,fit.id);}
  C.beginMatch(s);s=C.decodeSave(C.encodeSave(s));
  const m=await careerMatch(s);while(!m.finished)m.step(1000);C.applyMatchReport(s,m.report());
  assert.notEqual(s.phase,'gameover','starting funds sustain a season');
  s=C.decodeSave(C.encodeSave(s));const pairs=s.schedule[s.round].filter(p=>!p.includes(s.clubId));
  const results=[];for(const [a,b]of pairs)results.push(await simulateOther(s,a,b,100+round));
  C.finishRound(s,results);
 }
 assert.equal(s.results.length,6,'all six league matches played by engine');
 assert.ok(s.table.every(t=>t.played===3));
 assert.equal(s.table.reduce((v,t)=>v+t.gf,0),s.table.reduce((v,t)=>v+t.ga,0));
 assert.ok(['season','gameover'].includes(s.phase));
 assert.equal(new Set(s.results.map(r=>[r.a,r.b].sort().join())).size,6);
 assert.ok(s.squad.some(p=>Object.values(p.minutes).some(n=>n>0)));
 assert.ok(s.squad.some(p=>p.pending.length),'level choices remain pending for the manager');
 console.info('Soccer Rogue full engine season passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
