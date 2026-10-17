/*
  Bespoke murals composed ONLY with s.lib.mural (mural kit, 2026-10-14) — test fixtures, not
  presets. Each is the whole region script a model would write: one ck.scene and one
  s.lib.mural.compose(s, spec), kept under ~3,000 characters, to prove that any idea becomes a
  short, reliable composition. mural-kit.browser.test.ts renders every one.
*/

export interface MuralFixture {
  readonly id: string;
  readonly subject: string;
  readonly code: string;
}

const scene = (seed: number) =>
  `const s=await ck.scene({libs:['mural','anim'],seed:${String(seed)},design:{width:1280,height:720,fit:'cover'}});`;

export const MURAL_FIXTURES: readonly MuralFixture[] = [
  {
    id: 'coral-reef',
    subject: 'An underwater coral reef: a diver swims past fish, seaweed and coral',
    code: `${scene(11)}
s.lib.mural.compose(s,{width:2200,mood:'reef',time:'day',sky:false,ground:690,
layers:{
sky:['underwater'],
far:[{item:'plains',kind:'sand',y:560},{item:'coral',kind:'fan',count:6,size:120},{item:'seaweed',count:8}],
mid:[{item:'plains',kind:'sand',y:640},{item:'fish',id:'school',count:7,y:330,size:40},{item:'coral',kind:'brain',count:4},{item:'rocks',count:3}],
near:[{item:'plains',kind:'sand',y:690},{item:'coral',count:5,size:110},{item:'coral',kind:'fan',x:900,size:140},{item:'seaweed',count:7,size:150},{item:'fish',kind:'koi',id:'big',x:300,y:420,size:80},{item:'person',kind:'diver',id:'diver',x:150,y:330,size:130,colors:['#1f3a5a','#c68a5e']},{item:'bubbles',count:30}],
front:[{item:'seaweed',x:120,size:200},{item:'seaweed',x:2050,size:220}]},
beats:[
{label:'dive',dur:4},
{label:'school',camera:0.45,move:{school:{y:280}},walk:{diver:1000},dur:7},
{label:'reef',camera:0.9,walk:{diver:1750},move:{big:1500},dur:7},
{label:'rest',state:{diver:'idle'},dur:4,still:true}]});`,
  },
  {
    id: 'earth-to-moon',
    subject: 'A space journey: a rocket lifts off from Earth and lands on the Moon',
    code: `${scene(21)}
s.lib.mural.compose(s,{width:2600,mood:'space',time:'night',horizon:700,
layers:{
sky:['stars',{item:'comet',id:'comet',x:-200,y:140}],
far:[{item:'planet',kind:'ringed',x:1500,y:180,size:120}],
mid:[{item:'planet',kind:'earth',id:'earth',x:300,y:470,size:520},{item:'planet',kind:'moon',id:'moon',x:2350,y:420,size:360}],
near:[{item:'rocket',id:'rocket',x:420,y:330,size:90},{item:'sparkles',count:16,y:500}]},
beats:[
{label:'liftoff',move:{rocket:{y:250,rotation:0.5}},dur:4},
{label:'cruise',camera:0.5,move:{rocket:{x:1300,y:240,rotation:1.5},comet:{x:1100,y:300}},dur:7},
{label:'approach',camera:1,move:{rocket:{x:2160,y:150,rotation:2.6}},dur:7,still:true},
{label:'landing',move:{rocket:{y:200,rotation:3.14}},dur:4}]});`,
  },
  {
    id: 'ramadan-night',
    subject: 'Ramadan night in an old Arab city: the crescent rises and the lanterns light',
    code: `${scene(31)}
s.lib.mural.compose(s,{width:2400,mood:'oldcity',time:['dusk','night'],
layers:{
sky:['stars',{item:'moon',kind:'crescent',id:'moon',x:980,y:150,size:130}],
far:[{item:'hills',size:60},{item:'skyline',kind:'old',size:80}],
mid:[{item:'skyline',kind:'old'},{item:'mosque',x:1300,size:150,kind:'gold'}],
near:[{item:'plains',kind:'sand',y:650,color:'#b89a72'},{item:'house',kind:'arab',count:6,size:130},{item:'palm',count:4,size:190},{item:'lanterns',from:150,to:1050,y:430,count:9},{item:'lanterns',from:1350,to:2250,y:420,count:9},
{item:'person',id:'father',x:300,colors:['#f2efe6']},{item:'person',kind:'child',id:'kid',x:250,colors:['#2f7d7a']},{item:'cat',id:'cat',x:1700,size:60}]},
beats:[
{label:'iftar',dur:4},
{label:'walk',camera:0.5,walk:{father:1150,kid:1100},dur:7},
{label:'night',time:'night',lights:'on',state:{kid:'wave'},dur:6,still:true},
{label:'square',camera:0.85,walk:{father:1900,kid:1850},dur:6}]});`,
  },
  {
    id: 'japanese-garden',
    subject: 'A Japanese-style garden: a blossom tree, a koi pond, a red bridge and a pagoda',
    code: `${scene(41)}
s.lib.mural.compose(s,{width:2000,mood:'garden',time:['dawn','day','golden'],
layers:{
sky:['sun',{item:'clouds',count:4,kind:'streak'}],
far:[{item:'mountains',size:240,snow:true},{item:'pagoda',x:1400,size:150}],
mid:[{item:'hills',size:50},{item:'tree',kind:'pine',count:5},{item:'torii',x:600,size:130}],
near:[{item:'plains',y:620},{item:'lake',kind:'pond',x:1050,y:665,size:90},{item:'fish',kind:'koi',id:'koi',count:3,from:900,to:1200,y:665,size:30},{item:'bridge',kind:'wood',x:700,y:640,size:90},
{item:'tree',kind:'blossom',id:'sakura',x:420,size:260},{item:'tree',kind:'blossom',x:1600,size:220},{item:'bush',count:6,flowers:true},{item:'lantern',kind:'street',x:1300,size:90},{item:'person',kind:'dress',id:'walker',x:200,colors:['#c8402e','#e0b090','#1c2633']}],
front:[{item:'grass',from:0,to:2000,y:720}]},
beats:[
{label:'dawn',dur:4},
{label:'stroll',camera:0.4,walk:{walker:560},grow:['sakura'],dur:7},
{label:'pond',move:{koi:{x:1150}},state:{walker:'think'},dur:5,still:true},
{label:'evening',camera:1,walk:{walker:1480},dur:6}]});`,
  },
  {
    id: 'winter-village',
    subject: 'A snowy mountain village in winter: dusk falls, windows and the tree light up',
    code: `${scene(51)}
s.lib.mural.compose(s,{width:2200,mood:'winter',time:['day','dusk','night'],
layers:{
sky:['stars',{item:'moon',kind:'full',x:300,y:150},{item:'clouds',count:3},{item:'snow',count:140}],
far:[{item:'mountains',kind:'snowy',size:300}],
mid:[{item:'hills',size:60},{item:'tree',kind:'pine',count:10,snow:true}],
near:[{item:'plains',kind:'snow',y:630},{item:'house',count:5,snow:true,size:130},{item:'tree',kind:'pine',x:1150,size:240,snow:true,lights:true},{item:'tree',kind:'bare',count:3,size:170,snow:true},{item:'lantern',kind:'street',x:700},{item:'lantern',kind:'street',x:1600},
{item:'person',kind:'casual',id:'kid',x:200,size:80,head:'hat'},{item:'dog',id:'dog',x:140,size:60}]},
beats:[
{label:'snowfall',dur:4},
{label:'path',camera:0.5,walk:{kid:1050,dog:1000},dur:7},
{label:'dusk',time:'dusk',state:{kid:'celebrate'},dur:5},
{label:'lights',time:'night',lights:'on',dur:6,still:true}],
still:'lights'});`,
  },
  {
    id: 'amman-skyline',
    subject: 'An Amman / Jerusalem skyline on the hills, from dusk to night',
    code: `${scene(61)}
s.lib.mural.compose(s,{width:2400,mood:'oldcity',time:['golden','dusk','night'],horizon:430,
layers:{
sky:['stars','sun',{item:'moon',kind:'crescent',x:1000,y:120}],
far:[{item:'hills',size:120},{item:'skyline',kind:'modern',size:70,from:1500,to:2400}],
mid:[{item:'hills',size:80},{item:'skyline',kind:'old',size:90},{item:'mosque',kind:'gold',x:900,size:170}],
near:[{item:'hills',size:60,y:640},{item:'house',kind:'arab',count:7,y:650,size:120},{item:'tree',kind:'olive',count:4,y:660},{item:'tree',kind:'cypress',count:5,y:660,size:180},{item:'lantern',kind:'street',count:4,y:660},
{item:'bird',id:'birds',count:5,y:200,size:50}]},
beats:[
{label:'golden',move:{birds:{x:1200,y:150}},dur:5},
{label:'dusk',time:'dusk',camera:0.5,dur:6},
{label:'night',time:'night',camera:0.85,dur:7,still:true},
{label:'calm',camera:0.2,dur:6}]});`,
  },
  {
    id: 'fairy-forest',
    subject: 'A fairy-tale forest: a castle on the hill, fireflies at dusk and a dragon in flight',
    code: `${scene(71)}
s.lib.mural.compose(s,{width:2200,mood:'fairy',time:['dusk','night'],
layers:{
sky:['stars',{item:'moon',kind:'full',x:1050,y:130,size:140},{item:'aurora',y:260}],
far:[{item:'mountains',size:260},{item:'castle',id:'castle',x:1500,y:430,size:130}],
mid:[{item:'hills',size:80},{item:'tree',kind:'pine',count:12,size:200},{item:'dragon',id:'dragon',x:-100,y:200,size:90}],
near:[{item:'plains',y:640},{item:'tree',kind:'pine',count:6,size:300},{item:'tree',kind:'round',count:4,size:220},{item:'bush',count:6},{item:'flowers',count:30,y:670},{item:'campfire',x:700,size:90},
{item:'person',kind:'dress',id:'hero',x:200,colors:['#6a4aa0']},{item:'fireflies',count:36,y:600},{item:'sparkles',id:'magic',count:20,y:560}],
front:[{item:'tree',kind:'pine',x:60,size:420},{item:'tree',kind:'pine',x:2150,size:400}]},
beats:[
{label:'woods',dur:4},
{label:'path',camera:0.5,walk:{hero:1000},dur:7},
{label:'dragon',fly:{dragon:{x:2000,y:150}},state:{hero:'think'},show:['magic'],time:'night',lights:'on',dur:7,still:true},
{label:'castle',camera:1,walk:{hero:1700},dur:6}]});`,
  },
  {
    id: 'farm-day',
    subject: 'A farm day with animals: dawn, the windmill turns, cows and sheep graze, golden hour',
    code: `${scene(81)}
s.lib.mural.compose(s,{width:2400,mood:'farm',time:['dawn','day','golden'],
layers:{
sky:['sun',{item:'clouds',count:5}],
far:[{item:'hills',size:90},{item:'tree',kind:'round',count:8,size:110}],
mid:[{item:'plains',kind:'fields',y:560},{item:'windmill',x:1500,size:150},{item:'barn',x:600,size:140}],
near:[{item:'plains',y:640},{item:'fence',from:0,to:2400,y:660},{item:'cow',count:3,from:200,to:900,y:680},{item:'sheep',count:4,from:1100,to:1700,y:690},{item:'horse',id:'horse',x:1900,y:690},
{item:'person',kind:'casual',id:'farmer',x:300,head:'hat',size:110},{item:'dog',id:'dog',x:240,size:60},{item:'tree',kind:'round',x:2200,size:260},{item:'flowers',count:30,y:700},{item:'bird',id:'birds',count:4,y:180,size:40}],
front:[{item:'grass',y:720}]},
beats:[
{label:'dawn',move:{birds:{x:1500}},dur:4},
{label:'work',camera:0.45,walk:{farmer:1100,dog:1040},dur:7},
{label:'graze',camera:0.8,walk:{horse:1600},state:{farmer:'wave'},dur:6,still:true},
{label:'golden',time:'golden',walk:{farmer:1800,dog:1750},dur:6}]});`,
  },
  {
    id: 'harbour-train',
    subject: 'A seaside harbour at golden hour: a tall ship sails in, a train runs along the coast',
    code: `${scene(91)}
s.lib.mural.compose(s,{width:2600,mood:'sea',time:['day','golden','dusk'],horizon:430,
layers:{
sky:['sun',{item:'clouds',count:4},{item:'bird',id:'gulls',count:4,y:180,size:40}],
far:[{item:'hills',size:110},{item:'skyline',size:70,from:0,to:900}],
mid:[{item:'sea',y:470},{item:'ship',id:'ship',x:2300,y:575,size:110},{item:'boat',count:3,from:300,to:1200,y:610,size:70},{item:'bridge',x:1900,y:600,size:110}],
near:[{item:'plains',kind:'road',y:640},{item:'train',id:'train',x:-300,y:646,size:55,count:3},{item:'car',id:'car',x:2400,y:690},{item:'house',count:4,from:1800,to:2600,size:120,y:642},{item:'lantern',kind:'street',count:6,y:642},{item:'tree',kind:'palm',count:3,from:0,to:600,size:210,y:642}],
front:[{item:'waves',y:740,size:40}]},
beats:[
{label:'harbour',move:{gulls:{x:1300}},dur:4},
{label:'ship',camera:0.5,move:{ship:1300,train:1500},dur:8},
{label:'golden',time:'golden',move:{car:900},dur:6,still:true},
{label:'dusk',time:'dusk',camera:0.9,lights:'on',move:{train:3100},dur:6}]});`,
  },
];
