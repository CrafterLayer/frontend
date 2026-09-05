import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import '../../../../app/App.css';
import type { ConversationSummary } from './ConversationMenu';
import { ConversationMenu } from './ConversationMenu';

const CONVERSATIONS: readonly ConversationSummary[] = [
  { id: 'c1', title: 'صفحة هبوط لمقهى', turnCount: 6 },
  { id: 'c2', title: 'قسم الأسعار', turnCount: 2 },
  { id: 'c3', title: 'New chat', turnCount: 0 },
];

/** The picker holding its own choice, the way the panel holds it. */
function LiveMenu({
  conversations = CONVERSATIONS,
}: {
  conversations?: readonly ConversationSummary[];
}) {
  const [activeId, setActiveId] = useState(conversations[1]?.id ?? '');
  return (
    <div style={{ width: 320 }}>
      <ConversationMenu conversations={conversations} activeId={activeId} onSelect={setActiveId} />
    </div>
  );
}

const meta = {
  title: 'Playground/ConversationMenu',
  component: LiveMenu,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof LiveMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Closed: the chat you are in, and how many there are. */
export const Default: Story = {};

/** A long history. The menu is the only way to reach the older ones. */
export const ManyConversations: Story = {
  args: {
    conversations: [
      ...CONVERSATIONS,
      { id: 'c4', title: 'ترويسة وتذييل', turnCount: 11 },
      { id: 'c5', title: 'ألوان الموقع', turnCount: 4 },
    ],
  },
};
