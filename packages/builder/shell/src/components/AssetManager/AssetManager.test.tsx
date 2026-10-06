import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  setUtilityClassOracle,
  type AssetEntry,
  type AssetLibraryPort,
  type CustomCodeRoot,
} from '@craftkit/builder-schema';

import { installBrowserStandIns } from '../../style-manager/test-support';
import { createDesignTestKernel, homeTree } from '../DesignSystemPanel/design-test-site';
import { AssetManager } from './AssetManager';
import { ASSET_MANAGER_LABELS_AR } from './AssetManager.labels';
import type { ImageCodec } from './image-upload';

beforeAll(() => {
  installBrowserStandIns();
  setUtilityClassOracle(() => true);
});
afterAll(() => {
  setUtilityClassOracle(undefined);
});
afterEach(cleanup);

const codec: ImageCodec = {
  decode: () => Promise.resolve({ width: 4800, height: 3200, source: {} as CanvasImageSource }),
  encode: () => Promise.resolve(new Blob([new Uint8Array(64)], { type: 'image/webp' })),
};

const hosted = (id: string, extra: Partial<AssetEntry> = {}): AssetEntry => ({
  id,
  url: `https://images.example.com/${id}.jpg`,
  description: `Photo ${id}`,
  mood: [],
  palette: [],
  alt: 'A street at dusk',
  width: 1200,
  height: 800,
  ...extra,
});

const IMAGE_TREE: CustomCodeRoot = {
  kind: 'root',
  children: [
    { kind: 'element', tag: 'img', className: 'rounded-lg', attributes: { src: 'https://images.example.com/old.jpg', alt: 'Old' } },
    { kind: 'element', tag: 'div', className: 'p-4', text: 'Box' },
  ],
};

const imgTarget = { kind: 'tree' as const, nodeId: 'region', path: [0] };
const boxTarget = { kind: 'tree' as const, nodeId: 'region', path: [1] };

function imageAt(tree: CustomCodeRoot, at: number) {
  const node = tree.children[at];
  return node?.kind === 'element' ? node : undefined;
}

describe('AssetManager', () => {
  it('uploads a picture as ONE registerAsset, resized, then flags the missing alt', async () => {
    const user = userEvent.setup();
    const kernel = createDesignTestKernel();
    render(<AssetManager site={kernel} codec={codec} newAssetId={() => 'up-1'} />);

    const file = new File([new Uint8Array([1, 2])], 'beach-day.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByLabelText('Upload a picture'), file);

    await waitFor(() => {
      expect(kernel.getSite().assets['up-1']).toBeDefined();
    });
    expect(kernel.getSite().assets['up-1']).toMatchObject({ width: 2400, height: 1600, description: 'beach day', alt: '' });
    expect(kernel.getSite().assets['up-1']?.url.startsWith('data:image/webp;base64,')).toBe(true);
    expect(kernel.transactions()).toHaveLength(1);
    expect(screen.getByText('Alt text missing')).toBeVisible();

    const alt = screen.getByLabelText('Alt text of beach day');
    await user.type(alt, 'Children on a beach{Enter}');
    expect(kernel.getSite().assets['up-1']?.alt).toBe('Children on a beach');
    expect(kernel.transactions().at(-1)?.command).toBe('Alt text · beach day');
  });

  it('accepts a dropped file', async () => {
    const kernel = createDesignTestKernel();
    render(<AssetManager site={kernel} codec={codec} newAssetId={() => 'dropped'} />);
    const zone = screen.getByLabelText('Upload a picture').closest('div') as HTMLElement;
    const file = new File([new Uint8Array([1])], 'drop.png', { type: 'image/png' });
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    await waitFor(() => {
      expect(kernel.getSite().assets['dropped']).toBeDefined();
    });
  });

  it('refuses a file that is not a picture', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const kernel = createDesignTestKernel();
    render(<AssetManager site={kernel} codec={codec} />);
    await user.upload(screen.getByLabelText('Upload a picture'), new File(['x'], 'notes.txt', { type: 'text/plain' }));
    expect(await screen.findByText('That file is not a picture.')).toBeVisible();
    expect(kernel.transactions()).toHaveLength(0);
  });

  it('refuses to delete a picture the page uses, saying where; deletes it once unused', async () => {
    const user = userEvent.setup();
    const kernel = createDesignTestKernel({
      assets: { a1: hosted('a1'), a2: hosted('a2') },
      extraNodes: { pic: { id: 'pic', type: 'picture', props: { image: { assetId: 'a1' } } } },
    });
    render(<AssetManager site={kernel} />);
    const grid = screen.getByRole('list', { name: 'Site pictures' });
    const [first, second] = within(grid).getAllByRole('listitem');
    if (first === undefined || second === undefined) throw new Error('two cards expected');
    await user.click(within(first).getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('status')).toHaveTextContent('still used');
    expect(screen.getByRole('status')).toHaveTextContent('node "pic"');
    expect(kernel.getSite().assets['a1']).toBeDefined();

    await user.click(within(second).getByRole('button', { name: 'Delete' }));
    expect(kernel.getSite().assets['a2']).toBeUndefined();
  });

  it('uses a picture on a selected tree image: src and alt in one transaction', async () => {
    const user = userEvent.setup();
    const kernel = createDesignTestKernel({ tree: IMAGE_TREE, assets: { a1: hosted('a1') } });
    render(<AssetManager site={kernel} target={imgTarget} />);
    await user.click(screen.getByRole('button', { name: 'Use on selected' }));
    expect(imageAt(homeTree(kernel), 0)?.attributes).toEqual({
      src: 'https://images.example.com/a1.jpg',
      alt: 'A street at dusk',
    });
    expect(kernel.transactions()).toHaveLength(1);
  });

  it('puts a hosted picture behind a container as a cover background', async () => {
    const user = userEvent.setup();
    const kernel = createDesignTestKernel({ tree: IMAGE_TREE, assets: { a1: hosted('a1') } });
    render(<AssetManager site={kernel} target={boxTarget} />);
    await user.click(screen.getByRole('button', { name: 'Use on selected' }));
    expect(imageAt(homeTree(kernel), 1)?.className?.split(' ')).toEqual(
      expect.arrayContaining(['p-4', 'bg-[url(https://images.example.com/a1.jpg)]', 'bg-cover', 'bg-center']),
    );
  });

  it('refuses an inline upload on a tree image, and sets it on an image block', async () => {
    const user = userEvent.setup();
    const big = hosted('big', { url: `data:image/webp;base64,${'A'.repeat(5000)}` });
    const kernel = createDesignTestKernel({
      tree: IMAGE_TREE,
      assets: { big },
      extraNodes: { pic: { id: 'pic', type: 'picture', props: { image: { absent: true, reason: 'none yet' } } } },
    });
    const { rerender } = render(<AssetManager site={kernel} target={imgTarget} />);
    await user.click(screen.getByRole('button', { name: 'Use on selected' }));
    expect(screen.getByRole('status')).toHaveTextContent('Use it on an image block');
    expect(kernel.transactions()).toHaveLength(0);

    rerender(<AssetManager site={kernel} target={{ kind: 'block', nodeId: 'pic' }} />);
    await user.click(screen.getByRole('button', { name: 'Use on selected' }));
    expect(kernel.page('home').getDocument().nodes['pic']?.props['image']).toEqual({ assetId: 'big' });
  });

  it('registers and uses a catalogue photo in one transaction', async () => {
    const user = userEvent.setup();
    const catalogue: AssetLibraryPort = { list: () => Promise.resolve([hosted('cat-1')]) };
    const kernel = createDesignTestKernel({ tree: IMAGE_TREE });
    render(<AssetManager site={kernel} library={catalogue} target={imgTarget} />);
    const library = await screen.findByRole('region', { name: 'Photo library' });
    await user.click(await within(library).findByRole('button', { name: /Photo cat-1/u }));
    expect(kernel.getSite().assets['cat-1']).toBeDefined();
    expect(imageAt(homeTree(kernel), 0)?.attributes?.src).toBe('https://images.example.com/cat-1.jpg');
    expect(kernel.transactions()).toHaveLength(1);
  });

  it('crops the selected image as classes, by keyboard, in one transaction', async () => {
    const user = userEvent.setup();
    const kernel = createDesignTestKernel({ tree: IMAGE_TREE });
    render(<AssetManager site={kernel} target={imgTarget} />);
    await user.click(screen.getByRole('button', { name: 'Crop the selected image' }));
    await user.click(screen.getByLabelText('Square'));
    screen.getByRole('slider', { name: 'Focal point' }).focus();
    await user.keyboard('{Shift>}{ArrowUp}{/Shift}');
    await user.click(screen.getByRole('button', { name: 'Apply crop' }));
    expect(imageAt(homeTree(kernel), 0)?.className?.split(' ').sort()).toEqual(
      ['aspect-square', 'object-[50%_40%]', 'object-cover', 'rounded-lg'].sort(),
    );
    expect(kernel.transactions()).toHaveLength(1);
  });

  it('inserts an icon into the selected element from the Icons tab', async () => {
    const user = userEvent.setup();
    const kernel = createDesignTestKernel({ tree: IMAGE_TREE });
    render(<AssetManager site={kernel} target={boxTarget} />);
    await user.click(screen.getByRole('tab', { name: 'Icons' }));
    await user.selectOptions(screen.getByLabelText('Icon set'), 'lucide');
    await user.type(screen.getByLabelText('Search icons'), 'mail');
    await user.click(screen.getByRole('button', { name: 'mail' }));
    const box = imageAt(homeTree(kernel), 1);
    expect(box?.children).toEqual([{ kind: 'icon', name: 'mail' }]);
  });

  it('speaks Arabic', () => {
    const kernel = createDesignTestKernel();
    render(<AssetManager site={kernel} labels={ASSET_MANAGER_LABELS_AR} dir="rtl" />);
    expect(screen.getByRole('region', { name: 'الوسائط' })).toHaveAttribute('dir', 'rtl');
    expect(screen.getByRole('tab', { name: 'الأيقونات' })).toBeVisible();
  });
});
