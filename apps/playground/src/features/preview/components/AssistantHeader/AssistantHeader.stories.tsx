import type { Meta, StoryObj } from '@storybook/react-vite';

import '../../../../app/App.css';
import { AssistantHeader } from './AssistantHeader';

const meta = {
  title: 'Playground/AssistantHeader',
  component: AssistantHeader,
  parameters: { layout: 'centered' },
  args: {
    locale: 'ar',
    face: { mood: 'idle', line: { key: 'idle' }, typing: false, since: 0 },
    sees: 'the whole page',
    conversations: [{ id: 'c1', title: 'صفحة هبوط لمقهى', turnCount: 4 }],
    activeId: 'c1',
    onSelectConversation: () => undefined,
    onNewChat: () => undefined,
    watchZone: null,
    holdSeat: null,
  },
} satisfies Meta<typeof AssistantHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Idle, one conversation: no picker, because a menu with one option is a label. */
export const Default: Story = {};

/** The same header in English. One name, never two. */
export const English: Story = { args: { locale: 'en' } };

/** A block is selected, so he says which one rather than leaving it to be guessed. */
export const WithSelection: Story = { args: { sees: 'pricing-table · selected' } };

/** Thinking: the face is live and the voice narrates what a reader cannot see. */
export const Working: Story = {
  args: {
    face: {
      mood: 'thinking',
      line: { key: 'thinking', subject: 'the page' },
      typing: true,
      since: 0,
    },
  },
};

/** Two conversations, so the picker appears beneath the voice. */
export const WithConversations: Story = {
  args: {
    conversations: [
      { id: 'c1', title: 'صفحة هبوط لمقهى', turnCount: 4 },
      { id: 'c2', title: 'قسم الأسعار', turnCount: 1 },
    ],
  },
};
