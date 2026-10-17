import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import '../../../../app/App.css';
import type { MentionCandidate } from '../AssistantPanel/AssistantPanel.mentions';
import { insertMention, MENTION_PATTERN } from '../AssistantPanel/AssistantPanel.mentions';
import type { AssistantMode } from '../AssistantPanel/AssistantPanel.modes';
import { AssistantComposer } from './AssistantComposer';

const BLOCKS: readonly MentionCandidate[] = [
  { id: 'hero', type: 'hero', excerpt: 'ابنِ موقعك في دقيقة' },
  { id: 'pricing', type: 'pricing-table', excerpt: 'ثلاث خطط' },
  { id: 'faq-2', type: 'faq' },
];

/**
 * The live composer, holding the state the panel holds: draft, mode, focus and
 * the open mention. Stories that show a REACTION — typing `@`, switching mode —
 * need the real state, not a frozen prop.
 */
function LiveComposer({
  busy = false,
  initialDraft = '',
}: {
  busy?: boolean;
  initialDraft?: string;
}) {
  const [draft, setDraft] = useState(initialDraft);
  const [mentionQuery, setMentionQuery] = useState<string | null>(
    MENTION_PATTERN.exec(initialDraft)?.[1] ?? null,
  );
  const [mode, setMode] = useState<AssistantMode>('auto');
  const needle = (mentionQuery ?? '').toLowerCase();
  return (
    <div style={{ width: 420 }}>
      <AssistantComposer
        draft={draft}
        onDraftChange={setDraft}
        inputId="story-composer"
        busy={busy}
        onSend={() => {
          setDraft('');
        }}
        onStop={() => undefined}
        onFocusChange={() => undefined}
        mentionQuery={mentionQuery}
        onMentionQueryChange={setMentionQuery}
        mentionCandidates={BLOCKS.filter(
          (block) => block.id.includes(needle) || block.type.includes(needle),
        )}
        onPickMention={(id) => {
          setDraft((current) => insertMention(current, mentionQuery, id));
          setMentionQuery(null);
        }}
        mode={mode}
        onModeChange={setMode}
        modeLockId="story-mode-lock"
        locale="ar"
      />
    </div>
  );
}

const meta = {
  title: 'Playground/AssistantComposer',
  component: LiveComposer,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof LiveComposer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Empty. Send is off — there is nothing to send — and the hint says what Auto does. */
export const Empty: Story = {};

/** A request written. Send is live. */
export const Written: Story = { args: { initialDraft: 'أضف قسم أسعار' } };

/** An `@` under the caret: the picker is open over the field. */
export const MentionOpen: Story = { args: { initialDraft: 'حسّن @' } };

/**
 * A run in flight. The field is closed, the modes are locked, and the send slot
 * is Stop — the same place the hand just was.
 */
export const Busy: Story = { args: { busy: true, initialDraft: 'أضف قسم أسعار' } };
