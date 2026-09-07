/**
 * The utility-class vocabulary, as DATA.
 *
 * ## Why this file exists at all
 *
 * Tailwind v4 generates utilities at BUILD time by scanning source text. The
 * assistant writes class names at RUNTIME, so the classes it may use have to be
 * declared up front — which the application does, in `@source inline(...)`
 * directives in its Tailwind entry.
 *
 * That declaration is CSS. It cannot be imported, iterated, or asserted
 * against, which means the door that should refuse an unusable class has
 * nothing to check and the failure surfaces the worst possible way: the class
 * is simply inert, the canvas looks subtly wrong, and nothing anywhere says
 * why.
 *
 * So the vocabulary is stated here, in the same pattern language, and the
 * application's CSS is generated FROM this list rather than beside it. One
 * source, two consumers: Tailwind generates from it, the door validates
 * against it, and neither can drift from the other without a test failing.
 *
 * ## Why patterns rather than a flat list
 *
 * Expanded, this is ~2,700 class names. Shipping that as an array would put
 * 60KB of strings in every bundle that imports the schema package to validate
 * one plan. The patterns expand on demand, once, behind a lazy cache.
 *
 * ## Its relationship to `findRejectedUtilities`
 *
 * There are two rules about class names in this package and they answer
 * different questions. Neither replaces the other:
 *
 * | | `findRejectedUtilities` (blocks/utility-classes.ts) | this file |
 * |---|---|---|
 * | asks | may a document STORE this class? | will this class HAVE any CSS? |
 * | law | theming — no arbitrary values, no default palette | generation — Tailwind only emits what it saw |
 * | shape | denylist; everything else passes | allowlist; everything else fails |
 * | applies to | every `className` prop in the product | classes the ASSISTANT writes into a tree |
 *
 * They overlap on exactly one family and the overlap is deliberate: this
 * vocabulary GENERATES Tailwind's default palette (`bg-blue-500`) because the
 * product's owner decided the assistant may use it, while `findRejectedUtilities`
 * still REFUSES it for a registered block's own `className` prop, where the
 * theming law stands. A test in this module's suite pins the boundary: the
 * only vocabulary entries the theming law objects to are `default-palette`
 * ones — never an arbitrary value, which has no CSS and is refused by both.
 *
 * The AI door always runs THIS law over a custom-code tree (an inert class is
 * a silent failure) and runs the theming law only under
 * `AiCompositionPolicy.colourPolicy: 'tokens'`.
 */

/** One `@source inline(...)` pattern: `{a,b}` alternates and `{0..N}` ranges. */
export type UtilityPattern = string;

/**
 * The vocabulary.
 *
 * Deliberately GENEROUS. Measured, the full expansion costs ~15KB gzipped of
 * generated CSS — about a quarter of one hero image — while a vocabulary too
 * narrow to express a design costs the feature its reason to exist. When in
 * doubt, a utility belongs here.
 *
 * Colours resolve through `--t-*` (see the renderer's Tailwind token bridge),
 * so `bg-accent` is a REFERENCE, not a colour: re-point the token and every
 * page moves. That is why the palette entries name roles and not hues.
 */
export const UTILITY_VOCABULARY: readonly UtilityPattern[] = Object.freeze([
  // ── Colour, through the token bridge ──────────────────────────────────────
  '{sm:,md:,lg:,hover:,}{bg,text,border}-{accent,accent-text,success,success-text,surface,surface-inverse,text,text-inverse,text-muted}',
  '{bg,text,border}-{white,black,transparent,current,inherit}',
  '{from,via,to}-{accent,surface,surface-inverse,text,text-muted,transparent,white,black}',
  'bg-gradient-to-{t,tr,r,br,b,bl,l,tl}',

  // ── Colour, Tailwind's own palette ────────────────────────────────────────
  /*
    Free by product decision. These do NOT follow the site theme — re-point
    `--t-accent` and a `bg-blue-600` stays blue — which is exactly why the
    original law refused them. The person building this product decided the
    assistant may use them anyway, the way any Tailwind user does, and that
    the roles above are a preference rather than a rule. The theming law
    survives as `AiCompositionPolicy.colourPolicy: 'tokens'` for a host that
    wants it back. +2,178 utilities (4,875 total); estimated at ~55 bytes a
    rule that is ~260 KB of CSS raw and ~40 KB gzipped for the whole
    vocabulary — accepted by the same decision.
  */
  '{bg,text,border}-{slate,gray,zinc,neutral,stone,red,orange,amber,yellow,lime,green,emerald,teal,cyan,sky,blue,indigo,violet,purple,fuchsia,pink,rose}-{50,100,200,300,400,500,600,700,800,900,950}',
  'hover:{bg,text,border}-{slate,gray,zinc,neutral,stone,red,orange,amber,yellow,lime,green,emerald,teal,cyan,sky,blue,indigo,violet,purple,fuchsia,pink,rose}-{50,100,200,300,400,500,600,700,800,900,950}',
  '{from,via,to}-{slate,gray,zinc,neutral,stone,red,orange,amber,yellow,lime,green,emerald,teal,cyan,sky,blue,indigo,violet,purple,fuchsia,pink,rose}-{50,100,200,300,400,500,600,700,800,900,950}',

  // ── Spacing ───────────────────────────────────────────────────────────────
  '{sm:,md:,lg:,}p{,x,y,t,b,s,e}-{0..16}',
  '{sm:,md:,lg:,}m{,x,y,t,b,s,e}-{0..16} mx-auto',
  '{sm:,md:,lg:,}gap-{0..12} {sm:,md:,lg:,}gap-{x,y}-{0..12}',
  'space-{x,y}-{0,1,2,3,4,6,8} divide-{x,y}',

  // ── Type ──────────────────────────────────────────────────────────────────
  '{sm:,md:,lg:,}text-{xs,sm,base,lg,xl,2xl,3xl,4xl,5xl,6xl,7xl,8xl,9xl}',
  'font-{light,normal,medium,semibold,bold,extrabold,black}',
  'text-{left,center,right,justify,start,end} italic underline line-through uppercase lowercase capitalize',
  'tracking-{tighter,tight,normal,wide,wider,widest} leading-{none,tight,snug,normal,relaxed,loose}',
  'whitespace-{normal,nowrap,pre,pre-line} break-{words,all,keep} truncate',
  'line-clamp-{1,2,3,4,5,6,none} antialiased tabular-nums',

  // ── Display and flow ──────────────────────────────────────────────────────
  '{sm:,md:,lg:,}{flex,grid,block,inline,inline-block,inline-flex,inline-grid,hidden,contents}',
  'flex-{row,row-reverse,col,col-reverse,wrap,wrap-reverse,nowrap,1,auto,initial,none}',
  'shrink-{0,1} grow-{0,1} basis-{0,auto,full,1/2,1/3,2/3,1/4,3/4}',
  '{sm:,md:,lg:,}items-{start,center,end,stretch,baseline}',
  '{sm:,md:,lg:,}justify-{start,center,end,between,around,evenly,stretch}',
  '{sm:,md:,lg:,}justify-items-{start,center,end,stretch}',
  'place-{items,content,self}-{start,center,end,between,stretch}',
  'self-{auto,start,center,end,stretch,baseline} order-{1,2,3,4,5,6,first,last,none}',

  // ── Grid ──────────────────────────────────────────────────────────────────
  '{sm:,md:,lg:,}grid-cols-{1..12} grid-cols-none',
  '{sm:,md:,lg:,}col-span-{1..12} col-span-full col-start-{1..12} col-end-{1..13}',
  '{sm:,md:,lg:,}row-span-{1..6} row-start-{1..6} row-end-{1..7}',
  '{sm:,md:,lg:,}grid-rows-{1..6} grid-flow-{row,col,dense,row-dense,col-dense}',
  'auto-cols-{auto,min,max,fr} auto-rows-{auto,min,max,fr}',

  // ── Position ──────────────────────────────────────────────────────────────
  '{sm:,md:,lg:,}{static,relative,absolute,fixed,sticky} isolate isolation-auto',
  '{sm:,md:,lg:,}{inset,top,right,bottom,left,start,end}-{0,1,2,3,4,6,8,12,16,auto,full}',
  'inset-{x,y}-{0,auto} z-{0,10,20,30,40,50,auto}',

  // ── Sizing ────────────────────────────────────────────────────────────────
  '{sm:,md:,lg:,}{w,h}-{0,1,2,3,4,6,8,10,12,16,20,24,32,40,48,56,64,auto,px,full,screen,fit,min,max}',
  '{w,h}-{1/2,1/3,2/3,1/4,3/4}',
  '{sm:,md:,lg:,}max-w-{none,xs,sm,md,lg,xl,2xl,3xl,4xl,5xl,6xl,7xl,full,prose,screen}',
  'min-w-{0,full,fit,min,max} min-h-{0,full,screen,fit} max-h-{full,screen,none}',
  'aspect-{auto,square,video}',

  // ── Surface ───────────────────────────────────────────────────────────────
  'rounded{,-none,-sm,-md,-lg,-xl,-2xl,-3xl,-full}',
  'rounded-{t,r,b,l,tl,tr,br,bl}-{none,sm,md,lg,xl,2xl,3xl,full}',
  'shadow{,-none,-sm,-md,-lg,-xl,-2xl,-inner}',
  'border{,-0,-2,-4,-8} border-{t,r,b,l,x,y}-{0,2,4} border-{solid,dashed,dotted,none}',
  'ring{,-0,-1,-2,-4} ring-{accent,surface,text,transparent} ring-offset-{0,2,4}',
  'outline-{none,accent} outline-offset-{2,4}',
  'opacity-{0,5,10,20,25,30,40,50,60,70,75,80,90,95,100}',
  'bg-{cover,contain,center,no-repeat,fixed} object-{cover,contain,fill,none,scale-down}',
  'object-{top,center,bottom,left,right}',
  'overflow{,-x,-y}-{auto,hidden,clip,visible,scroll}',
  'blur-{none,sm,md,lg,xl,2xl,3xl} backdrop-blur-{none,sm,md,lg,xl,2xl,3xl}',
  'backdrop-{brightness,saturate}-{50,75,100,125,150} mix-blend-{normal,multiply,screen,overlay}',

  // ── Motion and interaction ────────────────────────────────────────────────
  'transition{,-none,-all,-colors,-opacity,-shadow,-transform}',
  'duration-{75,100,150,200,300,500,700,1000} delay-{75,100,150,200,300,500,700,1000}',
  'ease-{linear,in,out,in-out} animate-{none,spin,ping,pulse,bounce}',
  '{hover:,focus:,group-hover:,}scale-{90,95,100,105,110,125}',
  'rotate-{0,1,2,3,6,12,45,90,180} -rotate-{1,2,3,6,12,45,90,180}',
  'translate-{x,y}-{0,1,2,4,8,px,full} -translate-{x,y}-{1,2,4,8,full}',
  'transform-gpu will-change-transform motion-reduce:transform-none',
  '{hover:,focus:,}{opacity-{75,90,100},underline,no-underline}',
  'cursor-{pointer,default,not-allowed,wait,text,move} select-{none,text,all,auto}',
  'pointer-events-{none,auto} sr-only not-sr-only',

  // ── Everyday Tailwind ─────────────────────────────────────────────────────
  /*
    Measured on real plans (2026-09-07): a strong model writing a landing page
    reached for icon sizes (`h-5 w-5`), section rhythm (`py-24`), the centring
    idiom (`top-1/2 -translate-y-1/2`), overlays (`bg-black/50`), hover lifts
    (`hover:-translate-y-1 hover:shadow-xl`), `group`, `font-mono` — and every
    one was refused. Nothing below is exotic; it is what any Tailwind user
    writes without thinking, and refusing it made free composition a trap.
    Every pattern here is a class Tailwind v4 generates, because a class the
    build does not emit must not be admitted by the door.
  */
  'group peer container',
  // Spacing: section rhythm needs 20/24/32, half-steps for fine alignment, negatives for overlaps.
  '{sm:,md:,lg:,xl:,}p{,x,y,t,b,s,e}-{17..24} {sm:,md:,lg:,xl:,}p{,x,y,t,b}-{28,32,36,40,48,56,64}',
  '{sm:,md:,lg:,xl:,}m{,x,y,t,b,s,e}-{17..24} {sm:,md:,lg:,xl:,}m{,x,y,t,b}-{28,32,40,48} -m{,x,y,t,b,s,e}-{1..16}',
  'xl:{p,m}{,x,y,t,b}-{0..16} xl:gap-{0..12} {sm:,md:,lg:,xl:,}gap-{14,16,20,24} space-{x,y}-{5,10,12,16,20} -space-{x,y}-{1,2,3,4}',
  '{p,m}{,x,y,t,b}-{0.5,1.5,2.5,3.5} gap-{0.5,1.5,2.5,3.5} {w,h,size}-{0.5,1.5,2.5,3.5} inset-{0.5,1.5,2.5,3.5}',
  // Sizing: every step to 24, the big steps, `size-*`, fifths and sixths, viewport units.
  '{sm:,md:,lg:,xl:,}{w,h,size}-{0..24} {sm:,md:,lg:,xl:,}{w,h,size}-{28,32,36,40,44,48,52,56,60,64,72,80,96}',
  '{w,h,size}-{auto,px,full,fit,min,max} {w,h}-{screen,dvh,svh,lvh} w-{dvw,svw} size-{1/2,1/3,2/3,1/4,3/4}',
  '{w,h}-{1/5,2/5,3/5,4/5,1/6,5/6,1/12,5/12,7/12,11/12}',
  '{sm:,md:,lg:,xl:,}max-w-{min,max,fit} max-w-{0..24} max-w-{32,40,48,56,64,72,80,96}',
  'min-h-{dvh,svh,lvh} min-h-{0..24} min-h-{32,40,48,56,64,72,80,96} max-h-{0..24} max-h-{32,40,48,56,64,72,80,96} max-h-{dvh,svh}',
  'min-w-{1..24} min-w-{32,40,48,56,64,72,80,96}',
  // Position: halves and thirds for the centring idiom, negatives for overlaps, more z.
  '{sm:,md:,lg:,}{inset,top,right,bottom,left,start,end}-{1/2,1/3,2/3,1/4,3/4,5,7,10,14,20,24,32,40,48,56,64}',
  '-{inset,top,right,bottom,left,start,end}-{1..16} -{inset,top,right,bottom,left}-{1/2,1/3,2/3,1/4,3/4,20,24,32}',
  'inset-{x,y}-{1..8} -z-10 z-{1,2,3,4,5}',
  // Type: families, wrapping, lists, decoration, numeric leading, the xl sizes.
  'font-{sans,serif,mono} text-{balance,pretty,wrap,nowrap}',
  'xl:text-{xs,sm,base,lg,xl,2xl,3xl,4xl,5xl,6xl,7xl,8xl,9xl} 2xl:text-{4xl,5xl,6xl,7xl,8xl,9xl}',
  'leading-{3..10} list-{none,disc,decimal,inside,outside} underline-offset-{1,2,4,8} decoration-{1,2,4,8}',
  'decoration-{accent,text,text-muted} align-{baseline,top,middle,bottom} hyphens-{none,auto} indent-{4,8}',
  // Colour with opacity, for overlays and glass: the roles, black and white, and the palette's mid-to-dark shades.
  '{bg,text,border,ring}-{white,black,accent,surface,surface-inverse,text,text-muted}/{5,10,15,20,25,30,40,50,60,70,75,80,90,95}',
  '{hover:,}bg-{slate,gray,zinc,neutral,stone,red,orange,amber,yellow,lime,green,emerald,teal,cyan,sky,blue,indigo,violet,purple,fuchsia,pink,rose}-{500,700,900,950}/{10,20,30,50,80}',
  'border-{slate,gray,zinc,neutral,stone,red,orange,amber,yellow,lime,green,emerald,teal,cyan,sky,blue,indigo,violet,purple,fuchsia,pink,rose}-{300,500,700}/{20,40}',
  'shadow-{slate,gray,zinc,neutral,stone,red,orange,amber,yellow,lime,green,emerald,teal,cyan,sky,blue,indigo,violet,purple,fuchsia,pink,rose}-{500,900}/{20,30,50}',
  'shadow-{accent,black,white}/{10,20,30,40,50} hover:{bg,text,border}-{white,black,transparent}',
  'hover:{bg,border}-{white,black,accent,surface,text}/{5,10,20,30,50}',
  // Rings, borders, divides, outlines, with hues and focus states.
  'ring-{slate,gray,zinc,neutral,stone,red,orange,amber,yellow,lime,green,emerald,teal,cyan,sky,blue,indigo,violet,purple,fuchsia,pink,rose}-{300,400,500,600,700} ring-{white,black} ring-inset',
  '{focus:,focus-visible:,}ring-{0,1,2,4,8} {focus:,focus-visible:,}ring-{accent,surface,text,transparent,white,black}',
  '{focus:,focus-visible:,}ring-offset-{0,2,4} {focus:,focus-visible:,}outline-none {focus:,focus-visible:,}border-{accent,text}',
  'border-{t,r,b,l,x,y,s,e} border-{t,r,b,l,x,y}-{1,8} outline-{1,2,4} outline-{dashed,dotted}',
  'divide-{white,black,accent,surface,text,text-muted} divide-{slate,gray,zinc,neutral,stone}-{100,200,300,700,800}',
  'divide-{white,black,accent,surface,text,text-muted}/{10,20,30,50} border-{white,black}/{10,20,30,50}',
  // Interaction states on the everyday properties: lifts, fades, spins, colours.
  '{hover:,focus:,focus-visible:,active:,group-hover:,peer-hover:,}{shadow{,-none,-sm,-md,-lg,-xl,-2xl},opacity-{0,50,60,70,80,90,100},underline,no-underline}',
  '{hover:,focus:,active:,group-hover:,}{scale-{0,50,75,90,95,100,105,110,125,150},rotate-{0,1,2,3,6,12,45,90,180},-rotate-{1,2,3,6,12,45,90,180}}',
  '{hover:,focus:,active:,group-hover:,}{translate-{x,y}-{0,0.5,1,2,3,4,8},-translate-{x,y}-{0.5,1,2,3,4,8}}',
  'translate-{x,y}-{1/2,1/3,2/3} -translate-{x,y}-{1/2,1/3,2/3}',
  '{hover:,group-hover:,}{bg,text,border}-{accent,accent-text,success,surface,surface-inverse,text,text-inverse,text-muted}',
  'group-hover:text-{slate,gray,zinc,neutral,stone,red,orange,amber,yellow,lime,green,emerald,teal,cyan,sky,blue,indigo,violet,purple,fuchsia,pink,rose}-{50,100,200,300,400,500,600,700,800,900,950}',
  'disabled:{opacity-50,cursor-not-allowed,pointer-events-none} {first:,last:,odd:,even:}{border-0,border-t,border-b,bg-surface,rounded-t-2xl,rounded-b-2xl}',
  // Effects: filters, drop shadows, blends, skews, origins.
  'drop-shadow{,-none,-sm,-md,-lg,-xl,-2xl} grayscale{,-0} {hover:,group-hover:,}grayscale-0 invert{,-0} sepia{,-0}',
  'brightness-{50,75,90,95,100,105,110,125,150} contrast-{50,75,100,125,150} saturate-{0,50,100,150,200} hue-rotate-{15,30,60,90,180}',
  'backdrop-{blur,brightness,saturate,contrast}-{0,50,75,90,95,100,105,110,125,150} backdrop-grayscale',
  'bg-blend-{normal,multiply,screen,overlay,darken,lighten} mix-blend-{darken,lighten,difference,exclusion,soft-light,hard-light,color-dodge,color-burn,luminosity}',
  'skew-{x,y}-{0,1,2,3,6,12} -skew-{x,y}-{1,2,3,6,12} scale-{x,y}-{75,90,95,100,105,110,125}',
  'origin-{center,top,bottom,left,right,top-left,top-right,bottom-left,bottom-right}',
  // Layout: the xl and 2xl breakpoints, columns, aspect ratios, scrolling.
  'xl:{flex,grid,block,hidden,inline-flex} xl:grid-cols-{1..12} xl:col-span-{1..12} xl:{items,justify}-{start,center,end,between,stretch} xl:flex-{row,col}',
  '2xl:grid-cols-{2,3,4,5,6} 2xl:{p,px,py}-{8,12,16,20,24,32} 2xl:max-w-{5xl,6xl,7xl}',
  'columns-{1,2,3,4,5,6} break-inside-avoid aspect-{4/3,3/2,3/4,2/3,16/9,9/16,21/9,1/1}',
  'overscroll-{auto,contain,none} scroll-{smooth,auto} snap-{x,y,mandatory,proximity,start,center,end} scroll-{m,p}{,x,y}-{0,4,8,16,24}',
  'flex-{2,3} basis-{1/5,2/5,3/5,4/5,1/6,5/6} grow shrink order-{7,8,9,10,11,12} col-auto row-auto',
  // Misc: visibility, appearance, cursors, resize, touch, accents, backgrounds, logical corners.
  'visible invisible collapse appearance-none resize{,-none,-x,-y} touch-{auto,none,manipulation}',
  'accent-{accent,white,black} caret-{accent,text} cursor-{grab,grabbing,zoom-in,zoom-out,help,crosshair,progress}',
  'bg-{local,scroll} bg-{top,bottom,left,right,left-top,right-top,left-bottom,right-bottom} bg-{auto,repeat,repeat-x,repeat-y,round,space}',
  'object-{left-top,right-top,left-bottom,right-bottom} rounded-{s,e,ss,se,es,ee}-{none,sm,md,lg,xl,2xl,3xl,full}',
]);

/**
 * Expand one pattern into its class names.
 *
 * Mirrors Tailwind's own `@source inline(...)` grammar: `{a,b}` alternates,
 * `{0..N}` inclusive ranges, and whitespace separating independent patterns.
 * Kept deliberately small — a bigger grammar here is a bigger chance of
 * disagreeing with the generator, and disagreement is the exact failure this
 * file exists to prevent.
 */
export function expandUtilityPattern(pattern: UtilityPattern): readonly string[] {
  /*
    Whitespace separates INDEPENDENT patterns, so each token expands alone.
    Expanded jointly, a line of five groups multiplied their sizes together —
    3.5 million strings — before splitting back into the same few hundred
    names; the vocabulary took half a minute to build and timed out its test.
  */
  return pattern
    .split(/\s+/u)
    .filter((token) => token !== '')
    .flatMap((token) => expandToken(token));
}

function expandToken(pattern: UtilityPattern): readonly string[] {
  let expansions: string[] = [pattern];
  for (;;) {
    let changed = false;
    const next: string[] = [];
    for (const candidate of expansions) {
      const match = /\{([^{}]*)\}/u.exec(candidate);
      if (match === null) {
        next.push(candidate);
        continue;
      }
      changed = true;
      const body = match[1] ?? '';
      const range = /^(\d+)\.\.(\d+)$/u.exec(body);
      const options =
        range === null ? body.split(',') : rangeValues(Number(range[1]), Number(range[2]));
      for (const option of options) {
        next.push(
          candidate.slice(0, match.index) + option + candidate.slice(match.index + match[0].length),
        );
      }
    }
    expansions = next;
    if (!changed) break;
  }
  return expansions.filter((name) => name !== '');
}

function rangeValues(from: number, to: number): string[] {
  const values: string[] = [];
  for (let at = from; at <= to; at += 1) values.push(String(at));
  return values;
}

let cachedVocabulary: ReadonlySet<string> | undefined;

/**
 * Every class name the vocabulary admits.
 *
 * Expanded once and cached: the set is ~1,800 entries and the door consults it
 * per class on every proposal, so re-expanding would turn an O(1) membership
 * test into an O(patterns) one for no reason.
 */
export function utilityVocabulary(): ReadonlySet<string> {
  cachedVocabulary ??= new Set(UTILITY_VOCABULARY.flatMap(expandUtilityPattern));
  return cachedVocabulary;
}

/**
 * The prefix reserved for classes styled by a region's OWN stylesheet.
 *
 * Without it the two halves of this feature contradict each other. A region
 * carries a `css` prop so it can express what utilities cannot — a keyframe, a
 * gradient headline, a clip path. Those rules need selectors, selectors need
 * class names, and a door that admits only generated utilities would reject
 * every one of them. The `css` prop would exist and be unusable.
 *
 * So one namespace is carved out and given the opposite rule: a `ck-` class is
 * admitted precisely BECAUSE no utility generates it — its CSS is expected to
 * come from the region's own scoped stylesheet. The prefix also makes the
 * distinction visible at the point of use: reading the markup, `bg-surface`
 * comes from the design system and `ck-hero-glow` comes from this region.
 *
 * It stays safe because the region's stylesheet is itself scoped: a `ck-` rule
 * is rewritten to `[data-ck="<id>"] .ck-…` and cannot reach a sibling region.
 */
export const CUSTOM_CLASS_PREFIX = 'ck-';

/**
 * Whether a class name belongs to the region-local namespace.
 *
 * A bracketed name is refused even under the prefix. `ck-[17px]` is not a hook
 * class with an odd name — it is an arbitrary Tailwind value that happens to
 * start with the prefix, and admitting it would let the namespace launder
 * exactly what `findRejectedUtilities` exists to refuse. The namespace grants
 * an exemption from the GENERATION rule; it grants none from the theming law.
 */
export function isCustomHookClass(name: string): boolean {
  if (!name.startsWith(CUSTOM_CLASS_PREFIX) || name.length === CUSTOM_CLASS_PREFIX.length) {
    return false;
  }
  return !name.includes('[') && !name.includes(']');
}

/**
 * The class names in `className` that neither the vocabulary generates nor the
 * region-local namespace claims.
 *
 * Returns them rather than a boolean so a rejection can NAME what was wrong —
 * "unknown utility class" with no class named is a message that costs its
 * reader a bisect.
 */
export function unknownUtilityClasses(className: string): readonly string[] {
  const vocabulary = utilityVocabulary();
  return className
    .split(/\s+/u)
    .filter((name) => name !== '')
    .filter((name) => !vocabulary.has(name) && !isCustomHookClass(name));
}

/**
 * The vocabulary as Tailwind `@source inline(...)` lines.
 *
 * This is the half that closes the loop: the application's CSS entry generates
 * its directives from here, so a utility added to the list above is generated
 * without anyone remembering to edit a stylesheet.
 */
export function utilitySourceDirectives(): string {
  /*
    One directive per whitespace-separated token, for the same reason the
    expander splits first: Tailwind brace-expands an inline source as a whole,
    so a line of several groups would cost it their product, not their sum.
  */
  return UTILITY_VOCABULARY.flatMap((pattern) => pattern.split(/\s+/u).filter((token) => token !== ''))
    .map((token) => `@source inline("${token}");`)
    .join('\n');
}
