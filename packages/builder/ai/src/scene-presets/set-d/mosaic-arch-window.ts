import { defineMural, range, select, sharedParams } from './define';

/**
 * A mosaic arch window: a relaxed Voronoi mosaic with grout (`s.lib.geom.mosaic`) trimmed to a
 * pointed, round or horseshoe arch (`s.lib.geom.arch`), set in a carved frame cut from the wall
 * (`s.lib.geom.difference`), its tesserae coloured by a cellular field (`s.lib.noise`) from the
 * palette. A band of light sweeps across the glass in the reading direction.
 */
export const MOSAIC_ARCH_WINDOW = defineMural({
  id: 'mosaic-arch-window',
  name: { en: 'Mosaic arch window', ar: 'نافذة قوس من الفسيفساء' },
  description: {
    en: 'A pointed, round or horseshoe arch filled with mosaic glass in your palette, set in a carved frame, with light sweeping across it.',
    ar: 'قوس مدبّب أو دائري أو على هيئة حدوة فرس، مملوء بزجاج فسيفساء بألوانك داخل إطار منحوت، يعبره ضوء متهادٍ.',
  },
  tags: ['geometric', 'arabic', 'light', 'hero'],
  libs: ['kit', 'noise', 'geom', 'viewport'],
  params: [
    ...sharedParams({ seed: 63 }),
    select('arch', 'Arch', 'القوس', 'pointed', [
      ['pointed', 'Pointed', 'مدبّب'],
      ['round', 'Round', 'دائري'],
      ['horseshoe', 'Horseshoe', 'حدوة فرس'],
    ]),
    range('tiles', 'Tiles', 'عدد القطع', 220, 40, 600, 10, 'look'),
    range('grout', 'Grout', 'الفواصل', 4, 0, 12, 0.5, 'look'),
  ],
  code: String.raw`
const p=ck.params({palette:'theme',seed:63,speed:1,density:1,arch:'pointed',tiles:220,grout:4});
const s=await ck.scene({libs:['noise','geom','viewport'],seed:p.seed,design:{width:1280,height:720,fit:'cover',zoom:true}});
const P=s.PIXI,C=s.palette,G=s.lib.geom,W=1280,H=720;
const n=s.lib.noise.create(s,{type:'cellular',cell:'id',scale:140});
const ah=H*0.8,aw=Math.min(W*0.46,ah*0.7),ax=(W-aw)/2,ay=H*0.12;
const opening=G.arch(ax,ay,aw,ah,p.arch);
const wall=new P.Graphics(),frame=new P.Graphics(),glass=new P.Container();
s.world.addChild(wall,frame,glass);
wall.rect(-20,-20,W+40,H+40).fill(C.mix(C.surface,C.muted,0.12));
G.draw(frame,G.difference(G.arch(ax-30,ay-30,aw+60,ah+30,p.arch),opening),C.mix(C.surface,C.text,0.18),{width:2,color:C.mix(C.surface,C.text,0.35)});
G.draw(frame,opening,C.dark?C.surface:C.text);
const tiles=G.mosaic(s,{x:ax,y:ay,width:aw,height:ah,cells:s.count(p.tiles),relax:2,gap:p.grout,clip:opening});
const panes=tiles.map(t=>{
  const pick=Math.floor((n.at(t.cx,t.cy)*0.5+0.5)*5)%5;
  const g=new P.Graphics().poly(t.tile).fill(C.mix(C.colors[pick],C.surface,0.15+0.25*t.tone));
  glass.addChild(g);
  return {g,x:(t.cx-ax)/aw};
});
s.tick(function(time){
  const T=s.reducedMotion?0:time.t*p.speed;
  const sweep=((T*0.07)%1.6)-0.3,at=s.dir>0?sweep:1-sweep;
  for(const pane of panes){
    const glint=Math.max(0,1-Math.abs(pane.x-at)*5);
    pane.g.alpha=0.78+0.22*glint;
  }
});
`,
});
