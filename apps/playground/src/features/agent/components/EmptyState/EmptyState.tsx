import { tParts, type Key } from '../../copy';
import type { CopyParams, EmptyStateView, Locale } from '../../model/view-types';
import { AgentFace, type AgentMood } from '../../../preview/components/AgentFace';

import './EmptyState.css';

export interface EmptyStateProps {
  readonly locale: Locale;
  /** Which greeting: an empty page, a page with content, or a block selected (SPEC §4.16). */
  readonly view: EmptyStateView;
  /** The face's mood. The empty thread waits, so the default is `idle`. */
  readonly mood?: AgentMood | undefined;
}

interface Greeting {
  readonly key: Key;
  readonly params: CopyParams;
}

function greetingOf(view: EmptyStateView): Greeting {
  switch (view.kind) {
    case 'greeting':
      return { key: 'empty.greeting', params: {} };
    case 'hasContent':
      return { key: 'empty.hasContent', params: { n: view.sections } };
    case 'selection':
      return { key: 'empty.selection', params: { title: view.title } };
  }
}

/**
 * The empty thread (SPEC §3.1, §4.16): أبو غضب's face at 48px and one greeting in Lead
 * type, start-aligned. AgentThread anchors it to the bottom of the thread, directly above
 * the composer where the eye already is, and puts the suggestion rows under it.
 *
 * The greeting is the character speaking, the one place his own voice appears (SPEC §1,
 * §4.0): Levantine in Arabic, written in forms that read the same for either gender.
 * Three variants: the page is empty, it already has sections, or a block is selected.
 * A selected block's title is the page's words, so it sits in `<bdi>`.
 *
 * The face is decoration (`aria-hidden`) and still: `live` belongs to the header's face
 * alone (SPEC §5 moment 11).
 */
export function EmptyState({ locale, view, mood = 'idle' }: EmptyStateProps) {
  const { key, params } = greetingOf(view);
  return (
    <div className="ck-agent-empty" data-kind={view.kind}>
      <span className="ck-agent-empty__face" aria-hidden="true">
        <AgentFace size="lg" mood={mood} />
      </span>
      <p className="ck-agent-empty__greeting">
        {tParts(locale, key, params).map((part, index) =>
          part.kind === 'value' ? <bdi key={index}>{part.text}</bdi> : part.text,
        )}
      </p>
    </div>
  );
}
