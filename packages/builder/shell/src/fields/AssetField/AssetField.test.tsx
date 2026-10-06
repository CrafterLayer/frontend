import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { imagePropSchema, type AssetEntry, type AssetLibraryPort } from '@craftkit/builder-schema';

import { FieldServicesProvider } from '../field-services';
import { AssetField } from './AssetField';

afterEach(cleanup);

const entry = (id: string, description: string): AssetEntry => ({
  id,
  url: `https://images.example/${id}.jpg`,
  description,
  mood: [],
  palette: [],
  alt: `${description} picture`,
  width: 100,
  height: 100,
});
const library: AssetLibraryPort = {
  list: () => Promise.resolve([entry('hills', 'Hills'), entry('sea', 'Sea')]),
};

const props = (overrides: Record<string, unknown> = {}) => ({
  schema: imagePropSchema,
  value: { assetId: 'hills' } as unknown,
  path: ['props', 'asset'],
  onChange: vi.fn(),
  ...overrides,
});

describe('AssetField', () => {
  it('shows the held picture by its description, never as JSON', async () => {
    render(
      <FieldServicesProvider value={{ assetLibrary: library }}>
        <AssetField {...props()} />
      </FieldServicesProvider>,
    );
    expect(await screen.findByText('Chosen: Hills')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Hills picture' })).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('{"assetId"');
  });

  it('picks another picture from the library as ONE write of { assetId }', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FieldServicesProvider value={{ assetLibrary: library }}>
        <AssetField {...props({ onChange })} />
      </FieldServicesProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Choose from library' }));
    await user.click(await screen.findByRole('button', { name: /Sea picture/u }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ assetId: 'sea' });
  });

  it('Remove image writes a stated absence (the schema’s law)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AssetField {...props({ onChange })} />);
    await user.click(screen.getByRole('button', { name: 'Remove image' }));
    const written = (onChange.mock.calls[0] as unknown[])[0];
    expect(imagePropSchema.safeParse(written).success).toBe(true);
    expect(written).toMatchObject({ absent: true });
  });

  it('without a library: asset id entry, committed once on blur', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AssetField {...props({ onChange, value: { absent: true, reason: 'none yet' } })} />);
    expect(screen.getByText('No image (none yet)')).toBeInTheDocument();
    const input = screen.getByRole('textbox', { name: 'Asset id' });
    await user.type(input, 'hero-1');
    expect(onChange).not.toHaveBeenCalled();
    await user.tab();
    expect(onChange).toHaveBeenCalledWith({ assetId: 'hero-1' });
  });

  it('Arabic copy under an Arabic provider', () => {
    render(
      <FieldServicesProvider value={{ locale: 'ar' }}>
        <AssetField {...props({ value: undefined })} />
      </FieldServicesProvider>,
    );
    expect(screen.getByText('بلا صورة')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'معرّف الصورة' })).toBeInTheDocument();
  });
});
