const GRAVITY=16;
const BALL_RADIUS=.11;
const COURT_HEIGHT=2.85;
const FOOT_LIFT=.72;
const UPSTROKE=.19;
const RETURN=.24;
const CONTACT_ASSIST=.055;
const RESTITUTION=.38;
const FOOT_SPEED=7;
const TOE_HALF_WIDTH=.075;

class KickUps {
 constructor(target){
  this.target=target;
  this.count=0;
  this.x=0;
  this.y=BALL_RADIUS;
  this.vx=0;
  this.vy=0;
  this.spin=0;
  this.rotation=0;
  this.footY=0;
  this.footX=0;
  this.pointer=null;
  this.wallX=2;
  this.swing=null;
  this.active=false;
  this.done=false;
  this.resultTime=null;
 }
 get ready(){
  if(this.done||this.resultTime!==null||this.swing||!this.active||this.vy>=0)return false;
  const predictedY=this.y+(this.vy-GRAVITY*UPSTROKE/2)*UPSTROKE;
  return predictedY<=BALL_RADIUS+FOOT_LIFT-CONTACT_ASSIST;
 }
 kick(){
  if(this.done||this.resultTime!==null||this.swing||this.active&&this.vy>0)return;
  this.pointer=null;
  this.footX=this.x;
  this.footY=0;
  this.swing={time:0,hit:false};
 }
 moveFoot(x,y,wallX){
  this.wallX=wallX;
  this.pointer={x:Math.max(-wallX,Math.min(wallX,x)),y:Math.max(0,Math.min(COURT_HEIGHT,y))};
  this.swing=null;
 }
 step(dt){
  // Short steps resolve foot contact consistently when the display drops frames.
  let remaining=dt;
  while(remaining>0&&!this.done){
   const step=Math.min(remaining,1/240);
   this.advance(step);
   remaining-=step;
  }
 }
 advance(dt){
  const previousFoot=this.footY;
  const previousFootX=this.footX;
  if(this.pointer){
   const dx=this.pointer.x-this.footX,dy=this.pointer.y-this.footY;
   const distance=Math.hypot(dx,dy);
   const fraction=distance>0?Math.min(1,FOOT_SPEED*dt/distance):0;
   this.footX+=dx*fraction;
   this.footY+=dy*fraction;
  }else if(this.swing){
   this.swing.time+=dt;
   const time=this.swing.time;
   this.footY=FOOT_LIFT*Math.max(0,Math.min(time/UPSTROKE,1-(time-UPSTROKE)/RETURN));
   if(time>=UPSTROKE+RETURN)this.swing=null;
  }

  const previousBottom=this.y-BALL_RADIUS;
  const previousX=this.x;
  if(this.active){
   this.x+=this.vx*dt;
   this.y+=(this.vy-GRAVITY*dt/2)*dt;
   this.vy-=GRAVITY*dt;
   this.rotation+=this.spin*dt;
   if(Math.abs(this.x)>this.wallX){
    this.x=Math.sign(this.x)*this.wallX;
    this.vx*=-.65;
   }
  }

  const bottom=this.y-BALL_RADIUS;
  const footSpeed=(this.footY-previousFoot)/dt;
  const oldGap=previousBottom-previousFoot;
  const gap=bottom-this.footY;
  const contact=oldGap>0&&gap<oldGap?oldGap/(oldGap-gap):0;
  const offset=previousX-previousFootX+((this.x-this.footX)-(previousX-previousFootX))*contact;
  const contactAssist=this.pointer ? .012 : CONTACT_ASSIST;
  if((this.pointer||this.swing&&!this.swing.hit)&&this.resultTime===null&&footSpeed>.1
    &&(!this.pointer||this.vy<=0)&&Math.abs(offset)<=TOE_HALF_WIDTH+BALL_RADIUS
    &&oldGap>=-contactAssist&&gap<=0){
   if(this.swing)this.swing.hit=true;
   this.active=true;
   this.y=previousFoot+(this.footY-previousFoot)*contact+BALL_RADIUS;
   const launch=footSpeed+RESTITUTION*(footSpeed-this.vy);
   this.vy=this.pointer?Math.min(launch,Math.sqrt(2*GRAVITY*Math.max(.1,COURT_HEIGHT-this.y))):launch;
   this.vx=this.pointer?Math.max(-1.5,Math.min(1.5,offset*3.5+(this.footX-previousFootX)/dt*.2)):
    -this.x*.85+Math.cos(this.count*2.3)*.075;
   this.spin=this.vx*140;
   this.count++;
   if(this.count===this.target)this.resultTime=.32;
  }else if(this.active&&bottom<=0&&this.vy<0){
   this.y=BALL_RADIUS;
   this.vy=-this.vy*.35;
   this.vx*=.65;
   this.resultTime??=.3;
  }

  if(this.resultTime!==null){
   this.resultTime-=dt;
   this.done=this.resultTime<=0;
  }
 }
}

module.exports={KickUps,BALL_RADIUS,COURT_HEIGHT,FOOT_LIFT};
