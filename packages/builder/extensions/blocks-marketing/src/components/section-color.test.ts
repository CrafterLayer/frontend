import { describe, expect, it } from 'vitest';

import { COLOR_TOKENS, TOKEN_NAMES } from '@craftkit/builder-schema';

import { marketingBlockSchemas } from '../schemas';
import { sectionBackgrounds, sectionTextColors } from './section-color';

/**
 * FR-011: a generated section carries no literal colour, font, or raw size.
 *
 * ## Why the check is on the SCHEMA and not on a generated page
 *
 * Because a generated section is only ever a set of props that went through one
 * of these schemas. A test that inspected finished pages would prove the claim
 * for the pages it happened to generate; a test that proves the schemas refuse
 * literals proves it for every page anyone will ever generate, including the
 * ones a model invents next year.
 *
 * ## Why literals matter this much
 *
 * A hex in a document is a colour no theme can move. Re-pointing a palette then
 * repaints the pages that used roles and silently skips the ones that used
 * values — and the second set looks fine until the day someone changes the
 * brand and half the site does not follow.
 */

const LITERALS = [
  ['a hex colour', '#ff0000'],
  ['a short hex', '#f00'],
  ['an rgb() colour', 'rgb(255, 0, 0)'],
  ['a named colour', 'rebeccapurple'],
  ['a raw pixel size', '64px'],
  ['a raw rem size', '4rem'],
  ['a font family', 'Helvetica, sans-serif'],
] as const;

/** Every prop key any marketing section declares, with the schema that owns it. */
function propsOf(schema: (typeof marketingBlockSchemas)[number]): readonly string[] {
  const shape: unknown = (schema.props as { shape?: unknown }).shape;
  return typeof shape === 'object' && shape !== null ? Object.keys(shape) : [];
}

describe('no marketing section admits a literal colour, font, or size', () => {
  it('has sections to check, so an empty pass is impossible', () => {
    expect(marketingBlockSchemas.length).toBeGreaterThan(10);
    for (const schema of marketingBlockSchemas) {
      expect(propsOf(schema).length).toBeGreaterThan(0);
    }
  });

  it.each(LITERALS)('refuses %s in the background of EVERY section', (_name, literal) => {
    for (const schema of marketingBlockSchemas) {
      if (!propsOf(schema).includes('background')) continue;
      const parsed = schema.props.safeParse({ background: literal });
      expect(parsed.success, `${schema.type} accepted background="${literal}"`).toBe(false);
    }
  });

  it.each(LITERALS)('refuses %s in the text colour of EVERY section', (_name, literal) => {
    for (const schema of marketingBlockSchemas) {
      if (!propsOf(schema).includes('textColor')) continue;
      const parsed = schema.props.safeParse({ textColor: literal });
      expect(parsed.success, `${schema.type} accepted textColor="${literal}"`).toBe(false);
    }
  });

  it.each(LITERALS)('refuses %s where a section takes a SPACING', (_name, literal) => {
    for (const schema of marketingBlockSchemas) {
      if (!propsOf(schema).includes('spacing')) continue;
      const parsed = schema.props.safeParse({ spacing: literal });
      expect(parsed.success, `${schema.type} accepted spacing="${literal}"`).toBe(false);
    }
  });

  it('offers ROLE names, every one of which the theme actually defines', () => {
    /*
      A role the theme has no token for is a colour that resolves to nothing at
      paint time — the same silent failure a literal causes, arrived at from the
      opposite direction.
    */
    for (const role of [...sectionBackgrounds, ...sectionTextColors]) {
      expect(TOKEN_NAMES, `"${role}" is not a token`).toContain(role);
      expect(COLOR_TOKENS, `"${role}" is not a COLOUR token`).toContain(role);
    }
  });

  it('accepts the roles it offers, so the refusals above are not refusing everything', () => {
    const hero = marketingBlockSchemas.find((schema) => schema.type === 'hero');
    if (hero === undefined) throw new Error('the marketing set must contain a hero');
    for (const role of sectionBackgrounds) {
      expect(hero.props.safeParse({ background: role }).success).toBe(true);
    }
  });
});
