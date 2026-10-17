/**
 * The panel's icon set (SPEC §4.21). Three promises, each one a bug the v1 panel shipped:
 * - glyphs are static JSX, never `dangerouslySetInnerHTML`: v1 built a fresh `{ __html }`
 *   object per render, React rewrote the glyph's innerHTML, and a re-render between
 *   pointerdown and pointerup replaced the node under the pointer, so the first press on
 *   Send was lost (visual audit P0-1);
 * - a glyph is the same DOM node for the life of its button;
 * - directional glyphs, and only those, mirror under RTL (SPEC §4.21's two lists).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AgentIcon } from './AgentIcon';
import { AGENT_ICON_NAMES, ICONS, type AgentIconName } from './icon-paths';

const HERE = join(process.cwd(), 'src', 'features', 'agent', 'components', 'AgentIcon');
const read = (file: string): string => readFileSync(join(HERE, file), 'utf8');
const CSS = read('AgentIcon.css').replace(/\/\*[\s\S]*?\*\//g, '');

/** SPEC §4.21: "Directional icons carry `data-mirror`, flipped under `:dir(rtl)`". */
const MIRRORED: readonly AgentIconName[] = [
  'disclosure',
  'arrowEnd',
  'undo',
  'redo',
  'back',
  'queue',
  'showPage',
  'backToChat',
];
/** SPEC §4.21: "Never mirrored: send ↑, stop ■, clock, spinner (always clockwise), the drag handle." */
const NEVER_MIRRORED: readonly AgentIconName[] = ['send', 'stop', 'history', 'spinner', 'grip'];

function svgOf(container: HTMLElement): SVGSVGElement {
  const svg = container.querySelector('svg');
  if (svg === null) throw new Error('no svg rendered');
  return svg;
}

describe('AgentIcon', () => {
  it('draws every icon on the 16px grid: 1.5 stroke, round caps, currentColor, hidden', () => {
    for (const name of AGENT_ICON_NAMES) {
      const { container, unmount } = render(<AgentIcon name={name} />);
      const svg = svgOf(container);
      expect(svg).toHaveAttribute('data-icon', name);
      expect(svg).toHaveAttribute('width', '16');
      expect(svg).toHaveAttribute('height', '16');
      expect(svg).toHaveAttribute('viewBox', '0 0 16 16');
      expect(svg).toHaveAttribute('stroke', 'currentColor');
      expect(svg).toHaveAttribute('stroke-width', '1.5');
      expect(svg).toHaveAttribute('stroke-linecap', 'round');
      expect(svg).toHaveAttribute('stroke-linejoin', 'round');
      expect(svg).toHaveAttribute('fill', 'none');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
      expect(svg).toHaveAttribute('focusable', 'false');
      expect(svg.childElementCount).toBeGreaterThan(0);
      unmount();
    }
  });

  it('paints only with currentColor, so the button it sits in decides its colour', () => {
    for (const name of AGENT_ICON_NAMES) {
      const { container, unmount } = render(<AgentIcon name={name} />);
      for (const element of svgOf(container).querySelectorAll('*')) {
        for (const attribute of ['fill', 'stroke']) {
          const value = element.getAttribute(attribute);
          if (value !== null)
            expect([name, value]).toEqual([name, expect.stringMatching(/^(currentColor|none)$/)]);
        }
      }
      unmount();
    }
  });

  it('never writes markup as a string: the glyphs are static JSX', () => {
    for (const file of ['AgentIcon.tsx', 'icon-paths.tsx']) {
      const source = read(file).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      expect({ file, html: source.includes('dangerouslySetInnerHTML') }).toEqual({
        file,
        html: false,
      });
      expect({ file, html: source.includes('__html') }).toEqual({ file, html: false });
    }
  });

  it('keeps the same DOM nodes across renders', () => {
    const { container, rerender } = render(<AgentIcon name="send" className="first" />);
    const svg = svgOf(container);
    const shapes = [...svg.children];

    rerender(<AgentIcon name="send" className="second" />);
    rerender(<AgentIcon name="send" />);

    expect(svgOf(container)).toBe(svg);
    expect([...svg.children]).toEqual(shapes);
    for (const shape of shapes) expect(shape.isConnected).toBe(true);
  });

  it('marks exactly the directional icons for mirroring', () => {
    const mirrored = AGENT_ICON_NAMES.filter((name) => ICONS[name].mirror);
    expect([...mirrored].sort()).toEqual([...MIRRORED].sort());
    for (const name of NEVER_MIRRORED) expect(ICONS[name].mirror).toBe(false);

    for (const name of AGENT_ICON_NAMES) {
      const { container, unmount } = render(<AgentIcon name={name} />);
      if (MIRRORED.includes(name)) expect(svgOf(container)).toHaveAttribute('data-mirror');
      else expect(svgOf(container)).not.toHaveAttribute('data-mirror');
      unmount();
    }
  });

  it('flips data-mirror under :dir(rtl) with the scale property, leaving transform free', () => {
    // Individual `scale`, not `transform: scaleX(-1)`: a disclosure that rotates its
    // chevron with `transform` keeps both, and still points the right way in RTL.
    const rule = /\[data-mirror\]:dir\(rtl\)\s*\{([^}]*)\}/.exec(CSS);
    expect(rule?.[1]).toMatch(/(^|;|\s)scale:\s*-1 1\s*;/);
    expect(CSS).not.toMatch(/scaleX|translateX|(^|[^-])transform:\s*scale/);
  });

  it('spins the spinner clockwise, and holds it still under reduced motion', () => {
    expect(CSS).toMatch(/\[data-icon='spinner'\]\s*\{[^}]*animation:[^}]*linear infinite/);
    const reduced = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(CSS);
    expect(reduced?.[1]).toMatch(/\[data-icon='spinner'\]\s*\{\s*animation:\s*none;/);
  });

  it('uses logical properties only', () => {
    expect(CSS).not.toMatch(
      /(^|[\s;{])(left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:|text-align:\s*(left|right)/,
    );
  });
});
