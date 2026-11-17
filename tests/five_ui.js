require('./mock_env.js');
const assert=require('node:assert/strict');
const baseCreate=document.createElement;
const originalCreate=tag=>{const c=baseCreate(tag);if(tag==='canvas'){const get=c.getContext.bind(c);c.getContext=type=>{const ctx=get(type);return new Proxy(ctx,{get:(t,k)=>typeof t[k]!=='undefined'?t[k]:(()=>{})});};}return c;};
document.createElement=originalCreate;
const nodes=new Map(),listeners=new Map();
const classes=()=>({toggle(){},add(){},remove(){}});
function makeNode(id){
 if(nodes.has(id))return nodes.get(id);
 const canvas=id==='pitch'?originalCreate('canvas'):null;
 const n={id,dataset:{},style:{},hidden:false,classList:classes(),textContent:'',width:1280,height:800,
  setAttribute(){},focus(){},setPointerCapture(){},getBoundingClientRect:()=>({left:0,top:0,width:1280,height:800}),
  addEventListener(type,fn){listeners.set(id+':'+type,fn);},removeEventListener(){}};
 let html='';Object.defineProperty(n,'innerHTML',{get:()=>html,set:v=>{html=v;for(const m of v.matchAll(/id="([^"]+)"/g))makeNode(m[1]);}});
 if(canvas){const context=canvas.getContext('2d');const gradient={addColorStop(){}};
  n.getContext=()=>new Proxy(context,{get:(target,key)=>key==='createRadialGradient'||key==='createLinearGradient'?()=>gradient:typeof target[key]!=='undefined'?target[key]:(()=>{})});
 }
 nodes.set(id,n);return n;
}
for(const id of ['pitch','hud','touch','overlay','message','joystick','stick-nub'])makeNode(id);
let nextFrame;
global.requestAnimationFrame=fn=>{nextFrame=fn;return 1;};global.cancelAnimationFrame=()=>{};
global.localStorage={getItem:()=>null,setItem(){}};
global.window.addEventListener=(type,fn)=>listeners.set('window:'+type,fn);
global.window.removeEventListener=()=>{};global.window.devicePixelRatio=1;global.window.matchMedia=()=>({matches:false});
global.document.getElementById=id=>nodes.get(id)||null;
global.document.addEventListener=(type,fn)=>listeners.set('document:'+type,fn);
global.document.removeEventListener=()=>{};
global.document.querySelectorAll=selector=>selector==='[data-key]'?['Digit1','Digit2','Digit3','ShiftLeft','KeyE'].map(code=>({...makeNode('touch-'+code),dataset:{key:code}})):[];
if(process.env.FIVE_TEST_BUNDLE)require('node:vm').runInThisContext(require('node:fs').readFileSync(require('node:path').join(__dirname,'../build/rogue.bundle.js'),'utf8'));
else require('../kernel/apps/soccer-rogue/app.js');
const click=async(action)=>{await listeners.get('document:click')({target:{closest:selector=>selector==='[data-action]'?{dataset:{action}}:null}});};
const tick=()=>{const f=nextFrame;f(performance.now()+100);};
(async()=>{
 listeners.get('document:DOMContentLoaded')();assert.ok(nodes.get('overlay').innerHTML.includes('PICK YOUR PLAYER'));
 assert.equal((nodes.get('overlay').innerHTML.match(/data-character=/g)||[]).length,4);
 assert.ok(!nodes.get('overlay').innerHTML.includes('Train'));
 tick(); // The real pitch renderer can paint the selection background.
 await click('play');assert.equal(nodes.get('overlay').hidden,true);assert.equal(nodes.get('hud').hidden,false);
 assert.equal(nodes.get('message').textContent,'');
 tick();assert.equal(nodes.get('message').textContent,'','live engine render does not throw');
 await click('pause');assert.equal(nodes.get('overlay').hidden,false);assert.ok(nodes.get('overlay').innerHTML.includes('RESUME'));
 await click('resume');assert.equal(nodes.get('overlay').hidden,true);
 listeners.get('window:blur')();assert.equal(nodes.get('overlay').hidden,false,'losing focus pauses');
 await click('choose');assert.ok(nodes.get('overlay').innerHTML.includes('PICK YOUR PLAYER'));assert.equal(nodes.get('hud').hidden,true);
 console.info('5v5 selection, pitch rendering, pause, resume and focus tests passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
