import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { z } from 'zod';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  customCodeTree,
  defineBlockSchema,
  emptyCustomCodeTree,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { installBrowserStandIns, installClassOracle } from '../../style-manager/test-support';
import { Inspector } from './Inspector';

/*
  The Arabic editor (arabic-editor): with `locale="ar"` every word the panel
  draws or announces is Arabic — its region, tabs, empty state, the selected
  block's NAME (from the block-name catalogue, not the humanised type) and an
  element's name — and its tab arrows follow the chrome's direction.
*/

const NullRender: BlockRenderComponent = () => null;

const VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'inspector-arabic-test',
  version: '1.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'Page',
          props: z.object({}),
          slots: { default: { allow: ['region', 'card'] } },
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'region',
          description: 'A composed region',
          props: z.object({
            label: z.string().max(80).default('Custom section'),
            tree: customCodeTree().default(emptyCustomCodeTree()),
          }),
          propertyGroups: {
            label: { tab: 'content', section: 'Identity' },
            tree: { tab: 'content', section: 'Composition' },
          },
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'card',
          description: 'Card',
          props: z.object({ title: z.string().default('Hi'), tone: z.string().default('calm') }),
          propertyGroups: {
            title: { tab: 'content', section: 'Text' },
            tone: { tab: 'design', section: 'Look' },
          },
          examples: [],
        }),
        render: NullRender,
      },
    ],
  },
};

const DOC: BuilderDocument = {
  schemaVersion: 1,
  surface: 'site',
  dir: 'ltr',
  rootId: 'root',
  nodes: {
    root: { id: 'root', type: 'page', props: {}, slots: { default: ['r1', 'c1'] } },
    r1: {
      id: 'r1',
      type: 'region',
      props: {
        label: 'رأس السيرة',
        tree: {
          kind: 'root',
          children: [{ kind: 'element', tag: 'h1', text: 'ريم حداد' }],
        },
      },
    },
    c1: { id: 'c1', type: 'card', props: { title: 'Hello', tone: 'calm' } },
  },
};

const makeKernel = () =>
  createBuilder({
    document: DOC,
    extensions: [VOCAB],
    ports: { clock: fixedClock(), ids: seededIds('iar') },
  });

let restoreOracle: () => void = () => undefined;
beforeAll(() => {
  installBrowserStandIns();
  restoreOracle = installClassOracle();
});
afterAll(() => {
  restoreOracle();
});

describe('Inspector in Arabic', () => {
  it('invites a selection in Arabic when nothing is selected', () => {
    render(<Inspector kernel={makeKernel()} locale="ar" />);
    const panel = screen.getByRole('region', { name: 'الخصائص' });
    expect(within(panel).getByText('حدّد كتلة لتعديل خصائصها.')).toBeInTheDocument();
  });

  it('names a registered block from the Arabic catalogue and labels its tabs in Arabic', () => {
    const kernel = makeKernel();
    kernel.setSelection(['c1']);
    render(<Inspector kernel={kernel} locale="ar" />);
    const panel = screen.getByRole('region', { name: 'الخصائص' });
    expect(within(panel).getByRole('paragraph', { name: 'الكتلة المحددة' })).toHaveTextContent('بطاقة');
    const tablist = within(panel).getByRole('tablist', { name: 'تبويبات الخصائص' });
    expect(within(tablist).getByRole('tab', { name: 'المحتوى' })).toBeInTheDocument();
    expect(within(tablist).getByRole('tab', { name: 'التصميم' })).toBeInTheDocument();
    expect(within(panel).queryByText('Card')).not.toBeInTheDocument();
  });

  it('names a focused element in Arabic and announces clearing in Arabic', async () => {
    const kernel = makeKernel();
    kernel.focusElement('r1', [0]);
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} locale="ar" />);
    const panel = screen.getByRole('region', { name: 'الخصائص' });
    expect(within(panel).getByRole('paragraph', { name: 'الكتلة المحددة' })).toHaveTextContent('عنوان');
    expect(within(panel).getByText('داخل رأس السيرة')).toBeInTheDocument();

    await user.click(within(panel).getByRole('button', { name: 'إلغاء التحديد' }));
    expect(kernel.context.store.getState().selection).toEqual([]);
    expect(screen.getByRole('status', { name: 'رسائل لوحة الخصائص' })).toHaveTextContent('أُلغي التحديد');
  });

  it('mirrors the tab arrows by the chrome direction, even over an LTR page', async () => {
    const kernel = makeKernel();
    kernel.setSelection(['c1']);
    const user = userEvent.setup();
    render(
      <div dir="rtl">
        <Inspector kernel={kernel} locale="ar" />
      </div>,
    );
    const content = screen.getByRole('tab', { name: 'المحتوى' });
    act(() => {
      content.focus();
    });
    // In a right-to-left strip the next tab sits to the LEFT.
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'التصميم' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'التصميم' })).toHaveFocus();
  });
});
