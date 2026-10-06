import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { AssetEntry, AssetLibraryPort } from '@craftkit/builder-schema';

import { FieldServicesProvider } from '../field-services';
import { isAcceptableImageSrc } from '../image-src';
import { ImageUrlField } from './ImageUrlField';

afterEach(cleanup);

const ENTRY: AssetEntry = {
  id: 'a1',
  url: 'https://images.example/sunrise.jpg',
  description: 'Sunrise over hills',
  mood: ['warm'],
  palette: [],
  alt: 'A sunrise',
  width: 1200,
  height: 800,
};
const library: AssetLibraryPort = { list: () => Promise.resolve([ENTRY]) };

const props = (overrides: Record<string, unknown> = {}) => ({
  schema: z.string() as z.ZodType,
  value: '/img/hero.png' as unknown,
  path: ['props', 'imageSrc'],
  onChange: vi.fn(),
  ...overrides,
});

describe('isAcceptableImageSrc', () => {
  it('accepts http(s), paths and inline pictures; refuses scripts and non-pictures', () => {
    expect(isAcceptableImageSrc('https://a.b/c.png')).toBe(true);
    expect(isAcceptableImageSrc('/uploads/x.webp')).toBe(true);
    expect(isAcceptableImageSrc('data:image/svg+xml,%3Csvg%3E')).toBe(true);
    expect(isAcceptableImageSrc('')).toBe(true);
    expect(isAcceptableImageSrc('javascript:alert(1)')).toBe(false);
    expect(isAcceptableImageSrc('mailto:a@b.c')).toBe(false);
  });
});

describe('ImageUrlField', () => {
  it('without a library: URL entry, committed once on Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ImageUrlField {...props({ onChange })} />);
    expect(screen.queryByRole('button', { name: 'Choose from library' })).toBeNull();
    const input = screen.getByRole('textbox', { name: 'Image address' });
    expect(input).toHaveAttribute('dir', 'ltr');
    await user.clear(input);
    await user.type(input, 'https://cdn.example/new.png');
    expect(onChange).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('https://cdn.example/new.png');
  });

  it('refuses an unsafe address with a sentence', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ImageUrlField {...props({ onChange })} />);
    const input = screen.getByRole('textbox', { name: 'Image address' });
    await user.clear(input);
    await user.type(input, 'javascript:x{Enter}');
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('That image address is not allowed');
  });

  it('with a library: picks a picture and writes its address once', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FieldServicesProvider value={{ assetLibrary: library }}>
        <ImageUrlField {...props({ onChange })} />
      </FieldServicesProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Choose from library' }));
    await user.click(await screen.findByRole('button', { name: /Sunrise over hills/u }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(ENTRY.url);
    expect(screen.getByRole('button', { name: 'Choose from library' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('labels the library in Arabic under an Arabic provider', () => {
    render(
      <FieldServicesProvider value={{ assetLibrary: library, locale: 'ar' }}>
        <ImageUrlField {...props()} />
      </FieldServicesProvider>,
    );
    expect(screen.getByRole('button', { name: 'اختر من المكتبة' })).toBeInTheDocument();
  });
});
