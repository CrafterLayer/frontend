/**
 * RunGlyph (SPEC §4.7): the status node of a record head, a spine row and the RunBar.
 *
 * The rule under test is SPEC §2.1 rule 1, "state is never colour alone". Every state has
 * its own geometry in the markup, and every colour lives in the stylesheet, so the test can
 * strip colour entirely (it never reaches the markup) and still tell the nine states apart.
 * High-contrast mode strips colour the same way, which is why this matters: under
 * `forced-colors: active` the shapes are all that is left.
 *
 * SPEC §4.7 draws "drafted" as the waiting ring in Indigo, which only colour separates.
 * Its frames draw it ◎, so the drafted ring carries a core dot: a shape of its own, still
 * "an outline with no fill", as §2.1 rule 3 asks.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { BuildPhase, RowState } from '../../model/view-types';

import { RunGlyph } from './RunGlyph';
import {
  RUN_GLYPH_STATES,
  glyphForBuildPhase,
  glyphForRow,
  type RunGlyphState,
} from './run-glyph-state';

const CSS = readFileSync(
  join(process.cwd(), 'src', 'features', 'agent', 'components', 'RunGlyph', 'RunGlyph.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

function svgOf(container: HTMLElement): SVGSVGElement {
  const svg = container.querySelector('svg');
  if (svg === null) throw new Error('no glyph rendered');
  return svg;
}

/**
 * The glyph's geometry and nothing else: each shape's element name and geometric
 * attributes, with class names (the stylesheet's colour hooks) and data attributes left
 * out. Two states with the same signature would differ by colour alone.
 */
function shapeSignature(svg: SVGSVGElement): string {
  return [...svg.querySelectorAll('*')]
    .map((element) => {
      const attributes = [...element.attributes]
        .filter((attribute) => attribute.name !== 'class' && !attribute.name.startsWith('data-'))
        .map((attribute) => `${attribute.name}=${attribute.value}`)
        .sort()
        .join(' ');
      return `${element.tagName}(${attributes})`;
    })
    .join(' ');
}

function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:^|\\}|,)\\s*${escaped}\\s*(?:,[^{]*)?\\{([^}]*)\\}`, 'm').exec(CSS);
  if (match?.[1] === undefined) throw new Error(`no rule for ${selector}`);
  return match[1];
}

describe('RunGlyph', () => {
  it('draws every state in a 16px box, hidden from assistive technology', () => {
    for (const state of RUN_GLYPH_STATES) {
      const { container, unmount } = render(<RunGlyph state={state} />);
      const svg = svgOf(container);
      expect(svg).toHaveAttribute('data-state', state);
      expect(svg).toHaveAttribute('width', '16');
      expect(svg).toHaveAttribute('height', '16');
      expect(svg).toHaveAttribute('viewBox', '0 0 16 16');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
      expect(svg).toHaveAttribute('focusable', 'false');
      // The state word lives in the record's accessible name, never in the glyph.
      expect(svg.querySelector('title, desc')).toBeNull();
      unmount();
    }
  });

  it('gives every state a distinct shape once colour is taken away', () => {
    const signatures = new Map<string, RunGlyphState>();
    for (const state of RUN_GLYPH_STATES) {
      const { container, unmount } = render(<RunGlyph state={state} />);
      const signature = shapeSignature(svgOf(container));
      expect({ state, sameShapeAs: signatures.get(signature) }).toEqual({
        state,
        sameShapeAs: undefined,
      });
      signatures.set(signature, state);
      unmount();
    }
    expect(signatures.size).toBe(RUN_GLYPH_STATES.length);
  });

  it('keeps colour out of the markup, so the shapes above are all a state has', () => {
    for (const state of RUN_GLYPH_STATES) {
      const { container, unmount } = render(<RunGlyph state={state} />);
      for (const element of svgOf(container).querySelectorAll('*')) {
        for (const attribute of ['fill', 'stroke', 'color', 'style']) {
          expect({ state, attribute, value: element.getAttribute(attribute) }).toEqual({
            state,
            attribute,
            value: null,
          });
        }
      }
      unmount();
    }
  });

  it('keeps the node ring as one DOM node from waiting to landed, so the landing can crossfade', () => {
    const { container, rerender } = render(<RunGlyph state="waiting" animate />);
    const ring = svgOf(container).querySelector('.ck-agent-glyph__ring');
    expect(ring).not.toBeNull();
    for (const state of ['working', 'drafted', 'landed', 'partial'] as const) {
      rerender(<RunGlyph state={state} animate />);
      expect(svgOf(container).querySelector('.ck-agent-glyph__ring')).toBe(ring);
    }
  });

  it('marks the arrival motion only when asked', () => {
    const { container, rerender } = render(<RunGlyph state="landed" />);
    expect(svgOf(container)).not.toHaveAttribute('data-animate');
    rerender(<RunGlyph state="landed" animate />);
    expect(svgOf(container)).toHaveAttribute('data-animate');
  });

  it('mirrors what sits at the reading edge, and nothing else', () => {
    const mirrored = (state: RunGlyphState): string[] => {
      const { container, unmount } = render(<RunGlyph state={state} />);
      const found = [...svgOf(container).querySelectorAll('[data-mirror]')].map(
        (element) => element.getAttribute('class') ?? '',
      );
      unmount();
      return found;
    };
    // The partial dot sits at block-start/inline-end; the note's lines are ragged at the end.
    expect(mirrored('partial')).toEqual(['ck-agent-glyph__badge']);
    expect(mirrored('note')).toEqual(['ck-agent-glyph__lines']);
    // A check, a cross and the spinner (always clockwise) never mirror.
    for (const state of ['landed', 'failed', 'working', 'drafted', 'absent'] as const) {
      expect({ state, mirrored: mirrored(state) }).toEqual({ state, mirrored: [] });
    }
  });
});

describe('glyphForRow', () => {
  it('maps every spine row state to its SPEC §4.7 glyph', () => {
    const expected: Readonly<Record<RowState, RunGlyphState>> = {
      planned: 'waiting',
      waiting: 'waiting',
      writing: 'working',
      retrying: 'working',
      drafted: 'drafted',
      landed: 'landed',
      failed: 'failed',
      notWritten: 'absent',
      undone: 'absent',
    };
    for (const [row, glyph] of Object.entries(expected)) {
      expect({ row, glyph: glyphForRow(row as RowState) }).toEqual({ row, glyph });
    }
  });

  it('never draws ink for a section that is not on the page', () => {
    for (const row of [
      'planned',
      'waiting',
      'writing',
      'retrying',
      'drafted',
      'failed',
      'notWritten',
      'undone',
    ] as const) {
      expect(['landed', 'partial']).not.toContain(glyphForRow(row));
    }
  });
});

describe('glyphForBuildPhase', () => {
  it('maps every build phase to the head glyph of the SPEC §4.8 table', () => {
    const expected: Readonly<Record<BuildPhase, RunGlyphState>> = {
      skeleton: 'working',
      building: 'working',
      done: 'landed',
      partial: 'partial',
      stopping: 'working',
      stopped: 'absent',
      interrupted: 'absent',
      failed: 'failed',
      undone: 'absent',
    };
    for (const [phase, glyph] of Object.entries(expected)) {
      expect({ phase, glyph: glyphForBuildPhase(phase as BuildPhase) }).toEqual({ phase, glyph });
    }
  });
});

describe('RunGlyph.css', () => {
  it('paints each state in its SPEC §4.7 colour', () => {
    expect(ruleBody('.ck-agent-glyph__ring')).toMatch(
      /stroke:\s*var\(--bldr-panel-border-strong\)/,
    );
    expect(ruleBody(".ck-agent-glyph[data-state='working'] .ck-agent-glyph__ring")).toMatch(
      /stroke:\s*var\(--bldr-accent-ring\)/,
    );
    expect(ruleBody('.ck-agent-glyph__arc')).toMatch(/stroke:\s*var\(--bldr-accent\)/);
    expect(ruleBody(".ck-agent-glyph[data-state='drafted'] .ck-agent-glyph__ring")).toMatch(
      /stroke:\s*var\(--bldr-accent\)/,
    );
    expect(ruleBody('.ck-agent-glyph__disc')).toMatch(/fill:\s*var\(--bldr-accent\)/);
    expect(ruleBody(".ck-agent-glyph[data-state='failed'] .ck-agent-glyph__disc")).toMatch(
      /fill:\s*var\(--bldr-danger\)/,
    );
    expect(ruleBody('.ck-agent-glyph__mark')).toMatch(/stroke:\s*var\(--bldr-accent-text\)/);
    expect(ruleBody('.ck-agent-glyph__badge-dot')).toMatch(/fill:\s*var\(--bldr-danger\)/);
    expect(ruleBody('.ck-agent-glyph__diamond')).toMatch(/stroke:\s*var\(--bldr-accent\)/);
    expect(ruleBody('.ck-agent-glyph__lines')).toMatch(/stroke:\s*var\(--bldr-panel-muted\)/);
  });

  it('rings every node in Paper, and lets a card re-point the ground', () => {
    expect(ruleBody('.ck-agent-glyph__ground')).toMatch(
      /fill:\s*var\(--ck-agent-ground,\s*var\(--bldr-panel\)\)/,
    );
  });

  it('turns the working arc every 900ms, clockwise, and holds it still under reduced motion', () => {
    expect(ruleBody('.ck-agent-glyph__spin')).toMatch(/animation:[^;]*900ms linear infinite/);
    const reduced = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(CSS)?.[1];
    expect(reduced).toMatch(/\.ck-agent-glyph__spin\s*\{\s*animation:\s*none;/);
  });

  it('keeps every state apart in forced colours', () => {
    const forced = /@media \(forced-colors: active\)\s*\{([\s\S]*?)\n\}/.exec(CSS)?.[1] ?? '';
    for (const color of ['Canvas', 'CanvasText', 'GrayText', 'Highlight', 'Mark']) {
      expect(forced).toContain(color);
    }
  });

  it('uses logical properties only', () => {
    expect(CSS).not.toMatch(
      /(^|[\s;{])(left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:|text-align:\s*(left|right)|translateX|scaleX/,
    );
  });
});
