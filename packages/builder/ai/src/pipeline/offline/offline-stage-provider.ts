import { defaultDesignSystem, type JsonValue } from '@craftkit/builder-schema';

import { selectFrom } from '../../assets/select-assets';

import type { SiteStageProvider, StageOptions } from '../stage-provider';
import type {
  AssemblyRequest,
  AssemblyStep,
  ContentRequest,
  ContentResponse,
  DesignSystemResponse,
  RequestFor,
  ResponseFor,
  SiteStage,
  SitemapPage,
  StageRequest,
  StructurePage,
} from '../wire';

/**
 * The one block type whose whole job is a picture.
 *
 * Named here because the provider has no registry to ask. That is the same
 * bargain the file already makes with `'text'` as the fallback type and `root`
 * as a new page's root id: an offline provider knows the shapes it emits.
 */
const IMAGE_BLOCK = 'image';

/**
 * Five stages with no model, no network, and no clock.
 *
 * ## What it is for
 *
 * Every scenario in the spec must be runnable without a key. That is not a
 * convenience: it is what lets the pipeline's ORDERING, validation, atomicity
 * and cancellation be tested at all, because those are properties of the
 * orchestrator and a real model would make each test a coin toss.
 *
 * It is also the CI half of the quality gate's supply: `GeneratedSites` renders
 * pages that came from here, at fixed seeds, so the same story renders the same
 * bytes on every run.
 *
 * ## What it is NOT
 *
 * Not a fallback for a missing server, and it must never quietly become one. Its
 * pages are derived from the brief by rule — a slug, a title, a sentence — and a
 * person shown one of them would be shown a template pretending to be a design.
 * A host with no provider should say so.
 */

/** Deterministic small integer from a string. Same input, same site, forever. */
function hash(text: string): number {
  let value = 0;
  for (const character of text) {
    value = (value * 31 + (character.codePointAt(0) ?? 0)) % 1_000_003;
  }
  return value;
}

const slug = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 40) || 'page';

/** The page shapes a brief is decomposed into, in reading order. */
const PAGE_PLAN: readonly { readonly title: string; readonly purpose: string }[] = [
  { title: 'Home', purpose: 'Say what this is and who it is for, and invite one action.' },
  { title: 'Work', purpose: 'Show what has been made, with enough detail to judge it.' },
  { title: 'Pricing', purpose: 'State what it costs and what is included, with no surprises.' },
  { title: 'Contact', purpose: 'Give one way to get in touch and say what happens next.' },
];

const SECTION_PLAN: readonly { readonly id: string; readonly intent: string }[] = [
  { id: 'intro', intent: 'The opening claim, in one sentence a stranger understands.' },
  { id: 'detail', intent: 'The evidence for that claim, concretely.' },
  { id: 'action', intent: 'The one thing to do next.' },
];

function sitemapFor(brief: string, maxPages: number): readonly SitemapPage[] {
  /*
    The COUNT is derived from the brief so two different briefs produce
    different sites, and the same brief always produces the same one. A fixed
    count would make every offline site identical, and a random one would make
    the CI stories flap.
  */
  const count = Math.min(maxPages, 2 + (hash(brief) % 3));
  return PAGE_PLAN.slice(0, count).map((page) => ({
    id: slug(page.title),
    title: page.title,
    purpose: page.purpose,
  }));
}

function structureFor(
  pages: readonly SitemapPage[],
  blockTypes: readonly string[],
  maxSections: number,
): readonly StructurePage[] {
  /*
    Types are taken from the list the request SENT, never invented — the offline
    provider is held to exactly the rule the structure validator enforces, so a
    test that exercises the happy path is not silently exercising a provider
    with different manners from a real one.
  */
  const usable = blockTypes.length === 0 ? ['text'] : blockTypes;
  return pages.map((page) => ({
    pageId: page.id,
    sections: SECTION_PLAN.slice(0, Math.min(maxSections, SECTION_PLAN.length)).map(
      (section, index) => ({
        id: section.id,
        type: usable[(hash(page.id) + index) % usable.length] ?? 'text',
        intent: section.intent,
      }),
    ),
  }));
}

/**
 * Copy that is about the BRIEF, not merely about the page.
 *
 * This is the file's own claim — "its pages are derived from the brief by rule"
 * — finally made true at the stage where it matters. It was not: every span was
 * built from the page title, the page purpose and the section intent, all three
 * of which come from a fixed plan, so an offline site about a ceramics studio
 * and one about a law firm shipped identical words. SC-005 asks that at least
 * 95% of spans carry terms from the brief, and this provider scored zero.
 *
 * A template naming the business is a FLOOR, not evidence about a model — it
 * proves the measure runs and that the pipeline can carry a brief end to end,
 * and nothing at all about whether a real design agent writes well.
 */
function contentFor(request: ContentRequest): ContentResponse {
  const subject = request.brief.trim();
  return {
    stage: 'content',
    pageId: request.page.id,
    sections: request.sections.map((section) => ({
      sectionId: section.id,
      /*
        Real sentences about the page, not filler — the content validator
        refuses filler, and a provider that produced it would fail its own
        pipeline on every run.
      */
      props: {
        heading: `${request.page.title} — ${subject}`,
        content: `${subject}. ${request.page.purpose} ${section.intent}`,
      } satisfies Record<string, JsonValue>,
    })),
  };
}

/**
 * A design system built FROM the default, not written by hand.
 *
 * The default is a complete, measured system — sixty-odd tokens, seven pairings
 * every one of which was checked against `contrastRatio`. A hand-written stub
 * would fail `validateDesignSystem` on its first run, which is exactly what
 * happened when this file tried: four tokens where the vocabulary declares
 * sixty-seven, and pairings naming roles that do not exist.
 *
 * So the offline provider varies what it can vary safely — the name, the seed —
 * and inherits everything the default already proved. It does NOT recolour the
 * accent: the default's pairings were measured against THESE values, and a
 * provider that swapped one in would be shipping a palette whose contrast
 * nobody checked. Choosing a palette that stays valid is the design stage's
 * real work, and it belongs to a model, not to a hash of the brief.
 */
function designSystemFor(brief: string): DesignSystemResponse {
  const base = defaultDesignSystem();
  return {
    stage: 'design-system',
    designSystem: {
      ...base,
      name: `Generated for ${slug(brief).replace(/-/gu, ' ')}`,
      seed: slug(brief),
    } as unknown as JsonValue,
  };
}

export interface OfflineStageProviderOptions {
  /** Commands the assembly stage may emit. Defaults to the site-building set. */
  readonly allowedCommands?: readonly string[];
}

const DEFAULT_ASSEMBLY_COMMANDS = ['addPage', 'insertNode', 'setProp', 'setDesignSystem'] as const;

export function createOfflineSiteStageProvider(
  options: OfflineStageProviderOptions = {},
): SiteStageProvider {
  const allowed = options.allowedCommands ?? DEFAULT_ASSEMBLY_COMMANDS;

  return {
    run<S extends SiteStage>(
      request: RequestFor<S>,
      stageOptions?: StageOptions,
    ): Promise<ResponseFor<S>> {
      /*
        Cancellation is honoured even though nothing here is slow. A provider
        that ignored the signal would make every cancellation test pass for the
        wrong reason — the orchestrator would look correct because the offline
        provider finished before the abort could matter.
      */
      if (stageOptions?.signal?.aborted === true) {
        return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
      }
      stageOptions?.onProgress?.(`offline: ${request.stage}`);

      /*
        Widened ONCE, here. `RequestFor<S>` is generic, so TypeScript cannot
        narrow it by its own `stage` discriminant inside this function — the
        union it stands for is not resolved until the call site. Taking the
        widened union back means the switch below narrows normally, and the one
        cast is in one place where it can be read.
      */
      const widened: StageRequest = request;

      switch (widened.stage) {
        case 'sitemap':
          return resolve<S>({
            stage: 'sitemap',
            pages: sitemapFor(widened.brief, widened.limits.maxPages),
            dir: widened.dir,
          });
        case 'structure':
          return resolve<S>({
            stage: 'structure',
            pages: structureFor(
              widened.pages,
              widened.blockTypes,
              widened.limits.maxSectionsPerPage,
            ),
          });
        case 'content':
          return resolve<S>(contentFor(widened));
        case 'design-system':
          return resolve<S>(designSystemFor(widened.brief));
        case 'assembly':
          return resolve<S>({
            stage: 'assembly',
            commands: assemblyFor(widened, allowed),
          });
        /* v8 ignore next 2 -- the union is exhausted above. */
        default:
          return Promise.reject(new Error('Unknown stage.'));
      }
    },
  };
}

/**
 * Commands the DOOR accepts — which is not the same as commands that look right.
 *
 * The first version of this function emitted `addPage` with `{ id, title }` and
 * `insertNode` with `parentId` set to a page id. Both were refused by the
 * kernel on sight: `addPage` takes an ADDRESS and mints its own id, and
 * `parentId` names a node inside a page's document, not the page. Nothing
 * noticed, because nothing had ever applied the output — the pipeline's central
 * claim, that the caller sends these through the same door a plan goes through,
 * had never once been exercised.
 *
 * ## Why no generated page claims "/"
 *
 * Every valid site already HAS a home page — `validateSite` requires exactly
 * one — so a generated page addressed "/" is refused as a duplicate. Which page
 * ends up being the home when a run adds a site's worth of pages beside an
 * existing one is a decision with a person's existing work on the other side of
 * it, and it belongs to the Keep / Start-over card, not to a provider.
 */
function assemblyFor(request: AssemblyRequest, allowed: readonly string[]): AssemblyStep[] {
  const commands: AssemblyStep[] = [];

  /*
    Pictures, chosen by the SAME scoring a host uses — not by this provider's
    own idea of a good match. `selectFrom` is the pure half of `selectAssets`,
    so the offline path and a library-backed one cannot disagree about which
    picture answers a brief.

    Every image position across the whole site is chosen in ONE pass, because
    the no-repeat rule is a property of the site: the same photograph appearing
    on the home page and the about page reads as a mistake, and choosing per
    page could not see it.
  */
  const positions = request.pages.flatMap((page) =>
    (request.structure.find((entry) => entry.pageId === page.id)?.sections ?? [])
      .filter((section) => section.type === IMAGE_BLOCK)
      .map((section) => ({ id: `${page.id}:${section.id}`, intent: section.intent })),
  );
  const pictures = new Map(
    selectFrom({ brief: request.brief, positions, entries: request.assets }).choices.map(
      (choice) => [choice.id, choice.image],
    ),
  );

  if (allowed.includes('setDesignSystem')) {
    commands.push({ command: 'setDesignSystem', args: { system: request.designSystem } });
  }

  for (const page of request.pages) {
    if (allowed.includes('addPage')) {
      commands.push({
        command: 'addPage',
        args: { address: `/${page.id}`, title: page.title, purpose: page.purpose },
        page: page.id,
      });
    }
    if (!allowed.includes('insertNode')) continue;

    const structure = request.structure.find((entry) => entry.pageId === page.id);
    const content = request.content.find((entry) => entry.pageId === page.id);
    for (const section of structure?.sections ?? []) {
      const props = content?.sections.find((entry) => entry.sectionId === section.id)?.props ?? {};
      const picture = pictures.get(`${page.id}:${section.id}`);
      commands.push({
        /*
          `root` is the id `emptyDocument` gives every new page's root, so a
          section can name its parent before the page exists. The PAGE is named
          by its sitemap id and resolved by the applier.
        */
        command: 'insertNode',
        args: {
          type: section.type,
          parentId: 'root',
          props: picture === undefined ? props : { ...props, asset: picture },
        },
        page: page.id,
      });
    }
  }
  return commands;
}

/** One place the response is widened, so every arm above stays readable. */
function resolve<S extends SiteStage>(response: unknown): Promise<ResponseFor<S>> {
  return Promise.resolve(response as ResponseFor<S>);
}
