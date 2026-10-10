import { definePreset, range, select, sharedParams, text } from './define';

/**
 * Calligraphy ink reveal. The phrase is ONE text object (HTMLText for Arabic,
 * so the letters keep their joins and shaping: it is never split per letter),
 * revealed by perfect-freehand brush strokes that wipe across it in the
 * reading direction, with a blurred ink bleed. A calligraphic swash (an SVG
 * path you can replace) is then traced with a pressure brush, and rhombic
 * nuqta dots from `s.svg` close it. Click to write it again.
 */
export const CALLIGRAPHY_INK_REVEAL = definePreset({
  id: 'calligraphy-ink-reveal',
  name: { en: 'Calligraphy ink reveal', ar: 'ظهور الخطّ بالحبر' },
  description: {
    en: 'Your phrase appears under a wet ink brush in the reading direction, then a calligraphic swash is drawn beneath it and sealed with rhombic dots.',
    ar: 'تظهر عبارتك تحت فرشاة حبرٍ رطبة باتجاه القراءة، ثم تُخطّ تحتها مدّة خطّية وتُختم بنقاط معيّنة كنقاط الخطّاطين.',
  },
  tags: ['arabic', 'text', 'hero', 'calm'],
  libs: ['kit', 'brush'],
  params: [
    ...sharedParams({ seed: 2, interactive: true }),
    text('text', 'Phrase (empty: by page language)', 'العبارة (فارغة: حسب لغة الصفحة)', '', 'look'),
    text(
      'path',
      'Swash SVG path (M/L/C/Q, 1000×300 box)',
      'مسار المدّة SVG (M/L/C/Q ضمن 1000×300)',
      'M20 190 C180 250 380 250 540 205 C690 165 820 140 900 175 C950 196 930 236 880 228',
      'look',
    ),
    range('strokeDuration', 'Writing time (s)', 'زمن الكتابة (ث)', 4, 1, 12, 0.5, 'motion'),
    range('bleed', 'Ink bleed', 'انتشار الحبر', 0.4, 0, 1, 0.05, 'look'),
    select(
      'ink',
      'Ink',
      'الحبر',
      'text',
      [
        ['text', 'Text colour', 'لون النص'],
        ['accent', 'Accent colour', 'اللون المميّز'],
      ],
      'look',
    ),
    range('size', 'Size', 'الحجم', 1, 0.5, 2, 0.05, 'look'),
  ],
  code: String.raw`
const p=ck.params({palette:'theme',seed:2,speed:1,density:1,interactive:true,text:'',path:'M20 190 C180 250 380 250 540 205 C690 165 820 140 900 175 C950 196 930 236 880 228',strokeDuration:4,bleed:0.4,ink:'text',size:1});
const s=await ck.scene({libs:['brush'],seed:p.seed});
const PIXI=s.PIXI,C=s.palette,B=s.lib.brush;
const arabic=s.rtl||/^ar/.test(s.lang);
const phrase=String(p.text||'').trim()||(arabic?'جمالُ الخطّ نور':'Ink becomes light');
const ink=p.ink==='accent'?C.accent:C.text,hex='#'+ink.toString(16).padStart(6,'0');
const bg=new PIXI.Graphics(),wrap=new PIXI.Container(),mask=new PIXI.Graphics(),bleedG=new PIXI.Graphics(),brushG=new PIXI.Graphics();
const style={fontFamily:arabic?'Amiri, "Noto Naskh Arabic", "Times New Roman", serif':'Georgia, "Times New Roman", serif',fontSize:120,fontWeight:'700',fill:ink};
const word=s.text(phrase,style),halo=s.text(phrase,style);
word.anchor.set(0.5);halo.anchor.set(0.5);
const blurA=new PIXI.BlurFilter({strength:5}),blurB=new PIXI.BlurFilter({strength:7});
halo.filters=[blurA];bleedG.filters=[blurB];
wrap.addChild(halo,word);wrap.mask=mask;
s.stage.addChild(bg,wrap,mask,bleedG,brushG);
const dots=[];
for(let i=0;i<3;i++){
  const d=s.svg('<svg viewBox="-10 -10 20 20"><path d="M0 -10 L8 0 L0 10 L-8 0 Z" fill="'+hex+'"/></svg>');
  s.stage.addChild(d);dots.push(d);
}
// The swash: absolute M/L/C/Q commands sampled into points.
function parse(d){
  const t=String(d).match(/[MLCQZ]|-?\d*\.?\d+/g)||[],pts=[];
  let i=0,cmd='M',x=0,y=0;
  function n(){return +t[i++];}
  while(i<t.length){
    if(/[MLCQZ]/.test(t[i])){cmd=t[i++];if(cmd==='Z')continue;}
    if(cmd==='M'||cmd==='L'){x=n();y=n();pts.push([x,y]);}
    else if(cmd==='C'){const a=n(),b=n(),c=n(),e=n(),f=n(),g=n();for(let k=1;k<=24;k++){const u=k/24,v=1-u;pts.push([v*v*v*x+3*v*v*u*a+3*v*u*u*c+u*u*u*f,v*v*v*y+3*v*v*u*b+3*v*u*u*e+u*u*u*g]);}x=f;y=g;}
    else if(cmd==='Q'){const a=n(),b=n(),c=n(),e=n();for(let k=1;k<=16;k++){const u=k/16,v=1-u;pts.push([v*v*x+2*v*u*a+u*u*c,v*v*y+2*v*u*b+u*u*e]);}x=c;y=e;}
    else i++;
  }
  return pts.filter(function(q){return isFinite(q[0])&&isFinite(q[1]);});
}
const swash=parse(p.path);
let W=1,H=1,k=1,ox=0,oy=0,fs=1,t0=0,box=null,rows=[];

function layout(w,h){
  W=Math.max(1,w);H=Math.max(1,h);
  bg.clear().rect(0,0,W,H).fill(C.surface);
  word.scale.set(1);
  fs=Math.min(W*0.82/Math.max(1,word.width),H*0.3/Math.max(1,word.height))*p.size;
  word.scale.set(fs);halo.scale.set(fs*1.02);
  word.x=halo.x=W/2;word.y=halo.y=H*0.4;
  box={x:W/2-word.width/2-10,y:H*0.4-word.height/2-6,w:word.width+20,h:word.height+12};
  k=Math.min(W*0.86/1000,H*0.5/300);ox=(W-1000*k)/2;oy=H*0.4+word.height*0.35-180*k;
  rows=[];
  const n=4;
  for(let r=0;r<n;r++){
    const y=box.y+box.h*(r+0.5)/n,line=[];
    for(let i=0;i<=20;i++){const u=i/20,x=s.dir>0?box.x+box.w*u:box.x+box.w*(1-u);line.push([x,y+Math.sin(u*9+r)*box.h*0.06]);}
    rows.push(line);
  }
}
function at(q){return [ox+(s.dir>0?q[0]:1000-q[0])*k,oy+q[1]*k];}
function stroke(G,pts,size,u){
  if(pts.length<2)return;
  const outline=B.getStroke(pts,{size:size,thinning:0.68,smoothing:0.55,streamline:0.4,simulatePressure:false,start:{taper:size*1.5},end:{taper:u<1?0:size*3}});
  if(outline.length>2)G.poly(outline.flat());
}
function draw(T){
  const dur=p.strokeDuration/Math.max(0.05,p.speed),r1=Math.max(0,Math.min(1,T/(dur*0.6))),r2=Math.max(0,Math.min(1,(T-dur*0.35)/(dur*0.65)));
  mask.clear();
  const per=1/rows.length;
  for(let r=0;r<rows.length;r++){
    const u=Math.max(0,Math.min(1,(r1-r*per)/per));
    if(u<=0)break;
    stroke(mask,rows[r].slice(0,Math.max(2,Math.ceil(rows[r].length*u))),box.h/rows.length*2.4,1);
  }
  mask.fill(0xffffff);
  halo.alpha=p.bleed*0.6;
  brushG.clear();bleedG.clear();
  const m=Math.floor(swash.length*r2);
  if(m>1){
    const pts=[];
    for(let i=0;i<m;i++){const q=at(swash[i]),u=i/(swash.length-1);pts.push([q[0],q[1],0.3+0.7*Math.sin(Math.PI*Math.min(1,u*1.15))]);}
    stroke(brushG,pts,Math.max(6,22*k*p.size),r2);brushG.fill(ink);
    stroke(bleedG,pts,Math.max(8,30*k*p.size),r2);bleedG.fill({color:ink,alpha:p.bleed*0.5});
  }
  const end=swash.length?at(swash[swash.length-1]):[W/2,H/2];
  for(let i=0;i<dots.length;i++){
    const d=dots[i],u=Math.max(0,Math.min(1,(r2-0.85-i*0.04)/0.1));
    d.x=end[0]+s.dir*(18+i*16)*k*3;d.y=end[1]-(10+i*12)*k*3;
    d.scale.set(u*Math.max(0.6,k*1.6)*p.size);d.alpha=u;
  }
  return r1>=1&&r2>=1;
}
layout(s.width,s.height);
s.onResize(function(w,h){layout(w,h);t0=-1e4;});
s.pointer.onDown(function(){if(p.interactive&&s.pointer.inside&&!s.reducedMotion&&!s.editor)t0=-1;});
s.tick(function(time){
  if(t0===-1)t0=time.t;
  if(t0<-1)t0=time.t-1e4;
  const T=s.reducedMotion?1e4:time.t-t0;
  draw(T);
  if(!s.reducedMotion)wrap.alpha=0.94+0.06*Math.sin(time.t*1.3);
});
s.dispose(function(){wrap.mask=null;blurA.destroy();blurB.destroy();});
`,
});
