const {KeyboardInput,commandFromFrame}=require('../core/lib/input_keyboard.js');
const {Utils}=require('../core/lib/utils.js');
const ALIASES={KeyJ:'Digit1',KeyK:'Digit3',KeyL:'Digit2',KeyQ:'Digit4',MouseLeft:'Digit1',MouseRight:'Digit3'};
const GAME_KEYS=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyJ','KeyK','KeyL','KeyR','KeyF','KeyT','KeyE','KeyG','Space','ShiftLeft','ShiftRight','Digit1','Digit2','Digit3']);
class FiveInput {
 constructor(){this.keys=new KeyboardInput();this.move=null;this.aim=null;this.enabled=true;this.cleanups=[];}
 pollFrame(){
  const f=this.keys.pollFrame();
  const map=set=>new Set([...set].map(k=>k==='Space'&&!this.squad?'Digit3':ALIASES[k]||k));
  const down=map(f.down);
  const released=new Set([...map(f.released)].filter(code=>!down.has(code)));
  const command=commandFromFrame({down,pressed:map(f.pressed),released},{screenAware:true});
  command.switchPlayer=!!this.squad&&command.switchPlayer;
  command.switchKeeper=!!this.squad&&f.pressed.has('KeyG');
  command.powerDown=!!this.squad&&f.down.has('Space');
  command.usePower=!!this.squad&&f.pressed.has('Space');
  if(this.squad)command.teamMove=f.pressed.has('KeyE')?'auto':f.pressed.has('KeyR')?'power':f.pressed.has('KeyF')?'header':f.pressed.has('KeyT')?'overhead':null;
  command.callPass=!this.squad&&f.pressed.has('KeyE');
  if(this.move){const w=Utils.worldDeltaFromScreenDelta(this.move.x,this.move.y),len=Math.hypot(w.ox,w.oy)||1;const strength=Math.min(1,Math.hypot(this.move.x,this.move.y));command.moveX=w.ox/len*strength;command.moveY=w.oy/len*strength;}
  command.sprint=command.sprint&&(this.canSprint?.()??true);
  const aim=this.getAim();
  if(aim){command.aimX=aim.x;command.aimY=aim.y;command.directPointerAim=!!this.pointer&&Math.hypot(aim.x,aim.y)>1e-4;}
  return {command};
 }
 getAim(){return this.pointer&&this.resolvePointerAim?this.resolvePointerAim(this.pointer):this.aim;}
 attach(target){
  const isGameKey=code=>GAME_KEYS.has(code)||(this.squad&&code==='KeyQ');
  const down=e=>{if(!this.enabled||!isGameKey(e.code)||/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName||''))return;e.preventDefault();if(!e.repeat)this.keys.debugKeyDown(e.code);};
  const up=e=>{if(isGameKey(e.code)){e.preventDefault();this.keys.debugKeyUp(e.code);}};
  target.addEventListener('keydown',down);target.addEventListener('keyup',up);
  this.cleanups.push(()=>{target.removeEventListener('keydown',down);target.removeEventListener('keyup',up);});
 }
 press(code){if(this.enabled)this.keys.debugKeyDown(code);}
 release(code){this.keys.debugKeyUp(code);}
 reset(){this.keys.debugReset();this.move=null;this.aim=null;this.pointer=null;}
 destroy(){this.reset();this.cleanups.forEach(fn=>fn());this.cleanups=[];}
}
module.exports={FiveInput,GAME_KEYS};
