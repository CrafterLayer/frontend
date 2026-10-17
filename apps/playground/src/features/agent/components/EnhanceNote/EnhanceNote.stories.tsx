import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import { t } from '../../copy';
import type { EnhancementView, Locale } from '../../model/view-types';
import { enhancement, IMPROVED_DRAFT, ROUGH_DRAFT } from '../../testing/wp-14-composer-fixtures';

import { EnhanceNote } from './EnhanceNote';

/* ── The panel's root, as AgentPanel draws it ─────────────────────────────── */

interface Frame {
  readonly locale?: Locale;
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
  /** The words under the note: the rewrite it describes, or the text Improve could not touch. */
  readonly draft?: 'improved' | 'rough';
}

/**
 * One panel frame per story, with the note where it lives: at the top of the composer's
 * writing area, over the draft it describes.
 */
const inPanel: Decorator = (Story, { parameters }) => {
  const {
    locale = 'en',
    theme = 'light',
    width = 320,
    draft = 'improved',
  } = (parameters['panel'] ?? {}) as Frame;
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
      <div style={{ padding: 'var(--bldr-space-4xl) var(--bldr-space-md) var(--bldr-space-md)' }}>
        <div
          style={{
            display: 'grid',
            rowGap: 'var(--bldr-space-xs)',
            padding: 7,
            border: 'var(--bldr-border-hairline) solid var(--bldr-panel-border-strong)',
            borderRadius: 'var(--bldr-radius-xl)',
            background: 'var(--bldr-surface)',
          }}
        >
          <Story />
          <p
            style={{
              margin: 0,
              fontSize: 'var(--bldr-font-size-input)',
              lineHeight: 'var(--bldr-line-height-input)',
              minBlockSize: 'calc(2 * var(--bldr-line-height-input))',
            }}
          >
            {draft === 'improved' ? IMPROVED_DRAFT[locale] : ROUGH_DRAFT[locale]}
          </p>
        </div>
      </div>
    </div>
  );
};

/** The English improved note, with one field changed. */
function enhanced(patch: {
  readonly canRestore?: boolean;
  readonly changes?: readonly string[];
}): EnhancementView {
  const base = enhancement('en', 'enhanced');
  return base.status === 'enhanced' ? { ...base, ...patch } : base;
}

const meta = {
  title: 'Agent/Composer/EnhanceNote',
  component: EnhanceNote,
  parameters: { layout: 'centered' },
  args: { locale: 'en', enhancement: enhancement('en', 'enhanced'), onRestore: fn() },
  decorators: [inPanel],
} satisfies Meta<typeof EnhanceNote>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Improved: "Request improved" with Restore my text at the inline end, what was understood
 * under it, and what changed behind a disclosure.
 */
export const Enhanced: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    // The note fades in: visible once its entrance has run.
    await waitFor(() =>
      expect(canvas.getByRole('group', { name: t('en', 'enhance.done') })).toBeVisible(),
    );
    await userEvent.click(canvas.getByRole('button', { name: t('en', 'enhance.restore') }));
    await expect(args.onRestore).toHaveBeenCalledTimes(1);
  },
};

/** The changes, open: a short list in the UI's language. */
export const ChangesOpen: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('button', { name: 'Show changes (3)' });
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getAllByRole('listitem')).toHaveLength(3);
  },
};

/** The person's text is gone from memory (a reload): no Restore to offer. */
export const WithoutRestore: Story = {
  args: { enhancement: enhanced({ canRestore: false }) },
};

/** Nothing needed fixing beyond the wording: no list, no disclosure. */
export const NoChanges: Story = {
  args: { enhancement: enhanced({ changes: [] }) },
};

/** It could not improve: one honest line; the text under it is untouched. */
export const Failed: Story = {
  args: { enhancement: enhancement('en', 'failed') },
  parameters: { panel: { draft: 'rough' } },
};

export const FailedTimeout: Story = {
  args: { enhancement: { status: 'failed', reason: 'timeout' } },
  parameters: { panel: { draft: 'rough' } },
};

export const FailedBusy: Story = {
  args: { enhancement: { status: 'failed', reason: 'busy' } },
  parameters: { panel: { draft: 'rough' } },
};

/** Any other cause says only what matters: the text is as it was. */
export const FailedOther: Story = {
  args: { enhancement: { status: 'failed', reason: 'invalid' } },
  parameters: { panel: { draft: 'rough' } },
};

export const EnhancedDark: Story = {
  parameters: { panel: { theme: 'dark' } },
};

export const FailedDark: Story = {
  args: { enhancement: enhancement('en', 'failed') },
  parameters: { panel: { theme: 'dark', draft: 'rough' } },
};

/** 420px: the understood line has room for its whole restatement. */
export const EnhancedWide: Story = {
  parameters: { panel: { width: 420 } },
};

/** Arabic: «حُسِّنت صياغة الطلب», Restore at the left, the list's marks at the right. */
export const EnhancedRightToLeft: Story = {
  args: { locale: 'ar', enhancement: enhancement('ar', 'enhanced') },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', {
        name: t('ar', 'enhance.changes.show', { n: 3 }),
      }),
    );
  },
};

export const EnhancedRightToLeftDark: Story = {
  args: { locale: 'ar', enhancement: enhancement('ar', 'enhanced') },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', theme: 'dark' } },
};

export const FailedRightToLeft: Story = {
  args: { locale: 'ar', enhancement: enhancement('ar', 'failed') },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', draft: 'rough' } },
};
