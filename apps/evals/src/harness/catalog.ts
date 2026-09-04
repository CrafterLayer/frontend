import {
  craftkitHeadlessBlocks,
  fixtureBlocks,
  type TrustedExtensionManifest,
} from './builder';

/**
 * Which block vocabulary an eval run is given — and the one honest limitation
 * in this package.
 *
 * ## The problem
 *
 * A plan-quality eval is only worth running against the catalog the product
 * actually ships: the marketing pack, whose `pricing`, `faq`, `testimonials`
 * and `stats` blocks are what a real request is answered with. This package
 * cannot reach them.
 *
 * `@craftkit/builder/headless` deliberately exports NO block pack — every pack
 * depends on `@craftkit/builder-renderer`, which reads DOM globals, so a single
 * re-export would break every Node host's typecheck (`headless.node.test.ts`
 * enforces exactly that). The door offers `headlessBlockManifest(...)` instead,
 * so a host registers schemas of its own. But building a schema needs `zod`,
 * and `apps/evals` does not depend on zod — nor should it start hand-writing a
 * mirror of eighteen production schemas that would drift the week after it was
 * written.
 *
 * ## What would fix it
 *
 * One schema-only export from the marketing pack, re-exported by the headless
 * door. Those `components/*\/schema.ts` modules import zod and
 * `@craftkit/builder-schema` and nothing else — exactly like the preset's own
 * `pageSchema`, which the headless door already exports for that very reason —
 * so a `marketingBlockSchemas` barrel is browser-free by construction. When it
 * exists, `catalogFor('production')` becomes one line and the corpus starts
 * measuring the real thing.
 *
 * ## What runs today
 *
 * `kernel-fixtures` — the kernel's own six-block test vocabulary, reached
 * through the preset's testing door. It is real registered vocabulary with real
 * slots and real prop schemas, so every part of the harness (context assembly,
 * the provider, validation, the graders) exercises production code paths. It is
 * NOT the production catalog, so the corpus's block-type expectations mostly
 * miss and the coverage metric reads near its floor. That number is a statement
 * about this catalog, not about the assistant, and the README says so.
 */
export type EvalCatalogName = 'kernel-fixtures' | 'page-root-only';

export const DEFAULT_EVAL_CATALOG: EvalCatalogName = 'kernel-fixtures';

export function resolveEvalCatalog(
  env: Record<string, string | undefined> = process.env,
): EvalCatalogName {
  return env['CRAFTKIT_EVAL_CATALOG'] === 'page-root-only'
    ? 'page-root-only'
    : DEFAULT_EVAL_CATALOG;
}

/**
 * The manifests a run registers.
 *
 * Exactly one of them may contribute a `page`, because two manifests declaring
 * the same block type is a registry conflict rather than a merge — which is
 * also why the production catalog cannot simply be added alongside the fixture
 * one.
 */
export function catalogFor(name: EvalCatalogName): TrustedExtensionManifest[] {
  /*
    `page-root-only` registers the REAL page root — the same schema the browser
    build registers, slot allow-list and all. Nothing can be inserted into it
    because no section type is registered, so it exists as the honest baseline:
    it is what a headless host gets today, and running the corpus against it
    shows exactly what the missing schema door costs.
  */
  return name === 'page-root-only' ? [craftkitHeadlessBlocks] : [fixtureBlocks];
}

/**
 * Preference order for the starter fixture's two sections, resolved against
 * whatever the catalog actually registered.
 *
 * Hard-coding `hero` and `features` would make the fixture silently empty under
 * a catalog that has neither, and an eval whose "existing page" is empty stops
 * testing edits at all — while still passing, because an empty page is a valid
 * page. Resolving against the live registry means the fixture is either built
 * or loudly absent.
 */
export const STARTER_SECTION_PREFERENCES: readonly (readonly string[])[] = [
  ['hero'],
  ['features', 'content-section', 'section'],
];
