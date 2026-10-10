import { definePreset, range, sharedParams } from './define';

/**
 * Layered MeshRope curtains with noise-driven vertices, additive blending, a
 * Kawase blur and an advanced bloom: northern lights over a ridge, under a
 * night sky that is the theme's own colours. The pointer lifts the curtains.
 */
export const AURORA_CURTAINS = definePreset({
  id: 'aurora-curtains',
  name: { en: 'Aurora curtains', ar: 'ستائر الشفق' },
  description: {
    en: 'Glowing aurora curtains ripple over a dark ridge, blended additively and bloomed. The pointer lifts the light where it passes.',
    ar: 'ستائر شفقٍ متوهّجة تتموّج فوق سلسلة جبلية داكنة بمزج ضوئي وتوهّج، ويرفع المؤشر الضوء حيث يمرّ.',
  },
  tags: ['generative', 'light', 'calm', 'background', 'hero'],
  libs: ['kit', 'filters'],
  params: [
    ...sharedParams({ seed: 23, interactive: true }),
    range('ribbons', 'Curtains', 'عدد الستائر', 6, 3, 12, 1, 'look'),
    range('amplitude', 'Wave height', 'ارتفاع الموجة', 0.6, 0, 1.5, 0.05, 'motion'),
    range('hueDrift', 'Colour drift', 'انسياب اللون', 0.4, 0, 1, 0.05, 'motion'),
    range('glow', 'Glow', 'التوهّج', 1.2, 0, 3, 0.1, 'look'),
  ],
  code: String.raw`
const p=ck.params({palette:'theme',seed:23,speed:1,density:1,interactive:true,ribbons:6,amplitude:0.6,hueDrift:0.4,glow:1.2});
const s=await ck.scene({libs:['filters'],seed:p.seed});
const PIXI=s.PIXI,C=s.palette,F=s.lib.filters,R=s.app.renderer;
const sky=new PIXI.Graphics(),stars=new PIXI.Graphics(),veil=new PIXI.Container(),ridge=new PIXI.Graphics();
s.stage.addChild(sky,stars,veil,ridge);
const blur=new F.KawaseBlurFilter({strength:3,quality:3});
const bloom=new F.AdvancedBloomFilter({threshold:0.2,bloomScale:p.glow,brightness:1.1,blur:6,quality:6});
veil.filters=[blur,bloom];
const night=C.dark?C.surface:C.mix(C.text,0x000000,0.4);
const hues=[C.colors[0],C.colors[1],C.colors[4],C.mix(C.colors[0],C.colors[1],0.5)];
let W=1,H=1,ropes=[];

// A soft vertical gradient: bright near the lower edge (v=0), fading upward.
function curtainTexture(h){
  const g=new PIXI.Graphics(),rt=s.rt(4,h);
  for(let i=0;i<h;i+=2){
    const v=i/h,a=Math.min(1,v/0.1)*Math.pow(1-v,1.8);
    g.rect(0,i,4,2).fill({color:0xffffff,alpha:Math.max(0,Math.min(1,a))});
  }
  R.render({container:g,target:rt,clear:true});
  g.destroy();
  return rt;
}
function layout(w,h){
  W=Math.max(1,w);H=Math.max(1,h);
  sky.clear();
  for(let i=0;i<24;i++)sky.rect(0,H*i/24,W,H/24+1).fill(C.mix(night,C.colors[4],0.28*i/24));
  stars.clear();
  for(const q of s.poisson(W,H*0.7,Math.max(18,46/Math.sqrt(p.density)),s.count(260)))
    stars.circle(q[0],q[1],s.rand(0.4,1.4)).fill({color:0xffffff,alpha:s.rand(0.25,0.9)});
  ridge.clear().moveTo(0,H);
  for(let x=0;x<=W+12;x+=12)ridge.lineTo(x,H*0.86-H*0.08*(0.5+0.5*s.fbm(x*0.004,3.7,4)));
  ridge.lineTo(W,H).closePath().fill(C.mix(night,0x000000,0.45));
  for(const r of ropes)r.rope.destroy();
  ropes=[];
  const tex=curtainTexture(Math.max(32,Math.round(H*0.6)));
  const n=Math.min(12,Math.max(1,Math.round(s.count(p.ribbons))));
  for(let k=0;k<n;k++){
    const pts=[];
    for(let i=0;i<48;i++)pts.push(new PIXI.Point(i*W/47,H*0.5));
    const rope=new PIXI.MeshRope({texture:tex,points:pts});
    rope.blendMode='add';
    veil.addChild(rope);
    ropes.push({rope:rope,pts:pts,base:H*(0.38+0.3*s.random()),ph:s.rand(0,100),amp:s.rand(0.6,1.2),k:k});
  }
}
layout(s.width,s.height);
s.onResize(layout);
let lift=0,lx=0;
s.tick(function(time){
  const T=s.reducedMotion?3:time.t*p.speed;
  const on=p.interactive&&s.pointer.inside&&!s.reducedMotion;
  lift+=((on?1:0)-lift)*0.06;
  if(on)lx=s.pointer.x;
  for(const r of ropes){
    for(let i=0;i<r.pts.length;i++){
      const u=i/(r.pts.length-1),x=-W*0.1+u*W*1.2;
      let y=r.base+p.amplitude*H*0.16*r.amp*s.fbm(u*2.2-T*0.05*s.dir+r.ph,r.ph+T*0.03,3);
      y-=lift*H*0.12*Math.exp(-Math.pow((x-lx)/(W*0.12),2));
      r.pts[i].x=x;r.pts[i].y=y;
    }
    r.rope.alpha=0.3+0.35*(0.5+0.5*s.noise2(r.ph,T*0.2));
    r.rope.tint=C.mix(hues[r.k%4],hues[(r.k+1)%4],0.5+0.5*Math.sin(T*p.hueDrift*0.4+r.k));
  }
  stars.alpha=0.75+0.25*Math.sin(T*0.7);
});
s.dispose(function(){veil.filters=null;blur.destroy();bloom.destroy();});
`,
});
