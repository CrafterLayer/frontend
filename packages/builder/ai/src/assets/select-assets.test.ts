import { describe, expect, it } from 'vitest';

import {
  defaultDesignSystem,
  type AssetLibraryPort,
  type ImageProp,
} from '@craftkit/builder-schema';

import { FIXED_ASSETS, createFixedAssetLibrary } from '../testing/fixed-asset-library';
import { scoreAsset, selectAssets, type AssetPosition } from './select-assets';

const CERAMICS = 'a ceramics studio in Amman that fires its own glazes';

const positions = (...intents: readonly string[]): readonly AssetPosition[] =>
  intents.map((intent, index) => ({ id: `p${String(index)}`, intent }));

const reasons = (choices: readonly { image: ImageProp }[]): readonly string[] =>
  choices.map((choice) => ('absent' in choice.image ? choice.image.reason : ''));

describe('selectAssets', () => {
  it('chooses a picture that answers the POSITION, not only the brief', async () => {
    const result = await selectAssets({
      brief: CERAMICS,
      positions: positions('a kiln at work'),
      library: createFixedAssetLibrary(),
    });

    expect(result.choices[0]?.entry?.id).toBe('kiln');
    expect(result.used.map((entry) => entry.id)).toEqual(['kiln']);
  });

  it('never repeats a picture across positions', async () => {
    const result = await selectAssets({
      brief: CERAMICS,
      positions: positions('craft', 'craft', 'craft'),
      library: createFixedAssetLibrary(),
    });

    const chosen = result.choices.map((choice) => choice.entry?.id).filter(Boolean);
    /*
      The same photograph three times reads as a mistake. Running out is a
      labelled absence, which reads as a decision — because it is one.
    */
    expect(new Set(chosen).size).toBe(chosen.length);
  });

  it('produces an ASSET REFERENCE, never a URL a model wrote', async () => {
    const result = await selectAssets({
      brief: CERAMICS,
      positions: positions('a kiln at work'),
      library: createFixedAssetLibrary(),
    });

    /*
      The whole point of the module. A generated `src` renders as a broken image
      on someone's site, cannot be validated, and is indistinguishable from a
      real one until a visitor sees it.

      Asserted on `image`, which is what LANDS in the document. The chosen entry
      travels beside it so a caller can build the site's asset table without a
      second lookup, and it carries the real URL by definition.
    */
    expect(result.choices[0]?.image).toEqual({ assetId: 'kiln' });
    expect(JSON.stringify(result.choices.map((choice) => choice.image))).not.toContain('http');
  });

  it('LABELS an absence rather than inventing a picture when nothing matches', async () => {
    /*
      The library must answer NEITHER the position nor the brief. An earlier
      version of this test used a ceramics brief with a submarine intent and
      expected an absence — and got the kiln, correctly: FR-046 says selection
      is "directed by the brief", and a section INTENT describes a purpose
      ("the opening claim") while a photograph's description describes content
      ("a kiln glowing"). The two rarely share a word, so an intent veto would
      make every position an absence. The brief is the direction; the intent
      refines it.
    */
    const result = await selectAssets({
      brief: 'a submarine tour operator in Tromsø',
      positions: positions('a periscope at depth'),
      library: createFixedAssetLibrary(),
    });

    expect(result.choices[0]?.image).toMatchObject({ absent: true });
    expect(reasons(result.choices)[0]).toContain('periscope');
    expect(result.used).toEqual([]);
  });
});

describe('degrading without failing (FR-051)', () => {
  it('completes with labelled absences when the library is EMPTY', async () => {
    const result = await selectAssets({
      brief: CERAMICS,
      positions: positions('a kiln', 'a shelf'),
      library: createFixedAssetLibrary({ entries: [] }),
    });

    /*
      A site with no pictures is a site. A run that failed here would be
      refusing to build a perfectly good text site.
    */
    expect(result.choices).toHaveLength(2);
    for (const reason of reasons(result.choices)) {
      expect(reason).toContain('empty');
    }
  });

  it('completes when the library is UNAVAILABLE, and says what it said', async () => {
    const result = await selectAssets({
      brief: CERAMICS,
      positions: positions('a kiln'),
      library: createFixedAssetLibrary({ unavailable: 'the store is down for maintenance' }),
    });

    /*
      "The library did not answer" and "the library said no" send a person to
      different places, so the library's own words are carried through.
    */
    expect(reasons(result.choices)[0]).toContain('down for maintenance');
    expect(result.used).toEqual([]);
  });

  it('completes when NO library is wired at all', async () => {
    const result = await selectAssets({ brief: CERAMICS, positions: positions('a kiln') });

    expect(reasons(result.choices)[0]).toContain('No asset library is wired');
  });

  it('runs out gracefully, and says it ran out rather than that nothing matched', async () => {
    const result = await selectAssets({
      brief: CERAMICS,
      /*
        Every intent has to reach EVERY entry, or the run never exhausts the
        library: a position nothing answers takes nothing, so `desk` and
        `meeting` would sit unused for ever and the seventh position would be
        told "nothing matches" instead of "ran out". Seven positions, six
        assets, one sentence left over.
      */
      positions: positions(...Array.from({ length: 7 }, () => 'craft formal warm order people')),
      library: createFixedAssetLibrary(),
    });

    /*
      Two different failures, two different sentences — and both appear here.
      A position nothing answers is told so by name; a position that arrived
      after the library was exhausted is told that instead. Collapsing them
      into one message would send a person looking for a better photograph when
      the real answer is that there were no photographs left.
    */
    const absent = reasons(result.choices).filter((reason) => reason !== '');
    expect(absent.length).toBeGreaterThan(0);
    expect(absent.at(-1)).toContain('ran out');
    expect(result.used.length).toBe(FIXED_ASSETS.length);
  });
});

describe('scoreAsset', () => {
  const kiln = FIXED_ASSETS[0];

  it('weighs the POSITION above the brief', () => {
    if (kiln === undefined) throw new Error('the fixed library must have a kiln');
    /*
      The brief describes the whole site; the intent describes this one
      position. A picture that answers the position is the better answer even
      when another shares more words with the brief.
    */
    const byIntent = scoreAsset(kiln, [], ['kiln'], []);
    const byBrief = scoreAsset(kiln, ['kiln'], [], []);
    expect(byIntent).toBeGreaterThan(byBrief);
  });

  it('rewards a palette the site actually uses', () => {
    if (kiln === undefined) throw new Error('the fixed library must have a kiln');
    const withPalette = scoreAsset(kiln, [], [], ['#c2410c']);
    const without = scoreAsset(kiln, [], [], []);
    expect(withPalette).toBeGreaterThan(without);
  });

  it('is transparent arithmetic a person could argue with', () => {
    if (kiln === undefined) throw new Error('the fixed library must have a kiln');
    /*
      Deliberately not a similarity model. Someone shown a picture they did not
      expect should be able to find out why: "its description shares two words
      with your brief and its palette matches your accent" is an answer.
    */
    expect(scoreAsset(kiln, ['ceramics'], ['kiln'], ['#c2410c'])).toBe(1 * 1 + 3 * 1 + 1);
  });
});

describe('the design system steers the choice', () => {
  it('prefers a picture whose palette the site declares', async () => {
    const warm = defaultDesignSystem();
    const library: AssetLibraryPort = createFixedAssetLibrary({
      entries: [
        { ...FIXED_ASSETS[1]!, id: 'a', palette: ['#000000'] },
        { ...FIXED_ASSETS[1]!, id: 'b', palette: [warm.tokens.surface.toLowerCase()] },
      ],
    });

    const result = await selectAssets({
      brief: CERAMICS,
      positions: positions('hands at work'),
      library,
      designSystem: warm,
    });

    expect(result.choices[0]?.entry?.id).toBe('b');
  });
});
