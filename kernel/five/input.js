const {KeyboardInput,commandFromFrame}=require('../core/lib/input_keyboard.js');
const {Utils}=require('../core/lib/utils.js');
const ALIASES={KeyJ:'Digit1',KeyK:'Digit3',Space:'Digit3',KeyL:'Digit2'};
const GAME_KEYS=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyJ','KeyK','KeyL','KeyE','Space','ShiftLeft','ShiftRight','Digit1','Digit2','Digit3']);
class FiveInput {
 constructor(){this.keys=new KeyboardInput();this.move=null;this.aim=null;this.enabled=true;this.cleanups=[];}
 pollFrame(){
  const f=this.keys.pollFrame();
  const map=set=>new Set([...set].map(k=>ALIASES[k]||k));
  const command=commandFromFrame({down:map(f.down),pressed:map(f.pressed),released:map(f.released)},{screenAware:true});
  command.switchPlayer=false;command.callPass=f.pressed.has('KeyE');
  if(this.move){const w=Utils.worldDeltaFromScreenDelta(this.move.x,this.move.y),len=Math.hypot(w.ox,w.oy)||1;const strength=Math.min(1,Math.hypot(this.move.x,this.move.y));command.moveX=w.ox/len*strength;command.moveY=w.oy/len*strength;}
  if(this.aim){command.aimX=this.aim.x;command.aimY=this.aim.y;}
  return {command};
 }
 attach(target){
  const down=e=>{if(!this.enabled||!GAME_KEYS.has(e.code)||/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName||''))return;e.preventDefault();this.keys.debugKeyDown(e.code);};
  const up=e=>{if(GAME_KEYS.has(e.code)){e.preventDefault();this.keys.debugKeyUp(e.code);}};
  target.addEventListener('keydown',down);target.addEventListener('keyup',up);
  this.cleanups.push(()=>{target.removeEventListener('keydown',down);target.removeEventListener('keyup',up);});
 }
 press(code){if(this.enabled)this.keys.debugKeyDown(code);}
 release(code){this.keys.debugKeyUp(code);}
 reset(){this.keys.debugReset();this.move=null;this.aim=null;}
 destroy(){this.reset();this.cleanups.forEach(fn=>fn());this.cleanups=[];}
}
module.exports={FiveInput,GAME_KEYS};
