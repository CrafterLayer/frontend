import { definePreset, range, sharedParams } from './define';

/**
 * A GPU fragment shader: fbm noise warped twice (Inigo Quilez's domain warping)
 * into liquid marble in the palette's colours, with film grain. The pointer
 * twists the liquid. `#include noise` brings the kit's stegu simplex chunk.
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
const n=Math.max(2,Math.min(5,Math.round(p.stops))),ramp=C.ramp(n);
let pal='vec3 pal(float x){x=clamp(x,0.,1.)*'+(n-1)+'.;vec3 c='+v3(ramp[0])+';';
for(let i=1;i<n;i++)pal+='c=mix(c,'+v3(ramp[i])+',smoothstep('+(i-1)+'.,'+i+'.,x));';
pal+='return c;}';
const o=f(s.rand(0,60));
const frag=[
  'in vec2 vTextureCoord;','out vec4 finalColor;',
  'uniform vec4 uInputSize;','uniform vec4 uOutputFrame;',
  'uniform float uTime;','uniform float uMx;','uniform float uMy;','uniform float uMk;',
  '#include noise',
  'float fbm(vec3 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*snoise(p);p=p*2.03+vec3(1.7,9.2,4.1);a*=.5;}return s;}',
  pal,
  'void main(){',
  ' vec2 uv=vTextureCoord*uInputSize.xy/uOutputFrame.zw;',
  ' float asp=uOutputFrame.z/max(uOutputFrame.w,1.);',
  ' vec2 q=vec2((uv.x-.5)*asp*'+s.dir+'.,uv.y-.5)*'+f(p.scale)+'+'+o+';',
  ' vec2 m=vec2((uMx-.5)*asp*'+s.dir+'.,uMy-.5)*'+f(p.scale)+'+'+o+';',
  ' vec2 d=q-m;q+=vec2(-d.y,d.x)*uMk*1.6*exp(-dot(d,d)*3.);',
  ' float t=uTime*'+f(p.speed)+';',
  ' vec2 a=vec2(fbm(vec3(q,t*.07)),fbm(vec3(q+vec2(5.2,1.3),t*.07)));',
  ' vec2 b=vec2(fbm(vec3(q+'+f(p.warp)+'*a+vec2(1.7,9.2),t*.11)),fbm(vec3(q+'+f(p.warp)+'*a+vec2(8.3,2.8),t*.11)));',
  ' float h=fbm(vec3(q+'+f(p.warp)+'*b,t*.05));',
  ' vec3 col=pal(.5+.6*h+.3*length(b)-.15);',
  ' col=mix(col,pal(1.),smoothstep(.5,.95,length(a))*.35);',
  ' col+=vec3(pow(max(h,0.),3.))*.18;',
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
