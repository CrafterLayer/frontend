import type { ComponentPropsWithRef, ReactNode } from 'react';

import type { CHROME_BUTTON_SIZE_TOKENS, CHROME_BUTTON_VARIANTS } from './constants';
import './ChromeButton.css';

export type ChromeButtonSize = keyof typeof CHROME_BUTTON_SIZE_TOKENS;

export type ChromeButtonVariant = (typeof CHROME_BUTTON_VARIANTS)[number];

type NativeButtonProps = Omit<
  ComponentPropsWithRef<'button'>,
  'aria-label' | 'aria-pressed' | 'children' | 'type'
>;

type ChromeButtonBaseProps = NativeButtonProps & {
  children: ReactNode;
  size?: ChromeButtonSize | undefined;
};

type PrimaryChromeButtonProps = ChromeButtonBaseProps & {
  variant: 'primary';
  'aria-label'?: string | undefined;
  'aria-pressed'?: never;
  tone?: never;
};

type QuietChromeButtonProps = ChromeButtonBaseProps & {
  variant?: 'quiet' | undefined;
  'aria-label'?: string | undefined;
  'aria-pressed'?: never;
  tone?: never;
};

type IconChromeButtonProps = ChromeButtonBaseProps & {
  variant: 'icon';
  /** Required by the type contract: icon-only chrome never relies on a glyph for its name. */
  'aria-label': string;
  'aria-pressed'?: never;
  tone?: 'primary' | 'quiet' | undefined;
};

type ToggleChromeButtonProps = ChromeButtonBaseProps & {
  variant: 'toggle';
  'aria-label'?: string | undefined;
  'aria-pressed': boolean;
  tone?: never;
};

export type ChromeButtonProps =
  | PrimaryChromeButtonProps
  | QuietChromeButtonProps
  | IconChromeButtonProps
  | ToggleChromeButtonProps;

/** The single native button primitive for editor chrome. */
export function ChromeButton({
  children,
  className,
  ref,
  size = 'lg',
  tone = 'quiet',
  variant = 'quiet',
  ...buttonProps
}: ChromeButtonProps) {
  const classes = ['bldr-chrome-button', className].filter(Boolean).join(' ');

  return (
    <button
      {...buttonProps}
      ref={ref}
      type="button"
      className={classes}
      data-bldr-chrome-button=""
      data-size={size}
      data-tone={variant === 'icon' ? tone : undefined}
      data-variant={variant}
    >
      {children}
    </button>
  );
}
