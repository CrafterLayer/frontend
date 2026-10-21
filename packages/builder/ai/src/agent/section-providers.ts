import { withReportDesign } from './report-design-context';
import type { AiContextProvider } from '@craftkit/builder-schema';

import {
  createPhotoCatalogContextProvider,
  PHOTO_CATALOG_PROVIDER_ID,
} from '../context/providers/photo-catalog';
import {
  CREATIVE_BRIEF_PROVIDER_ID,
  createCreativeBriefContextProvider,
} from '../creative/context-providers';
import { readCreativeMemory, type CreativeMemoryV1 } from '../creative/creative-memory';
import { createStoryArcContextProvider, STORY_ARC_PROVIDER_ID } from '../creative/story-arc';
import { pixiSkillIdsFor } from '../skills/creative/pixi-selection';
import {
  BUILD_LESSONS_PROVIDER_ID,
  buildLessonsOf,
  createBuildLessonsProvider,
  repairedCheck,
} from './build-lessons';
import type { PagePlan, SectionContract } from './page-plan/types';
import type { RunAiBuildOptions } from './types';

/*
  What a section writer is handed as DATA besides its request (split from
  run-build.ts, creative-power Phase 1 B, 2026-10-12): the photo catalog
  briefed for that section, and — for a scene — the creative brief.
  `sectionProviders` is the ONE place a page-plan section's fragments are
  assembled; a new fragment for scene writers (a richer brief, a story bible)
  goes there and nowhere else. The one fragment that is decided as the writer STARTS — the
  build's lessons so far (build-lessons.ts) — is added by `withBuildLessons`, at that moment.
*/

/**
 * The photo catalog for one step, briefed for THAT step: a section writer's
 * brief is the request and its own title, so a café's gallery is offered
 * cups and a menu band is not offered the hero's photo.
 *
 * Wave 1 (2026-09-28) put `craftkit.photo-direction` into every section writer
 * — "an image address comes only from PHOTOS YOU MAY USE" — and nothing sent
 * the list: the verifier found no caller of the provider in the tree, so split
 * builds lost their photos. A host's own photo provider on the build is
 * replaced by the step's (a page-wide brief is the wrong one for a section);
 * one the host registered on the kernel, or passed through the legacy
 * `contextProviders` alias, cannot be replaced, so it is left to serve alone —
 * two providers with one id are refused by the assembler.
 */
export function withPhotoCatalog(
  options: RunAiBuildOptions,
  brief: string,
): readonly AiContextProvider[] {
  const additional = options.additionalContextProviders ?? [];
  const fixed = [
    ...(options.contextProviders ?? []),
    ...options.kernel.context.registry.aiContextProviders(),
  ];
  if (fixed.some(({ id }) => id === PHOTO_CATALOG_PROVIDER_ID)) return additional;
  return Object.freeze([
    ...additional.filter(({ id }) => id !== PHOTO_CATALOG_PROVIDER_ID),
    createPhotoCatalogContextProvider({ brief }),
  ]);
}

/**
 * The words a section's creative expertise is matched on. A scene's own
 * contract carries its expertise; the lead scene may also use the original
 * creative brief, while ordinary supporting bands never inherit it just from
 * page-level words.
 */
export function creativeRequestOf(
  options: Pick<RunAiBuildOptions, 'request'>,
  contract: SectionContract,
): string {
  return [
    contract.title,
    contract.purpose,
    ...(contract.role === 'hero' ? [options.request] : []),
  ].join(' ');
}

/**
 * Whether a section's writer writes a scene — page code in its region's `js`:
 * free code is on and a creative playbook fits its contract. Decided before
 * the write, so the build can start the slowest writers first and give them
 * the longer deadline.
 */
export function writesScene(options: RunAiBuildOptions, contract: SectionContract): boolean {
  return (
    options.freeCode === true &&
    pixiSkillIdsFor(options.skillRegistry, creativeRequestOf(options, contract)).length > 0
  );
}

/** The host's story bible, read; undefined without one, or when it fails to load. */
export function hostCreativeMemory(
  options: Pick<RunAiBuildOptions, 'creativeMemory'>,
): CreativeMemoryV1 | undefined {
  try {
    return options.creativeMemory === undefined
      ? undefined
      : readCreativeMemory(options.creativeMemory()).memory;
  } catch {
    // A host memory that fails to load never blocks a build; the brief plans without it.
    return undefined;
  }
}

/**
 * A creative scene writer also gets the planner's brief (creative agent, 2026-10-12): genre,
 * literal libraries, beats, effects, rig states and the cast — the cast read from the host's
 * story bible when it has one. Deterministic and free (no model call); ordinary writers and
 * builds without free code are unchanged. A host that already serves a brief keeps its own.
 */
function withCreativeBrief(
  providers: readonly AiContextProvider[],
  creativeRequest: string,
  lang: string,
  options: RunAiBuildOptions,
): readonly AiContextProvider[] {
  if (providers.some(({ id }) => id === CREATIVE_BRIEF_PROVIDER_ID)) return providers;
  const memory = hostCreativeMemory(options);
  return Object.freeze([
    ...providers,
    createCreativeBriefContextProvider(creativeRequest, {
      lang,
      // The page's cast, setting and libraries reach every scene, not only the hero's.
      page: options.request,
      ...(memory === undefined ? {} : { memory }),
    }),
  ]);
}

/**
 * THE SEAM: every data fragment a page-plan section's writer is handed, as
 * context providers. The catalog is where the contract's subjects come from
 * (the person's own photos need none); a scene adds its creative brief.
 */
export function sectionProviders(
  options: RunAiBuildOptions,
  plan: PagePlan,
  contract: SectionContract,
): readonly AiContextProvider[] {
  const images = contract.images ?? [];
  const photos =
    images.length > 0
      ? withPhotoCatalog(
          options,
          [contract.title, ...images.flatMap(({ subject, alt }) => [subject, alt])].join(' '),
        )
      : (options.additionalContextProviders ?? []).filter(
          ({ id }) => id !== PHOTO_CATALOG_PROVIDER_ID,
        );
  const computed = withReportDesign(
    options.request,
    {
      additionalContextProviders: photos,
    },
    plan.locale.lang,
  ).additionalContextProviders;

  if (!writesScene(options, contract)) return computed;
  const briefed = withCreativeBrief(
    computed,
    creativeRequestOf(options, contract),
    plan.locale.lang,
    options,
  );
  // T231c (2026-10-12): a page of several scenes is one arc; each writer sees the others.
  const scenes = plan.sections.filter((section) => writesScene(options, section));
  if (scenes.length < 2 || briefed.some(({ id }) => id === STORY_ARC_PROVIDER_ID)) return briefed;
  return Object.freeze([...briefed, createStoryArcContextProvider(scenes, contract.key)]);
}

/**
 * A writer's providers as it STARTS (build lessons, 2026-10-13): its briefing's, plus — once
 * this build has learned any — the lessons so far, fixed at that moment. A writer that started
 * before a lesson was learned never sees it; one with no lessons to learn from is unchanged.
 */
export function withBuildLessons(
  options: Pick<RunAiBuildOptions, 'runId'>,
  providers: readonly AiContextProvider[],
): readonly AiContextProvider[] {
  const lessons = buildLessonsOf(options);
  if (lessons.length === 0 || providers.some(({ id }) => id === BUILD_LESSONS_PROVIDER_ID)) {
    return providers;
  }
  return Object.freeze([...providers, createBuildLessonsProvider(lessons)]);
}

/** What one build's writers learn from each other: handed out as they start, learned as repairs land. */
export const buildLessons = Object.freeze({ offered: withBuildLessons, learned: repairedCheck });
