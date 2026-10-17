import { definePreset, range, select, sharedParams } from './define';

/**
 * A sketchbook page: ruled paper with its margin on the inline-start side,
 * hand-drawn roughjs doodles (boxes, circles, stars, arrows pointing in the
 * reading direction, squiggles, clouds) that pop in one by one, then "boil"
 * like hand-drawn animation (three pre-generated variants per doodle, so
 * boiling costs nothing). Hover wiggles a doodle; a click adds one.
 */
export const ROUGH_NOTEBOOK = definePreset({
  id: 'rough-notebook',
  name: { en: 'Rough notebook', ar: 'دفتر الرسم اليدوي' },
  description: {
    en: 'Hand-drawn doodles on ruled paper pop in one by one and boil like a cartoon. Hachure, cross-hatch, zigzag or dot fills; click to doodle more.',
    ar: 'رسومات يدوية على ورق مسطّر تظهر واحدة تلو الأخرى وترتعش كالرسوم المتحركة، بتظليل خطّي أو متقاطع أو متعرّج أو منقّط، وانقر لتضيف المزيد.',
  },
  tags: ['interactive', 'bold', 'loop', 'background'],
  libs: ['kit', 'rough', 'viewport'],
  params: [
    ...sharedParams({ seed: 6, interactive: true }),
    range('shapes', 'Doodles', 'عدد الرسومات', 14, 4, 40, 1, 'look'),
    range('roughness', 'Roughness', 'الخشونة', 1.4, 0, 3, 0.1, 'look'),
    range('hachureGap', 'Hatch gap', 'تباعد التظليل', 6, 2, 16, 0.5, 'look'),
    select(
      'fillStyle',
      'Fill',
      'التعبئة',
      'hachure',
      [
        ['hachure', 'Hachure', 'تظليل خطّي'],
        ['cross-hatch', 'Cross-hatch', 'تظليل متقاطع'],
        ['zigzag', 'Zigzag', 'متعرّج'],
        ['dots', 'Dots', 'نقاط'],
        ['solid', 'Solid', 'مصمت'],
      ],
      'look',
    ),
    range('wobble', 'Boil', 'الارتعاش', 0.5, 0, 1, 0.05, 'motion'),
  ],
  code: String.raw`
const p=ck.params({palette:'theme',seed:6,speed:1,density:1,interactive:true,shapes:14,roughness:1.4,hachureGap:6,fillStyle:'hachure',wobble:0.5});
const s=await ck.scene({libs:['rough','viewport'],seed:p.seed,design:{width:1280,height:720,fit:'cover',zoom:true}});
const PIXI=s.PIXI,C=s.palette,RG=s.lib.rough,gen=RG.generator();
const paper=new PIXI.Graphics(),board=new PIXI.Container();
s.world.addChild(paper,board);
const kinds=['rectangle','circle','star','arrow','ellipse','squiggle','triangle','cloud'];
const seed0=Math.max(1,Math.round(p.seed))*97;
let W=1,H=1,items=[],extra=0;

function drawables(it,seed){
  const o={roughness:p.roughness,bowing:1.2,stroke:C.hex(2),strokeWidth:1.8,fill:C.hex(it.c),fillStyle:p.fillStyle,hachureGap:p.hachureGap,hachureAngle:-41+it.c*15,fillWeight:1.2,seed:seed};
  const r=it.r,d=s.dir;
  if(it.k==='rectangle')return [gen.rectangle(-r,-r*0.7,r*2,r*1.4,o)];
  if(it.k==='circle')return [gen.circle(0,0,r*2,o)];
  if(it.k==='ellipse')return [gen.ellipse(0,0,r*2.4,r*1.4,o)];
  if(it.k==='triangle')return [gen.polygon([[0,-r],[r,r*0.8],[-r,r*0.8]],o)];
  if(it.k==='star'){const pts=[];for(let k=0;k<10;k++){const a=-Math.PI/2+k*Math.PI/5,q=k%2?r*0.45:r;pts.push([Math.cos(a)*q,Math.sin(a)*q]);}return [gen.polygon(pts,o)];}
  if(it.k==='arrow')return [gen.line(-r*d,0,r*d,0,o),gen.linearPath([[r*0.55*d,-r*0.4],[r*d,0],[r*0.55*d,r*0.4]],o)];
  if(it.k==='squiggle'){const pts=[];for(let k=0;k<=8;k++)pts.push([-r+k*r/4,Math.sin(k*1.4)*r*0.35]);return [gen.curve(pts,o)];}
  const c=r*0.5;
  return [gen.path('M'+(-r)+' '+c+' Q'+(-r*1.2)+' '+(-c)+' '+(-c)+' '+(-c*0.8)+' Q0 '+(-r*1.2)+' '+c+' '+(-c*0.8)+' Q'+(r*1.2)+' '+(-c)+' '+r+' '+c+' Z',o)];
}
function make(it,i){
  const box=new PIXI.Container();
  it.v=[];
  for(let k=0;k<3;k++){
    const g=new PIXI.Graphics();
    for(const dr of drawables(it,seed0+i*7+k))RG.drawRough(g,dr);
    g.visible=k===0;box.addChild(g);it.v.push(g);
  }
  box.x=it.x;box.y=it.y;box.rotation=it.rot;box.scale.set(0);
  board.addChild(box);it.box=box;it.h=0;
}
function layout(w,h){
  W=Math.max(1,w);H=Math.max(1,h);
  paper.clear().rect(0,0,W,H).fill(C.surface);
  for(let y=56;y<H;y+=28)paper.moveTo(0,y).lineTo(W,y);
  paper.stroke({width:1,color:C.muted,alpha:0.28});
  const mx=s.dir>0?64:W-64;
  paper.moveTo(mx,0).lineTo(mx,H).stroke({width:1.5,color:C.accent,alpha:0.55});
  for(let y=60;y<H;y+=110)paper.circle(s.dir>0?24:W-24,y,7).fill({color:C.muted,alpha:0.25});
  board.removeChildren().forEach(function(c){c.destroy({children:true});});
  const n=Math.max(1,s.count(p.shapes)),r=Math.max(26,Math.min(90,Math.sqrt(W*H/n)*0.32));
  const spots=s.poisson(Math.max(1,W-150),Math.max(1,H-70),r*2.6,n);
  items=spots.map(function(q,i){return {x:q[0]+(s.dir>0?110:40),y:q[1]+35,r:r*s.rand(0.7,1),k:kinds[i%kinds.length],c:i%5,rot:s.rand(-0.25,0.25),at:i*0.3};});
  items.forEach(make);
}
layout(1280,720);
s.pointer.onDown(function(){
  if(!p.interactive||!s.pointer.inside||s.reducedMotion||s.editor||extra>=12)return;
  const it={x:s.pointer.x,y:s.pointer.y,r:items.length?items[0].r*0.8:40,k:kinds[(extra*3+1)%kinds.length],c:extra%5,rot:s.rand(-0.3,0.3),at:-1};
  extra++;make(it,items.length+extra);it.born=true;items.push(it);
});
let clock=0;
s.tick(function(time){
  const T=s.reducedMotion?1e4:time.t*p.speed;
  if(!s.reducedMotion)clock+=time.dt*(2+10*p.wobble)*Math.max(0.2,p.speed);
  const frame=p.wobble>0?Math.floor(clock)%3:0;
  const on=p.interactive&&s.pointer.inside&&!s.reducedMotion;
  for(const it of items){
    if(it.born){it.at=T;it.born=false;}
    const k=Math.max(0,Math.min(1,(T-it.at)/0.45)),e=k<1?1+2.7*Math.pow(k-1,3)+1.7*Math.pow(k-1,2):1;
    let hover=0;
    if(on){const dx=it.x-s.pointer.x,dy=it.y-s.pointer.y;if(dx*dx+dy*dy<it.r*it.r*1.6)hover=1;}
    it.h+=(hover-it.h)*0.2;
    it.box.scale.set(Math.max(0,e)*(1+0.08*it.h));
    it.box.rotation=it.rot+it.h*0.08*Math.sin(T*14);
    for(let v=0;v<3;v++)it.v[v].visible=v===frame;
  }
});
s.dispose(function(){items=[];});
`,
});
