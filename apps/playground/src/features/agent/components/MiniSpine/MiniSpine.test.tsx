/**
 * MiniSpine (SPEC §4.19): the phone's horizontal spine. Three promises, each a test:
 * - it says nothing to assistive technology and offers nothing to press (the status line
 *   beside it carries the count in words);
 * - ink means landed (SPEC §1): of every row state, only `landed` draws ink, and "the page
 *   is whole" only when every section landed;
 * - one 4px segment per section, 2px apart, in page order, drawn with tokens and logical
 *   properties, with the motion SPEC §5 allows and none under reduced motion.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { RowState } from '../../model/view-types';
import { clinicRows, PARALLEL_STATES } from '../../testing/wp-15-history-phone-fixtures';

import { miniSegmentKind } from './mini-segment-kind';
import { MiniSpine } from './MiniSpine';

const TOKENS = new Set(
  [
    ...readFileSync(
      join(process.cwd(), '..', '..', 'packages', 'builder', 'theme', 'src', 'css', 'chrome.css'),
      'utf8',
    ).matchAll(/(--bldr-[\w-]+)\s*:/gu),
  ].map(([, name = '']) => name),
);

const CSS = readFileSync(
  join(process.cwd(), 'src', 'features', 'agent', 'components', 'MiniSpine', 'MiniSpine.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//gu, '');

const ROW_STATES = [
  'planned',
  'waiting',
  'writing',
  'retrying',
  'drafted',
  'landed',
  'failed',
  'notWritten',
  'undone',
] as const satisfies readonly RowState[];

function spineOf(container: HTMLElement): HTMLElement {
  const spine = container.querySelector<HTMLElement>('.ck-agent-mini-spine');
  if (spine === null) throw new Error('no mini spine');
  return spine;
}

function kindsOf(container: HTMLElement): (string | null)[] {
  return [...spineOf(container).querySelectorAll('.ck-agent-mini-spine__segment')].map((segment) =>
    segment.getAttribute('data-kind'),
  );
}

describe('MiniSpine', () => {
  it('is hidden from assistive technology and has nothing to focus or press', () => {
    const { container } = render(<MiniSpine rows={clinicRows('en', PARALLEL_STATES)} live />);
    const spine = spineOf(container);
    expect(spine).toHaveAttribute('aria-hidden', 'true');
    expect(spine.querySelectorAll('button, a, input, [tabindex], [role]')).toHaveLength(0);
    // No words at all: the count lives in the status line beside it.
    expect(spine).toHaveTextContent('');
  });

  it('draws one segment per section, in page order', () => {
    const { container } = render(<MiniSpine rows={clinicRows('en', PARALLEL_STATES)} live />);
    expect(kindsOf(container)).toEqual([
      'ink',
      'writing',
      'writing',
      'drafted',
      'writing',
      'writing',
      'pencil',
      'pencil',
    ]);
  });

  it.each(ROW_STATES)('draws ink for %s only if the section is on the page', (state) => {
    expect(miniSegmentKind(state) === 'ink').toBe(state === 'landed');
  });

  it('keeps a finished draft apart from a writer and from ink', () => {
    expect(miniSegmentKind('drafted')).toBe('drafted');
    expect(miniSegmentKind('writing')).toBe('writing');
    expect(miniSegmentKind('retrying')).toBe('writing');
    expect(miniSegmentKind('failed')).toBe('failed');
    for (const state of ['planned', 'waiting', 'notWritten', 'undone'] as const) {
      expect(miniSegmentKind(state)).toBe('pencil');
    }
  });

  it('shows one lit track and no count during the skeleton pass', () => {
    const { container } = render(
      <MiniSpine indeterminate live rows={clinicRows('en', PARALLEL_STATES)} />,
    );
    expect(kindsOf(container)).toEqual(['writing']);
    expect(spineOf(container)).toHaveAttribute('data-indeterminate');
    expect(spineOf(container)).not.toHaveAttribute('data-complete');
  });

  it('closes the line only when every section landed', () => {
    const whole = render(<MiniSpine rows={clinicRows('en', Array<RowState>(8).fill('landed'))} />);
    expect(spineOf(whole.container)).toHaveAttribute('data-complete');
    whole.unmount();

    // Seven landed and one drafted is not a whole page: a draft is not ink.
    const almost = render(
      <MiniSpine rows={clinicRows('en', [...Array<RowState>(7).fill('landed'), 'drafted'])} />,
    );
    expect(spineOf(almost.container)).not.toHaveAttribute('data-complete');
    almost.unmount();

    const empty = render(<MiniSpine rows={[]} />);
    expect(spineOf(empty.container)).not.toHaveAttribute('data-complete');
  });

  it('carries the light only while live and the arrival motion only when asked', () => {
    const quiet = render(<MiniSpine rows={clinicRows('en', PARALLEL_STATES)} />);
    expect(spineOf(quiet.container)).not.toHaveAttribute('data-live');
    expect(spineOf(quiet.container)).not.toHaveAttribute('data-animate');
    quiet.unmount();

    const live = render(<MiniSpine rows={clinicRows('en', PARALLEL_STATES)} live animate />);
    expect(spineOf(live.container)).toHaveAttribute('data-live');
    expect(spineOf(live.container)).toHaveAttribute('data-animate');
  });

  it('appends a class without replacing its own', () => {
    const { container } = render(<MiniSpine rows={[]} className="extra" />);
    expect(spineOf(container)).toHaveClass('ck-agent-mini-spine', 'extra');
  });
});

describe('MiniSpine.css', () => {
  it('is 4px tall with 2px between segments that share the width', () => {
    expect(CSS).toMatch(
      /\.ck-agent-mini-spine\s*\{[^}]*gap:\s*var\(--bldr-space-2xs\)[^}]*block-size:\s*var\(--bldr-space-xs\)/u,
    );
    expect(CSS).toMatch(/\.ck-agent-mini-spine__segment\s*\{[^}]*flex:\s*1 1 0/u);
  });

  it('spends Indigo on ink alone: pencil is Track, a writer and a draft are Halo', () => {
    expect(CSS).toMatch(/\[data-kind='pencil'\][^{]*\{[^}]*--bldr-progress-track/u);
    expect(CSS).toMatch(/\.ck-agent-mini-spine__segment\s*\{[^}]*--bldr-accent-ring/u);
    expect(CSS).toMatch(
      /\[data-kind='ink'\]::before\s*\{[^}]*background-color:\s*var\(--bldr-accent\)/u,
    );
    expect(CSS).toMatch(/\[data-kind='failed'\][^{]*\{[^}]*--bldr-danger/u);
  });

  it('moves only as SPEC §5 says, in the reading direction, and not at all under reduced motion', () => {
    expect(CSS).toMatch(
      /animation:\s*ck-agent-mini-glint var\(--bldr-duration-glint\) linear infinite/u,
    );
    expect(CSS).toMatch(
      /animation:\s*ck-agent-mini-ink var\(--bldr-duration-land\) var\(--bldr-easing-enter\)/u,
    );
    expect(CSS).toMatch(/animation:\s*ck-agent-mini-sweep var\(--bldr-duration-sweep\)/u);
    expect(CSS).toMatch(/:dir\(rtl\)\s*\{[^}]*animation-direction:\s*reverse/u);
    const reduced = CSS.slice(CSS.indexOf('prefers-reduced-motion'));
    expect(reduced).toMatch(/animation:\s*none/u);
  });

  it('keeps every kind distinct in forced colours, by border style', () => {
    const forced = CSS.slice(CSS.indexOf('forced-colors: active'));
    expect(forced).toMatch(/'pencil'\]\s*\{[^}]*dashed GrayText/u);
    expect(forced).toMatch(/'writing'\]\s*\{[^}]*dotted Highlight/u);
    expect(forced).toMatch(/'drafted'\]\s*\{[^}]*dotted CanvasText/u);
    expect(forced).toMatch(/'ink'\]\s*\{[^}]*solid Highlight/u);
    expect(forced).toMatch(/'failed'\]\s*\{[^}]*dashed Mark/u);
  });

  it('reads only tokens the chrome contract defines, through logical properties', () => {
    const used = [...CSS.matchAll(/var\((--bldr-[\w-]+)/gu)].map(([, name = '']) => name);
    expect(used.filter((name) => !TOKENS.has(name))).toEqual([]);
    expect(CSS).not.toMatch(
      /(?:^|[\s;{])(?:left|right|top|bottom|(?:margin|padding|border)-(?:left|right|top|bottom)|(?:min-|max-)?(?:width|height))\s*:/mu,
    );
    expect(CSS).not.toMatch(/translateX|#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch)\(/iu);
  });
});
