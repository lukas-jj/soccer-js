require('./mock_env.js');
const assert=require('node:assert/strict');
const {Settings}=require('../kernel/settings.js');
const {Time}=require('../kernel/core/lib/time.js');
const {PlayerStates}=require('../kernel/core/entities/player.js');
const {resolveControlledPlayer,tickManualControl,humanFacingDir}=require('../kernel/core/lib/manual_control.js');
const {FiveMatch,CHARACTERS,configureFive}=require('../kernel/five/match.js');
const {FiveInput}=require('../kernel/five/input.js');
Settings.app={camX:0,camY:0,canvas:{width:1280,height:800}};
(async()=>{
 assert.equal(CHARACTERS.length,4);
 for(const c of CHARACTERS){
  const match=await FiveMatch.create(c.id,42,{headless:true});
  assert.equal(match.sim.teamA.players.length,5);assert.equal(match.sim.teamB.players.length,5);
  assert.equal(match.sim.players.length,10);assert.equal(match.sim.teamA.bench.length,0);
  assert.equal(match.player.characterId,c.id);assert.equal(match.player.team,'A');
  assert.equal(match.sim.lockedHumanPlayer,match.player);
 }
 await assert.rejects(()=>FiveMatch.create('invalid',1,{headless:true}));
 const m=await FiveMatch.create(CHARACTERS[0].id,77,{headless:true});
 Settings.HEADLESS=false;m.sim._playbackRecordingStopped=true;
 m.sim.setPieceType='';m.sim.matchState='play';
 const teammate=m.sim.teamA.players.find(p=>p!==m.player&&p.role!=='GK');
 m.sim.ball.owner=teammate;
 assert.equal(resolveControlledPlayer(m.sim,'A',teammate),m.player,'ball owner never steals selected character control');
 const input=new FiveInput();input.keys.debugKeyDown('KeyD');input.keys.debugKeyDown('KeyJ');
 let frame=input.pollFrame();assert.equal(frame.command.pass,true);assert.ok(frame.command.moveX>0);
 input.keys.debugKeyUp('KeyJ');frame=input.pollFrame();assert.equal(frame.command.passReleased,true);
 input.keys.debugKeyDown('Space');assert.equal(input.pollFrame().command.shoot,true);
 input.reset();assert.equal(input.pollFrame().command.moveX,0);
 input.move={x:0,y:-1};assert.ok(input.pollFrame().command.moveY<0,'touch stick moves up');input.aim={x:2,y:-1};assert.equal(input.pollFrame().command.aimX,2);input.reset();
 input.keys.debugKeyDown('KeyE');assert.equal(input.pollFrame().command.callPass,true);assert.equal(input.pollFrame().command.callPass,false,'call uses an input edge');input.reset();
 assert.equal(m.sim.teamA.bench.length+m.sim.teamB.bench.length,0);
 m.sim.ball.offsideReceiver=teammate;m.sim.cacheOffsideLines();assert.equal(m.sim.ball.offsideReceiver,null);

 const x=m.player.x;const keyboard={pollFrame:()=>({command:{moveX:1,moveY:0,sprint:false,switchPlayer:true}})};
 tickManualControl(m.sim,{keyboard});assert.equal(m.sim._manualControlled.A,m.player);
 Time.deltaTime=.05;m.player.update();assert.ok(m.player.x>x,'selected character moves off ball');
 assert.equal(teammate.humanControlled,false);
 assert.deepEqual(humanFacingDir(m.player,{moveX:1,moveY:0,aimX:0,aimY:-1}),{x:0,y:-1});
 // A shot is a genuine engine action, not an edited scoreboard.
 const {grantGkPossession}=require('../kernel/core/entities/player.js');
 m.sim.ball.owner=m.player;m.sim.ball.x=m.player.x;m.sim.ball.y=m.player.y;
 m.player.actionTimer=0;m.player.fsm.changeState(PlayerStates.Dribble);
 Settings.manualControl.holdToPower=false;
 tickManualControl(m.sim,{keyboard:{pollFrame:()=>({command:{moveX:1,moveY:0,shoot:true,shootDown:true,aimX:1,aimY:0}})}});
 assert.equal(m.player.fsm.getNameOfCurrentState(),'Shoot');
 for(let i=0;i<25;i++){Time.advanceFixedLogicStep();m.player.update();m.sim.ball.update();}
 assert.notEqual(m.sim.ball.owner,m.player);assert.ok(Math.hypot(m.sim.ball.vx,m.sim.ball.vy)>0);
 Settings.HEADLESS=true;
 const full=await FiveMatch.create(CHARACTERS[2].id,91,{headless:true,duration:12});
 for(let i=0;i<40000&&!full.finished;i++)full.step();
 assert.ok(full.finished,'five-a-side match reaches fulltime on real engine');
 assert.ok(Number.isInteger(full.sim.scoreA)&&Number.isInteger(full.sim.scoreB));
 assert.equal(full.sim.players.length,10);
 console.info('5v5 character control, input, shooting and full-match tests passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
