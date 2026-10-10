import { z } from 'zod';

import {
  CUSTOM_CODE_REGION_CSS_MAX,
  CUSTOM_CODE_REGION_JS_MAX,
  customCodeTree,
  customCss,
  customJs,
  defineBlockSchema,
  emptyCustomCodeTree,
} from '@craftkit/builder-schema';
// pixi-studio:schema-library additions (2026-10-10): script values and library meta beside `js` (DESIGN D8).
import { customCodeJsMeta, customCodeJsParams } from '@craftkit/builder-schema';
// end pixi-studio:schema-library additions

/**
 * The assistant's escape hatch, as a block.
 *
 * Everything the product ships is a registered block with a fixed prop
 * vocabulary, and that is what makes a document editable, validated, and
 * undoable. It is also what bounds the design space: a request the catalog has
 * no shape for ("a CV page with a diagonal timeline") has, until now, had no
 * answer except "the nearest section that already exists".
 *
 * This block is the answer. It stores a TREE rather than a page of markup, so
 * the document stays JSON (Law J), the door still validates every write, and
 * undo still moves one node. What changes is that the tree's shape is authored
 * per request instead of chosen from a list.
 *
 * ## Why it is one node and not many
 *
 * A generated section could instead be expanded into dozens of real document
 * nodes. That was rejected for v1: it multiplies the undo history for one
 * user action, and it makes "regenerate this section" a diff across dozens of
 * nodes rather than one prop write. One node also states the truth plainly in
 * the layers tree — this region was authored by the assistant, and it is
 * edited as a unit.
 */
export const customCodeSchema = defineBlockSchema({
  type: 'customCode',
  /*
    The description is the model's ONLY instruction manual for this block, and
    the one piece of catalog data present in every mode — so the reference rule
    is stated here rather than in a separate index. A second list of
    referenceable components would be a second source of truth about the
    registry, and it would go stale the first time a pack was added.
  */
  description:
    'A freely composed region, for requests no registered block expresses (an unusual layout, a bespoke CV page, a diagonal timeline). Its `tree` holds two kinds of node: `{kind:"element"}` for markup you author (any tag in the schema enum, styled with `className` utilities), and `{kind:"component", component:"<type>"}` to place ANY OTHER BLOCK IN THIS CATALOG inside the region by its `type` — that block validates its own props, and its children render into its default slot. `{kind:"icon", name:"<lucide-name>"}` draws a Lucide icon by its kebab-case name (mail, map-pin, arrow-right; no brand logos exist — use link or globe). When the tree is written as markup, a component is `<ck-component type=\'<type>\' props=\'{…}\'>…</ck-component>` and nothing else: a tag named after a block is not that block and becomes an empty div. `className` accepts the utility classes this page generates (the prompt says which); for styling utilities cannot express, name a class `ck-something` and write its rule in this block `css` prop, which is scoped to this region. Prefer a registered block on its own when one already fits; reach for this when none does.',
  props: z.object({
    /**
     * A short human label. This is what the layers tree shows, and it is the
     * only way a page of several generated regions stays navigable.
     */
    label: z.string().max(80).default('Custom section'),
    tree: customCodeTree().default(emptyCustomCodeTree()),
    /**
     * Region-scoped CSS. Rendered inside a `<style>` whose every selector the
     * renderer prefixes with this node's `[data-ck]`, so a rule here cannot
     * reach a sibling region or the surrounding page.
     *
     * Hook it to elements with `ck-`-prefixed class names: those are the one
     * namespace the AI door admits without a generated utility behind them,
     * precisely because their CSS is expected to come from here.
     */
    css: customCss(CUSTOM_CODE_REGION_CSS_MAX),
    /**
     * Region script (free-code mode, 2026-10-09). The BODY of an async function with one
     * parameter, `ck` (`root`, `editor`, `reducedMotion`, `onDispose`, `pixi()`, `stage()`),
     * run when the region mounts — on the editor canvas and on the published site alike.
     *
     * It is a prop of its own and not part of `tree`, which cannot express a `<script>` and
     * must not learn to. The renderer never emits one either: the code rides on the region as
     * `data-ck-js`, and the `scripts` behaviour pack evaluates it. The composer toggle gates who
     * may AUTHOR it; a saved script always runs.
     */
    js: customJs(CUSTOM_CODE_REGION_JS_MAX),
    // pixi-studio:schema-library additions (2026-10-10)
    /**
     * Pixi Studio (DESIGN D8). `jsParams` holds the values the script reads through
     * `ck.params(defaults)` — rendered as `data-ck-params`, so changing one re-runs the region
     * without touching its code; only keys that differ from the defaults are stored. `jsMeta`
     * holds the library reference (`ref`) and the param spec (`params`) that drives the
     * Inspector form; it is never rendered. Both optional: documents without them are unchanged.
     */
    jsParams: customCodeJsParams(),
    jsMeta: customCodeJsMeta(),
    // end pixi-studio:schema-library additions
  }),
  propertyGroups: {
    label: { tab: 'content', section: 'Identity' },
    tree: { tab: 'content', section: 'Composition' },
    css: { tab: 'advanced', section: 'Custom CSS' },
    js: { tab: 'advanced', section: 'Custom JS' },
    // pixi-studio:schema-library additions (2026-10-10)
    jsParams: { tab: 'advanced', section: 'Script controls' },
    jsMeta: { tab: 'advanced', section: 'Script controls' },
    // end pixi-studio:schema-library additions
  },
  /*
    No slots. Children live INSIDE the tree, where the assistant places them,
    rather than in a document slot the tree would have to address by index —
    two competing sources of structure for one region.
  */
  /*
    One example, showing BOTH node kinds and the scoped CSS — because an
    example showing only authored markup would teach the model that the
    component reference does not exist, which is the more expensive of the two
    mistakes it can make here.

    Its colours are the site theme's roles, so it is an example of a region
    that FOLLOWS the site theme — the one case the colour rule gives roles to.
  */
  examples: [
    {
      prompt: 'a CV header with a photo, a name, and a card of skills',
      node: {
        type: 'customCode',
        props: {
          label: 'CV header',
          css: '.ck-cv-name { background: linear-gradient(90deg, var(--t-accent), var(--t-text)); -webkit-background-clip: text; color: transparent }',
          tree: {
            kind: 'root',
            children: [
              {
                kind: 'element',
                tag: 'section',
                className: 'grid gap-8 bg-surface p-16 md:grid-cols-3',
                children: [
                  {
                    kind: 'element',
                    tag: 'img',
                    className: 'h-40 w-40 rounded-full object-cover',
                    attributes: { src: '/portrait.jpg', alt: 'Portrait' },
                  },
                  {
                    kind: 'element',
                    tag: 'div',
                    className: 'md:col-span-2',
                    children: [
                      {
                        kind: 'element',
                        tag: 'h1',
                        className: 'ck-cv-name text-6xl font-bold',
                        text: 'Reem Haddad',
                      },
                      {
                        kind: 'element',
                        tag: 'p',
                        className: 'flex items-center gap-2 text-lg text-text-muted',
                        text: 'Product designer',
                        children: [
                          // A Lucide icon by name; decorative here, so no label.
                          { kind: 'icon', name: 'map-pin', className: 'h-6 w-6 text-accent' },
                        ],
                      },
                      // A registered block, placed inside the composed region.
                      { kind: 'component', component: 'card', props: {} },
                    ],
                  },
                ],
              },
            ],
          },
        },
      },
    },
  ],
});

export type CustomCodeBlockProps = z.output<typeof customCodeSchema.props>;
