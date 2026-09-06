import { describe, expect, it } from 'vitest';

import { measureBriefRelevance } from '../../quality/brief-relevance';
import { generateSite } from '../generate-site';
import { createOfflineSiteStageProvider } from '../offline/offline-stage-provider';
import { StageRejectedError } from './errors';
import { validateContent } from './content';
import type { ContentResponse, StageLimits, StructureSection } from '../wire';

const SECTIONS: readonly StructureSection[] = [
  { id: 'intro', type: 'text', intent: 'Open.' },
  { id: 'detail', type: 'text', intent: 'Explain.' },
];

const answer = (sections: ContentResponse['sections']): ContentResponse => ({
  stage: 'content',
  pageId: 'home',
  sections,
});

const refusal = (response: unknown): readonly string[] => {
  try {
    validateContent(response as ContentResponse, SECTIONS);
  } catch (error: unknown) {
    if (error instanceof StageRejectedError) return error.reasons;
    throw error;
  }
  throw new Error('the content validator accepted an answer it should have refused');
};

describe('what the content stage must produce', () => {
  it('accepts one written section per section that was asked for', () => {
    const accepted = validateContent(
      answer([
        { sectionId: 'intro', props: { heading: 'A ceramics studio in Amman' } },
        { sectionId: 'detail', props: { body: 'We throw and fire everything here.' } },
      ]),
      SECTIONS,
    );
    expect(accepted).toHaveLength(2);
  });

  it('refuses a section nobody asked for, and one that was asked for twice', () => {
    expect(
      refusal(
        answer([
          { sectionId: 'intro', props: { heading: 'One' } },
          { sectionId: 'intro', props: { heading: 'Again' } },
          { sectionId: 'stranger', props: { heading: 'Who?' } },
        ]),
      ).join(' | '),
    ).toMatch(/wrote "intro" twice.*stranger|stranger.*wrote "intro" twice/su);
  });

  it('refuses a section it wrote nothing for', () => {
    expect(refusal(answer([{ sectionId: 'intro', props: { heading: 'One' } }])).join(' ')).toContain(
      'wrote nothing for the section "detail"',
    );
  });

  it('refuses a section with no words in it', () => {
    expect(
      refusal(
        answer([
          { sectionId: 'intro', props: { heading: '   ' } },
          { sectionId: 'detail', props: { body: 'Real words.' } },
        ]),
      ).join(' '),
    ).toContain('has no words in it');
  });

  /*
    Both languages, because the default locale is Arabic and a check that only
    knew English would pass the exact page it exists to catch. The Arabic case
    is not a translation of the English one — it is the filler an Arabic model
    actually reaches for.
  */
  it.each([
    ['English', 'Lorem ipsum dolor sit amet'],
    ['English', 'Your headline here'],
    ['Arabic', 'عنوان القسم'],
    ['Arabic', 'هنا نصّك'],
  ])('refuses %s filler: "%s"', (_language, text) => {
    expect(
      refusal(
        answer([
          { sectionId: 'intro', props: { heading: text } },
          { sectionId: 'detail', props: { body: 'Real words.' } },
        ]),
      ).join(' '),
    ).toContain('placeholder copy');
  });

  it('finds filler however deep in the props it hides', () => {
    expect(
      refusal(
        answer([
          { sectionId: 'intro', props: { items: [{ card: { title: 'TODO' } }] } },
          { sectionId: 'detail', props: { body: 'Real words.' } },
        ]),
      ).join(' '),
    ).toContain('placeholder copy');
  });

  it('refuses an answer that is not shaped like one, by shape and not by TypeError', () => {
    expect(refusal({ stage: 'content', pageId: 'home' }).join(' ')).toContain(
      'must carry a list of sections',
    );
    expect(refusal(answer([null as never])).join(' ')).toContain('does not say which section');
  });
});

/**
 * SC-005, first half: at least 95% of generated text spans carry terms from the
 * brief.
 *
 * ## What this proves and what it does not
 *
 * It proves the measure runs over real pipeline output, that the brief reaches
 * the stage that writes words, and that a site about a ceramics studio says
 * "ceramics" somewhere. It proves NOTHING about whether a model writes well: the
 * offline provider is a template, and a template naming the business clears this
 * bar by construction. That is a floor — the number that matters is the one a
 * real provider scores, and it is measured by the same function, live.
 *
 * The bar is worth having anyway, because the first version of this pipeline
 * failed it. The content stage was handed the brief and ignored it, writing
 * every span from a fixed page plan — so a ceramics studio and a law firm
 * shipped identical words, and the measure scored zero.
 */
describe('SC-005 — the copy is about the business', () => {
  const LIMITS: StageLimits = { maxPages: 4, maxSectionsPerPage: 3, maxTokens: 20_000 };

  const spansOf = async (brief: string): Promise<readonly string[]> => {
    const site = await generateSite({
      runId: 'run-1',
      brief,
      provider: createOfflineSiteStageProvider(),
      seed: 'seed-1',
      baseFingerprint: 'site-v1-sha256-abc',
      dir: 'ltr',
      limits: LIMITS,
      blockTypes: ['section', 'text'],
      allowedCommands: ['addPage', 'insertNode', 'setDesignSystem'],
    });
    return site.content.flatMap((page) =>
      page.sections.flatMap((section) =>
        Object.values(section.props).filter((value): value is string => typeof value === 'string'),
      ),
    );
  };

  it.each([
    'a ceramics studio in Amman',
    'مشغل خزف في عمّان',
    'a two-person law firm that only does housing',
  ])('every span of a site built for "%s" carries its terms', async (brief) => {
    const spans = await spansOf(brief);
    const measured = measureBriefRelevance(brief, spans);

    /* Non-vacuity: an empty site also scores 1. */
    expect(measured.spans).toBeGreaterThan(3);
    expect(measured.terms.length).toBeGreaterThan(0);
    expect(measured.coverage).toBeGreaterThanOrEqual(0.95);
    expect(measured.generic).toEqual([]);
  });

  it('scores copy that mentions nothing from the brief at zero', () => {
    /*
      The measure has to be able to FAIL, and this is what failing looked like:
      the page plan's own words, which are the same for every brief ever typed.
    */
    const before = [
      'Home — Say what this is and who it is for',
      'Work — Show what has been made',
      'Pricing — State what it costs',
    ];
    const measured = measureBriefRelevance('مشغل خزف في عمّان', before);
    expect(measured.coverage).toBe(0);
    expect(measured.generic).toEqual(before);
  });

  it('does not count a span with no words in it, either way', () => {
    /*
      A blank alt text is not evidence of a generic design and not evidence of a
      specific one. Counting it as generic would penalise a site for an empty
      string; counting it as relevant would let a page of blanks score a perfect
      one.
    */
    const mixed = measureBriefRelevance('a ceramics studio', ['We fire ceramics here.', '   ', '']);
    expect(mixed.spans).toBe(1);
    expect(mixed.coverage).toBe(1);

    const blanks = measureBriefRelevance('a ceramics studio', ['  ', '']);
    expect(blanks.spans).toBe(0);
    expect(blanks.coverage).toBe(1);
  });

  it('matches a DEFINITE brief term against indefinite copy', () => {
    /*
      The direction that needs the code. Substring matching already handles a
      brief saying "خزف" and copy saying "الخزف"; the hard way round is a brief
      written definite — which is how people write — and copy that is not. The
      article is stripped from the TERM so both directions work.
    */
    const measured = measureBriefRelevance('مشغل الخزف', ['نصنع خزف يدويًا']);
    expect(measured.terms).toContain('خزف');
    expect(measured.coverage).toBe(1);
  });

  it('ignores the closed-class words that appear in every sentence ever written', () => {
    /*
      "the" and "and" clear the three-character floor, so only the closed-class
      list keeps them out — and a brief whose terms included "the" would score
      every English sentence ever written as relevant.
    */
    const english = measureBriefRelevance('the studio and the kiln', ['They opened the door.']);
    expect(english.terms).toEqual(['studio', 'kiln']);
    expect(english.coverage).toBe(0);

    const arabic = measureBriefRelevance('هذا مشغل خزف', ['هذا شيء آخر تمامًا']);
    expect(arabic.terms).toEqual(['مشغل', 'خزف']);
    expect(arabic.coverage).toBe(0);
  });
});
