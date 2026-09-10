import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import '../../../../app/App.css';
import { SiteMap, type SiteMapPage } from './SiteMap';

const pages: readonly SiteMapPage[] = [
  {
    id: 'home',
    index: 0,
    title: 'Home',
    address: '/',
    isHome: true,
    thumbnail: {
      kind: 'provided',
      src: 'https://picsum.photos/id/1039/640/400',
      alt: 'Home preview',
    },
    sharedReferences: [{ id: 'masthead', label: 'header', kind: 'region' }],
  },
  {
    id: 'work',
    index: 1,
    title: 'Selected work',
    address: '/work',
    isHome: false,
    thumbnail: { kind: 'fallback', alt: 'No preview available for Selected work' },
    sharedReferences: [
      { id: '../../shared/Header.tsx', label: 'Header', kind: 'module' },
      { id: '../../shared/Footer.tsx', label: 'Footer', kind: 'module' },
    ],
  },
  {
    id: 'contact',
    index: 2,
    title: 'Contact',
    address: '/contact',
    isHome: false,
    thumbnail: { kind: 'fallback', alt: 'No preview available for Contact' },
    sharedReferences: [],
  },
];

const meta = {
  title: 'Playground/SiteMap',
  component: SiteMap,
  decorators: [
    (Story) => (
      <div style={{ inlineSize: 'min(760px, 100vw)' }}>
        <Story />
      </div>
    ),
  ],
  args: { pages, selectedPageId: 'work', onSelect: fn(), onReorder: fn() },
} satisfies Meta<typeof SiteMap>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Selected: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Open Contact, /contact' }));
    await expect(args.onSelect).toHaveBeenCalledWith('contact');
  },
};

export const Empty: Story = { args: { pages: [], selectedPageId: undefined } };

export const SharedImpact: Story = {
  args: { selectedPageId: 'home' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByLabelText('Selected work shared sources'),
    ).toHaveTextContent('2 shared sources');
  },
};

export const Rtl: Story = {
  decorators: [
    (Story) => (
      <div dir="rtl">
        <Story />
      </div>
    ),
  ],
  args: {
    pages: pages.map((page) =>
      page.id === 'home'
        ? { ...page, title: 'الرئيسية' }
        : page.id === 'work'
          ? { ...page, title: 'أعمالنا' }
          : { ...page, title: 'تواصل' },
    ),
  },
};
