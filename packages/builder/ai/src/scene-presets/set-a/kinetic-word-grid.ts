import { definePreset, range, select, sharedParams, text } from './define';

/**
 * Kinetic typography on a grid of WORDS. The phrase is split by `s.words`
 * (never per letter, so Arabic keeps its joins); each word is one `s.text`
 * object (HTMLText when it is Arabic). A wave, a highlight cascade or a noise
 * scatter runs through the grid in reading order (columns mirror in RTL); the
 * pointer lifts the words it passes.
 */
export const KINETIC_WORD_GRID = definePreset({
  id: 'kinetic-word-grid',
  name: { en: 'Kinetic word grid', ar: 'شبكة الكلمات المتحرّكة' },
  description: {
    en: 'Your phrase fills a grid of words that wave, cascade or scatter in reading order. Whole words only, so Arabic stays beautifully joined.',
    ar: 'تملأ عبارتك شبكة من الكلمات التي تتموّج أو تتتابع أو تتبعثر باتجاه القراءة، بكلمات كاملة فيبقى الخطّ العربي متّصلاً جميلاً.',
  },
  tags: ['text', 'arabic', 'bold', 'interactive', 'hero'],
  libs: ['kit'],
  params: [
    ...sharedParams({ seed: 19, interactive: true }),
    text('text', 'Phrase (empty: by page language)', 'العبارة (فارغة: حسب لغة الصفحة)', '', 'look'),
    range('columns', 'Columns', 'عدد الأعمدة', 4, 2, 8, 1, 'look'),
    range('wave', 'Motion amount', 'مقدار الحركة', 0.6, 0, 1, 0.05, 'motion'),
    range('fontScale', 'Type size', 'حجم الخط', 1, 0.5, 2, 0.05, 'look'),
    select(
      'mode',
      'Motion',
      'نوع الحركة',
      'wave',
      [
        ['wave', 'Wave', 'موجة'],
        ['cascade', 'Cascade', 'تتابع'],
        ['scatter', 'Scatter', 'تبعثر'],
      ],
      'motion',
    ),
  ],
  code: String.raw`
const p=ck.params({palette:'theme',seed:19,speed:1,density:1,interactive:true,text:'',columns:4,wave:0.6,fontScale:1,mode:'wave'});
const s=await ck.scene({libs:[],seed:p.seed});
const PIXI=s.PIXI,C=s.palette;
const arabic=s.rtl||/^ar/.test(s.lang);
const phrase=String(p.text||'').trim()||(arabic?'نصمّم الحركة بالضوء واللون والكلمة':'Design moves with light colour and words');
const words=s.words(phrase).filter(function(w){return w.length>0;});
if(!words.length)words.push(arabic?'كلمة':'word');
const bg=new PIXI.Graphics(),grid=new PIXI.Container();
s.stage.addChild(bg,grid);
const base=C.text,hi=[C.colors[0],C.colors[1],C.colors[4]];
let W=1,H=1,cells=[],rh=40,cw=100;

function layout(w,h){
  W=Math.max(1,w);H=Math.max(1,h);
  bg.clear().rect(0,0,W,H).fill(C.surface);
  grid.removeChildren().forEach(function(c){c.destroy();});
  const cols=Math.max(1,Math.round(p.columns*(W<560?0.5:1)));
  cw=W/cols;
  const fs=Math.max(14,Math.min(cw*0.2,72))*p.fontScale;
  rh=fs*1.9;
  const rows=Math.max(1,Math.floor(H/rh)),cap=arabic?64:160;
  cells=[];
  for(let i=0;i<cols*rows&&i<cap;i++){
    const c=i%cols,r=Math.floor(i/cols);
    const t=s.text(words[i%words.length],{fontFamily:arabic?'"Noto Kufi Arabic", Tahoma, sans-serif':'Inter, system-ui, sans-serif',fontSize:fs,fontWeight:'800',fill:0xffffff});
    t.anchor.set(0.5);
    const fit=Math.min(1,cw*0.86/Math.max(1,t.width));
    const x=(s.dir>0?c:cols-1-c)*cw+cw/2,y=r*rh+rh/2+(H-rows*rh)/2;
    t.x=x;t.y=y;t.tint=base;t.scale.set(fit);
    grid.addChild(t);
    cells.push({t:t,x:x,y:y,i:i,c:c,r:r,fit:fit,ph:s.rand(0,6.28),lift:0});
  }
}
function smooth(a,b,x){const k=Math.max(0,Math.min(1,(x-a)/(b-a)));return k*k*(3-2*k);}
layout(s.width,s.height);
s.onResize(layout);
s.tick(function(time){
  const T=s.reducedMotion?0:time.t*p.speed,A=p.wave,n=cells.length;
  const on=p.interactive&&s.pointer.inside&&!s.reducedMotion;
  for(const q of cells){
    let v=0,dx=0,dy=0,rot=0,alpha=1;
    if(p.mode==='cascade'){
      const d=q.i-((T*6)%(n+8));
      v=Math.exp(-d*d/6);
    }else if(p.mode==='scatter'){
      dx=s.noise2(q.i*0.37,T*0.25)*cw*0.22*A*s.dir;dy=s.noise2(q.i*0.37+40,T*0.25)*rh*0.35*A;
      rot=s.noise2(q.i*0.21,T*0.2+9)*0.18*A;alpha=0.55+0.45*(0.5+0.5*s.noise2(q.i,T*0.3));
      v=Math.max(0,s.noise2(q.i*0.5,T*0.4));
    }else{
      v=0.5+0.5*Math.sin(T*2-(q.c*0.9+q.r*0.6));
      dy=-(v-0.5)*A*rh*0.24;
    }
    let target=0;
    if(on){const ex=q.x-s.pointer.x,ey=q.y-s.pointer.y,d2=ex*ex+ey*ey;if(d2<22500)target=1-d2/22500;}
    q.lift+=(target-q.lift)*0.15;
    const glow=Math.max(smooth(0.6,1,v)*A,q.lift);
    q.t.x=q.x+dx;q.t.y=q.y+dy-q.lift*rh*0.15;
    q.t.rotation=rot;q.t.alpha=s.reducedMotion?1:alpha;
    q.t.scale.set(q.fit*(1+0.18*A*v+0.3*q.lift));
    q.t.tint=C.mix(base,hi[q.i%hi.length],glow);
  }
});
s.dispose(function(){cells=[];});
`,
});
