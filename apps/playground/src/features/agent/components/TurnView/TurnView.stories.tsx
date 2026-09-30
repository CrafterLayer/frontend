import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import type { Locale, TurnKind } from '../../model/view-types';
import {
  createFakeController,
  fakeViewState,
  type FakeCall,
  type FakeScenario,
} from '../../testing/fake-controller';
import { AgentTooltipProvider } from '../IconButton';

import { TurnView } from './TurnView';

interface Frame {
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

/** The panel's root at its width: theme, language, direction and the `agent` container. */
const inPanel: Decorator = (Story, { args, parameters }) => {
  const locale: Locale = args['locale'] === 'ar' ? 'ar' : 'en';
  const { theme = 'light', width = 320 } = (parameters['panel'] ?? {}) as Frame;
  return (
    <div
      className="ck-agent"
      data-bldr-theme={theme}
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      style={{
        inlineSize: width,
        padding: 'var(--bldr-space-xl) var(--bldr-space-3xl)',
        background: 'var(--bldr-panel)',
        color: 'var(--bldr-panel-text)',
        containerType: 'inline-size',
        containerName: 'agent',
      }}
    >
      <AgentTooltipProvider>
        <Story />
      </AgentTooltipProvider>
    </div>
  );
};

interface TurnStoryProps {
  readonly scenario: FakeScenario;
  /** Which turn of the scenario to draw. */
  readonly kind: TurnKind;
  readonly locale: Locale;
}

const onCall = fn<(call: FakeCall) => void>().mockName('controller');

/** One turn of a SPEC §3 state, drawn by TurnView over the fake controller. */
function TurnStory({ scenario, kind, locale }: TurnStoryProps) {
  const state = fakeViewState(scenario, locale);
  const turn = state.turns.find((candidate) => candidate.kind === kind);
  if (turn === undefined) return <p>{`${scenario} has no ${kind} turn`}</p>;
  return (
    <TurnView locale={locale} turn={turn} actions={createFakeController(state, { onCall })} />
  );
}

const meta = {
  title: 'Agent/Panel/TurnView',
  component: TurnStory,
  parameters: { layout: 'centered' },
  args: { scenario: 'built', kind: 'build', locale: 'en' },
  decorators: [inPanel],
} satisfies Meta<typeof TurnStory>;

export default meta;
type Story = StoryObj<typeof meta>;

const CLASS_BY_KIND: Readonly<Record<TurnKind, string>> = {
  user: 'ck-agent-message',
  build: 'ck-agent-build',
  edit: 'ck-agent-edit',
  answer: 'ck-agent-answer',
  'page-plan': 'ck-agent-plan',
  'step-plan': 'ck-agent-steps',
  proposal: 'ck-agent-proposal',
  error: 'ck-agent-error',
  end: 'ck-agent-end',
};

function turn(scenario: FakeScenario, kind: TurnKind, locale: Locale = 'en'): Story {
  return {
    args: { scenario, kind, locale },
    play: async ({ canvasElement }) => {
      await expect(canvasElement.querySelector(`.${CLASS_BY_KIND[kind]}`)).not.toBeNull();
    },
  };
}

export const UserMessage: Story = turn('built', 'user');
export const UserMessageArabic: Story = turn('built', 'user', 'ar');
export const Build: Story = turn('built', 'build');
export const BuildArabic: Story = turn('built', 'build', 'ar');
export const BuildRunning: Story = turn('building', 'build');
export const Edit: Story = turn('editDone', 'edit');
export const Answer: Story = turn('answer', 'answer');
export const PagePlan: Story = turn('planReady', 'page-plan');
export const PagePlanArabic: Story = turn('planReady', 'page-plan', 'ar');
export const StepPlan: Story = turn('stepPlan', 'step-plan');
export const Proposal: Story = turn('proposal', 'proposal');
export const Failure: Story = turn('error', 'error');
export const EndNote: Story = turn('proposalDiscarded', 'end');
export const EndNoteArabicDark: Story = {
  ...turn('proposalDiscarded', 'end', 'ar'),
  parameters: { panel: { theme: 'dark' } },
};
