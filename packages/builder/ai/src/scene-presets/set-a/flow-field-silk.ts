import { definePreset, range, sharedParams } from './define';

/**
 * Thousands of particles trace a seeded simplex flow field into silk threads on
 * a slowly fading render texture. The drift follows the reading direction; the
 * pointer stirs a vortex. Reduced motion draws the traced field once.
 */
export const FLOW_FIELD_SILK = definePreset({
  id: 'flow-field-silk',
  name: { en: 'Flow-field silk', ar: 'حرير حقل التدفّق' },
  description: {
    en: 'Thousands of particles follow a seeded noise field and weave silky threads that slowly fade. The pointer stirs a soft vortex.',
    ar: 'آلاف الجسيمات تتبع حقل ضجيج ثابت البذرة فتنسج خيوطاً حريرية تتلاشى ببطء، ويحرّك المؤشر دوّامة ناعمة.',
  },
  tags: ['generative', 'particles', 'calm', 'background', 'hero', 'loop'],
  libs: ['kit'],
  params: [
    ...sharedParams({ seed: 7, interactive: true }),
    range('particles', 'Particles', 'عدد الجسيمات', 2400, 500, 6000, 100, 'look'),
    range('noiseScale', 'Field scale', 'مقياس الحقل', 0.0022, 0.0005, 0.01, 0.0001, 'look'),
    range('curl', 'Curl', 'الالتواء', 0.6, 0, 1, 0.05, 'motion'),
    range('trailFade', 'Trail length', 'طول الأثر', 0.96, 0.9, 0.995, 0.005, 'look'),
    range('strokeWidth', 'Thread width', 'سماكة الخيط', 1.2, 0.5, 3, 0.1, 'look'),
  ],
  code: String.raw`
const p=ck.params({palette:'theme',seed:7,speed:1,density:1,interactive:true,particles:2400,noiseScale:0.0022,curl:0.6,trailFade:0.96,strokeWidth:1.2});
const s=await ck.scene({libs:[],seed:p.seed});
const PIXI=s.PIXI,C=s.palette,R=s.app.renderer;
const bg=new PIXI.Graphics(),view=new PIXI.Sprite(),ink=new PIXI.Graphics(),fade=new PIXI.Graphics();
fade.blendMode='erase';
s.stage.addChild(bg,view);
const cols=C.colors,N=s.count(p.particles);
let W=1,H=1,rt=null,P=[],fresh=true;

function spawn(q,anywhere){
  q.x=anywhere?s.rand(0,W):(s.dir>0?s.rand(-20,W*0.15):s.rand(W*0.85,W+20));
  q.y=s.rand(0,H);q.px=q.x;q.py=q.y;q.life=s.rand(90,320);
}
function layout(w,h){
  W=Math.max(1,w);H=Math.max(1,h);
  bg.clear().rect(0,0,W,H).fill(C.surface);
  rt=s.rt(W,H);view.texture=rt;
  P=[];
  for(let i=0;i<N;i++){const q={c:i%cols.length};spawn(q,true);P.push(q);}
  fresh=true;
}
function angle(x,y,t){
  const k=p.noiseScale;
  const n=s.noise3(x*k,y*k,t*0.06)+0.5*s.noise3(x*k*2.1+31,y*k*2.1,t*0.09+7);
  return n*Math.PI*(1.2+p.curl*2.2);
}
function move(q,t,v){
  const a=angle(q.x,q.y,t);
  let vx=(Math.cos(a)+0.45)*s.dir,vy=Math.sin(a);
  if(p.interactive&&s.pointer.inside){
    const dx=q.x-s.pointer.x,dy=q.y-s.pointer.y,d2=dx*dx+dy*dy;
    if(d2<25600){const d=Math.sqrt(d2)+1,f=(1-d2/25600)*2.4;vx+=-dy/d*f;vy+=dx/d*f;}
  }
  q.px=q.x;q.py=q.y;q.x+=vx*v;q.y+=vy*v;q.life-=1;
  if(q.life<0||q.x<-30||q.x>W+30||q.y<-30||q.y>H+30)spawn(q,false);
}
// The still frame (and the first frame): every particle traced as a polyline.
function trace(steps,alpha){
  ink.clear();
  for(let c=0;c<cols.length;c++){
    for(const q of P){
      if(q.c!==c)continue;
      let x=q.x,y=q.y;ink.moveTo(x,y);
      for(let i=0;i<steps;i++){
        const a=angle(x,y,0);x+=(Math.cos(a)+0.45)*s.dir*2.2;y+=Math.sin(a)*2.2;ink.lineTo(x,y);
      }
    }
    ink.stroke({width:p.strokeWidth*0.8,color:cols[c],alpha:alpha,cap:'round',join:'round'});
  }
  R.render({container:ink,target:rt,clear:true});
}

layout(s.width,s.height);
s.onResize(layout);
s.tick(function(time){
  if(fresh){fresh=false;trace(s.reducedMotion?64:28,s.reducedMotion?0.42:0.3);}
  if(s.reducedMotion)return;
  const v=1.6*p.speed*Math.min(time.dt,0.05)*60;
  if(v<=0)return;
  fade.clear().rect(0,0,W,H).fill({color:0x000000,alpha:1-p.trailFade});
  R.render({container:fade,target:rt,clear:false});
  ink.clear();
  for(const q of P)move(q,time.t*p.speed,v);
  for(let c=0;c<cols.length;c++){
    for(const q of P){if(q.c===c)ink.moveTo(q.px,q.py).lineTo(q.x,q.y);}
    ink.stroke({width:p.strokeWidth,color:cols[c],alpha:0.55,cap:'round'});
  }
  R.render({container:ink,target:rt,clear:false});
});
s.dispose(function(){ink.destroy();fade.destroy();});
`,
});
