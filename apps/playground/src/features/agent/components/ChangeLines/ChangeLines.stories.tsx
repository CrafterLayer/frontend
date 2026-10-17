import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';

import { t } from '../../copy';
import type { ChangeLineView, Locale } from '../../model/view-types';

import { ChangeLines } from './ChangeLines';

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
          padding: 'var(--bldr-space-3xl)',
          paddingInlineStart: 'calc(var(--bldr-space-3xl) + var(--bldr-space-5xl))',
        }}
      >
        <Story />
      </div>
    </div>
  );
};

const CHANGES: Readonly<Record<Locale, readonly ChangeLineView[]>> = {
  en: [
    { kind: 'changed', label: 'Background', before: 'light', after: 'deep navy' },
    { kind: 'added', label: 'Button', value: 'WhatsApp' },
    { kind: 'removed', label: 'Subtitle', value: 'Book online in a minute' },
    { kind: 'changed', label: 'Heading', before: 'FAQ', after: 'Questions patients ask' },
    { kind: 'changed', label: 'Alignment', before: 'start', after: 'center' },
  ],
  ar: [
    { kind: 'changed', label: 'الخلفية', before: 'فاتحة', after: 'كحلي داكن' },
    { kind: 'added', label: 'الزر', value: 'WhatsApp' },
    { kind: 'removed', label: 'العنوان الفرعي', value: 'احجز خلال دقيقة' },
    { kind: 'changed', label: 'العنوان', before: 'الأسئلة الشائعة', after: 'أسئلة يطرحها المرضى' },
    { kind: 'changed', label: 'المحاذاة', before: 'البداية', after: 'الوسط' },
  ],
};

/**
 * One line of every kind `impactLines()` emits. `restyled` is "make the hero darker", the
 * commonest edit there is: a class changed, so there are no words to set around an arrow.
 */
const EVERY_KIND: Readonly<Record<Locale, readonly ChangeLineView[]>> = {
  en: [
    { kind: 'restyled', label: 'Section', value: 'Hero' },
    { kind: 'changed', label: 'Heading', before: 'FAQ', after: 'Questions patients ask' },
    { kind: 'added', label: 'Button', value: 'WhatsApp' },
    { kind: 'removed', label: 'Subtitle', value: 'Book online in a minute' },
    { kind: 'moved', label: 'Section', value: 'Pricing' },
  ],
  ar: [
    { kind: 'restyled', label: 'القسم', value: 'البطل' },
    { kind: 'changed', label: 'العنوان', before: 'الأسئلة الشائعة', after: 'أسئلة يطرحها المرضى' },
    { kind: 'added', label: 'الزر', value: 'WhatsApp' },
    { kind: 'removed', label: 'العنوان الفرعي', value: 'احجز خلال دقيقة' },
    { kind: 'moved', label: 'القسم', value: 'الأسعار' },
  ],
};

/** A restyled and a moved line say what happened in the catalog's word, after the title. */
async function expectWords(canvasElement: HTMLElement, locale: Locale): Promise<void> {
  const words = [...canvasElement.querySelectorAll('.ck-agent-change__word')].map(
    (word) => word.textContent,
  );
  await expect(words).toEqual([t(locale, 'change.restyled'), t(locale, 'change.moved')]);
}

async function expectNoSidewaysScroll(canvasElement: HTMLElement): Promise<void> {
  const root = canvasElement.querySelector('.ck-agent');
  if (root === null) throw new Error('no panel');
  await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
}

const meta = {
  title: 'Agent/Primitives/ChangeLines',
  component: ChangeLines,
  parameters: { layout: 'centered' },
  args: { locale: 'en', changes: CHANGES.en.slice(0, 2) },
  argTypes: {
    locale: { control: 'inline-radio', options: ['en', 'ar'] },
  },
  decorators: [inPanel],
} satisfies Meta<typeof ChangeLines>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Two changes: a before → after and an addition. */
export const Few: Story = {
  play: async ({ canvasElement }) => {
    await expectNoSidewaysScroll(canvasElement);
  },
};

/**
 * The chevron's stroke, not the button's box, sits on the lines' edge: 0.75 is half the
 * 1.5px stroke, outside the path's geometry.
 */
async function expectChevronOnEdge(canvasElement: HTMLElement, rtl: boolean): Promise<void> {
  const path = canvasElement.querySelector('.ck-agent-changes__more path');
  const label = canvasElement.querySelector('.ck-agent-change__label');
  if (path === null || label === null) throw new Error('no chevron or label');
  const stroke = path.getBoundingClientRect();
  const edge = label.getBoundingClientRect();
  const gap = rtl ? edge.right - (stroke.right + 0.75) : stroke.left - 0.75 - edge.left;
  await expect(Math.abs(gap)).toBeLessThan(1);
}

/** Five changes: three lines, then "Show all changes (5)". */
export const More: Story = {
  args: { changes: CHANGES.en },
  play: async ({ canvasElement }) => {
    await expectChevronOnEdge(canvasElement, false);
  },
};

/**
 * Show all reveals the rest in place: the list grows to its full height over the `enter`
 * tokens (SPEC §5 moment 8) and focus moves to the first line it revealed.
 */
export const Revealed: Story = {
  args: { changes: CHANGES.en },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = canvas.getByRole('list');
    const before = list.getBoundingClientRect().height;
    const button = canvas.getByRole('button', { name: t('en', 'edit.showAll', { n: 5 }) });
    await expect(button).toHaveAttribute('aria-controls', list.id);
    await userEvent.click(button);
    const lines = canvas.getAllByRole('listitem');
    await expect(lines).toHaveLength(5);
    await expect(lines[3]).toHaveFocus();

    // The growth runs on the list itself, from the three lines' height, over 220ms...
    const [growth] = list.getAnimations();
    if (growth === undefined) throw new Error('the list did not grow');
    const timing = growth.effect?.getComputedTiming();
    await expect(timing?.duration).toBe(220);
    const keyframes = (growth.effect as KeyframeEffect).getKeyframes();
    await expect(keyframes[0]?.['blockSize']).toBe(`${String(before)}px`);
    // ...and settles at the full height, clip released.
    await growth.finished;
    await expect(list.getBoundingClientRect().height).toBeGreaterThan(before);
    await expect(list.style.overflow).toBe('');
    await expectNoSidewaysScroll(canvasElement);
  },
};

/** Every kind of line: restyled, changed, added, removed, moved. */
export const EveryKind: Story = {
  args: { changes: EVERY_KIND.en, limit: 5 },
  play: async ({ canvasElement }) => {
    await expectWords(canvasElement, 'en');
    await expectNoSidewaysScroll(canvasElement);
  },
};

export const EveryKindRightToLeftDark: Story = {
  args: { locale: 'ar', changes: EVERY_KIND.ar, limit: 5 },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', theme: 'dark', width: 420 } },
  play: async ({ canvasElement }) => {
    await expectWords(canvasElement, 'ar');
    await expectNoSidewaysScroll(canvasElement);
  },
};

export const Dark: Story = {
  args: { changes: CHANGES.en },
  parameters: { panel: { theme: 'dark' } },
};

/** Arabic: «» quotes, the arrow points left, Latin values stay isolated in their `<bdi>`. */
export const RightToLeft: Story = {
  args: { locale: 'ar', changes: CHANGES.ar },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
  play: async ({ canvasElement }) => {
    await expectChevronOnEdge(canvasElement, true);
    const arrow = canvasElement.querySelector('svg[data-icon="arrowEnd"]');
    if (arrow === null) throw new Error('no arrow');
    await expect(getComputedStyle(arrow).scale).toBe('-1 1');
    await expectNoSidewaysScroll(canvasElement);
  },
};

export const RightToLeftDark: Story = {
  args: { locale: 'ar', changes: CHANGES.ar },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', theme: 'dark' } },
};

/** At 420 the label takes a 96px column and every value starts on one edge. */
export const Width420: Story = {
  args: { changes: CHANGES.en.slice(0, 3) },
  parameters: { panel: { width: 420 } },
  play: async ({ canvasElement }) => {
    const starts = [...canvasElement.querySelectorAll('.ck-agent-change__values')].map(
      (values) => values.getBoundingClientRect().left,
    );
    await expect(Math.max(...starts) - Math.min(...starts)).toBeLessThan(0.5);
  },
};

export const Width420RightToLeft: Story = {
  args: { locale: 'ar', changes: CHANGES.ar.slice(0, 3) },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', width: 420 } },
  play: async ({ canvasElement }) => {
    const ends = [...canvasElement.querySelectorAll('.ck-agent-change__values')].map(
      (values) => values.getBoundingClientRect().right,
    );
    await expect(Math.max(...ends) - Math.min(...ends)).toBeLessThan(0.5);
  },
};
