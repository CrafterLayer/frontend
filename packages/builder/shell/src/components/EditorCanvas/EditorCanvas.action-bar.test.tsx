import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { fake, floatingHarness } from './EditorCanvas.floating.test-helpers';

describe('EditorCanvas floating toolbars (009 US2/US3)', () => {
  it('US3/AC1: selecting a block raises its action bar, named after the block', () => {
    const h = floatingHarness();
    h.tick();
    expect(h.bar()).toBeNull();

    act(() => {
      h.kernel.setSelection(['pr']);
    });
    h.tick();
    const bar = h.bar();
    expect(bar?.getAttribute('role')).toBe('toolbar');
    expect(bar?.getAttribute('aria-label')).toBe('Actions for Prose');
    expect(h.host('actions')?.style.visibility).toBe('visible');
  });

  it('Enter activates a block action — the canvas must not eat its own chrome\u2019s keys', async () => {
    /*
      Measured on a fresh page: with Delete focused, Enter left the document
      untouched and threw focus into the iframe, while Space on the SAME button
      deleted correctly. A button that answers one activation key and not the
      other is broken for keyboard users, and the button was never the problem —
      the canvas host's `onKeyDown` claims Enter to begin an inline edit and
      calls `preventDefault`, and the floating chrome renders inside that host,
      so the key bubbled to it and its native activation was cancelled.
    */
    const h = floatingHarness();
    act(() => {
      h.kernel.setSelection(['pr']);
    });
    h.tick();

    const button = [
      ...h.view.container.querySelectorAll<HTMLButtonElement>('.bldr-block-actions button'),
    ].find((candidate) => candidate.textContent === 'Duplicate');
    expect(button).toBeDefined();
    if (button === undefined) {
      throw new Error('the block action bar rendered no Duplicate button');
    }
    let applied = 0;
    h.kernel.context.events.on('tx.applied', () => {
      applied += 1;
    });
    const before = h.kernel.getDocument().nodes['root']?.slots?.['default']?.length ?? 0;

    button.focus();
    expect(button).toHaveFocus();
    await userEvent.keyboard('{Enter}');

    expect(applied).toBe(1);
    expect(h.kernel.getDocument().nodes['root']?.slots?.['default']).toHaveLength(before + 1);
  });

  it('US3/AC2: an action is ONE transaction with the defined resulting selection', () => {
    const h = floatingHarness();
    act(() => {
      h.kernel.setSelection(['pr']);
    });
    h.tick();
    let applied = 0;
    h.kernel.context.events.on('tx.applied', () => {
      applied += 1;
    });
    const before = h.kernel.getDocument().nodes['root']?.slots?.['default']?.length ?? 0;

    act(() => {
      // BY NAME, not by position: Select parent now leads the bar and dispatches
      // nothing, so a positional pick would silently test a different action.
      [...h.view.container.querySelectorAll<HTMLButtonElement>('.bldr-block-actions button')]
        .find((button) => button.textContent === 'Duplicate')
        ?.click();
    });
    expect(applied).toBe(1);
    expect(h.kernel.getDocument().nodes['root']?.slots?.['default']).toHaveLength(before + 1);
    // Duplicate leaves the DUPLICATE selected — the bar follows the new node.
    const selected = h.kernel.context.store.getState().selection[0];
    expect(selected).not.toBe('pr');
    expect(selected === undefined ? undefined : h.kernel.getDocument().nodes[selected]?.type).toBe(
      'prose',
    );
  });

  it('US3/AC3: what cannot apply is DISABLED, never missing (stable layout)', () => {
    const h = floatingHarness();
    act(() => {
      h.kernel.setSelection(['h1']); // first child: nothing earlier to move to
    });
    h.tick();
    const labels = [...(h.bar()?.querySelectorAll('button') ?? [])].map((button) => [
      button.textContent,
      button.disabled,
    ]);
    expect(labels).toEqual([
      // Select parent leads and is open here: `h1` sits inside the page root.
      ['Select parent', false],
      ['Duplicate', false],
      ['Delete', false],
      ['Move earlier', true],
      ['Move later', false],
      ['Edit text', false],
      ['Deselect', false],
    ]);

    act(() => {
      h.kernel.setSelection(['root']); // the root can be none of these things
    });
    h.tick();
    const rootLabels = [...(h.bar()?.querySelectorAll('button') ?? [])].map((button) => [
      button.textContent,
      button.disabled,
    ]);
    // ...except left: the page background selects the root on purpose, so the
    // root, of all nodes, must offer a way out.
    expect(rootLabels).toEqual([
      ['Select parent', true],
      ['Duplicate', true],
      ['Delete', true],
      ['Move earlier', true],
      ['Move later', true],
      ['Deselect', false],
    ]);
  });

  it('Deselect in the bar clears the selection with ZERO dispatches and hands focus to the host', () => {
    const h = floatingHarness();
    const host = screen.getByRole('region', { name: 'Editor canvas' });
    act(() => {
      h.kernel.setSelection(['h1']);
    });
    h.tick();
    const before = h.kernel.transactions().length;
    const deselect = [...(h.bar()?.querySelectorAll('button') ?? [])].find(
      (button) => button.textContent === 'Deselect',
    );
    expect(deselect).toBeDefined();
    if (deselect === undefined) {
      throw new Error('the block action bar rendered no Deselect button');
    }
    // The pointer sees the shortcut; the accessible name stays the bare label.
    expect(deselect.title).toBe('Deselect (Esc)');

    deselect.focus();
    act(() => {
      deselect.click();
    });

    expect(h.kernel.context.store.getState().selection).toEqual([]);
    expect(h.kernel.transactions()).toHaveLength(before);
    expect(h.bar()).toBeNull(); // the bar belongs to a selection; none, no bar
    // The button unmounted under the focus it held — focus moved to the host
    // FIRST, so a keyboard user is not dropped on the document body.
    expect(host).toHaveFocus();
    expect(screen.getByRole('status', { name: 'Selection' })).toHaveTextContent(
      'Selection cleared',
    );
  });

  it('Escape while a bar button has focus climbs to the parent — the bar is inside the host', async () => {
    const h = floatingHarness();
    const host = screen.getByRole('region', { name: 'Editor canvas' });
    act(() => {
      h.kernel.setSelection(['h1']);
    });
    h.tick();
    const duplicate = [...(h.bar()?.querySelectorAll('button') ?? [])].find(
      (button) => button.textContent === 'Duplicate',
    );
    if (duplicate === undefined) {
      throw new Error('the block action bar rendered no Duplicate button');
    }
    duplicate.focus();
    expect(duplicate).toHaveFocus();

    await userEvent.keyboard('{Escape}');

    expect(h.kernel.context.store.getState().selection).toEqual(['root']);
    expect(h.bar()).not.toBeNull();
    expect(host).toHaveFocus();
  });

  it('US3/a1: Edit text opens the inline session with ZERO dispatches', () => {
    const h = floatingHarness();
    act(() => {
      h.kernel.setSelection(['h1']);
    });
    h.tick();
    const before = h.kernel.transactions().length;
    const editText = [...(h.bar()?.querySelectorAll('button') ?? [])].find(
      (button) => button.textContent === 'Edit text',
    );

    act(() => {
      editText?.click();
    });

    expect(h.kernel.transactions()).toHaveLength(before);
    expect(h.frameDocument.querySelector('.bldr-inline-text')).not.toBeNull();
    expect(h.bar()).toBeNull();
  });

  // Any live editing surface, whichever kind owns the node: the built-in plain
  // and rich surfaces, or a contributed editor. The handle closes a SESSION, so
  // the guarantee must hold for every surface a session can mount.
  const EDITING_SURFACES = '.bldr-inline-text, .bldr-inline-rich, [data-testid="fake-inline"]';

  it.each([
    ['a contributed editor', true],
    ['the built-in rich surface', false],
  ])(
    'hands the host a way to END an inline session it does not own — %s (011 edge case 7)',
    async (_label, contributedEditor) => {
      // The code view is a SECOND editing surface over the same node. Without
      // this, opening it left the inline editor live underneath — two editors,
      // one document (011 T033 review, finding 1).
      const h = floatingHarness({ contributedEditor });
      const handle = h.inlineEdit.handle;
      if (handle === null) {
        throw new Error('the editable canvas must hand out an inline-edit handle');
      }

      expect(handle.isEditing()).toBe(false);
      await h.openRich();
      expect(handle.isEditing()).toBe(true);
      expect(h.frameDocument.querySelector(EDITING_SURFACES)).not.toBeNull();

      const before = h.kernel.transactions().length;
      act(() => {
        handle.end();
      });

      expect(handle.isEditing()).toBe(false);
      expect(h.frameDocument.querySelector(EDITING_SURFACES)).toBeNull();
      // Ending is not committing: the host asked to close a surface, not to
      // record an edit, so the change history must not move.
      expect(h.kernel.transactions()).toHaveLength(before);
      // Idempotent — a host that ends twice must not throw or dispatch.
      act(() => {
        handle.end();
      });
      expect(h.kernel.transactions()).toHaveLength(before);
    },
  );

  it('US3/AC4: the bar is absent during a drag, and absent on a read-only canvas', () => {
    const h = floatingHarness();
    act(() => {
      h.kernel.setSelection(['pr']);
    });
    h.tick();
    expect(h.bar()).not.toBeNull();

    // A press that crosses the threshold suppresses hover chrome and the bar.
    act(() => {
      h.pressOn('pr', 10, 10);
      h.dragTo(60, 90);
    });
    h.tick();
    expect(h.bar()).toBeNull();

    act(() => {
      h.frameDocument.dispatchEvent(new MouseEvent('pointerup', {}));
    });
    h.tick();
    expect(h.bar()).not.toBeNull(); // and back, without a second gesture
  });

  it('US3: a read-only canvas has no action bar at all (B2a stays byte-compatible)', () => {
    const h = floatingHarness({ editable: false });
    act(() => {
      h.kernel.setSelection(['pr']);
    });
    h.tick();
    expect(h.bar()).toBeNull();
  });

  it('US3: the bar stands down while the block is being edited in place', async () => {
    const h = floatingHarness();
    await h.openRich();
    // Two toolbars over one block is noise: the bubble owns this moment.
    expect(h.bar()).toBeNull();

    act(() => {
      fake?.exit();
    });
    h.tick();
    expect(h.bar()).not.toBeNull();
  });
});
