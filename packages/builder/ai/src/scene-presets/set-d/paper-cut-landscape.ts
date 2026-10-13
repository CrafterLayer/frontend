import { defineMural, range, sharedParams, toggle } from './define';

/**
 * A layered cut-paper landscape: ridged-noise hills (`s.lib.noise`), smoothed into soft paper
 * edges (`s.lib.geom.smooth`), each casting a shadow on the layer behind, under a paper sky with
 * the sun cut out of it (`s.lib.geom.difference`). Near layers drift faster than far ones, toward
 * the reading direction; the sun sits on the inline-end side.
 */
export const PAPER_CUT_LANDSCAPE = defineMural({
  id: 'paper-cut-landscape',
  name: { en: 'Paper-cut landscape', ar: 'منظر من الورق المقصوص' },
  description: {
    en: 'Layered paper hills with soft shadows under a paper sky with the sun cut out of it, in your palette; the layers drift at their own depth.',
    ar: 'تلال من طبقات ورقية بظلال ناعمة تحت سماء ورقية قُصّت منها الشمس، بألوانك؛ تنجرف كل طبقة بحسب عمقها.',
  },
  tags: ['illustration', 'calm', 'hero', 'landscape'],
  libs: ['kit', 'noise', 'geom'],
  params: [
    ...sharedParams({ seed: 52 }),
    range('layers', 'Layers', 'عدد الطبقات', 5, 3, 8, 1, 'look'),
    range('relief', 'Relief', 'الارتفاع', 1, 0.3, 2, 0.05, 'look'),
    toggle('sun', 'Sun cut-out', 'الشمس المقصوصة', true, 'look'),
  ],
  code: String.raw`
const p=ck.params({palette:'theme',seed:52,speed:1,density:1,layers:5,relief:1,sun:true});
const s=await ck.scene({libs:['noise','geom'],seed:p.seed,design:{width:1280,height:720,fit:'cover'}});
const P=s.PIXI,C=s.palette,G=s.lib.geom,W=1280,H=720,N=Math.max(3,Math.min(8,Math.round(p.layers)));
const n=s.lib.noise.create(s,{fractal:'ridged',octaves:3,scale:460});
const sky=new P.Graphics();
s.world.addChild(sky);
const glow=C.mix(C.surface,C.colors[1],0.6),paper=C.mix(C.surface,C.colors[4],0.18),shade=C.dark?C.surface:C.text;
const sheet=[-20,-20,W+20,-20,W+20,H+20,-20,H+20],sun=[];
for(let i=0;i<64;i++){const a=i/64*Math.PI*2;sun.push(W*(s.dir>0?0.74:0.26)+Math.cos(a)*72,H*0.2+Math.sin(a)*72);}
sky.rect(-20,-20,W+40,H+40).fill(glow);
G.draw(sky,p.sun?G.difference(sheet,sun):sheet,paper);
const layers=[];
for(let i=0;i<N;i++){
  const k=i/(N-1),shadow=new P.Graphics(),hill=new P.Graphics();
  shadow.alpha=0.22;
  s.world.addChild(shadow,hill);
  layers.push({shadow,hill,k,top:H*(0.36+0.38*k),color:C.mix(C.mix(C.colors[1],C.surface,0.45),C.colors[4],k)});
}
const step=Math.round(40/Math.max(0.5,Math.min(2,p.density)));
function ridge(layer,T){
  const off=T*(8+46*layer.k)*s.dir,pts=[];
  for(let x=-60;x<=W+60;x+=step){
    const h=n.at(x-off,layer.k*900+130)*0.5+0.5;
    pts.push(x,layer.top-h*H*0.22*p.relief*(1.2-layer.k*0.6));
  }
  return G.smooth(pts,{iterations:2}).concat([W+60,H+40,-60,H+40]);
}
s.tick(function(time){
  const T=s.reducedMotion?0:time.t*p.speed;
  for(const layer of layers){
    const outline=ridge(layer,T);
    layer.shadow.clear().poly(outline.map((v,i)=>i%2?v-8:v+5*s.dir)).fill(shade);
    layer.hill.clear().poly(outline).fill(layer.color);
  }
});
`,
});
