import type { AiSkillDefinitionV1 } from '../types';
import { PIXI_GAME_KEYWORDS, PIXI_STORY_KEYWORDS } from './pixi-creative';

/**
 * PixiJS v8 for the scene scripts أبو غضب writes in free code mode (2026-10-10).
 *
 * The owner asked for the official PixiJS v8 guides
 * (https://pixijs.com/8.x/guides, read through https://pixijs.com/llms-full.txt) to become the
 * agent's skills. They are NOT installed or pasted: the guide repository (pixijs/pixijs.com)
 * declares no licence, so every line here is rewritten as reviewed data — the v8 API facts, the
 * v7 habits that break, and CraftKit's own runtime (`ck.stage`, `ck.onDispose`, the free-code
 * door). The one verbatim borrowing is the API itself, from pixi.js (MIT). Sources, dates and
 * licences: PIXI_SOURCES.md beside this file.
 *
 * The `e.g.` lines are plain JavaScript, single-quoted so they survive inside a JSON string, each
 * a complete body of the `async (ck) => …` a region's `js` prop is. pixi-v8.test.ts compiles every
 * one and runs it against the real pixi.js v8 namespace, failing on any v8 deprecation warning.
 *
 * Every skill but the core depends on the core, which carries the stage, loop and cleanup rules
 * and the v7 → v8 list; the core and the graphics skill load for any Pixi, mural or free-code
 * ask, the other three only for their own vocabulary.
 */

/** A scene of any kind: what loads the core and the graphics skill. */
const PIXI_SCENE_KEYWORDS = [
  ...PIXI_GAME_KEYWORDS,
  ...PIXI_STORY_KEYWORDS,
  'pixi',
  'pixijs',
  'webgl',
  'mural',
  'generative art',
  'interactive background',
  'canvas animation',
  'جدارية',
  'جداريات',
  'بيكسي',
  'بكسي',
  'فن توليدي',
  'رسوم توليدية',
  'خلفية تفاعلية',
  'مشهد تفاعلي',
] as const;

export const PIXI_V8_CORE_SKILL: AiSkillDefinitionV1 = {
  schemaVersion: 1,
  id: 'craftkit.pixi-v8-core',
  name: 'PixiJS v8: stage, loop and cleanup',
  description:
    'Scene scripts in free code mode as PixiJS v8 code: the ck.stage application, scene graph, Ticker, resize, reduced motion, pausing, cleanup, and the v7 habits that break.',
  version: '1.1.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 43,
  activation: {
    mode: 'auto',
    keywords: [
      ...PIXI_SCENE_KEYWORDS,
      'free code',
      'custom js',
      'custom javascript',
      'scene script',
      'كود حر',
      'الكود الحر',
    ],
  },
  tags: ['pixi', 'scene', 'free-code', 'motion'],
  instructions: `PIXI V8 ONLY: most Pixi code you remember is v7 and breaks here. Every rule below is v8.
WHERE: free code ON → a customCode block's js prop (the free-code card). OFF → write no Pixi: a closed scene through media.add {kind:scene} and point the person to the switch. A scene preset or script library in TOOLS comes first: apply or reuse it before writing new code.
STAGE: const {PIXI,app,canvas}=await ck.stage({background,pointer,resolution}) is already initialised (its await app.init is done), transparent unless background is given, resized to the region, autoDensity on, resolution at most 2, destroyed with the region. Never new PIXI.Application(), app.init, app.view, appendChild of the canvas, import or a CDN script. PIXI is the pixi.js v8 namespace only: no pixi-filters, no @pixi/* packages. Give the region a css height.
STUDIO: when the request's card offers ck.scene, write against it — s.PIXI, s.app and s.stage are these same v8 objects, s.tick replaces app.ticker (it pauses off screen and runs once under reduced motion), add-on libraries come only through its libs list. Every other rule here holds.
SIZE: lay out from app.screen.width and app.screen.height in a function, run once and on app.renderer.on('resize',layout); never from the window.
LOOP: app.ticker.add(t=>…) receives the Ticker, not a number: t.deltaTime is about 1 per 60 fps frame (multiply steps by it), t.deltaMS is milliseconds (keep seconds yourself: time+=t.deltaMS/1000). Build objects once; per frame change only position, rotation, scale, alpha, tint.
SCENE GRAPH: only a Container takes children; Graphics, Sprite, Text and Mesh are leaves, so group with new PIXI.Container(). label replaces name; getBounds().rectangle gives the Rectangle. A static layer: cacheAsTexture(true). A large moving world: new PIXI.Container({isRenderGroup:true}).
CALM: ck.reducedMotion → one finished frame and no ticker callback. ck.editor → fewer objects. Off screen → pause: an IntersectionObserver on ck.root calling app.ticker.stop() and start().
CLEANUP: ck.stage destroys the app and its children; observers, listeners, timers, gradients and made textures end in ck.onDispose, which runs first.
DECORATIVE: copy stays in the tree over the canvas; canvas.setAttribute('aria-hidden','true') unless its objects are made accessible.
V7 → V8, never write the left side: new Application({…}) → ck.stage; app.view → app.canvas; beginFill + drawRect + endFill → rect().fill(); lineStyle → stroke({width,color}); ticker (delta)=> → (t)=>t.deltaTime; Texture.from(url) → await PIXI.Assets.load(url); new Text('hi',style) → new Text({text:'hi',style}); new BlurFilter(8) → new BlurFilter({strength:8}); interactive=true → eventMode='static'; cacheAsBitmap → cacheAsTexture(); PIXI.utils.isMobile → PIXI.isMobile; a child inside a Sprite → a Container holding both.
e.g. rising dots: const {PIXI,app,canvas}=await ck.stage();canvas.setAttribute('aria-hidden','true');const dot=new PIXI.GraphicsContext().circle(0,0,2).fill(0xffffff);const layer=new PIXI.Container();app.stage.addChild(layer);const stars=Array.from({length:ck.editor?60:160},()=>{const s=new PIXI.Graphics(dot);s.alpha=.3+Math.random()*.7;layer.addChild(s);return {s,v:.2+Math.random()*.8}});const place=()=>stars.forEach(({s})=>s.position.set(Math.random()*app.screen.width,Math.random()*app.screen.height));place();app.renderer.on('resize',place);if(!ck.reducedMotion)app.ticker.add(t=>{for(const {s,v} of stars){s.y-=v*t.deltaTime;if(s.y<-4){s.y=app.screen.height+4;s.x=Math.random()*app.screen.width}}});ck.onDispose(()=>{app.renderer.off('resize',place);dot.destroy()})
e.g. pause off screen: const {app}=await ck.stage();const io=new IntersectionObserver(([e])=>{if(e.isIntersecting)app.ticker.start();else app.ticker.stop()});io.observe(ck.root);ck.onDispose(()=>io.disconnect())`,
  references: {
    'checks/pixi-core.md':
      'Stage from ck.stage, never a new Application; layout from app.screen on resize; ticker callbacks read t.deltaTime or t.deltaMS; no v7 call from the list; reduced motion draws one still frame; off-screen pause; every listener, observer, gradient and made texture released in ck.onDispose; copy stays in the tree.',
  },
};

export const PIXI_V8_GRAPHICS_SKILL: AiSkillDefinitionV1 = {
  schemaVersion: 1,
  id: 'craftkit.pixi-v8-graphics',
  name: 'PixiJS v8: Graphics, gradients and colour',
  description:
    'The v8 Graphics API — build a shape then fill or stroke it — with gradients, holes, shared contexts, colour and the v7 drawing calls that no longer exist.',
  version: '1.1.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 42,
  dependencies: ['craftkit.pixi-v8-core'],
  activation: {
    mode: 'auto',
    keywords: [...PIXI_SCENE_KEYWORDS, 'pixi graphics', 'flowing lines', 'خطوط متدفقة'],
  },
  tags: ['pixi', 'graphics', 'generative'],
  instructions: `GRAPHICS v8: build the shape, then paint it — new PIXI.Graphics().rect(x,y,w,h).fill(color). Each fill or stroke paints every shape drawn since the previous paint, and every call chains.
SHAPES: rect, roundRect(x,y,w,h,radius), circle(x,y,r), ellipse(x,y,rx,ry), poly([x1,y1,x2,y2,…]), regularPoly(x,y,r,sides), star(x,y,points,r,innerR), arc, moveTo, lineTo, bezierCurveTo, quadraticCurveTo, closePath, chamferRect, filletRect, roundPoly, svg(markup).
PAINT: fill(0x0ea5e9 | '#0ea5e9' | {color,alpha} | texture | a FillGradient); stroke({width,color,alpha,cap:'round',join:'round'}); pixelLine:true in a 1 px stroke for crisp hairlines. A hole: draw it after the fill, then cut().
GRADIENTS: new PIXI.FillGradient({type:'linear',start:{x:0,y:0},end:{x:0,y:1},colorStops:[{offset:0,color:'#1e1b4b'},{offset:1,color:'#f97316'}]}) — start and end are 0..1 of the shape's own box; type:'radial' takes center, innerRadius, outerCenter, outerRadius on the same scale. Build each gradient once, reuse it, destroy it in ck.onDispose.
REUSE: copies of one shape share one context: const c=new PIXI.GraphicsContext().circle(0,0,8).fill(0xffffff) and new PIXI.Graphics(c) per copy, then animate transforms, tint and alpha, not geometry. Swapping g.context between prebuilt contexts is cheap. clear() and redraw every frame is the slow path: keep it to a few Graphics with a few hundred points (a flowing line, a wave).
COLOUR: hex numbers or CSS strings; new PIXI.Color('#22d3ee').toNumber() when maths needs a number; a white shape recoloured through tint costs nothing. Take colours from the page's direction, or read a theme role: getComputedStyle(ck.root).getPropertyValue('--t-accent').trim().
MANY OF ONE: hundreds of the same dot → Sprites of one texture, app.renderer.generateTexture(graphics); thousands → the particles of the effects skill.
DON'T (v7 → v8): beginFill/endFill → fill(); drawRect, drawCircle, drawEllipse, drawRoundedRect, drawPolygon, drawStar → rect, circle, ellipse, roundRect, poly, star; lineStyle(2,c) → stroke({width:2,color:c}); beginHole/endHole → cut(); beginTextureFill → fill({texture}); GraphicsGeometry → GraphicsContext; a child inside a Graphics → a Container.
e.g. layered waves: const {PIXI,app}=await ck.stage();const waves=[0x0ea5e9,0x6366f1,0xa855f7].map(c=>{const g=new PIXI.Graphics();g.alpha=.55;app.stage.addChild(g);return {g,c}});let time=0;const draw=()=>{const w=app.screen.width,h=app.screen.height;waves.forEach(({g,c},i)=>{g.clear().moveTo(0,h);for(let x=0;x<=w;x+=16)g.lineTo(x,h*.55+i*28+Math.sin(x*.01+time*(1+i*.3)+i)*24);g.lineTo(w,h).closePath().fill(c)})};draw();app.renderer.on('resize',draw);if(!ck.reducedMotion)app.ticker.add(t=>{time+=t.deltaMS/1000;draw()})
e.g. gradient sky and sun: const {PIXI,app}=await ck.stage();const sky=new PIXI.FillGradient({type:'linear',start:{x:0,y:0},end:{x:0,y:1},colorStops:[{offset:0,color:'#1e1b4b'},{offset:1,color:'#f97316'}]});const glow=new PIXI.FillGradient({type:'radial',center:{x:.5,y:.5},innerRadius:0,outerCenter:{x:.5,y:.5},outerRadius:.5,colorStops:[{offset:0,color:'#fde68a'},{offset:1,color:'rgba(253,230,138,0)'}]});const bg=new PIXI.Graphics();const sun=new PIXI.Graphics().circle(0,0,120).fill(glow);app.stage.addChild(bg,sun);const layout=()=>{bg.clear().rect(0,0,app.screen.width,app.screen.height).fill(sky);sun.position.set(app.screen.width*.7,app.screen.height*.75)};layout();app.renderer.on('resize',layout);ck.onDispose(()=>{sky.destroy();glow.destroy()})`,
  references: {
    'checks/pixi-graphics.md':
      'Shapes before fill or stroke; no begin/end or draw* call; stroke takes an object; gradients built once and destroyed; shared contexts for repeated shapes; per-frame redraw only for a few light paths.',
  },
};

export const PIXI_V8_TEXT_ASSETS_SKILL: AiSkillDefinitionV1 = {
  schemaVersion: 1,
  id: 'craftkit.pixi-v8-text-assets',
  name: 'PixiJS v8: text, fonts, sprites and Assets',
  description:
    'Text, BitmapText and HTMLText with v8 option objects, Arabic shaping limits, fonts, and loading textures through Assets for sprites and image murals.',
  version: '1.0.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 41,
  dependencies: ['craftkit.pixi-v8-core'],
  activation: {
    mode: 'auto',
    keywords: [
      'pixi text',
      'bitmap text',
      'bitmaptext',
      'htmltext',
      'splittext',
      'kinetic typography',
      'sprite',
      'spritesheet',
      'image mural',
      'photo mural',
      'جدارية صور',
      'جدارية نصية',
      'نص بيكسي',
    ],
  },
  tags: ['pixi', 'text', 'assets'],
  instructions: `TEXT v8 takes one options object: new PIXI.Text({text:'…',style:{fontFamily,fontSize,fontWeight,fill,align,stroke:{color,width},dropShadow:{color,blur,distance,alpha},wordWrap:true,wordWrapWidth:420},anchor:.5}). BitmapText({text,style}) for numbers that change every frame; HTMLText({text,style}) for inline tags and emoji (it draws a frame late). Changing text or style re-rasterises a Text: never every frame.
FONTS: the page loads its own fonts; wait before drawing: await document.fonts.load('700 64px Cairo'), then fontFamily:'Cairo'. A font file the request gives: await PIXI.Assets.load({src:url,data:{family:'Brand'}}).
ARABIC: Text or HTMLText only — there the browser joins the letters. BitmapText, SplitText and SplitBitmapText place glyph by glyph, so Arabic falls apart into isolated letters: never use them for Arabic. Move an Arabic line as one object (alpha, scale, position, a mask wipe), align:'right' with its anchor on the right edge. Copy stays in the page tree; Pixi text is decoration — one word, a large numeral. Under ck.scene, s.text and s.words already follow this.
SPLIT TEXT, Latin only: new PIXI.SplitText({text,style,autoSplit:true}) gives chars, words and lines to stagger.
ASSETS: a texture comes from PIXI.Assets: const tex=await PIXI.Assets.load(url), then new PIXI.Sprite(tex). Texture.from(url) no longer fetches. Only addresses the request or the page gives: an image already in the region is ck.root.querySelector('img')?.currentSrc. A host without CORS fails the load: catch it and keep the page image. A spritesheet JSON loads the same way; its animations feed new PIXI.AnimatedSprite(frames). Assets.add takes {alias,src}.
SPRITES: anchor.set(.5) to turn around the centre; new PIXI.TilingSprite({texture,width,height}) with tilePosition for an endless drift; new PIXI.NineSliceSprite({texture,leftWidth,topHeight,rightWidth,bottomHeight}) for panels; a texture from a shape: app.renderer.generateTexture(graphics).
DON'T (v7 → v8): new Text(str,style) → new Text({text,style}); new BitmapText(str,style) → the same object form; Texture.from(url) before a load → await PIXI.Assets.load(url); BaseTexture → TextureSource; NineSlicePlane → NineSliceSprite; SCALE_MODES.NEAREST → 'nearest'; Assets.add('key','url') → Assets.add({alias,src}).
e.g. image mural from the region's photo: const {PIXI,app}=await ck.stage();const src=ck.root.querySelector('img')?.currentSrc;if(src){try{const tex=await PIXI.Assets.load(src);const tiles=new PIXI.Container();app.stage.addChild(tiles);for(let i=0;i<6;i++){const s=new PIXI.Sprite(tex);s.anchor.set(.5);s.scale.set(.25);s.alpha=.5;s.position.set((i+.5)*app.screen.width/6,app.screen.height/2);tiles.addChild(s)}if(!ck.reducedMotion)app.ticker.add(t=>tiles.children.forEach((s,i)=>{s.rotation+=.002*(i%2?1:-1)*t.deltaTime}))}catch{}}
e.g. Arabic numeral: const {PIXI,app}=await ck.stage();await document.fonts.load('800 120px Cairo');const n=new PIXI.Text({text:'٢٥',style:{fontFamily:'Cairo',fontSize:120,fontWeight:'800',fill:'#fbbf24',align:'right'},anchor:{x:1,y:.5}});n.alpha=.2;n.position.set(app.screen.width-24,app.screen.height/2);app.stage.addChild(n)`,
  references: {
    'checks/pixi-text-assets.md':
      'Text built from one options object; Arabic only as Text or HTMLText, moved whole; fonts awaited; textures loaded through Assets from a given or on-page address, with the failure caught; no per-frame text change.',
  },
};

export const PIXI_V8_EFFECTS_SKILL: AiSkillDefinitionV1 = {
  schemaVersion: 1,
  id: 'craftkit.pixi-v8-effects',
  name: 'PixiJS v8: filters, shaders, meshes and particles',
  description:
    'Built-in filters, v8 blend modes, custom shader filters with typed uniforms, rope and plane meshes, and ParticleContainer with Particle — within what ck.pixi() ships.',
  version: '1.0.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 41,
  dependencies: ['craftkit.pixi-v8-core'],
  activation: {
    mode: 'auto',
    keywords: [
      'shader',
      'glsl',
      'pixi filter',
      'pixi-filters',
      'displacement',
      'particle',
      'particle system',
      'pixi mesh',
      'distortion',
      'شيدر',
      'جزيئات',
      'جسيمات',
      'فلتر بيكسي',
      'تشويه',
    ],
  },
  tags: ['pixi', 'effects', 'particles', 'shaders'],
  instructions: `FILTERS: obj.filters=[a,b] (in order). Built in, each with an options object: new PIXI.BlurFilter({strength:8,quality:4}); new PIXI.ColorMatrixFilter() then .hue(30,false), .saturate(.4), .brightness(1.2,false); new PIXI.NoiseFilter({noise:.2}); new PIXI.AlphaFilter({alpha:.5}); new PIXI.DisplacementFilter({sprite,scale:40}) with a noise sprite you scroll. pixi-filters (glow, bloom, god rays) is never imported: only as s.lib.filters when ck.scene offers libs:['filters']; otherwise a glow is a blurred copy behind the shape with blendMode 'add'. Each filter is a render pass: a few per scene, filterArea=app.screen on a full-screen layer, filters=null to release.
BLEND: blendMode='add' | 'screen' | 'multiply' | 'normal' | 'erase' (strings; BLEND_MODES.ADD is v7). overlay, color-dodge and the other advanced modes only where the card says the stage loads them (ck.scene blend:true); ck.stage does not. Keep same-blend objects adjacent: alternating modes breaks batching.
CUSTOM SHADER FILTER (WebGL, which ck.stage renders): PIXI.Filter.from({gl:{vertex:PIXI.defaultFilterVert,fragment},resources:{u:{uTime:{value:0,type:'f32'}}}}); uniforms are typed (f32, vec2<f32>, vec3<f32>, vec4<f32>) and change through f.resources.u.uniforms.uTime. In the fragment: in vec2 vTextureCoord; uniform sampler2D uTexture; the 0..1 position is vTextureCoord*uInputSize.xy/uOutputFrame.zw (declare uniform vec4 uInputSize and uOutputFrame). new Filter(vertex,fragment,uniforms) is v7.
MESHES: new PIXI.MeshRope({texture,points}) for ribbons and trails (move the points); new PIXI.MeshPlane({texture,verticesX:20,verticesY:20}) for a waving image (move geometry.positions); new PIXI.Mesh({geometry,shader}). SimpleRope, SimplePlane and SimpleMesh are the v7 names.
PARTICLES, thousands of sparks: new PIXI.ParticleContainer({dynamicProperties:{position:true,rotation:false,color:false,vertex:false},boundsArea:app.screen}), then pc.addParticle(new PIXI.Particle({texture,x,y,tint,alpha,scaleX,scaleY})) — never addChild or Sprites there; after changing a property that is not dynamic call pc.update(). One texture for all: app.renderer.generateTexture(new PIXI.Graphics().circle(0,0,4).fill(0xffffff)). About 1500 on the page, 400 when ck.editor, a still frame when ck.reducedMotion.
e.g. shader aurora: const {PIXI,app}=await ck.stage();const fragment='in vec2 vTextureCoord;uniform vec4 uInputSize;uniform vec4 uOutputFrame;uniform float uTime;void main(){vec2 p=vTextureCoord*uInputSize.xy/uOutputFrame.zw;float w=0.5+0.5*sin(p.x*6.0+uTime+sin(p.y*3.0+uTime*0.7));gl_FragColor=vec4(mix(vec3(0.02,0.05,0.15),vec3(0.1,0.85,0.7),w*(1.0-p.y)),1.0);}';const f=PIXI.Filter.from({gl:{vertex:PIXI.defaultFilterVert,fragment},resources:{u:{uTime:{value:0,type:'f32'}}}});const bg=new PIXI.Graphics().rect(0,0,1,1).fill(0xffffff);bg.filters=[f];app.stage.addChild(bg);const fit=()=>{bg.width=app.screen.width;bg.height=app.screen.height};fit();app.renderer.on('resize',fit);if(!ck.reducedMotion)app.ticker.add(t=>{f.resources.u.uniforms.uTime+=t.deltaMS/1000})
e.g. rising sparks: const {PIXI,app}=await ck.stage();const tex=app.renderer.generateTexture(new PIXI.Graphics().circle(0,0,4).fill(0xffffff));const pc=new PIXI.ParticleContainer({dynamicProperties:{position:true,rotation:false,color:false,vertex:false},boundsArea:app.screen});pc.blendMode='add';app.stage.addChild(pc);const ps=[];for(let i=0;i<(ck.editor?400:1500);i++){const p=new PIXI.Particle({texture:tex,x:Math.random()*app.screen.width,y:Math.random()*app.screen.height,tint:0x67e8f9,alpha:.5,scaleX:.6,scaleY:.6});pc.addParticle(p);ps.push({p,v:.3+Math.random()})}if(!ck.reducedMotion)app.ticker.add(t=>{for(const {p,v} of ps){p.y-=v*t.deltaTime;if(p.y<0)p.y=app.screen.height}});ck.onDispose(()=>tex.destroy(true))`,
  references: {
    'checks/pixi-effects.md':
      'Filters from the built-in set with option objects, a few per scene; no pixi-filters import; blend modes as strings from the basic set; custom shaders through Filter.from with typed uniforms; particles through ParticleContainer and Particle with a boundsArea; generated textures destroyed in ck.onDispose.',
  },
};

export const PIXI_V8_INTERACTION_PERF_SKILL: AiSkillDefinitionV1 = {
  schemaVersion: 1,
  id: 'craftkit.pixi-v8-interaction-perf',
  name: 'PixiJS v8: pointer, accessibility and performance',
  description:
    'Mouse and touch for scene scripts (the region listener behind content, v8 eventMode for canvas content), accessible Pixi objects, batching, culling, frame budget and memory.',
  version: '1.0.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 41,
  dependencies: ['craftkit.pixi-v8-core'],
  activation: {
    mode: 'auto',
    keywords: [
      'follow the mouse',
      'follows the mouse',
      'follow the cursor',
      'follows the cursor',
      'mouse trail',
      'cursor trail',
      'interactive mural',
      'interactive scene',
      'interactive background',
      'eventmode',
      'pixi performance',
      'مع الماوس',
      'تتبع الماوس',
      'يتبع الماوس',
      'حركة الماوس',
      'جدارية تفاعلية',
      'خلفية تفاعلية',
      'مشهد تفاعلي',
    ],
  },
  tags: ['pixi', 'interaction', 'performance', 'accessibility'],
  instructions: `POINTER BEHIND CONTENT: the ck.stage canvas ignores the pointer unless {pointer:true}, so the copy and buttons over it stay clickable. A scene that follows the mouse listens on the region: ck.root.addEventListener('pointermove',fn) with x=e.clientX-rect.left from ck.root.getBoundingClientRect() (CSS pixels, the same units as app.screen), removed in ck.onDispose. Touch sends the same pointer events. Ease toward the target in the ticker; never jump. Under ck.scene, s.pointer gives the same region-relative point.
PIXI EVENTS, only with ck.stage({pointer:true}) and only where the canvas is the content: obj.eventMode='static' (rarely moves) or 'dynamic' (moves and must hit-test while the pointer is still); the default is passive, so nothing answers until you set it. obj.on('pointertap',fn) and pointerdown, pointerup, pointerover, pointerout, pointermove with e.global; 'globalpointermove' fires on every move anywhere. cursor='pointer'. hitArea=new PIXI.Rectangle(…) or new PIXI.Circle(…) skips bounds tests; interactiveChildren=false on decorative groups; whole-stage tracking: app.stage.eventMode='static' and app.stage.hitArea=app.screen. interactive=true and buttonMode are v7.
ACCESSIBLE: a clickable Pixi object gets accessible=true, accessibleTitle and accessibleHint (keyboard focus, read aloud); anything a visitor needs also exists as a real button in the tree. A decorative canvas is aria-hidden.
PERFORMANCE: build once, animate transforms; many identical things as Sprites of one texture or as Particles; keep same-texture and same-blend objects adjacent (alternating breaks batches); masks cost — a Rectangle mask is cheapest, a Graphics mask next, a Sprite mask is a filter; Text changes re-rasterise. Big worlds: obj.cullable=true and PIXI.Culler.shared.cull(app.stage,app.screen) in a ticker callback (CullerPlugin cannot be added after ck.stage). app.ticker.maxFPS=30 for slow ambient scenes. Pause off screen and on document.hidden.
MEMORY: destroy what you remove — sprite.destroy(), graphics.destroy({context:true}) when it owns its context, texture.destroy(true) for generated textures, filters=null. ck.onDispose callbacks run first, while app is alive.
REDUCED MOTION: one still frame; a click may still change something, instantly.
e.g. mouse glow: const {PIXI,app}=await ck.stage();const dot=new PIXI.Graphics().circle(0,0,90).fill({color:0x22d3ee,alpha:.25});dot.blendMode='add';dot.position.set(app.screen.width/2,app.screen.height/2);app.stage.addChild(dot);const aim={x:dot.x,y:dot.y};const move=e=>{const r=ck.root.getBoundingClientRect();aim.x=e.clientX-r.left;aim.y=e.clientY-r.top;if(ck.reducedMotion)dot.position.set(aim.x,aim.y)};ck.root.addEventListener('pointermove',move);ck.onDispose(()=>ck.root.removeEventListener('pointermove',move));if(!ck.reducedMotion)app.ticker.add(t=>{const k=Math.min(1,.12*t.deltaTime);dot.x+=(aim.x-dot.x)*k;dot.y+=(aim.y-dot.y)*k})
e.g. clickable shape: const {PIXI,app}=await ck.stage({pointer:true});const b=new PIXI.Graphics().circle(0,0,40).fill(0xf43f5e);b.position.set(app.screen.width/2,app.screen.height/2);b.eventMode='static';b.cursor='pointer';b.accessible=true;b.accessibleTitle='Pulse';b.on('pointertap',()=>b.scale.set(b.scale.x>1?1:1.3));app.stage.addChild(b)`,
  references: {
    'checks/pixi-interaction-perf.md':
      'Mouse-follow behind content listens on ck.root, removed on dispose; Pixi events only with pointer:true and an explicit eventMode; clickable objects accessible; same-texture objects batched; culling called by hand; off-screen pause; removed objects destroyed.',
  },
};

/** The five, core first: what builtins.ts registers (inside its `// pixi-skills additions` blocks). */
export const PIXI_V8_SKILLS: readonly AiSkillDefinitionV1[] = [
  PIXI_V8_CORE_SKILL,
  PIXI_V8_GRAPHICS_SKILL,
  PIXI_V8_TEXT_ASSETS_SKILL,
  PIXI_V8_EFFECTS_SKILL,
  PIXI_V8_INTERACTION_PERF_SKILL,
];

/** The worked examples of a skill (its lines that start with "e.g. "), as code bodies of `async (ck) => …`. */
export function pixiSkillExamples(skill: AiSkillDefinitionV1): readonly string[] {
  return skill.instructions
    .split('\n')
    .filter((line) => line.startsWith('e.g. '))
    .map((line) => line.slice(line.indexOf(': ') + ': '.length));
}
