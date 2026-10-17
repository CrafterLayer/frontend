import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { RepeaterField } from './RepeaterField';

/**
 * The design laws of the Inspector's three sheets, read as text.
 *
 * The theme package already forbids raw lengths and colours everywhere; these
 * pins are the Inspector-specific decisions (rulings R12–R16 of the rebuild)
 * that a later "small CSS tweak" would otherwise undo without any test going
 * red: hairline tokens, no stroke in CSS, reduced motion per sheet, logical
 * properties only, the container-sized panel, the scale-token rule, and the
 * unclipped focus ring.
 */
const read = (...segments: readonly string[]) =>
  readFileSync(join(process.cwd(), 'src', 'components', 'Inspector', ...segments), 'utf8');

const SHEETS = {
  'Inspector.css': read('Inspector.css'),
  'InspectorRow.css': read('InspectorRow.css'),
  'RepeaterField.css': read('RepeaterField', 'RepeaterField.css'),
} as const;

const SHELL = SHEETS['Inspector.css'];
const ROW = SHEETS['InspectorRow.css'];
const REPEATER = SHEETS['RepeaterField.css'];

/** The declarations of the FIRST rule whose selector list is exactly `selector`. */
function block(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) {
    throw new Error(`No rule for ${selector}`);
  }
  return css.slice(start, css.indexOf('}', start));
}

const entries = Object.entries(SHEETS);

describe('Inspector sheets — tokens and edges', () => {
  it.each(entries)('%s spends no spacing token on a hairline (R14)', (_, css) => {
    expect(css).not.toContain('calc(var(--bldr-space-2xs) / 2)');
    expect(css).not.toMatch(/var\(--bldr-space-2xs\)\s+solid/u);
  });

  it.each(entries)('%s reads only theme tokens: no lengths, no colours', (_, css) => {
    expect(css).not.toMatch(/\b\d+(\.\d+)?(px|rem|em)\b/u);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/u);
  });

  it.each(entries)('%s never branches on the theme attribute (dark is tokens)', (_, css) => {
    expect(css).not.toContain('data-bldr-theme');
  });

  it.each(entries)('%s uses logical properties only (RTL by construction)', (_, css) => {
    expect(css).not.toMatch(/^\s*(margin|padding|border|inset)-(left|right|top|bottom)\s*:/mu);
    expect(css).not.toMatch(/^\s*(left|right|top|bottom)\s*:/mu);
    expect(css).not.toMatch(/text-align:\s*(left|right)/u);
  });

  it.each(entries)('%s leaves stroke to the SVG attributes (R14)', (_, css) => {
    expect(css).not.toMatch(/stroke(-width|-linecap|-linejoin)?\s*:/u);
  });

  it.each(entries)('%s honours reduced motion wherever it declares a transition', (_, css) => {
    if (!/transition\s*:/u.test(css)) {
      return;
    }
    const at = css.indexOf('@media (prefers-reduced-motion: reduce)');
    expect(at).toBeGreaterThan(-1);
    expect(css.slice(at)).toContain('transition: none;');
  });

  it('draws thick edges with the thick token', () => {
    expect(block(ROW, '.bldr-inspector__rejection')).toContain(
      'border-inline-start: var(--bldr-border-thick) solid var(--bldr-danger-border);',
    );
    expect(block(SHELL, ".bldr-inspector__empty[data-tone='warning']")).toContain(
      'border-inline-start: var(--bldr-border-thick) solid var(--bldr-warning-border);',
    );
  });
});

describe('Inspector sheets — container and header (R10, R12)', () => {
  it('is sized by its container: no seam of its own, no width token read', () => {
    const shell = block(SHELL, '.bldr-inspector');
    expect(shell).not.toContain('border-inline-start');
    expect(shell).not.toContain('--bldr-inspector-width');
    expect(shell).toContain('inline-size: 100%;');
    expect(shell).toContain('min-block-size: 100%;');
  });

  it('sticks the head to the scrolling aside', () => {
    const head = block(SHELL, '.bldr-inspector__head');
    expect(head).toContain('position: sticky;');
    expect(head).toContain('inset-block-start: var(--bldr-space-0);');
  });

  it('touches the Clear-selection ChromeButton with ONE rule: its seat at the row end', () => {
    expect(SHELL.match(/bldr-inspector__clear-selection/gu)).toHaveLength(1);
    const clear = block(SHELL, '.bldr-inspector__clear-selection');
    expect(clear.replace('.bldr-inspector__clear-selection {', '').trim()).toBe(
      'margin-inline-start: auto;',
    );
    // The old shared class, which once painted the header button as a bare
    // muted cross, is gone from every sheet.
    for (const css of Object.values(SHEETS)) {
      expect(css).not.toMatch(/bldr-inspector__clear(?![-\w])/u);
    }
  });

  it('makes "Inspector" the eyebrow and the block name the title', () => {
    const eyebrow = block(SHELL, '.bldr-inspector__title');
    expect(eyebrow).toContain('text-transform: uppercase;');
    expect(eyebrow).toContain('font-size: var(--bldr-font-size-caption);');
    const name = block(SHELL, '.bldr-inspector__block-name');
    expect(name).toContain('font-size: var(--bldr-font-size-title);');
    expect(name).toContain('min-block-size: var(--bldr-control-height-sm);');
  });

  it('rotates ONE chevron glyph when a section is collapsed (R15)', () => {
    expect(block(SHELL, ".bldr-inspector__chevron[data-collapsed='true']")).toContain(
      'transform: rotate(180deg);',
    );
  });
});

describe('Inspector sheets — the scale-token rule (R13)', () => {
  it.each([
    ['.bldr-inspector__tab', SHELL],
    ['.bldr-inspector__section-toggle', SHELL],
    ['.bldr-repeater__disclosure', REPEATER],
  ])('%s sizes to the density-aware small control height', (selector, css) => {
    expect(block(css, selector)).toContain('min-block-size: var(--bldr-control-height-sm);');
  });

  it.each([
    ['.bldr-inspector .bldr-field__input', ROW],
    ['.bldr-repeater__add', REPEATER],
  ])('%s sizes to the density-aware control height', (selector, css) => {
    expect(block(css, selector)).toContain('min-block-size: var(--bldr-control-height);');
  });

  it.each([
    ['.bldr-inspector__segment', ROW],
    ['.bldr-inspector__override-clear', ROW],
    ['.bldr-inspector__breakpoint-glyph', ROW],
    ['.bldr-repeater__action', REPEATER],
  ])('%s is the story-measured small control in both axes', (selector, css) => {
    const rule = block(css, selector);
    expect(rule).toContain('block-size: var(--bldr-control-sm);');
    expect(rule).toContain('inline-size: var(--bldr-control-sm);');
  });

  it.each(entries)('%s no longer reads the retired md/lg control tokens', (_, css) => {
    expect(css).not.toContain('--bldr-control-md');
    expect(css).not.toContain('--bldr-control-lg');
  });
});

describe('Inspector sheets — the focus ring is never clipped (R16)', () => {
  it.each([
    ['.bldr-inspector__segments', ROW],
    ['.bldr-repeater__item', REPEATER],
  ])('%s does not hide overflow', (selector, css) => {
    expect(block(css, selector)).not.toContain('overflow: hidden');
  });

  it('gives the segment fills logical end radii so nothing paints square', () => {
    expect(block(ROW, '.bldr-inspector__segment:first-child')).toContain(
      'border-start-start-radius',
    );
    expect(block(ROW, '.bldr-inspector__segment:last-child')).toContain('border-end-end-radius');
  });

  it('keeps the repeater card chrome transparent over the rounded border', () => {
    expect(block(REPEATER, '.bldr-repeater__disclosure')).toContain(
      'background-color: transparent;',
    );
    expect(block(REPEATER, '.bldr-repeater__action')).toContain('background-color: transparent;');
  });

  it('clears an override in the danger tone', () => {
    const hover = block(ROW, '.bldr-inspector__override-clear:hover');
    expect(hover).toContain('background-color: var(--bldr-danger-soft);');
    expect(hover).toContain('color: var(--bldr-danger);');
  });
});

describe('RepeaterField glyphs carry the stroke recipe on the element', () => {
  it('renders every svg with currentColor, 1.5 stroke, no fill', () => {
    const { container } = render(
      <RepeaterField
        schema={z.array(z.object({ title: z.string() }))}
        value={[{ title: 'One' }, { title: 'Two' }]}
        path={['props', 'items']}
        commit={() => ({ ok: true })}
        announce={() => undefined}
        renderRow={(row) => <input key={row.key} aria-label={row.propKey} readOnly />}
      />,
    );
    const icons = container.querySelectorAll('svg');
    expect(icons.length).toBeGreaterThanOrEqual(9); // 2 disclosures + 6 actions + add
    for (const icon of icons) {
      expect(icon).toHaveAttribute('viewBox', '0 0 16 16');
      expect(icon).toHaveAttribute('fill', 'none');
      expect(icon).toHaveAttribute('stroke', 'currentColor');
      expect(icon).toHaveAttribute('stroke-width', '1.5');
      expect(icon).toHaveAttribute('stroke-linecap', 'round');
      expect(icon).toHaveAttribute('stroke-linejoin', 'round');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    }
  });
});
