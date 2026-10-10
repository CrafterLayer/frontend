import { definePreset, range, select, sharedParams, toggle } from './define';

/**
 * An Islamic star pattern built with Hankin's "polygons in contact" method:
 * a tiling (6: hexagons; 8: octagons + squares; 10: decagons + girih bowties;
 * 12: dodecagons + triangles) gets two rays from every edge midpoint at the
 * contact angle, the rays are paired by their nearest symmetric meeting point,
 * and the resulting strapwork draws itself from the inline-start edge, then
 * glows. The pointer kindles the lines it passes.
 */
export const GIRIH_STARFIELD = definePreset({
  id: 'girih-starfield',
  name: { en: 'Girih starfield', ar: 'نجوم الگره' },
  description: {
    en: 'A true Islamic star pattern (Hankin method) in 6, 8, 10 or 12-fold symmetry: gold strapwork draws itself in reading order, then glows.',
    ar: 'زخرفة نجمية إسلامية حقيقية بطريقة هانكن بتناظر سداسي أو ثماني أو عشاري أو اثني عشري: أشرطة ذهبية ترسم نفسها باتجاه القراءة ثم تتوهّج.',
  },
  tags: ['arabic', 'geometric', 'light', 'hero', 'bold'],
  libs: ['kit', 'filters'],
  params: [
    ...sharedParams({ seed: 1, interactive: true }),
    select(
      'fold',
      'Symmetry',
      'التناظر',
      '10',
      [
        ['6', '6-fold', 'سداسي'],
        ['8', '8-fold', 'ثماني'],
        ['10', '10-fold', 'عشاري'],
        ['12', '12-fold', 'اثنا عشري'],
      ],
      'look',
    ),
    range('contactAngle', 'Contact angle', 'زاوية التماس', 60, 30, 80, 1, 'look'),
    range('tileSize', 'Tile size', 'حجم البلاطة', 150, 60, 320, 5, 'look'),
    range('drawDuration', 'Drawing time (s)', 'زمن الرسم (ث)', 6, 1, 20, 0.5, 'motion'),
    toggle('goldLeaf', 'Gold leaf', 'ورق الذهب', true, 'look'),
  ],
  code: String.raw`
const p=ck.params({palette:'theme',seed:1,speed:1,density:1,interactive:true,fold:'10',contactAngle:60,tileSize:150,drawDuration:6,goldLeaf:true});
const s=await ck.scene({libs:['filters'],seed:p.seed});
const PIXI=s.PIXI,C=s.palette,F=s.lib.filters,D=Math.PI/180,TAU=Math.PI*2;
const fold=[6,8,10,12].indexOf(+p.fold)>=0?+p.fold:10;
const gold=p.goldLeaf?C.mix(0xd8b25a,C.accent,0.15):C.accent;
const deep=C.dark?C.surface:C.mix(C.colors[4],0x000000,0.6);
const bg=new PIXI.Graphics(),guide=new PIXI.Graphics(),fills=new PIXI.Graphics(),art=new PIXI.Container();
const band=new PIXI.Graphics(),core=new PIXI.Graphics(),hot=new PIXI.Graphics();
hot.blendMode='add';
art.addChild(band,core,hot);
s.stage.addChild(bg,guide,fills,art);
const glow=new F.GlowFilter({distance:10,outerStrength:1.2,innerStrength:0,color:gold,quality:0.15});
art.filters=[glow];
let W=1,H=1,r=75,lw=4,segs=[],stars=[],done=false;

function reg(cx,cy,n,ap,rot){const R=ap/Math.cos(Math.PI/n),v=[];for(let k=0;k<n;k++){const a=rot+Math.PI/n+TAU*k/n;v.push([cx+R*Math.cos(a),cy+R*Math.sin(a)]);}return v;}
function tiles(){
  const out=[],q3=Math.sqrt(3),Rd=r/Math.cos(18*D);
  const v1=[2*r,0],v2=fold===8?[0,2*r]:fold===10?[2*r*Math.cos(72*D),2*r*Math.sin(72*D)]:[r,q3*r];
  function V(c,k){const a=(18+36*k)*D;return [c[0]+Rd*Math.cos(a),c[1]+Rd*Math.sin(a)];}
  const span=Math.ceil(Math.hypot(W,H)/(r*1.2))+2;
  for(let i=-span;i<=span;i++)for(let j=-span;j<=span;j++){
    const cx=W/2+i*v1[0]+j*v2[0],cy=H/2+i*v1[1]+j*v2[1];
    if(cx<-3*r||cx>W+3*r||cy<-3*r||cy>H+3*r)continue;
    out.push({v:reg(cx,cy,fold,r,0),main:true});
    if(fold===8)out.push({v:reg(cx+r,cy+r,4,r*Math.tan(22.5*D),Math.PI/4)});
    if(fold===12){const t=r*Math.tan(15*D)/q3;out.push({v:reg(cx+r,cy+r/q3,3,t,Math.PI/2)},{v:reg(cx+2*r,cy+2*r/q3,3,t,Math.PI/6)});}
    if(fold===10){const d0=[cx,cy],d1=[cx+v1[0],cy+v1[1]],d2=[cx+v2[0],cy+v2[1]],d3=[d1[0]+v2[0],d1[1]+v2[1]];out.push({v:[V(d0,0),V(d0,1),V(d2,8),V(d2,9),V(d3,6),V(d1,3)]});}
  }
  return out;
}
// Hankin: two rays per edge midpoint at the contact angle, paired by the nearest symmetric meeting.
function hankin(poly,th){
  const n=poly.length,rays=[];let area=0;
  for(let i=0;i<n;i++){const a=poly[i],b=poly[(i+1)%n];area+=a[0]*b[1]-b[0]*a[1];}
  const c=Math.cos(th),sn=Math.sin(th)*(area>0?1:-1);
  for(let i=0;i<n;i++){
    const a=poly[i],b=poly[(i+1)%n],el=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/el,uy=(b[1]-a[1])/el;
    const mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2;
    rays.push({x:mx,y:my,dx:ux*c-uy*sn,dy:ux*sn+uy*c,e:i},{x:mx,y:my,dx:-ux*c-uy*sn,dy:ux*sn-uy*c,e:i});
  }
  const cand=[];
  for(let i=0;i<rays.length;i++)for(let j=i+1;j<rays.length;j++){
    const A=rays[i],B=rays[j];
    if(A.e===B.e)continue;
    const cr=A.dx*B.dy-A.dy*B.dx;
    if(Math.abs(cr)<1e-9)continue;
    const qx=B.x-A.x,qy=B.y-A.y,t=(qx*B.dy-qy*B.dx)/cr,u=(qx*A.dy-qy*A.dx)/cr;
    if(t>1e-6&&u>1e-6)cand.push([t+u+Math.abs(t-u)*0.5,i,j,t]);
  }
  cand.sort(function(a,b){return a[0]-b[0];});
  const used=new Set(),pairs=[];
  for(const q of cand){
    if(used.has(q[1])||used.has(q[2]))continue;
    used.add(q[1]);used.add(q[2]);
    const A=rays[q[1]],B=rays[q[2]];
    pairs.push([A.x,A.y,B.x,B.y,A.x+A.dx*q[3],A.y+A.dy*q[3]]);
  }
  return pairs;
}
function build(w,h){
  W=Math.max(1,w);H=Math.max(1,h);
  r=Math.max(20,p.tileSize/2/Math.sqrt(Math.max(0.2,p.density)));lw=Math.max(1.5,r*0.07);
  bg.clear().rect(0,0,W,H).fill(deep);
  guide.clear();segs=[];stars=[];done=false;
  const th=Math.max(20,Math.min(85,p.contactAngle))*D,x0=s.dir>0?0:W,dur=p.drawDuration*0.8;
  const list=tiles();
  for(let k=0;k<list.length;k++){
    const t=list[k];
    guide.poly(t.v.flat());
    const pairs=hankin(t.v,th),pts=[];
    let cx=0,cy=0;for(const v of t.v){cx+=v[0];cy+=v[1];}cx/=t.v.length;cy/=t.v.length;
    const d0=Math.abs(cx-x0)/W*dur+s.rand(0,0.25);
    for(const q of pairs){
      segs.push({x1:q[0],y1:q[1],x2:q[4],y2:q[5],d:d0},{x1:q[2],y1:q[3],x2:q[4],y2:q[5],d:d0+0.12});
      pts.push([q[0],q[1]],[q[2],q[3]],[q[4],q[5]]);
    }
    if(t.main&&pts.length>2){
      pts.sort(function(a,b){return Math.atan2(a[1]-cy,a[0]-cx)-Math.atan2(b[1]-cy,b[0]-cx);});
      stars.push({pts:pts.flat(),d:d0,c:k%2?C.colors[0]:C.colors[4]});
    }
  }
  guide.stroke({width:1,color:gold,alpha:0.25});
}
function draw(T){
  band.clear();core.clear();fills.clear();
  let all=true;
  for(const st of stars){
    const k=Math.max(0,Math.min(1,(T-st.d-0.6)/1.2));
    if(k<1)all=false;
    if(k>0)fills.poly(st.pts).fill({color:st.c,alpha:0.3*k});
  }
  for(const q of segs){
    const k=Math.max(0,Math.min(1,(T-q.d)/0.7));
    if(k<1)all=false;
    if(k<=0)continue;
    const ex=q.x1+(q.x2-q.x1)*k,ey=q.y1+(q.y2-q.y1)*k;
    band.moveTo(q.x1,q.y1).lineTo(ex,ey);core.moveTo(q.x1,q.y1).lineTo(ex,ey);
  }
  band.stroke({width:lw,color:gold,cap:'round',join:'round'});
  core.stroke({width:lw*0.36,color:deep,cap:'round',join:'round'});
  return all;
}
build(s.width,s.height);
s.onResize(build);
s.tick(function(time){
  const T=s.reducedMotion?1e4:time.t*p.speed;
  if(!done)done=draw(T);
  guide.alpha=Math.max(0.25,1-T/Math.max(1,p.drawDuration));
  glow.outerStrength=s.reducedMotion?1.3:1.1+0.6*Math.sin(T*1.1);
  hot.clear();
  if(p.interactive&&s.pointer.inside&&!s.reducedMotion){
    for(const q of segs){
      const dx=(q.x1+q.x2)/2-s.pointer.x,dy=(q.y1+q.y2)/2-s.pointer.y;
      if(dx*dx+dy*dy<14400)hot.moveTo(q.x1,q.y1).lineTo(q.x2,q.y2);
    }
    hot.stroke({width:lw*0.8,color:C.mix(gold,0xffffff,0.5),alpha:0.8,cap:'round'});
  }
});
s.dispose(function(){art.filters=null;glow.destroy();});
`,
});
