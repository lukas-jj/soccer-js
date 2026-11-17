require('./mock_env.js');
const assert=require('node:assert/strict');
const C=require('../kernel/rogue/career.js');
const {careerMatch,simulateOther}=require('../kernel/rogue/match.js');
const {Settings}=require('../kernel/settings.js');
Settings.app={camX:0,camY:0,canvas:{width:1000,height:650}};
(async()=>{
 const s=C.newRun('harbor',42);for(let i=0;i<3;i++)C.activity(s,'rest');C.beginMatch(s);
 const m=await careerMatch(s);assert.equal(m.sim.teamA.managerControlled,true);
 const t=m.sim.teamA,out=t.players[5].careerId,incoming=t.bench[0].careerId;
 assert.throws(()=>m.command('sub',{out:'bad',in:incoming}));
 m.command('sub',{out,in:incoming});m.step(1);assert.equal(t.substitutionsMade,1);assert.equal(t.players[5].role,'LM');
 const a=t.players[1].careerId,b=t.players[9].careerId;m.command('swap',{a,b});m.step(1);
 // Engine automatic substitutions are disabled for manager teams.
 const stamina=t.players.map(p=>p.currentStamina);t.players.forEach(p=>p.currentStamina=.1);m.sim.evaluateTeamSubstitutions(t);assert.equal(t.substitutionsMade,1);t.players.forEach((p,i)=>p.currentStamina=stamina[i]);
 // Restore from the same seed and command timeline and compare the actual simulation.
 m.step(150);const resumed=await careerMatch(s);resumed.step(m.ticks);assert.equal(resumed.sim.matchTimer,m.sim.matchTimer);assert.deepEqual(resumed.minutes,m.minutes);assert.equal(resumed.sim.scoreA,m.sim.scoreA);assert.deepEqual(resumed.sim.players.map(p=>[p.x,p.y,p.role]),m.sim.players.map(p=>[p.x,p.y,p.role]));
 // Replay uses the identical command timeline and seed, including role switches.
 while(!resumed.finished)resumed.step(500);
 const report=resumed.report();assert.equal(report.minute,90);
 const total=Object.values(report.minutes).reduce((sum,roles)=>sum+Object.values(roles).reduce((a,b)=>a+b,0),0);
 assert.ok(total<=990.01&&total>700,'actual player minutes allocated');
 assert.ok((report.minutes[out]?.MF||0)<1,'subbed player stops earning minutes');
 assert.ok(report.minutes[incoming].MF>20,'replacement inherits position');
 assert.ok(report.minutes[a].FW>0,'role switch allocates forward minutes');
 C.applyMatchReport(s,report);assert.equal(s.table.find(t=>t.id===s.clubId).played,1);
 assert.throws(()=>C.applyMatchReport(s,report),'no duplicate rewards');
 const pair=s.schedule[s.round].find(p=>!p.includes(s.clubId));const other=await simulateOther(s,...pair,77);C.finishRound(s,[other]);assert.equal(s.round,1);
 console.info('Soccer Rogue engine integration passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
