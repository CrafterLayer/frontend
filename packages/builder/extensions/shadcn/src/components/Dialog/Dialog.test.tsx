import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Dialog } from './Dialog';
import { dialogSchema } from './schema';

const node: Node = { id: 'dialog-test', type: 'dialog', props: {} };

describe('Dialog', () => {
  it('opens a labelled native modal, moves focus, and restores the trigger on close', async () => {
    const user = userEvent.setup();
    render(
      <Dialog
        node={node}
        props={dialogSchema.props.parse({
          triggerLabel: 'Open details',
          title: 'Project details',
          body: 'Review the scope before continuing.',
          primaryAction: { label: 'Continue', href: '/continue' },
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Open details' });
    await user.click(trigger);

    const dialog = screen.getByRole('dialog', { name: 'Project details' });
    expect(dialog).toHaveAttribute('open');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('Review the scope before continuing.');
    expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(dialog).not.toHaveAttribute('open');
    expect(trigger).toHaveFocus();
  });

  it('honors Escape and overlay close policies', async () => {
    const user = userEvent.setup();
    const props = dialogSchema.props.parse({
      triggerLabel: 'Open policy dialog',
      title: 'Policy dialog',
      closeOnEscape: false,
      closeOnOverlay: false,
    });
    const { rerender } = render(
      <Dialog node={node} props={props} slots={{}} data={{}} isCanvas={false} />,
    );

    await user.click(screen.getByRole('button', { name: 'Open policy dialog' }));
    let dialog = screen.getByRole('dialog', { name: 'Policy dialog' });
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    fireEvent.click(dialog);
    expect(dialog).toHaveAttribute('open');

    rerender(
      <Dialog
        node={node}
        props={dialogSchema.props.parse({
          ...props,
          closeOnEscape: true,
          closeOnOverlay: true,
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );
    dialog = screen.getByRole('dialog', { name: 'Policy dialog' });
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(dialog).not.toHaveAttribute('open');

    await user.click(screen.getByRole('button', { name: 'Open policy dialog' }));
    dialog = screen.getByRole('dialog', { name: 'Policy dialog' });
    const panel = screen.getByText('Policy dialog').closest('[data-dialog-panel]');
    if (panel === null) throw new Error('Dialog panel is missing');
    fireEvent.click(panel);
    expect(dialog).toHaveAttribute('open');
    fireEvent.click(dialog);
    expect(dialog).not.toHaveAttribute('open');
  });

  it('prevents action navigation on the canvas while preserving safe hrefs', async () => {
    const user = userEvent.setup();
    render(
      <Dialog
        node={node}
        props={dialogSchema.props.parse({
          triggerLabel: 'Open canvas dialog',
          title: 'Canvas dialog',
          primaryAction: { label: 'Visit destination', href: '/destination' },
        })}
        slots={{}}
        data={{}}
        isCanvas={true}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Open canvas dialog' }));
    const link = screen.getByRole('link', { name: 'Visit destination' });
    const dialog = link.closest('dialog');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(link).toHaveAttribute('href', '/destination');
    expect(dialog).not.toHaveAttribute('open');
  });

  it('always renders one close route when authored policies would otherwise trap focus', async () => {
    const user = userEvent.setup();
    render(
      <Dialog
        node={node}
        props={dialogSchema.props.parse({
          triggerLabel: 'Open guarded dialog',
          title: 'Guarded dialog',
          showCloseButton: false,
          closeOnEscape: false,
          closeOnOverlay: false,
          closeOnAction: false,
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Open guarded dialog' }));
    expect(screen.getByRole('button', { name: 'Close dialog' })).toBeInTheDocument();
  });

  it('does not treat a pointer-only backdrop as the keyboard close route', async () => {
    const user = userEvent.setup();
    render(
      <Dialog
        node={node}
        props={dialogSchema.props.parse({
          triggerLabel: 'Open backdrop dialog',
          title: 'Backdrop dialog',
          showCloseButton: false,
          closeOnEscape: false,
          closeOnOverlay: true,
          closeOnAction: false,
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Open backdrop dialog' }));
    const dialog = screen.getByRole('dialog', { name: 'Backdrop dialog' });
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(dialog).not.toHaveAttribute('open');
  });

  it('renders size, tone, trigger variant, and primary-focus intent', async () => {
    const user = userEvent.setup();
    render(
      <Dialog
        node={node}
        props={dialogSchema.props.parse({
          triggerLabel: 'Open styled dialog',
          title: 'Styled dialog',
          primaryAction: { label: 'Primary destination', href: '/primary' },
          size: 'lg',
          tone: 'inverse',
          triggerVariant: 'secondary',
          initialFocus: 'primary',
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Open styled dialog' });
    expect(trigger).toHaveClass('border-accent', 'bg-surface');
    await user.click(trigger);

    expect(screen.getByRole('dialog')).toHaveClass('max-w-content-wide');
    expect(screen.getByText('Styled dialog').closest('[data-dialog-panel]')).toHaveClass(
      'bg-surface-inverse',
      'text-text-inverse',
    );
    expect(screen.getByRole('link', { name: 'Primary destination' })).toHaveFocus();
  });

  it('rejects executable and protocol-relative action destinations', () => {
    expect(
      dialogSchema.props.safeParse({
        primaryAction: { label: 'Unsafe', href: 'javascript:alert(1)' },
      }).success,
    ).toBe(false);
    expect(
      dialogSchema.props.safeParse({
        secondaryAction: { label: 'Unsafe', href: '//example.com' },
      }).success,
    ).toBe(false);
  });

  it('keeps advanced utility and motion controls optional and safe', () => {
    const props = dialogSchema.props.parse({});
    expect(props.motion).toBeUndefined();
    expect(props.className).toBeUndefined();
    expect(dialogSchema.propertyGroups?.motion).toMatchObject({ kind: 'motion' });
    expect(dialogSchema.propertyGroups?.className).toMatchObject({ kind: 'utility-classes' });
    expect(dialogSchema.props.safeParse({ className: 'bg-red-500' }).success).toBe(false);
    expect(dialogSchema.props.safeParse({ className: 'p-[17px]' }).success).toBe(false);
    expect(dialogSchema.props.safeParse({ className: 'grid gap-4' }).success).toBe(true);
  });
});
