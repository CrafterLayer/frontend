import { SECTION_VARIANTS } from '../skills/section-variants';
import { SECTION_KITS } from './kits';
import { SECTION_KIT_ROLES, type SectionKit, type SectionKitRole, type SectionKitSlot } from './types';

/**
 * The kit index: the ONLY kit text the page planner and the section writers
 * see (DESIGN §B), one line per kit — id, summary, the slots it takes —
 * grouped under its role. It replaces craftkit.section-variants for
 * kit-backed sections, whose 2,800-token recipes could not grow.
 *
 * Budget: at most `KIT_INDEX_MAX_CHARS` for every kit together. To stay
 * inside it the heading slots every section shares (title, eyebrow?, lead?)
 * are said once, in the preamble, instead of on each line.
 */

export const KIT_INDEX_MAX_CHARS = 2_400;

const HEAD = ['title', 'eyebrow', 'lead'];

function slotText(name: string, slot: SectionKitSlot): string {
  const optional = slot.required === true ? '' : '?';
  if (slot.kind === 'list') {
    const fields = Object.entries(slot.item ?? {})
      .map(([field, inner]) => slotText(field, inner))
      .join(',');
    return `${name}${optional}[${fields}]`;
  }
  return `${name}${optional}`;
}

/** Whether a kit takes the shared heading slots exactly (title required, eyebrow and lead optional). */
function hasSharedHead(kit: SectionKit): boolean {
  return (
    kit.slots['title']?.required === true &&
    kit.slots['eyebrow'] !== undefined &&
    kit.slots['lead'] !== undefined
  );
}

function kitSlots(kit: SectionKit): string {
  const shared = hasSharedHead(kit);
  return Object.entries(kit.slots)
    .filter(([name]) => !(shared && HEAD.includes(name)))
    .map(([name, slot]) => slotText(name, slot))
    .join(' ');
}

/** `^` stands for the line above's slots, so kits that share a shape pay for it once. */
function kitLines(kits: readonly SectionKit[]): string[] {
  let previous = '';
  return kits.map((kit) => {
    const slots = kitSlots(kit);
    const shown =
      previous !== '' && slots === previous
        ? '^'
        : previous !== '' && slots.startsWith(`${previous} `)
          ? `^ ${slots.slice(previous.length + 1)}`
          : slots;
    previous = slots;
    return `${kit.id}${hasSharedHead(kit) ? '' : '='} ${kit.summary}: ${shown}`;
  });
}

const PREAMBLE =
  'KITS id summary: slots. All take title eyebrow? lead? unless id=. ?=optional x[a,b]=list ^=as line above image={src,alt}|{subject,alt} link={label,href} icon=Lucide';

/** One line per kit (optionally only some roles), under its role, within KIT_INDEX_MAX_CHARS for all kits. */
export function kitIndex(roles?: readonly SectionKitRole[]): string {
  const wanted = new Set<SectionKitRole>(roles ?? SECTION_KIT_ROLES);
  const groups = SECTION_KIT_ROLES.filter((role) => wanted.has(role)).flatMap((role) => {
    const kits = SECTION_KITS.filter((kit) => kit.role === role);
    return kits.length === 0 ? [] : [role.toUpperCase(), ...kitLines(kits)];
  });
  return [PREAMBLE, ...groups].join('\n');
}

const BY_ID: ReadonlyMap<string, SectionKit> = new Map(SECTION_KITS.map((kit) => [kit.id, kit]));

/** A kit by id, or undefined. */
export function sectionKit(id: string): SectionKit | undefined {
  return BY_ID.get(id);
}

const BY_VARIANT: ReadonlyMap<string, SectionKit> = new Map(
  SECTION_KITS.flatMap((kit) => (kit.variant === undefined ? [] : [[kit.variant, kit] as const])),
);

/** The default kit that realises a SECTION_VARIANTS id, or undefined for an unknown id. */
export function defaultKitForVariant(variantId: string): SectionKit | undefined {
  return BY_VARIANT.get(variantId);
}

/** The SECTION_VARIANTS ids, for callers that check coverage. */
export const SECTION_VARIANT_IDS: readonly string[] = Object.freeze(
  SECTION_VARIANTS.map(({ id }) => id),
);
