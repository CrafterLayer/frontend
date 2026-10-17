import type { Meta, StoryObj } from '@storybook/react-vite';
import { useLayoutEffect, useRef, useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import type { CustomCodeNode, CustomCodeRoot } from '@craftkit/builder-schema';

import { CustomCode } from '../../../components/CustomCode/CustomCode';
import { mountMailtoForm } from '../mailto-form';

interface Copy {
  readonly name: string;
  readonly email: string;
  readonly message: string;
  readonly send: string;
}

function field(id: string, label: string, control: CustomCodeNode): CustomCodeNode[] {
  return [{ kind: 'element', tag: 'label', text: label, attributes: { for: id } }, control];
}

function mailtoTree(copy: Copy): CustomCodeRoot {
  return {
    kind: 'root',
    children: [
      {
        kind: 'element',
        tag: 'form',
        attributes: { 'data-ck-behavior': 'mailto-form', 'data-ck-email': 'hello@example.com' },
        children: [
          ...field('mail-name', copy.name, {
            kind: 'element',
            tag: 'input',
            attributes: { id: 'mail-name', name: 'name', required: '' },
          }),
          ...field('mail-email', copy.email, {
            kind: 'element',
            tag: 'input',
            attributes: { id: 'mail-email', name: 'email', type: 'email' },
          }),
          ...field('mail-message', copy.message, {
            kind: 'element',
            tag: 'textarea',
            attributes: { id: 'mail-message', name: 'message' },
          }),
          { kind: 'element', tag: 'button', text: copy.send, attributes: { type: 'submit' } },
        ],
      },
    ],
  };
}

interface StageProps {
  readonly tree: CustomCodeRoot;
  readonly locale: 'ar' | 'en';
  readonly isCanvas?: boolean;
}

/*
  The story never opens a mail app: the pack takes an injected window, and the
  address it would open is printed below the form instead. It mounts in a
  LAYOUT effect, before CustomCode's own passive behaviour effect, so the
  pack's per-form guard keeps the story's (injected) mount the only one.
*/
function MailtoStage({ tree, locale, isCanvas = false }: StageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [sent, setSent] = useState('');
  useLayoutEffect(() => {
    const region = ref.current;
    if (region === null) return undefined;
    const stand = {
      location: {
        get href() {
          return '';
        },
        set href(value: string) {
          setSent(value);
        },
      },
    };
    return mountMailtoForm(region, { interactive: !isCanvas, window: stand });
  }, [tree, isCanvas]);
  return (
    <div lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} style={{ maxInlineSize: 480 }}>
      <div ref={ref}>
        <CustomCode hostId="mailto-story" tree={tree} isCanvas={isCanvas} />
      </div>
      <output data-testid="mailto-url" style={{ display: 'block', marginBlockStart: 12, wordBreak: 'break-all' }}>
        {sent}
      </output>
    </div>
  );
}

const meta = {
  title: 'Builder/Renderer/Behaviors/MailtoForm',
  component: MailtoStage,
  parameters: { layout: 'padded' },
  args: {
    tree: mailtoTree({ name: 'Name', email: 'Email', message: 'Message', send: 'Send' }),
    locale: 'en',
  },
} satisfies Meta<typeof MailtoStage>;

export default meta;
type Story = StoryObj<typeof meta>;

function mailOf(url: string): URLSearchParams {
  return new URLSearchParams(url.split('?')[1] ?? '');
}

/** Send opens the mail app with a subject and one labelled line per filled field. */
export const English: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Name'), 'Layla');
    await userEvent.type(canvas.getByLabelText('Message'), 'A table for two & a cake?');
    await userEvent.click(canvas.getByRole('button', { name: 'Send' }));
    const output = canvas.getByTestId('mailto-url');
    await waitFor(() => expect(output.textContent).toMatch(/^mailto:hello@example\.com\?/u));
    const mail = mailOf(output.textContent);
    await expect(mail.get('subject')).toBe('Layla');
    await expect(mail.get('body')).toBe('Name: Layla\r\nMessage: A table for two & a cake?');
  },
};

/** Arabic labels travel into the body, encoded, and read back unchanged. */
export const Arabic: Story = {
  args: {
    tree: mailtoTree({ name: 'الاسم', email: 'البريد', message: 'الرسالة', send: 'أرسل' }),
    locale: 'ar',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('الاسم'), 'ليلى');
    await userEvent.click(canvas.getByRole('button', { name: 'أرسل' }));
    const output = canvas.getByTestId('mailto-url');
    await waitFor(() => expect(output.textContent).not.toBe(''));
    await expect(mailOf(output.textContent).get('body')).toBe('الاسم: ليلى');
  },
};

/** On the editing canvas nothing sends: the pack mounts nothing there. */
export const Canvas: Story = {
  args: { isCanvas: true },
  play: async ({ canvasElement }) => {
    const form = canvasElement.querySelector('form');
    await expect(form?.hasAttribute('data-ck-mounted')).toBe(false);
  },
};
