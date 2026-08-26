import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';

function frameDocument(): Document {
  const frame = screen.getByTitle<HTMLIFrameElement>('Preview');
  const doc = frame.contentDocument;
  if (doc === null) {
    throw new Error('no contentDocument');
  }
  return doc;
}

describe('US4 — the playground proves it end-to-end', () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchSpy);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchSpy.mockReset();
  });

  it('scenario 1: the landing fixture renders inside the frame with tokens, and no network is touched', async () => {
    render(<App />);
    await waitFor(() => {
      const doc = frameDocument();
      expect(doc.querySelector('main.bldr-page')).not.toBeNull();
      expect(doc.body.textContent).toContain('Build pages your kernel can prove');
      expect(doc.getElementById('bldr-theme-tokens')?.textContent).toContain('--t-surface');
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('scenario 2 (SC-004): switching the theme recolors the frame without reload', async () => {
    render(<App />);
    await waitFor(() => {
      expect(frameDocument().getElementById('bldr-theme-tokens')?.textContent).toContain(
        '--t-surface: #ffffff;',
      );
    });
    const bodyBefore = frameDocument().body;
    const styleBefore = frameDocument().getElementById('bldr-theme-tokens');

    await userEvent.setup().click(screen.getByRole('radio', { name: 'dark' }));
    await waitFor(() => {
      expect(frameDocument().getElementById('bldr-theme-tokens')?.textContent).toContain(
        '--t-surface: #0b1120;',
      );
    });

    // SC-004's "under 1 second" is a Lane-B wall-clock budget recorded by the
    // uncontended evidence run — asserting it here flakes under parallel,
    // coverage-instrumented CI (measured 1014 ms once) for reasons that have
    // nothing to do with the behavior. The merge gate gates the PROPERTY that
    // makes it fast instead: the recolor is an in-place style rewrite — same
    // frame document, same managed style element, no reload, no re-mount.
    expect(frameDocument().body).toBe(bodyBefore);
    expect(frameDocument().getElementById('bldr-theme-tokens')).toBe(styleBefore);
  });

  it('scenario 3: the direction flip follows the document, and undo/redo drive it from the header', async () => {
    render(<App />);
    const user = userEvent.setup();
    await waitFor(() => {
      expect(frameDocument().documentElement.getAttribute('dir')).toBe('ltr');
    });

    await user.click(screen.getByRole('button', { name: /ltr → rtl/ }));
    await waitFor(() => {
      expect(frameDocument().documentElement.getAttribute('dir')).toBe('rtl');
    });
    expect(frameDocument().body.textContent).toContain('Build pages your kernel can prove');

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => {
      expect(frameDocument().documentElement.getAttribute('dir')).toBe('ltr');
    });
    await user.click(screen.getByRole('button', { name: 'Redo' }));
    await waitFor(() => {
      expect(frameDocument().documentElement.getAttribute('dir')).toBe('rtl');
    });
  });

  it('scenario 4 (SC-005): runtime registration renders the announcement; disposal shows the fallback', async () => {
    render(<App />);
    const user = userEvent.setup();
    await waitFor(() => {
      expect(frameDocument().querySelector('main.bldr-page')).not.toBeNull();
    });

    await user.click(screen.getByRole('button', { name: 'Register demo extension' }));
    await waitFor(() => {
      expect(frameDocument().body.textContent).toContain('Registered at runtime — no reload.');
    });

    await user.click(screen.getByRole('button', { name: 'Dispose demo extension' }));
    await waitFor(() => {
      expect(frameDocument().body.textContent).toContain('Unknown block type:');
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('scenario 5 (B2a): edit mode selects via keyboard and a runtime canvas tool badges the selection', async () => {
    render(<App />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('checkbox', { name: 'Edit mode' }));
    const host = await screen.findByRole('region', { name: 'Editor canvas' });
    await waitFor(() => {
      const frame = screen.getByTitle<HTMLIFrameElement>('Editor canvas');
      expect(frame.contentDocument?.querySelector('[data-bldr-node]')).not.toBeNull();
    });

    // Runtime-registered canvas tool (FR-012/FR-013): badge on selection…
    await user.click(screen.getByRole('button', { name: 'Register demo extension' }));
    host.focus();
    await user.keyboard('{ArrowDown}');
    await waitFor(() => {
      expect(document.querySelector('[data-testid="pg-selection-badge"]')).not.toBeNull();
    });
    expect(screen.getByRole('status', { name: 'Selection' })).toHaveTextContent('selected');

    // …and gone on disposal, cleanup included (SC-005).
    await user.click(screen.getByRole('button', { name: 'Dispose demo extension' }));
    await waitFor(() => {
      expect(document.querySelector('[data-testid="pg-selection-badge"]')).toBeNull();
    });

    // Escape clears through the same kernel door (re-focus: the Dispose click
    // moved focus to its button).
    host.focus();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('status', { name: 'Selection' })).toHaveTextContent(
      'Selection cleared',
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('scenario 6 (B2b/SC-004): a page is hand-built from the palette and arranged by keyboard — N+M transactions', async () => {
    render(<App />);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Fixture' }), 'empty');
    await user.click(screen.getByRole('checkbox', { name: 'Edit mode' }));
    const host = await screen.findByRole('region', { name: 'Editor canvas' });
    await waitFor(() => {
      const frame = screen.getByTitle<HTMLIFrameElement>('Editor canvas');
      expect(frame.contentDocument?.querySelector('[data-bldr-node]')).not.toBeNull();
    });
    const treeRows = () =>
      within(screen.getByRole('tree', { name: 'Document structure' })).getAllByRole('treeitem');
    const rowsBefore = treeRows().length; // the empty page (root alone)
    const txCount = () => Number(screen.getByRole('status', { name: 'Transactions' }).textContent);
    expect(txCount()).toBe(0); // a fresh fixture starts with an empty log

    // Build: three inserts from the palette — each is ONE transaction, each
    // lands after the previous selection, whatever the vocabulary's labels are.
    const palette = screen.getByRole('navigation', { name: 'Block palette' });
    const entries = within(palette).getAllByRole('button');
    expect(entries.length).toBeGreaterThanOrEqual(3);
    await user.click(entries.at(1)!);
    await user.click(entries.at(2)!);
    await user.click(entries.at(2)!);
    expect(treeRows().length).toBe(rowsBefore + 3); // N inserts visible everywhere
    expect(txCount()).toBe(3); // N = 3, exactly

    // Arrange: one keyboard move — the selection sits on the LAST inserted
    // block with two siblings above it, so "earlier" is the only legal outcome
    // (a silent no-op would fail both assertions below).
    host.focus();
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
    expect(screen.getByRole('status', { name: 'Gesture' }).textContent).toContain('earlier');
    expect(txCount()).toBe(4); // N + M = 3 + 1 — the SC-004 arithmetic itself
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('scenario 7 (B3a): device → override edit → preview round trip, every view-state law intact', async () => {
    render(<App />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: 'Edit mode' }));
    await screen.findByRole('region', { name: 'Editor canvas' });
    await waitFor(() => {
      const frame = screen.getByTitle<HTMLIFrameElement>('Editor canvas');
      expect(frame.contentDocument?.querySelector('[data-bldr-node]')).not.toBeNull();
    });
    const txCount = () => Number(screen.getByRole('status', { name: 'Transactions' }).textContent);

    // Select the hero via the layers tree (jsdom cannot hit-test the frame).
    const tree = screen.getByRole('tree', { name: 'Document structure' });
    const heroRow = within(tree)
      .getAllByRole('treeitem')
      .find((row) => row.textContent.includes('Opening section'));
    expect(heroRow).toBeDefined();
    await user.click(within(heroRow!).getByText(/Opening section/));

    // The generated panel appears with the hero's own schema — zero panel code.
    const inspector = screen.getByRole('region', { name: 'Inspector' });
    expect(within(inspector).getByRole('textbox', { name: 'heading' })).toHaveValue(
      'Build pages your kernel can prove',
    );

    // Device: tablet preset narrows the REAL frame shell and re-buckets edits.
    await user.click(screen.getByRole('button', { name: 'Tablet' }));
    const shell = document.querySelector<HTMLElement>('.bldr-canvas-frame-shell');
    expect(shell?.style.inlineSize).toBe('834px');
    expect(within(inspector).getByText('Editing tablet overrides')).toBeInTheDocument();

    // One override edit = one setResponsive transaction + a visible marker.
    const before = txCount();
    const heading = within(inspector).getByRole('textbox', { name: 'heading' });
    await user.click(heading);
    await user.paste('Tablet headline');
    expect(txCount()).toBe(before + 1);
    expect(within(inspector).getByText('tablet override')).toBeInTheDocument();

    // Review C1: the REAL editing canvas renders the override being authored —
    // the device width drives one authority end-to-end (bucket → breakpoint).
    const editorFrame = screen.getByTitle<HTMLIFrameElement>('Editor canvas');
    await waitFor(() => {
      expect(editorFrame.contentDocument?.body.textContent).toContain('Tablet headline');
    });

    // Preview: ALL editing chrome disappears; content is the publish-safe path.
    const beforePreview = txCount();
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    expect(screen.queryByRole('tree', { name: 'Document structure' })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Block palette' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Inspector' })).not.toBeInTheDocument();
    const previewFrame = screen.getByTitle<HTMLIFrameElement>('Preview');
    await waitFor(() => {
      expect(previewFrame.contentDocument?.body.textContent).toContain(
        'Build pages your kernel can prove', // desktop renders the BASE value
      );
    });
    expect(previewFrame.contentDocument?.querySelector('[data-bldr-node]')).toBeNull();

    // Direction flip is pure view state: the frame flips, the document does not.
    await user.click(screen.getByRole('button', { name: 'Flip direction (preview)' }));
    expect(previewFrame.contentDocument?.documentElement.getAttribute('dir')).toBe('rtl');

    // Exit via ESCAPE with no special focus (review H1: preview focuses its
    // region on entry and listens at the host document) — the selection AND
    // the log come back exactly as they were, and the exit is ANNOUNCED
    // (FR-010: the composer owns it — preview's own region unmounts with it).
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.getByRole('status', { name: 'Mode' })).toHaveTextContent(
        'Preview closed — back to editing.',
      );
    });
    expect(await screen.findByRole('region', { name: 'Inspector' })).toBeInTheDocument();
    expect(txCount()).toBe(beforePreview); // zero transactions, whole round trip
    const restoredInspector = screen.getByRole('region', { name: 'Inspector' });
    expect(within(restoredInspector).getByRole('textbox', { name: 'heading' })).toBeInTheDocument(); // the hero is still selected — kernel never touched
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('scenario 8 (B3b) — rich text end to end', () => {
  beforeEach(() => {
    // ProseMirror measures selection geometry jsdom does not implement.
    Range.prototype.getClientRects = function getClientRectsStub() {
      return [] as unknown as DOMRectList;
    };
    Range.prototype.getBoundingClientRect = function getBoundingClientRectStub() {
      return new DOMRect(0, 0, 0, 0);
    };
  });

  it('rich block renders on canvas, edits through the lazy editor road, previews engine-free', async () => {
    vi.stubGlobal('fetch', vi.fn());
    render(<App />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: 'Edit mode' }));
    await screen.findByRole('region', { name: 'Editor canvas' });
    const txCount = () => Number(screen.getByRole('status', { name: 'Transactions' }).textContent);

    // The rich block renders through the ZERO-DEP read path on the canvas.
    const editorFrame = screen.getByTitle<HTMLIFrameElement>('Editor canvas');
    await waitFor(() => {
      expect(editorFrame.contentDocument?.body.textContent).toContain('Why it holds');
    });
    expect(editorFrame.contentDocument?.querySelector('.bldr-richtext a')).not.toBeNull();

    // Selecting the rich block resolves the CONTRIBUTED editor lazily — the
    // real registered extension, zero panel code anywhere.
    const tree = screen.getByRole('tree', { name: 'Document structure' });
    const richRow = within(tree)
      .getAllByRole('treeitem')
      .find((row) => row.textContent.includes('Free-form rich text'));
    expect(richRow).toBeDefined();
    await user.click(within(richRow!).getByText(/Free-form rich text/));
    const before = txCount();
    expect(await screen.findByRole('button', { name: 'Bold' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Formatting' })).toBeInTheDocument();
    expect(txCount()).toBe(before); // mounting an editor is never a commit

    // A REAL edit through the toolbar: one commit, one transaction, and the
    // canvas follows (§10 review fix M5 — "Law-S with the editor mounted").
    const surface = document.querySelector('.bldr-richtext-field__surface');
    expect(surface).not.toBeNull();
    expect(surface).toHaveAttribute('role', 'textbox');
    const beforeEdit = txCount();
    await user.click(screen.getByRole('button', { name: 'Bulleted list' }));
    await waitFor(() => {
      expect(txCount()).toBe(beforeEdit + 1);
    });
    await waitFor(() => {
      expect(editorFrame.contentDocument?.querySelector('.bldr-richtext ul')).not.toBeNull();
    });
    // Undo puts BOTH the document and the editor back (document truth).
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => {
      expect(editorFrame.contentDocument?.querySelector('.bldr-richtext ul')).toBeNull();
    });
    expect(txCount()).toBe(beforeEdit + 1); // undo is not a new transaction

    // Preview renders the SAME content through the read path — no editor, no
    // toolbar, zero transactions for the whole round trip (Law-S holds).
    const beforePreview = txCount();
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    const previewFrame = screen.getByTitle<HTMLIFrameElement>('Preview');
    await waitFor(() => {
      expect(previewFrame.contentDocument?.body.textContent).toContain('Why it holds');
    });
    expect(screen.queryByRole('button', { name: 'Bold' })).not.toBeInTheDocument();
    expect(document.querySelector('.bldr-richtext-field__surface')).toBeNull();

    await user.keyboard('{Escape}');
    await screen.findByRole('region', { name: 'Editor canvas' });
    expect(txCount()).toBe(beforePreview); // zero transactions across preview
    expect(await screen.findByRole('button', { name: 'Bold' })).toBeInTheDocument(); // selection intact
  });
});
