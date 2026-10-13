import type { BuilderKernel } from '@craftkit/builder-core';

import { isTreeMarkup, parseTreeMarkup } from '../../plan/tree-markup';
import { isRecord, rootChildren } from './shared';

/*
  The zero-token reading of the page's rhythm (2026-10-13, ready scripts):
  «زوّد المسافات بين الأقسام», «قلّل المسافات بين الأقسام», "more space between
  the sections", "tighten the spacing between sections" — the WHOLE request,
  folded (direct-tool.ts) — becomes one `section.ops {op:'space'}` step per
  band, with no model. The header and footer keep their bars.
*/

export interface SectionSpaceReading {
  readonly calls: readonly { readonly name: string; readonly input: Record<string, unknown> }[];
  readonly label: { readonly ar: string; readonly en: string };
}

const SECTIONS_AR = '(?:ال)?(?:اقسام|سكشنات|اجزاء)';
const GAPS_AR = '(?:ال)?(?:مسافات|مسافه|فراغات|فراغ)';
const MORE_AR = new RegExp(
  `^(?:(?:زيد|زود|كبر|وسع)\\s+${GAPS_AR}|${GAPS_AR}\\s+(?:اكبر|اوسع))\\s+بين\\s+${SECTIONS_AR}$|^(?:خلي|اجعل)\\s+${GAPS_AR}\\s+بين\\s+${SECTIONS_AR}\\s+(?:اكبر|اوسع)$`,
  'u',
);
const LESS_AR = new RegExp(
  `^(?:(?:قلل|صغر|ضيق|خفف|نقص)\\s+${GAPS_AR}|${GAPS_AR}\\s+(?:اقل|اصغر|اضيق))\\s+بين\\s+${SECTIONS_AR}$|^(?:خلي|اجعل)\\s+${GAPS_AR}\\s+بين\\s+${SECTIONS_AR}\\s+(?:اقل|اصغر|اضيق)$`,
  'u',
);
const SPACE_EN = '(?:space|spacing|room|breathing room|padding|whitespace|white space)';
const BETWEEN_EN = '(?:between|around)\\s+(?:the\\s+|all\\s+(?:the\\s+)?)?sections';
const MORE_EN = new RegExp(
  `^(?:(?:add|give|put)\\s+)?more\\s+${SPACE_EN}\\s+${BETWEEN_EN}$|^(?:increase|loosen|open up)\\s+(?:the\\s+)?${SPACE_EN}\\s+${BETWEEN_EN}$`,
  'u',
);
const LESS_EN = new RegExp(
  `^(?:(?:use|leave)\\s+)?less\\s+${SPACE_EN}\\s+${BETWEEN_EN}$|^(?:reduce|decrease|tighten|shrink)\\s+(?:the\\s+)?${SPACE_EN}\\s+${BETWEEN_EN}$`,
  'u',
);
/** A band's bar: the header and footer keep their own padding. */
const BARS = new Set(['header', 'footer', 'nav']);

/** The page's bands: composed root sections whose outer element is not a header, footer or nav. */
function bands(kernel: BuilderKernel): readonly string[] {
  const document = kernel.getDocument();
  return rootChildren(kernel).filter((id) => {
    const node = document.nodes[id];
    if (node?.type !== 'customCode') return false;
    const value = node.props['tree'];
    const tree: unknown = isTreeMarkup(value) ? parseTreeMarkup(value) : value;
    const children =
      isRecord(tree) && Array.isArray(tree['children']) ? (tree['children'] as unknown[]) : [];
    const outer = children.find((child) => isRecord(child) && child['kind'] === 'element');
    return (
      isRecord(outer) && typeof outer['tag'] === 'string' && !BARS.has(outer['tag'].toLowerCase())
    );
  });
}

/** The request (folded by `normalizeIntentText`) as one space step per band, or undefined. */
export function readSectionSpace(
  text: string,
  kernel: BuilderKernel,
): SectionSpaceReading | undefined {
  const more = MORE_AR.test(text) || MORE_EN.test(text);
  const less = !more && (LESS_AR.test(text) || LESS_EN.test(text));
  if (!more && !less) return undefined;
  const ids = bands(kernel);
  if (ids.length === 0) return undefined;
  return {
    calls: ids.map((id) => ({
      name: 'section.ops',
      input: { op: 'space', id, step: more ? 1 : -1 },
    })),
    label: more
      ? { ar: 'مسافات أكبر بين الأقسام', en: 'More space between the sections' }
      : { ar: 'مسافات أقل بين الأقسام', en: 'Less space between the sections' },
  };
}
