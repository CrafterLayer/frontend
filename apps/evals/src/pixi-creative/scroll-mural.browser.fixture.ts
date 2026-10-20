import type { Frame, Page } from 'playwright';
import { expect } from 'vitest';

import { buildStudioPreviewHtml } from '@craftkit/builder';

export interface ScrollMuralOptions {
  readonly nested?: boolean;
  readonly autoHeightClip?: boolean;
  readonly dir?: 'ltr' | 'rtl';
  readonly reducedMotion?: boolean;
  readonly legacy?: boolean;
}

export interface ScrollMuralState {
  readonly progress: number;
  readonly offset: number;
  readonly pageOffset: number;
  readonly start: number;
  readonly span: number;
  readonly rootHeight: number;
  readonly canvasTop: number;
  readonly canvasBottom: number;
  readonly canvasHeight: number;
  readonly viewportTop: number;
  readonly viewportBottom: number;
  readonly viewportHeight: number;
  readonly signature: number;
}

function attribute(value: string): string {
  return value.replace(/&/gu, '&amp;').replace(/"/gu, '&quot;').replace(/</gu, '&lt;');
}

const COMPOSE = `window.__scrollMural=s.lib.mural.compose(s,{
mode:'scrub',width:2200,mood:'garden',time:['day','night'],
layers:{sky:['sun'],far:[{item:'hills',size:90}],near:[
{item:'plains',y:640},{item:'tree',x:1800,size:200},
{item:'person',id:'walker',x:150,size:120}]},
beats:[{label:'first',dur:2},{label:'middle',camera:0.5,walk:{walker:1100},dur:4},
{label:'final',camera:1,walk:{walker:1950},time:'night',dur:2,still:true}]});`;

const LEGACY = `const g=new s.PIXI.Graphics();s.world.addChild(g);
s.tick(()=>{g.clear().rect(0,0,1280,720).fill(
s.scroll.progress<0.33?0x14532d:s.scroll.progress<0.8?0x1e40af:0x7e22ce)});
s.still(()=>{g.clear().rect(0,0,1280,720).fill(0x7e22ce)});`;

const READ_STATE = `window.__scrollState=()=>{
const root=ck.root,canvas=s.canvas,scroller=document.getElementById('scroll-container');
const r=root.getBoundingClientRect(),c=canvas.getBoundingClientRect();
const v=scroller?.getBoundingClientRect(),top=v?v.top+scroller.clientTop:0;
const height=scroller?scroller.clientHeight:innerHeight;
const offset=scroller?scroller.scrollTop:scrollY;
s.app.render();const p=s.app.renderer.extract.pixels({
target:s.stage,frame:new s.PIXI.Rectangle(0,0,s.width,s.height)}).pixels;
let signature=0;for(let i=0;i<p.length;i+=128)
signature=(Math.imul(signature,31)+p[i]+p[i+1]*3+p[i+2]*7)|0;
return {progress:s.scroll.progress,offset,pageOffset:scrollY,start:r.top-top+offset,
span:r.height-c.height,rootHeight:r.height,canvasTop:c.top,canvasBottom:c.bottom,
canvasHeight:c.height,viewportTop:top,viewportBottom:top+height,viewportHeight:height,signature};};`;

/** Actual shipped assets and script lifecycle; no synthetic scroll events or timeline seeking. */
export async function mountScrollMural(
  page: Page,
  options: ScrollMuralOptions = {},
): Promise<Frame> {
  const code = `const params=ck.params({scrub:${String(options.legacy === true)}});
const s=await ck.scene({params,libs:['mural'],design:{width:1280,height:720,fit:'cover'}});
window.__scrollScene=s;window.__scrollStage=s.stage;
${options.legacy === true ? LEGACY : COMPOSE}
${READ_STATE}
window.__scrollReady=true;`;
  const region = `<section id="scroll-mural" style="min-height:160px" data-ck-custom-code="" data-ck-js-id="scroll-mural" data-ck-js="${attribute(code)}"><p id="authored-copy">A journey through the garden</p></section>`;
  const content = `<div id="before">Before the mural</div>${region}<div id="after">After the mural</div>`;
  const markup =
    options.nested === true
      ? `<div id="scroll-container">${content}</div>`
      : options.autoHeightClip === true
        ? `<div id="auto-height-clip">${content}</div>`
        : content;
  const themeCss = `
html{--t-surface:#101525;--t-text:#f1f5f9;--t-accent:#67e8f9;font-family:system-ui}
*{box-sizing:border-box}#before{height:240px;background:#243047}#after{height:500px;background:#374151}
#scroll-mural{height:${options.nested === true ? 'calc(100vh - 80px)' : '100vh'};position:relative;overflow:hidden}
#authored-copy{position:relative;z-index:1;margin:0;padding:12px}
#auto-height-clip{overflow-x:hidden;overflow-y:auto}
#scroll-container{height:calc(100vh - 80px);overflow-y:auto;overscroll-behavior:contain;margin-top:40px;border:2px solid #67e8f9}`;
  const html = await buildStudioPreviewHtml({
    code,
    markup,
    themeCss,
    dir: options.dir ?? 'ltr',
    lang: options.dir === 'rtl' ? 'ar' : 'en',
    reducedMotion: options.reducedMotion ?? false,
    trust: 'unreviewed',
  });
  await page.setContent(
    '<!doctype html><html><body style="margin:0;overflow:hidden"><script>window.__previewErrors=[];addEventListener("message",e=>{if(e.data?.type==="ck-preview:error")window.__previewErrors.push(e.data.message)});</script><iframe title="Scroll mural" sandbox="allow-scripts" style="border:0;width:100vw;height:100vh;display:block"></iframe></body></html>',
  );
  await page.locator('iframe').evaluate((element, srcdoc) => {
    (element as HTMLIFrameElement).srcdoc = srcdoc;
  }, html);
  const frame = page.frames().find((candidate) => candidate.parentFrame() !== null);
  if (frame === undefined) throw new Error('Scroll mural preview frame is missing.');
  await frame.waitForFunction('window.__scrollReady===true', undefined, { timeout: 30_000 });
  expect(await frame.locator('[data-ck-js-error]').count()).toBe(0);
  await frame.locator('canvas').waitFor({ state: 'visible' });
  return frame;
}

export function readScrollMural(frame: Frame): Promise<ScrollMuralState> {
  return frame.evaluate<ScrollMuralState>('window.__scrollState()');
}

/** Native wheel input must move the owning scroll container without locking its parent page. */
export async function wheelTo(page: Page, frame: Frame, offset: number): Promise<void> {
  const initial = await readScrollMural(frame);
  const viewport = page.viewportSize();
  await page.mouse.move(
    Math.max(20, (viewport?.width ?? 1280) / 2),
    initial.viewportTop + initial.viewportHeight / 2,
  );
  await page.mouse.wheel(0, offset - initial.offset);
  await expect
    .poll(async () => Math.abs((await readScrollMural(frame)).offset - offset), { timeout: 5_000 })
    .toBeLessThanOrEqual(2);
  await frame.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      }),
  );
}
