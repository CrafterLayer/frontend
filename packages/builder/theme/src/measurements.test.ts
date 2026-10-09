import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * EVERY measurement comes from the theme.
 *
 * The sibling gate (`coverage.test.ts`) proves that every token a component
 * READS is one the theme defines. This is the other half, and the one a person
 * actually feels: that a component does not measure anything on its own. A
 * `0.5rem` radius or a `28px` control cannot be re-pointed by a host, so a
 * single literal is a hole in the promise that the whole editor can be
 * re-themed at runtime — and holes of exactly this kind were found in the
 * floating chrome, where the bubble's hit targets were `1.75rem` and therefore
 * decided by the root font size of a document the editor does not control.
 *
 * Two exemptions, both structural rather than convenient:
 *
 *  - `0` needs no token; a token for nothing is noise.
 *  - MEDIA AND CONTAINER QUERY CONDITIONS. A query condition cannot read a
 *    custom property — the cascade has not run when the condition is
 *    evaluated — so a breakpoint physically cannot be a token, whether it
 *    measures the viewport or the panel a component sits in. They are the one
 *    place a raw length is forced, and they are kept few and named in a comment.
 *
 * The generated stylesheet is excluded because it is where the values live.
 */

const BUILDER_ROOT = join(process.cwd(), '..');

/**
 * The EDITOR's chrome. Deliberately not the whole workspace.
 *
 * A block's stylesheet paints the PAGE, and the page carries its own theme
 * (`--t-*`) precisely so that an author working on a dark site is not forced
 * into a dark editor and a dark editor never repaints their light page. Making
 * block styles read `--bldr-*` would collapse that separation, so those files
 * are a separate unification with a separate token set — recorded as such, not
 * quietly folded in here.
 */
const CHROME_ROOTS = [
  join(BUILDER_ROOT, 'shell', 'src'),
  join(BUILDER_ROOT, 'editor', 'src'),
  join(BUILDER_ROOT, 'extensions', 'code-view', 'src'),
];
const PAGE_STYLESHEET_ROOT = join(BUILDER_ROOT, 'editor', 'src', 'components', 'Page');

/** `src/css/chrome.css` IS the token file — the literals belong to it. */
const GENERATED = join('theme', 'src', 'css', 'chrome.css');

function stylesheets(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      // `coverage/` holds generated HTML reports, not source.
      if (entry === 'node_modules' || entry === 'dist' || entry === 'coverage') {
        continue;
      }
      const full = join(dir, entry);
      // The preset's Page component renders document content and has its own
      // `--t-*` vocabulary gate; it is not editor chrome.
      if (full === PAGE_STYLESHEET_ROOT) {
        continue;
      }
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (entry.endsWith('.css') && !full.includes(GENERATED)) {
        found.push(full);
      }
    }
  };
  walk(root);
  return found;
}

/** Declarations only: the media-query condition is a different question. */
function declarationsOf(css: string): string {
  return css
    .replaceAll(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^@(?:media|container)\b/u.test(line.trimStart()))
    .join('\n');
}

const RAW_LENGTH = /(?<![\w-])(\d+(?:\.\d+)?)(px|rem)(?![\w-])/g;

function rawMeasurements(file: string): string[] {
  const declarations = declarationsOf(readFileSync(file, 'utf8'));
  return [...declarations.matchAll(RAW_LENGTH)]
    .map((match) => match[0])
    .filter((measurement) => !measurement.startsWith('0'));
}

describe('every measurement in the builder comes from the theme', () => {
  const files = CHROME_ROOTS.flatMap((root) => stylesheets(root));

  it('finds the stylesheets it is meant to police', () => {
    // Non-vacuous: a broken walk would pass this whole suite in silence.
    expect(files.length).toBeGreaterThan(15);
    expect(files.some((file) => file.includes('shell'))).toBe(true);
  });

  it('declares no raw px or rem outside the generated token sheet', () => {
    const offenders = files
      .map((file) => ({ file: file.replace(BUILDER_ROOT, ''), found: rawMeasurements(file) }))
      .filter((entry) => entry.found.length > 0)
      .map((entry) => `${entry.file}: ${entry.found.join(', ')}`);

    expect(offenders).toEqual([]);
  });
});

/**
 * The generated sheet, read as `name → value` per block. Parsed from the
 * checked-in file rather than rebuilt, because the FILE is what the shell's
 * components load; `css.test.ts` separately proves the file equals the
 * generator's output.
 */
const CHROME_CSS = readFileSync(join(process.cwd(), 'src', 'css', 'chrome.css'), 'utf8');

function blockOf(css: string, header: string): string {
  const start = css.indexOf(`${header} {`);
  if (start === -1) {
    throw new Error(`chrome.css opens no block with ${JSON.stringify(header)}`);
  }
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === '{') {
      depth += 1;
    } else if (css[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return css.slice(open + 1, index);
      }
    }
  }
  throw new Error(`the block opened by ${JSON.stringify(header)} never closes`);
}

function declared(body: string): Map<string, string> {
  return new Map(
    [...body.matchAll(/--bldr-([a-z0-9-]+):\s*([^;]+);/g)].map((match) => [
      match[1] ?? '',
      match[2] ?? '',
    ]),
  );
}

/**
 * EVERY size token the shell was measured against before the agent panel's
 * tokens (design SPEC §2) arrived, copied from the generated sheet at that
 * point. The panel brings its OWN reading scale and bands precisely so that
 * none of these move: the rail, inspector, top bar, and every `micro…display`
 * label were laid out against these numbers. The one planned change,
 * `assistant-width`, is SPEC §2.7's and is asserted on its own below.
 */
const MEASURED_BEFORE_THE_AGENT_PANEL: Readonly<Record<string, string>> = {
  'space-0': '0',
  'space-2xs': '2px',
  'space-xs': '4px',
  'space-sm': '6px',
  'space-md': '8px',
  'space-lg': '10px',
  'space-xl': '12px',
  'space-2xl': '14px',
  'space-3xl': '16px',
  'space-4xl': '20px',
  'space-5xl': '24px',
  'space-6xl': '32px',
  'radius-none': '0',
  'radius-xs': '4px',
  'radius-sm': '6px',
  'radius-md': '7px',
  'radius-lg': '9px',
  'radius-xl': '12px',
  'radius-full': '999px',
  'border-hairline': '1px',
  'border-thick': '2px',
  'border-focus': '3px',
  'control-sm': '28px',
  'control-md': '32px',
  'control-lg': '36px',
  'measure-page': '1152px',
  'measure-dock': '288px',
  'measure-picker': '208px',
  'font-size-micro': '10.5px',
  'font-size-caption': '11.5px',
  'font-size-body': '12.5px',
  'font-size-control': '13px',
  'font-size-title': '14px',
  'font-size-display': '15px',
  'font-weight-regular': '400',
  'font-weight-medium': '500',
  'font-weight-semibold': '600',
  'font-weight-bold': '700',
  'line-height-tight': '1.2',
  'line-height-snug': '1.4',
  'line-height-normal': '1.55',
  'duration-state': '120ms',
  'duration-move': '180ms',
  easing: 'cubic-bezier(0.2, 0, 0.13, 1)',
  'rail-width': '68px',
  'panel-width': '288px',
  'inspector-width': '312px',
  'topbar-height': '56px',
  'statusbar-height': '36px',
  'dock-min-height': '240px',
  'canvas-gutter': '24px',
  'panel-padding': '14px',
  'control-height': '32px',
  'control-height-sm': '28px',
  'thumb-width': '144px',
  'hit-target-min': '44px',
};

const COMPACT_BEFORE_THE_AGENT_PANEL: Readonly<Record<string, string>> = {
  'rail-width': '56px',
  'panel-width': '248px',
  'inspector-width': '272px',
  'topbar-height': '48px',
  'statusbar-height': '30px',
  'dock-min-height': '200px',
  'canvas-gutter': '16px',
  'panel-padding': '10px',
  'control-height': '28px',
  'control-height-sm': '24px',
  'thumb-width': '124px',
  'hit-target-min': '44px',
};

describe('the agent panel measures itself without moving the shell (design SPEC §2)', () => {
  const root = declared(blockOf(CHROME_CSS, '\n:root'));
  const compact = declared(blockOf(CHROME_CSS, "\n[data-bldr-density='compact']"));
  const coarse = declared(blockOf(blockOf(CHROME_CSS, '\n@media (pointer: coarse)'), ':root'));

  it('leaves every existing chrome size token exactly as the shell measured it', () => {
    // Non-vacuous: the frozen table is the whole pre-panel scale, not a sample.
    expect(Object.keys(MEASURED_BEFORE_THE_AGENT_PANEL)).toHaveLength(56);
    const moved = Object.entries(MEASURED_BEFORE_THE_AGENT_PANEL)
      .filter(([name, value]) => root.get(name) !== value)
      .map(([name, value]) => `${name}: ${value} → ${root.get(name) ?? '(gone)'}`);
    expect(moved).toEqual([]);

    const movedCompact = Object.entries(COMPACT_BEFORE_THE_AGENT_PANEL)
      .filter(([name, value]) => compact.get(name) !== value)
      .map(([name, value]) => `${name}: ${value} → ${compact.get(name) ?? '(gone)'}`);
    expect(movedCompact).toEqual([]);
  });

  it('sizes the panel band at 320 comfortable and 288 compact, resizable from 288 to 480', () => {
    expect(root.get('assistant-width')).toBe('320px');
    expect(compact.get('assistant-width')).toBe('288px');
    expect(root.get('assistant-width-min')).toBe('288px');
    expect(root.get('assistant-width-max')).toBe('480px');
  });

  it('keeps the resize bounds out of the density block, so density cannot unclamp them', () => {
    // Both densities share one range (SPEC §2.7). Declaring it again per density
    // would make a host's override on the root lose to the density attribute
    // on a nearer element.
    expect(compact.has('assistant-width-min')).toBe(false);
    expect(compact.has('assistant-width-max')).toBe(false);
  });

  it('gives the panel a 44px header, a 40px RunBar and 32px rows at a fine pointer', () => {
    expect(root.get('agent-header-height')).toBe('44px');
    expect(root.get('agent-runbar-height')).toBe('40px');
    expect(root.get('agent-row-height')).toBe('32px');
  });

  it('raises the RunBar to 52 and rows to 44 at a coarse pointer, and nothing in the header', () => {
    expect(coarse.get('agent-runbar-height')).toBe('52px');
    expect(coarse.get('agent-row-height')).toBe('44px');
    // 44 is already a touch target; the phone sheet's 56px header is AgentSheet's own.
    expect(coarse.has('agent-header-height')).toBe(false);
  });

  it('never lets density re-declare a pointer-driven band', () => {
    /*
      The coarse block sets these on :root. `BuilderTheme` stamps the density
      attribute on its OWN element, which sits below :root, so if the density
      block declared them too, the nearer declaration would win by inheritance
      and a phone in compact density would get 32px rows under a thumb.
    */
    for (const name of ['agent-runbar-height', 'agent-row-height', 'agent-header-height']) {
      expect({ name, inCompact: compact.has(name) }).toEqual({ name, inCompact: false });
    }
  });
});
