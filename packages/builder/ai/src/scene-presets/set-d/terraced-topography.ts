import { defineMural, range, sharedParams, toggle } from './define';

/**
 * Terraced topography: a warped fbm field (`s.lib.noise`) cut into filled elevation bands and
 * isolines (`s.lib.geom.bands` / `lines`, d3-contour), coloured from the surface up to the accent,
 * with an index line every fourth level. The land drifts in the reading direction.
 */
export const TERRACED_TOPOGRAPHY = defineMural({
  id: 'terraced-topography',
  name: { en: 'Terraced topography', ar: 'تضاريس متدرّجة' },
  description: {
    en: 'An imaginary terrain as filled, terraced elevation bands with contour lines, in your palette, drifting slowly in the reading direction.',
    ar: 'تضاريس متخيَّلة على هيئة مدرّجات ارتفاع ملوّنة بخطوط كنتور وبألوانك، تنجرف ببطء باتجاه القراءة.',
  },
  tags: ['generative', 'calm', 'background', 'map'],
  libs: ['kit', 'noise', 'geom', 'viewport'],
  params: [
    ...sharedParams({ seed: 41 }),
    range('levels', 'Levels', 'عدد المستويات', 9, 3, 16, 1, 'look'),
    range('scale', 'Terrain scale', 'مقياس التضاريس', 420, 160, 900, 10, 'look'),
    range('drift', 'Drift', 'الانجراف', 0.5, 0, 2, 0.05, 'motion'),
    toggle('lines', 'Contour lines', 'خطوط الكنتور', true, 'look'),
  ],
  code: String.raw`
const p=ck.params({palette:'theme',seed:41,speed:1,density:1,levels:9,scale:420,drift:0.5,lines:true});
const s=await ck.scene({libs:['noise','geom','viewport'],seed:p.seed,design:{width:1280,height:720,fit:'cover',zoom:true}});
const P=s.PIXI,C=s.palette,G=s.lib.geom,W=1280,H=720;
const n=s.lib.noise.create(s,{fractal:'fbm',octaves:4,scale:p.scale,warp:p.scale*0.2});
const L=Math.max(3,Math.round(p.levels)),cell=Math.max(8,Math.round(16/Math.sqrt(Math.max(0.2,p.density)*s.quality)));
const low=C.mix(C.surface,C.colors[4],0.3),high=C.mix(C.accent,C.colors[1],0.5);
const fills=new P.Graphics(),ink=new P.Graphics();
s.world.addChild(fills,ink);
let last=-1;
function draw(T){
  // Sample a window that slides against the reading direction, then draw it at 0..W.
  const grid={...n.grid({width:W,height:H,cell,x:-T*p.drift*36*s.dir,t:T*0.25}),x:0,y:0};
  const bands=G.bands(grid,L);
  fills.clear().rect(0,0,W,H).fill(low);
  for(let i=1;i<bands.length;i++)G.draw(fills,bands[i].shapes,C.mix(low,high,i/(L-1)));
  ink.clear();
  if(!p.lines)return;
  const iso=G.lines(grid,bands.slice(1).map(b=>b.value));
  for(const level of iso){
    const index=(level.index+1)%4===0;
    level.lines.forEach(path=>ink.poly(path,false));
    ink.stroke({width:index?2.2:1,color:C.text,alpha:index?0.45:0.2,join:'round'});
  }
}
s.tick(function(time){
  const T=s.reducedMotion?0:time.t*p.speed;
  if(last>=0&&T-last<(s.editor?0.4:0.09))return;
  last=T;
  draw(T);
});
`,
});
