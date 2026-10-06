import type { Meta, StoryObj } from '@storybook/react-vite';

import { SiteDesignContext } from '@craftkit/builder-renderer';
import type { SiteLibrary, SymbolOverride } from '@craftkit/builder-schema';

import { SymbolInstanceBlock } from './SymbolInstanceBlock';

const LIBRARY: SiteLibrary = {
  symbols: {
    banner: {
      id: 'banner',
      name: 'Banner',
      tree: {
        kind: 'root',
        children: [
          {
            kind: 'element',
            tag: 'section',
            className: 'flex items-center justify-between gap-4 rounded-xl bg-accent p-6 text-surface',
            children: [
              { kind: 'element', tag: 'h2', className: 'text-2xl font-bold', text: 'Summer sale' },
              {
                kind: 'element',
                tag: 'a',
                className: 'rounded-full bg-surface px-4 py-2 text-accent',
                text: 'Shop now',
                attributes: { href: 'https://example.com' },
              },
            ],
          },
        ],
      },
    },
  },
};

interface DemoProps {
  readonly overrides: SymbolOverride[];
  readonly symbolId: string;
  readonly isCanvas: boolean;
}

function Demo({ overrides, symbolId, isCanvas }: DemoProps) {
  return (
    <SiteDesignContext.Provider value={{ library: LIBRARY }}>
      <SymbolInstanceBlock
        node={{ id: 'inst', type: 'customCodeSymbol', props: {} }}
        props={{ label: 'Banner', symbolId, overrides }}
        slots={{}}
        data={{}}
        isCanvas={isCanvas}
      />
    </SiteDesignContext.Provider>
  );
}

const meta = {
  title: 'Builder/CustomCode/SymbolInstanceBlock',
  component: Demo,
  args: { overrides: [], symbolId: 'banner', isCanvas: false },
} satisfies Meta<typeof Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Master: Story = {};
export const WithOverrides: Story = {
  args: { overrides: [{ path: [0, 0], text: 'تخفيضات الصيف' }, { path: [0, 1], text: 'تسوّق الآن' }] },
};
export const MissingSymbolOnCanvas: Story = { args: { symbolId: 'gone', isCanvas: true } };
