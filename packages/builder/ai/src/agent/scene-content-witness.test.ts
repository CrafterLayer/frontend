import { describe, expect, it } from 'vitest';

import { sceneProgramHasContent } from './scene-content-witness';

const HEAD = 'const s=await ck.scene();const P=s.PIXI;';

describe('bespoke scene content witness', () => {
  it.each([
    'new P.Graphics();',
    's.world.addChild(new P.Graphics());',
    'const g=new P.Graphics().rect(0,0,100,100).fill(0xff0000);',
    'const g=new P.Graphics().rect(0,0,100,100);s.world.addChild(g);',
    'const stage=new P.Container();stage.addChild(new P.Graphics().circle(0,0,20).fill(0xff0000));',
    's.world.addChild(new P.Graphics().rect(0,0,0,0).fill(0xff0000));',
    's.world.addChild(new P.Sprite());',
    's.world.addChild(new P.Sprite(P.Texture.EMPTY));',
    's.world.addChild(new s.PIXI.Sprite(s.PIXI.Texture.EMPTY));',
    's.world.addChild(new P.Sprite({texture:s.PIXI.Texture.EMPTY}));',
    's.world.addChild(new P.Sprite(null));',
    's.world.addChild(new P.Sprite({alpha:1}));',
    's.world.addChild(new P.Text({text:""}));',
    's.world.addChild(new P.Mesh({}));',
    'const n=s.lib.noise.create(s,{type:"simplex"});',
    's.lib.emitter.spawn(other,"snow");',
  ])('rejects empty or unattached content: %s', (body) => {
    expect(sceneProgramHasContent(HEAD + body)).toBe(false);
  });

  it.each([
    's.world.addChild(new P.Graphics().rect(0,0,100,100).fill(0xff0000));',
    'const g=new P.Graphics();s.world.addChild(g);s.onResize(()=>g.rect(0,0,s.width,s.height).fill(s.palette.accent));',
    'const layer=new P.Container(), g=new P.Graphics();layer.addChild(g);s.world.addChild(layer);g.roundRect(0,0,100,100,10).fill(0xff0000);',
    'const g=new P.Graphics();g.moveTo(0,0).lineTo(40,40).stroke({width:2,color:0xff0000});s.world.addChild(g);',
    'const shape=new P.GraphicsContext().circle(0,0,20).fill(0xff0000);s.stage.addChild(new P.Graphics(shape));',
    'const stage=s.world;const g=new P.Graphics().poly([0,0,50,0,25,40]).fill(0xff0000);stage.addChild(g);',
    'const tex=await s.texture("image");s.world.addChild(new P.Sprite(tex));',
    's.world.addChild(new P.Sprite({texture:tex}));',
    'const view=new P.Sprite();view.texture=tex;s.app.stage.addChild(view);',
    's.world.addChild(new P.Text({text:"رحلة الشتاء",style:{fontSize:24}}));',
    's.world.addChild(new P.Text({text:title}));',
    's.world.addChild(new P.Mesh({geometry,shader}));',
    's.lib.emitter.spawn(s,"snow");',
    's.lib.tilemap.world(s.app,{rows:["#.."],legend:{}});',
  ])('retains populated scenes: %s', (body) => {
    expect(sceneProgramHasContent(HEAD + body)).toBe(true);
  });
});
