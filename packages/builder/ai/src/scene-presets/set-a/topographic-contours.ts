import { definePreset, range, sharedParams, toggle } from './define';

/**
 * A contour map: marching squares over an animated fbm height field, with
 * index lines every fifth level and elevation labels in the page's numerals.
 * The terrain drifts in the reading direction; the pointer raises a hill.
 */
export const TOPOGRAPHIC_CONTOURS = definePreset({
  id: 'topographic-contours',
  name: { en: 'Topographic contours', ar: 'خطوط الكنتور الطبوغرافية' },
  description: {
    en: 'Drifting contour lines of an imaginary terrain, traced by marching squares, with index lines and elevation labels. The pointer raises a hill.',
    ar: 'خطوط كنتور متحرّكة لتضاريس متخيَّلة تُرسم بالمربّعات الزاحفة مع خطوط رئيسية وأرقام ارتفاع، ويرفع المؤشر تلّاً.',
  },
  tags: ['generative', 'calm', 'background', 'interactive'],
  libs: ['kit'],
  params: [
    ...sharedParams({ seed: 21, interactive: true }),
    range('levels', 'Levels', 'عدد المستويات', 18, 6, 40, 1, 'look'),
    range('scale', 'Terrain scale', 'مقياس التضاريس', 0.0028, 0.0008, 0.008, 0.0001, 'look'),
    range('drift', 'Drift', 'الانجراف', 0.3, 0, 1, 0.05, 'motion'),
    range('lineWidth', 'Line width', 'سماكة الخط', 1.2, 0.5, 4, 0.1, 'look'),
    toggle('labels', 'Elevation labels', 'أرقام الارتفاع', true, 'look'),
  ],
  code: String.raw`
const p=ck.params({palette:'theme',seed:21,speed:1,density:1,interactive:true,levels:18,scale:0.0028,drift:0.3,lineWidth:1.2,labels:true});
const s=await ck.scene({libs:[],seed:p.seed});
const PIXI=s.PIXI,C=s.palette;
const bg=new PIXI.Graphics(),g=new PIXI.Graphics(),tags=new PIXI.Container();
s.stage.addChild(bg,g,tags);
// Marching-squares segments per case (corners: a=8 top-left, b=4 top-right, c=2 bottom-right, d=1 bottom-left).
const SEG=['','lb','br','lr','tr','trlb','tb','tl','tl','tb','tlbr','tr','lr','br','lb'];
let W=1,H=1,cs=8,nx=2,ny=2,F=new Float32Array(4),frame=0,hill=0;
const pool=[];
for(let i=0;i<6;i++){
  const t=s.text('0',{fontFamily:'system-ui, sans-serif',fontSize:11,fill:C.accent,stroke:{color:C.surface,width:4}});
  t.anchor.set(0.5);t.visible=false;tags.addChild(t);pool.push(t);
}
function layout(w,h){
  W=Math.max(1,w);H=Math.max(1,h);
  bg.clear().rect(0,0,W,H).fill(C.surface);
  cs=Math.max(5,Math.round(9/Math.sqrt(Math.max(0.2,p.density)*s.quality)));
  nx=Math.ceil(W/cs)+1;ny=Math.ceil(H/cs)+1;F=new Float32Array(nx*ny);
}
function sample(T){
  const k=p.scale,ox=T*p.drift*40*s.dir;
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
    const x=i*cs,y=j*cs;
    let v=s.fbm((x-ox)*k,y*k,4)+0.35*s.noise3(x*k*0.5,y*k*0.5,T*0.05);
    if(hill>0.01){const dx=x-s.pointer.x,dy=y-s.pointer.y;v+=0.55*hill*Math.exp(-(dx*dx+dy*dy)/9000);}
    F[j*nx+i]=v;
  }
}
function edge(e,x,y,a,b,c,d,iso,out){
  if(e==='t'){out[0]=x+cs*(iso-a)/(b-a);out[1]=y;}
  else if(e==='r'){out[0]=x+cs;out[1]=y+cs*(iso-b)/(c-b);}
  else if(e==='b'){out[0]=x+cs*(iso-d)/(c-d);out[1]=y+cs;}
  else{out[0]=x;out[1]=y+cs*(iso-a)/(d-a);}
}
function contour(){
  g.clear();
  let lo=Infinity,hi=-Infinity;
  for(const v of F){if(v<lo)lo=v;if(v>hi)hi=v;}
  const L=Math.max(2,Math.round(p.levels)),gap=(hi-lo)/(L+1),P=[0,0],Q=[0,0],marks=[];
  for(let l=1;l<=L;l++){
    const iso=lo+l*gap,major=l%5===0;
    let mark=null;
    for(let j=0;j<ny-1;j++)for(let i=0;i<nx-1;i++){
      const o=j*nx+i,a=F[o],b=F[o+1],c=F[o+nx+1],d=F[o+nx];
      const k=(a>iso?8:0)|(b>iso?4:0)|(c>iso?2:0)|(d>iso?1:0);
      if(k===0||k===15)continue;
      const sg=SEG[k],x=i*cs,y=j*cs;
      for(let e=0;e<sg.length;e+=2){
        edge(sg[e],x,y,a,b,c,d,iso,P);edge(sg[e+1],x,y,a,b,c,d,iso,Q);
        g.moveTo(P[0],P[1]).lineTo(Q[0],Q[1]);
        if(major&&!mark&&i>nx*0.15&&i<nx*0.85&&j>ny*0.15&&j<ny*0.85&&(i*7+j*13+l*5)%23===0)mark=[P[0],P[1],l];
      }
    }
    g.stroke({width:major?p.lineWidth*2.2:p.lineWidth,color:major?C.accent:C.muted,alpha:major?0.95:0.55});
    if(mark)marks.push(mark);
  }
  return marks;
}
function label(marks){
  for(let i=0;i<pool.length;i++){
    const t=pool[i],m=marks[i];
    t.visible=!!(p.labels&&m);
    if(!t.visible)continue;
    t.text=(100+m[2]*50).toLocaleString(s.lang);
    t.x=m[0];t.y=m[1];
  }
}
layout(s.width,s.height);
s.onResize(function(w,h){layout(w,h);frame=0;});
s.tick(function(time){
  const T=s.reducedMotion?0:time.t*p.speed;
  if(!s.reducedMotion){
    hill+=((p.interactive&&s.pointer.inside?1:0)-hill)*0.08;
    if(frame++%2&&frame>2)return;
  }
  sample(T);
  const marks=contour();
  if(frame<=2||frame%30===0)label(marks);
});
s.dispose(function(){for(const t of pool)t.destroy();pool.length=0;});
`,
});
