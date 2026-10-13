import { act, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  AiProviderError,
  type AiAgentEvent,
  type AiPlan,
  type AiPlanProvider,
} from '@craftkit/builder';

import {
  IDLE_LINE_AR,
  IDLE_LINE_EN,
  IN_FLIGHT_MOODS,
  headerFace,
  renderPanel,
  replyFaces,
  requestPlan,
} from './AssistantPanel.test-helpers';

describe('AssistantPanel', () => {
  describe('أبو غضب — the face and the voice', () => {
    it('names the character in the heading while the region, label and voice keep their roles', () => {
      const { container } = renderPanel();

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('أبو غضب');
      // One name, in the locale's language: the transliteration is not shown beside it.
      expect(heading).not.toHaveTextContent('Abu Ghadab');
      expect(heading.querySelector('[lang="ar"]')).toHaveTextContent('أبو غضب');
      expect(heading.querySelector('[lang="ar"]')).toHaveAttribute('dir', 'rtl');
      // The accessible surface is the tool's role, untouched by the rename.
      expect(screen.getByRole('region', { name: 'Assistant' })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Ask the assistant' })).toBeInTheDocument();

      // Exactly one live region: his voice, outside every aria-hidden seat.
      expect(screen.getAllByRole('status')).toHaveLength(1);
      const voice = screen.getByRole('status');
      expect(voice).toHaveAttribute('lang', 'ar');
      expect(voice).toHaveAttribute('dir', 'auto');
      expect(voice).toHaveAttribute('aria-live', 'polite');
      expect(voice).toHaveAttribute('aria-atomic', 'true');
      expect(voice).toHaveTextContent(IDLE_LINE_AR);
      expect(voice.closest('[aria-hidden="true"]')).toBeNull();

      // The faces are decoration: live in the header, at rest in the empty state.
      expect(headerFace(container)).toHaveAttribute('data-mood', 'idle');
      expect(headerFace(container)).toHaveAttribute('data-live');
      expect(headerFace(container).closest('[aria-hidden="true"]')).not.toBeNull();
      const emptyMark = container.querySelector('.pg-chat__empty-mark .pg-face');
      expect(emptyMark).toHaveAttribute('data-mood', 'idle');
      expect(emptyMark).not.toHaveAttribute('data-live');
      expect(
        screen.getByText('Ask for a section and I will propose the exact changes.'),
      ).toBeInTheDocument();
    });

    it('speaks English when the host asks for it', () => {
      renderPanel({ locale: 'en' });

      const voice = screen.getByRole('status');
      expect(voice).toHaveAttribute('lang', 'en');
      expect(voice).toHaveTextContent(IDLE_LINE_EN);

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('Abu Ghadab');
      expect(heading).not.toHaveTextContent('أبو غضب');
      expect(heading.querySelector('[lang="ar"]')).toBeNull();
      expect(heading.querySelector('[lang="en"]')).toHaveAttribute('dir', 'ltr');
    });

    it('listens while the composer has focus or a draft, and typing never changes what is announced', async () => {
      const { container, user } = renderPanel({ locale: 'en' });
      const composer = screen.getByRole<HTMLTextAreaElement>('textbox', {
        name: 'Ask the assistant',
      });
      const voice = screen.getByRole('status');
      expect(headerFace(container)).toHaveAttribute('data-mood', 'idle');

      await user.click(composer);
      expect(composer).toHaveFocus();
      await waitFor(() => {
        expect(headerFace(container)).toHaveAttribute('data-mood', 'listening');
      });
      expect(headerFace(container)).not.toHaveAttribute('data-typing');
      expect(voice).toHaveTextContent(IDLE_LINE_EN);

      await user.type(composer, 'add');
      await waitFor(() => {
        expect(headerFace(container)).toHaveAttribute('data-typing');
      });
      expect(voice).toHaveTextContent(IDLE_LINE_EN);
      // Listening is the face's business only: focus stays where the person put it.
      expect(composer).toHaveFocus();

      // The nudge relaxes on its own; the draft keeps him listening.
      await waitFor(
        () => {
          expect(headerFace(container)).not.toHaveAttribute('data-typing');
        },
        { timeout: 2000 },
      );
      expect(headerFace(container)).toHaveAttribute('data-mood', 'listening');
      expect(voice).toHaveTextContent(IDLE_LINE_EN);
    });

    it('follows a run in the header: reading while the provider works, then the proposal', async () => {
      let finish: ((plan: AiPlan) => void) | undefined;
      const provider: AiPlanProvider = {
        propose: () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      };
      const { container, user } = renderPanel({ locale: 'en', planProvider: provider });
      const voice = screen.getByRole('status');
      await user.type(
        screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Ask the assistant' }),
        'add a hero',
      );
      await user.click(screen.getByRole('button', { name: 'Send' }));
      const focusedAfterSend = document.activeElement;

      await waitFor(() => {
        expect(headerFace(container)).toHaveAttribute('data-mood', 'thinking');
      });
      expect(voice).toHaveTextContent(
        /^(Reading the page\.|Choosing skills\.|\d+ skills ready\.|Read \d+ fragments\.)$/,
      );
      // The live thinking bubble mirrors the header — frozen at 24 px, never live.
      expect(replyFaces(container)).toHaveLength(1);
      expect(replyFaces(container)[0]).toHaveAttribute('data-mood', 'thinking');
      expect(replyFaces(container)[0]).not.toHaveAttribute('data-live');
      expect(screen.getByText('Reading the page…')).toBeInTheDocument();

      act(() => {
        finish?.({
          rationale: 'Add a hero block to root.default.',
          commands: [{ command: 'insertNode', args: { type: 'hero', parentId: 'root' } }],
        });
      });
      await waitFor(
        () => {
          expect(voice).toHaveTextContent("That's the plan. Read it before you click.");
        },
        { timeout: 3000 },
      );
      expect(headerFace(container)).toHaveAttribute('data-mood', 'done');
      expect(headerFace(container)).toHaveAttribute('data-outcome', 'proposed');
      expect(replyFaces(container)[0]).toHaveAttribute('data-mood', 'done');
      expect(replyFaces(container)[0]).toHaveAttribute('data-outcome', 'proposed');
      expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
      // Mood changes never move focus.
      expect(document.activeElement).toBe(focusedAfterSend);
    });

    it('ends an Auto run on the applied line, in Arabic by default', async () => {
      const { container, user } = renderPanel();

      await user.click(screen.getByRole('radio', { name: 'Auto' }));
      await user.type(
        screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Ask the assistant' }),
        'add a pricing section',
      );
      await user.click(screen.getByRole('button', { name: 'Send' }));

      await waitFor(
        () => {
          expect(screen.getByRole('status')).toHaveTextContent('خلص. صار.');
        },
        { timeout: 3000 },
      );
      expect(headerFace(container)).toHaveAttribute('data-mood', 'done');
      expect(headerFace(container)).toHaveAttribute('data-outcome', 'applied');
      expect(replyFaces(container)[0]).toHaveAttribute('data-outcome', 'applied');
      expect(screen.getByText(/Applied as one change/)).toBeInTheDocument();
    });

    it('smiles when Apply is pressed on a card, and the English voice mirrors the card', async () => {
      const { container, user } = renderPanel({ locale: 'en' });

      await requestPlan(user, 'add a hero');
      await user.click(screen.getByRole('button', { name: 'Apply' }));

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent('Applied as one change.');
      });
      expect(headerFace(container)).toHaveAttribute('data-outcome', 'applied');
      expect(replyFaces(container)[0]).toHaveAttribute('data-mood', 'done');
      expect(replyFaces(container)[0]).toHaveAttribute('data-outcome', 'applied');
      expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    });

    it('rolls his eyes at a discard without touching the card', async () => {
      const { container, user } = renderPanel({ locale: 'en' });

      await requestPlan(user, 'add a hero');
      await user.click(screen.getByRole('button', { name: 'Discard' }));

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent('Tossed it? Fine. It was good.');
      });
      expect(headerFace(container)).toHaveAttribute('data-outcome', 'discarded');
      expect(replyFaces(container)[0]).toHaveAttribute('data-mood', 'done');
      expect(replyFaces(container)[0]).toHaveAttribute('data-outcome', 'discarded');
      expect(screen.getByText('Discarded.')).toBeInTheDocument();
    });

    it('winces when stopped, then settles back to idle while the bubble stays stopped', async () => {
      const provider: AiPlanProvider = {
        propose: (_request, _context, options) =>
          new Promise((_resolve, reject) => {
            options?.signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            });
          }),
      };
      const { container, user } = renderPanel({ locale: 'en', planProvider: provider });
      const voice = screen.getByRole('status');
      await user.type(
        screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Ask the assistant' }),
        'add a hero',
      );
      await user.click(screen.getByRole('button', { name: 'Send' }));
      await user.click(await screen.findByRole('button', { name: 'Stop' }));

      await waitFor(() => {
        expect(voice).toHaveTextContent('Stopped.');
      });
      expect(headerFace(container)).toHaveAttribute('data-mood', 'stopped');
      expect(replyFaces(container)[0]).toHaveAttribute('data-mood', 'stopped');
      // The card's own word is untouched — the voice mirrors it, so scope to the thread.
      expect(
        within(screen.getByRole('log', { name: 'Conversation' })).getByText('Stopped.'),
      ).toBeInTheDocument();

      // A stop is the person's own act: nothing to fix, so it does not pin.
      await waitFor(
        () => {
          expect(headerFace(container)).toHaveAttribute('data-mood', 'idle');
        },
        { timeout: 3000 },
      );
      expect(voice).toHaveTextContent(IDLE_LINE_EN);
      expect(replyFaces(container)[0]).toHaveAttribute('data-mood', 'stopped');
    });

    it('scowls at a refusal and holds it through focus until the next keystroke', async () => {
      const provider: AiPlanProvider = {
        propose: () =>
          Promise.reject(
            new AiProviderError('This request is outside the available Builder commands.', {
              code: 'refusal',
              retryable: false,
            }),
          ),
      };
      const { container, user } = renderPanel({ locale: 'en', planProvider: provider });
      const voice = screen.getByRole('status');
      const composer = screen.getByRole<HTMLTextAreaElement>('textbox', {
        name: 'Ask the assistant',
      });
      await user.type(composer, 'publish the site directly');
      await user.click(screen.getByRole('button', { name: 'Send' }));

      await waitFor(() => {
        expect(voice).toHaveTextContent("Not doing that. Reason's below.");
      });
      expect(headerFace(container)).toHaveAttribute('data-mood', 'failed');
      expect(replyFaces(container)[0]).toHaveAttribute('data-mood', 'failed');
      // The card is untouched: the provider's words and the typed code stay.
      expect(
        screen.getByText('This request is outside the available Builder commands.'),
      ).toBeInTheDocument();
      expect(screen.getByText('refusal')).toBeInTheDocument();

      // Tabbing or clicking through must not dismiss an error…
      await user.click(composer);
      expect(composer).toHaveFocus();
      await act(async () => {
        await Promise.resolve();
      });
      expect(headerFace(container)).toHaveAttribute('data-mood', 'failed');
      expect(voice).toHaveTextContent("Not doing that. Reason's below.");

      // …only a keystroke does.
      await user.keyboard('x');
      await waitFor(() => {
        expect(headerFace(container)).toHaveAttribute('data-mood', 'listening');
      });
      expect(voice).toHaveTextContent(IDLE_LINE_EN);
      expect(replyFaces(container)[0]).toHaveAttribute('data-mood', 'failed');
    });

    it('tells a retryable failure apart from a final one', async () => {
      const provider: AiPlanProvider = {
        propose: () =>
          Promise.reject(
            new AiProviderError('The assistant is temporarily busy.', {
              code: 'http-status',
              retryable: true,
              status: 503,
            }),
          ),
      };
      const { container, user } = renderPanel({ locale: 'en', planProvider: provider });
      await user.type(
        screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Ask the assistant' }),
        'add a hero',
      );
      await user.click(screen.getByRole('button', { name: 'Send' }));

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent("Didn't go through. Try again.");
      });
      expect(headerFace(container)).toHaveAttribute('data-mood', 'failed');
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });

    it('forgets the run on New chat: the face is idle and the late cancellation is dropped', async () => {
      let finish: ((plan: AiPlan) => void) | undefined;
      const events: AiAgentEvent[] = [];
      // Ignores abort: the late result must be refused by the lease, not by luck.
      const provider: AiPlanProvider = {
        propose: () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      };
      const { container, user } = renderPanel({
        locale: 'en',
        planProvider: provider,
        onAgentEvent: (event) => events.push(event),
      });
      const voice = screen.getByRole('status');
      await user.type(
        screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Ask the assistant' }),
        'add a hero',
      );
      await user.click(screen.getByRole('button', { name: 'Send' }));
      await screen.findByRole('button', { name: 'Stop' });
      /*
        IN FLIGHT, whichever beat. This waited for exactly `thinking`, but the
        provider here never answers, so the run moves on to `plan.proposing` and
        rests on `planning` — under a loaded full run the first poll landed
        after that and `thinking` was never seen again. What this test needs
        is "a run is showing on the face", not which beat of it.
      */
      await waitFor(() => {
        expect(IN_FLIGHT_MOODS).toContain(headerFace(container).getAttribute('data-mood'));
      });

      await user.click(screen.getByRole('button', { name: 'New chat' }));
      await waitFor(() => {
        expect(headerFace(container)).toHaveAttribute('data-mood', 'idle');
      });
      expect(voice).toHaveTextContent(IDLE_LINE_EN);
      expect(replyFaces(container)).toHaveLength(0);

      act(() => {
        finish?.({
          rationale: 'A stale proposal that must never appear here.',
          commands: [{ command: 'insertNode', args: { type: 'hero', parentId: 'root' } }],
        });
      });
      await waitFor(() => {
        expect(events.map(({ type }) => type)).toContain('run.cancelled');
      });
      // The old run's cancellation carries the old run id: the face drops it.
      expect(headerFace(container)).toHaveAttribute('data-mood', 'idle');
      expect(voice).toHaveTextContent(IDLE_LINE_EN);
      expect(
        screen.queryByText('A stale proposal that must never appear here.'),
      ).not.toBeInTheDocument();
    });
  });
});
