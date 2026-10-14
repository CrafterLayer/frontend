import { defineMural, range, sharedParams } from './define';

/**
 * Ebru marbling: the Ottoman art of painting on water, as many thin contour bands
 * (`s.lib.geom.bands`) of a strongly domain-warped field (`s.lib.noise` warp), the palette laid
 * down in repeating veins. The field turns in a seamless loop, so the paper keeps flowing without
 * a jump.
 */
export const EBRU_MARBLING = defineMural({
  id: 'ebru-marbling',
  name: { en: 'Ebru marbling', ar: 'رخامات الإبرو' },
  description: {
    en: 'Marbled paper in the spirit of ebru: veins of your palette combed through each other, flowing slowly in a seamless loop.',
    ar: 'ورق مُرخّم على طريقة فن الإبرو: عروق من ألوانك تتداخل كأنها مُشّطت على الماء، وتنساب ببطء في حلقة بلا انقطاع.',
  },
  tags: ['generative', 'arabic', 'calm', 'background'],
  libs: ['kit', 'noise', 'geom', 'viewport'],
  params: [
    ...sharedParams({ seed: 74 }),
    range('veins', 'Veins', 'العروق', 14, 6, 28, 1, 'look'),
    range('swirl', 'Swirl', 'الالتفاف', 220, 40, 480, 10, 'look'),
    range('scale', 'Scale', 'المقياس', 380, 160, 900, 10, 'look'),
  ],
  code: String.raw`
const p=ck.params({palette:'theme',seed:74,speed:1,density:1,veins:14,swirl:220,scale:380});
const s=await ck.scene({libs:['noise','geom','viewport'],seed:p.seed,design:{width:1280,height:720,fit:'cover',zoom:true}});
const P=s.PIXI,C=s.palette,G=s.lib.geom,W=1280,H=720;
const n=s.lib.noise.create(s,{fractal:'fbm',octaves:3,scale:p.scale,warp:p.swirl,speed:0.8});
const L=Math.max(6,Math.round(p.veins)),cell=Math.max(8,Math.round(14/Math.sqrt(Math.max(0.2,p.density)*s.quality)));
const inks=[C.surface,C.colors[0],C.mix(C.colors[1],C.surface,0.3),C.colors[3],C.colors[4]];
const paper=new P.Graphics();
s.world.addChild(paper);
let last=-1;
s.tick(function(time){
  const T=s.reducedMotion?0:time.t*p.speed;
  if(last>=0&&T-last<(s.editor?0.4:0.1))return;
  last=T;
  const phase=((T*0.02*s.dir)%1+1)%1;
  const bands=G.bands(n.grid({width:W,height:H,cell,phase}),L);
  paper.clear();
  bands.forEach((b,i)=>G.draw(paper,b.shapes,inks[i%inks.length]));
});
`,
});
