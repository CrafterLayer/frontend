import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { act, configure, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';

/*
  These are END-TO-END app scenarios: every one of the eighteen mounts the whole
  playground, builds a real same-origin iframe and renders a seventeen-section
  marketing page inside it — measured, this file is forty seconds of work — and
  the app now OPENS its document asynchronously from the vault before any of
  that can begin. Testing Library's `asyncUtilTimeout` defaults to ONE second,
  which is a unit-test budget; the first test in the file absorbs jsdom, zod and
  stylesheet warmup on a CPU shared with every other package under `pnpm verify`
  and crosses it. State the real budget rather than letting correct tests fail on
  contention — exactly the argument the shared vitest config already makes for
  `testTimeout`. A genuine hang still fails, just later.
*/
configure({ asyncUtilTimeout: 5000 });

/*
  The agent panel is mounted in every scenario (it stays mounted across rail
  destinations), and its thread follows its content through a ResizeObserver,
  which jsdom does not have. An inert one: geometry belongs to the browser stories.
*/
/*
  Every scenario boots the app as a first visit. jsdom keeps one localStorage for
  the whole file, and the app remembers things there: scenario 6 picks the
  `empty` fixture from the harness, the app remembers it
  (`craftkit-current-workspace-v1`), and every scenario after it then booted an
  empty page — "names the page…", 7, 8 and 9 failed in the full file and passed
  alone. Cleared BEFORE each boot rather than after: the previous scenario's
  app is unmounted after its own hooks run, and an unmount may still write. The
  vault needs no reset: without IndexedDB each mount gets its own memory store.
*/
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'function') return;
  globalThis.ResizeObserver = class {
    observe = (): void => undefined;
    unobserve = (): void => undefined;
    disconnect = (): void => undefined;
  };
});

/** Opens the rail's Settings destination, where the scenario harness lives. */
async function openHarness(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Settings' }));
}

/**
 * Opens the rail's Layers destination.
 *
 * Blocks and Layers share the left column, the way they do in every builder of
 * this shape: one panel, two destinations, and the right column left entirely
 * to the inspector. A test that wants the tree therefore asks for it the same
 * way a person does.
 */
async function openLayers(user: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> {
  await user.click(screen.getByRole('button', { name: 'Layers' }));
  return screen.getByRole('tree', { name: 'Document structure' });
}

/** Back to the palette. */
async function openBlocks(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Blocks' }));
}

/**
 * The document the app is showing, whichever surface is up.
 *
 * The app used to OPEN in a preview — `editMode` started false — so this
 * reached for the frame titled "Preview". It opens as the editor now, because a
 * builder does not have an edit switch; `Preview` is a button you press. So the
 * helper takes whichever surface is mounted.
 */
function frameDocument(): Document {
  const frame =
    screen.queryByTitle<HTMLIFrameElement>('Editor canvas') ??
    screen.getByTitle<HTMLIFrameElement>('Preview');
  const doc = frame.contentDocument;
  if (doc === null) {
    throw new Error('no contentDocument');
  }
  return doc;
}

describe('the app frame must not reach into the page being edited', () => {
  // CanvasFrame MIRRORS this document's head stylesheets into the preview
  // iframe so the page inherits the host's fonts. That makes any GLOBAL rule
  // here a rule on the author's page too.
  //
  // Measured defect this pins: `body { overflow: hidden }`, written to stop the
  // app's own page scrolling, crossed into the frame — and because CSS
  // propagates body's overflow to the viewport, a 1239px page was clamped
  // inside an 866px frame with no way to reach its bottom. Clipping belongs to
  // `.pg-app`, which exists only in this document.
  // jsdom serves modules over http, so `import.meta.url` is not a file URL
  // here; vitest's cwd is the app root, which is all this gate needs.
  // Comments are stripped first: a rule's own explanation often quotes the
  // very pattern the gate forbids, and a gate that reads prose is not reading
  // the stylesheet.
  const appCss = readFileSync(join(process.cwd(), 'src', 'app', 'App.css'), 'utf8').replaceAll(
    /\/\*[\s\S]*?\*\//g,
    '',
  );

  const globalBlocks = (selector: RegExp): string[] =>
    [...appCss.matchAll(/(^|\n)([^@{}\n][^{}]*)\{([^}]*)\}/g)]
      .filter((match) => selector.test(match[2] ?? ''))
      .map((match) => match[3] ?? '');

  it('never clips or scrolls on a global element selector', () => {
    for (const body of globalBlocks(/(^|,)\s*(html|body|\*)\s*(,|$)/m)) {
      expect(body).not.toMatch(/overflow/);
    }
  });

  it('scopes its clipping to the app root, which the frame never sees', () => {
    const scoped = globalBlocks(/\.pg-app/);
    expect(scoped.some((body) => body.includes('overflow: hidden'))).toBe(true);
  });

  // Measured in Chromium: every control the SHELL owns sits at exactly 44px
  // (`--bldr-hit-target-min`), while the harness's own controls came in at
  // 13-27px — a 22px button fails WCAG 2.2 SC 2.5.8, and a 13px checkbox is a
  // thing to aim at. jsdom cannot measure a box, so this gate holds the
  // narrower line it CAN hold: the harness sizes its controls from the token
  // and never from a literal that would drift away from it.
  /*
    Measured in Chromium against the dev server: wrapping AssistantPanel in
    `.pg-rail-panel` (to keep it mounted across rail destinations) put an
    auto-height box between the shell's grid item and `.pg-chat`, whose
    `block-size: 100%` then resolved against content. The conversation stopped
    scrolling inside itself and the composer ended up ~2.7k px below the fold —
    {chat: 3484px tall, threadScrolls: false, composerBelowViewport: true}.
    Adding `block-size: 100%` restored it exactly. jsdom performs no layout, so
    this gate holds the line it CAN hold: a wrapper the panel column mounts must
    have a rule, and that rule must give it a definite height.
  */
  it('gives every panel-column wrapper a definite height, or the panel inside collapses', () => {
    const appTsx = readFileSync(join(process.cwd(), 'src', 'app', 'App.tsx'), 'utf8');
    const wrappers = [...appTsx.matchAll(/className="(pg-[a-z-]*panel)"/g)].map(
      (match) => match[1] ?? '',
    );

    // Non-vacuous: both wrappers exist today, and a rename that lost one would
    // otherwise turn this gate into a no-op.
    expect(wrappers).toContain('pg-rail-panel');
    expect(wrappers).toContain('pg-boot-panel');
    for (const wrapper of wrappers) {
      const rules = globalBlocks(new RegExp(`\\.${wrapper}\\s*(,|$)`));
      expect(rules, `.${wrapper} has no rule in App.css`).not.toHaveLength(0);
      expect(
        rules.some((body) => /block-size:\s*100%/.test(body)),
        `.${wrapper} never sets block-size: 100%`,
      ).toBe(true);
    }
  });

  it('sizes every harness control from the hit-target token', () => {
    const harness = globalBlocks(/\.pg-settings/);
    const sizing = harness.flatMap((body) => [...body.matchAll(/min-block-size:\s*([^;]+);/g)]);

    // Non-vacuous: a file that had stopped sizing its controls at all would
    // otherwise sail through, and that is the state this gate was written for.
    expect(sizing.length).toBeGreaterThanOrEqual(2);
    for (const declaration of sizing) {
      expect(declaration[1]?.trim()).toBe('var(--bldr-hit-target-min)');
    }
  });
});

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

    const themeUser = userEvent.setup();
    await openHarness(themeUser);
    await themeUser.click(screen.getByRole('radio', { name: 'dark' }));
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

    await openHarness(user);
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

  it('keeps Undo and Redo availability in lockstep with live kernel history', async () => {
    render(<App />);
    const user = userEvent.setup();
    const undo = screen.getByRole('button', { name: 'Undo' });
    const redo = screen.getByRole('button', { name: 'Redo' });

    // Mutations that kill these first two lines: replace either subscribed
    // kernel fact with the old `!showcaseOwnsLawSControls` constant. A new
    // session has no cursor to move in either direction.
    expect(undo).toBeDisabled();
    expect(redo).toBeDisabled();

    // Blocks is where the app opens, so the palette arrives with the document —
    // this gate needs a real edit in the history, not a harness control. AWAITED
    // because the app opens its document from the vault now: the top bar is
    // drawn immediately (which is why the two assertions above still read it
    // synchronously), and the panel follows when `openDocument` resolves.
    const palette = await screen.findByRole('navigation', { name: 'Block palette' });
    const hero = within(palette)
      .getAllByRole('listitem')
      .map((item) => within(item).getByRole('button'))
      .find((entry) => entry.textContent.includes('Hero'));
    if (hero === undefined) {
      throw new Error('the palette must offer a Hero block for the history gate');
    }
    await user.click(hero);
    await waitFor(() => {
      // Mutation that kills this line: make the canUndo snapshot always false.
      expect(undo).toBeEnabled();
      expect(redo).toBeDisabled();
    });

    await user.click(undo);
    await waitFor(() => {
      // Mutation that kills this line: replace both dedicated subscriptions
      // with bare kernel reads. This non-direction history move changes no
      // separate doc-direction snapshot, so the stale enabled state remains.
      expect(undo).toBeDisabled();
      // Mutation that kills this line: make the canRedo snapshot always false.
      expect(redo).toBeEnabled();
    });

    await user.click(redo);
    await waitFor(() => {
      expect(undo).toBeEnabled();
      expect(redo).toBeDisabled();
    });
  });

  it('scenario 4 (SC-005): runtime registration renders the announcement; disposal shows the fallback', async () => {
    render(<App />);
    const user = userEvent.setup();
    await waitFor(() => {
      expect(frameDocument().querySelector('main.bldr-page')).not.toBeNull();
    });

    await openHarness(user);
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

    const host = await screen.findByRole('region', { name: 'Editor canvas' });
    await waitFor(() => {
      const frame = screen.getByTitle<HTMLIFrameElement>('Editor canvas');
      expect(frame.contentDocument?.querySelector('[data-bldr-node]')).not.toBeNull();
    });

    // Runtime-registered canvas tool (FR-012/FR-013): badge on selection…
    await openHarness(user);
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

    // Escape climbs ONE document level before it clears (EditorCanvas
    // `handleTraversalKey`): the first selects the page root that holds the
    // arrowed-to section, and only the second clears — both through the same
    // kernel door. Re-focus first: the Dispose click moved focus to its button.
    host.focus();
    await user.keyboard('{Escape}');
    const selectionStatus = screen.getByRole('status', { name: 'Selection' });
    expect(selectionStatus).toHaveTextContent(/page root.*selected$/i);
    await user.keyboard('{Escape}');
    expect(selectionStatus).toHaveTextContent('Selection cleared');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('scenario 6 (B2b/SC-004): a page is hand-built from the palette and arranged by keyboard — N+M transactions', async () => {
    render(<App />);
    const user = userEvent.setup();
    await openHarness(user);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Fixture' }), 'empty');
    await openBlocks(user);
    const host = await screen.findByRole('region', { name: 'Editor canvas' });
    await waitFor(() => {
      const frame = screen.getByTitle<HTMLIFrameElement>('Editor canvas');
      expect(frame.contentDocument?.querySelector('[data-bldr-node]')).not.toBeNull();
    });
    const treeRows = () =>
      within(screen.getByRole('tree', { name: 'Document structure' })).getAllByRole('treeitem');
    await openLayers(user);
    const rowsBefore = treeRows().length; // the empty page (root alone)
    await openBlocks(user);
    const txCount = () => Number(screen.getByRole('status', { name: 'Transactions' }).textContent);
    expect(txCount()).toBe(0); // a fresh fixture starts with an empty log

    // Build: three inserts from the palette — each is ONE transaction, each
    // lands after the previous selection, whatever the vocabulary's labels are.
    const palette = screen.getByRole('navigation', { name: 'Block palette' });
    // The BLOCK CARDS, not every button in the panel: the palette also carries
    // a filter control and one collapse toggle per category, and asking for
    // "all buttons" quietly picked those up the moment the panel grew chrome.
    // The cards are the list items — that is what makes them addressable.
    const entries = within(palette)
      .getAllByRole('listitem')
      .map((item) => within(item).getByRole('button'));
    expect(entries.length).toBeGreaterThanOrEqual(3);
    // The SAME block three times, chosen by NAME and chosen because the page
    // root's slot ALLOWS it. Clicking by index worked only while the palette
    // was a flat list in one particular order; once it grew categories the
    // indices moved, and an insert the schema refuses is a legal no-op — so
    // the arithmetic below was quietly measuring two inserts instead of three.
    // Naming the block states what the scenario actually needs: three siblings
    // under the root.
    const hero = entries.find((entry) => entry.textContent.includes('Hero'));
    if (hero === undefined) {
      throw new Error('the palette must offer a Hero block for this scenario');
    }
    await user.click(hero);
    await user.click(hero);
    await user.click(hero);
    await openLayers(user);
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

  it('tells the shell the layer tree is not something to drop when space runs short', async () => {
    render(<App />);
    const user = userEvent.setup();
    const shell = await screen.findByRole('application', { name: 'Playground editor' });

    // The palette keeps the old bargain: below 1180 the canvas wins and the
    // palette goes, because it is a source you dip into.
    expect(shell).toHaveAttribute('data-bldr-panel-priority', 'optional');

    await openLayers(user);
    // The structure of the document is how a person navigates it. Measured in
    // the browser, without this the tree vanished between 900 and 1180 while
    // the rail still marked Layers as the open destination.
    expect(shell).toHaveAttribute('data-bldr-panel-priority', 'essential');

    await openBlocks(user);
    expect(shell).toHaveAttribute('data-bldr-panel-priority', 'optional');
  });

  it('keeps the action band for the product and puts the harness in Settings', async () => {
    render(<App />);
    const user = userEvent.setup();
    await screen.findByRole('region', { name: 'Editor canvas' });

    // The band used to carry a fixture picker, an edit-mode checkbox, a
    // "Harness" disclosure and a bare digit. None of that is product.
    expect(screen.queryByRole('combobox', { name: 'Fixture' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Edit mode' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Harness' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preview' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const harness = screen.getByRole('region', { name: 'Scenario harness' });
    expect(within(harness).getByRole('combobox', { name: 'Fixture' })).toBeInTheDocument();
    expect(
      within(harness).getByRole('button', { name: 'Register demo extension' }),
    ).toBeInTheDocument();

    // The sealed-store counter stays in the DOM for the law, unseen.
    expect(Number(screen.getByRole('status', { name: 'Transactions' }).textContent)).toBe(0);
  });

  it('gives the layer tree a destination of its own, and the inspector its whole column', async () => {
    render(<App />);
    const user = userEvent.setup();
    await screen.findByRole('region', { name: 'Editor canvas' });

    // Blocks and Layers share the left column; the tree used to sit on top of
    // the inspector and take a third of the right one, where a rail item
    // claiming to be "Layers" could only point at it.
    expect(screen.queryByRole('tree', { name: 'Document structure' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Inspector' })).toBeInTheDocument();

    const tree = await openLayers(user);
    expect(tree).toBeInTheDocument();
    // Both at once: choosing a layer and editing it is one motion, so the
    // inspector must not be what the tree replaced.
    expect(screen.getByRole('region', { name: 'Inspector' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Block palette' })).not.toBeInTheDocument();

    await openBlocks(user);
    expect(screen.queryByRole('tree', { name: 'Document structure' })).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Block palette' })).toBeInTheDocument();
  });

  it('names the page whose structure the tree is showing, and switches between pages', async () => {
    /*
      The app boots on a SITE now: the canvas, the tree and the inspector all
      look at ONE page, and until this list existed nothing on screen said which.
      The pages sit above the tree in the same panel because reading them the
      other way round tells you the shape of something you have not been told the
      name of.
    */
    render(<App />);
    const user = userEvent.setup();
    await screen.findByRole('region', { name: 'Editor canvas' });
    await openLayers(user);

    const pages = screen.getByRole('listbox', { name: 'Site pages' });
    expect(within(pages).getAllByRole('option')).toHaveLength(1);
    expect(within(pages).getAllByRole('option', { selected: true })).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Add page' }));
    expect(within(pages).getAllByRole('option')).toHaveLength(2);

    /*
      Adding OPENS the page it made: the whole editor moves to it, so the tree
      that was showing the landing page's blocks now shows one empty root, and
      the new row is the selected one. Opening the first page again moves the
      editor back — that round trip is what "switches between pages" means.
    */
    await waitFor(() => {
      expect(
        within(screen.getByRole('tree', { name: 'Document structure' })).getAllByRole('treeitem'),
      ).toHaveLength(1);
    });
    expect(within(pages).getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
    await user.click(within(pages).getAllByRole('option')[0]!);
    await waitFor(() => {
      expect(
        within(screen.getByRole('tree', { name: 'Document structure' })).getAllByRole('treeitem')
          .length,
      ).toBeGreaterThan(1);
    });
  });

  it('the rail actually moves the panel — it used to draw a selection and ignore the click', async () => {
    render(<App />);
    const user = userEvent.setup();
    await screen.findByRole('region', { name: 'Editor canvas' });

    const blocks = screen.getByRole('button', { name: 'Blocks' });
    const assets = screen.getByRole('button', { name: 'Assets' });
    expect(blocks).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('navigation', { name: 'Block palette' })).toBeInTheDocument();

    await user.click(assets);
    // The claim is not that the highlight moved — the old rail did that much
    // with a hard-coded id. It is that the PANEL changed.
    expect(assets).toHaveAttribute('aria-current', 'page');
    expect(blocks).not.toHaveAttribute('aria-current');
    expect(screen.queryByRole('navigation', { name: 'Block palette' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Assets' })).toBeInTheDocument();

    await user.click(blocks);
    expect(screen.getByRole('navigation', { name: 'Block palette' })).toBeInTheDocument();
  });

  it('gives the vault a destination of its own, with the shelf of the open document', async () => {
    render(<App />);
    const user = userEvent.setup();
    await screen.findByRole('region', { name: 'Editor canvas' });

    // The rail is where every other destination lives, and restore points are a
    // destination rather than a harness control: the session's own saving is
    // continuous and invisible, this is the shelf a person puts something on.
    await user.click(screen.getByRole('button', { name: 'History' }));
    const history = await screen.findByRole('region', { name: 'History' });

    expect(within(history).getByRole('button', { name: 'Save restore point' })).toBeInTheDocument();
    // Empty until someone keeps something — and it says what would fill it.
    expect(within(history).queryByRole('listitem')).not.toBeInTheDocument();
    expect(within(history).getByRole('button', { name: 'Clear history' })).toBeDisabled();
    // The canvas keeps the document while the panel changes; History is a panel
    // destination like Layers, not a mode.
    expect(screen.getByRole('region', { name: 'Editor canvas' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Blocks' }));
    expect(screen.queryByRole('region', { name: 'History' })).not.toBeInTheDocument();
  });

  it('mounts the style-manager destinations: Design, the edit history and the shortcuts dialog', async () => {
    render(<App />);
    const user = userEvent.setup();
    await screen.findByRole('region', { name: 'Editor canvas' });

    // Design: the design system, named styles, symbols and the library transfer, together.
    await user.click(screen.getByRole('button', { name: 'Design' }));
    expect(await screen.findByRole('region', { name: 'Design system' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Styles' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Symbols' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Import & export design system' })).toBeInTheDocument();

    // History: the labelled steps sit beside the vault's restore points.
    await user.click(screen.getByRole('button', { name: 'History' }));
    expect(await screen.findByRole('region', { name: 'Edit history' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'History' })).toBeInTheDocument();

    // `?` opens the keymap, from anywhere outside a field.
    await user.click(document.body);
    await user.keyboard('?');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('scenario 7 (B3a): device → override edit → preview round trip, every view-state law intact', async () => {
    render(<App />);
    const user = userEvent.setup();
    await screen.findByRole('region', { name: 'Editor canvas' });
    await waitFor(() => {
      const frame = screen.getByTitle<HTMLIFrameElement>('Editor canvas');
      expect(frame.contentDocument?.querySelector('[data-bldr-node]')).not.toBeNull();
    });
    const txCount = () => Number(screen.getByRole('status', { name: 'Transactions' }).textContent);

    // Select the hero via the layers tree (jsdom cannot hit-test the frame).
    const tree = await openLayers(user);
    const heroRow = within(tree)
      .getAllByRole('treeitem')
      // The tree shows a short NAME now, not the schema's description sentence.
      .find((row) => row.textContent.includes('Hero'));
    expect(heroRow).toBeDefined();
    await user.click(within(heroRow!).getByText(/^Hero$/));

    // The generated panel appears with the hero's own schema — zero panel code.
    const inspector = screen.getByRole('region', { name: 'Inspector' });
    expect(within(inspector).getByRole('textbox', { name: 'heading' })).toHaveValue(
      'Build pages your kernel can prove',
    );

    // Device: tablet preset narrows the REAL frame shell and re-buckets edits.
    // The top bar carries the ONLY device switcher now. A second copy used to
    // ride in a band below it, and this line proved the copy — not the control
    // an author reaches for. Reaching for the real one is the point of the test.
    await user.click(screen.getByRole('radio', { name: 'Tablet' }));
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
    expect(previewFrame.parentElement).toHaveStyle({ inlineSize: '834px', maxInlineSize: '100%' });
    await waitFor(() => {
      /*
        Preview renders AT the selected device.

        This used to assert the base value — that preview ignored the tablet the
        person had chosen — which described a defect rather than a requirement:
        `PreviewMode` took no breakpoint at all, so the override a person had
        just authored was invisible in the one view meant to show the published
        result. Now the device carries through, and the base value must NOT
        appear, which is what makes this catch the regression rather than
        tolerate it.
      */
      expect(previewFrame.contentDocument?.body.textContent).toContain('Tablet headline');
    });
    expect(previewFrame.contentDocument?.body.textContent).not.toContain(
      'Build pages your kernel can prove',
    );
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
    const tree = await openLayers(user);
    const richRow = within(tree)
      .getAllByRole('treeitem')
      .find((row) => row.textContent.includes('Rich Text'));
    expect(richRow).toBeDefined();
    await user.click(within(richRow!).getByText(/^Rich Text$/));
    const before = txCount();
    // LAZY EDITOR ROAD: this waits on a dynamic import plus an engine mount, not on a
    // render, so it needs more than testing-library's 1s render budget — under parallel
    // CPU load the import alone outlives it (observed 1.9s in `pnpm verify`).
    const LAZY_EDITOR_BUDGET = { timeout: 5000 };
    expect(
      await screen.findByRole('button', { name: 'Bold' }, LAZY_EDITOR_BUDGET),
    ).toBeInTheDocument();
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
    expect(
      await screen.findByRole('button', { name: 'Bold' }, LAZY_EDITOR_BUDGET),
    ).toBeInTheDocument(); // selection intact
  });
});

describe('scenario 9 (B3c) — inline editing, the bubble, and the action bar in lockstep', () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchSpy);
    // ProseMirror measures selection geometry jsdom does not implement.
    Range.prototype.getClientRects = function getClientRectsStub() {
      return [] as unknown as DOMRectList;
    };
    Range.prototype.getBoundingClientRect = function getBoundingClientRectStub() {
      return new DOMRect(0, 0, 0, 0);
    };
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchSpy.mockReset();
  });

  it('select → edit inline → format via the bubble → duplicate via the action bar → undo, in lockstep', async () => {
    render(<App />);
    const user = userEvent.setup();
    await openHarness(user);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Fixture' }), 'inline');
    await openBlocks(user);
    const host = await screen.findByRole('region', { name: 'Editor canvas' });
    const editorDocument = (): Document => {
      const doc = screen.getByTitle<HTMLIFrameElement>('Editor canvas').contentDocument;
      if (doc === null) {
        throw new Error('no contentDocument');
      }
      return doc;
    };
    await waitFor(() => {
      expect(editorDocument().body.textContent).toContain('Edit me in place');
    });
    // The lockstep pair, both LIVE in the app already: the header's Law-S
    // counter (every observable change pairs 1:1 with a transaction) and the
    // canvas's selection status. The whole scenario reads only these two.
    const txCount = () => Number(screen.getByRole('status', { name: 'Transactions' }).textContent);
    const layerTree = await openLayers(user);
    const rowNamed = (pattern: RegExp) =>
      within(layerTree)
        .getAllByRole('treeitem')
        .find((row) => pattern.test(row.textContent));
    expect(txCount()).toBe(0); // a fresh fixture starts with an empty log

    // SELECT: the announcement via the layers tree. View state, never a tx.
    const noteRow = rowNamed(/^Announcement/);
    expect(noteRow).toBeDefined();
    await user.click(within(noteRow!).getByText(/^Announcement$/));
    expect(screen.getByRole('status', { name: 'Selection' })).toHaveTextContent('selected');
    expect(txCount()).toBe(0);

    // EDIT INLINE: Enter opens the DECLARED string prop in place (keyboard
    // parity with the double-click); opening dispatches nothing.
    host.focus();
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(editorDocument().querySelector('.bldr-inline-text')).not.toBeNull();
    });
    const surface = editorDocument().querySelector<HTMLElement>('.bldr-inline-text');
    expect(surface?.getAttribute('aria-label')).toBe('message');
    expect(txCount()).toBe(0);

    // One inline commit = ONE transaction, and the canvas follows.
    act(() => {
      if (surface !== null) {
        surface.textContent = 'Edited in place';
        surface.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await waitFor(() => {
      expect(txCount()).toBe(1);
    });
    await waitFor(() => {
      expect(editorDocument().body.textContent).toContain('Edited in place');
    });

    // Escape ends the edit, keeps the selection, commits nothing further.
    host.focus();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(editorDocument().querySelector('.bldr-inline-text')).toBeNull();
    });
    expect(txCount()).toBe(1);

    // RICH: the story's content opens the CONTRIBUTED editor, resolved lazily
    // from the registry — mounting an editor is never a commit.
    const taleRow = rowNamed(/^Story/);
    expect(taleRow).toBeDefined();
    await user.click(within(taleRow!).getByText(/^Story$/));
    host.focus();
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(
        editorDocument().querySelector('.bldr-inline-richtext [contenteditable="true"]'),
      ).not.toBeNull();
    });
    expect(txCount()).toBe(1);

    // A LIVE text selection inside the edit raises the formatting bubble
    // (Ctrl+A is the engine's own select-all keybinding).
    const prose = editorDocument().querySelector<HTMLElement>(
      '.bldr-inline-richtext [contenteditable="true"]',
    );
    expect(prose).not.toBeNull();
    act(() => {
      prose?.focus();
      prose?.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'a',
          code: 'KeyA',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    await waitFor(() => {
      expect(document.querySelector('.bldr-text-bubble')).not.toBeNull();
    });
    const bubble = document.querySelector<HTMLElement>('.bldr-text-bubble');
    expect(bubble).not.toBeNull();
    expect(txCount()).toBe(1); // selecting text is never a transaction

    // One bubble action = ONE transaction, and the edit survives it. (Floating
    // chrome positions through real geometry, which jsdom zeroes — the hosts
    // sit visibility-hidden here, and hidden content computes no accessible
    // name, so the floating buttons are found by their visible text instead.)
    await user.click(within(bubble!).getByText('Bold'));
    await waitFor(() => {
      expect(txCount()).toBe(2);
    });
    expect(
      editorDocument().querySelector('.bldr-inline-richtext [contenteditable="true"]'),
    ).not.toBeNull();

    // Selecting the announcement again ends the rich session; the read path
    // now renders the bold that was committed through the bubble.
    await user.click(within(rowNamed(/^Announcement/)!).getByText(/^Announcement$/));
    await waitFor(() => {
      expect(editorDocument().querySelector('.bldr-inline-richtext')).toBeNull();
    });
    await waitFor(() => {
      expect(editorDocument().querySelector('.pg-story strong')).not.toBeNull();
    });
    expect(txCount()).toBe(2);

    // ACTION BAR: attached to the selection on an editable canvas. One press =
    // ONE transaction, and the defined resulting selection is the DUPLICATE.
    await waitFor(() => {
      expect(document.querySelector('.bldr-block-actions')).not.toBeNull();
    });
    const bar = document.querySelector<HTMLElement>('.bldr-block-actions');
    expect(bar?.getAttribute('role')).toBe('toolbar');
    expect(bar?.getAttribute('aria-label')).toContain('Actions for');
    await user.click(within(bar!).getByText('Duplicate'));
    await waitFor(() => {
      expect(txCount()).toBe(3);
    });
    await waitFor(() => {
      expect(editorDocument().querySelectorAll('.pg-announcement')).toHaveLength(2);
    });
    expect(screen.getByRole('status', { name: 'Selection' })).toHaveTextContent('selected');

    // UNDO walks the three edits back ONE at a time — and the counter never
    // moves, because undo replays history rather than appending to it.
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => {
      expect(editorDocument().querySelectorAll('.pg-announcement')).toHaveLength(1);
    });
    expect(txCount()).toBe(3);

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => {
      expect(editorDocument().querySelector('.pg-story strong')).toBeNull();
    });
    expect(txCount()).toBe(3);

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => {
      expect(editorDocument().body.textContent).toContain('Edit me in place');
    });
    expect(txCount()).toBe(3);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('scenario 10 (B4) — code view and the canvas in lockstep', () => {
  it('opens the code view from the rail and leaves its lazy panel closed until requested', async () => {
    render(<App />);
    const user = userEvent.setup();

    await openHarness(user);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Fixture' }), 'code-view');
    await openBlocks(user);

    // The fixture chooses a DOCUMENT. Opening the code view is the rail's job —
    // it used to be a side effect of picking a fixture, which made a harness
    // setting the only door to a product feature and left the rail's own Code
    // item with nothing to do but describe where that feature was.
    expect(screen.queryByRole('region', { name: 'Code view showcase' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Code' }));

    expect(await screen.findByRole('region', { name: 'Code view showcase' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open code view' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Code view' })).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Transactions' })).toHaveTextContent('0');

    const frame = screen.getByTitle<HTMLIFrameElement>('Editor canvas');
    await waitFor(() => {
      expect(frame.contentDocument?.body.textContent).toContain(
        'Build pages your kernel can prove',
      );
    });
  });
});

describe('the agent panel (SPEC §8 WP-20)', () => {
  it('mounts the v2 panel by default: one name, in Arabic, and none of the v1 header', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Assistant' }));

    const panel = await screen.findByRole('region', { name: 'أبو غضب' });
    expect(panel).toHaveAttribute('lang', 'ar');
    expect(panel).toHaveAttribute('dir', 'rtl');
    // The v1 header's English "Agent" name and its status line are gone with it.
    expect(screen.queryByRole('heading', { name: 'Agent' })).toBeNull();
    expect(screen.queryByText('Abu Ghadab')).toBeNull();
    // One separator on the panel's edge: the agent's own, not the shell's as well.
    expect(screen.getAllByRole('separator')).toHaveLength(1);
    expect(screen.getByRole('separator')).toHaveAccessibleName('تغيير عرض اللوحة');
  });

  /*
    Final test, 2026-09-29, phone 390px: with the agent as the sheet, the inspector stayed
    open as an overlay over the canvas, and the mini detent showed "No block selected"
    beside a 40px sliver of the page. The sheet's canvas is the page, whole.
  */
  it('closes the inspector while the agent is the phone sheet, so the canvas is the page', async () => {
    // jsdom has no `matchMedia`: this one answers the phone query (coarse pointer) yes.
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('pointer: coarse'),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }));
    try {
      const user = userEvent.setup();
      const { container } = render(<App />);
      const shell = container.querySelector('.bldr-shell');
      // Booted, at the desk layout jsdom measures: the inspector is open.
      await waitFor(() => {
        expect(shell).toHaveAttribute('data-aside-open', 'true');
      });

      await user.click(await screen.findByRole('button', { name: 'Assistant' }));
      await waitFor(() => {
        expect(shell).toHaveAttribute('data-aside-open', 'false');
      });
      expect(shell).toHaveAttribute('data-panel-open', 'false');

      // Another destination: the inspector the person left open comes back.
      await user.click(screen.getByRole('button', { name: 'Layers' }));
      await waitFor(() => {
        expect(shell).toHaveAttribute('data-panel-open', 'true');
      });
      expect(shell).toHaveAttribute('data-aside-open', 'true');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('keeps the panel mounted on another destination, where the status bar speaks for it', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Assistant' }));
    const panel = await screen.findByRole('region', { name: 'أبو غضب' });

    await user.click(screen.getByRole('button', { name: 'Layers' }));
    // Hidden, not unmounted: the same element, still in the document.
    expect(panel).toBeInTheDocument();
    expect(panel.closest('.ck-agent-panel')).toHaveAttribute('data-state', 'hidden');
    // The shell's own separator is back for the other destinations.
    expect(screen.getByRole('separator', { name: 'Resize workspace panel' })).toBeInTheDocument();
  });
});
