import type { ReactNode, SVGProps } from 'react';

import { ChromeButton } from '../ChromeButton';
import './StatusBar.css';

export type ChangeDoor = 'canvas' | 'code' | 'assistant';

export interface RecentChange {
  readonly id: string;
  readonly door: ChangeDoor;
  readonly label: string;
}

export interface StatusBarTool {
  readonly id: string;
  readonly label: string;
  readonly icon: ReactNode;
}

export interface StatusBarProps {
  tools?: readonly StatusBarTool[] | undefined;
  onToolSelect?: ((id: string) => void) | undefined;
  /** Newest change first. */
  changes?: readonly RecentChange[] | undefined;
  onChangeSelect?: ((id: string) => void) | undefined;
  /** `1` renders as `100%`. */
  zoom?: number | undefined;
  deviceLabel?: string | undefined;
  saveState?: 'saved' | 'saving' | 'error' | undefined;
  label?: string | undefined;
}

const ICON_PROPS = {
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  focusable: 'false',
  'aria-hidden': true,
  className: 'bldr-statusbar__door-icon',
} as const satisfies SVGProps<SVGSVGElement>;

const DOORS = {
  canvas: {
    label: 'Canvas',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M6 2.5H2.5V6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
        <circle cx="8" cy="8" r="1.25" />
      </svg>
    ),
  },
  code: {
    label: 'Code',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="m6 4-4 4 4 4M10 4l4 4-4 4" />
      </svg>
    ),
  },
  assistant: {
    label: 'Assistant',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M8 1.75c.35 3.45 2.05 5.15 5.5 5.5-3.45.35-5.15 2.05-5.5 5.5-.35-3.45-2.05-5.15-5.5-5.5 3.45-.35 5.15-2.05 5.5-5.5Z" />
        <path d="M12.5 2.25v2M11.5 3.25h2" />
      </svg>
    ),
  },
} as const satisfies Readonly<
  Record<ChangeDoor, { readonly label: string; readonly icon: ReactNode }>
>;

/**
 * Whether a change label already says which door it came through. A build
 * labels its sections "Assistant: 3/4 — Menu" and an applied plan "AI: …",
 * and prefixing either again read "Assistant: Assistant: …" / "Assistant: AI: …".
 */
const DOOR_ALIASES: Readonly<Record<ChangeDoor, readonly string[]>> = {
  canvas: ['Canvas'],
  code: ['Code'],
  assistant: ['Assistant', 'AI'],
};

function namesItsDoor(change: RecentChange): boolean {
  return DOOR_ALIASES[change.door].some((alias) => change.label.startsWith(`${alias}:`));
}

const SAVE_LABELS = {
  saved: 'Saved',
  saving: 'Saving',
  error: 'Save failed',
} as const satisfies Readonly<Record<NonNullable<StatusBarProps['saveState']>, string>>;

/** Presentational editor status; the caller owns tools, history, view state, and persistence. */
export function StatusBar({
  tools = [],
  onToolSelect,
  changes = [],
  onChangeSelect,
  zoom,
  deviceLabel,
  saveState,
  label = 'Editor status',
}: StatusBarProps) {
  const zoomLabel = zoom === undefined ? undefined : `${String(Math.round(zoom * 100))}%`;
  const saveLabel = saveState === undefined ? undefined : SAVE_LABELS[saveState];
  const hasInteractiveTools = tools.length > 0 && onToolSelect !== undefined;
  const hasEditorDetails =
    zoomLabel !== undefined || deviceLabel !== undefined || saveLabel !== undefined;

  return (
    <div className="bldr-statusbar" role="region" aria-label={label}>
      <div
        className="bldr-statusbar__start"
        role={hasInteractiveTools ? 'group' : undefined}
        aria-label={hasInteractiveTools ? 'Status bar tools' : undefined}
      >
        {hasInteractiveTools
          ? tools.map((tool) => (
              <ChromeButton
                key={tool.id}
                className="bldr-statusbar__tool"
                size="lg"
                variant="icon"
                aria-label={tool.label}
                onClick={() => {
                  onToolSelect(tool.id);
                }}
              >
                <span className="bldr-statusbar__tool-icon" aria-hidden="true">
                  {tool.icon}
                </span>
              </ChromeButton>
            ))
          : null}
      </div>

      <div className="bldr-statusbar__centre">
        {changes.length === 0 ? (
          <span className="bldr-statusbar__empty" role="status">
            No recent changes
          </span>
        ) : (
          <ol className="bldr-statusbar__changes" aria-label="Recent changes">
            {changes.map((change, index) => {
              const door = DOORS[change.door];
              const isCurrent = index === 0;
              /*
                A label that already names its door ("Assistant: 3/4 — Menu",
                how the build labels its transactions) is not prefixed again —
                the bar read "Assistant: Assistant: 3/4" on every build.
              */
              const accessibleLabel = namesItsDoor(change)
                ? change.label
                : `${door.label}: ${change.label}`;
              const content = (
                <>
                  <span
                    className={`bldr-statusbar__door bldr-statusbar__door--${change.door}`}
                    aria-hidden="true"
                  >
                    {door.icon}
                  </span>
                  <span className="bldr-statusbar__change-label">{accessibleLabel}</span>
                </>
              );

              return (
                <li key={change.id} className="bldr-statusbar__change-item">
                  {onChangeSelect === undefined ? (
                    <span
                      className="bldr-statusbar__change"
                      aria-current={isCurrent ? 'true' : undefined}
                    >
                      {content}
                    </span>
                  ) : (
                    <ChromeButton
                      className="bldr-statusbar__change bldr-statusbar__change--interactive"
                      size="sm"
                      variant="quiet"
                      aria-label={accessibleLabel}
                      aria-current={isCurrent ? 'true' : undefined}
                      onClick={() => {
                        onChangeSelect(change.id);
                      }}
                    >
                      {content}
                    </ChromeButton>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div
        className="bldr-statusbar__end"
        role={hasEditorDetails ? 'group' : undefined}
        aria-label={hasEditorDetails ? 'Editor details' : undefined}
      >
        {zoomLabel === undefined ? null : (
          <span
            className="bldr-statusbar__detail bldr-statusbar__zoom"
            aria-label={`Zoom ${zoomLabel}`}
          >
            {zoomLabel}
          </span>
        )}
        {deviceLabel === undefined ? null : (
          <span className="bldr-statusbar__detail bldr-statusbar__device">{deviceLabel}</span>
        )}
        {saveState === undefined || saveLabel === undefined ? null : (
          <span
            className={`bldr-statusbar__detail bldr-statusbar__save bldr-statusbar__save--${saveState}`}
            role="status"
            aria-label="Save status"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className="bldr-statusbar__save-indicator" aria-hidden="true" />
            <span>{saveLabel}</span>
          </span>
        )}
      </div>
    </div>
  );
}
