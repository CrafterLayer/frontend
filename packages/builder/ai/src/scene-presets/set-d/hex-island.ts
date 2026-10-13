import { defineMural, range, sharedParams, toggle } from './define';

/**
 * A hex island map: Kenney's Hexagon Pack tiles (CC0, `s.lib.hex`) laid as a seeded island —
 * forests, rocks, cacti, a village — on a sea in the page palette, with soft clouds drifting over
 * it in the reading direction and the water hexes shimmering. Column 0 sits on the inline-start
 * side, so the map mirrors in RTL.
 */
export const HEX_ISLAND = defineMural({
  id: 'hex-island',
  name: { en: 'Hex island map', ar: 'خريطة جزيرة سداسية' },
  description: {
    en: 'A little island of hand-drawn hex tiles — forests, hills, a village and a castle — on a sea in your palette, with clouds drifting over it.',
    ar: 'جزيرة صغيرة من بلاطات سداسية مرسومة باليد — غابات وتلال وقرية وقلعة — في بحر بألوانك، تمرّ فوقها الغيوم.',
  },
  tags: ['illustration', 'map', 'playful', 'hero'],
  libs: ['kit', 'hex'],
  params: [
    ...sharedParams({ seed: 96 }),
    range('cols', 'Columns', 'الأعمدة', 11, 5, 20, 1, 'look'),
    range('rows', 'Rows', 'الصفوف', 7, 3, 12, 1, 'look'),
    range('villages', 'Villages', 'القرى', 0.1, 0, 0.4, 0.02, 'look'),
    toggle('clouds', 'Clouds', 'الغيوم', true, 'look'),
  ],
  code: String.raw`
const p=ck.params({palette:'theme',seed:96,speed:1,density:1,cols:11,rows:7,villages:0.1,clouds:true});
const s=await ck.scene({libs:['hex'],seed:p.seed,design:{width:1280,height:720,fit:'contain'}});
const P=s.PIXI,C=s.palette,W=1280,H=720;
const sea=new P.Graphics().rect(-W,-H,W*3,H*3).fill(C.mix(C.accent,C.surface,s.lib.hex.waterMix));
s.world.addChild(sea);
const hex=await s.lib.hex.load(s);
const board=hex.board({cols:p.cols,rows:p.rows,buildings:p.villages});
const water=board.cells.filter(c=>c.name==='water');
const sky=new P.Container();
s.world.addChild(sky);
const clouds=[];
for(let i=0;p.clouds&&i<s.count(5);i++){
  const g=new P.Graphics(),w=s.rand(140,260);
  for(let j=0;j<4;j++)g.ellipse((j-1.5)*w*0.22,s.rand(-10,10),w*s.rand(0.2,0.3),w*s.rand(0.12,0.18));
  g.fill({color:C.mix(C.dark?C.text:C.surface,C.colors[1],0.15),alpha:0.42});
  g.y=s.rand(H*0.1,H*0.9);
  sky.addChild(g);
  clouds.push({g,x:s.rand(0,W+400),v:s.rand(10,24)});
}
s.tick(function(time){
  const T=s.reducedMotion?0:time.t*p.speed;
  for(const c of clouds){
    const x=((c.x+T*c.v)%(W+400))-200;
    c.g.x=s.dir>0?x:W-x;
  }
  for(const c of water)c.view.alpha=0.86+0.14*Math.sin(T*1.3+c.x*0.02+c.y*0.03);
});
`,
});
