import { definePreset, range, select, sharedParams } from './define';

/**
 * Greedy circle packing on poisson-disk seeds: every circle grows until it
 * touches its neighbours, the field blooms open from the inline-start edge, then
 * breathes. Circles swell under the pointer.
 */
export const CIRCLE_PACKING_BLOOM = definePreset({
  id: 'circle-packing-bloom',
  name: { en: 'Circle packing bloom', ar: 'تفتّح الدوائر المتراصّة' },
  description: {
    en: 'Hundreds of circles packed edge to edge bloom open in reading order, then breathe. Solid, ring or dot styles; they swell under the pointer.',
    ar: 'مئات الدوائر المتراصّة حافةً بحافة تتفتّح باتجاه القراءة ثم تتنفّس، بأسلوب مصمت أو حلقي أو نقطي، وتنتفخ تحت المؤشر.',
  },
  tags: ['generative', 'geometric', 'interactive', 'bold', 'hero'],
  libs: ['kit', 'viewport'],
  params: [
    ...sharedParams({ seed: 5, interactive: true }),
    range('minR', 'Smallest radius', 'أصغر نصف قطر', 4, 2, 20, 1, 'look'),
    range('maxR', 'Largest radius', 'أكبر نصف قطر', 64, 16, 160, 1, 'look'),
    range('gap', 'Gap', 'الفراغ', 3, 0, 12, 0.5, 'look'),
    range('breathe', 'Breathing', 'التنفّس', 0.5, 0, 1, 0.05, 'motion'),
    select(
      'fillStyle',
      'Style',
      'الأسلوب',
      'solid',
      [
        ['solid', 'Solid', 'مصمت'],
        ['ring', 'Ring', 'حلقة'],
        ['dot', 'Dot', 'نقطة'],
      ],
      'look',
    ),
  ],
  code: String.raw`
const p=ck.params({palette:'theme',seed:5,speed:1,density:1,interactive:true,minR:4,maxR:64,gap:3,breathe:0.5,fillStyle:'solid'});
const s=await ck.scene({libs:['viewport'],seed:p.seed,design:{width:1280,height:720,fit:'cover',zoom:true}});
const PIXI=s.PIXI,C=s.palette;
const bg=new PIXI.Graphics(),g=new PIXI.Graphics();
s.world.addChild(bg,g);
const tones=[C.colors[4],C.colors[0],C.colors[1],C.muted,C.text];
let W=1,H=1,cs=[],maxD=1;

function pack(w,h){
  W=Math.max(1,w);H=Math.max(1,h);
  bg.clear().rect(0,0,W,H).fill(C.surface);
  const lo=Math.max(1.5,p.minR),hi=Math.max(lo+1,p.maxR),gap=Math.max(0,p.gap),cell=hi*2+gap;
  const grid=new Map(),key=function(i,j){return i*4096+j;};
  const pts=s.shuffle(s.poisson(W,H,Math.max(lo*2.4,9),s.count(1600)));
  cs=[];
  for(const q of pts){
    const x=q[0],y=q[1],gi=Math.floor(x/cell)+2,gj=Math.floor(y/cell)+2;
    let r=hi;
    for(let a=-1;a<=1&&r>=lo;a++)for(let b=-1;b<=1;b++){
      const bucket=grid.get(key(gi+a,gj+b));
      if(!bucket)continue;
      for(const o of bucket){r=Math.min(r,Math.hypot(x-o.x,y-o.y)-o.r-gap);}
    }
    if(r<lo)continue;
    const c={x:x,y:y,r:r,ph:s.rand(0,6.28),h:1,col:0};
    c.col=Math.min(tones.length-1,Math.floor((1-(r-lo)/(hi-lo))*tones.length*0.999));
    cs.push(c);
    const k=key(gi,gj);
    if(!grid.has(k))grid.set(k,[]);
    grid.get(k).push(c);
  }
  const ox=s.dir>0?0:W;
  maxD=1;
  for(const c of cs){c.d=Math.hypot(c.x-ox,(c.y-H/2)*0.6);maxD=Math.max(maxD,c.d);}
}
function ease(k){const c=1.70158;k-=1;return 1+k*k*((c+1)*k+c);}
pack(1280,720);
s.tick(function(time){
  const T=s.reducedMotion?60:time.t*p.speed;
  const on=p.interactive&&s.pointer.inside&&!s.reducedMotion;
  g.clear();
  for(let t=0;t<tones.length;t++){
    let any=false;
    for(const c of cs){
      if(c.col!==t)continue;
      const k=Math.max(0,Math.min(1,(T-c.d/maxD*2.2)/0.9));
      if(k<=0)continue;
      let target=1;
      if(on){const d=Math.hypot(c.x-s.pointer.x,c.y-s.pointer.y);if(d<140)target=1+0.25*(1-d/140);}
      c.h+=(target-c.h)*0.15;
      const r=c.r*ease(k)*c.h*(1+p.breathe*0.07*Math.sin(T*1.3+c.ph));
      if(r<=0.2)continue;
      any=true;
      if(p.fillStyle==='ring')g.circle(c.x,c.y,r*0.88);
      else if(p.fillStyle==='dot')g.circle(c.x,c.y,r*0.38);
      else g.circle(c.x,c.y,r);
    }
    if(!any)continue;
    if(p.fillStyle==='ring')g.stroke({width:2,color:tones[t],alpha:0.9});
    else g.fill(tones[t]);
    if(p.fillStyle==='dot'){
      for(const c of cs){if(c.col===t&&T>c.d/maxD*2.2)g.circle(c.x,c.y,c.r*c.h);}
      g.fill({color:tones[t],alpha:0.16});
    }
  }
});
s.dispose(function(){cs=[];});
`,
});
