/**
 * EnhanceNote: what ✨ Improve did, docked on the text it rewrote.
 *
 * Ours to prove: nothing is drawn unless it improved or failed; improved, it is a group
 * named "Request improved" with the understood line (the model's words in `<bdi>`, in
 * their own direction), a disclosure for the changes (`aria-expanded`, `aria-controls`,
 * the closed list inert), and Restore my text when the person's words can come back;
 * failed, one honest line with the cause when it is known. It is not a live region.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { t, type Key } from '../../copy';
import type { EnhancementView, FailureClass } from '../../model/view-types';
import { enhancement } from '../../testing/wp-14-composer-fixtures';

import { EnhanceNote } from './EnhanceNote';

const ENHANCED = enhancement('en', 'enhanced');

describe('EnhanceNote', () => {
  it.each([{ status: 'idle' }, { status: 'enhancing' }, { status: 'unavailable' }] as const)(
    'draws nothing while %o',
    (view) => {
      const { container } = render(<EnhanceNote locale="en" enhancement={view} onRestore={vi.fn()} />);
      expect(container).toBeEmptyDOMElement();
    },
  );

  it('names the group, and says what was understood in the model’s own words', () => {
    const { container } = render(<EnhanceNote locale="en" enhancement={ENHANCED} onRestore={vi.fn()} />);
    const group = screen.getByRole('group', { name: t('en', 'enhance.done') });
    expect(group).toHaveTextContent('Understood: A darker hero with a WhatsApp booking button');
    expect(container.querySelector('[aria-live], [role="status"], [role="alert"]')).toBeNull();
  });

  it('isolates an Arabic restatement in the English panel, in its own direction', () => {
    const view: EnhancementView = {
      status: 'enhanced',
      understood: 'واجهة أغمق مع زر حجز',
      changes: [],
      canRestore: true,
    };
    const { container } = render(<EnhanceNote locale="en" enhancement={view} onRestore={vi.fn()} />);
    const bdi = container.querySelector('bdi');
    expect(bdi).toHaveTextContent('واجهة أغمق مع زر حجز');
    expect(bdi).toHaveAttribute('dir', 'rtl');
  });

  it('shows the changes behind a disclosure, inert while closed', async () => {
    const user = userEvent.setup();
    render(<EnhanceNote locale="en" enhancement={ENHANCED} onRestore={vi.fn()} />);
    const toggle = screen.getByRole('button', { name: 'Show changes (3)' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const region = document.getElementById(toggle.getAttribute('aria-controls') ?? '');
    if (region === null) throw new Error('the disclosure controls no region');
    expect(region).toHaveAttribute('inert');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAccessibleName(t('en', 'enhance.changes.hide'));
    expect(region).not.toHaveAttribute('inert');
    const items = within(region).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'Named the section: the hero',
      'Placed the button below the headline',
      'Spelled out “button”',
    ]);
  });

  it('offers Restore my text, and only while the person’s words can come back', async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn();
    const { rerender } = render(
      <EnhanceNote locale="ar" enhancement={enhancement('ar', 'enhanced')} onRestore={onRestore} />,
    );
    await user.click(screen.getByRole('button', { name: 'استعادة نصّي' }));
    expect(onRestore).toHaveBeenCalledTimes(1);

    const noRestore = enhancement('ar', 'enhanced');
    if (noRestore.status !== 'enhanced') throw new Error('fixture');
    rerender(
      <EnhanceNote locale="ar" enhancement={{ ...noRestore, canRestore: false }} onRestore={onRestore} />,
    );
    expect(screen.queryByRole('button', { name: 'استعادة نصّي' })).toBeNull();
  });

  it('draws no disclosure when nothing changed but the wording', () => {
    render(
      <EnhanceNote
        locale="en"
        enhancement={{ status: 'enhanced', understood: 'A darker hero', changes: [], canRestore: true }}
        onRestore={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /changes/iu })).toBeNull();
  });

  it.each([
    ['timeout', 'enhance.failed.timeout'],
    ['unreachable', 'enhance.failed.unreachable'],
    ['busy', 'enhance.failed.busy'],
    ['invalid', 'enhance.failed.other'],
    ['declined', 'enhance.failed.other'],
    ['unknown', 'enhance.failed.other'],
  ] as const satisfies readonly (readonly [FailureClass, Key])[])(
    'failed (%s): one honest line, and no Restore',
    (reason, caption) => {
      render(
        <EnhanceNote locale="en" enhancement={{ status: 'failed', reason }} onRestore={vi.fn()} />,
      );
      const group = screen.getByRole('group', { name: t('en', 'enhance.failed') });
      expect(group).toHaveAccessibleDescription(t('en', caption));
      expect(within(group).queryByRole('button')).toBeNull();
    },
  );
});
