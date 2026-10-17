import { defineStory, range, sharedParams, storyParams, storyStage } from './define';

/**
 * «السوق القديم يستيقظ» — an old souq street waking up, in five beats along a 2,600-unit row of
 * arched shopfronts under a skyline of domes and minarets: blue hour (lanterns lit, shutters
 * down, a cat asleep on a step), first light (rays across the street, the pigeons leave the
 * roofline one after another), the shutters roll up shop by shop to show the goods and the
 * shopkeepers (Open Peeps people from s.lib.peeps, CC0), the awnings unroll and the cat walks
 * down the street with the camera, and the morning crowd passes. One timeline runs it all.
 */
export const SOUQ_MORNING = defineStory({
  id: 'souq-morning',
  name: { en: 'The old souq wakes', ar: 'السوق القديم يستيقظ' },
  description: {
    en: 'An illustrated mural story: an old market street at blue hour wakes with the sun — pigeons leave the roofs, shutters roll up on spices, rugs and lamps, shopkeepers appear and a cat strolls down the street.',
    ar: 'قصة مرسومة على امتداد بانوراما: شارع سوق قديم في الساعة الزرقاء يستيقظ مع الشمس — يطير الحمام عن الأسطح، وتُرفع الأبواب عن البهارات والسجاد والفوانيس، ويظهر الباعة، ويتمشى قط في الشارع.',
  },
  tags: ['story', 'illustrated', 'city', 'market', 'arabic', 'people', 'hero', 'background'],
  libs: ['kit', 'viewport', 'anim', 'peeps'],
  params: [
    ...sharedParams({ seed: 74 }),
    ...storyParams(),
    range('shops', 'Shops', 'عدد المحلات', 6, 3, 6, 1, 'look'),
    range('pigeons', 'Pigeons', 'الحمام', 7, 0, 10, 1, 'look'),
  ],
  code: String.raw`
const p=ck.params({palette:'theme',seed:74,speed:1,density:1,scrub:false,tones:'story',shops:6,pigeons:7});
const s=await ck.scene({libs:['viewport','anim','peeps'],seed:p.seed,design:{width:1280,height:720,fit:'cover',zoom:true}});
${storyStage(2600)}
// Painted palette: blue hour, morning gold, sandstone, shutter teal, awning red, brass, ink.
const [NIGHT,NIGHT2,DAWN,DAWN2,DAY,DAY2,STONE,STONE2,TEAL,RED,BRASS,INK,SPICE,CREAM,CAT]=tone([0x1d2a4f,0x5a6f9e,0x6a6a9a,0xf6c08a,0x8ec5e8,0xfbe9c8,0xe6cfa6,0xb8946a,0x2f7d7a,0xb5463a,0xd9a441,0x2a2230,0xd8682e,0xf3e7cf,0x5b4a42]);
const sky=box(root),[,dawnSky,daySky]=skies(sky,[[NIGHT,NIGHT2],[DAWN,DAWN2],[DAY,DAY2]]);
const sun=box(sky,640,940);sun.rotation=-0.95;glow(sun,0,-760,120,0xfff0c8,0.55);gfx(sun,0,-760).circle(0,0,32).fill(0xfff0c8);
const far=layer(0.25),mid=layer(0.6),near=layer(1),lit=layer(1),front=layer(1.25);
// The skyline: domes and minarets, then the upper storeys with mashrabiya screens.
const line=gfx(far);line.rect(-40,420,PW,320).fill(C.mix(STONE2,NIGHT2,0.35));
for(let x=0;x<1900;x+=s.rand(90,160)/p.density){const h=s.rand(40,110),w=s.rand(70,120);line.rect(x,420-h,w,h+4).fill(C.mix(STONE2,NIGHT2,0.35));
  if(s.random()<0.35)line.circle(x+w/2,420-h,w*0.38).fill(C.mix(STONE2,NIGHT2,0.35));
  if(s.random()<0.18)line.rect(x+w*0.4,420-h-150,18,150).fill(C.mix(STONE2,NIGHT2,0.35)).poly([x+w*0.4-6,420-h-150,x+w*0.4+24,420-h-150,x+w*0.4+9,420-h-185]).fill(C.mix(STONE2,NIGHT2,0.35))}
const upper=gfx(mid);
for(let x=-40;x<2000;x+=s.rand(170,230)){const h=s.rand(230,300),w=s.rand(160,220);upper.rect(x,470-h,w+8,h).fill(C.mix(STONE,STONE2,0.55)).rect(x,470-h,w+8,10).fill(C.mix(STONE2,INK,0.25));
  const mx=x+w*0.3,my=470-h+50;upper.roundRect(mx,my,w*0.42,90,6).fill(C.mix(TEAL,INK,0.35));for(let i=1;i<6;i++)upper.rect(mx+i*w*0.07,my,2,90).fill(C.mix(TEAL,CREAM,0.35));for(let j=1;j<5;j++)upper.rect(mx,my+j*18,w*0.42,2).fill(C.mix(TEAL,CREAM,0.35))}
// The street: cobbles and the row of shopfronts, each with goods, a shopkeeper and a shutter.
const street=gfx(near);street.rect(-40,600,PW+80,140).fill(C.mix(STONE2,INK,0.3));
for(let y=612;y<720;y+=22)for(let x=-40+(y%44?0:24);x<PW;x+=48)street.roundRect(x,y,42,16,6).fill(C.mix(STONE2,INK,0.18));
const N=Math.round(p.shops),gap=2400/N,shutters=[],awnings=[],keepers=[],cast=['Omar','Mariam','Yousef','Salma','Khalid','Noor'];
const tops=[];
const faces=await Promise.all(cast.slice(0,N).map((n,i)=>s.lib.peeps.texture(s,{seed:n,mood:'calm',accessories:false,size:110,hair:i%2?'hijab':undefined,clothing:['#2f7d7a','#b5463a','#d9a441'][i%3]}).catch(()=>null)));
for(let i=0;i<N;i++){
  const x=140+i*gap,shop=box(near,x,600),g=gfx(shop),w=230,h=300;
  g.rect(-w/2-40,-h-150,w+80,h+150).fill(STONE).rect(w/2+28,-h-150,12,h+150).fill(STONE2);
  g.moveTo(-w/2,0).lineTo(-w/2,-h+w/2).arc(0,-h+w/2,w/2,Math.PI,0).lineTo(w/2,0).closePath().fill(C.mix(INK,STONE2,0.25));
  const goods=gfx(shop),side=i%2?-1:1;
  if(i%3===0)for(let k=0;k<3;k++)goods.poly([side*(20+k*30)-16,-74,side*(20+k*30),-112,side*(20+k*30)+16,-74]).fill([SPICE,BRASS,RED][k]);
  else if(i%3===1)for(let k=0;k<2;k++)goods.rect(side*(30+k*48)-22,-180,44,104).fill([RED,TEAL][k]).rect(side*(30+k*48)-18,-170,36,4).fill(CREAM).rect(side*(30+k*48)-18,-96,36,4).fill(CREAM);
  else for(let k=0;k<2;k++)goods.rect(side*(34+k*44)-1,-185,2,36).fill(BRASS).poly([side*(34+k*44)-11,-149,side*(34+k*44)+11,-149,side*(34+k*44)+7,-114,side*(34+k*44)-7,-114]).fill(BRASS);
  if(faces[i]){const pe=new P.Sprite(faces[i]);pe.anchor.set(0.5,1);pe.position.set(-side*42,-64);shop.addChild(pe);keepers.push(pe)}
  gfx(shop).rect(-w/2,-70,w,70).fill(C.mix(BRASS,INK,0.45)).rect(-w/2,-74,w,8).fill(C.mix(BRASS,INK,0.2));
  g.moveTo(-w/2,-h+w/2).arc(0,-h+w/2,w/2,Math.PI,0).closePath().fill(C.mix(TEAL,INK,0.45));for(let k=-3;k<=3;k++)g.moveTo(0,-h+w/2).lineTo(k*w/7,-h+w/2-Math.sqrt(Math.max(0,(w/2)**2-(k*w/7)**2))).stroke({width:2,color:C.mix(TEAL,CREAM,0.35)});
  const sh=box(shop,0,-h+w/2),sg=gfx(sh);sg.rect(-w/2,0,w,h-w/2).fill(TEAL);for(let k=1;k<8;k++)sg.rect(-w/2+k*w/8,0,2,h-w/2).fill(C.mix(TEAL,INK,0.35));sg.rect(-w/2,0,w,10).fill(C.mix(TEAL,INK,0.5));shutters.push(sh);
  tops.push(x-70,x+50);
  const aw=box(shop,0,-h-24),ag=gfx(aw);for(let k=0;k<7;k++)ag.poly([-w/2-30+k*(w+60)/7,0,-w/2-30+(k+1)*(w+60)/7,0,-w/2-26+(k+1)*(w+60)/7,70,-w/2-34+k*(w+60)/7,70]).fill(k%2?CREAM:RED);aw.scale.y=0;awnings.push(aw);
}
// Lanterns on a line across the street, glowing until the sun is up.
const lamps=layer(1.25);gfx(front).moveTo(-40,180).quadraticCurveTo(PW*0.6,250,PW*1.3,170).stroke({width:2,color:INK});
for(let x=120;x<PW*1.25;x+=210){const y=180+40*Math.sin(Math.PI*x/(PW*1.3)),l=gfx(front,x,y);l.rect(-1,0,2,20).fill(INK).poly([-12,20,12,20,8,52,-8,52]).fill(BRASS);glow(lamps,x,y+36,60,0xffc46a,0.6)}
// Light shafts from the rising sun (one side, as every shadow).
const rays=box(s.world);for(let i=0;i<4;i++){const g=gfx(rays);g.blendMode='add';g.poly([140+i*230,-40,240+i*230,-40,520+i*260,760,380+i*260,760]).fill({color:0xffe2a8,alpha:0.06})}
rays.alpha=0;
// The pigeons on the roofline, the cat asleep on a step, and the morning walkers.
const pigeons=[];for(let i=0;i<Math.round(p.pigeons);i++){const b=bird(near,tops[i%tops.length]+s.rand(-20,20)+Math.floor(i/tops.length)*36,146,13,C.mix(STONE2,INK,0.5));b.rig=rig(b,30,'idle',s.rand(0.6,0.9));pigeons.push(b)}
const cat=box(near,560,640),catBody=box(cat);gfx(catBody).ellipse(0,-22,30,13).fill(CAT);
const catParts={root:cat,body:catBody,head:box(cat,26,-30),tail:box(cat,-28,-26),legL:limb(cat,18,-14,16,6,CAT),legR:limb(cat,14,-14,16,6,CAT),armL:limb(cat,-18,-14,16,6,CAT),armR:limb(cat,-14,-14,16,6,CAT)};
gfx(catParts.head).circle(4,-4,11).fill(CAT).poly([-4,-12,-1,-24,5,-13]).fill(CAT).poly([6,-13,12,-24,13,-10]).fill(CAT);
gfx(catParts.tail).moveTo(0,0).quadraticCurveTo(-26,-6,-22,-34).stroke({width:5,color:CAT,cap:'round'});
const catRig=rig(catParts,40,'idle',1.7);
const crowd=[];for(let i=0;i<3;i++){const f=figure(near,2800,662,104-i*6,[[CREAM,TEAL,RED][i],0x7a4b32,[TEAL,CREAM,INK][i]]);f.rig=rig(f,104,'idle',1.1);f.rig.face(-1);crowd.push(f)}
// The story: blue hour, first light, shutters, the street, the crowd — 30 seconds.
const light=[far,mid,near,front];
for(const l of light)l.tint=0x7d8bbb;
tl.label('light',4).label('open',9.5).label('street',16).label('crowd',22)
  .fromTo(sun,{rotation:-0.95},{rotation:-0.35},{duration:20,ease:'outSine'},'light-=1');
fade(dawnSky,0,'light+=4');fade(daySky,1,'<');relight(light,0xffd2a6,'light',4);relight(light,0xffffff,'open+=2');
fade(rays,1,'light+=1',3);fade(lamps,0,'light+=2',3);
pigeons.forEach((b,i)=>tl.to(b.root,{x:b.root.x+700+i*30,y:-80},{duration:4,ease:'inSine'},'light+='+(1.5+i*0.3)));
tl.to(shutters,{'scale.y':0.06},{duration:1.6,ease:'inOutCubic',stagger:0.9},'open')
  .from(keepers,{y:30,alpha:0},{duration:1,ease:'outCubic',stagger:0.9},'open+=1')
  .to(awnings,{'scale.y':1},{duration:1,ease:'outBack',stagger:0.5},'street-=1')
  .to(cam,{pan:1},{duration:10,ease:'inOutSine'},'street')
  .to(cat,{x:1160},{duration:10,ease:'linear'},'street');
crowd.forEach((f,i)=>tl.fromTo(f.root,{x:2760+i*120},{x:1560+i*110},{duration:7,ease:'linear'},'crowd+='+i*0.4));
fade(rays,0.35,'crowd',3);
loop(30,NIGHT);
play(13.5/30,function(T,t){
  catRig.set(t>16&&t<26?'walk':'idle');
  for(const f of crowd)f.rig.set(t>22&&t<29.5?'walk':'idle');
  pigeons.forEach((b,i)=>b.rig.set(t>5.5+i*0.3&&t<9.5+i*0.3?'run':'idle'));
});
`,
});
