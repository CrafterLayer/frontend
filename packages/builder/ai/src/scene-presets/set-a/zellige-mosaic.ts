import { definePreset, range, select, sharedParams } from './define';

/**
 * Zellige: hand-cut glazed tile pieces. Star tiles (8-star with crosses,
 * 12-star on a hexagonal lattice, or hexagram + hexagon) are cut into a centre
 * and points, each piece glazed with its own variance and set in grout; a
 * light sheen sweeps across the glaze in the reading direction and blooms.
 */
export const ZELLIGE_MOSAIC = definePreset({
  id: 'zellige-mosaic',
  name: { en: 'Zellige mosaic', ar: 'فسيفساء الزليج' },
  description: {
    en: 'Hand-cut star tiles with uneven glaze and grout lines, swept by a blooming light sheen. 8-star, 12-star or hexagram layouts.',
    ar: 'بلاطات نجمية مقطوعة يدوياً بطلاء متفاوت وفواصل جصّية، يمرّ عليها لمعان ضوئي متوهّج، بتشكيلات النجمة الثمانية أو الاثني عشرية أو السداسية.',
  },
  tags: ['arabic', 'geometric', 'light', 'background'],
  libs: ['kit', 'filters', 'viewport'],
  params: [
    ...sharedParams({ seed: 4, interactive: true }),
    select(
      'pattern',
      'Pattern',
      'النقشة',
      '8-star',
      [
        ['8-star', '8-point star', 'نجمة ثمانية'],
        ['12-star', '12-point star', 'نجمة اثنا عشرية'],
        ['hexa', 'Hexagram', 'نجمة سداسية'],
      ],
      'look',
    ),
    range('tileSize', 'Tile size', 'حجم البلاطة', 96, 40, 240, 2, 'look'),
    range('glazeVariance', 'Glaze variance', 'تفاوت الطلاء', 0.5, 0, 1, 0.05, 'look'),
    range('sheenSpeed', 'Sheen speed', 'سرعة اللمعان', 0.6, 0, 2, 0.05, 'motion'),
    range('grout', 'Grout width', 'عرض الفواصل', 2, 0, 6, 0.5, 'look'),
  ],
  code: String.raw`
const p=ck.params({palette:'theme',seed:4,speed:1,density:1,interactive:true,pattern:'8-star',tileSize:96,glazeVariance:0.5,sheenSpeed:0.6,grout:2});
const s=await ck.scene({libs:['filters','viewport'],seed:p.seed,design:{width:1280,height:720,fit:'cover',zoom:true}});
const PIXI=s.PIXI,C=s.palette,F=s.lib.filters,TAU=Math.PI*2;
const root=new PIXI.Container(),base=new PIXI.Graphics(),tiles=new PIXI.Graphics(),sheen=new PIXI.Graphics();
sheen.blendMode='add';
root.addChild(base,tiles,sheen);
s.world.addChild(root);
const bloom=new F.AdvancedBloomFilter({threshold:0.6,bloomScale:0.9,brightness:1,blur:5,quality:5});
root.filters=[bloom];
const glazes=[C.colors[0],C.colors[4],C.colors[1],C.mix(C.colors[0],C.text,0.35)];
const groutC=C.mix(C.surface,C.text,0.12);
let W=1,H=1,pieces=[],band=0.4;

function add(pts,ci,cx,cy){
  const v=(s.random()-0.5)*p.glazeVariance*0.45;
  const col=C.mix(glazes[ci%glazes.length],v>0?0xffffff:0x000000,Math.abs(v));
  pieces.push({pts:pts,col:col,cx:cx,cy:cy,g:0.6+0.4*s.random()});
}
function star(cx,cy,n,R,r,rot,ci){
  const o=[],q=[];
  for(let k=0;k<n;k++){const a=rot+TAU*k/n,b=a+Math.PI/n;o.push([cx+R*Math.cos(a),cy+R*Math.sin(a)]);q.push([cx+r*Math.cos(b),cy+r*Math.sin(b)]);}
  add(q.flat(),ci,cx,cy);
  for(let k=0;k<n;k++){const a=q[(k+n-1)%n],b=o[k],c=q[k];add([a[0],a[1],b[0],b[1],c[0],c[1]],ci+1,(a[0]+b[0]+c[0])/3,(a[1]+b[1]+c[1])/3);}
}
function hex(cx,cy,R,rot,ci){const v=[];for(let k=0;k<6;k++){const a=rot+TAU*k/6;v.push(cx+R*Math.cos(a),cy+R*Math.sin(a));}add(v,ci,cx,cy);}
function build(w,h){
  W=Math.max(1,w);H=Math.max(1,h);pieces=[];
  const S=Math.max(24,p.tileSize/Math.sqrt(Math.max(0.2,p.density)));
  base.clear().rect(0,0,W,H).fill(C.mix(glazes[3],C.surface,0.55));
  if(p.pattern==='12-star'||p.pattern==='hexa'){
    const hy=S*Math.sqrt(3)/2,twelve=p.pattern==='12-star';
    for(let j=-1;j*hy<H+S;j++)for(let i=-1;i*S<W+S;i++){
      const cx=i*S+(j%2?S/2:0),cy=j*hy;
      if(twelve)star(cx,cy,12,S*0.49,S*0.49*0.74,0,0);
      else star(cx,cy,6,S*0.49,S*0.49/Math.sqrt(3),0,0);
      hex(cx+S/2,cy+S/(2*Math.sqrt(3)),S*(twelve?0.1:0.2),Math.PI/6,2);
      hex(cx+S/2,cy-S/(2*Math.sqrt(3)),S*(twelve?0.1:0.2),Math.PI/6,2);
    }
  }else{
    const R=S*0.3535*0.98;
    for(let j=-1;j*S<H+S;j++)for(let i=-1;i*S<W+S;i++){
      star(i*S,j*S,8,R,R*0.765,0,0);
      star(i*S+S/2,j*S+S/2,8,R,R*0.765,0,2);
    }
  }
  tiles.clear();
  for(const q of pieces)tiles.poly(q.pts).fill(q.col);
  if(p.grout>0){for(const q of pieces)tiles.poly(q.pts);tiles.stroke({width:p.grout,color:groutC,join:'round'});}
}
build(1280,720);
s.tick(function(time){
  const T=s.reducedMotion?0:time.t*p.speed;
  let target=s.reducedMotion?0.4:((T*p.sheenSpeed*0.15)%1.6)-0.3;
  if(p.interactive&&s.pointer.inside&&!s.reducedMotion){
    const px=s.dir>0?s.pointer.x:W-s.pointer.x;
    target=(px*0.7+s.pointer.y*0.3)/(W*0.7+H*0.3);
    band+=(target-band)*0.12;
  }else band=target;
  sheen.clear();
  const den=W*0.7+H*0.3;
  for(const q of pieces){
    const d=((s.dir>0?q.cx:W-q.cx)*0.7+q.cy*0.3)/den-band;
    const a=Math.exp(-d*d/0.005)*0.55*q.g;
    if(a>0.02)sheen.poly(q.pts).fill({color:0xffffff,alpha:a});
  }
});
s.dispose(function(){root.filters=null;bloom.destroy();});
`,
});
