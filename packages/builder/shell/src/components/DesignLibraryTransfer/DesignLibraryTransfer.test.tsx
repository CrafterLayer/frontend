import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { defaultDesignSystem, setUtilityClassOracle, type CustomCodeRoot, type SiteLibrary } from '@craftkit/builder-schema';

import { createDesignTestKernel } from '../DesignSystemPanel/design-test-site';
import { DesignLibraryTransfer } from './DesignLibraryTransfer';
import { DESIGN_LIBRARY_TRANSFER_LABELS_AR } from './DesignLibraryTransfer.labels';
import { exportDesignFile, importedLibrary, parseDesignFile, type DesignFile } from './design-transfer';

beforeAll(() => {
  setUtilityClassOracle((name) => !name.startsWith('bogus'));
});
afterAll(() => {
  setUtilityClassOracle(undefined);
});
afterEach(cleanup);

const SOURCE_LIBRARY: SiteLibrary = {
  palette: [{ id: 'sand', name: 'Sand', value: '#e7d8b8' }],
  styles: { card: { id: 'card', name: 'Card', className: 'rounded-xl p-6' } },
  fonts: [{ family: 'Cairo', source: 'google', weights: [400, 700] }],
  symbols: {
    banner: { id: 'banner', name: 'Banner', tree: { kind: 'root', children: [{ kind: 'element', tag: 'p', text: 'x' }] } },
  },
};

function designFile(): DesignFile {
  const source = createDesignTestKernel({ library: SOURCE_LIBRARY });
  source.dispatch('setDesignToken', { token: 'radiusLg', value: '22px' });
  return exportDesignFile(source.getSite());
}

const jsonFile = (value: unknown) =>
  new File([typeof value === 'string' ? value : JSON.stringify(value)], 'design.json', { type: 'application/json' });

describe('design file', () => {
  it('exports the look only: tokens, palette, styles and fonts, never symbols', () => {
    const file = designFile();
    expect(file.format).toBe('craftkit-design');
    expect(file.v).toBe(1);
    expect(Object.keys(file.library).sort()).toEqual(['fonts', 'palette', 'styles']);
    expect(file.designSystem.tokens.radiusLg).toBe('22px');
  });

  it('round-trips through JSON', () => {
    const file = designFile();
    const parsed = parseDesignFile(JSON.stringify(file));
    expect(parsed).toEqual({ ok: true, file });
  });

  it('refuses what is not a design file, or carries what the door refuses', () => {
    expect(parseDesignFile('{')).toEqual({ ok: false, message: 'The file is not JSON.' });
    expect(parseDesignFile('{"format":"other"}').ok).toBe(false);
    expect(parseDesignFile(JSON.stringify({ ...designFile(), v: 2 }))).toMatchObject({ ok: false });
    const bogus = designFile();
    bogus.library.styles = { bad: { id: 'bad', name: 'Bad', className: 'bogus-1' } };
    const refused = parseDesignFile(JSON.stringify(bogus));
    expect(!refused.ok && refused.message).toContain('Unknown utility');
    const extra = { ...designFile(), library: { ...designFile().library, symbols: {} } };
    const extraRefused = parseDesignFile(JSON.stringify(extra));
    expect(!extraRefused.ok && extraRefused.message).toContain('found symbols');
  });

  it('merges by default and keeps used entries even when replacing', () => {
    const tree: CustomCodeRoot = { kind: 'root', children: [{ kind: 'element', tag: 'p', className: 'ck-s-old', text: 'x' }] };
    const target = createDesignTestKernel({
      tree,
      library: {
        styles: {
          old: { id: 'old', name: 'Old', className: 'p-2' },
          spare: { id: 'spare', name: 'Spare', className: 'p-3' },
        },
        settings: { smoothScroll: true },
      },
    });
    const file = designFile();
    const merged = importedLibrary(target.getSite(), file, false);
    expect(Object.keys(merged.styles ?? {}).sort()).toEqual(['card', 'old', 'spare']);
    const replaced = importedLibrary(target.getSite(), file, true);
    expect(Object.keys(replaced.styles ?? {}).sort()).toEqual(['card', 'old']);
    expect(replaced.settings).toEqual({ smoothScroll: true });
  });
});

describe('DesignLibraryTransfer', () => {
  it('exports a downloadable JSON named after the system', async () => {
    const user = userEvent.setup();
    const onDownload = vi.fn<(json: string, fileName: string) => void>();
    const kernel = createDesignTestKernel({ library: SOURCE_LIBRARY });
    render(<DesignLibraryTransfer site={kernel} onDownload={onDownload} />);
    await user.click(screen.getByRole('button', { name: 'Export design system' }));
    const [json, name] = onDownload.mock.calls[0] ?? ['', ''];
    expect(name).toMatch(/\.craftkit-design\.json$/u);
    expect(parseDesignFile(json).ok).toBe(true);
  });

  it('previews the import, then applies it as ONE transaction that one Undo reverses', async () => {
    const user = userEvent.setup();
    const kernel = createDesignTestKernel();
    const before = kernel.getSite();
    render(<DesignLibraryTransfer site={kernel} />);

    await user.upload(screen.getByLabelText('Design file (.json)'), jsonFile(designFile()));
    const preview = await screen.findByRole('group', { name: 'What the import changes' });
    expect(preview).toHaveTextContent('1 token change');
    expect(preview).toHaveTextContent('Palette: 1 added, 0 changed, 0 removed');
    expect(kernel.transactions()).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Import' }));
    expect(kernel.getSite().designSystem.tokens.radiusLg).toBe('22px');
    expect(kernel.getSite().library?.styles?.['card']).toBeDefined();
    expect(kernel.getSite().library?.symbols).toBeUndefined();
    expect(kernel.transactions()).toHaveLength(1);

    act(() => {
      kernel.undo();
    });
    expect(kernel.getSite().designSystem).toEqual(before.designSystem);
    expect(kernel.getSite().library).toBeUndefined();
  });

  it('shows why a file is refused and imports nothing', async () => {
    const user = userEvent.setup();
    const kernel = createDesignTestKernel();
    render(<DesignLibraryTransfer site={kernel} />);
    await user.upload(screen.getByLabelText('Design file (.json)'), jsonFile('not json'));
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('The file is not JSON.');
    });
    expect(screen.queryByRole('button', { name: 'Import' })).toBeNull();
    expect(kernel.getSite().designSystem).toEqual(defaultDesignSystem());
  });

  it('speaks Arabic', () => {
    const kernel = createDesignTestKernel();
    render(<DesignLibraryTransfer site={kernel} labels={DESIGN_LIBRARY_TRANSFER_LABELS_AR} dir="rtl" />);
    expect(screen.getByRole('region', { name: 'استيراد نظام التصميم وتصديره' })).toHaveAttribute('dir', 'rtl');
  });
});
