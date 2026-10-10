import { definePreset, range, select, sharedParams } from './define';

/**
 * Arabesque vines: stems grow in from the region's edges, curl into tightening
 * scrolls, branch with the opposite turn (the alternating rhythm of the
 * arabesque) and open palmettes, leaves or buds where they reach. Once grown,
 * the leaves sway; the pointer stirs them.
 */
export const ARABESQUE_VINES = definePreset({
  id: 'arabesque-vines',
  name: { en: 'Arabesque vines', ar: 'أغصان الأرابيسك' },
  description: {
    en: 'Vines grow from the edges into curling arabesque scrolls with alternating branches, opening palmettes and leaves, then sway gently.',
    ar: 'أغصان تنمو من الحواف في لفائف أرابيسك ملتفّة بفروع متناوبة، تتفتّح فيها الأوراق والمراوح النخيلية ثم تتمايل بلطف.',
  },
  tags: ['arabic', 'generative', 'calm', 'background'],
  libs: ['kit'],
  params: [
    ...sharedParams({ seed: 12, interactive: true }),
    range('vines', 'Vines', 'عدد الأغصان', 6, 2, 14, 1, 'look'),
    range('growthSpeed', 'Growth speed', 'سرعة النموّ', 1, 0.2, 3, 0.05, 'motion'),
    range('branching', 'Branching', 'التفرّع', 0.5, 0, 1, 0.05, 'look'),
    range('curlStrength', 'Curl', 'الالتفاف', 0.6, 0, 1, 0.05, 'look'),
    select(
      'leafShape',
      'Leaf',
      'شكل الورقة',
      'palmette',
      [
        ['palmette', 'Palmette', 'مروحة نخيلية'],
        ['leaf', 'Leaf', 'ورقة'],
        ['bud', 'Bud', 'برعم'],
      ],
      'look',
    ),
  ],
  code: String.raw`
const p=ck.params({palette:'theme',seed:12,speed:1,density:1,interactive:true,vines:6,growthSpeed:1,branching:0.5,curlStrength:0.6,leafShape:'palmette'});
const s=await ck.scene({libs:[],seed:p.seed});
const PIXI=s.PIXI,C=s.palette;
const bg=new PIXI.Graphics(),g=new PIXI.Graphics(),leafLayer=new PIXI.Container();
s.stage.addChild(bg,g,leafLayer);
const stem=[C.colors[0],C.colors[4],C.colors[0],C.colors[4]],leafCols=[C.colors[1],C.colors[4],C.colors[0]];
let W=1,H=1,V=[],L=[],total=1,cap=160;

function grow(x,y,a,len,w,depth,turn,start){
  const v={pts:[[x,y]],w:w,start:start,depth:depth};
  V.push(v);
  const n=Math.max(8,Math.round(len/6));
  let at=start;
  for(let i=1;i<=n;i++){
    const u=i/n;
    a+=turn*(0.01+p.curlStrength*0.16*u*u*u)+s.noise2(x*0.004,y*0.004+depth)*0.04;
    if(x<20||x>W-20||y<20||y>H-20){const want=Math.atan2(H/2-y,W/2-x);a+=Math.sign(Math.sin(want-a))*0.12;}
    x+=Math.cos(a)*6;y+=Math.sin(a)*6;at+=6;
    v.pts.push([x,y]);
    if(depth<3&&V.length<cap&&i>4&&i<n*0.8&&s.random()<p.branching*0.035)grow(x,y,a+turn*0.9,len*s.rand(0.45,0.7),w*0.62,depth+1,-turn,at);
    if(i%7===0&&s.random()<0.7)L.push({x:x,y:y,a:a+turn*(i%14?1.3:-1.3),size:w*3.2,at:at});
  }
  L.push({x:x,y:y,a:a,size:w*5,at:at,big:true});
  total=Math.max(total,at);
}
function leaf(o,i){
  const G=new PIXI.Graphics(),z=o.size,col=leafCols[i%3],shape=o.big?'palmette':p.leafShape;
  if(shape==='palmette'){
    for(let k=-2;k<=2;k++){
      const r=k*0.38,l=z*(1-0.15*Math.abs(k)),cx=Math.cos(r),sn=Math.sin(r);
      G.moveTo(0,0).quadraticCurveTo((l*0.5)*cx-(l*0.3)*sn,(l*0.5)*sn+(l*0.3)*cx,l*cx,l*sn).quadraticCurveTo((l*0.5)*cx+(l*0.3)*sn,(l*0.5)*sn-(l*0.3)*cx,0,0);
    }
    G.fill(col).stroke({width:1,color:C.mix(col,0x000000,0.35),alpha:0.6});
    G.circle(0,0,z*0.16).fill(C.colors[0]);
  }else if(shape==='bud'){
    G.moveTo(0,0).quadraticCurveTo(z*0.2,-z*0.35,z*0.75,0).quadraticCurveTo(z*0.2,z*0.35,0,0).fill(col);
    G.circle(z*0.55,0,z*0.2).fill(C.colors[1]);
  }else{
    G.moveTo(0,0).quadraticCurveTo(z*0.5,-z*0.38,z,0).quadraticCurveTo(z*0.5,z*0.38,0,0).fill(col);
    G.moveTo(z*0.08,0).lineTo(z*0.85,0).stroke({width:1,color:C.mix(col,0x000000,0.4),alpha:0.7});
  }
  G.x=o.x;G.y=o.y;G.rotation=o.a;G.scale.set(0);
  leafLayer.addChild(G);
  o.g=G;o.ph=i*0.7;
}
function build(w,h){
  W=Math.max(1,w);H=Math.max(1,h);V=[];L=[];total=1;
  bg.clear().rect(0,0,W,H).fill(C.surface);
  leafLayer.removeChildren().forEach(function(c){c.destroy();});
  const n=Math.max(1,Math.min(14,s.count(p.vines))),m=Math.min(W,H);
  cap=s.count(160);
  for(let k=0;k<n;k++){
    const e=k%3,turn=k%2?1:-1,len=s.rand(0.7,1.2)*m*0.9,w=Math.max(2,m*0.008);
    if(e===0)grow(s.rand(W*0.1,W*0.9),H+4,-Math.PI/2+s.rand(-0.4,0.4),len,w,0,turn,0);
    else if(e===1)grow(-4,s.rand(H*0.2,H*0.9),s.rand(-0.4,0.3),len,w,0,turn,s.rand(0,40));
    else grow(s.rand(0,W*0.3),-4,Math.PI/2+s.rand(-0.5,0.2),len*0.8,w,0,turn,s.rand(20,80));
  }
  if(s.dir<0){
    for(const v of V)for(const q of v.pts)q[0]=W-q[0];
    for(const o of L){o.x=W-o.x;o.a=Math.PI-o.a;}
  }
  L.forEach(leaf);
}
build(s.width,s.height);
s.onResize(build);
let done=false;
s.tick(function(time){
  const T=s.reducedMotion?1e6:time.t*p.speed;
  const reach=T*p.growthSpeed*140;
  if(!done){
    g.clear();
    for(let d=0;d<4;d++)for(let c=0;c<4;c++){
      let any=false;
      for(const v of V){
        if(v.depth!==d||reach<=v.start)continue;
        const n=v.pts.length,shown=Math.min(n,Math.floor((reach-v.start)/6)+1),a=Math.floor(n*c/4),b=Math.min(shown,Math.floor(n*(c+1)/4)+1);
        if(b-a<2)continue;
        g.moveTo(v.pts[a][0],v.pts[a][1]);
        for(let i=a+1;i<b;i++)g.lineTo(v.pts[i][0],v.pts[i][1]);
        any=true;
      }
      if(any)g.stroke({width:Math.max(0.8,Math.max(2,Math.min(W,H)*0.008)*Math.pow(0.62,d)*(1-0.55*c/4)),color:stem[d],cap:'round',join:'round'});
    }
    done=reach>total+120;
  }
  const on=p.interactive&&s.pointer.inside&&!s.reducedMotion;
  for(const o of L){
    const k=Math.max(0,Math.min(1,(reach-o.at)/80)),e=k<1?1-Math.pow(1-k,3):1;
    let sway=s.reducedMotion?0:0.06*Math.sin(T*1.5+o.ph);
    if(on){const dx=o.x-s.pointer.x,dy=o.y-s.pointer.y;if(dx*dx+dy*dy<10000)sway+=0.25*Math.sin(T*9+o.ph);}
    o.g.scale.set(e);
    o.g.rotation=o.a+sway;
  }
});
s.dispose(function(){V=[];L=[];});
`,
});
