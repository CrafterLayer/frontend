import { defineStory, range, sharedParams, storyParams, storyStage } from './define';

/**
 * «قافلة الصحراء» — a desert caravan from dawn to an oasis at night, in four beats across a
 * 3,000-unit panorama: dawn (the sun rises behind the far dunes, the stars fade), the crossing
 * (two walkers and two camels, one ridden, one laden, walking on anim rigs at their stride's
 * pace), dusk (the sun arcs down, the dunes warm to amber) and night at the oasis (palms, a pool
 * that holds the moon, a campfire; the caravan rests). One timeline pans the camera, moves the
 * caravan and relights every layer (a tint per time of day, the sun always from the same side).
 */
export const DESERT_CARAVAN = defineStory({
  id: 'desert-caravan',
  name: { en: 'Desert caravan', ar: 'قافلة الصحراء' },
  description: {
    en: 'An illustrated mural story: a caravan of walkers and camels crosses the dunes from dawn, through the heat of the day and a golden dusk, to an oasis under the stars.',
    ar: 'قصة مرسومة على امتداد بانوراما: قافلة من المسافرين والجمال تعبر الكثبان من الفجر، مرورًا بحرّ النهار وغروب ذهبي، حتى واحة تحت النجوم.',
  },
  tags: ['story', 'illustrated', 'desert', 'journey', 'arabic', 'hero', 'background'],
  libs: ['kit', 'viewport', 'anim'],
  params: [
    ...sharedParams({ seed: 41 }),
    ...storyParams(),
    range('camels', 'Camels', 'عدد الجمال', 2, 1, 3, 1, 'look'),
    range('stars', 'Stars', 'النجوم', 1, 0, 2, 0.1, 'look'),
  ],
  code: String.raw`
const p=ck.params({palette:'theme',seed:41,speed:1,density:1,scrub:false,tones:'story',camels:2,stars:1});
const s=await ck.scene({libs:['viewport','anim'],seed:p.seed,design:{width:1280,height:720,fit:'cover',zoom:true}});
${storyStage(3000)}
// Painted palette: indigo night, dawn rose, day blue, sand, terracotta shade, palm teal.
const [NIGHT,NIGHT2,DAWN,DAWN2,DAY,DAY2,DUSK,DUSK2,SAND,SAND2,SHADE,PALM,INK,ROBE,SKIN,CAMEL,WATER]=tone([0x141a3a,0x2f3a70,0x3a3a72,0xf2a65a,0x5fa8d8,0xf6e2b4,0x45305e,0xf3874a,0xf0d3a0,0xd9a86c,0x9a5a34,0x2f5d55,0x2a2238,0x2e3f7a,0x7a4b32,0xb57d4b,0x7fbcd2]);
const sky=box(root),[,dawnSky,daySky,duskSky]=skies(sky,[[NIGHT,NIGHT2],[DAWN,DAWN2],[DAY,DAY2],[DUSK,DUSK2]]);
const stars=box(sky),twinkle=[gfx(stars),gfx(stars)];
for(const q of s.poisson(1280,400,26,s.count(Math.round(170*p.stars))))twinkle[s.int(0,1)].circle(q[0],q[1]-30,s.rand(0.6,1.7)).fill({color:0xfff6e0,alpha:s.rand(0.4,1)});
const arm=(r,c,size)=>{const a=box(sky,640,930);a.rotation=-1.05;glow(a,0,-r,size*2.4,c,0.5);gfx(a,0,-r).circle(0,0,size).fill(c);return a};
const sun=arm(800,0xffe6a8,34),moon=arm(780,0xf3f0ff,18);
// Dunes: each hump lit on the sun side, shaded on the lee side, in three depths.
function dunes(l,base,h,w,lit,shade){
  const g=gfx(l);
  for(let x=-200;x<PW+300;x+=w*s.rand(0.7,1.1)){
    const hh=h*s.rand(0.55,1.1),ww=w*s.rand(0.8,1.25),cx=x+ww*0.18;
    g.moveTo(x-ww,base).quadraticCurveTo(x-ww*0.3,base-hh*0.95,cx,base-hh).quadraticCurveTo(x+ww*0.45,base-hh*0.45,x+ww,base).closePath().fill(lit);
    g.moveTo(cx,base-hh).quadraticCurveTo(x+ww*0.45,base-hh*0.45,x+ww,base).quadraticCurveTo(x+ww*0.35,base-hh*0.3,cx,base-hh).closePath().fill(shade);
  }
  return g.rect(-200,base-1,PW+500,H-base+60).fill(lit);
}
const far=layer(0.25),mid=layer(0.55),near=layer(1),camp=layer(1),front=layer(1.35);
dunes(far,500,120,260,C.mix(SAND,DAY2,0.45),C.mix(SAND2,DAY2,0.35));
dunes(mid,560,130,330,C.mix(SAND,SAND2,0.35),C.mix(SHADE,SAND2,0.45));
dunes(near,640,90,420,SAND2,SHADE);
// Foreground: wind-cut rocks and dry shrubs, lit on the same side as the dunes.
for(let x=60;x<PW*1.4;x+=s.rand(260,460)/p.density){
  const g=gfx(front,x,736),w=s.rand(50,110),h=s.rand(30,60);
  if(s.random()<0.5)g.poly([-w,0,-w*0.7,-h,-w*0.1,-h*1.15,w*0.6,-h*0.8,w,0]).fill(C.mix(SHADE,INK,0.35)).poly([-w*0.7,-h,-w*0.1,-h*1.15,-w*0.2,-h*0.6,-w*0.8,-h*0.5]).fill(C.mix(SHADE,SAND2,0.3));
  else for(let i=0;i<9;i++){const a=-Math.PI/2+(i-4)*0.2;g.moveTo(0,0).quadraticCurveTo(Math.cos(a)*h*0.4,-h*0.5,Math.cos(a)*h*1.1,Math.sin(a)*h*1.3).stroke({width:3,color:C.mix(SHADE,INK,0.3),cap:'round'})}
}
// The oasis at the far end: a pool that holds the moon, palms leaning to the light.
const oasis=box(near,2900,642);
gfx(oasis).ellipse(0,8,270,36).fill(C.mix(PALM,SHADE,0.3)).ellipse(-10,4,236,24).fill(WATER).rect(-150,0,120,3).fill({color:0xffffff,alpha:0.35}).rect(-60,9,170,3).fill({color:0xffffff,alpha:0.25});
function palm(x,h,lean){
  const g=gfx(oasis,x,0),tx=lean*h*0.35,ty=-h;
  g.moveTo(-9,0).quadraticCurveTo(lean*h*0.05,-h*0.5,tx-3,ty).lineTo(tx+3,ty).quadraticCurveTo(lean*h*0.1+9,-h*0.5,9,0).closePath().fill(C.mix(SHADE,INK,0.35));
  for(let i=0;i<7;i++){const a=-Math.PI+i*Math.PI/6+0.1,len=h*0.42;
    g.moveTo(tx,ty).quadraticCurveTo(tx+Math.cos(a)*len*0.5,ty+Math.sin(a)*len*0.5-26,tx+Math.cos(a)*len,ty+Math.sin(a)*len*0.6+24).quadraticCurveTo(tx+Math.cos(a)*len*0.45,ty+Math.sin(a)*len*0.35-8,tx,ty).fill(PALM)}
}
palm(-230,250,0.45);palm(-160,190,0.75);palm(180,270,-0.35);palm(250,200,-0.7);
// The campfire stays untinted: it is the night's own light.
const fire=box(camp,2590,690),flame=gfx(fire);
glow(fire,0,-18,150,0xff9a3c,0.45);
flame.poly([-16,0,-6,-30,0,-52,8,-28,16,0]).fill(0xff8a3d).poly([-8,0,0,-30,8,0]).fill(0xffe08a);
gfx(fire).roundRect(-26,-4,52,8,4).fill(0x3a2418);
fire.alpha=0;
// The caravan: a guide with a staff, the camels (one ridden, then laden) and a walker behind.
const van=box(near,100,678),walkers=[];
function leg(r,x,c){const j=box(r,x,-94);gfx(j).poly([-9,-4,9,-4,5,52,6,86,-6,86,-4,52]).fill(c).ellipse(0,88,8,4).fill(c);return j}
function camel(x,load){
  const r=box(van,x,0),c=CAMEL,dark=C.mix(CAMEL,SHADE,0.55);
  const armL=leg(r,-30,dark),legL=leg(r,34,dark);
  const tail=box(r,-60,-116);gfx(tail).poly([-2,0,2,0,3,30,-3,30]).fill(dark).ellipse(0,32,4,7).fill(dark);tail.rotation=0.3;
  const body=box(r),b=gfx(body);
  b.ellipse(0,-112,64,30).fill(c).moveTo(-48,-120).bezierCurveTo(-34,-196,16,-196,30,-126).closePath().fill(c);
  if(load)b.roundRect(-46,-170,70,34,10).fill(ROBE).roundRect(-32,-190,44,24,8).fill(C.mix(SAND2,SHADE,0.35)).rect(-48,-150,74,5).fill(C.mix(ROBE,SHADE,0.4));
  else b.roundRect(-34,-160,50,14,6).fill(ROBE).poly([-22,-156,10,-156,4,-206,-16,-206]).fill(0xefe6d6).poly([-6,-160,6,-160,12,-128,2,-126]).fill(0xefe6d6).circle(-6,-216,10).fill(SKIN).poly([-18,-214,-6,-232,6,-214,8,-200,-14,-204]).fill(ROBE);
  const head=box(r,50,-120);gfx(head).moveTo(-8,-12).quadraticCurveTo(28,4,40,-44).lineTo(60,-50).quadraticCurveTo(74,-46,70,-36).lineTo(52,-32).quadraticCurveTo(42,12,-4,18).closePath().fill(c).poly([38,-46,42,-58,46,-46]).fill(c);
  const legR=leg(r,40,c),armR=leg(r,-24,c);
  walkers.push(rig({root:r,body,head,tail,armL,armR,legL,legR},170,'idle',0.62));
}
walkers.push(rig(figure(van,190,0,112,[0xefe6d6,SKIN,ROBE],true),112,'idle',1.15));
for(let i=0;i<Math.round(p.camels);i++)camel(40-i*175,i>0);
walkers.push(rig(figure(van,40-Math.round(p.camels)*175,0,104,[ROBE,SKIN,0xefe6d6]),104,'idle',1.2));
// The story: dawn, the crossing, dusk, night at the oasis — 28 seconds, then the loop.
const light=[far,mid,near,front];
for(const l of light)l.tint=0xd8c4e8;
tl.label('dawn',0).label('day',5).label('dusk',13).label('night',18).label('oasis',20.5)
  .fromTo(sun,{rotation:-1.05},{rotation:1.05},{duration:18,ease:'linear'},0)
  .fromTo(moon,{rotation:-1.05},{rotation:-0.45},{duration:9,ease:'outSine'},'night');
fade(stars,0,0.5,3);fade(dawnSky,0,'day-=1');fade(daySky,1,'<');relight(light,0xffffff,'<');
fade(duskSky,1,'dusk-=1');fade(daySky,0,'<1',3);relight(light,0xffc49a,'dusk-=1');
fade(duskSky,0,'night');fade(stars,1,'<');relight(light,0x55639a,'<');
// The caravan walks in, then the camera travels with it at the same pace to the oasis.
tl.to(van,{x:640},{duration:4.5,ease:'linear'},0.5)
  .to(cam,{pan:1},{duration:15.5,ease:'inOutSine'},'>')
  .to(van,{x:2300},{duration:15.5,ease:'linear'},'<')
  .to(fire,{alpha:1},{duration:1.5,ease:'outSine'},'oasis')
  .wait(5);
loop(28,NIGHT);
play(14/28,function(T,t){
  twinkle[0].alpha=0.75+0.25*Math.sin(T*1.3);twinkle[1].alpha=0.75-0.25*Math.sin(T*1.1);
  flame.scale.set(1+0.05*Math.sin(T*7),1+0.09*Math.sin(T*9.3)+0.04*Math.sin(T*15.1));
  moon.alpha=Math.max(0,Math.min(1,(t-18)/3));
  for(const r of walkers)r.set(t>0.5&&t<20.5?'walk':'idle');
});
`,
});
