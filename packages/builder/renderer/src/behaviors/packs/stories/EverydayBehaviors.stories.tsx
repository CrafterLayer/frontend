import type { Meta, StoryObj } from '@storybook/react-vite';
import { useLayoutEffect, useRef } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import type { CustomCodeNode, CustomCodeRoot } from '@craftkit/builder-schema';

import { CustomCode } from '../../../components/CustomCode/CustomCode';
import { mountBackToTop } from '../back-to-top';
import { mountDismiss } from '../dismiss';
import { mountFilter } from '../filter';
import { mountReadMore } from '../read-more';
import { mountScrollSpy } from '../scroll-spy';
import { mountTypedWords } from '../typed-words';

interface Copy {
  readonly notice: string;
  readonly close: string;
  readonly lead: string;
  readonly words: readonly string[];
  readonly story: string;
  readonly more: string;
  readonly less: string;
  readonly groups: readonly (readonly [string, string])[];
  readonly items: readonly (readonly [string, string])[];
  readonly top: string;
}

const el = (
  tag: string,
  attributes: Readonly<Record<string, string>> = {},
  text?: string,
  children: readonly CustomCodeNode[] = [],
): CustomCodeNode =>
  ({
    kind: 'element',
    tag,
    attributes,
    ...(text === undefined ? {} : { text }),
    children,
  }) as CustomCodeNode;

/** The six everyday behaviours, written the way the section writer is taught to write them. */
function everydayTree(copy: Copy): CustomCodeRoot {
  return {
    kind: 'root',
    children: [
      el(
        'div',
        { 'data-ck-behavior': 'dismiss', role: 'region', 'aria-label': copy.notice },
        undefined,
        [
          el('p', {}, copy.notice),
          el('button', { type: 'button', 'aria-label': copy.close, hidden: '' }, '×'),
        ],
      ),
      el('nav', { 'data-ck-behavior': 'scroll-spy', 'aria-label': copy.lead }, undefined, [
        el('a', { href: '#everyday-story' }, copy.more),
      ]),
      el('h2', {}, `${copy.lead} `, [
        el(
          'span',
          { 'data-ck-behavior': 'typed-words' },
          undefined,
          copy.words.map((word, at) => el('span', at === 0 ? {} : { hidden: '' }, word)),
        ),
      ]),
      el(
        'div',
        { id: 'everyday-story', 'data-ck-behavior': 'read-more', 'data-ck-text': copy.less },
        undefined,
        [el('p', {}, copy.story), el('button', { type: 'button', hidden: '' }, copy.more)],
      ),
      el('div', { 'data-ck-behavior': 'filter' }, undefined, [
        ...copy.groups.map(([group, label]) =>
          el('button', { type: 'button', 'data-ck-filter': group }, label),
        ),
        el(
          'ul',
          {},
          undefined,
          copy.items.map(([groups, label]) => el('li', { 'data-ck-filter': groups }, label)),
        ),
      ]),
      el(
        'a',
        { href: '#top', 'data-ck-behavior': 'back-to-top', 'aria-label': copy.top },
        undefined,
        [{ kind: 'icon', name: 'arrow-up' }],
      ),
    ],
  };
}

const ENGLISH = everydayTree({
  notice: 'Free delivery this week',
  close: 'Close the notice',
  lead: 'We build',
  words: ['websites', 'shops', 'brands'],
  story:
    'We started in a small room above a bakery in Amman, with one laptop and a lot of patience. '.repeat(
      6,
    ),
  more: 'Read more',
  less: 'Show less',
  groups: [
    ['all', 'All'],
    ['web', 'Web'],
    ['print', 'Print'],
  ],
  items: [
    ['web', 'Roastery website'],
    ['print', 'Menu posters'],
    ['web print', 'Clinic identity'],
  ],
  top: 'Back to top',
});

const ARABIC = everydayTree({
  notice: 'توصيل مجاني هذا الأسبوع',
  close: 'إغلاق الإشعار',
  lead: 'نصمم',
  words: ['مواقع', 'متاجر', 'هويات'],
  story: 'بدأنا في غرفة صغيرة فوق مخبز في عمّان، بحاسوب واحد وصبر كثير. '.repeat(8),
  more: 'اقرأ المزيد',
  less: 'عرض أقل',
  groups: [
    ['all', 'الكل'],
    ['web', 'ويب'],
    ['print', 'مطبوعات'],
  ],
  items: [
    ['web', 'موقع محمصة'],
    ['print', 'ملصقات قائمة الطعام'],
    ['web print', 'هوية عيادة'],
  ],
  top: 'إلى الأعلى',
});

interface StageProps {
  readonly tree: CustomCodeRoot;
  readonly locale: 'ar' | 'en';
  readonly isCanvas?: boolean;
}

const PACKS = [
  mountDismiss,
  mountScrollSpy,
  mountTypedWords,
  mountReadMore,
  mountFilter,
  mountBackToTop,
];

/* A layout effect runs before CustomCode's passive one, so each pack's guard keeps one mount. */
function EverydayStage({ tree, locale, isCanvas = false }: StageProps) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const region = ref.current;
    if (region === null) return undefined;
    const disposers = PACKS.map((mount) => mount(region, { interactive: !isCanvas }));
    return () => {
      for (const dispose of disposers) dispose();
    };
  }, [tree, isCanvas]);
  return (
    <div
      ref={ref}
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      style={{ maxInlineSize: 560 }}
    >
      <CustomCode hostId="everyday-story" tree={tree} isCanvas={isCanvas} />
    </div>
  );
}

const meta = {
  title: 'Builder/Renderer/Behaviors/EverydayBehaviors',
  component: EverydayStage,
  parameters: { layout: 'padded' },
  args: { tree: ENGLISH, locale: 'en' },
} satisfies Meta<typeof EverydayStage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Read more opens and closes the story; the filter narrows the list; the notice closes. */
export const English: Story = {
  play: async ({ canvasElement }) => {
    window.localStorage.clear();
    const canvas = within(canvasElement);
    const more = canvas.getByRole('button', { name: 'Read more' });
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(more);
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    await expect(more).toHaveTextContent('Show less');
    await userEvent.click(canvas.getByRole('button', { name: 'Print' }));
    await expect(canvas.getByText('Roastery website')).not.toBeVisible();
    await expect(canvas.getByText('Clinic identity')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Close the notice' }));
    await expect(canvas.getByText('Free delivery this week')).not.toBeVisible();
    window.localStorage.clear();
  },
};

/** The same markup in Arabic: the typed word steps by grapheme, the list reads in Arabic. */
export const Arabic: Story = {
  args: { tree: ARABIC, locale: 'ar' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading')).toHaveTextContent('مواقع, متاجر, هويات');
    await userEvent.click(canvas.getByRole('button', { name: 'ويب' }));
    await waitFor(() => expect(canvas.getByText('ملصقات قائمة الطعام')).not.toBeVisible());
  },
};

/** On the editing canvas nothing moves or hides: the controls show so they can be edited. */
export const Canvas: Story = {
  args: { isCanvas: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Read more' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Close the notice' })).toBeVisible();
    await expect(canvas.getByText('shops', { exact: true })).not.toBeVisible();
  },
};
