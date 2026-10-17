import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';

import { t } from '../../copy';
import type { Locale } from '../../model/view-types';

import { AgentTooltipProvider } from './AgentTooltipProvider';
import { IconButton } from './IconButton';

/* ── The panel's root, as AgentPanel draws it ─────────────────────────────── */

interface Frame {
  readonly locale?: Locale;
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

/**
 * One panel frame per story, drawn as AgentPanel draws its root: theme, language,
 * direction, and the `agent` inline-size container on an element with no padding, so a
 * container query sees the panel's width. A story picks its frame with
 * `parameters.panel`; a story-level decorator would nest a second frame inside this one.
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
      <div
        style={{
          minBlockSize: 160,
          padding: 'var(--bldr-space-3xl)',
        }}
      >
        <AgentTooltipProvider>
          <Story />
        </AgentTooltipProvider>
      </div>
    </div>
  );
};

/* ── A real pointer, when the story runs under Vitest's browser mode ─────── */

/* The first-click bug lived between a real pointerdown and pointerup, so the regression
   story presses with Playwright's mouse when it can (the storybook test task). In the
   Storybook UI there is none; the play falls back to a synthetic press, and your own
   pointer is the real test. */
interface RealPointer {
  click(element: Element): Promise<void>;
}

async function realPointer(): Promise<RealPointer | null> {
  if (!('__vitest_browser__' in globalThis)) return null;
  const { userEvent: browserUserEvent } = await import('vitest/browser');
  return browserUserEvent;
}

/* ── The header's two actions (SPEC §4.2) ─────────────────────────────────── */

function HeaderActions({ locale, running = false }: { locale: Locale; running?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--bldr-space-xs)',
        blockSize: 'var(--bldr-agent-header-height)',
      }}
    >
      <span style={{ flex: 1, fontWeight: 600 }}>{t(locale, 'header.name')}</span>
      <IconButton
        icon="history"
        label={t(locale, 'header.conversations')}
        aria-haspopup="dialog"
        aria-expanded={false}
      />
      <IconButton
        icon="plus"
        label={t(locale, 'header.new')}
        tooltipAlign="end"
        unavailable={running}
        hint={running ? t(locale, 'header.new.busy') : undefined}
      />
    </div>
  );
}

/** Focusing a button opens its tooltip, which says exactly the button's accessible name. */
async function expectTooltipIsName(canvasElement: HTMLElement, name: string): Promise<void> {
  const canvas = within(canvasElement);
  const button = canvas.getByRole('button', { name });
  button.focus();
  const tooltip = await waitFor(() => {
    const found = within(canvasElement).getByRole('tooltip');
    return found;
  });
  await expect(tooltip.textContent.startsWith(name)).toBe(true);
  await expect(button).toHaveAccessibleName(name);
}

const meta = {
  title: 'Agent/Primitives/IconButton',
  component: IconButton,
  parameters: { layout: 'centered' },
  args: { icon: 'history', label: 'Conversations' },
  decorators: [inPanel],
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** At rest: a ghost, Graphite glyph. Hover lays the Wash under an Ink glyph, never Indigo. */
export const Rest: Story = {};

export const WithTooltip: Story = {
  play: async ({ canvasElement }) => {
    await expectTooltipIsName(canvasElement, 'Conversations');
  },
};

/** Unavailable: focusable, explained by a second tooltip line, and a press does nothing. */
export const Unavailable: Story = {
  args: {
    icon: 'plus',
    label: t('en', 'header.new'),
    hint: t('en', 'header.new.busy'),
    unavailable: true,
  },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'New conversation' });
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await expect(button).toHaveAccessibleDescription(t('en', 'header.new.busy'));
    await expectTooltipIsName(canvasElement, 'New conversation');
  },
};

/** A toggle that is on: the proposal's Preview. Mist under Indigo deep, the active option. */
export const Pressed: Story = {
  args: { icon: 'preview', label: t('en', 'proposal.preview'), pressed: true },
};

export const Header: Story = {
  render: () => <HeaderActions locale="en" />,
};

export const HeaderRunning: Story = {
  render: () => <HeaderActions locale="en" running />,
};

export const HeaderDark: Story = {
  render: () => <HeaderActions locale="en" />,
  parameters: { panel: { theme: 'dark' } },
};

/** Arabic, right to left: the actions sit at the inline end, now the left. */
export const HeaderRightToLeft: Story = {
  render: () => <HeaderActions locale="ar" running />,
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
  play: async ({ canvasElement }) => {
    await expectTooltipIsName(canvasElement, t('ar', 'header.conversations'));
    const tooltip = within(canvasElement).getByRole('tooltip').closest('.ck-agent-tooltip');
    // Mounted inside the panel: the Arabic tokens and the panel's theme reach it.
    await expect(canvasElement.querySelector('.ck-agent')).toContainElement(tooltip as HTMLElement);
    await expect(tooltip).toHaveAttribute('lang', 'ar');
  },
};

export const HeaderRightToLeftDark: Story = {
  render: () => <HeaderActions locale="ar" />,
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', theme: 'dark' } },
};

/* ── The regression (visual audit P0-1) ──────────────────────────────────── */

/** A composer that re-renders as its textarea blurs, around the Send slot. */
function ComposerProbe() {
  const [focused, setFocused] = useState(false);
  const [sent, setSent] = useState(0);
  return (
    <div style={{ display: 'grid', gap: 'var(--bldr-space-md)' }}>
      <textarea
        aria-label={t('en', 'input.aria')}
        rows={2}
        onFocus={() => {
          setFocused(true);
        }}
        onBlur={() => {
          setFocused(false);
        }}
        style={{ font: 'inherit', resize: 'none' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--bldr-space-md)' }}>
        <IconButton
          icon="send"
          label={t('en', 'send')}
          className={focused ? 'is-focused' : 'is-blurred'}
          onClick={() => {
            setSent((count) => count + 1);
          }}
        />
        <span data-sent={sent} style={{ color: 'var(--bldr-panel-text-soft)' }}>
          {sent}
        </span>
      </div>
    </div>
  );
}

/** v1's Send slot, rebuilt as the control: a fresh `{ __html }` object every render. */
function V1ComposerProbe() {
  const [focused, setFocused] = useState(false);
  const [sent, setSent] = useState(0);
  return (
    <div style={{ display: 'grid', gap: 'var(--bldr-space-md)' }}>
      <textarea
        aria-label={t('en', 'input.aria')}
        rows={2}
        onFocus={() => {
          setFocused(true);
        }}
        onBlur={() => {
          setFocused(false);
        }}
        style={{ font: 'inherit', resize: 'none' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--bldr-space-md)' }}>
        <button
          type="button"
          aria-label={t('en', 'send')}
          className={focused ? 'is-focused' : 'is-blurred'}
          onClick={() => {
            setSent((count) => count + 1);
          }}
          style={{
            display: 'grid',
            placeItems: 'center',
            inlineSize: 32,
            blockSize: 32,
            padding: 0,
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: '<path d="M8 13V3M3.5 7.5 8 3l4.5 4.5"/>' }}
          />
        </button>
        <span data-sent={sent} style={{ color: 'var(--bldr-panel-text-soft)' }}>
          {sent}
        </span>
      </div>
    </div>
  );
}

/**
 * The control: v1's button under the same real press. Its glyph is rewritten as the field
 * blurs, the node under the pointer is gone by pointerup, and Chromium fires no click. This
 * story is what shows `FirstClickAfterBlur` can see the bug it guards against.
 */
export const V1LosesTheFirstClick: Story = {
  render: () => <V1ComposerProbe />,
  play: async ({ canvasElement }) => {
    const pointer = await realPointer();
    // Only a real pointer reproduces the browser's click targeting; the UI has none.
    if (pointer === null) return;
    const canvas = within(canvasElement);
    await pointer.click(canvas.getByRole('textbox', { name: t('en', 'input.aria') }));
    await pointer.click(canvas.getByRole('button', { name: t('en', 'send') }));
    await expect(canvasElement.querySelector('[data-sent]')).toHaveAttribute('data-sent', '0');
  },
};

/**
 * Type in the field, then press Send once. The field blurs on pointerdown and the composer
 * re-renders before pointerup; the glyph under the pointer must survive that, or the press
 * is lost. v1 lost it (its glyph was rewritten through `dangerouslySetInnerHTML`).
 */
export const FirstClickAfterBlur: Story = {
  render: () => <ComposerProbe />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole('textbox', { name: t('en', 'input.aria') });
    const send = canvas.getByRole('button', { name: t('en', 'send') });
    const pointer = await realPointer();
    if (pointer === null) {
      await userEvent.click(field);
      await userEvent.click(send);
    } else {
      await pointer.click(field);
      await expect(send).toHaveClass('is-focused');
      await pointer.click(send);
    }
    await expect(canvasElement.querySelector('[data-sent]')).toHaveAttribute('data-sent', '1');
  },
};
