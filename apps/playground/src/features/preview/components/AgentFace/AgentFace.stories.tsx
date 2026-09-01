import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { useRef, useState } from 'react';

import type { AiAgentEvent } from '@craftkit/builder';

import '../../../../app/App.css';
import { AgentFace, type AgentFaceProps, type AgentFaceSize } from './AgentFace';
import { AgentVoice } from './AgentVoice';
import {
  agentMoodText,
  useAgentMood,
  type AgentLocale,
  type AgentMoodLine,
  type AgentMoodSnapshot,
} from './agent-mood';

/* ── The copy deck: one line per pose, so a story and its voice always agree ─ */

interface Pose {
  readonly name: string;
  readonly face: AgentFaceProps;
  readonly line: AgentMoodLine;
}

const POSES: readonly Pose[] = [
  { name: 'idle', face: { mood: 'idle' }, line: { key: 'idle' } },
  { name: 'listening', face: { mood: 'listening' }, line: { key: 'idle' } },
  { name: 'listening, typing', face: { mood: 'listening', typing: true }, line: { key: 'idle' } },
  {
    name: 'thinking',
    face: { mood: 'thinking' },
    line: { key: 'thinking.subject', subject: 'the hero block' },
  },
  { name: 'planning', face: { mood: 'planning' }, line: { key: 'planning' } },
  {
    name: 'planning, checking',
    face: { mood: 'planning', variant: 'checking' },
    line: { key: 'checking.1' },
  },
  {
    name: 'planning, repairing',
    face: { mood: 'planning', variant: 'repairing' },
    line: { key: 'repairing', n: 1 },
  },
  { name: 'working', face: { mood: 'working' }, line: { key: 'working' } },
  {
    name: 'done, proposed',
    face: { mood: 'done', outcome: 'proposed' },
    line: { key: 'done.proposed' },
  },
  {
    name: 'done, applied',
    face: { mood: 'done', outcome: 'applied' },
    line: { key: 'done.applied' },
  },
  {
    name: 'done, planned',
    face: { mood: 'done', outcome: 'planned' },
    line: { key: 'done.planned' },
  },
  {
    name: 'done, discarded',
    face: { mood: 'done', outcome: 'discarded' },
    line: { key: 'done.discarded' },
  },
  { name: 'failed', face: { mood: 'failed' }, line: { key: 'failed.retryable' } },
  { name: 'stopped', face: { mood: 'stopped' }, line: { key: 'stopped' } },
];

function snapshotFor(face: AgentFaceProps, line: AgentMoodLine): AgentMoodSnapshot {
  return {
    mood: face.mood,
    ...(face.variant === undefined ? {} : { variant: face.variant }),
    ...(face.outcome === undefined ? {} : { outcome: face.outcome }),
    line,
    typing: face.typing === true,
    since: 0,
  };
}

/* ── Showcase: one live face beside its voice in both tiers ─────────────── */

interface ShowcaseProps extends AgentFaceProps {
  readonly line: AgentMoodLine;
}

function Showcase({ line, ...face }: ShowcaseProps) {
  const snapshot = snapshotFor(face, line);
  return (
    <div
      style={{
        alignItems: 'center',
        display: 'grid',
        gap: 'var(--bldr-space-xl)',
        gridTemplateColumns: 'auto 1fr',
        inlineSize: '22rem',
      }}
    >
      <span aria-hidden="true">
        <AgentFace {...face} />
      </span>
      <div style={{ display: 'grid', gap: 'var(--bldr-space-xs)' }}>
        <AgentVoice snapshot={snapshot} locale="ar" />
        <AgentVoice snapshot={snapshot} locale="en" />
      </div>
    </div>
  );
}

const meta = {
  title: 'Playground/AgentFace',
  component: AgentFace,
  parameters: { layout: 'centered' },
  args: { mood: 'idle', size: 'md', live: true },
  argTypes: {
    mood: {
      control: 'select',
      options: [
        'idle',
        'listening',
        'thinking',
        'planning',
        'working',
        'done',
        'failed',
        'stopped',
      ],
    },
    variant: { control: 'select', options: [undefined, 'checking', 'repairing'] },
    outcome: {
      control: 'select',
      options: [undefined, 'proposed', 'applied', 'planned', 'discarded'],
    },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
} satisfies Meta<typeof AgentFace>;

export default meta;

type Story = StoryObj<typeof meta>;

function poseStory(name: string): Story {
  const pose = POSES.find((candidate) => candidate.name === name);
  if (pose === undefined) throw new Error(`unknown pose ${name}`);
  return {
    args: { ...pose.face, size: 'md', live: true },
    render: (args) => <Showcase {...args} line={pose.line} />,
  };
}

export const Idle: Story = poseStory('idle');
export const Listening: Story = poseStory('listening');
export const ListeningTyping: Story = poseStory('listening, typing');
export const Thinking: Story = poseStory('thinking');
export const Planning: Story = poseStory('planning');
export const PlanningChecking: Story = poseStory('planning, checking');
export const PlanningRepairing: Story = poseStory('planning, repairing');
export const Working: Story = poseStory('working');
export const DoneProposed: Story = poseStory('done, proposed');
export const DoneApplied: Story = poseStory('done, applied');
export const DonePlanned: Story = poseStory('done, planned');
export const DoneDiscarded: Story = poseStory('done, discarded');
export const Failed: Story = poseStory('failed');
export const Stopped: Story = poseStory('stopped');

/* ── Every pose at every size, captioned with its line: the docs' copy deck ─ */

const SIZES: readonly AgentFaceSize[] = ['sm', 'md', 'lg'];

function Grid({ locale = 'en' }: { readonly locale?: AgentLocale }) {
  return (
    <div
      style={{
        display: 'grid',
        gap: 'var(--bldr-space-3xl)',
        gridTemplateColumns: 'repeat(auto-fill, minmax(11rem, 1fr))',
        inlineSize: 'min(64rem, 90vw)',
      }}
    >
      {POSES.map((pose) => (
        <figure
          key={pose.name}
          style={{
            display: 'grid',
            gap: 'var(--bldr-space-sm)',
            justifyItems: 'start',
            margin: 0,
          }}
        >
          <span
            aria-hidden="true"
            style={{ alignItems: 'end', display: 'flex', gap: 'var(--bldr-space-md)' }}
          >
            {SIZES.map((size) => (
              <AgentFace key={size} {...pose.face} size={size} />
            ))}
          </span>
          <figcaption
            style={{
              color: 'var(--bldr-panel-text-soft)',
              fontSize: 'var(--bldr-font-size-caption)',
              lineHeight: 'var(--bldr-line-height-snug)',
            }}
          >
            {pose.name} — {agentMoodText(snapshotFor(pose.face, pose.line), locale)}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

export const AllMoods: Story = {
  parameters: { layout: 'padded' },
  render: () => <Grid />,
};

export const Sizes: Story = {
  args: { mood: 'done', outcome: 'applied' },
  render: (args) => (
    <span
      aria-hidden="true"
      style={{ alignItems: 'end', display: 'flex', gap: 'var(--bldr-space-3xl)' }}
    >
      {SIZES.map((size) => (
        <AgentFace key={size} {...args} size={size} />
      ))}
    </span>
  ),
};

/* The face is a face, not text: its asymmetric brows are deliberately NOT
   mirrored, and the component never sets `dir`. Only the voice line follows
   the content direction, from its own first strong character. */
export const RightToLeft: Story = {
  ...poseStory('listening'),
  decorators: [
    (StoryFn) => (
      <div dir="rtl">
        <StoryFn />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const face = canvasElement.querySelector('.pg-face');
    await expect(face).toHaveAttribute('data-mood', 'listening');
    const [arabic, english] = within(canvasElement).getAllByRole('status');
    await expect(arabic).toHaveAttribute('dir', 'auto');
    await expect(english).toHaveAttribute('lang', 'en');
  },
};

export const DarkTheme: Story = {
  parameters: { layout: 'padded' },
  render: () => (
    <div
      data-bldr-theme="dark"
      style={{ background: 'var(--bldr-panel)', padding: 'var(--bldr-space-3xl)' }}
    >
      <Grid />
    </div>
  ),
};

/* Inside `.pg-chat` the face inherits `--pg-face-glow`, the aurora rhyme the
   chat's own literals define in App.css; outside it the glow is transparent. */
export const InsideChat: Story = {
  ...poseStory('thinking'),
  decorators: [
    (StoryFn) => (
      <div className="pg-chat" style={{ padding: 'var(--bldr-space-3xl)' }}>
        <StoryFn />
      </div>
    ),
  ],
};

/* ── Walkthrough: the reducer driven step by step through a real run ──────── */

interface Step {
  readonly label: string;
  readonly mood: AgentFaceProps['mood'];
  readonly text: string;
}

const SCRIPT: readonly Step[] = [
  { label: 'run.begin (the hero block)', mood: 'thinking', text: 'Reading the hero block.' },
  { label: 'skills.resolved n=2', mood: 'thinking', text: '2 skills ready.' },
  { label: 'context.ready n=5', mood: 'thinking', text: 'Read 5 fragments.' },
  { label: 'plan.proposing', mood: 'planning', text: "Working. Don't interrupt." },
  { label: 'plan.progress', mood: 'planning', text: 'Adding a hero above the pricing table…' },
  { label: 'plan.validating 1', mood: 'planning', text: 'Checking my work before you see it.' },
  { label: 'plan.repairing (1 issue)', mood: 'planning', text: 'Found a flaw. Fixing it.' },
  { label: 'plan.validating 2', mood: 'planning', text: 'Checking the repair.' },
  {
    label: 'run.completed proposed',
    mood: 'done',
    text: "That's the plan. Read it before you click.",
  },
  {
    label: 'composer focus (the hold keeps done)',
    mood: 'done',
    text: "That's the plan. Read it before you click.",
  },
  { label: 'run.begin (the page)', mood: 'thinking', text: 'Reading the page.' },
  { label: 'run.failed retryable', mood: 'failed', text: "Didn't go through. Try again." },
  { label: 'keystroke', mood: 'listening', text: 'Say what you want. Skip the preamble.' },
];

type EventBody = AiAgentEvent extends infer E
  ? E extends unknown
    ? Omit<E, 'runId' | 'seq' | 'at'>
    : never
  : never;

function WalkthroughHarness() {
  const [index, setIndex] = useState(0);
  const [composerFocused, setComposerFocused] = useState(false);
  const [draftLength, setDraftLength] = useState(0);
  const seq = useRef(0);
  const runId = useRef('run-1');
  const face = useAgentMood({ mode: 'ask', composerFocused, draftLength });

  const emit = (body: EventBody) => {
    const event = { ...body, runId: runId.current, seq: seq.current, at: Date.now() };
    seq.current += 1;
    face.onEvent(event);
  };

  const actions: readonly (() => void)[] = [
    () => {
      face.beginRun('run-1', 'the hero block');
    },
    () => {
      emit({
        type: 'skills.resolved',
        activations: [{}, {}] as never,
        omitted: [],
        totalTokens: 0,
      });
    },
    () => {
      emit({ type: 'context.ready', fragmentCount: 5, totalTokens: 0 });
    },
    () => {
      emit({ type: 'plan.proposing' });
    },
    () => {
      emit({ type: 'plan.progress', text: 'Adding a hero above the pricing table…' });
    },
    () => {
      emit({ type: 'plan.validating', attempt: 1 });
    },
    () => {
      emit({ type: 'plan.repairing', issues: ['hero.heading must not be empty'] });
    },
    () => {
      emit({ type: 'plan.validating', attempt: 2 });
    },
    () => {
      emit({ type: 'run.completed', status: 'proposed' });
    },
    () => {
      setComposerFocused(true);
    },
    () => {
      runId.current = 'run-2';
      seq.current = 0;
      face.beginRun('run-2', 'the page');
    },
    () => {
      emit({
        type: 'run.failed',
        error: { source: 'provider', code: 'http-status', message: 'busy', retryable: true },
      });
    },
    () => {
      setDraftLength(1);
    },
  ];

  const restart = () => {
    face.reset();
    runId.current = 'run-1';
    seq.current = 0;
    setComposerFocused(false);
    setDraftLength(0);
    setIndex(0);
  };

  const next = () => {
    const action = actions[index];
    if (action === undefined) return;
    action();
    setIndex(index + 1);
  };

  const step = SCRIPT[index];
  return (
    <div style={{ display: 'grid', gap: 'var(--bldr-space-xl)', inlineSize: '24rem' }}>
      <div
        style={{
          alignItems: 'center',
          display: 'grid',
          gap: 'var(--bldr-space-xl)',
          gridTemplateColumns: 'auto 1fr',
        }}
      >
        <span aria-hidden="true">
          <AgentFace
            live
            size="md"
            mood={face.snapshot.mood}
            variant={face.snapshot.variant}
            outcome={face.snapshot.outcome}
            typing={face.snapshot.typing}
          />
        </span>
        <AgentVoice snapshot={face.snapshot} locale="en" />
      </div>
      <p
        style={{
          color: 'var(--bldr-panel-muted)',
          fontSize: 'var(--bldr-font-size-caption)',
          margin: 0,
        }}
      >
        {step === undefined ? 'End of script.' : `Next: ${step.label}`}
      </p>
      <div style={{ display: 'flex', gap: 'var(--bldr-space-md)' }}>
        <button type="button" onClick={next} disabled={step === undefined}>
          Next
        </button>
        <button type="button" onClick={restart}>
          Restart
        </button>
      </div>
    </div>
  );
}

export const Walkthrough: Story = {
  render: () => <WalkthroughHarness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const face = canvasElement.querySelector('.pg-face');
    // Relative to the current state, so Interactions → Rerun starts clean.
    await userEvent.click(canvas.getByRole('button', { name: 'Restart' }));
    await waitFor(async () => {
      await expect(face).toHaveAttribute('data-mood', 'idle');
    });
    for (const step of SCRIPT) {
      await userEvent.click(canvas.getByRole('button', { name: 'Next' }));
      await waitFor(async () => {
        await expect(face).toHaveAttribute('data-mood', step.mood);
        await expect(canvas.getByRole('status')).toHaveTextContent(step.text);
      });
    }
  },
};
