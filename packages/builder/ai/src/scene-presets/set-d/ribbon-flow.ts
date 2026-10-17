import { defineMural, range, sharedParams } from './define';

/**
 * Flowing ribbons: centre lines from a seamless noise loop (`s.lib.noise` loop), smoothed and
 * swollen into tapered bands (`s.lib.geom.smooth` / `ribbon`), each with a lighter sheen. The
 * loop comes back to its first frame, so the motion never jumps; the ribbons swell toward the
 * inline end, mirrored in RTL.
 */
export const RIBBON_FLOW = defineMural({
  id: 'ribbon-flow',
  name: { en: 'Flowing ribbons', ar: 'أشرطة منسابة' },
  description: {
    en: 'Silky ribbons in your palette that swell and sway in a seamless loop, tapering toward the reading direction.',
    ar: 'أشرطة حريرية بألوانك تنتفخ وتتمايل في حلقة متصلة بلا انقطاع، وتستدق باتجاه القراءة.',
  },
  tags: ['generative', 'calm', 'background', 'hero'],
  libs: ['kit', 'noise', 'geom', 'viewport'],
  params: [
    ...sharedParams({ seed: 85 }),
    range('ribbons', 'Ribbons', 'عدد الأشرطة', 6, 2, 12, 1, 'look'),
    range('width', 'Width', 'العرض', 70, 16, 160, 2, 'look'),
    range('wave', 'Wave', 'التموّج', 0.5, 0, 1, 0.05, 'motion'),
  ],
  code: String.raw`
const p=ck.params({palette:'theme',seed:85,speed:1,density:1,ribbons:6,width:70,wave:0.5});
const s=await ck.scene({libs:['noise','geom','viewport'],seed:p.seed,design:{width:1280,height:720,fit:'cover',zoom:true}});
const P=s.PIXI,C=s.palette,G=s.lib.geom,W=1280,H=720;
const n=s.lib.noise.create(s,{fractal:'fbm',octaves:2,scale:520});
const N=Math.max(2,Math.min(12,Math.round(p.ribbons))),colors=C.ramp(N);
const bg=new P.Graphics().rect(-20,-20,W+40,H+40).fill(C.surface);
s.world.addChild(bg);
const ribbons=[];
for(let i=0;i<N;i++){
  const body=new P.Graphics(),sheen=new P.Graphics();
  s.world.addChild(body,sheen);
  ribbons.push({body,sheen,i,base:H*(0.18+0.64*(i+0.5)/N),color:colors[i],light:C.mix(colors[i],C.dark?C.text:C.surface,0.5)});
}
const step=Math.round(48/Math.max(0.5,Math.min(2,p.density)));
s.tick(function(time){
  const phase=s.reducedMotion?0.15:(time.t*p.speed*0.035)%1;
  for(const r of ribbons){
    const pts=[];
    for(let x=-80;x<=W+80;x+=step){
      const along=s.dir>0?x:W-x;
      pts.push(along,r.base+n.loop(x,r.i*311,phase)*H*0.32*p.wave);
    }
    const line=G.smooth(pts,{iterations:2});
    const swell=t=>p.width*(0.18+0.82*Math.sin(Math.PI*Math.min(1,t*1.15)))*(0.75+0.25*n.loop(t*900,r.i*97,phase));
    r.body.clear().poly(G.ribbon(line,swell)).fill({color:r.color,alpha:0.86});
    r.sheen.clear().poly(G.ribbon(line,t=>swell(t)*0.28)).fill({color:r.light,alpha:0.5});
  }
});
`,
});
