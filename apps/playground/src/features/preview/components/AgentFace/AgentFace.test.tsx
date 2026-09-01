import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { AgentFace, type AgentFaceProps } from './AgentFace';
import { AgentVoice } from './AgentVoice';
import {
  agentMoodText,
  type AgentMood,
  type AgentMoodOutcome,
  type AgentMoodSnapshot,
  type AgentMoodVariant,
} from './agent-mood';

const CSS_SOURCE = readFileSync(
  join(process.cwd(), 'src', 'features', 'preview', 'components', 'AgentFace', 'AgentFace.css'),
  'utf8',
);
const DECLARATIONS = CSS_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '');

const MOODS: readonly AgentMood[] = [
  'idle',
  'listening',
  'thinking',
  'planning',
  'working',
  'done',
  'failed',
  'stopped',
];
const VARIANTS: readonly AgentMoodVariant[] = ['checking', 'repairing'];
const OUTCOMES: readonly AgentMoodOutcome[] = ['proposed', 'applied', 'planned', 'discarded'];

/** Every pose the face can hold, as props. */
const POSES: readonly AgentFaceProps[] = [
  { mood: 'idle' },
  { mood: 'listening' },
  { mood: 'listening', typing: true },
  { mood: 'thinking' },
  { mood: 'planning' },
  { mood: 'planning', variant: 'checking' },
  { mood: 'planning', variant: 'repairing' },
  { mood: 'working' },
  { mood: 'done', outcome: 'proposed' },
  { mood: 'done', outcome: 'applied' },
  { mood: 'done', outcome: 'planned' },
  { mood: 'done', outcome: 'discarded' },
  { mood: 'failed' },
  { mood: 'stopped' },
];

/** The mouth each pose lights up — the stylesheet must agree. */
const MOUTH_FOR: readonly (readonly [selector: string, mouth: string])[] = [
  ["[data-mood='idle']", 'flat'],
  ["[data-mood='listening']", 'short'],
  ["[data-mood='thinking']", 'flat'],
  ["[data-mood='planning']", 'pressed'],
  ["[data-mood='planning'][data-variant='checking']", 'flat'],
  ["[data-mood='planning'][data-variant='repairing']", 'frown-small'],
  ["[data-mood='working']", 'pressed'],
  ["[data-mood='done']", 'smirk'],
  ["[data-mood='done'][data-outcome='applied']", 'smile'],
  ["[data-mood='done'][data-outcome='discarded']", 'short'],
  ["[data-mood='failed']", 'frown'],
  ["[data-mood='stopped']", 'tilted'],
];

function face(container: HTMLElement): HTMLElement {
  const element = container.querySelector<HTMLElement>('.pg-face');
  if (element === null) throw new Error('no face rendered');
  return element;
}

/** Innermost `selector { body }` blocks, so a keyframe name inside `@keyframes` is not a rule. */
function rules(css: string): { selector: string; body: string }[] {
  return Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g), (match) => ({
    selector: (match[1] ?? '').trim(),
    body: match[2] ?? '',
  }));
}

afterEach(cleanup);

describe('AgentFace', () => {
  it('stamps every pose on the root as data attributes', () => {
    for (const pose of POSES) {
      const { container, unmount } = render(<AgentFace {...pose} />);
      const root = face(container);
      expect(root).toHaveAttribute('data-mood', pose.mood);
      expect(root).toHaveAttribute('data-size', 'md');
      expect(root).not.toHaveAttribute('data-live');
      if (pose.variant === undefined) expect(root).not.toHaveAttribute('data-variant');
      else expect(root).toHaveAttribute('data-variant', pose.variant);
      if (pose.outcome === undefined) expect(root).not.toHaveAttribute('data-outcome');
      else expect(root).toHaveAttribute('data-outcome', pose.outcome);
      if (pose.typing === true) expect(root).toHaveAttribute('data-typing');
      else expect(root).not.toHaveAttribute('data-typing');
      unmount();
    }
  });

  it('exposes size and live as attributes, and only stamps variant/outcome where they apply', () => {
    const { container, rerender } = render(<AgentFace mood="planning" size="sm" live />);
    expect(face(container)).toHaveAttribute('data-size', 'sm');
    expect(face(container)).toHaveAttribute('data-live');
    rerender(<AgentFace mood="idle" size="lg" variant="checking" outcome="applied" />);
    expect(face(container)).toHaveAttribute('data-size', 'lg');
    expect(face(container)).not.toHaveAttribute('data-variant');
    expect(face(container)).not.toHaveAttribute('data-outcome');
    rerender(<AgentFace mood="idle" className="extra" />);
    expect(face(container)).toHaveClass('pg-face', 'extra');
  });

  it('is decorative: the svg is hidden, unfocusable, and renders no text', () => {
    const { container } = render(<AgentFace mood="thinking" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
    expect(container.textContent).toBe('');
    // Every feature is always in the DOM: moods select, they never swap.
    expect(container.querySelectorAll('.pg-face__mouth')).toHaveLength(8);
    expect(container.querySelectorAll('.pg-face__eye')).toHaveLength(2);
    expect(container.querySelectorAll('.pg-face__brow')).toHaveLength(2);
    expect(container.querySelector('.pg-face__ring')).toHaveAttribute('pathLength', '100');
  });

  it('never moves focus, on mount or through every mood', () => {
    const { rerender } = render(<AgentFace mood="idle" live />);
    expect(document.body).toHaveFocus();
    for (const pose of POSES) {
      rerender(<AgentFace {...pose} live />);
      expect(document.body).toHaveFocus();
    }
  });

  it('gives every pose its own geometry in the stylesheet', () => {
    for (const mood of MOODS) expect(DECLARATIONS).toContain(`.pg-face[data-mood='${mood}']`);
    for (const variant of VARIANTS) expect(DECLARATIONS).toContain(`[data-variant='${variant}']`);
    for (const outcome of OUTCOMES) expect(DECLARATIONS).toContain(`[data-outcome='${outcome}']`);
    const lit = rules(DECLARATIONS).filter(({ body }) => /opacity:\s*1\b/.test(body));
    for (const [selector, mouth] of MOUTH_FOR) {
      const rule = lit.find(
        ({ selector: s }) => s === `.pg-face${selector} .pg-face__mouth--${mouth}`,
      );
      expect(rule, `${selector} lights mouth--${mouth}`).toBeDefined();
    }
    // The tick belongs to the power-symbol ring alone.
    const tick = lit.filter(({ selector }) => selector.includes('pg-face__tick'));
    expect(tick.map(({ selector }) => selector)).toEqual([
      ".pg-face[data-mood='stopped'] .pg-face__tick",
    ]);
  });

  it('styles itself from chrome tokens only, never a literal colour', () => {
    expect(DECLARATIONS).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(DECLARATIONS).not.toMatch(/\b(rgba?|hsla?)\(/);
    expect(DECLARATIONS).toMatch(/var\(--bldr-/);
    expect(DECLARATIONS).not.toMatch(/var\(--t-/);
  });

  it('uses logical properties and explicit transitions', () => {
    expect(DECLARATIONS).not.toMatch(/transition:\s*all/);
    expect(DECLARATIONS).not.toMatch(/margin-(left|right)|padding-(left|right)/);
    expect(DECLARATIONS).not.toMatch(/\sleft:|\sright:/);
  });

  it('keeps motion namespaced, opt-in, and off for bubbles and reduced motion', () => {
    for (const match of DECLARATIONS.matchAll(/@keyframes\s+([\w-]+)/g)) {
      expect(match[1]).toMatch(/^pg-face-/);
    }
    // Loops and one-shots only under data-live.
    for (const { selector, body } of rules(DECLARATIONS)) {
      if (/animation:\s*pg-face-/.test(body)) {
        expect(selector, selector).toContain('[data-live]');
      }
    }
    expect(DECLARATIONS).toMatch(/\.pg-face\[data-size='sm'\]\s*\*\s*\{[^}]*animation:\s*none/);
    const reduced = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(
      DECLARATIONS,
    );
    expect(reduced).not.toBeNull();
    expect(reduced?.[1]).toMatch(/animation:\s*none/);
    expect(reduced?.[1]).toMatch(/transition:\s*none/);
  });

  it('draws the ring in only for the solid done outcomes', () => {
    const drawn = rules(DECLARATIONS).filter(({ body }) => body.includes('pg-face-draw'));
    expect(drawn.length).toBeGreaterThan(0);
    for (const { selector } of drawn) {
      expect(selector).toMatch(/\[data-outcome='(proposed|applied)'\]/);
    }
  });
});

function snapshot(
  line: AgentMoodSnapshot['line'],
  rest: Partial<Omit<AgentMoodSnapshot, 'line'>> = {},
): AgentMoodSnapshot {
  return { mood: 'idle', typing: false, since: 0, ...rest, line };
}

describe('AgentVoice', () => {
  it('is the one polite, atomic status line, Arabic by default and English on request', () => {
    const idle = snapshot({ key: 'idle' });
    const { rerender } = render(<AgentVoice snapshot={idle} />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('aria-atomic', 'true');
    expect(status).toHaveAttribute('lang', 'ar');
    expect(status).toHaveAttribute('dir', 'auto');
    expect(status).toHaveClass('pg-face-voice');
    expect(status).toHaveTextContent(agentMoodText(idle, 'ar'));
    rerender(<AgentVoice snapshot={idle} locale="en" className="pg-chat__voice" />);
    expect(status).toHaveAttribute('lang', 'en');
    expect(status).toHaveTextContent(agentMoodText(idle, 'en'));
    expect(status).toHaveClass('pg-face-voice', 'pg-chat__voice');
    expect(document.body).toHaveFocus();
  });

  it('says the same thing while idle, listening and typing', () => {
    const idle = snapshot({ key: 'idle' });
    const listening = snapshot({ key: 'idle' }, { mood: 'listening' });
    const typing = snapshot({ key: 'idle' }, { mood: 'listening', typing: true });
    for (const locale of ['ar', 'en'] as const) {
      const text = agentMoodText(idle, locale);
      expect(agentMoodText(listening, locale)).toBe(text);
      expect(agentMoodText(typing, locale)).toBe(text);
    }
    expect(agentMoodText(idle, 'en')).toBe('Say what you want. Skip the preamble.');
  });

  it('renders the failure branch by retryability', () => {
    const retryable = snapshot({ key: 'failed.retryable' }, { mood: 'failed' });
    const final = snapshot({ key: 'failed.final' }, { mood: 'failed' });
    const { rerender } = render(<AgentVoice snapshot={retryable} locale="en" />);
    expect(screen.getByRole('status')).toHaveTextContent("Didn't go through. Try again.");
    rerender(<AgentVoice snapshot={final} locale="en" />);
    expect(screen.getByRole('status')).toHaveTextContent("Not doing that. Reason's below.");
    rerender(<AgentVoice snapshot={final} />);
    expect(screen.getByRole('status')).toHaveTextContent('مش رح أعملها. السبب تحت.');
  });

  it('interpolates the block type and the repair count', () => {
    const subject = snapshot(
      { key: 'thinking.subject', subject: 'the pricing block' },
      { mood: 'thinking' },
    );
    const { rerender } = render(<AgentVoice snapshot={subject} locale="en" />);
    expect(screen.getByRole('status')).toHaveTextContent('Reading the pricing block.');
    rerender(<AgentVoice snapshot={subject} />);
    expect(screen.getByRole('status')).toHaveTextContent('عم أقرا بلوك pricing.');
    rerender(
      <AgentVoice
        snapshot={snapshot({ key: 'repairing', n: 1 }, { mood: 'planning', variant: 'repairing' })}
        locale="en"
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Found a flaw. Fixing it.');
    rerender(
      <AgentVoice
        snapshot={snapshot({ key: 'repairing', n: 3 }, { mood: 'planning', variant: 'repairing' })}
        locale="en"
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Found 3 flaws. Fixing them.');
  });
});
