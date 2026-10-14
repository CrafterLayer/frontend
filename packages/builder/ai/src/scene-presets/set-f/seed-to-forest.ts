import { defineStory, range, sharedParams, storyParams, storyStage } from './define';

/**
 * «من بذرة إلى غابة» — a growth story in five beats across a 2,600-unit panorama: a bird drops a
 * seed on a bare meadow at dawn, rain falls and a sprout opens two leaves, the sprout becomes a
 * tree (trunk first, then its crown, clump by clump), the camera travels as a forest spreads over
 * the hills (trees and flowers staggered one after another), and at golden evening a flock flies
 * in and settles in the crowns. Every crown is lit from the same upper side; one timeline grows,
 * rains, relights and pans.
 */
export const SEED_TO_FOREST = defineStory({
  id: 'seed-to-forest',
  name: { en: 'Seed to forest', ar: 'من بذرة إلى غابة' },
  description: {
    en: 'An illustrated mural story: a bird drops a seed, the rain wakes a sprout, it grows into a tree, a forest spreads over the hills and the birds come home at golden evening.',
    ar: 'قصة مرسومة على امتداد بانوراما: طائر يُسقط بذرة، والمطر يوقظ برعمًا ثم تنمو شجرة، وتنتشر غابة على التلال، وتعود الطيور إليها في المساء الذهبي.',
  },
  tags: ['story', 'illustrated', 'nature', 'growth', 'forest', 'birds', 'hero', 'background'],
  libs: ['kit', 'viewport', 'anim'],
  params: [
    ...sharedParams({ seed: 63 }),
    ...storyParams(),
    range('trees', 'Forest trees', 'أشجار الغابة', 9, 4, 14, 1, 'look'),
    range('flock', 'Birds', 'الطيور', 6, 0, 10, 1, 'look'),
  ],
  code: String.raw`
const p=ck.params({palette:'theme',seed:63,speed:1,density:1,scrub:false,tones:'story',trees:9,flock:6});
const s=await ck.scene({libs:['viewport','anim'],seed:p.seed,design:{width:1280,height:720,fit:'cover',zoom:true}});
${storyStage(2600)}
// Painted palette: evening gold, dawn mint, day blue, three greens, bark, blossom, ink.
const [EVE,EVE2,DAWN,DAWN2,DAY,DAY2,HILL,GRASS,LEAF,LEAF2,BARK,BLOOM,INK,CLOUD]=tone([0x5b4a7a,0xf7c58a,0x9fc7c0,0xf3e6c4,0x7cc0e6,0xe8f4ee,0x7fa592,0x6f9a52,0x3f7a4a,0x8cbf5a,0x6b4a34,0xf0a3a3,0x23302a,0x8a96a8]);
const sky=box(root),[,dawnSky,daySky]=skies(sky,[[EVE,EVE2],[DAWN,DAWN2],[DAY,DAY2]]);
const sun=box(sky,640,940);sun.rotation=-0.9;glow(sun,0,-760,110,0xfff0c0,0.5);gfx(sun,0,-760).circle(0,0,34).fill(0xfff0c0);
const clouds=box(sky);for(let i=0;i<6;i++){const g=gfx(clouds,i*230+s.rand(0,80),s.rand(70,190));for(let j=0;j<5;j++)g.circle(j*34-70,-Math.sin(j/4*Math.PI)*30,s.rand(28,40)).fill(C.mix(CLOUD,0xffffff,0.25));g.roundRect(-110,0,220,30,15).fill(CLOUD)}
clouds.alpha=0;
const far=layer(0.2),mid=layer(0.5),near=layer(1),front=layer(1.3);
function hill(l,base,amp,f,seed,c){const pts=[-60,H+40];for(let x=-60;x<=PW+60;x+=24)pts.push(x,base-amp*(0.5+0.5*s.fbm(x*f,seed,3)));pts.push(PW+60,H+40);return gfx(l).poly(pts).fill(c)}
hill(far,470,120,0.0016,1,C.mix(HILL,DAY2,0.35));
const farWood=box(far);for(let x=0;x<1900;x+=s.rand(14,30)){const y=410+40*s.fbm(x*0.0016,1,3),h=s.rand(26,46);gfx(farWood,x,y+10).poly([-h*0.3,0,0,-h,h*0.3,0]).fill(C.mix(LEAF,HILL,0.55))}
farWood.alpha=0;
hill(mid,540,90,0.0022,2,C.mix(GRASS,HILL,0.45));
hill(near,630,40,0.003,3,GRASS);
// A tree: a tapered trunk with two boughs, then a crown of clumps — shade low right, light high left.
function tree(parent,x,y,h,parts){
  const t=box(parent,x,y),trunk=box(t),k=h/300,crown=[];
  gfx(trunk).poly([-14*k,0,14*k,0,7*k,-200*k,-7*k,-200*k]).fill(BARK).poly([-4*k,-110*k,-70*k,-190*k,-62*k,-196*k,2*k,-130*k]).fill(BARK).poly([4*k,-140*k,60*k,-210*k,68*k,-204*k,4*k,-118*k]).fill(BARK);
  // Every clump's shade first, then every clump's light, so the crown reads as one lit mass.
  const clumps=[[0,-262,58]];for(let i=0;i<7;i++){const a=i/7*Math.PI*2;clumps.push([Math.cos(a)*72,-226+Math.sin(a)*46,s.rand(46,62)])}
  for(const [col,dx,dy,f] of [[LEAF,6,8,1],[C.mix(LEAF,LEAF2,0.55),-8,-10,0.74],[LEAF2,-14,-18,0.38]])
    for(const q of clumps){const c=box(t,q[0]*k,q[1]*k);gfx(c).circle(dx*k,dy*k,q[2]*k*f).fill(col);crown.push(c)}
  if(parts){parts.trunk=trunk;parts.crown=crown}
  return t;
}
// The hero tree grows in place; the forest trees grow whole, one after another.
const hero={},big=tree(near,640,612,380,hero),forest=[],perches=[[640-40,612-380*0.98],[640+70,612-380*0.8]];
hero.trunk.scale.set(0.15,0);for(const c of hero.crown)c.scale.set(0);
const N=Math.round(p.trees);
for(let i=0;i<N;i++){const x=980+i*(1500/N)+s.rand(-40,40),h=s.rand(220,330),t=tree(i%3===1?mid:near,i%3===1?x*0.62:x,i%3===1?548:620+s.rand(-8,8),i%3===1?h*0.6:h);t.scale.set(0);forest.push(t);if(i%3!==1)perches.push([x-h*0.15,620-h*0.95])}
const blooms=[];for(let x=200;x<PW;x+=s.rand(70,150)/p.density){const b=gfx(front,x*1.3,716+s.rand(-6,10));b.circle(0,-14,8).fill(BLOOM).circle(0,-14,3).fill(0xfff1c4).rect(-1.5,-8,3,14).fill(GRASS);b.scale.set(0);blooms.push(b)}
// The seed, its sprout, the rain and the birds.
const seedBird=bird(near,-120,250,22,INK),seedDot=gfx(near,640,330);seedDot.ellipse(0,0,6,8).fill(BARK);seedDot.alpha=0;rig(seedBird,40,'run',0.7);
const sprout=box(near,640,612);gfx(sprout).roundRect(-2,-46,4,46,2).fill(LEAF2).ellipse(-14,-46,14,6).fill(LEAF2).ellipse(14,-50,14,6).fill(LEAF);sprout.scale.set(0);
const rain=box(s.world),drops=gfx(rain);for(let n=0;n<s.count(200);n++){const x=s.rand(-40,1320),y=s.rand(0,840);drops.moveTo(x,y).lineTo(x-6,y+22).stroke({width:1.5,color:0xdfe9f2,alpha:0.5})}
rain.addChild(new P.Graphics(drops.context)).y=-840;
rain.alpha=0;
const flock=[];for(let i=0;i<Math.round(p.flock);i++){const b=bird(near,-200,-200,s.rand(14,18),INK);flock.push(b);b.rig=rig(b,36,'run',s.rand(0.6,0.9))}
// The story: seed, rain and sprout, tree, forest, birds — 30 seconds.
const light=[far,mid,near,front];
for(const l of light)l.tint=0xf3dcc4;
tl.label('rain',4.5).label('grow',9.5).label('forest',15.5).label('birds',22)
  .fromTo(seedBird.root,{x:-120},{x:1500},{duration:5,ease:'linear'},0.3)
  .fromTo(seedDot,{y:262},{y:604},{duration:1.1,ease:'inQuad'},2.6)
  .fromTo(seedDot,{alpha:0},{alpha:1},{duration:0.1},'<')
  .to(seedDot,{'scale.y':0.5,alpha:0},{duration:1.5,ease:'inSine'},'rain');
fade(dawnSky,0,'rain-=1');fade(daySky,1,'<');relight(light,0xc8d2dc,'<',3);
fade(clouds,1,'rain-=0.5',2).to(rain,{alpha:1},{duration:1.5,ease:'inSine'},'<0.5');
tl.to(sprout,{'scale.x':1,'scale.y':1},{duration:2.5,ease:'outBack'},'rain+=1.5');
fade(clouds,0,'grow-=1',3);fade(rain,0,'<',2);relight(light,0xffffff,'<',3);
tl.to(hero.trunk,{'scale.x':1,'scale.y':1},{duration:3.5,ease:'outCubic'},'grow')
  .to(sprout,{alpha:0},{duration:1},'<0.5')
  .to(hero.crown,{'scale.x':1,'scale.y':1},{duration:1.2,ease:'outBack',stagger:0.09},'grow+=2.2')
  .to(cam,{pan:1},{duration:8,ease:'inOutSine'},'forest')
  .to(forest,{'scale.x':1,'scale.y':1},{duration:1.4,ease:'outBack',stagger:0.6},'forest+=0.4')
  .to(blooms,{'scale.x':1,'scale.y':1},{duration:0.6,ease:'outBack',stagger:0.08},'forest+=1');
fade(farWood,1,'forest+=1',5);fade(daySky,0,'birds-=1');relight(light,0xffd9a8,'<');
const stops=perches.slice(-flock.length).reverse();
flock.forEach((b,i)=>{const q=stops[i%stops.length];b.at=22.5+i*0.5+3;tl.fromTo(b.root,{x:1500+i*60,y:-120},{x:q[0],y:q[1]},{duration:3,ease:'outSine'},'birds+='+(0.5+i*0.5))});
loop(30,EVE);
play(14/30,function(T,t){
  rain.y=(T*420)%840;
  big.skew.x=Math.sin(T*0.8)*0.012;for(const f of forest)f.skew.x=Math.sin(T*0.8+f.x*0.01)*0.012;
  for(const b of flock)b.rig.set(t>b.at?'idle':'run');
});
`,
});
