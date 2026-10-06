import { expect, fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import type { StylePropertyId } from '@craftkit/builder-schema';

import { viewStyles, type PropertyView } from '../style-view';
import { STYLE_PANEL_LABELS_AR, STYLE_PANEL_LABELS_EN } from '../StylePanel/StylePanel.labels';
import { StyleProperty } from './StyleProperty';
import '../StylePanel/StylePanel.css';

const views = viewStyles(['p-4 mbs-2 text-lg bg-accent rounded-lg'], { bucket: 'base', state: 'default' });
function viewOf(id: StylePropertyId): PropertyView {
  const view = views.get(id);
  if (view === undefined) throw new Error(`no view for ${id}`);
  return view;
}

const tokens = [
  { id: 'surface', name: 'Surface', css: '#ffffff' },
  { id: 'text', name: 'Text', css: '#111827' },
  { id: 'accent', name: 'Accent', css: '#2563eb' },
];

const meta = {
  title: 'Builder/Shell/StyleManager/StyleProperty',
  component: StyleProperty,
  decorators: [
    (Story) => (
      <div className="bldr-root" style={{ maxInlineSize: '20rem', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    view: viewOf('fontSize'),
    mode: 'free',
    dir: 'ltr',
    tokens,
    palette: [],
    onEdit: fn(),
    labels: STYLE_PANEL_LABELS_EN,
  },
} satisfies Meta<typeof StyleProperty>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FontSize: Story = {};
export const BoxModel: Story = { args: { view: viewOf('padding'), companion: viewOf('margin') } };
export const Colour: Story = { args: { view: viewOf('backgroundColor') } };
export const Radius: Story = { args: { view: viewOf('borderRadius') } };

/*
  Fix pass (2026-10-06): every property row in a 280px panel, in English and
  in Arabic. The play fails if any name is cut (an ellipsis or a clamped
  third line): the final test found 31 of 55 English labels ending in "…".
*/
function AllRows({ locale }: { readonly locale: 'en' | 'ar' }) {
  const labels = locale === 'ar' ? STYLE_PANEL_LABELS_AR : STYLE_PANEL_LABELS_EN;
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  return (
    <div className="bldr-style-panel" lang={locale} dir={dir} style={{ inlineSize: '280px' }}>
      {[...views.values()].map((view) => (
        <StyleProperty
          key={view.def.id}
          view={view}
          mode="free"
          dir={dir}
          tokens={tokens}
          palette={[]}
          onEdit={() => undefined}
          labels={labels}
        />
      ))}
    </div>
  );
}

async function expectNoCutLabel(canvasElement: HTMLElement): Promise<void> {
  const names = [...canvasElement.querySelectorAll<HTMLElement>('.bldr-style-property__name')];
  await expect(names.length).toBeGreaterThan(40);
  const cut = names
    .filter((name) => name.scrollWidth > name.clientWidth + 1 || name.scrollHeight > name.clientHeight + 1)
    .map((name) => name.textContent);
  await expect(cut).toEqual([]);
}

export const EveryLabelFitsAt280: Story = {
  render: () => <AllRows locale="en" />,
  play: async ({ canvasElement }) => {
    await expectNoCutLabel(canvasElement);
  },
};

export const EveryArabicLabelFitsAt280: Story = {
  render: () => <AllRows locale="ar" />,
  play: async ({ canvasElement }) => {
    await expectNoCutLabel(canvasElement);
  },
};

