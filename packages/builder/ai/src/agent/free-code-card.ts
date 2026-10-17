/**
 * The card the model reads in FREE CODE MODE (2026-10-09): how a customCode
 * block's `js` prop is written — the `ck` runtime, a PixiJS stage, and the
 * rules page code keeps. It is for page code the PAGE runs, and has nothing to
 * do with edit scripts (`script.run`, api-card.ts), which run once in the
 * editor.
 *
 * It travels per request, never in the cached prefix: the ai-server appends it
 * to the user message only when the wire request says `freeCode: true`
 * (provider/wire.ts), so a flipped switch never moves the cached rules. The
 * server carries a verbatim copy between `// BEGIN FREE CODE CARD` and
 * `// END FREE CODE CARD`; its drift test (free-code-card.test.ts) imports this
 * file and compares the text exactly.
 *
 * The examples are plain JavaScript written with single quotes, so they
 * survive inside a JSON string; a test runs them against a stub `ck`, and pins
 * the card at `FREE_CODE_CARD_MAX_CHARS` characters or fewer.
 */
export const FREE_CODE_CARD = `FREE CODE MODE is ON: real page JavaScript and custom PixiJS scenes are allowed. It OVERRIDES any "needs a code page" or "cannot" answer above: write the code.
WHERE: the "js" prop of a customCode block (max 32000 chars), beside "css": insertNode props.js, or setProp {id,key:"js",value}. No <script> tag.
LAYOUT: size a stage by its width, never vh: .ck-scene{position:relative;width:100%;aspect-ratio:16/9;min-height:320px}. Text over the canvas: position:relative;z-index:1, short, at an edge.
RUNTIME: js is the BODY of an async function(ck), run once per mount in the page (window, document reachable); errors are logged.
ck.root the region element: draw only inside it. ck.editor true on the editor canvas. ck.reducedMotion true when motion is unwanted. ck.onDispose(fn) cleanup: timers, listeners, observers, frames.
await ck.pixi() the pixi.js v8 namespace. await ck.stage({background?,pointer?,resolution?}) -> {PIXI,app,canvas}: a ready transparent PIXI.Application filling ck.root as it resizes (clicks only with pointer:true), destroyed on dispose; re-lay out on app.renderer.on('resize',fn).
SCENES with libraries: const s=await ck.scene({libs:['physics','fx'],seed?,pointer?,audio?}) -> each listed lib loaded as s.lib.<key>, sized by s.width/s.height (never window), cleanup via s.dispose. A mural composes once in s.world: design:{width:1280,height:720,fit:'cover',zoom:true} + libs:['viewport']. List every lib you use in a literal array; the active playbooks name the keys.
RULES: no eval, document.write, host localStorage, or network calls the person did not ask for. Guard motion with ck.reducedMotion (one still frame). Hex colours are free. Arabic page: keep text in the tree, not in Pixi, unless asked. Tree hooks the code finds: a playbook's or data-scene-action|key|status|part|value; other data-* are dropped.
e.g. Pixi walkers: const {PIXI,app}=await ck.stage();const ws=Array.from({length:5},(_,i)=>{const g=new PIXI.Graphics().roundRect(-14,-8,28,34,10).fill(0xf59e0b).circle(0,-20,11).fill(0xfde68a);g.x=i*140;app.stage.addChild(g);return g});const lay=()=>ws.forEach(g=>{g.y=app.screen.height*.7});lay();app.renderer.on('resize',lay);if(!ck.reducedMotion)app.ticker.add(t=>ws.forEach(g=>{g.x=(g.x+1.5*t.deltaTime)%(app.screen.width+60)}));
READY, no js: a counter is <b data-ck-behavior="count-up" data-ck-to="250">250</b>; typed-words, read-more, back-to-top, scroll-spy, filter, dismiss, tabs, marquee, countdown and copy-text are data-ck-behavior values too (the site playbook). Write js only for what none of them does.
e.g. cleanup: const h=()=>ck.root.classList.toggle('narrow',innerWidth<600);h();addEventListener('resize',h);ck.onDispose(()=>removeEventListener('resize',h))`;

/** The card's worked examples (the lines that start with "e.g. "), as code. */
export function freeCodeCardExamples(card: string = FREE_CODE_CARD): readonly string[] {
  return card
    .split('\n')
    .filter((line) => line.startsWith('e.g. '))
    .map((line) => line.slice(line.indexOf(': ') + ': '.length));
}

/** The card's budget: a test pins it. */
export const FREE_CODE_CARD_MAX_CHARS = 2_800;

/**
 * The one line a request that ASKS for page code gets while the switch is off
 * (per request, like the card): the model tells the person where the switch is
 * and builds the closest closed scene, instead of answering "this needs a
 * programmatic page outside this editor" (the 2026-10-09 refusal).
 */
export const FREE_CODE_OFF_HINT =
  'Custom page JavaScript and custom PixiJS scenes are OFF; tell the user to enable the free-code switch («وضع الكود الحر») in the composer (say so in the rationale), and meanwhile use a closed motion scene (mural/parallax-layers/particles/…) instead of refusing.';
