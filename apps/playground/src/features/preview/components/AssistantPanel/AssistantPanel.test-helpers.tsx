/*
  Shared fixtures for the AssistantPanel suites (split from AssistantPanel.test.tsx,
  2026-10-13): a three-block vocabulary, the kernel it runs on, the panel
  renderer, the face readers, and the "ask and wait for a plan" step. Not a
  test file itself.
*/
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect } from 'vitest';

import { fixedClock, seededIds } from '@craftkit/builder/testing';
import {
  createBuilder,
  defineBlockSchema,
  type BuilderKernel,
  type TrustedExtensionManifest,
} from '@craftkit/builder';
import { z } from 'zod';

import { AssistantPanel, type AssistantPanelProps } from './AssistantPanel';

export const page = defineBlockSchema({
  type: 'page',
  description: 'The page root.',
  props: z.object({}),
  slots: { default: { allow: ['hero', 'pricing'], max: 2 } },
  examples: [],
});
export const hero = defineBlockSchema({
  type: 'hero',
  description: 'An opening section with a heading.',
  props: z.object({ heading: z.string().min(1).default('Your headline') }),
  examples: [{ prompt: 'add a hero', node: { type: 'hero', props: { heading: 'Hello' } } }],
});
export const pricing = defineBlockSchema({
  type: 'pricing',
  description: 'A pricing section.',
  props: z.object({ heading: z.string().min(1).default('Pricing') }),
  examples: [{ prompt: 'add a pricing section', node: { type: 'pricing', props: {} } }],
});
export const nullRender = () => null;
export const vocabulary: TrustedExtensionManifest = {
  tier: 1,
  name: 'assistant-panel.vocabulary',
  version: '0.0.0',
  contributes: {
    blocks: [
      { schema: page, render: nullRender },
      { schema: hero, render: nullRender },
      { schema: pricing, render: nullRender },
    ],
  },
};

export function createAssistantKernel(): BuilderKernel {
  return createBuilder({
    document: {
      schemaVersion: 1,
      surface: 'site',
      dir: 'ltr',
      rootId: 'root',
      nodes: {
        root: {
          id: 'root',
          type: 'page',
          props: {},
          slots: { default: ['selected-hero'] },
        },
        'selected-hero': {
          id: 'selected-hero',
          type: 'hero',
          props: { heading: 'Existing section' },
        },
      },
    },
    extensions: [vocabulary],
    ports: { clock: fixedClock(0), ids: seededIds('assistant-panel') },
  });
}

export function renderPanel(props: Partial<AssistantPanelProps> = {}) {
  const kernel = props.kernel ?? createAssistantKernel();
  const user = userEvent.setup();
  const { container, unmount } = render(<AssistantPanel kernel={kernel} {...props} />);
  return { container, kernel, user, unmount };
}

/**
 * The faces sit inside aria-hidden seats on purpose (the voice line is what a
 * screen reader hears), so they are reached by class, never by role.
 */
export function headerFace(container: HTMLElement): HTMLElement {
  const face = container.querySelector<HTMLElement>('.pg-chat__brand-mark .pg-face');
  if (face === null) {
    throw new Error('The header must seat the character face.');
  }
  return face;
}

export function replyFaces(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('.pg-chat__avatar .pg-face')];
}

/** Idle and listening share one line on purpose: focus and keystrokes are never announced. */
export const IDLE_LINE_EN = 'Say what you want. Skip the preamble.';
export const IDLE_LINE_AR = 'قول شو بدك. بدون مقدمات.';

/** The beats of an ordinary run before it has an outcome: reading, then planning. */
export const IN_FLIGHT_MOODS: readonly (string | null)[] = ['thinking', 'planning'];

export async function requestPlan(
  user: ReturnType<typeof userEvent.setup>,
  request: string,
): Promise<void> {
  const existingPlans = screen.queryAllByRole('button', { name: 'Apply' }).length;
  const composer = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Ask the assistant' });
  await user.clear(composer);
  await user.type(composer, request);
  await user.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => {
    expect(screen.getAllByRole('button', { name: 'Apply' })).toHaveLength(existingPlans + 1);
  });
}
