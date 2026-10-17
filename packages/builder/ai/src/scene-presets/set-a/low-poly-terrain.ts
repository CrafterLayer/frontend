import { definePreset, range, sharedParams } from './define';

/**
 * Low-poly terrain: poisson points triangulated with `s.delaunay`, lifted by a
 * drifting fbm height field and flat-shaded by a light direction, with a lake
 * line and snow caps from the palette. The pointer moves the sun.
 */
export const LOW_POLY_TERRAIN = definePreset({
  id: 'low-poly-terrain',
  name: { en: 'Low-poly terrain', ar: 'تضاريس منخفضة المضلّعات' },
  description: {
    en: 'A faceted landscape of Delaunay triangles, flat-shaded by a moving sun and drifting slowly in the reading direction. The pointer moves the light.',
    ar: 'منظر طبيعي بأوجه من مثلّثات ديلوني مظلّلة بشمس متحرّكة ينجرف ببطء باتجاه القراءة، ويحرّك المؤشر الضوء.',
  },
  tags: ['generative', 'geometric', 'background', 'hero'],
  libs: ['kit', 'viewport'],
  params: [
    ...sharedParams({ seed: 31, interactive: true }),
    range('points', 'Points', 'عدد النقاط', 900, 200, 3000, 50, 'look'),
    range('heightScale', 'Relief', 'الارتفاع', 1, 0, 2, 0.05, 'look'),
    range('lightAngle', 'Sun angle', 'زاوية الشمس', 135, 0, 360, 5, 'look'),
    range('drift', 'Drift', 'الانجراف', 0.4, 0, 1, 0.05, 'motion'),
  ],
  code: String.raw`
const p=ck.params({palette:'theme',seed:31,speed:1,density:1,interactive:true,points:900,heightScale:1,lightAngle:135,drift:0.4});
const s=await ck.scene({libs:['viewport'],seed:p.seed,design:{width:1280,height:720,fit:'cover',zoom:true}});
const PIXI=s.PIXI,C=s.palette;
const sky=new PIXI.Graphics(),g=new PIXI.Graphics();
s.world.addChild(sky,g);
const stops=[C.colors[4],C.colors[0],C.colors[1],C.mix(C.colors[1],0xffffff,0.7)];
function tone(e){
  const x=Math.max(0,Math.min(0.999,e))*(stops.length-1),i=Math.floor(x);
  return C.mix(stops[i],stops[i+1],x-i);
}
let W=1,H=1,P=[],T3=[],frame=0,la=p.lightAngle*Math.PI/180;

function build(w,h){
  W=Math.max(1,w);H=Math.max(1,h);
  sky.clear();
  for(let i=0;i<16;i++)sky.rect(0,H*i/16,W,H/16+1).fill(C.mix(C.surface,C.colors[1],0.25*i/16));
  const r=Math.max(10,Math.sqrt(W*H/Math.max(50,s.count(p.points)))*0.9);
  P=s.poisson(W,H,r);
  for(let x=0;x<=W;x+=r)P.push([x,0],[x,H]);
  for(let y=r;y<H;y+=r)P.push([0,y],[W,y]);
  T3=s.delaunay(P).triangles;
  frame=0;
}
function height(x,y,T){
  const h=s.fbm((x-T*p.drift*30*s.dir)*0.0022,y*0.0026,4)*0.9+(y/H-0.5)*0.5;
  return Math.max(-0.18,h);
}
build(1280,720);
s.tick(function(time){
  if(!s.reducedMotion&&frame++%2)return;
  const T=s.reducedMotion?0:time.t*p.speed;
  let target=p.lightAngle*Math.PI/180;
  if(p.interactive&&s.pointer.inside&&!s.reducedMotion)target=Math.atan2(s.pointer.y-H/2,s.pointer.x-W/2)+Math.PI;
  la+=(target-la)*0.1;
  let lx=Math.cos(la)*0.6*s.dir,ly=Math.sin(la)*0.6,lz=0.75;
  const ln=Math.hypot(lx,ly,lz);lx/=ln;ly/=ln;lz/=ln;
  const amp=H*0.12*p.heightScale,Z=new Float32Array(P.length);
  for(let i=0;i<P.length;i++)Z[i]=height(P[i][0],P[i][1],T);
  g.clear();
  for(let i=0;i+2<T3.length;i+=3){
    const a=T3[i],b=T3[i+1],c=T3[i+2];
    const ax=P[a][0],ay=P[a][1],bx=P[b][0],by=P[b][1],cx=P[c][0],cy=P[c][1];
    const az=Z[a]*amp*2,bz=Z[b]*amp*2,cz=Z[c]*amp*2;
    const ux=bx-ax,uy=by-ay,uz=bz-az,vx=cx-ax,vy=cy-ay,vz=cz-az;
    let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
    if(nz<0){nx=-nx;ny=-ny;nz=-nz;}
    const nl=Math.hypot(nx,ny,nz)||1;
    const lam=Math.max(0,(nx*lx+ny*ly+nz*lz)/nl);
    const e=(Z[a]+Z[b]+Z[c])/3,water=e<=-0.17;
    const base=water?C.mix(C.colors[4],C.surface,0.25):tone(e*0.75+0.45);
    const col=C.mix(C.mix(base,0x000000,0.5),C.mix(base,0xffffff,0.2),water?0.6+0.2*lam:lam);
    g.poly([ax,ay-Z[a]*amp,bx,by-Z[b]*amp,cx,cy-Z[c]*amp]).fill(col);
  }
});
s.dispose(function(){P=[];T3=[];});
`,
});
