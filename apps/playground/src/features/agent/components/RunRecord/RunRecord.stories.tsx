import { ChromeButton } from '@craftkit/builder';
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import { formatRemaining, t, tAnnounce, tParts, type Key } from '../../copy';
import type { ChangeLineView, CopyParams, Locale } from '../../model/view-types';
import { ChangeLines } from '../ChangeLines';
import { InlineConfirm } from '../InlineConfirm';
import { RecordMenu } from '../RecordMenu';

import { RunRecord } from './RunRecord';

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
          minBlockSize: 280,
          padding: 'var(--bldr-space-3xl)',
        }}
      >
        <Story />
      </div>
    </div>
  );
};

/* ── Copy, with every interpolated page word isolated (SPEC §4.0) ─────────── */

function Copy({ locale, k, params }: { locale: Locale; k: Key; params?: CopyParams }) {
  return (
    <>
      {tParts(locale, k, params).map((part, index) =>
        part.kind === 'value' ? <bdi key={index}>{part.text}</bdi> : part.text,
      )}
    </>
  );
}

const caption = {
  margin: 0,
  fontSize: 'var(--bldr-font-size-meta)',
  lineHeight: 'var(--bldr-line-height-meta)',
} as const;

/*
  Stand-ins for the records' own footer buttons (wave 2), at the panel's 32px target
  (SPEC §6.4). ChromeButton offers 28 (`sm`) and 36 (`lg`), neither of which is the
  panel's control height, and a 28px button beside the 32px [⋯] sits 2px off its centre.
*/
const FOOTER_BUTTON = { blockSize: 'var(--bldr-control-md)' } as const;

/* ── Records as the thread will hold them ─────────────────────────────────── */

function BuildingRecord({ locale }: { locale: Locale }) {
  return (
    <RunRecord
      glyph="working"
      animateGlyph
      title={t(locale, 'build.title.running')}
      meta={[{ text: '1/8', label: tAnnounce(locale, 'build.progress', { done: 1, total: 8 }) }]}
    >
      <p style={caption}>{formatRemaining(locale, 90_000)}</p>
    </RunRecord>
  );
}

function DoneRecord({ locale }: { locale: Locale }) {
  return (
    <RunRecord
      glyph="landed"
      title={t(locale, 'build.title.done')}
      meta={[{ text: '2:21' }]}
      actions={
        <InlineConfirm
          message={t(locale, 'confirm.undoBuild')}
          confirmLabel={t(locale, 'confirm.undo')}
          cancelLabel={t(locale, 'confirm.cancel')}
          onConfirm={() => undefined}
          renderOpener={({ open }) => (
            <ChromeButton size="sm" style={FOOTER_BUTTON} onClick={open}>
              {t(locale, 'footer.undoBuild')}
            </ChromeButton>
          )}
        />
      }
      menu={
        <RecordMenu
          locale={locale}
          items={['restore', 'reuse', 'copySummary']}
          onSelect={() => undefined}
        />
      }
    >
      <p style={caption}>{t(locale, 'build.caption.done', { n: 8 })}</p>
    </RunRecord>
  );
}

function PartialRecord({ locale }: { locale: Locale }) {
  return (
    <RunRecord
      glyph="partial"
      title={t(locale, 'build.title.partial', { n: 1 })}
      meta={[{ text: '2:40' }]}
      actions={
        <ChromeButton variant="primary" size="sm" style={FOOTER_BUTTON}>
          {t(locale, 'footer.retryFailed', { n: 1 })}
        </ChromeButton>
      }
      menu={
        <RecordMenu locale={locale} items={['reuse', 'copySummary']} onSelect={() => undefined} />
      }
    >
      <p style={caption}>{t(locale, 'build.caption.done', { n: 7 })}</p>
    </RunRecord>
  );
}

function StoppedRecord({ locale }: { locale: Locale }) {
  return (
    <RunRecord
      glyph="absent"
      title={t(locale, 'build.title.stopped')}
      meta={[{ text: '1:52' }]}
      actions={
        <>
          <ChromeButton variant="primary" size="sm" style={FOOTER_BUTTON}>
            {t(locale, 'footer.finishRest', { n: 3 })}
          </ChromeButton>
          <ChromeButton size="sm" style={FOOTER_BUTTON}>
            {t(locale, 'footer.removeEmpty', { n: 3 })}
          </ChromeButton>
        </>
      }
    >
      <p style={caption}>{t(locale, 'build.caption.stopped', { n: 3 })}</p>
    </RunRecord>
  );
}

function FailedRecord({ locale }: { locale: Locale }) {
  return (
    <RunRecord
      glyph="failed"
      title={t(locale, 'error.unreachable.title')}
      meta={[{ text: '0:31' }]}
      actions={
        <ChromeButton variant="primary" size="sm" style={FOOTER_BUTTON}>
          {t(locale, 'error.retry')}
        </ChromeButton>
      }
      menu={<RecordMenu locale={locale} items={['copyError']} onSelect={() => undefined} />}
    >
      <p style={{ margin: 0 }}>{t(locale, 'error.unreachable.cause')}</p>
      <p style={{ margin: 0 }}>{t(locale, 'error.page.unchanged')}</p>
    </RunRecord>
  );
}

const HERO_EDIT: Readonly<Record<Locale, readonly ChangeLineView[]>> = {
  en: [
    { kind: 'changed', label: 'Background', before: 'light', after: 'deep navy' },
    { kind: 'added', label: 'Button', value: 'WhatsApp' },
  ],
  ar: [
    { kind: 'changed', label: 'الخلفية', before: 'فاتحة', after: 'كحلي داكن' },
    { kind: 'added', label: 'الزر', value: 'WhatsApp' },
  ],
};

function EditDoneRecord({ locale }: { locale: Locale }) {
  return (
    <RunRecord
      glyph="landed"
      title={<Copy locale={locale} k="edit.title.done" params={{ target: 'Hero' }} />}
      meta={[{ text: '0:16' }]}
      actions={
        <>
          <ChromeButton size="sm" style={FOOTER_BUTTON}>
            {t(locale, 'edit.showOnPage')}
          </ChromeButton>
          <ChromeButton size="sm" style={FOOTER_BUTTON}>
            {t(locale, 'edit.undo')}
          </ChromeButton>
        </>
      }
      menu={<RecordMenu locale={locale} items={['reuse']} onSelect={() => undefined} />}
    >
      <ChangeLines locale={locale} changes={HERO_EDIT[locale]} />
    </RunRecord>
  );
}

function AnswerRecord({ locale }: { locale: Locale }) {
  return (
    <RunRecord
      glyph="note"
      title={t(locale, 'answer.title')}
      menu={<RecordMenu locale={locale} items={['copyAnswer']} onSelect={() => undefined} />}
    >
      <p style={{ margin: 0, color: 'var(--bldr-panel-text)', textWrap: 'pretty' }}>
        {locale === 'ar'
          ? 'قسم الأسعار يعرض ثلاث باقات، والباقة الوسطى مميّزة بلون الموقع.'
          : 'The pricing section shows three plans; the middle one is highlighted in the site colour.'}
      </p>
    </RunRecord>
  );
}

/** The state is said by the title in words; the glyph adds nothing to the name. */
async function expectNamedByTitle(canvasElement: HTMLElement, title: string): Promise<void> {
  const article = within(canvasElement).getByRole('article', { name: title });
  await expect(article.querySelector('.ck-agent-glyph')).toHaveAttribute('aria-hidden', 'true');
  const heading = within(article).getByRole('heading', { level: 3 });
  heading.focus();
  await expect(heading).toHaveFocus();
}

const meta = {
  title: 'Agent/Primitives/RunRecord',
  component: RunRecord,
  parameters: { layout: 'centered' },
  args: { glyph: 'landed', title: 'Page built' },
  decorators: [inPanel],
} satisfies Meta<typeof RunRecord>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LongTargetAt288: Story = {
  args: {
    glyph: 'working',
    title: 'Refining the peace and war mural with a clearer responsive reading order',
  },
  parameters: { panel: { width: 288 } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('article')).toHaveAccessibleName(
      'Refining the peace and war mural with a clearer responsive reading order',
    );
  },
};

/** A live build's head: the count, never a clock (the RunBar owns the one clock). */
export const BuildRunning: Story = {
  render: () => <BuildingRecord locale="en" />,
  play: async ({ canvasElement }) => {
    await expectNamedByTitle(canvasElement, 'Building the page');
    // The figure reads as the catalog's sentence ("1 of 8 sections is on the page"), not
    // "1 slash 8".
    const spoken = tAnnounce('en', 'build.progress', { done: 1, total: 8 });
    await expect(within(canvasElement).getByText(spoken)).toHaveClass('bldr-visually-hidden');
  },
};

/** Finished: the final time replaces the count; Undo build confirms in place. */
export const BuildDone: Story = {
  render: () => <DoneRecord locale="en" />,
  play: async ({ canvasElement }) => {
    await expectNamedByTitle(canvasElement, 'Page built');
  },
};

export const BuildPartial: Story = { render: () => <PartialRecord locale="en" /> };
export const BuildStopped: Story = { render: () => <StoppedRecord locale="en" /> };
export const Failed: Story = { render: () => <FailedRecord locale="en" /> };
export const EditDone: Story = { render: () => <EditDoneRecord locale="en" /> };
export const Answer: Story = { render: () => <AnswerRecord locale="en" /> };

export const BuildDoneDark: Story = {
  render: () => <DoneRecord locale="en" />,
  parameters: { panel: { theme: 'dark' } },
};

/** Arabic: the glyph column is at the right, the figures at the left, `2:21` intact. */
export const BuildDoneRightToLeft: Story = {
  render: () => <DoneRecord locale="ar" />,
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
  play: async ({ canvasElement }) => {
    await expectNamedByTitle(canvasElement, t('ar', 'build.title.done'));
    const glyph = canvasElement.querySelector('.ck-agent-glyph');
    const figure = canvasElement.querySelector('.ck-agent-record__meta');
    if (glyph === null || figure === null) throw new Error('head parts');
    await expect(glyph.getBoundingClientRect().left).toBeGreaterThan(
      figure.getBoundingClientRect().right,
    );
  },
};

export const BuildDoneRightToLeftDark: Story = {
  render: () => <DoneRecord locale="ar" />,
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', theme: 'dark' } },
};

export const EditDoneRightToLeft: Story = {
  render: () => <EditDoneRecord locale="ar" />,
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
};

/**
 * Undo build confirms in place (SPEC §4.15): the consequence, then Undo and Cancel, in the
 * footer's actions column, with focus on Cancel. `[⋯]` keeps its place at the inline end,
 * on the answers' row, instead of dropping to a line of its own.
 */
async function expectConfirmBesideMenu(canvasElement: HTMLElement, locale: Locale) {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: t(locale, 'footer.undoBuild') }));
  const cancel = canvas.getByRole('button', { name: t(locale, 'confirm.cancel') });
  await expect(cancel).toHaveFocus();

  const footer = canvasElement.querySelector('.ck-agent-record__footer');
  const more = canvas.getByRole('button', { name: t(locale, 'menu.label') });
  if (footer === null) throw new Error('no footer');
  const answers = cancel.getBoundingClientRect();
  const menu = more.getBoundingClientRect();
  const edge = footer.getBoundingClientRect();
  // Same row as the answers: the two 32px controls share their block extent.
  await expect(Math.abs(menu.top - answers.top)).toBeLessThan(0.5);
  await expect(Math.abs(menu.bottom - answers.bottom)).toBeLessThan(0.5);
  // At the footer's inline end, in either direction.
  const inlineEnd = locale === 'ar' ? edge.left : edge.right;
  const menuEnd = locale === 'ar' ? menu.left : menu.right;
  await expect(Math.abs(menuEnd - inlineEnd)).toBeLessThan(0.5);
  // And the confirm stays clear of it.
  const confirm = canvasElement.querySelector('.ck-agent-confirm')?.getBoundingClientRect();
  if (confirm === undefined) throw new Error('no confirm');
  await expect(locale === 'ar' ? confirm.left >= menu.right : confirm.right <= menu.left).toBe(
    true,
  );
}

export const UndoBuildConfirming: Story = {
  render: () => <DoneRecord locale="en" />,
  play: async ({ canvasElement }) => {
    await expectConfirmBesideMenu(canvasElement, 'en');
  },
};

export const UndoBuildConfirmingRightToLeftDark: Story = {
  render: () => <DoneRecord locale="ar" />,
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', theme: 'dark' } },
  play: async ({ canvasElement }) => {
    await expectConfirmBesideMenu(canvasElement, 'ar');
  },
};

/** Every body line and the footer start on the title's edge: 24px in. */
export const EveryKindAt320: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 'var(--bldr-space-3xl)' }}>
      <BuildingRecord locale="en" />
      <DoneRecord locale="en" />
      <PartialRecord locale="en" />
      <StoppedRecord locale="en" />
      <FailedRecord locale="en" />
      <EditDoneRecord locale="en" />
      <AnswerRecord locale="en" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    for (const article of canvasElement.querySelectorAll('.ck-agent-record')) {
      const title = article.querySelector('.ck-agent-record__title')?.getBoundingClientRect();
      const body = article.querySelector('.ck-agent-record__body > *')?.getBoundingClientRect();
      if (title === undefined || body === undefined) continue;
      await expect(Math.abs(body.left - title.left)).toBeLessThan(0.5);
    }
    const root = canvasElement.querySelector('.ck-agent');
    if (root === null) throw new Error('no panel');
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
  },
};

export const EveryKindAt420Arabic: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 'var(--bldr-space-3xl)' }}>
      <BuildingRecord locale="ar" />
      <DoneRecord locale="ar" />
      <StoppedRecord locale="ar" />
      <EditDoneRecord locale="ar" />
      <AnswerRecord locale="ar" />
    </div>
  ),
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', width: 420 } },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('.ck-agent');
    if (root === null) throw new Error('no panel');
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
  },
};
