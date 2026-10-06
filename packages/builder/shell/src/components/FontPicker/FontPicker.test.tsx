import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SiteFont } from '@craftkit/builder-schema';

import { FontPicker } from './FontPicker';
import { FONT_PICKER_LABELS_AR } from './FontPicker.labels';
import type { CatalogueFont } from './font-catalogue';

afterEach(cleanup);

const woff2File = (name: string, size = 256): File => {
  const bytes = new Uint8Array(size);
  bytes.set([0x77, 0x4f, 0x46, 0x32]);
  return new File([bytes], name, { type: 'font/woff2' });
};

describe('FontPicker', () => {
  it('previews a face in both scripts only when it carries Arabic', () => {
    render(<FontPicker onPick={vi.fn()} loadPreviews={false} />);
    const cairo = screen.getByRole('button', { name: /^Cairo/u });
    expect(within(cairo).getByText('نص عربي جميل للتجربة')).toHaveAttribute('dir', 'rtl');
    const inter = screen.getByRole('button', { name: /^Inter/u });
    expect(within(inter).queryByText('نص عربي جميل للتجربة')).toBeNull();
  });

  it('filters to Arabic faces and by search, and says when nothing matches', async () => {
    const user = userEvent.setup();
    render(<FontPicker onPick={vi.fn()} loadPreviews={false} />);
    await user.click(screen.getByLabelText('Arabic fonts only'));
    expect(screen.queryByRole('button', { name: /^Inter/u })).toBeNull();
    await user.type(screen.getByLabelText('Search fonts'), 'kufi');
    const list = screen.getByRole('list', { name: 'Font families' });
    expect(within(list).getAllByRole('button').map((button) => button.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining('Noto Kufi Arabic'), expect.stringContaining('Reem Kufi')]),
    );
    await user.type(screen.getByLabelText('Search fonts'), 'zzz');
    expect(screen.getByText('No font matches.')).toBeVisible();
  });

  it('hands the chosen family to the host and marks the one in use', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn<(font: CatalogueFont) => void>();
    render(<FontPicker onPick={onPick} value="Tajawal" loadPreviews={false} />);
    expect(screen.getByRole('button', { name: /^Tajawal/u })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: /^Almarai/u }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ family: 'Almarai', arabic: true }));
  });

  it('uploads a WOFF2 once, with the family taken from the file name', async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn<(font: SiteFont) => void>();
    render(<FontPicker onPick={vi.fn()} onUpload={onUpload} loadPreviews={false} />);
    await user.upload(screen.getByLabelText('WOFF2 file (up to 600 kB)'), woff2File('Brand-Sans.woff2'));
    expect(screen.getByLabelText('Family name')).toHaveValue('Brand-Sans');
    await user.click(screen.getByRole('button', { name: 'Upload a font' }));
    await waitFor(() => {
      expect(onUpload).toHaveBeenCalledTimes(1);
    });
    expect(onUpload.mock.calls[0]?.[0]).toMatchObject({ family: 'Brand-Sans', source: 'upload', weights: [400] });
  });

  it('refuses a file that is not WOFF2, in words', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const onUpload = vi.fn<(font: SiteFont) => void>();
    render(<FontPicker onPick={vi.fn()} onUpload={onUpload} loadPreviews={false} />);
    const ttf = new File([new Uint8Array([0, 1, 0, 0, 1, 2])], 'face.ttf', { type: 'font/ttf' });
    await user.upload(screen.getByLabelText('WOFF2 file (up to 600 kB)'), ttf);
    await user.click(screen.getByRole('button', { name: 'Upload a font' }));
    expect(await screen.findByText(/not a WOFF2 font/u)).toBeVisible();
    expect(onUpload).not.toHaveBeenCalled();
  });

  it('links each previewed family once, only from the font hosts', () => {
    render(<FontPicker onPick={vi.fn()} />);
    const links = Array.from(document.head.querySelectorAll('link[data-bldr-font-preview]'));
    expect(links.length).toBeGreaterThan(20);
    expect(links.every((link) => link.getAttribute('href')?.startsWith('https://fonts.googleapis.com/'))).toBe(true);
    cleanup();
    render(<FontPicker onPick={vi.fn()} />);
    expect(document.head.querySelectorAll('link[data-bldr-font-preview]')).toHaveLength(links.length);
  });

  it('speaks Arabic', () => {
    render(<FontPicker onPick={vi.fn()} labels={FONT_PICKER_LABELS_AR} dir="rtl" arabicFirst loadPreviews={false} />);
    expect(screen.getByRole('region', { name: 'الخطوط' })).toHaveAttribute('dir', 'rtl');
    expect(screen.getByLabelText('الخطوط العربية فقط')).toBeChecked();
  });
});
