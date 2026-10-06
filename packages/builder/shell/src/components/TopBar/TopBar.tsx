import { useRef, type KeyboardEvent, type ReactNode, type SVGProps } from 'react';

import { ChromeButton } from '../ChromeButton';
import { TOP_BAR_LABELS_EN, type TopBarLabels } from './TopBar.labels';
import './TopBar.css';

export type TopBarDevice = 'desktop' | 'tablet' | 'mobile';

export interface TopBarProps {
  productName: string;
  logo?: ReactNode | undefined;
  device?: TopBarDevice | undefined;
  onDeviceChange?: ((device: TopBarDevice) => void) | undefined;
  canUndo?: boolean | undefined;
  canRedo?: boolean | undefined;
  onUndo?: (() => void) | undefined;
  onRedo?: (() => void) | undefined;
  onPreview?: (() => void) | undefined;
  onPublish?: (() => void) | undefined;
  onPublishOptions?: (() => void) | undefined;
  /** Free slot before the actions — where a host puts its own controls. */
  extra?: ReactNode | undefined;
  label?: string | undefined;
  /** Every visible string (EN default; the host passes TOP_BAR_LABELS_AR for Arabic). */
  labels?: TopBarLabels | undefined;
  /** The EDITOR direction: arrow keys between devices follow it. */
  dir?: 'ltr' | 'rtl' | undefined;
}

const ICON_PROPS = {
  viewBox: '0 0 16 16',
  width: 16,
  height: 16,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  focusable: 'false',
  'aria-hidden': true,
} as const satisfies SVGProps<SVGSVGElement>;

const DEVICE_OPTIONS = [
  {
    id: 'desktop',
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="1.75" y="2.5" width="12.5" height="8.5" rx="1.25" />
        <path d="M5.25 13.5h5.5M8 11v2.5" />
      </svg>
    ),
  },
  {
    id: 'tablet',
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="3.25" y="1.5" width="9.5" height="13" rx="1.5" />
        <path d="M7.25 12.25h1.5" />
      </svg>
    ),
  },
  {
    id: 'mobile',
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="4.25" y="1.25" width="7.5" height="13.5" rx="1.5" />
        <path d="M7.25 12.5h1.5" />
      </svg>
    ),
  },
] as const satisfies readonly {
  readonly id: TopBarDevice;
  readonly icon: ReactNode;
}[];

const NEXT_DEVICE: Readonly<Record<TopBarDevice, TopBarDevice>> = {
  desktop: 'tablet',
  tablet: 'mobile',
  mobile: 'desktop',
};

const PREVIOUS_DEVICE: Readonly<Record<TopBarDevice, TopBarDevice>> = {
  desktop: 'mobile',
  tablet: 'desktop',
  mobile: 'tablet',
};

/** Presentational editor chrome; the composing host owns every action and selected device. */
export function TopBar({
  productName,
  logo,
  device = 'desktop',
  onDeviceChange,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onPreview,
  onPublish,
  onPublishOptions,
  extra,
  labels = TOP_BAR_LABELS_EN,
  label = labels.toolbar,
  dir = 'ltr',
}: TopBarProps) {
  const deviceButtons = useRef<Record<TopBarDevice, HTMLButtonElement | null>>({
    desktop: null,
    tablet: null,
    mobile: null,
  });

  const handleDeviceKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentDevice: TopBarDevice,
  ) => {
    let nextDevice: TopBarDevice | undefined;
    const forward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const backward = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    if (event.key === forward || event.key === 'ArrowDown') {
      nextDevice = NEXT_DEVICE[currentDevice];
    } else if (event.key === backward || event.key === 'ArrowUp') {
      nextDevice = PREVIOUS_DEVICE[currentDevice];
    } else if (event.key === 'Home') {
      nextDevice = 'desktop';
    } else if (event.key === 'End') {
      nextDevice = 'mobile';
    }

    if (nextDevice === undefined) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    deviceButtons.current[nextDevice]?.focus();
    onDeviceChange?.(nextDevice);
  };

  return (
    <div className="bldr-topbar" role="toolbar" aria-label={label}>
      <div className="bldr-topbar__start">
        {logo !== undefined ? (
          <span className="bldr-topbar__logo" aria-hidden="true">
            {logo}
          </span>
        ) : null}
        <span className="bldr-topbar__product-name">{productName}</span>
      </div>

      <div className="bldr-topbar__devices" role="radiogroup" aria-label={labels.devices}>
        {DEVICE_OPTIONS.map((option) => (
          <ChromeButton
            key={option.id}
            ref={(element) => {
              deviceButtons.current[option.id] = element;
            }}
            className="bldr-topbar__device"
            size="lg"
            variant="icon"
            role="radio"
            aria-label={labels.device[option.id]}
            aria-checked={device === option.id}
            tabIndex={device === option.id ? 0 : -1}
            onKeyDown={(event) => {
              handleDeviceKeyDown(event, option.id);
            }}
            onClick={() => {
              onDeviceChange?.(option.id);
            }}
          >
            {option.icon}
          </ChromeButton>
        ))}
      </div>

      <div className="bldr-topbar__end">
        {extra !== undefined ? <div className="bldr-topbar__extra">{extra}</div> : null}

        <ChromeButton
          className="bldr-topbar__icon-button"
          size="lg"
          variant="icon"
          aria-label={labels.undo}
          disabled={!canUndo}
          onClick={onUndo}
        >
          <svg {...ICON_PROPS}>
            <path d="m6 4-3.5 3.5L6 11" />
            <path d="M3 7.5h5.25A4.75 4.75 0 0 1 13 12.25" />
          </svg>
        </ChromeButton>
        <ChromeButton
          className="bldr-topbar__icon-button"
          size="lg"
          variant="icon"
          aria-label={labels.redo}
          disabled={!canRedo}
          onClick={onRedo}
        >
          <svg {...ICON_PROPS}>
            <path d="m10 4 3.5 3.5L10 11" />
            <path d="M13 7.5H7.75A4.75 4.75 0 0 0 3 12.25" />
          </svg>
        </ChromeButton>

        <span className="bldr-topbar__divider" aria-hidden="true" />

        <ChromeButton
          className="bldr-topbar__preview"
          size="lg"
          variant="quiet"
          onClick={onPreview}
        >
          <svg {...ICON_PROPS}>
            <path d="M1.5 8S3.75 4 8 4s6.5 4 6.5 4-2.25 4-6.5 4S1.5 8 1.5 8Z" />
            <circle cx="8" cy="8" r="1.75" />
          </svg>
          <span>{labels.preview}</span>
        </ChromeButton>

        {/*
          A CTA with no handler is DISABLED, and says why.

          A host that does not pass `onPublish` has no publishing, and this
          button used to render enabled anyway: the most prominent control in
          the editor swallowed every click in silence. Removing it would leave
          the bar unlike the design it was drawn to; pretending would be worse.
          So it keeps its place and tells the truth — `disabled` cannot swallow
          a click, and the reason is on the control rather than in a tooltip
          nobody opens.
        */}
        <div className="bldr-topbar__publish">
          <ChromeButton
            className="bldr-topbar__publish-main"
            size="lg"
            variant="primary"
            disabled={onPublish === undefined}
            title={onPublish === undefined ? labels.publishingOff : undefined}
            onClick={onPublish}
          >
            {labels.publish}
          </ChromeButton>
          <ChromeButton
            className="bldr-topbar__publish-options"
            size="lg"
            tone="primary"
            variant="icon"
            aria-label={labels.publishOptions}
            disabled={onPublishOptions === undefined}
            onClick={onPublishOptions}
          >
            <svg {...ICON_PROPS}>
              <path d="m5 6.5 3 3 3-3" />
            </svg>
          </ChromeButton>
        </div>
      </div>
    </div>
  );
}
