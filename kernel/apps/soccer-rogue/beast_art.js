const {Time}=require('../../core/lib/time.js');
const {Utils}=require('../../core/lib/utils.js');
const {Settings}=require('../../settings.js');

function shape(g,color,...points){
 g.fillStyle=color;
 g.beginPath();
 g.moveTo(...points[0]);
 for(const point of points.slice(1))g.lineTo(...point);
 g.closePath();
 g.fill();
}

function oval(g,color,x,y,rx,ry){
 g.fillStyle=color;
 g.beginPath();
 g.ellipse(x,y,rx,ry,0,0,Math.PI*2);
 g.fill();
}

function paintBear(g,stride){
 const fur='#916140',shade='#563827';
 oval(g,shade,-.48,-.28+stride,.27,.3);
 oval(g,shade,.37,-.27-stride,.25,.3);
 oval(g,fur,-.16,-.65,.82,.54);
 oval(g,shade,.57,-1.21,.15,.17);
 oval(g,fur,.63,-.91,.43,.4);
 oval(g,'#c29468',.9,-.78,.32,.22);
 oval(g,'#261b18',1.14,-.79,.13,.1);
 oval(g,'#f6d287',.8,-.99,.056,.056);
}

function paintWolf(g,stride){
 const fur='#8397a8',shade='#455665';
 shape(g,shade,[-.61,-.65],[-1.31,-.61],[-1.08,-.38],[-.58,-.46]);
 shape(g,shade,[-.59,-.6],[-.29,-.5],[-.43+stride,-.06],[-.62+stride,-.06]);
 shape(g,shade,[.36,-.61],[.57,-.56],[.64-stride,-.06],[.42-stride,-.06]);
 oval(g,fur,-.09,-.64,.72,.33);
 shape(g,fur,[.22,-.55],[.37,-1.04],[.49,-1.39],[.69,-1.09],[.84,-1.3],[.94,-.93],[1.29,-.76],[1.12,-.59],[.65,-.62]);
 shape(g,'#cad8da',[.59,-.77],[1.29,-.76],[1.12,-.59],[.65,-.62]);
 oval(g,'#ffe09a',.94,-.86,.06,.045);
}

function paintEagle(g,flap){
 shape(g,'#503526',[-.6,-.78],[-1.22,-.44],[-1.08,-.9],[-.64,-1.17]);
 shape(g,'#805231',[.02,-1.02],[-.58,-1.35+flap],[-1.38,-1.58+flap],[-1.17,-1.17+flap],[-.48,-.73]);
 oval(g,'#94603b',-.17,-.88,.65,.31);
 shape(g,'#b47a49',[.21,-.91],[-.08,-1.32-flap],[-.76,-1.74-flap],[-.64,-1.22-flap],[-.24,-.69]);
 oval(g,'#f3ead4',.51,-1.1,.36,.28);
 shape(g,'#ffc65c',[.78,-1.21],[1.12,-1.06],[.92,-.89],[.86,-1.01],[.73,-1.04]);
 oval(g,'#29211e',.65,-1.17,.055,.055);
}

const painters={bear:paintBear,wolf:paintWolf,eagle:paintEagle};

function paintBeast(g,player,form){
 const ground=Utils.toScreen(player.x,player.y);
 const feet=Utils.toScreen(player.x,player.y,player.z||0);
 const scale=Settings.camera.scale;
 const direction=Math.sin((player.orientation-2)*Math.PI/4);
 const facing=player.orientation>=5?-1:1;
 const moving=Math.hypot(player.vx||0,player.vy||0)>.1;
 const stride=moving?Math.sin(Time.time*22)*.17:0;
 oval(g,'#101b1688',ground.x,ground.y,scale*.9,scale*.28);
 g.save();
 g.translate(feet.x,feet.y);
 g.scale(scale*facing*(1-Math.abs(direction)*.22),scale);
 painters[form](g,form==='eagle'?Math.sin(Time.time*15)*.27:stride);
 g.restore();
}
module.exports={paintBeast};
