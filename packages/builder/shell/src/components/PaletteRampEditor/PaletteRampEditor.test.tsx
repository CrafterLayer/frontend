import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SiteGroupStep } from '@craftkit/builder-core';

import { createDesignTestKernel } from '../DesignSystemPanel/design-test-site';
import { siteCommitFor, type SiteCommit } from '../DesignSystemPanel/site-door';
import { PaletteRampEditor } from './PaletteRampEditor';
import { PALETTE_RAMP_EDITOR_LABELS_AR } from './PaletteRampEditor.labels';

afterEach(cleanup);

describe('PaletteRampEditor', () => {
  it('previews while typing and writes nothing until asked', async () => {
    const user = userEvent.setup();
    const commit = vi.fn<SiteCommit>(() => ({ ok: true }));
    render(<PaletteRampEditor commit={commit} />);

    const field = screen.getByLabelText('Brand colour');
    await user.clear(field);
    await user.type(field, '#2563eb');

    expect(commit).not.toHaveBeenCalled();
    expect(screen.getByRole('list', { name: 'Shades' }).children).toHaveLength(11);
    expect(screen.getByRole('table', { name: 'Contrast' })).toBeVisible();
  });

  it('adds the whole ramp as ONE transaction, and one Undo takes it back', async () => {
    const user = userEvent.setup();
    const kernel = createDesignTestKernel();
    render(<PaletteRampEditor commit={siteCommitFor(kernel)} defaultName="Sea" />);

    await user.click(screen.getByRole('button', { name: 'Add shades to palette' }));

    const palette = kernel.getSite().library?.palette ?? [];
    expect(palette.map((color) => color.id)).toContain('sea-500');
    expect(palette).toHaveLength(11);
    expect(kernel.transactions()).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('Added 11 colours');

    kernel.undo();
    expect(kernel.getSite().library).toBeUndefined();
  });

  it('labels the transaction with the colour name', async () => {
    const user = userEvent.setup();
    const commit = vi.fn<SiteCommit>(() => ({ ok: true }));
    render(<PaletteRampEditor commit={commit} defaultName="Sand" />);
    await user.click(screen.getByRole('button', { name: 'Add shades to palette' }));

    const [steps, label]: [readonly SiteGroupStep[], string] = commit.mock.calls[0] ?? [[], ''];
    expect(label).toBe('Palette shades · Sand');
    expect(steps.every((step) => step.command === 'setPaletteColor')).toBe(true);
  });

  it('refuses an unparsable colour without offering to add it', async () => {
    const user = userEvent.setup();
    render(<PaletteRampEditor commit={vi.fn<SiteCommit>()} />);
    const field = screen.getByLabelText('Brand colour');
    await user.clear(field);
    await user.type(field, 'blurple');

    expect(screen.getByRole('alert')).toHaveTextContent('Not a colour');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Add shades to palette' })).toBeDisabled();
  });

  it('shows what the door refused', async () => {
    const user = userEvent.setup();
    render(
      <PaletteRampEditor commit={() => ({ ok: false, message: 'The palette is full (120 colours).' })} />,
    );
    await user.click(screen.getByRole('button', { name: 'Add shades to palette' }));
    expect(screen.getByRole('status')).toHaveTextContent('The palette is full');
  });

  it('warns before replacing palette entries that already exist', () => {
    render(
      <PaletteRampEditor commit={vi.fn<SiteCommit>()} existingIds={['brand-500', 'brand-600']} />,
    );
    expect(screen.getByText(/2 existing colours will be replaced/u)).toBeVisible();
  });

  it('speaks Arabic and lays out right to left', () => {
    render(
      <PaletteRampEditor commit={vi.fn<SiteCommit>()} labels={PALETTE_RAMP_EDITOR_LABELS_AR} dir="rtl" />,
    );
    const region = screen.getByRole('region', { name: 'توليد درجات اللون' });
    expect(region).toHaveAttribute('dir', 'rtl');
    expect(screen.getByRole('button', { name: 'أضف الدرجات إلى اللوحة' })).toBeVisible();
  });
});
