import { StageRejectedError } from './errors';
import { isRecord, stageArray } from './shape';
import type {
  SitemapPage,
  StageLimits,
  StructurePage,
  StructureResponse,
  StructureSection,
} from '../wire';

const ID_SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/**
 * What the structure stage must produce.
 *
 * ## The vocabulary rule, and why it is not repairable
 *
 * A section naming a block type nobody registered is a STAGE FAILURE, never an
 * invention to be fixed downstream. The type list is sent with the request, so
 * a type outside it was not a near miss — it was made up. Repairing it would
 * mean either inventing a block (which the door would refuse) or silently
 * substituting a different one (which produces a page the person did not ask
 * for and cannot tell was substituted).
 *
 * It is also not worth ASKING again: the model was handed the list. So this one
 * reason is marked non-repairable, and the run falls back rather than spending
 * a second call to be told the same thing.
 */
const isPageEntry = (value: unknown): value is StructurePage =>
  isRecord(value) && typeof value['pageId'] === 'string' && Array.isArray(value['sections']);

const isSectionEntry = (value: unknown): value is StructureSection =>
  isRecord(value) &&
  typeof value['id'] === 'string' &&
  typeof value['type'] === 'string' &&
  typeof value['intent'] === 'string';

export function validateStructure(
  response: StructureResponse,
  pages: readonly SitemapPage[],
  blockTypes: readonly string[],
  limits: StageLimits,
): readonly StructurePage[] {
  const reasons: string[] = [];
  const known = new Set(blockTypes);
  const expected = new Set(pages.map((page) => page.id));
  const covered = new Set<string>();
  const validated: StructurePage[] = [];
  let invented = false;

  const answered = stageArray(
    'structure',
    response,
    'pages',
    'A structure answer must carry a list of pages.',
  );

  for (const [index, page] of answered.entries()) {
    /*
      Shape before content, per entry. One malformed page must not stop the
      others being reported: a person repairing an answer wants every reason at
      once, not one per round trip.
    */
    if (!isPageEntry(page)) {
      reasons.push(`Entry ${String(index + 1)} does not name a page and its sections.`);
      continue;
    }
    if (!expected.has(page.pageId)) {
      reasons.push(`It gave sections for "${page.pageId}", which is not a page in this site.`);
      continue;
    }
    covered.add(page.pageId);
    validated.push(page);

    if (page.sections.length === 0) {
      reasons.push(`The page "${page.pageId}" has no sections.`);
    }
    if (page.sections.length > limits.maxSectionsPerPage) {
      reasons.push(
        `The page "${page.pageId}" has ${String(page.sections.length)} sections; this run allows ${String(limits.maxSectionsPerPage)}.`,
      );
    }

    const seen = new Set<string>();
    for (const [at, section] of page.sections.entries()) {
      if (!isSectionEntry(section)) {
        reasons.push(
          `Section ${String(at + 1)} of "${page.pageId}" is missing its id, type or intent.`,
        );
        continue;
      }
      if (!ID_SHAPE.test(section.id)) {
        reasons.push(`"${section.id}" is not a usable section id.`);
      }
      if (seen.has(section.id)) {
        reasons.push(`The page "${page.pageId}" has two sections called "${section.id}".`);
      }
      seen.add(section.id);
      if (!known.has(section.type)) {
        invented = true;
        reasons.push(
          `"${section.type}" is not a block this build has; the request listed every type it may use.`,
        );
      }
      if (section.intent.trim() === '') {
        reasons.push(`The section "${section.id}" says nothing about what it is for.`);
      }
    }
  }

  for (const page of pages) {
    if (covered.has(page.id)) continue;
    reasons.push(`It gave no sections for the page "${page.id}".`);
  }

  if (reasons.length > 0) throw new StageRejectedError('structure', reasons, !invented);
  return validated;
}
