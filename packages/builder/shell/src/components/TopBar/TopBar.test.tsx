import { useState } from 'react';

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TopBar, type TopBarDevice } from './TopBar';

function ControlledDeviceTopBar() {
  const [device, setDevice] = useState<TopBarDevice>('desktop');
  return <TopBar productName="CraftKit" device={device} onDeviceChange={setDevice} />;
}

afterEach(cleanup);

describe('TopBar', () => {
  it('gives the toolbar and every control an accessible name', () => {
    render(<TopBar productName="CraftKit" logo={<span>CK</span>} />);

    const toolbar = screen.getByRole('toolbar', { name: 'Editor toolbar' });
    const namedControls = [
      [within(toolbar).getByRole('radio', { name: 'Desktop' }), 'Desktop'],
      [within(toolbar).getByRole('radio', { name: 'Tablet' }), 'Tablet'],
      [within(toolbar).getByRole('radio', { name: 'Mobile' }), 'Mobile'],
      [within(toolbar).getByRole('button', { name: 'Undo' }), 'Undo'],
      [within(toolbar).getByRole('button', { name: 'Redo' }), 'Redo'],
      [within(toolbar).getByRole('button', { name: 'Preview' }), 'Preview'],
      [within(toolbar).getByRole('button', { name: 'Publish' }), 'Publish'],
      [within(toolbar).getByRole('button', { name: 'Publish options' }), 'Publish options'],
    ] as const;

    for (const [control, name] of namedControls) {
      expect(control).toHaveAccessibleName(name);
    }
    expect(within(toolbar).getByRole('radio', { name: 'Desktop' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(within(toolbar).getAllByRole('radio', { checked: true })).toHaveLength(1);
  });

  it('calls onDeviceChange with the clicked device', async () => {
    const user = userEvent.setup();
    const onDeviceChange = vi.fn();
    render(<TopBar productName="CraftKit" device="desktop" onDeviceChange={onDeviceChange} />);

    await user.click(screen.getByRole('radio', { name: 'Mobile' }));
    expect(onDeviceChange).toHaveBeenCalledTimes(1);
    expect(onDeviceChange).toHaveBeenCalledWith('mobile');
  });

  it('moves focus and the checked selection with radio-group arrow keys', async () => {
    const user = userEvent.setup();
    render(<ControlledDeviceTopBar />);
    const desktop = screen.getByRole('radio', { name: 'Desktop' });
    const tablet = screen.getByRole('radio', { name: 'Tablet' });
    const mobile = screen.getByRole('radio', { name: 'Mobile' });

    desktop.focus();
    expect(desktop).toHaveFocus();
    expect(desktop).toHaveAttribute('aria-checked', 'true');

    await user.keyboard('{ArrowRight}');
    expect(tablet).toHaveFocus();
    expect(tablet).toHaveAttribute('aria-checked', 'true');

    await user.keyboard('{ArrowDown}');
    expect(mobile).toHaveFocus();
    expect(mobile).toHaveAttribute('aria-checked', 'true');

    await user.keyboard('{ArrowRight}');
    expect(desktop).toHaveFocus();
    expect(desktop).toHaveAttribute('aria-checked', 'true');
  });

  it('keeps disabled Undo native-disabled and does not call onUndo', async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();
    render(<TopBar productName="CraftKit" canUndo={false} onUndo={onUndo} />);
    const undo = screen.getByRole('button', { name: 'Undo' });

    expect(undo).toBeDisabled();
    await user.click(undo);
    expect(onUndo).not.toHaveBeenCalled();
  });

  it('dispatches the two split-button halves to their own handlers', async () => {
    const user = userEvent.setup();
    const onPublish = vi.fn();
    const onPublishOptions = vi.fn();
    render(
      <TopBar productName="CraftKit" onPublish={onPublish} onPublishOptions={onPublishOptions} />,
    );

    await user.click(screen.getByRole('button', { name: 'Publish' }));
    expect(onPublish).toHaveBeenCalledTimes(1);
    expect(onPublishOptions).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Publish options' }));
    expect(onPublish).toHaveBeenCalledTimes(1);
    expect(onPublishOptions).toHaveBeenCalledTimes(1);
  });

  it('renders extra before every standard inline-end action', () => {
    render(<TopBar productName="CraftKit" extra={<button type="button">Host control</button>} />);
    const toolbar = screen.getByRole('toolbar', { name: 'Editor toolbar' });
    const hostControl = within(toolbar).getByRole('button', { name: 'Host control' });
    const undo = within(toolbar).getByRole('button', { name: 'Undo' });
    const redo = within(toolbar).getByRole('button', { name: 'Redo' });
    const preview = within(toolbar).getByRole('button', { name: 'Preview' });
    const publish = within(toolbar).getByRole('button', { name: 'Publish' });
    const publishOptions = within(toolbar).getByRole('button', { name: 'Publish options' });

    expect(within(toolbar).getAllByRole('button')).toEqual([
      hostControl,
      undo,
      redo,
      preview,
      publish,
      publishOptions,
    ]);
  });

  it('routes every shell-owned control through the lg ChromeButton scale', () => {
    render(<TopBar productName="CraftKit" />);
    const toolbar = screen.getByRole('toolbar', { name: 'Editor toolbar' });
    const controls = [
      ...within(toolbar).getAllByRole('radio'),
      ...within(toolbar).getAllByRole('button'),
    ];

    expect(controls).toHaveLength(8);
    for (const control of controls) {
      expect(control).toHaveAttribute('data-bldr-chrome-button', '');
      expect(control).toHaveAttribute('data-size', 'lg');
    }
  });

  it('never lets an unwired Publish swallow a click', () => {
    /*
      Measured in the running app before this gate: the app passed no
      `onPublish`, TopBar rendered the button enabled anyway, and the most
      prominent control in the editor did nothing at all when pressed — no
      feedback, no explanation. Mutation that makes this fail: delete the
      `disabled={onPublish === undefined}` prop.
    */
    render(<TopBar productName="CraftKit" />);

    const publish = screen.getByRole('button', { name: 'Publish' });
    expect(publish).toBeDisabled();
    expect(publish).toHaveAttribute('title', 'Publishing is not connected');
    expect(screen.getByRole('button', { name: 'Publish options' })).toBeDisabled();
  });

  it('draws Publish whole, without its split, when the host has no options', () => {
    render(
      <TopBar
        productName="CraftKit"
        onPublish={vi.fn()}
        showPublishOptions={false}
        publishDisabled
        publishTitle="Nothing to publish yet"
      />,
    );
    const publish = screen.getByRole('button', { name: 'Publish' });
    expect(screen.queryByRole('button', { name: 'Publish options' })).toBeNull();
    // Wired but not runnable now: disabled, and its title says why.
    expect(publish).toBeDisabled();
    expect(publish).toHaveAttribute('title', 'Nothing to publish yet');
    expect(publish.parentElement?.children).toHaveLength(1);
  });

  it('enables Publish exactly when a host wires it', async () => {
    const onPublish = vi.fn();
    render(<TopBar productName="CraftKit" onPublish={onPublish} />);

    const publish = screen.getByRole('button', { name: 'Publish' });
    expect(publish).toBeEnabled();
    await userEvent.setup().click(publish);
    expect(onPublish).toHaveBeenCalledTimes(1);
  });
});
