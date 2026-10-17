/**
 * When a section writer is shown the EDIT SCRIPT card (agent-script DESIGN
 * §A.11, script-wiring).
 *
 * A kit-backed writer answers with ONE tool step. For a section whose content
 * is data — a 12-dish menu, a team of eight, a price matrix — that step can be
 * a `script.run` that builds the slots in a loop instead of spelling every
 * item out. The card costs ~250 tokens, so it is added only when the section
 * is bulk by its own words (`prefersScript`) or its kit has a list long
 * enough to pay for it; every other writer's brief is unchanged.
 */
import { SCRIPT_CARD } from '../script/api-card';
import { prefersScript } from '../script/script-intent';
import type { SectionKit } from '../section-kit/types';
import type { SectionContract } from './page-plan/types';

/** A list slot that may hold at least this many items makes a kit "bulk". */
export const SECTION_SCRIPT_LIST_MIN = 6;

/** Whether the kit has a list slot whose `max` is at least `SECTION_SCRIPT_LIST_MIN`. */
export function kitHasLongList(kit: SectionKit | undefined): boolean {
  if (kit === undefined) return false;
  return Object.values(kit.slots).some(
    (slot) => slot.kind === 'list' && (slot.max ?? 0) >= SECTION_SCRIPT_LIST_MIN,
  );
}

/** The section's own words, as a writer's brief states them: title, purpose and its must-say claims. */
export function sectionBriefWords(
  contract: Pick<SectionContract, 'title' | 'purpose' | 'mustSay'>,
): string {
  return [contract.title, contract.purpose, ...contract.mustSay].join(' · ');
}

/**
 * The lines a kit-backed writer's brief gets after the section lane's tool
 * list: a blank line and the card when the section is bulk, nothing otherwise.
 */
export function sectionScriptCard(
  contract: Pick<SectionContract, 'title' | 'purpose' | 'mustSay'>,
  kit: SectionKit | undefined,
): readonly string[] {
  return prefersScript(sectionBriefWords(contract)) || kitHasLongList(kit) ? ['', SCRIPT_CARD] : [];
}
