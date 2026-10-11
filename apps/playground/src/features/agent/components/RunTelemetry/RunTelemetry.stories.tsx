import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { RunTelemetry } from './RunTelemetry';

const meta = {
  title: 'Agent/Records/RunTelemetry',
  component: RunTelemetry,
  args: {
    locale: 'en',
    live: true,
    state: {
      activity: [{ stage: 'reading' }, { stage: 'writing', scope: 'Hero' }],
      attempts: { one: null },
    },
  },
  decorators: [
    (Story, context) => (
      <div
        className="ck-agent"
        lang={context.args.locale}
        dir={context.args.locale === 'ar' ? 'rtl' : 'ltr'}
        style={{ width: 288, padding: 16 }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RunTelemetry>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Live: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('status')).toHaveTextContent('Hero');
    await expect(canvas.getAllByText('Not reported')).toHaveLength(4);
  },
};
export const Measured: Story = {
  args: {
    state: {
      activity: [],
      attempts: {
        one: { inputTokens: 180, outputTokens: 75, cacheReadTokens: 400, cacheWriteTokens: 0 },
      },
    },
  },
};
export const Cached: Story = {
  args: {
    state: {
      activity: [],
      attempts: {
        one: {
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          cached: true,
        },
      },
    },
  },
};
export const PartialMeasurement: Story = {
  args: {
    state: {
      activity: [],
      attempts: {
        one: {
          inputTokens: 180,
          outputTokens: null,
          cacheReadTokens: null,
          cacheWriteTokens: null,
        },
      },
    },
  },
};
export const EmptyHistorical: Story = { args: { state: { activity: [], attempts: {} } } };
export const ArabicNarrow: Story = { args: { locale: 'ar' } };
