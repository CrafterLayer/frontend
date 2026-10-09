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
WHERE: the "js" prop of a customCode block (max 32000 chars), beside "css": insertNode props.js, or setProp {id,key:"js",value}. Give the region a css height (e.g. min-height:70vh). No <script> tag.
RUNTIME: js is the BODY of an async function of one parameter ck, run once per mount in the page (window, document reachable); errors are logged.
ck.root the region element: draw only inside it. ck.editor true on the editor canvas. ck.reducedMotion true when motion is unwanted. ck.onDispose(fn) cleanup: timers, listeners, observers, frames.
await ck.pixi() the full pixi.js v8 namespace. await ck.stage({background?,pointer?,resolution?}) -> {PIXI,app,canvas}: a ready transparent PIXI.Application sized to ck.root, its canvas filling it (clicks only with pointer:true), destroyed on dispose.
RULES: no eval, document.write, host localStorage, or network calls the person did not ask for. Guard motion with ck.reducedMotion (one still frame). Hex colours are free. Arabic page: keep text in the tree, not in Pixi, unless asked.
e.g. Pixi walkers: const {PIXI,app}=await ck.stage();const ws=Array.from({length:5},(_,i)=>{const g=new PIXI.Graphics().roundRect(-14,-8,28,34,10).fill(0xf59e0b).circle(0,-20,11).fill(0xfde68a);g.x=i*140;g.y=app.screen.height*.7;app.stage.addChild(g);return g});if(!ck.reducedMotion)app.ticker.add(t=>ws.forEach(g=>{g.x=(g.x+1.5*t.deltaTime)%(app.screen.width+60)}));
e.g. DOM count-up on scroll (<b data-count="250"> in the tree): const el=ck.root.querySelector('[data-count]');if(el){const to=+el.dataset.count;let id=0;const io=new IntersectionObserver(([e])=>{if(!e.isIntersecting)return;io.disconnect();const t0=performance.now(),f=n=>{const k=ck.reducedMotion?1:Math.min(1,(n-t0)/1200);el.textContent=Math.round(to*k);if(k<1)id=requestAnimationFrame(f)};f(t0)});io.observe(el);ck.onDispose(()=>{io.disconnect();cancelAnimationFrame(id)})}
e.g. cleanup: const h=()=>ck.root.classList.toggle('narrow',innerWidth<600);h();addEventListener('resize',h);ck.onDispose(()=>removeEventListener('resize',h))`;

/** The card's worked examples (the lines that start with "e.g. "), as code. */
export function freeCodeCardExamples(card: string = FREE_CODE_CARD): readonly string[] {
  return card
    .split('\n')
    .filter((line) => line.startsWith('e.g. '))
    .map((line) => line.slice(line.indexOf(': ') + ': '.length));
}

/** The card's budget: a test pins it. */
export const FREE_CODE_CARD_MAX_CHARS = 2_200;

/**
 * The one line a request that ASKS for page code gets while the switch is off
 * (per request, like the card): the model tells the person where the switch is
 * and builds the closest closed scene, instead of answering "this needs a
 * programmatic page outside this editor" (the 2026-10-09 refusal).
 */
export const FREE_CODE_OFF_HINT =
  'Custom page JavaScript and custom PixiJS scenes are OFF; tell the user to enable the free-code switch («وضع الكود الحر») in the composer (say so in the rationale), and meanwhile use a closed motion scene (mural/parallax-layers/particles/…) instead of refusing.';
