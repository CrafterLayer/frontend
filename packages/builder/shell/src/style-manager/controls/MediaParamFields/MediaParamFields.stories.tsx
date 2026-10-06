import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { MediaParamFields, type MediaParamFieldsProps, type MediaParamRow } from './MediaParamFields';
import { MEDIA_PARAM_FIELDS_LABELS_AR } from './MediaParamFields.labels';

function Controlled(props: MediaParamFieldsProps) {
  const [rows, setRows] = useState<readonly MediaParamRow[]>(props.rows);
  return (
    <MediaParamFields
      {...props}
      rows={rows}
      onCommit={(key, value) => {
        setRows((current) => current.map((row) => (row.key === key ? { ...row, value } : row)));
      }}
    />
  );
}

const ROWS_EN: readonly MediaParamRow[] = [
  { key: 'data-ck-indicator', label: 'Position indicator', value: 'dots', choices: ['dots', 'counter', 'none'] },
  { key: 'data-ck-autoplay', label: 'Autoplay', value: 'false', choices: ['true', 'false'] },
  { key: 'data-ck-speed', label: 'Speed', value: undefined, choices: ['slow', 'normal', 'fast'] },
  { key: 'data-ck-email', label: 'Send to (email)', value: 'hello@example.com', input: 'email' },
];

const ROWS_AR: readonly MediaParamRow[] = [
  { key: 'data-ck-indicator', label: 'مؤشر الموضع', value: 'counter', choices: ['dots', 'counter', 'none'] },
  { key: 'data-ck-autoplay', label: 'تشغيل تلقائي', value: 'true', choices: ['true', 'false'] },
  { key: 'data-ck-email', label: 'الإرسال إلى (البريد)', value: 'salam@example.com', input: 'email' },
];

const meta = {
  title: 'Builder/Shell/StyleManager/MediaParamFields',
  component: MediaParamFields,
  render: (args) => <Controlled {...args} />,
  decorators: [
    (Story) => (
      <div className="bldr-root" style={{ maxInlineSize: '20rem', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
  args: { rows: ROWS_EN, onCommit: () => undefined, dir: 'ltr' },
} satisfies Meta<typeof MediaParamFields>;

export default meta;
type Story = StoryObj<typeof meta>;

/** English, left to right: a carousel and a mailto form's rows. */
export const EnglishLtr: Story = {};
/** Arabic, right to left: arrow keys mirror. */
export const ArabicRtl: Story = { args: { rows: ROWS_AR, dir: 'rtl', labels: MEDIA_PARAM_FIELDS_LABELS_AR } };
