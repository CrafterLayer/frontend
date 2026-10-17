import { StageRejectedError } from './errors';
import { isRecord, stageArray } from './shape';
import type { ContentResponse, ContentSection, StructureSection } from '../wire';

/**
 * Copy nobody meant to ship, refused at the stage rather than at the page.
 *
 * Shares its intent with the DOM-free quality check and deliberately not its
 * code: this one runs on a WIRE response before a document exists, and the
 * other runs on a document. What they must share is the vocabulary, which is
 * why the same Arabic fillers are here — the default locale is Arabic and a
 * check that only knew English would pass the exact page it exists to catch.
 */
const FILLER = [
  /lorem\s+ipsum/iu,
  /\bdolor\s+sit\s+amet\b/iu,
  /\blipsum\b/iu,
  /\bplaceholder\b/iu,
  /\bTODO\b/u,
  /\bTBD\b/u,
  /\byour\s+(?:text|content|headline|copy)\s+here\b/iu,
  /\bsection\s+title\b/iu,
  /\blorem\b/iu,
  /نصّ?\s+تجريبي/u,
  /هنا\s+نصّ?ك/u,
  /عنوان\s+القسم/u,
];

/** Every string anywhere in a props object, however deep. */
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const entry of value) strings(entry, out);
    return out;
  }
  if (typeof value === 'object' && value !== null) {
    for (const entry of Object.values(value)) strings(entry, out);
  }
  return out;
}

/**
 * What the content stage must produce for one page.
 *
 * ## Why filler is a REFUSAL and not a warning here
 *
 * Because it is caught before anything is written. On a finished page,
 * placeholder copy warns: the page works, and refusing it would block a commit
 * over something cosmetic. At this stage nothing is committed yet and asking
 * again costs one call — so the cheap moment to insist is now, and the whole
 * reason the pipeline is staged is to have cheap moments like this one.
 */
const isSectionEntry = (value: unknown): value is ContentSection =>
  isRecord(value) && typeof value['sectionId'] === 'string' && isRecord(value['props']);

export function validateContent(
  response: ContentResponse,
  sections: readonly StructureSection[],
): readonly ContentSection[] {
  const reasons: string[] = [];
  const expected = new Set(sections.map((section) => section.id));
  const covered = new Set<string>();
  const validated: ContentSection[] = [];

  const written = stageArray(
    'content',
    response,
    'sections',
    'A content answer must carry a list of sections.',
  );

  for (const [index, section] of written.entries()) {
    if (!isSectionEntry(section)) {
      reasons.push(`Entry ${String(index + 1)} does not say which section it is for.`);
      continue;
    }
    if (!expected.has(section.sectionId)) {
      reasons.push(`It wrote content for "${section.sectionId}", which is not a section here.`);
      continue;
    }
    if (covered.has(section.sectionId)) {
      reasons.push(`It wrote "${section.sectionId}" twice.`);
    }
    covered.add(section.sectionId);
    validated.push(section);

    const text = strings(section.props);
    if (text.every((entry) => entry.trim() === '')) {
      reasons.push(`The section "${section.sectionId}" has no words in it.`);
    }
    for (const entry of text) {
      const filler = FILLER.find((pattern) => pattern.test(entry));
      if (filler === undefined) continue;
      reasons.push(
        `The section "${section.sectionId}" still reads as placeholder copy: "${entry.trim().slice(0, 48)}".`,
      );
      break;
    }
  }

  for (const section of sections) {
    if (covered.has(section.id)) continue;
    reasons.push(`It wrote nothing for the section "${section.id}".`);
  }

  if (reasons.length > 0) throw new StageRejectedError('content', reasons);
  return validated;
}
