import { Toaster } from 'sonner';

import { FEEDBACK_LABELS_EN, type FeedbackLabels } from '../../feedback.labels';

import './FeedbackToaster.css';

export interface FeedbackToasterProps {
  readonly labels?: FeedbackLabels | undefined;
  readonly dir?: 'ltr' | 'rtl' | undefined;
}

const ICON = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: 'false',
} as const;

const ICONS = {
  success: (
    <svg {...ICON}>
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  ),
  error: (
    <svg {...ICON}>
      <path d="M8 4.5v4" />
      <path d="M8 11.25v.01" />
      <circle cx="8" cy="8" r="6.25" />
    </svg>
  ),
  info: (
    <svg {...ICON}>
      <path d="M8 7.5v4" />
      <path d="M8 4.75v.01" />
      <circle cx="8" cy="8" r="6.25" />
    </svg>
  ),
  loading: <span className="pg-toast__spinner" aria-hidden="true" />,
} as const;

/**
 * The editor's action feedback (Studio Indigo, 2026-10-12): the outcome of a person's own
 * action — publish first — said once, near the canvas, and gone on its own. Built on
 * sonner (a polite live region, pause on hover and focus, swipe and Escape to dismiss),
 * unstyled, and drawn with the chrome's tokens so it follows the editor's theme and
 * direction. A failure stays longer and carries its way forward (Try again).
 */
export function FeedbackToaster({
  labels = FEEDBACK_LABELS_EN,
  dir = 'ltr',
}: FeedbackToasterProps) {
  return (
    <Toaster
      className="pg-toaster"
      position="bottom-center"
      dir={dir}
      closeButton
      visibleToasts={3}
      containerAriaLabel={labels.region}
      offset={{ bottom: 'calc(var(--bldr-control-lg) + var(--bldr-space-xl))' }}
      mobileOffset={{ bottom: 'calc(var(--bldr-control-lg) + var(--bldr-space-xl))' }}
      icons={ICONS}
      toastOptions={{
        unstyled: true,
        closeButtonAriaLabel: labels.close,
        classNames: {
          toast: 'pg-toast',
          icon: 'pg-toast__icon',
          content: 'pg-toast__content',
          title: 'pg-toast__title',
          description: 'pg-toast__description',
          actionButton: 'pg-toast__action',
          closeButton: 'pg-toast__close',
          success: 'pg-toast--success',
          error: 'pg-toast--error',
          info: 'pg-toast--info',
          loading: 'pg-toast--loading',
        },
      }}
    />
  );
}
