import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

/*
  The same six stylesheets `main.tsx` loads (a test holds the two lists equal). Storybook
  never runs `main.tsx`, so without these the specimen would render in the fallback
  system face and prove nothing about Plex.
*/
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import { TypeSpecimen } from './TypeSpecimen';
import { FONT_FILES, TYPE_ROLES, type TypeMetric } from './TypeSpecimen.data';

/* ── Checks every story runs in a real browser ─────────────────────────────── */

/** Each of the six faces is declared, fetched and decoded: not the fallback. */
async function expectFacesLoaded(): Promise<void> {
  for (const file of FONT_FILES) {
    const probe = file.subset === 'arabic' ? 'أبجد' : 'Ag';
    const faces = await document.fonts.load(`${String(file.weight)} 16px "${file.family}"`, probe);
    await expect(faces.length, `${file.family} ${String(file.weight)}`).toBeGreaterThan(0);
  }
}

async function expectMetric(element: Element, metric: TypeMetric, weight: number): Promise<void> {
  const style = getComputedStyle(element);
  await expect(style.fontSize).toBe(`${String(metric.size)}px`);
  await expect(style.lineHeight).toBe(`${String(metric.line)}px`);
  await expect(style.fontWeight).toBe(String(weight));
}

/** Every role renders at its SPEC §2.2 size, line height, weight and family, per script. */
async function expectRoles(canvas: HTMLElement): Promise<void> {
  const coarse = matchMedia('(pointer: coarse)').matches;
  for (const role of TYPE_ROLES) {
    // A fine pointer resolves the coarse row to Input's values; only a touch screen can
    // show the row's own.
    if (role.coarseOnly && !coarse) continue;
    const samples = canvas.querySelectorAll(`.ck-agent-specimen__sample[data-role="${role.key}"]`);
    const [latin, arabic] = [...samples];
    if (latin === undefined || arabic === undefined) throw new Error(`no samples: ${role.key}`);
    await expectMetric(latin, role.latin, role.weight);
    await expectMetric(arabic, role.arabic, role.weight);
    await expect(getComputedStyle(latin).fontFamily).toMatch(
      /^"IBM Plex Sans", "IBM Plex Sans Arabic"/,
    );
    await expect(getComputedStyle(arabic).fontFamily).toMatch(
      /^"IBM Plex Sans Arabic", "IBM Plex Sans"/,
    );
  }
}

/** Tabular figures: every figure in a group is one width, in a Latin and an Arabic line. */
async function expectTabularFigures(canvas: HTMLElement): Promise<void> {
  const byColumn = new Map<string, number[]>();
  for (const figure of canvas.querySelectorAll<HTMLElement>('.ck-agent-specimen__figure')) {
    const key = `${figure.dataset['group'] ?? ''}|${figure.lang}`;
    byColumn.set(key, [...(byColumn.get(key) ?? []), figure.getBoundingClientRect().width]);
  }
  await expect(byColumn.size).toBe(4);
  for (const [key, widths] of byColumn) {
    const spread = Math.max(...widths) - Math.min(...widths);
    await expect(spread, `${key}: ${widths.join(', ')}`).toBeLessThan(0.01);
  }
}

/**
 * The Arabic specimen's root is `lang="ar"`, like the panel's, so every Latin string in it is
 * an island the theme's `:lang(ar) [lang]:not(:lang(ar))` block must re-point: `expectRoles`
 * already measures the Latin samples through it, and this checks the face names, which take
 * the Latin family but keep the row's Arabic size (they declare no size of their own).
 */
async function expectArabicRoot(canvas: HTMLElement): Promise<void> {
  const root = canvas.querySelector('.ck-agent-specimen');
  await expect(root).toHaveAttribute('lang', 'ar');
  await expect(root).toHaveAttribute('dir', 'rtl');
  const faces = [...canvas.querySelectorAll('.ck-agent-specimen__face')];
  await expect(faces).toHaveLength(FONT_FILES.length);
  for (const face of faces) {
    const style = getComputedStyle(face);
    await expect(style.fontFamily).toMatch(/^"IBM Plex Sans", "IBM Plex Sans Arabic"/);
    await expect(style.fontSize).toBe(getComputedStyle(face.closest('tr') ?? face).fontSize);
  }
}

async function expectSpecimen(canvasElement: HTMLElement): Promise<void> {
  await expectFacesLoaded();
  await expectRoles(canvasElement);
  await expectTabularFigures(canvasElement);
}

/* ── Stories ───────────────────────────────────────────────────────────────── */

const meta = {
  title: 'Agent/Foundations/TypeSpecimen',
  component: TypeSpecimen,
  parameters: { layout: 'fullscreen' },
  args: { locale: 'en' },
  argTypes: {
    locale: { control: 'inline-radio', options: ['en', 'ar'] },
  },
} satisfies Meta<typeof TypeSpecimen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {
  play: async ({ canvasElement }) => {
    await expectSpecimen(canvasElement);
  },
};

export const Dark: Story = {
  decorators: [
    (StoryFn) => (
      <div data-bldr-theme="dark">
        <StoryFn />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await expectSpecimen(canvasElement);
  },
};

/** The specimen read in Arabic: the page runs right to left and its own words are Arabic. */
export const ArabicRightToLeft: Story = {
  args: { locale: 'ar' },
  globals: { direction: 'rtl' },
  play: async ({ canvasElement }) => {
    await expectSpecimen(canvasElement);
    await expectArabicRoot(canvasElement);
  },
};

export const ArabicRightToLeftDark: Story = {
  args: { locale: 'ar' },
  globals: { direction: 'rtl' },
  decorators: [
    (StoryFn) => (
      <div data-bldr-theme="dark">
        <StoryFn />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await expectSpecimen(canvasElement);
    await expectArabicRoot(canvasElement);
  },
};

/** The panel's default width: samples stack, and nothing scrolls sideways. */
export const PanelWidth320: Story = {
  decorators: [
    (StoryFn) => (
      <div style={{ inlineSize: 320 }}>
        <StoryFn />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await expectSpecimen(canvasElement);
    const root = canvasElement.querySelector('.ck-agent-specimen');
    if (root === null) throw new Error('no specimen');
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
  },
};

/** The panel at 420 in Arabic, the width the wider layout starts to breathe at. */
export const PanelWidth420Arabic: Story = {
  args: { locale: 'ar' },
  globals: { direction: 'rtl' },
  decorators: [
    (StoryFn) => (
      <div style={{ inlineSize: 420 }}>
        <StoryFn />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await expectSpecimen(canvasElement);
    const root = canvasElement.querySelector('.ck-agent-specimen');
    if (root === null) throw new Error('no specimen');
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
    await expectArabicRoot(canvasElement);
  },
};
