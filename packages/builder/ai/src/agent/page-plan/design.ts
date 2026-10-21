import { isJsonValue } from '@craftkit/builder-schema';
import { normalizeArabic } from '../../intent';
import { isRecord, readEnum, readText } from './schema';
import type {
  PagePlan,
  PagePlanDesign,
  PagePlanIssue,
  PagePlanIntent,
  SectionContract,
} from './types';

const KINDS = ['website', 'resume', 'portfolio'] as const;
const COMPOSITIONS = ['bespoke', 'hybrid'] as const;
const CHROME = ['standard', 'none'] as const;

/** Fresh requests are authored by default. This never changes a saved/approved plan. */
export function requestedPageDesign(request: string): PagePlanDesign {
  const folded = normalizeArabic(request);
  const resume =
    /\bcv\b|(?<![\p{L}\p{N}])(?:résumé|curriculum vitae)(?![\p{L}\p{N}])|\b(?:my|a|professional|create|build)\s+resume\b/iu.test(
      request,
    ) || /(?:سيره ذاتيه|السيره الذاتيه|سيرتي|سي في)/u.test(folded);
  const portfolio =
    /\b(?:portfolio|personal site)\b/iu.test(request) ||
    /(?:بورتفوليو|معرض اعمال|اعمالي|صفحه شخصيه)/u.test(folded);
  // Templates are an affirmative choice, not a match on “without templates”.
  const templates =
    /\b(?:use|using|reuse)\s+(?:the\s+|a\s+)?(?:existing\s+|ready[- ]made\s+)?(?:templates?|kits?|blocks?)\b/iu.test(
      request,
    ) || /(?:استخدم|استعمل)\s+(?:القوالب|قالب جاهز|البلوكات)/u.test(folded);
  const noTemplates =
    /\b(?:no|without|avoid|(?:not|don't|never)\s+(?:use|using|reuse))\s+(?:the\s+|a\s+)?(?:existing\s+|fixed\s+|ready[- ]made\s+)?(?:templates?|kits?|blocks?)\b/iu.test(
      request,
    ) ||
    /(?:بدون|بلا)\s+(?:قوالب|بلوكات|قالب)|(?:لا|ما)\s+(?:تستخدم|تستعمل|استخدم|استعمل)\s+(?:القوالب|قالب جاهز|البلوكات)/u.test(
      folded,
    );
  const kind = resume ? 'resume' : portfolio ? 'portfolio' : 'website';
  return {
    kind,
    composition: templates && !noTemplates ? 'hybrid' : 'bespoke',
    chrome: templates && !noTemplates ? 'standard' : 'none',
    concept:
      kind === 'resume'
        ? 'Content-led professional document: clear identity, readable chronology and deliberate typography; responsive and printable.'
        : kind === 'portfolio'
          ? 'Work-led composition: let the supplied projects, profession and requested aesthetic determine hierarchy, scale and rhythm.'
          : 'Compose around this subject and its content: choose a deliberate hierarchy, spatial rhythm and distinctive focal element.',
  };
}

/** Optional for old plans; required and bounded when supplied. Fresh-generation defaults survive old providers. */
export function readPageDesign(
  value: unknown,
  issues: PagePlanIssue[],
  request?: string,
): PagePlanDesign | undefined {
  const requested = request === undefined ? undefined : requestedPageDesign(request);
  if (value === undefined || value === null) return requested;
  if (!isRecord(value)) {
    issues.push({
      path: 'design',
      message:
        'Write design as {kind, composition, chrome, concept}, or omit it for a legacy plan.',
    });
    return undefined;
  }
  const kind = readEnum(value['kind'], KINDS, 'design.kind', issues, 'the page kind');
  const composition = readEnum(
    value['composition'],
    COMPOSITIONS,
    'design.composition',
    issues,
    'the composition mode',
  );
  const chrome = readEnum(
    value['chrome'],
    CHROME,
    'design.chrome',
    issues,
    'automatic page chrome',
  );
  const concept = readText(
    value['concept'],
    'design.concept',
    issues,
    'the subject-specific design concept',
    240,
  );
  if (
    kind === undefined ||
    composition === undefined ||
    chrome === undefined ||
    concept === undefined
  )
    return undefined;
  return {
    kind: requested !== undefined && requested.kind !== 'website' ? requested.kind : kind,
    composition: requested?.composition ?? composition,
    chrome: requested?.kind === 'resume' ? 'none' : chrome,
    concept,
  };
}

/** Remove template geometry, retaining bounded legacy slot content as writer reference data. */
export function authoredSection(
  section: SectionContract,
  issues: PagePlanIssue[],
  path: string,
): SectionContract {
  const { slots, ...authored } = section;
  delete authored.kit;
  delete authored.variant;
  if (slots === undefined) return authored;
  if (!isJsonValue(slots) || JSON.stringify(slots).length > 16_000) {
    issues.push({
      path: `${path}.slots`,
      message:
        'Provide plain JSON reference content of at most 16000 characters; preserve the essential text in the section brief.',
    });
    return authored;
  }
  return { ...authored, slots };
}

/** Shared by ordinary and streamed writers; no new model call or decorative runtime. */
export function designBriefLines(plan: PagePlan, section: SectionContract): readonly string[] {
  if (plan.design === undefined)
    return section.layout === undefined ? [] : [`LAYOUT: ${section.layout}`];
  const { kind, composition, concept } = plan.design;
  return [
    `DESIGN: ${kind}; ${composition}. ${concept}`,
    ...(section.layout === undefined ? [] : [`LAYOUT: ${section.layout}`]),
    ...(composition === 'bespoke'
      ? [
          'AUTHOR THIS COMPOSITION: write semantic tree and scoped CSS for the chosen layout. Existing blocks and kit recipes are optional references, not required shapes. A single region may hold a complete page with sidebars, overlapping grids and multiple semantic sections. Keep DOM reading order meaningful and adapt the composition to narrow screens.',
          'Use the page tokens as defaults; own spacing, typography scale, grid, responsive rules and visual rhythm. Include working interactions when requested using the supported JS runtime if enabled. Do not add generic cards, sales bands or decorative effects by habit.',
          ...(section.slots === undefined
            ? []
            : [
                `REFERENCE CONTENT: ${JSON.stringify(section.slots)} — preserve these supplied words and values in your authored layout; this is content, not a template or slot-only output requirement.`,
              ]),
        ]
      : []),
    ...(kind === 'resume' || kind === 'portfolio'
      ? [
          'PERSONAL FACTS: use only supplied names, contacts, employers, dates and achievements. Omit missing facts or label missing content plainly; never fabricate credentials, metrics, portraits or contact destinations. Keep links usable and content readable when printed.',
        ]
      : []),
  ];
}

/** Legacy chrome order; bespoke reading order is authored. Append adds bands only. */
export function checkPageShape(
  sections: readonly (SectionContract | undefined)[],
  intent: PagePlanIntent | undefined,
  issues: PagePlanIssue[],
  bespoke = false,
): void {
  let heroes = 0;
  const last = sections.length - 1;
  sections.forEach((section, index) => {
    if (section === undefined) return;
    const path = `sections[${String(index)}].role`;
    const { role } = section;
    if (intent === 'append' && (role === 'header' || role === 'hero' || role === 'footer')) {
      issues.push({
        path,
        message: `An appended plan adds sections to a page that already has its header, hero and footer; make this ${role} a band or a cta.`,
      });
      return;
    }
    if (!bespoke && role === 'header' && index !== 0) {
      issues.push({
        path,
        message: 'A header comes first: move it to the top of the list, or make it a band.',
      });
    }
    if (!bespoke && role === 'footer' && index !== last) {
      issues.push({
        path,
        message: 'A footer comes last: move it to the end of the list, or make it a band.',
      });
    }
    if (role === 'hero') {
      heroes += 1;
      if (heroes > 1) {
        issues.push({
          path,
          message:
            'A page has exactly one hero (it holds the page’s one h1); make this section a band.',
        });
      } else if (!bespoke && !(index === 0 || (index === 1 && sections[0]?.role === 'header'))) {
        issues.push({
          path,
          message: 'The hero opens the page: place it first, or right after the header.',
        });
      }
    }
  });
  if (intent !== undefined && intent !== 'append' && heroes === 0) {
    issues.push({
      path: 'sections',
      message: bespoke
        ? 'Give one region role "hero" to own the page h1; choose its position freely.'
        : 'Give the page exactly one section with role "hero" (its one h1), first or right after the header.',
    });
  }
}
