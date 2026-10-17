import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';

import type { Locale } from '../../model/view-types';
import {
  buildBuilding,
  buildDone,
  spineRows,
  undoOf,
} from '../../testing/wp-12-records-fixtures';

import { SpineList } from './SpineList';

/* ── The panel's root, as AgentPanel draws it ─────────────────────────────── */

interface Frame {
  readonly locale?: Locale;
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

/**
 * One panel frame per story, drawn as AgentPanel draws its root: theme, language,
 * direction, and the `agent` inline-size container on an element with no padding, so a
 * container query sees the panel's width. The list spans a record body's two columns, so
 * the frame draws that body grid: the 16px glyph column, 8px, the text column.
 */
const inPanel: Decorator = (Story, { parameters }) => {
  const { locale = 'en', theme = 'light', width = 320 } = (parameters['panel'] ?? {}) as Frame;
  return (
    <div
      className="ck-agent"
      data-bldr-theme={theme}
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      style={{
        inlineSize: width,
        background: 'var(--bldr-panel)',
        color: 'var(--bldr-panel-text)',
        fontFamily: 'var(--bldr-font)',
        containerType: 'inline-size',
        containerName: 'agent',
      }}
    >
      <div style={{ padding: 'var(--bldr-space-3xl)' }}>
        <Story />
      </div>
    </div>
  );
};

/** Every state a row takes on a build's spine, in one list: the pencil, the light, the ink. */
function everyState(locale: Locale) {
  return spineRows(locale, [
    { state: 'landed', undo: undoOf(1) },
    { state: 'undone', undo: { kind: 'redo', transactionId: 'tx-undo-2' } },
    { state: 'failed', reason: 'outOfScope', canRetry: true },
    'retrying',
    'writing',
    'drafted',
    'waiting',
    { state: 'notWritten', offPage: true },
  ]);
}

/**
 * The forced-colors rules of the spine, read back from the page's stylesheets (Storybook
 * cannot switch Windows High Contrast on): the proof that each state keeps a distinct border
 * style there, in system colours.
 */
function forcedColorRules(): Map<string, string> {
  const found = new Map<string, string>();
  for (const sheet of document.styleSheets) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of rules) {
      if (!(rule instanceof CSSMediaRule) || !rule.conditionText.includes('forced-colors')) {
        continue;
      }
      for (const inner of rule.cssRules) {
        if (inner instanceof CSSStyleRule && inner.selectorText.includes('.ck-agent-segment')) {
          found.set(inner.selectorText, inner.style.cssText);
        }
      }
    }
  }
  return found;
}

function ruleFor(rules: Map<string, string>, state: string): string {
  for (const [selector, text] of rules) {
    if (selector.includes(`[data-state="${state}"]`) || selector.includes(`[data-state='${state}']`)) {
      return text;
    }
  }
  return '';
}

/** Replays the completion sweep on demand. */
function Sweep({ locale }: { readonly locale: Locale }) {
  const [sweep, setSweep] = useState(true);
  return (
    <div style={{ display: 'grid', gap: 'var(--bldr-space-3xl)' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'var(--bldr-space-3xl) minmax(0, 1fr)',
          columnGap: 'var(--bldr-space-md)',
        }}
      >
        <SpineList
          locale={locale}
          rows={buildDone(locale).rows}
          sweep={sweep}
          onSweepEnd={() => {
            setSweep(false);
          }}
        />
      </div>
      <button
        type="button"
        onClick={() => {
          setSweep(true);
        }}
      >
        Replay the sweep
      </button>
    </div>
  );
}

const meta = {
  title: 'Agent/Records/SpineList',
  component: SpineList,
  parameters: { layout: 'centered' },
  args: {
    locale: 'en',
    rows: buildBuilding('en').rows,
    onReveal: fn(),
    onPeek: fn(),
    onUndo: fn(),
    onRedo: fn(),
    onRetry: fn(),
  },
  argTypes: {
    locale: { control: 'inline-radio', options: ['en', 'ar'] },
  },
  decorators: [inPanel],
} satisfies Meta<typeof SpineList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** §3.4: pencil below, light where writers work, one draft waiting, ink at the top. */
export const Building: Story = {};

export const BuildingRightToLeft: Story = {
  args: { locale: 'ar', rows: buildBuilding('ar').rows },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
};

export const BuildingDark: Story = { parameters: { panel: { theme: 'dark' } } };

/** Every row state and every trailing action, at 420px where every state word shows. */
export const EveryState: Story = {
  args: { rows: everyState('en') },
  parameters: { panel: { width: 420 } },
};

export const EveryStateRightToLeft: Story = {
  args: { locale: 'ar', rows: everyState('ar') },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', width: 420 } },
};

export const EveryStateRightToLeftDark: Story = {
  args: { locale: 'ar', rows: everyState('ar') },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', width: 420, theme: 'dark' } },
};

/** The rows arrive in page order when the build lays the page out. */
export const Arrival: Story = {
  args: { rows: buildBuilding('en').rows, live: true, arrive: true },
};

/** The page is whole: one light passes down the unbroken stroke, once. */
export const CompletionSweep: Story = {
  render: () => <Sweep locale="en" />,
};

export const CompletionSweepDark: Story = {
  render: () => <Sweep locale="en" />,
  parameters: { panel: { theme: 'dark' } },
};

/**
 * The spine under `forced-colors: active` (Windows High Contrast). Emulate it in DevTools
 * (Rendering → Emulate CSS media feature forced-colors) to see it: pencil dashed GrayText,
 * writing dotted Highlight, drafted dotted CanvasText, ink 3px solid Highlight, failed dashed
 * Mark. The play reads those rules back from the stylesheet.
 */
export const ForcedColors: Story = {
  args: { rows: everyState('en') },
  parameters: { panel: { width: 420 } },
  play: async () => {
    const rules = forcedColorRules();
    await expect(ruleFor(rules, 'writing')).toMatch(/dotted/u);
    await expect(ruleFor(rules, 'writing')).toMatch(/highlight/iu);
    await expect(ruleFor(rules, 'drafted')).toMatch(/dotted/u);
    await expect(ruleFor(rules, 'drafted')).toMatch(/canvastext/iu);
    await expect(ruleFor(rules, 'ink')).toMatch(/solid/u);
    await expect(ruleFor(rules, 'failed')).toMatch(/dashed/u);
    await expect(ruleFor(rules, 'failed')).toMatch(/mark/iu);
  },
};
