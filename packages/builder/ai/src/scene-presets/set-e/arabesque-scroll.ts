import { defineMuralE, range, sharedParams } from './define';

/**
 * An arabesque scroll: one seeded rinceau (`s.lib.lsys` arabesque — a waving stem whose shoots
 * curl into tightening spirals) grown once and mirrored four ways in every panel of a frieze, all
 * panels sharing one GraphicsContext so the growth draws once per frame. The ink is an OKLCH ramp
 * from the accent (`s.lib.color`); a band of light sweeps the panels in the reading direction.
 */
export const ARABESQUE_SCROLL = defineMuralE({
  id: 'arabesque-scroll',
  name: { en: 'Arabesque scroll', ar: 'زخرفة أرابيسك متلولبة' },
  description: {
    en: 'A frieze of mirrored arabesque panels whose curling vines grow from the centre in your palette, with light sweeping across them in the reading direction.',
    ar: 'إفريز من ألواح أرابيسك متناظرة تنمو أغصانها الملتفّة من المركز بألوانك، ويعبرها ضوء باتجاه القراءة.',
  },
  tags: ['geometric', 'arabic', 'calm', 'background'],
  libs: ['kit', 'lsys', 'color'],
  params: [
    ...sharedParams({ seed: 51 }),
    range('columns', 'Panels across', 'عدد الألواح', 4, 2, 6, 1, 'look'),
    range('curl', 'Curl', 'الالتفاف', 30, 18, 42, 1, 'look'),
    range('growth', 'Growth time', 'مدة النمو', 6, 2, 16, 0.5, 'motion'),
  ],
  code: String.raw`
const p=ck.params({palette:'theme',seed:51,speed:1,density:1,columns:4,curl:30,growth:6});
const s=await ck.scene({libs:['lsys','color'],seed:p.seed,design:{width:1280,height:720,fit:'cover'}});
const P=s.PIXI,C=s.palette,L=s.lib.lsys,Co=s.lib.color,W=1280,H=720;
const cols=Math.max(2,Math.min(6,Math.round(p.columns))),rows=2,cw=W/cols,ch=H/rows;
const ground=Co.mix(C.surface,C.accent,C.dark?0.07:0.05);
const ink=Co.ramp(C.accent,Co.adjust(C.accent,{l:C.dark?0.14:-0.14,h:24}),5,{space:'oklch'});
const r=L.fit(L.grow(s,{preset:'arabesque',angle:p.curl,heading:28,iterations:p.density<0.7?7:9}),{x:0,y:0,width:cw/2,height:ch/2},{pad:8});
const bg=new P.Graphics().rect(-20,-20,W+40,H+40).fill(ground);
s.world.addChild(bg);
let first=null;
const tiles=[];
for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
  const t=new P.Container();
  t.position.set((i+0.5)*cw,(j+0.5)*ch);
  for(const [sx,sy] of [[1,1],[-1,1],[1,-1],[-1,-1]]){
    const g=first?new P.Graphics(first.context):(first=new P.Graphics());
    g.scale.set(sx,sy);
    t.addChild(g);
  }
  t.addChild(new P.Graphics().circle(0,0,12).fill(ink[4]).circle(0,0,5).fill(ground));
  s.world.addChild(t);
  tiles.push({t,at:(i+0.5)/cols});
}
const frame=new P.Graphics();
for(let i=1;i<cols;i++)frame.moveTo(i*cw,0).lineTo(i*cw,H);
frame.moveTo(0,ch).lineTo(W,ch).stroke({width:1.5,color:Co.mix(ground,C.text,0.22)});
s.world.addChild(frame);
let done=-1;
s.tick(function(time){
  const T=s.reducedMotion?0:time.t*p.speed;
  const f=s.reducedMotion||s.editor?1:Math.min(1,T/p.growth);
  if(f!==done){
    done=f;
    L.draw(first.clear(),L.upTo(r,f),{color:ink,width:3.4,taper:0.78});
  }
  const sweep=((T*0.1)%1.6)-0.3,at=s.dir>0?sweep:1-sweep;
  for(const tile of tiles)tile.t.alpha=0.8+0.2*Math.max(0,1-Math.abs(tile.at-at)*3);
});
`,
});
