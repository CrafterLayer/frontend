import { defineMuralE, range, select, sharedParams } from './define';

/**
 * Gradient waves: stacked wave bands whose crests are splines through a few moving points
 * (`s.lib.geom.spline`, d3-shape), filled from the page's surface to its accent along an OKLCH
 * ramp (`s.lib.color`) — perceptually even steps, no muddy midpoints — each with a lighter or
 * darker crest line. The waves travel in the reading direction.
 */
export const GRADIENT_WAVES = defineMuralE({
  id: 'gradient-waves',
  name: { en: 'Gradient waves', ar: 'أمواج متدرّجة' },
  description: {
    en: 'Layered waves that roll in the reading direction, shading evenly from your background to your accent in perceptual OKLCH steps.',
    ar: 'أمواج متراكبة تتدحرج باتجاه القراءة، تتدرّج بانتظام من خلفيتك إلى لونك المميّز بخطوات OKLCH إدراكية.',
  },
  tags: ['generative', 'calm', 'background', 'hero'],
  libs: ['kit', 'geom', 'color'],
  params: [
    ...sharedParams({ seed: 12 }),
    range('bands', 'Bands', 'عدد الأمواج', 9, 3, 16, 1, 'look'),
    range('amplitude', 'Height', 'الارتفاع', 60, 10, 140, 2, 'look'),
    select('curve', 'Curve', 'المنحنى', 'natural', [
      ['natural', 'Natural', 'طبيعي'],
      ['catmull', 'Through points', 'عبر النقاط'],
      ['basis', 'Soft', 'ناعم'],
      ['step', 'Steps', 'درجات'],
    ]),
  ],
  code: String.raw`
const p=ck.params({palette:'theme',seed:12,speed:1,density:1,bands:9,amplitude:60,curve:'natural'});
const s=await ck.scene({libs:['geom','color'],seed:p.seed,design:{width:1280,height:720,fit:'cover'}});
const P=s.PIXI,C=s.palette,G=s.lib.geom,Co=s.lib.color,W=1280,H=720;
const N=Math.max(3,Math.min(16,Math.round(p.bands)));
const fills=Co.ramp([C.surface,C.colors[4],C.accent,C.colors[1]],N+1,{space:'oklch'});
const bg=new P.Graphics().rect(-20,-20,W+40,H+40).fill(fills[0]);
const g=new P.Graphics();
s.world.addChild(bg,g);
const K=Math.round(5+4*Math.max(0.2,Math.min(2,p.density)));
const waves=Array.from({length:N},(_,i)=>({
  base:H*(0.08+0.86*(i+0.5)/N),k:s.rand(0.7,1.5),phase:s.rand(0,6),c:fills[i+1],
  edge:Co.adjust(fills[i+1],{l:C.dark?0.1:-0.08}),
}));
s.tick(function(time){
  const T=s.reducedMotion?0:time.t*p.speed;
  g.clear();
  for(const w of waves){
    const pts=[];
    for(let j=0;j<=K;j++){
      const swell=0.55+0.45*s.noise2(j*0.35,w.base*0.01+T*0.04);
      pts.push(-40+(W+80)*j/K,w.base+Math.sin(j*w.k+w.phase-T*0.6*s.dir)*p.amplitude*swell);
    }
    const crest=G.spline(pts,{curve:p.curve,steps:10});
    g.poly([...crest,W+40,H+40,-40,H+40]).fill(w.c);
    g.poly(crest,false).stroke({width:2,color:w.edge,alpha:0.55});
  }
});
`,
});
