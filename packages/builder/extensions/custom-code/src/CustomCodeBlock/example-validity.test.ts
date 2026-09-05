import { describe, expect, it } from 'vitest';

import {
  customCodeClassNames,
  customCodeComponentTypes,
  customCodeIconNames,
  isLucideIconName,
  unknownUtilityClasses,
} from '@craftkit/builder-schema';

import { customCodeSchema } from './schema';
import { findCssRejection, scopeCustomCodeCss } from './scope-css';

/**
 * The example is the instruction manual.
 *
 * It is the one piece of this block's catalog entry that survives every
 * catalog mode, and a model imitates what it is shown far more reliably than
 * what it is told. So an example that would itself be REFUSED by the door
 * teaches the model to produce refusals — the most expensive kind of wrong
 * documentation, because it looks like guidance and behaves like sabotage.
 *
 * These tests put the shipped example through every gate a real proposal
 * passes.
 */
const example = customCodeSchema.examples[0];
/*
  Parsed rather than cast: this suite asserts things ABOUT the example, and
  reading it through the block's own schema means those assertions are made
  against the same shape a renderer receives — including defaults.
*/
const parsedExample = customCodeSchema.props.safeParse(
  (example?.node as { props?: unknown } | undefined)?.props ?? {},
);
const props = parsedExample.success
  ? parsedExample.data
  : { label: '', tree: undefined as unknown, css: '' };

describe('the shipped example', () => {
  it('exists — an escape hatch documented only in prose is barely documented', () => {
    expect(example).toBeDefined();
    expect(example?.prompt).toBeTruthy();
  });

  it('parses against the block own schema', () => {
    expect(parsedExample.error?.issues ?? []).toEqual([]);
    expect(parsedExample.success).toBe(true);
  });

  it('uses only utility classes the runtime vocabulary generates', () => {
    const unknown = [
      ...new Set(customCodeClassNames(props.tree).flatMap((value) => unknownUtilityClasses(value))),
    ];

    // Anything here would be a class with no CSS, shown to the model as correct.
    expect(unknown).toEqual([]);
  });

  it('carries CSS the door accepts and scopes', () => {
    const { css } = props;

    expect(findCssRejection(css)).toBeUndefined();
    if (css.trim() !== '') {
      expect(scopeCustomCodeCss(css, 'n1')).toContain('[data-ck="n1"]');
    }
  });

  it('demonstrates BOTH node kinds, including the component reference', () => {
    // An example showing only markup teaches that references do not exist.
    const referenced = customCodeComponentTypes(props.tree);

    expect(referenced.length).toBeGreaterThan(0);
  });

  it('names only icons the set actually has — a placeholder in the example teaches placeholders', () => {
    const missing = customCodeIconNames(props.tree).filter((name) => !isLucideIconName(name));

    expect(missing).toEqual([]);
    expect(customCodeIconNames(props.tree).length).toBeGreaterThan(0);
  });

  it('references a block type this workspace actually ships', () => {
    // A reference to a type no pack registers renders as UnknownBlock — the
    // example would be teaching the model to produce a visible error.
    expect(customCodeComponentTypes(props.tree)).toEqual(['card']);
  });

  it('reaches for colour through tokens, so a re-themed site moves with it', () => {
    const { css } = props;

    if (css.includes('linear-gradient')) {
      expect(css).toContain('var(--t-');
    }
  });
});
