import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SourceImpactBar } from './SourceImpactBar';

afterEach(cleanup);

describe('SourceImpactBar', () => {
  it('applies an instance change without manufacturing a shared approval', async () => {
    const onApply = vi.fn();
    render(
      <SourceImpactBar
        impact={{ kind: 'instance', pageId: 'home', instanceId: 'hero-one' }}
        onApply={onApply}
      />,
    );

    expect(screen.getByText('Instance only')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Apply to instance' }));
    expect(onApply).toHaveBeenCalledOnce();
    expect(onApply).toHaveBeenCalledWith(undefined);
  });

  it('discloses every affected shared identity and passes its fingerprint unchanged', async () => {
    const onApply = vi.fn();
    const approval = {
      fingerprint: 'impact-current',
      pageIds: ['home', 'pricing'],
      instanceIds: ['header-home', 'header-pricing', 'header-footer'],
    };
    render(
      <SourceImpactBar
        impact={{ kind: 'shared', componentName: 'Site header', approval }}
        onApply={onApply}
      />,
    );

    expect(screen.getByText('Site header · 3 instances · 2 pages')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Apply shared change' }));
    expect(onApply).toHaveBeenCalledWith(approval);
  });

  it('refuses stale impact until the host recomputes it', async () => {
    const onApply = vi.fn();
    const onRefresh = vi.fn();
    render(
      <SourceImpactBar
        stale
        impact={{
          kind: 'shared',
          componentName: 'Site footer',
          approval: {
            fingerprint: 'impact-stale',
            pageIds: ['home'],
            instanceIds: ['footer-home'],
          },
        }}
        onApply={onApply}
        onRefresh={onRefresh}
      />,
    );

    expect(
      screen.getAllByText(/Impact changed/).some((element) => element.tagName === 'SMALL'),
    ).toBe(true);
    expect(screen.getByRole('button', { name: 'Apply shared change' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Refresh impact' }));
    expect(onRefresh).toHaveBeenCalledOnce();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('exposes one labelled region and keyboard-focusable native actions', async () => {
    render(
      <div dir="rtl">
        <SourceImpactBar
          impact={{ kind: 'instance', pageId: 'home' }}
          onOpenSource={() => undefined}
          onApply={() => undefined}
        />
      </div>,
    );

    expect(screen.getByRole('complementary', { name: 'Source change impact' })).toBeVisible();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Open source' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Apply to instance' })).toHaveFocus();
  });
});
