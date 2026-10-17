import { defineStory, range, sharedParams, storyParams, storyStage } from './define';

/**
 * «يوم في قرية الصيادين» — a fishing village's day in five beats across a 2,800-unit panorama:
 * dawn at the harbour (white houses, a lighthouse, boats at the pier), the boats leave under
 * lateen sails, the open sea at noon (gulls, nets cast, fish leaping), the return at sunset (the
 * fishermen on the pier wave), and night (the pier's lanterns light one after another, staggered,
 * windows glow and the water holds their light). One timeline sails the boats, pans the camera
 * out to sea and back, and relights every layer; the water and the hulls rock gently.
 */
export const FISHING_VILLAGE = defineStory({
  id: 'fishing-village',
  name: { en: 'Fishing village day', ar: 'يوم في قرية الصيادين' },
  description: {
    en: 'An illustrated mural story: at dawn the boats leave the harbour, fish the open sea under the gulls, sail home at sunset and the pier lanterns light up for the night.',
    ar: 'قصة مرسومة على امتداد بانوراما: تخرج القوارب من الميناء فجرًا، وتصطاد في عرض البحر تحت النوارس، وتعود عند الغروب لتضيء فوانيس الرصيف ليلًا.',
  },
  tags: ['story', 'illustrated', 'sea', 'village', 'boats', 'hero', 'background'],
  libs: ['kit', 'viewport', 'anim'],
  params: [
    ...sharedParams({ seed: 52 }),
    ...storyParams(),
    range('boats', 'Boats', 'عدد القوارب', 3, 1, 3, 1, 'look'),
    range('gulls', 'Gulls', 'النوارس', 5, 0, 8, 1, 'look'),
  ],
  code: String.raw`
const p=ck.params({palette:'theme',seed:52,speed:1,density:1,scrub:false,tones:'story',boats:3,gulls:5});
const s=await ck.scene({libs:['viewport','anim'],seed:p.seed,design:{width:1280,height:720,fit:'cover',zoom:true}});
${storyStage(2800)}
// Painted palette: night ink, dawn peach, sea teal, lime-white walls, sail cream, warm wood.
const [NIGHT,NIGHT2,DAWN,DAWN2,DAY,DAY2,DUSK,DUSK2,SEA,SEA2,HILL,WALL,ROOF,WOOD,SAIL,INK,SKIN]=tone([0x101a33,0x274066,0x5a6b9a,0xf6c79a,0x78bfe0,0xe9f4f2,0x4a3466,0xf59a62,0x2f8a9a,0x1d5a74,0x5b7f78,0xf2ede2,0xc9764e,0x6b4630,0xf4ead2,0x1c2633,0x8a5a3c]);
const sky=box(root),[,dawnSky,daySky,duskSky]=skies(sky,[[NIGHT,NIGHT2],[DAWN,DAWN2],[DAY,DAY2],[DUSK,DUSK2]]);
const sun=box(sky,640,940);sun.rotation=-1;glow(sun,0,-780,90,0xfff1c4,0.5);gfx(sun,0,-780).circle(0,0,30).fill(0xfff1c4);
const far=layer(0.2),mid=layer(0.5),near=layer(1),lit=layer(1),front=layer(1.3);
// Far headland and islands, the sea, then the village on its quay, the pier and the lighthouse.
const hills=[-40,500];for(let x=-40;x<=PW;x+=24)hills.push(x,470-60*Math.max(0,s.fbm(x*0.002,4,3)+0.3)-(x<700?80*(1-x/700):0));
gfx(far).poly([...hills,PW,500]).fill(C.mix(HILL,DAY2,0.35));
grad(gfx(mid),488,250,C.mix(DAY2,SEA,0.45),SEA2);
const waves=[gfx(near),gfx(near)];
waves.forEach((w,k)=>{for(let y=520+k*16;y<720;y+=32+k*8)for(let x=-60+k*40;x<PW+120;x+=s.rand(60,140)/p.density)w.roundRect(x,y,s.rand(30,70)*(0.6+(y-500)/300),3,2).fill({color:0xffffff,alpha:0.18+0.12*k})});
const quay=gfx(near);quay.rect(-60,556,780,10).fill(C.mix(WALL,HILL,0.2)).rect(-60,566,780,74).fill(C.mix(WALL,HILL,0.55));
for(let y=566;y<640;y+=18)for(let x=-60+(y%36?0:30);x<720;x+=60)quay.rect(x,y,2,18).fill(C.mix(WALL,INK,0.5)).rect(x,y,60,2).fill(C.mix(WALL,INK,0.5));
const town=box(near),panes=[];
for(let i=0;i<9;i++){
  const x=i*70+s.rand(-10,10),w=s.rand(70,100),h=s.rand(80,150),g=gfx(town,x,556);
  g.rect(0,-h,w,h).fill(WALL).rect(w*0.72,-h,w*0.28,h).fill(C.mix(WALL,HILL,0.25)).roundRect(w*0.3,-34,16,34,8).fill(C.mix(ROOF,INK,0.3));
  if(i%3===1)g.moveTo(w*0.08,-h).arc(w*0.43,-h,w*0.35,Math.PI,0).fill(WALL);else g.rect(-4,-h-6,w+8,8).fill(ROOF);
  for(let wy=-h+22;wy<-50;wy+=36){g.roundRect(w*0.12,wy,12,18,6).fill(C.mix(INK,HILL,0.3));panes.push([x+w*0.12+6,556+wy+9])}
}
const tower=gfx(town,660,556);tower.poly([-26,0,26,0,16,-230,-16,-230]).fill(WALL).rect(-16,-150,32,14).fill(ROOF).rect(-22,-262,44,32).fill(INK).poly([-26,-262,26,-262,0,-290]).fill(ROOF);
const pier=gfx(near,560,556);pier.rect(0,0,520,14).fill(WOOD);for(let x=10;x<520;x+=60)pier.rect(x,14,10,120).fill(C.mix(WOOD,INK,0.4));
// Lights: house windows, the lighthouse lamp and the pier lanterns, untinted so they glow at night.
const windows=box(lit),lamps=[];
for(const q of panes){gfx(windows,q[0],q[1]).roundRect(-6,-9,12,18,6).fill(0xffd27a);glow(windows,q[0],q[1],26,0xffb85c,0.35)}
windows.alpha=0;
const beacon=glow(lit,660,310,120,0xffe08a,0.6);beacon.alpha=0;
for(let x=600;x<1080;x+=80){gfx(near,x,516).rect(-2,0,4,40).fill(INK);const l=box(lit,x,516);glow(l,0,0,46,0xffc56a,0.55);gfx(l).circle(0,0,5).fill(0xffe9b8);l.alpha=0;lamps.push(l)}
// The boats: a hull, a mast and a lateen sail; two fishermen aboard each.
const boats=[],crews=[];
function boat(x,y,size,c){
  const b=box(near,x,y),g=gfx(b),k=size/100;
  g.moveTo(-60*k,-14*k).lineTo(64*k,-18*k).quadraticCurveTo(50*k,14*k,20*k,16*k).lineTo(-40*k,16*k).quadraticCurveTo(-58*k,8*k,-60*k,-14*k).fill(c).rect(-56*k,-16*k,116*k,5*k).fill(C.mix(c,INK,0.4));
  g.rect(-2*k,-130*k,4*k,116*k).fill(INK).moveTo(-50*k,-24*k).lineTo(36*k,-150*k).quadraticCurveTo(50*k,-70*k,40*k,-24*k).closePath().fill(SAIL);
  for(const dx of [-30,10])g.circle(dx*k,-30*k,7*k).fill(SKIN).rect((dx-8)*k,-24*k,16*k,10*k).fill(dx<0?INK:ROOF);
  boats.push(b);return b;
}
const N=Math.round(p.boats);
for(let i=0;i<N;i++)boat(700+i*150,600+i*14,100-i*8,[WOOD,ROOF,C.mix(SEA2,INK,0.3)][i]);
for(const x of [640,760])crews.push(rig(figure(near,x,556,74,[x<700?ROOF:SEA2,SKIN,WALL]),74,'idle'));
// Gulls, leaping fish and a cast net.
const gulls=[];for(let i=0;i<Math.round(p.gulls);i++){const r=bird(near,-200,200+s.rand(-60,60),s.rand(16,22),C.mix(WALL,INK,0.15));gulls.push(r.root);rig(r,40,'run',s.rand(0.5,0.8))}
const fish=[];for(let i=0;i<3;i++){const f=gfx(near,1700+i*60,650);f.ellipse(0,0,14,6).fill(C.mix(SEA,WALL,0.6)).poly([-12,0,-22,-7,-22,7]).fill(C.mix(SEA,WALL,0.6));f.alpha=0;fish.push(f)}
const net=gfx(near,1650,600);for(let i=0;i<7;i++)net.moveTo(-60+i*20,0).lineTo(-30+i*10,90).stroke({width:1.5,color:SAIL,alpha:0.7});for(let j=1;j<4;j++)net.moveTo(-60+j*7,j*22).lineTo(60-j*7,j*22).stroke({width:1.5,color:SAIL,alpha:0.7});net.alpha=0;
// The story: 30 seconds — dawn, departure, at sea, return, lanterns.
const light=[far,mid,near,front];
for(const l of light)l.tint=0xe4c9d8;
tl.label('leave',3).label('sea',10).label('home',17).label('night',23)
  .fromTo(sun,{rotation:-1},{rotation:1},{duration:21,ease:'linear'},0);
fade(dawnSky,0,2);fade(daySky,1,'<');relight(light,0xffffff,'<');
fade(duskSky,1,'home-=1');fade(daySky,0,'<1',3);relight(light,0xffb98f,'home-=1');
fade(duskSky,0,'night-=1');relight(light,0x4f5f93,'<');fade(windows,1,'<');fade(beacon,1,'<1',2);
tl.to(lamps,{alpha:1},{duration:0.8,ease:'outBack',stagger:0.35},'night');
tl.to(cam,{pan:0.62},{duration:7,ease:'inOutSine'},'leave')
  .fromTo(gulls,{x:700,y:-80},{x:2500,y:200},{duration:9,ease:'outSine',stagger:0.45},'sea-=2.5')
  .fromTo(net,{alpha:0,y:560},{alpha:1,y:600},{duration:1.2,ease:'outSine'},'sea+=1.5')
  .to(net,{alpha:0},{duration:1},'sea+=4.5');
fish.forEach((f,i)=>tl.fromTo(f,{y:660,alpha:1,rotation:-0.8},{y:600,rotation:0},{duration:0.5,ease:'outQuad'},'sea+='+(2.5+i*0.8)).to(f,{y:670,rotation:0.8,alpha:0},{duration:0.5,ease:'inQuad'},'>'));
tl.to(boats,{'scale.x':-1},{duration:0.6,ease:'inOutSine'},'home-=1')
  .to(cam,{pan:0.08},{duration:6,ease:'inOutSine'},'home');
boats.forEach((b,i)=>tl.to(b,{x:1500+i*150},{duration:7,ease:'inOutSine'},'leave+='+i*0.6).to(b,{x:700+i*150},{duration:6,ease:'inOutSine'},'home+='+i*0.4));
tl.wait(5);
loop(30,NIGHT);
play(13/30,function(T,t){
  waves[0].x=Math.sin(T*0.6)*14;waves[1].x=-Math.sin(T*0.5)*20;
  boats.forEach((b,i)=>{b.rotation=Math.sin(T*1.4+i*1.7)*0.04;b.pivot.y=Math.sin(T*1.1+i)*3});
  for(const c of crews)c.set(t>18&&t<24?'wave':'idle');
});
`,
});
