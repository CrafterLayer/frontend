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
        range === null
          ? body.split(',')
          : rangeValues(Number(range[1]), Number(range[2]));
      for (const option of options) {
        next.push(
          candidate.slice(0, match.index) + option + candidate.slice(match.index + match[0].length),
        );
      }
    }
    expansions = next;
    if (!changed) break;
  }
  return expansions.flatMap((candidate) => candidate.split(/\s+/u)).filter((name) => name !== '');
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
  return UTILITY_VOCABULARY.map((pattern) => `@source inline("${pattern}");`).join('\n');
}
