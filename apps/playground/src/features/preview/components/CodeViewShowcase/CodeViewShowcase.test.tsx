import { StrictMode } from 'react';

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { BuilderKernel, TransformWorkerClient } from '@craftkit/builder';
import { createLoopbackWorkerLike, createTransformWorkerClient } from '@craftkit/builder/testing';

import { createPlaygroundKernel } from '../../create-playground-kernel';
import { CodeViewShowcase } from './CodeViewShowcase';

const clients: TransformWorkerClient[] = [];

class LoopbackCompatibleMessageEvent extends MessageEvent<unknown> {
  static override [Symbol.hasInstance](value: unknown): boolean {
    return isRecord(value) && 'data' in value;
  }
}

function testClient(): TransformWorkerClient {
  const client = createTransformWorkerClient(createLoopbackWorkerLike());
  clients.push(client);
  return client;
}

function codeViewContribution(kernel: BuilderKernel) {
  const contribution = kernel.context.registry.panel('code-view');
  if (contribution === undefined) {
    throw new Error('scenario 10 requires the contributed code-view panel');
  }
  return contribution;
}

async function replaceDraft(textarea: HTMLTextAreaElement, text: string): Promise<void> {
  const user = userEvent.setup();
  await user.clear(textarea);
  await user.paste(text);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function withoutNode(text: string, nodeId: string): string {
  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed) || !isRecord(parsed['nodes'])) {
    throw new Error('the scoped projection must contain a node map');
  }
  const nodes = Object.fromEntries(
    Object.entries(parsed['nodes']).filter(([candidate]) => candidate !== nodeId),
  );
  return JSON.stringify({ ...parsed, nodes }, null, 2) + '\n';
}

beforeEach(() => {
  // The exported loopback deliberately emits a structural event, while the
  // client performs the browser's nominal MessageEvent check. Preserve the
  // real handlers/protocol and teach jsdom that structural event identity.
  vi.stubGlobal('MessageEvent', LoopbackCompatibleMessageEvent);
});

afterEach(() => {
  for (const client of clients.splice(0)) {
    client.terminate();
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('CodeViewShowcase', () => {
  it('opens under StrictMode, which is how the application actually runs it', async () => {
    /*
      THE GATE THIS COMPONENT WAS MISSING, and the reason it was missing: every
      other test in this file renders the showcase bare, while `main.tsx` wraps
      the app in `StrictMode`. React then mounts, unmounts and remounts, and the
      component's mounted flag was a `useRef(true)` with a cleanup-only effect —
      so the simulated unmount set it to false and NOTHING set it back.

      From then on the open path took its "the component went away" branch: it
      disposed the adapter it had just built, terminated the worker it had just
      started, and returned without clearing `opening`. Nothing threw, so
      nothing was shown. In a real browser the button read "Opening code view…"
      forever and the feature could not be opened at all — while every module
      it needed still loaded with a 200.
    */
    const kernel = createPlaygroundKernel({ fixture: 'code-view' });
    render(
      <StrictMode>
        <CodeViewShowcase kernel={kernel} workerClient={testClient()} debounceMs={0} />
      </StrictMode>,
    );

    const open = screen.getByRole('button', { name: 'Open code view' });
    await userEvent.setup().click(open);

    expect(await screen.findByRole('textbox', { name: 'Document code' })).toBeInTheDocument();
    // And the control finished its journey rather than being stranded mid-open.
    expect(screen.getByRole('button', { name: 'Close code view' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Opening code view…' })).not.toBeInTheDocument();
  });

  it('keeps the contributed panel unloaded until Open code view is pressed', async () => {
    const kernel = createPlaygroundKernel({ fixture: 'code-view' });
    const load = vi.spyOn(codeViewContribution(kernel), 'load');

    render(<CodeViewShowcase kernel={kernel} workerClient={testClient()} debounceMs={0} />);

    expect(load).not.toHaveBeenCalled();
    expect(screen.getByRole('region', { name: 'Editor canvas' })).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Open code view' }));
    expect(await screen.findByRole('textbox', { name: 'Document code' })).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('scenario 10: select → open → edit as text → one transaction → undo, with inert errors and a visible door refusal', async () => {
    const kernel = createPlaygroundKernel({ fixture: 'code-view' });
    kernel.setSelection(['hero']);
    const beforeDocument = structuredClone(kernel.getDocument());
    const beforeTransactions = kernel.transactions().length;
    const load = vi.spyOn(codeViewContribution(kernel), 'load');

    render(<CodeViewShowcase kernel={kernel} workerClient={testClient()} debounceMs={0} />);
    const user = userEvent.setup();
    const frame = screen.getByTitle<HTMLIFrameElement>('Editor canvas');
    await waitFor(() => {
      expect(frame.contentDocument?.body.textContent).toContain(
        'Build pages your kernel can prove',
      );
    });
    expect(kernel.context.store.getState().selection).toEqual(['hero']);
    expect(kernel.transactions()).toHaveLength(beforeTransactions);
    expect(load).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Open code view' }));
    const textarea = await screen.findByRole<HTMLTextAreaElement>('textbox', {
      name: 'Document code',
    });
    await waitFor(() => {
      expect(textarea.value).toContain('"rootId": "hero"');
      expect(textarea.value).toContain('Build pages your kernel can prove');
    });
    expect(load).toHaveBeenCalledTimes(1);
    const originalProjection = textarea.value;

    const validEdit = originalProjection
      .replace('"align": "center"', '"align": "start"')
      .replace('"label": "Get started"', '"label": "Begin now"')
      .replace('Build pages your kernel can prove', 'Edited through code view');
    expect(validEdit).not.toBe(originalProjection);
    await replaceDraft(textarea, validEdit);

    await waitFor(() => {
      expect(kernel.getDocument().nodes['hero']?.props['heading']).toBe('Edited through code view');
    });
    await waitFor(() => {
      expect(frame.contentDocument?.body.textContent).toContain('Edited through code view');
    });
    expect(kernel.transactions()).toHaveLength(beforeTransactions + 1);
    expect(screen.getByRole('status', { name: 'Transactions' })).toHaveTextContent(
      String(beforeTransactions + 1),
    );

    await waitFor(() => {
      expect(textarea.value).toContain('Edited through code view');
    });
    await user.click(screen.getByRole('button', { name: 'Undo code edit' }));
    await waitFor(() => {
      expect(kernel.getDocument()).toEqual(beforeDocument);
      expect(frame.contentDocument?.body.textContent).toContain(
        'Build pages your kernel can prove',
      );
    });
    expect(kernel.transactions()).toHaveLength(beforeTransactions + 1);
    expect(screen.getByRole('status', { name: 'Transactions' })).toHaveTextContent(
      String(beforeTransactions + 1),
    );
    await waitFor(() => {
      expect(textarea.value).toBe(originalProjection);
    });

    const beforeInvalidTransactions = kernel.transactions().length;
    await replaceDraft(textarea, originalProjection.slice(0, -1));
    expect(await screen.findByRole('button', { name: /Line \d+:/i })).toBeInTheDocument();
    expect(kernel.getDocument()).toEqual(beforeDocument);
    expect(kernel.transactions()).toHaveLength(beforeInvalidTransactions);
    expect(textarea).toHaveValue(originalProjection.slice(0, -1));

    const danglingDraft = withoutNode(originalProjection, 'cta-start');
    await replaceDraft(textarea, danglingDraft);
    expect(
      await screen.findByRole('button', { name: /Line \d+:.*cta-start/i }),
    ).toBeInTheDocument();
    expect(kernel.getDocument()).toEqual(beforeDocument);
    expect(kernel.transactions()).toHaveLength(beforeInvalidTransactions);

    const refusedDraft = originalProjection.replace(
      '"heading": "Build pages your kernel can prove"',
      '"heading": 42',
    );
    expect(refusedDraft).not.toBe(originalProjection);
    await replaceDraft(textarea, refusedDraft);
    await waitFor(() => {
      expect(screen.getByText(/patch batch produces an invalid document/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole('list', { name: 'Code errors' })).not.toBeInTheDocument();
    expect(textarea).toHaveValue(refusedDraft);
    expect(kernel.getDocument()).toEqual(beforeDocument);
    expect(kernel.transactions()).toHaveLength(beforeInvalidTransactions);
  });

  it('a keyboard user can close the code view and lands back on the control that opened it', async () => {
    // Replacing the trigger with a status span destroyed the focused element,
    // and nothing implemented Escape: a keyboard user reached the panel and
    // could not leave it (011 T033 review, finding 2). Both halves are pinned
    // here, and the focus destination is asserted EXACTLY — `not.toHaveFocus()`
    // would pass while focus sat on `<body>`, which is the defect itself.
    const kernel = createPlaygroundKernel({ fixture: 'code-view' });
    render(<CodeViewShowcase kernel={kernel} workerClient={testClient()} debounceMs={0} />);
    const user = userEvent.setup();

    const toggle = screen.getByRole('button', { name: 'Open code view' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    const textarea = await screen.findByRole<HTMLTextAreaElement>('textbox', {
      name: 'Document code',
    });

    // The SAME element persists across the transition, so focus never falls.
    expect(screen.getByRole('button', { name: 'Close code view' })).toBe(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveFocus();

    const beforeTransactions = kernel.transactions().length;
    act(() => {
      textarea.focus();
    });
    expect(textarea).toHaveFocus();
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('textbox', { name: 'Document code' })).not.toBeInTheDocument();
    });
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    // Leaving is not editing.
    expect(kernel.transactions()).toHaveLength(beforeTransactions);
  });

  it('unmounting DURING the lazy open disposes what the await went on to create', async () => {
    // Opening awaits the lazy panel; unmounting in between left the resumed
    // continuation building an adapter the disposal effect had never seen
    // (011 T033 review, finding 9). Counted in live store subscriptions —
    // a leaked adapter is a subscription nobody can ever remove.
    const kernel = createPlaygroundKernel({ fixture: 'code-view' });
    let liveSubscriptions = 0;
    const realSubscribe = kernel.context.store.subscribe.bind(kernel.context.store);
    vi.spyOn(kernel.context.store, 'subscribe').mockImplementation((listener) => {
      liveSubscriptions += 1;
      const off = realSubscribe(listener);
      return () => {
        liveSubscriptions -= 1;
        off();
      };
    });

    const holder: { release: (() => void) | null } = { release: null };
    const contribution = codeViewContribution(kernel);
    const realLoad = contribution.load.bind(contribution);
    vi.spyOn(contribution, 'load').mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        holder.release = resolve;
      });
      return realLoad();
    });

    const view = render(
      <CodeViewShowcase kernel={kernel} workerClient={testClient()} debounceMs={0} />,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Open code view' }));
    await waitFor(() => {
      expect(holder.release).not.toBeNull();
    });

    view.unmount();
    const afterUnmount = liveSubscriptions;
    await act(async () => {
      holder.release?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(liveSubscriptions).toBe(afterUnmount);
    expect(screen.queryByRole('textbox', { name: 'Document code' })).not.toBeInTheDocument();
  });

  it('reopening after an edit does not collide two adapters on one worker client', async () => {
    // A CROSS-FIX interaction, invisible to either fix alone: the client now
    // fails closed when one revision arrives with two different payloads
    // (011 T033 finding 3), and every reopen builds a FRESH adapter whose
    // revision counter restarts at 0. Reopening after an edit therefore offers
    // revision 0 twice with different documents — the panel must keep working.
    const kernel = createPlaygroundKernel({ fixture: 'code-view' });
    render(<CodeViewShowcase kernel={kernel} workerClient={testClient()} debounceMs={0} />);
    const user = userEvent.setup();
    const toggle = screen.getByRole('button', { name: 'Open code view' });

    await user.click(toggle);
    const first = await screen.findByRole<HTMLTextAreaElement>('textbox', {
      name: 'Document code',
    });
    await waitFor(() => {
      expect(first.value).toContain('Build pages your kernel can prove');
    });
    await replaceDraft(
      first,
      first.value.replace('Build pages your kernel can prove', 'Edited once'),
    );
    await waitFor(() => {
      expect(kernel.getDocument().nodes['hero']?.props['heading']).toBe('Edited once');
    });

    await user.click(screen.getByRole('button', { name: 'Close code view' }));
    await waitFor(() => {
      expect(screen.queryByRole('textbox', { name: 'Document code' })).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Open code view' }));
    const second = await screen.findByRole<HTMLTextAreaElement>('textbox', {
      name: 'Document code',
    });
    // The reopened panel shows the CURRENT document, not the one the first
    // adapter had sent under the same revision number.
    await waitFor(() => {
      expect(second.value).toContain('Edited once');
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('CodeViewShowcase — failure and idempotence surfaces', () => {
  it('reports a missing panel contribution as an alert instead of failing silently', async () => {
    // A host can be wired to a kernel that never registered the extension; the
    // author must be told, and nothing must be half-created.
    const kernel = createPlaygroundKernel({ fixture: 'code-view' });
    vi.spyOn(kernel.context.registry, 'panel').mockReturnValue(undefined);

    render(<CodeViewShowcase kernel={kernel} workerClient={testClient()} debounceMs={0} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Open code view' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/not registered/i);
    expect(screen.queryByRole('textbox', { name: 'Document code' })).not.toBeInTheDocument();
    // The control returns to its resting state rather than staying disabled.
    expect(screen.getByRole('button', { name: 'Open code view' })).toBeEnabled();
  });

  it('names a NON-Error open failure rather than showing an empty reason', async () => {
    const kernel = createPlaygroundKernel({ fixture: 'code-view' });
    const contribution = codeViewContribution(kernel);
    vi.spyOn(contribution, 'load').mockRejectedValue('the panel module is missing');

    render(<CodeViewShowcase kernel={kernel} workerClient={testClient()} debounceMs={0} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Open code view' }));

    // A rejected non-Error must still produce a readable reason, not "".
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/could not be opened|panel module is missing/i);
  });

  it('a second open while one is already in flight does nothing', async () => {
    // Double-activation is ordinary with a keyboard; it must not build two
    // adapters over one kernel.
    const kernel = createPlaygroundKernel({ fixture: 'code-view' });
    const contribution = codeViewContribution(kernel);
    const load = vi.spyOn(contribution, 'load');

    render(<CodeViewShowcase kernel={kernel} workerClient={testClient()} debounceMs={0} />);
    const toggle = screen.getByRole('button', { name: 'Open code view' });
    const user = userEvent.setup();
    await user.click(toggle);
    await screen.findByRole('textbox', { name: 'Document code' });
    // Now that a session exists, the open path must refuse to run again.
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('ignores every key inside the panel except Escape', async () => {
    const kernel = createPlaygroundKernel({ fixture: 'code-view' });
    render(<CodeViewShowcase kernel={kernel} workerClient={testClient()} debounceMs={0} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Open code view' }));
    const textarea = await screen.findByRole('textbox', { name: 'Document code' });

    act(() => {
      textarea.focus();
    });
    await user.keyboard('{Enter}');
    await user.keyboard('{Tab}');
    // Still open: only Escape closes.
    expect(screen.getByRole('textbox', { name: 'Document code' })).toBeInTheDocument();
  });
});
