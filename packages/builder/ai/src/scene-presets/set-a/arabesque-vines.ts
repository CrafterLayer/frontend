import { definePreset, range, select, sharedParams } from './define';

/**
 * Arabesque vines: S-scrolls sprout across the whole region and grow both ways,
 * each half curling into a tightening scroll; branch with the opposite turn (the alternating rhythm of
 * the arabesque) and open palmettes, leaves or buds where they reach. Grown
 * stem is stamped once into a render texture, so a frame only draws the new
 * tips. Once grown, fresh tendrils keep sprouting now and then, the leaves sway
 * and the palmettes breathe; the pointer stirs them.
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
const PIXI=s.PIXI,C=s.palette,R=s.app.renderer;
const bg=new PIXI.Graphics(),view=new PIXI.Sprite(),leafLayer=new PIXI.Container();
const bake=new PIXI.Container(),ink=new PIXI.Graphics();
bake.addChild(ink);
s.stage.addChild(bg,view,leafLayer);
const stem=[C.colors[0],C.colors[4],C.colors[0],C.colors[4]],leafCols=[C.colors[1],C.colors[4],C.colors[0]];
const PACE=220*p.growthSpeed;
// Everything is laid out left to right and mirrored on the way to the screen (X), so RTL reads the same.
let W=1,H=1,V=[],L=[],total=1,cap=240,rt=null,sprout=2,sprouts=0;
function X(x){return s.dir<0?W-x:x;}

function grow(x,y,a,len,w,depth,turn,start){
  const v={pts:[[x,y]],w:w,start:start,depth:depth,turn:turn,drawn:1};
  V.push(v);
  const n=Math.max(8,Math.round(len/6));
  let at=start;
  for(let i=1;i<=n;i++){
    const u=i/n;
    // An S: a gentle counter-curve, then a scroll that tightens to the tip.
    a+=turn*(0.03*(u-0.35)+p.curlStrength*0.5*u*u*u)+s.noise2(x*0.004,y*0.004+depth)*0.04;
    if(x<20||x>W-20||y<20||y>H-20){const want=Math.atan2(H/2-y,W/2-x);a+=Math.sign(Math.sin(want-a))*0.12;}
    x+=Math.cos(a)*6;y+=Math.sin(a)*6;at+=6;
    v.pts.push([x,y]);
    if(depth<3&&V.length<cap&&i>4&&i<n*0.8&&s.random()<p.branching*0.12)grow(x,y,a+turn*0.9,len*s.rand(0.5,0.8),w*0.62,depth+1,-turn,at);
    if(i%5===0&&i<n-3&&s.random()<0.75)L.push({x:x,y:y,a:a+turn*(i%10?1.2:-1.2),size:w*4.6,at:at});
  }
  L.push({x:x,y:y,a:a,size:w*8,at:at,big:true});
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
  G.x=X(o.x);G.y=o.y;o.ra=s.dir<0?Math.PI-o.a:o.a;G.rotation=o.ra;G.scale.set(0);
  leafLayer.addChild(G);
  o.g=G;o.ph=i*0.7;
}
function build(w,h){
  W=Math.max(1,w);H=Math.max(1,h);V=[];L=[];total=1;sprout=2;sprouts=0;
  bg.clear().rect(0,0,W,H).fill(C.surface);
  rt=s.rt(W,H);view.texture=rt;
  ink.clear();R.render({container:bake,target:rt,clear:true});
  leafLayer.removeChildren().forEach(function(c){c.destroy();});
  // A vine is the arabesque's S-scroll: it sprouts in one cell of a loose grid over the whole stage
  // and grows both ways, each half curling the other way into a tightening scroll.
  const scale=Math.min(2,Math.max(1,Math.sqrt(W*H/230400))),n=Math.max(1,Math.min(28,s.count(p.vines*scale))),m=Math.min(W,H);
  const cols=Math.max(1,Math.round(Math.sqrt(n*W/H))),rows=Math.max(1,Math.ceil(n/cols)),cell=Math.min(W/cols,H/rows);
  cap=s.count(240*scale);
  const wid=Math.max(2,m*0.009);
  for(let k=0;k<n;k++){
    const c=k%cols,r=Math.floor(k/cols),x=W*(c+s.rand(0.3,0.7))/cols,y=H*(r+s.rand(0.3,0.7))/rows;
    const a=s.rand(0,Math.PI*2),turn=k%2?1:-1,len=cell*s.rand(1,1.35),t0=s.rand(0,40);
    grow(x,y,a,len,wid,0,turn,t0);
    grow(x,y,a+Math.PI,len*s.rand(0.75,0.95),wid,0,-turn,t0);
  }
  L.forEach(leaf);
}
// Stamp the stem grown since the last frame into the render texture (thinner each quarter and each depth).
function stamp(reach){
  ink.clear();
  let any=false;
  for(let d=0;d<4;d++)for(let c=0;c<4;c++){
    let some=false;
    for(const v of V){
      if(v.depth!==d||reach<=v.start)continue;
      const n=v.pts.length,shown=Math.min(n,Math.floor((reach-v.start)/6)+1),a=Math.max(v.drawn-1,Math.floor(n*c/4)),b=Math.min(shown,Math.floor(n*(c+1)/4)+1);
      if(b-a<2)continue;
      ink.moveTo(X(v.pts[a][0]),v.pts[a][1]);
      for(let i=a+1;i<b;i++)ink.lineTo(X(v.pts[i][0]),v.pts[i][1]);
      some=true;
    }
    if(some){any=true;ink.stroke({width:Math.max(0.8,Math.max(2,Math.min(W,H)*0.009)*Math.pow(0.62,d)*(1-0.55*c/4)),color:stem[d],cap:'round',join:'round'});}
  }
  for(const v of V)if(reach>v.start)v.drawn=Math.min(v.pts.length,Math.floor((reach-v.start)/6)+1);
  if(any)R.render({container:bake,target:rt,clear:false});
}
// Once the vines are grown, a fresh tendril sprouts from an older stem now and then.
function tendril(reach){
  const v=s.pick(V);
  if(!v||v.depth>2||v.pts.length<10)return;
  const i=s.int(4,v.pts.length-4),q=v.pts[i],o=v.pts[i-1],a=Math.atan2(q[1]-o[1],q[0]-o[0]),from=L.length;
  grow(q[0],q[1],a+v.turn*0.9,Math.min(W,H)*s.rand(0.15,0.3),v.w*0.62,v.depth+1,-v.turn,reach);
  for(let k=from;k<L.length;k++)leaf(L[k],k);
  sprouts++;
}
build(s.width,s.height);
s.onResize(build);
s.tick(function(time){
  const T=s.reducedMotion?1e6:time.t*p.speed;
  const reach=T*PACE;
  stamp(reach);
  if(!s.reducedMotion&&reach>total){
    sprout-=time.dt*p.speed;
    if(sprout<0&&sprouts<40&&V.length<cap*1.5){sprout=s.rand(1,2.2);tendril(reach);}
  }
  const on=p.interactive&&s.pointer.inside&&!s.reducedMotion;
  for(const o of L){
    const k=Math.max(0,Math.min(1,(reach-o.at)/80)),e=k<1?1-Math.pow(1-k,3):1;
    let sway=s.reducedMotion?0:0.06*Math.sin(T*1.5+o.ph);
    if(on){const dx=o.g.x-s.pointer.x,dy=o.y-s.pointer.y;if(dx*dx+dy*dy<10000)sway+=0.25*Math.sin(T*9+o.ph);}
    o.g.scale.set(e*(o.big&&!s.reducedMotion?1+0.07*Math.sin(T*0.9+o.ph):1));
    o.g.rotation=o.ra+sway;
  }
});
s.dispose(function(){V=[];L=[];bake.destroy({children:true});});
`,
});
