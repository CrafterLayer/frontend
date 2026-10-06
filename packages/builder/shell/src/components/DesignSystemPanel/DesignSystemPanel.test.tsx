import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BuilderSiteKernel } from '@craftkit/builder-core';
import { defaultDesignSystem, type DesignSystem, type TokenName } from '@craftkit/builder-schema';

import { createDesignTestKernel } from './design-test-site';
import { DesignSystemPanel } from './DesignSystemPanel';
import { DESIGN_SYSTEM_PANEL_LABELS_AR } from './DesignSystemPanel.labels';
import { siteCommitFor, useSiteSnapshot } from './site-door';

afterEach(cleanup);

const withAccent = (accent: string): DesignSystem => {
  const base = defaultDesignSystem();
  return { ...base, tokens: { ...base.tokens, accent } };
};

/** The panel over a live kernel, the way the host mounts it. */
function Live({ kernel }: { readonly kernel: BuilderSiteKernel }) {
  const site = useSiteSnapshot(kernel);
  return (
    <DesignSystemPanel
      system={site.designSystem}
      library={site.library}
      onChangeToken={() => undefined}
      onCommit={siteCommitFor(kernel)}
      loadFontPreviews={false}
    />
  );
}

describe('DesignSystemPanel', () => {
  it('names the system and offers its four sections', () => {
    render(<DesignSystemPanel system={defaultDesignSystem()} onChangeToken={vi.fn()} />);

    expect(screen.getByRole('region', { name: 'Design system' })).toBeVisible();
    const tabs = within(screen.getByRole('tablist', { name: 'Design system sections' })).getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Colours',
      'Typography',
      'Radius & shadows',
      'Spacing & widths',
    ]);
    expect(screen.getByRole('grid', { name: 'Colour tokens' })).toBeVisible();
    /* Every section stays mounted, so an open draft survives; the others are hidden. */
    expect(screen.getByLabelText('radius lg')).not.toBeVisible();
  });

  it('commits ONE dispatch per edit, not one per keystroke', async () => {
    const user = userEvent.setup();
    const onChangeToken = vi.fn<(token: TokenName, value: string) => void>();
    render(<DesignSystemPanel system={defaultDesignSystem()} onChangeToken={onChangeToken} />);

    const field = screen.getByLabelText('accent');
    await user.clear(field);
    await user.type(field, '#0b5cff');
    expect(onChangeToken).not.toHaveBeenCalled();

    await user.tab();
    expect(onChangeToken).toHaveBeenCalledExactlyOnceWith('accent', '#0b5cff');
  });

  it('says nothing when the value did not change', async () => {
    const user = userEvent.setup();
    const onChangeToken = vi.fn<(token: TokenName, value: string) => void>();
    render(<DesignSystemPanel system={defaultDesignSystem()} onChangeToken={onChangeToken} />);
    await user.click(screen.getByLabelText('accent'));
    await user.tab();
    expect(onChangeToken).not.toHaveBeenCalled();
  });

  it('lets an EXTERNAL write beat an open draft', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <DesignSystemPanel system={withAccent('#111111')} onChangeToken={vi.fn()} />,
    );
    const field = screen.getByLabelText('accent');
    await user.clear(field);
    await user.type(field, '#abcabc');
    rerender(<DesignSystemPanel system={withAccent('#222222')} onChangeToken={vi.fn()} />);
    expect(screen.getByLabelText('accent')).toHaveValue('#222222');
  });

  it('shows the token a person picked from the grid, with its committed value', async () => {
    const user = userEvent.setup();
    render(<DesignSystemPanel system={defaultDesignSystem()} onChangeToken={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /^text muted/u }));
    expect(screen.getByLabelText('textMuted')).toHaveValue(defaultDesignSystem().tokens.textMuted);
  });

  it('ANNOUNCES what the door refused, and ties it to the field', () => {
    render(
      <DesignSystemPanel
        system={defaultDesignSystem()}
        onChangeToken={vi.fn()}
        issues={['"accent" on "surface" measures 1.2:1, below the 4.5:1 this text size needs.']}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('below the 4.5:1');
    const field = screen.getByLabelText('accent');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field.getAttribute('aria-describedby') ?? '').not.toBe('');
  });

  it('withdraws Regenerate rather than disabling an action nobody wired', () => {
    const { rerender } = render(
      <DesignSystemPanel system={defaultDesignSystem()} onChangeToken={vi.fn()} />,
    );
    expect(screen.queryByRole('button', { name: 'Regenerate' })).toBeNull();
    rerender(
      <DesignSystemPanel system={defaultDesignSystem()} onChangeToken={vi.fn()} onRegenerate={vi.fn()} busy />,
    );
    expect(screen.getByRole('button', { name: 'Regenerate' })).toBeDisabled();
    expect(screen.getByLabelText('accent')).toBeDisabled();
  });

  describe('over a live site kernel', () => {
    it('labels a token edit and makes it one Undo', async () => {
      const user = userEvent.setup();
      const kernel = createDesignTestKernel();
      render(<Live kernel={kernel} />);
      await user.click(screen.getByRole('tab', { name: 'Radius & shadows' }));
      const field = screen.getByLabelText('radius lg');
      await user.clear(field);
      await user.type(field, '20px{Enter}');

      expect(kernel.getSite().designSystem.tokens.radiusLg).toBe('20px');
      expect(kernel.transactions().at(-1)?.command).toBe('Design token · radius lg');
      kernel.undo();
      expect(kernel.getSite().designSystem.tokens.radiusLg).toBe(defaultDesignSystem().tokens.radiusLg);
    });

    it('announces a legibility refusal from the door and leaves the site alone', async () => {
      const user = userEvent.setup();
      const kernel = createDesignTestKernel();
      render(<Live kernel={kernel} />);
      const before = kernel.getSite().designSystem.tokens.text;
      await user.click(screen.getByText('text', { selector: '.bldr-swatches__name' }));
      const field = screen.getByLabelText('text');
      await user.clear(field);
      await user.type(field, defaultDesignSystem().tokens.surface + '{Enter}');

      expect(kernel.getSite().designSystem.tokens.text).toBe(before);
      expect(screen.getAllByRole('status')[0]?.textContent).not.toBe('');
      expect(screen.getByLabelText('text')).toHaveAttribute('aria-invalid', 'true');
    });

    it('adds a palette colour, then refuses to remove it while an element uses it', async () => {
      const user = userEvent.setup();
      const kernel = createDesignTestKernel();
      render(<Live kernel={kernel} />);
      await user.type(screen.getByLabelText('New colour name'), 'Sand');
      await user.type(screen.getByLabelText('New colour value'), '#e7d8b8');
      await user.click(screen.getByRole('button', { name: 'Add colour' }));
      expect(kernel.getSite().library?.palette).toEqual([{ id: 'sand', name: 'Sand', value: '#e7d8b8' }]);

      kernel.dispatchGroup(
        [{ command: 'patchTreeNode', args: { id: 'region', path: [0, 0], set: { className: 'bg-(--ck-c-sand)' } } }],
        { author: 'user' },
      );
      await user.click(screen.getByRole('button', { name: 'Remove Sand' }));
      expect(kernel.getSite().library?.palette).toHaveLength(1);
      expect(screen.getAllByRole('status')[0]).toHaveTextContent('still used');
    });

    it('picks a family for a role as ONE transaction: the font loads and the token names it', async () => {
      const user = userEvent.setup();
      const kernel = createDesignTestKernel();
      render(<Live kernel={kernel} />);
      await user.click(screen.getByRole('tab', { name: 'Typography' }));
      await user.click(screen.getByRole('button', { name: /^Tajawal/u }));

      const site = kernel.getSite();
      expect(site.library?.fonts?.[0]).toMatchObject({ family: 'Tajawal', source: 'google' });
      expect(site.designSystem.tokens.fontFamilySans).toBe('"Tajawal", system-ui, sans-serif');
      expect(kernel.transactions()).toHaveLength(1);
      expect(kernel.transactions()[0]?.command).toBe('Font · Sans (body & headings) · Tajawal');

      kernel.undo();
      expect(kernel.getSite().library).toBeUndefined();
      expect(kernel.getSite().designSystem.tokens.fontFamilySans).toBe(
        defaultDesignSystem().tokens.fontFamilySans,
      );
    });
  });

  it('speaks Arabic and follows the editor direction', () => {
    render(
      <DesignSystemPanel
        system={defaultDesignSystem()}
        onChangeToken={vi.fn()}
        labels={DESIGN_SYSTEM_PANEL_LABELS_AR}
        dir="rtl"
      />,
    );
    expect(screen.getByRole('region', { name: 'نظام التصميم' })).toHaveAttribute('dir', 'rtl');
    expect(screen.getByRole('tab', { name: 'الخطوط' })).toBeVisible();
  });
});
