import { defineMuralE, range, sharedParams, toggle } from './define';

/**
 * A botanical garden: a row of seeded L-system plants (`s.lib.lsys` fern, tree and bush) fitted
 * to the ground, growing every branch at once (`upTo`) and then swaying, stroked thinner per
 * branch depth in an OKLCH ramp from the page's text tone to its accent (`s.lib.color`), with
 * buds at the branch tips. The plants lean and line up in the reading direction.
 */
export const BOTANICAL_GARDEN = defineMuralE({
  id: 'botanical-garden',
  name: { en: 'Botanical garden', ar: 'حديقة نباتية' },
  description: {
    en: 'Ferns, trees and bushes that grow branch by branch from the ground in your palette, then sway gently, leaning in the reading direction.',
    ar: 'سرخس وأشجار وشجيرات تنمو غصنًا غصنًا من الأرض بألوانك ثم تتمايل بلطف، مائلة باتجاه القراءة.',
  },
  tags: ['generative', 'nature', 'calm', 'background', 'hero'],
  libs: ['kit', 'lsys', 'color', 'viewport'],
  params: [
    ...sharedParams({ seed: 27 }),
    range('plants', 'Plants', 'عدد النباتات', 5, 2, 7, 1, 'look'),
    range('growth', 'Growth time', 'مدة النمو', 7, 2, 20, 0.5, 'motion'),
    toggle('buds', 'Buds', 'البراعم', true, 'look'),
  ],
  code: String.raw`
const p=ck.params({palette:'theme',seed:27,speed:1,density:1,plants:5,growth:7,buds:true});
const s=await ck.scene({libs:['lsys','color','viewport'],seed:p.seed,design:{width:1280,height:720,fit:'cover',zoom:true}});
const P=s.PIXI,C=s.palette,L=s.lib.lsys,Co=s.lib.color,W=1280,H=720;
const sky=Co.ramp(C.surface,Co.adjust(C.surface,{l:C.dark?0.1:-0.08}),8);
const bg=new P.Graphics();
sky.forEach((c,i)=>bg.rect(-20,-20+i*(H+40)/8,W+40,(H+40)/8+1).fill(c));
const hills=[-20,H];
for(let x=-20;x<=W+20;x+=40)hills.push(x,H*0.8-s.fbm(x*0.004,3,2)*H*0.12);
bg.poly([...hills,W+20,H]).fill(Co.mix(C.surface,C.muted,0.16));
bg.rect(-20,H*0.88,W+40,H*0.2).fill(Co.mix(C.surface,C.muted,0.32));
s.world.addChild(bg);
const stem=Co.ramp(Co.mix(C.text,C.surface,0.3),C.accent,6,{space:'oklch'});
const buds=Co.harmony(C.accent,'analogous');
const kinds=['tree','fern','bush'],N=Math.max(2,Math.min(7,Math.round(p.plants))),lite=p.density<0.7;
const plants=[];
for(let i=0;i<N;i++){
  const kind=kinds[i%3],w=W/N,col=s.dir>0?i:N-1-i;
  const grown=L.grow(s,{preset:kind,dir:s.dir,iterations:L.presets[kind].iterations-(lite||kind==='bush'?1:0)});
  const r=L.fit(grown,{x:col*w+w*0.06,y:H*(0.14+0.1*s.random()),width:w*0.88,height:H*0.74},{align:'bottom'});
  const c=new P.Container(),g=new P.Graphics();
  const bx=r.bounds.x+r.bounds.width/2,by=r.bounds.y+r.bounds.height;
  c.pivot.set(bx,by);c.position.set(bx,by);c.addChild(g);s.world.addChild(c);
  plants.push({r,c,g,delay:i*0.25,phase:s.rand(0,6),done:-1});
}
function draw(pl,f){
  const v=L.upTo(pl.r,f);
  L.draw(pl.g.clear(),v,{color:stem,width:5,taper:0.7});
  if(!p.buds||f<0.6)return;
  const step=Math.max(1,Math.floor(v.tips.length/2/60)),size=3+5*(f-0.6);
  buds.forEach((b,k)=>{
    for(let t=k*step;t<v.tips.length/2;t+=step*buds.length)pl.g.circle(v.tips[t*2],v.tips[t*2+1],size);
    pl.g.fill({color:b,alpha:0.9});
  });
}
let last=-1;
s.tick(function(time){
  const T=s.reducedMotion?0:time.t*p.speed;
  plants.forEach(pl=>{pl.c.skew.x=Math.sin(T*0.7+pl.phase)*0.018*s.dir});
  if(last>=0&&T-last<(s.editor?0.4:0.05))return;
  last=T;
  for(const pl of plants){
    const x=Math.min(1,Math.max(0,(T-pl.delay)/p.growth)),f=s.reducedMotion||s.editor?1:0.06+0.94*(1-(1-x)*(1-x));
    if(f===pl.done)continue;
    pl.done=f;
    draw(pl,f);
  }
});
`,
});
