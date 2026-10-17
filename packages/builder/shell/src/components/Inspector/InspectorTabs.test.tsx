import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { InspectorTabs } from './InspectorTabs';
import type { InspectorTabModel } from './types';

const TABS: readonly InspectorTabModel[] = [
  { id: 'content', label: 'Content', sections: [] },
  { id: 'design', label: 'Design', sections: [] },
];

describe('InspectorTabs', () => {
  it('renders a named tablist with roving tabindex and controlled panels', () => {
    const bound = new Map<string, HTMLButtonElement | null>();
    render(
      <InspectorTabs
        tabs={TABS}
        activeTabId="design"
        tabId={(id) => `t-${id}`}
        panelId={(id) => `p-${id}`}
        onSelect={vi.fn()}
        onKeyDown={vi.fn()}
        bindTab={(id) => (element) => {
          bound.set(id, element);
        }}
      />,
    );
    const list = screen.getByRole('tablist', { name: 'Inspector tabs' });
    const [content, design] = within(list).getAllByRole('tab');
    expect(content).toHaveAttribute('id', 't-content');
    expect(content).toHaveAttribute('aria-controls', 'p-content');
    expect(content).toHaveAttribute('aria-selected', 'false');
    expect(content).toHaveAttribute('tabindex', '-1');
    expect(design).toHaveAttribute('aria-selected', 'true');
    expect(design).toHaveAttribute('tabindex', '0');
    expect(bound.get('content')).toBe(content);
    expect(bound.get('design')).toBe(design);
  });

  it('reports clicks and key presses with the tab id', async () => {
    const onSelect = vi.fn();
    const onKeyDown = vi.fn();
    const user = userEvent.setup();
    render(
      <InspectorTabs
        tabs={TABS}
        activeTabId="content"
        tabId={(id) => `t-${id}`}
        panelId={(id) => `p-${id}`}
        onSelect={onSelect}
        onKeyDown={onKeyDown}
        bindTab={() => () => undefined}
      />,
    );
    await user.click(screen.getByRole('tab', { name: 'Design' }));
    expect(onSelect).toHaveBeenCalledWith('design');
    screen.getByRole('tab', { name: 'Content' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(onKeyDown).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'ArrowRight' }),
      'content',
    );
  });
});
