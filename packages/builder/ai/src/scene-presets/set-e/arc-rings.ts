import { defineMuralE, range, sharedParams, toggle } from './define';

/**
 * Arc rings: concentric rings cut into seeded sectors (`s.lib.geom.pie` spans drawn as rounded
 * `s.lib.geom.arc` ring sectors, d3-shape) in an OKLCH ramp toward the accent with lighter
 * accent shades (`s.lib.color`), each ring turning at its own pace, the next the other way, and
 * three spline orbits (`s.lib.geom.spline`, closed) circling them. Turning follows the reading
 * direction.
 */
export const ARC_RINGS = defineMuralE({
  id: 'arc-rings',
  name: { en: 'Arc rings', ar: 'حلقات الأقواس' },
  description: {
    en: 'Concentric rings of rounded arcs in your palette, turning slowly in alternate directions inside drifting orbits, like an astrolabe.',
    ar: 'حلقات متّحدة المركز من أقواس مستديرة بألوانك، تدور ببطء في اتجاهات متعاكسة داخل مدارات منسابة، كأنها أسطرلاب.',
  },
  tags: ['geometric', 'calm', 'background', 'hero'],
  libs: ['kit', 'geom', 'color'],
  params: [
    ...sharedParams({ seed: 33 }),
    range('rings', 'Rings', 'عدد الحلقات', 7, 3, 12, 1, 'look'),
    range('gap', 'Gap', 'الفاصل', 0.04, 0, 0.2, 0.01, 'look'),
    toggle('orbits', 'Orbits', 'المدارات', true, 'look'),
  ],
  code: String.raw`
const p=ck.params({palette:'theme',seed:33,speed:1,density:1,rings:7,gap:0.04,orbits:true});
const s=await ck.scene({libs:['geom','color'],seed:p.seed,design:{width:1280,height:720,fit:'cover'}});
const P=s.PIXI,C=s.palette,G=s.lib.geom,Co=s.lib.color,W=1280,H=720,cx=W/2,cy=H/2;
const R=Math.max(3,Math.min(12,Math.round(p.rings))),band=300/R;
const tones=Co.ramp(Co.mix(C.surface,C.accent,0.3),C.accent,R,{space:'oklch'});
const glints=Co.shades(C.colors[1],4,{light:C.dark?0.92:0.75,dark:C.dark?0.55:0.4});
const bg=new P.Graphics().rect(-20,-20,W+40,H+40).fill(C.surface);
const orbit=new P.Graphics();
s.world.addChild(bg,orbit);
orbit.pivot.set(cx,cy);
orbit.position.set(cx,cy);
if(p.orbits)for(let o=0;o<3;o++){
  const pts=[];
  for(let k=0;k<9;k++){
    const a=k/9*Math.PI*2,rr=380+o*70+s.rand(-40,40);
    pts.push(cx+Math.cos(a)*rr*1.25,cy+Math.sin(a)*rr*0.6);
  }
  orbit.poly(G.spline(pts,{curve:'catmull',closed:true,steps:12}),true).stroke({width:1.5,color:C.text,alpha:0.16+o*0.05});
}
const rings=[];
for(let i=0;i<R;i++){
  const inner=48+i*band,outer=inner+band-6,c=new P.Container(),g=new P.Graphics();
  const count=s.int(3,4+Math.round(i*Math.max(0.2,p.density)));
  const spans=G.pie(Array.from({length:count},()=>s.rand(0.4,1.6)),{pad:p.gap,dir:s.dir});
  spans.forEach((span,k)=>{
    if(s.random()<0.16)return;
    g.poly(G.arc({cx:0,cy:0,inner,outer,start:span.start,end:span.end,pad:span.pad,corner:4})).fill(k%3===0?glints[i%4]:tones[i]);
  });
  c.position.set(cx,cy);
  c.addChild(g);
  s.world.addChild(c);
  rings.push({c,turn:(i%2?1:-1)*s.rand(0.04,0.1)*(1.4-i/R)});
}
s.world.addChild(new P.Graphics().poly(G.arc({cx,cy,outer:30})).fill(C.accent));
s.tick(function(time){
  const T=s.reducedMotion?0:time.t*p.speed;
  for(const r of rings)r.c.rotation=T*r.turn*s.dir;
  orbit.rotation=T*0.015*s.dir;
});
`,
});
