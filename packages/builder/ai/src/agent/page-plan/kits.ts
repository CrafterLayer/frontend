import {
  defaultKitForVariant,
  instantiateKit,
  kitIndex,
  SECTION_KITS,
  sectionKit,
  type SectionKit,
  type SectionKitRole,
} from '../../section-kit';
import type { PagePlanLocale, SectionContract, SectionRole } from './types';

/*
  The section kit as a page plan sees it (DESIGN §B + D.1, 2026-09-30): which
  kits fit which section role, how a variant resolves to its default kit, and
  whether a planner's slots instantiate. One adapter, so the validator, the
  skeleton, the build and the planner read the kit the same way.
*/

/**
 * The kit roles a plan's section role may take. The header and the footer
 * are written by code from the plan (`skeletonFromPlan`), so no kit is named
 * for them; a closing call to action is a `closing` kit; a band is any
 * content kit.
 */
export const KIT_ROLES_FOR_SECTION: Readonly<Record<SectionRole, readonly SectionKitRole[]>> =
  Object.freeze({
    header: Object.freeze([]),
    hero: Object.freeze(['hero'] as const),
    band: Object.freeze(['features', 'proof', 'offer', 'media', 'closing'] as const),
    cta: Object.freeze(['closing'] as const),
    footer: Object.freeze([]),
  });

/** Whether a kit fits a section of this role. */
export function kitFitsRole(kit: SectionKit, role: SectionRole): boolean {
  return KIT_ROLES_FOR_SECTION[role].includes(kit.role);
}

/** The kit with this id, when it exists. Never throws. */
export function planKit(id: string | undefined): SectionKit | undefined {
  if (id === undefined) return undefined;
  try {
    return sectionKit(id);
  } catch {
    return undefined;
  }
}

/** The default kit of a section-variants id, when it fits the role. */
export function defaultPlanKit(
  variant: string | undefined,
  role: SectionRole,
): SectionKit | undefined {
  if (variant === undefined) return undefined;
  let kit: SectionKit | undefined;
  try {
    kit = defaultKitForVariant(variant);
  } catch {
    return undefined;
  }
  return kit !== undefined && kitFitsRole(kit, role) ? kit : undefined;
}

/** The kit ids a section of this role may name, for a repair message. */
export function kitIdsForRole(role: SectionRole): readonly string[] {
  return SECTION_KITS.filter((kit) => kitFitsRole(kit, role)).map(({ id }) => id);
}

/** The kit roles a writer is shown for its section: its kit's own role. */
export function writerKitRoles(contract: SectionContract): readonly SectionKitRole[] {
  const kit = planKit(contract.kit);
  return kit === undefined ? KIT_ROLES_FOR_SECTION[contract.role] : [kit.role];
}

/** The kit index lines a writer or planner reads ('' when the kit has none). */
export function planKitIndex(roles?: readonly SectionKitRole[]): string {
  try {
    return roles === undefined ? kitIndex() : kitIndex(roles);
  } catch {
    return '';
  }
}

/** A section's filled kit, as the region's props: the tree, the css, the label. */
export interface PlannedKitRegion {
  readonly tree: unknown;
  readonly css: string;
}

/**
 * The kit filled with a contract's slots, for the region `anchorId`, or the
 * reason it cannot be. The hero's heading is the page's one h1.
 */
export function instantiatePlanKit(
  kit: SectionKit,
  slots: unknown,
  contract: Pick<SectionContract, 'anchorId' | 'role'>,
  locale: PagePlanLocale,
): { readonly ok: true; readonly region: PlannedKitRegion } | { readonly ok: false; readonly error: string } {
  try {
    const result = instantiateKit(kit, slots, {
      id: contract.anchorId,
      heading: contract.role === 'hero' ? 'h1' : 'h2',
      locale: { lang: locale.lang, dir: locale.dir },
    });
    return result.ok
      ? { ok: true, region: { tree: result.tree, css: result.css } }
      : { ok: false, error: result.error };
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : String(cause) };
  }
}
