import type { ComponentPropsWithRef, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export type ButtonSize = 'small' | 'medium' | 'large';

export interface ButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'children'> {
  children: ReactNode;
  fullWidth?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
}

export function Button({
  'aria-busy': ariaBusy,
  'aria-label': ariaLabel,
  children,
  className,
  disabled = false,
  fullWidth = false,
  loading = false,
  loadingLabel = 'Loading',
  ref,
  size = 'medium',
  type = 'button',
  variant = 'primary',
  ...buttonProps
}: ButtonProps) {
  const classes = ['craftkit-button', className].filter(Boolean).join(' ');

  return (
    <button
      {...buttonProps}
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-label={loading ? loadingLabel : ariaLabel}
      aria-busy={loading ? true : ariaBusy}
      data-full-width={fullWidth || undefined}
      data-loading={loading || undefined}
      data-size={size}
      data-variant={variant}
    >
      <span className="craftkit-button__content">{children}</span>
      {loading ? (
        <span className="craftkit-button__loading" role="status" aria-label={loadingLabel}>
          <span className="craftkit-button__spinner" aria-hidden="true" />
          <span className="craftkit-visually-hidden">{loadingLabel}</span>
        </span>
      ) : null}
    </button>
  );
}
