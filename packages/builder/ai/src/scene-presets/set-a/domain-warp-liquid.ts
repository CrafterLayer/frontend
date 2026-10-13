import { definePreset, range, sharedParams } from './define';

/**
 * A GPU fragment shader: fbm noise warped twice (Inigo Quilez's domain warping)
 * into liquid marble on a contrast ramp (the surface, through the accent, to a
 * light highlight), with film grain. The pointer twists the liquid.
 * `#include noise` brings the kit's stegu simplex chunk.
 */
export const DOMAIN_WARP_LIQUID = definePreset({
  id: 'domain-warp-liquid',
  name: { en: 'Domain-warp liquid', ar: 'سائل الالتواء' },
  description: {
    en: 'Noise folded into itself twice on the GPU: liquid marble and oil-slick gradients in your palette, with fine grain. The pointer swirls it.',
    ar: 'ضجيج يُطوى داخل نفسه مرتين على معالج الرسوميات: رخام سائل وتدرّجات زيتية بألوانك مع حبيبات ناعمة، ويدوّمه المؤشر.',
  },
  tags: ['generative', 'background', 'hero', 'calm', 'loop'],
  libs: ['kit'],
  params: [
    ...sharedParams({ seed: 11, interactive: true }),
    range('warp', 'Warp', 'قوة الالتواء', 2.2, 0, 4, 0.1, 'look'),
    range('scale', 'Scale', 'المقياس', 2.4, 0.5, 6, 0.1, 'look'),
    range('grain', 'Grain', 'الحبيبات', 0.08, 0, 0.3, 0.01, 'look'),
    range('stops', 'Colour stops', 'عدد الألوان', 4, 2, 5, 1, 'look'),
  ],
  code: String.raw`
const p=ck.params({palette:'theme',seed:11,speed:1,density:1,interactive:true,warp:2.2,scale:2.4,grain:0.08,stops:4});
const s=await ck.scene({libs:[],seed:p.seed});
const PIXI=s.PIXI,C=s.palette;
function v3(c){return 'vec3('+[16,8,0].map(function(b){return ((c>>b&255)/255).toFixed(3);}).join(',')+')';}
function f(x){return (+x).toFixed(4);}
// A ramp with real contrast: from the surface, through the accent, to a light highlight (the
// other way round on a light surface), sampled at the chosen number of stops.
const L=C.dark?[C.surface,C.colors[4],C.colors[0],C.colors[1],C.mix(C.colors[1],0xffffff,0.6)]:[C.surface,C.colors[1],C.colors[0],C.colors[4],C.mix(C.colors[4],C.text,0.6)];
function at(t){const x=Math.min(3.999,t*4),i=Math.floor(x);return C.mix(L[i],L[i+1],x-i);}
const n=Math.max(2,Math.min(5,Math.round(p.stops))),ramp=[];
for(let i=0;i<n;i++)ramp.push(at(i/(n-1)));
let pal='vec3 pal(float x){x=clamp(x,0.,1.)*'+(n-1)+'.;vec3 c='+v3(ramp[0])+';';
for(let i=1;i<n;i++)pal+='c=mix(c,'+v3(ramp[i])+',smoothstep('+(i-1)+'.,'+i+'.,x));';
pal+='return c;}';
const o=f(s.rand(0,60));
const frag=[
  'in vec2 vTextureCoord;','out vec4 finalColor;',
  'uniform highp vec4 uInputSize;','uniform highp vec4 uOutputFrame;',
  'uniform float uTime;','uniform float uMx;','uniform float uMy;','uniform float uMk;',
  '#include noise',
  'float wfbm(vec3 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*snoise(p);p=p*2.03+vec3(1.7,9.2,4.1);a*=.5;}return s;}',
  pal,
  'void main(){',
  ' vec2 uv=vTextureCoord*uInputSize.xy/uOutputFrame.zw;',
  ' float asp=uOutputFrame.z/max(uOutputFrame.w,1.);',
  ' vec2 q=vec2((uv.x-.5)*asp*'+s.dir+'.,uv.y-.5)*'+f(p.scale*0.25)+'+'+o+';',
  ' vec2 m=vec2((uMx-.5)*asp*'+s.dir+'.,uMy-.5)*'+f(p.scale*0.25)+'+'+o+';',
  ' vec2 d=q-m;q+=vec2(-d.y,d.x)*uMk*6.4*exp(-dot(d,d)*48.);',
  ' float t=uTime*'+f(p.speed*0.7)+';',
  ' vec2 a=vec2(wfbm(vec3(q,t*.07)),wfbm(vec3(q+vec2(5.2,1.3),t*.07)));',
  ' vec2 b=vec2(wfbm(vec3(q+'+f(p.warp)+'*a+vec2(1.7,9.2),t*.11)),wfbm(vec3(q+'+f(p.warp)+'*a+vec2(8.3,2.8),t*.11)));',
  ' float h=wfbm(vec3(q+'+f(p.warp)+'*b,t*.05));',
  ' float v=clamp(.45+.9*h,0.,1.);v=v*v*(3.-2.*v);',
  ' vec3 col=pal(clamp(v*.78+.28*length(b)-.2,0.,1.));',
  ' col=mix(col,pal(1.),smoothstep(.6,1.,length(a))*.25*v);',
  ' col*='+(C.dark?'.7+.45*v':'.94+.1*v')+';col+=vec3(pow(max(h,0.),3.))*.25;',
  ' float g=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233))+uTime)*43758.5453)-.5;',
  ' finalColor=vec4(col+g*'+f(p.grain)+',1.);',
  '}',
].join('\n');
const fx=s.shader(frag,{uMx:0.5,uMy:0.5,uMk:0});
// The kit names the uniform group; find the one that carries ours.
function uniforms(filter){
  const r=filter.resources||{};
  for(const k in r){const g=r[k];if(g&&g.uniforms&&'uMk' in g.uniforms)return g.uniforms;}
  return null;
}
const u=uniforms(fx);
const quad=new PIXI.Graphics();
quad.filters=[fx];
s.stage.addChild(quad);
function res(q){fx.resolution=q<1?0.5:0.75;}
res(s.quality);
s.onQuality(res);
function layout(w,h){quad.clear().rect(0,0,w,h).fill(0xffffff);}
layout(s.width,s.height);
s.onResize(layout);
let mx=0.5,my=0.5,mk=0;
s.tick(function(){
  if(!u)return;
  const on=p.interactive&&s.pointer.inside&&!s.reducedMotion;
  const tx=on?s.pointer.x/Math.max(1,s.width):0.5,ty=on?s.pointer.y/Math.max(1,s.height):0.5;
  mx+=(tx-mx)*0.08;my+=(ty-my)*0.08;mk+=((on?1:0)-mk)*0.05;
  u.uMx=mx;u.uMy=my;u.uMk=mk;
});
s.dispose(function(){quad.filters=null;});
`,
});
