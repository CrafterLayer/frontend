import type { Meta, StoryObj } from '@storybook/react-vite';

import type {
  SourceAgentMode,
  SourceAgentPort,
  SourceAgentSnapshot,
} from '../../source-agent-types';
import { SourceAgentPanel } from './SourceAgentPanel';

class StorySourceAgentPort implements SourceAgentPort {
  private readonly listeners = new Set<() => void>();
  private snapshot: SourceAgentSnapshot;

  constructor(snapshot: SourceAgentSnapshot) {
    this.snapshot = snapshot;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  setMode = (mode: SourceAgentMode) => { this.publish({ ...this.snapshot, mode }); };
  setDraft = (draft: string) => { this.publish({ ...this.snapshot, draft }); };
  submit = () => undefined;
  stop = () => undefined;
  editQueued = (prompt: string) => {
    if (this.snapshot.queued !== null) {
      this.publish({ ...this.snapshot, queued: { ...this.snapshot.queued, prompt } });
    }
  };
  removeQueued = () => { this.publish({ ...this.snapshot, queued: null }); };
  newConversation = () => undefined;
  reviewChanges = (_turnId: string) => undefined;
  undo = (_turnId: string) => undefined;
  resume = (_turnId: string) => undefined;

  private publish(snapshot: SourceAgentSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
}

const donePort = new StorySourceAgentPort({
  mode: 'auto',
  draft: '',
  busy: false,
  enabled: true,
  context: 'Instance · Hero heading · Home',
  message: 'Preview and source match project-r8.',
  queued: null,
  turns: [
    {
      id: 'turn-8',
      prompt: 'Give this hero a stronger direction and keep the mobile layout calm.',
      pageTitle: 'Home',
      status: 'done',
      summary: 'Recomposed the hero, preserved reduced motion, and verified the preview.',
      currentTask: '',
      completed: 4,
      total: 4,
      files: ['pages/home/index.tsx', 'pages/home/styles.css'],
      details: ['apply_module_patch · complete', 'compile_preview · passed'],
      canUndo: true,
      canResume: false,
    },
  ],
});

const meta = {
  title: 'Playground/Preview/SourceAgentPanel',
  component: SourceAgentPanel,
  decorators: [
    (Story) => (
      <div style={{ blockSize: 720, inlineSize: 360 }}>
        <Story />
      </div>
    ),
  ],
  args: { port: donePort },
} satisfies Meta<typeof SourceAgentPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CompletedRun: Story = {};

export const EmptyAsk: Story = {
  args: {
    port: new StorySourceAgentPort({
      mode: 'ask',
      draft: '',
      busy: false,
      enabled: true,
      context: 'Page · Home',
      message: undefined,
      turns: [],
      queued: null,
    }),
  },
};

export const RunningWithQueue: Story = {
  args: {
    port: new StorySourceAgentPort({
      mode: 'auto',
      draft: '',
      busy: true,
      enabled: true,
      context: 'Instance · Pricing cards',
      message: 'Compiling the proposed source.',
      queued: { prompt: 'Then tighten mobile spacing', context: 'Instance · Pricing cards' },
      turns: [
        {
          id: 'turn-live',
          prompt: 'Make these cards easier to compare.',
          pageTitle: 'Pricing',
          status: 'running',
          summary: '',
          currentTask: 'Inspecting the preview at 390px',
          completed: 2,
          total: 4,
          files: ['pages/pricing/index.tsx'],
          details: ['inspect_preview · running'],
          canUndo: false,
          canResume: false,
        },
      ],
    }),
  },
};

export const Rtl: Story = {
  decorators: [
    (Story) => (
      <div dir="rtl" style={{ blockSize: 720, inlineSize: 360 }}>
        <Story />
      </div>
    ),
  ],
};
