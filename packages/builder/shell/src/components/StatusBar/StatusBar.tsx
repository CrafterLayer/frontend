import type { ReactNode, SVGProps } from 'react';

import { ChromeButton } from '../ChromeButton';
import { STATUS_BAR_LABELS_EN, type StatusBarLabels } from './StatusBar.labels';
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
  /**
   * A host's live activity line, drawn at the inline start after the tools: the agent's
   * status pill while its panel is hidden. The bar places it and knows nothing about it;
   * an empty element (a portal target) costs no space.
   */
  agent?: ReactNode | undefined;
  /**
   * What the strip says when `changes` is empty. Default "No recent changes"; `null` says
   * nothing, for a host whose changes another surface lists (the agent panel's thread), so
   * the bar never claims nothing changed right after the page did.
   */
  emptyLabel?: string | null | undefined;
  /** Every string the bar shows or announces (arabic-editor); English by default. */
  labels?: StatusBarLabels | undefined;
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

const DOOR_ICONS = {
  canvas: {
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M6 2.5H2.5V6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
        <circle cx="8" cy="8" r="1.25" />
      </svg>
    ),
  },
  code: {
    icon: (
      <svg {...ICON_PROPS}>
        <path d="m6 4-4 4 4 4M10 4l4 4-4 4" />
      </svg>
    ),
  },
  assistant: {
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M8 1.75c.35 3.45 2.05 5.15 5.5 5.5-3.45.35-5.15 2.05-5.5 5.5-.35-3.45-2.05-5.15-5.5-5.5 3.45-.35 5.15-2.05 5.5-5.5Z" />
        <path d="M12.5 2.25v2M11.5 3.25h2" />
      </svg>
    ),
  },
} as const satisfies Readonly<Record<ChangeDoor, { readonly icon: ReactNode }>>;

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

/** A label written in either language may already name its door; both spellings count. */
function namesItsDoor(change: RecentChange, labels: StatusBarLabels): boolean {
  return [...DOOR_ALIASES[change.door], labels.doors[change.door]].some((alias) =>
    change.label.startsWith(`${alias}:`),
  );
}

/** Presentational editor status; the caller owns tools, history, view state, and persistence. */
export function StatusBar({
  tools = [],
  onToolSelect,
  changes = [],
  onChangeSelect,
  zoom,
  deviceLabel,
  saveState,
  label,
  agent,
  emptyLabel,
  labels = STATUS_BAR_LABELS_EN,
}: StatusBarProps) {
  // Latin digits in every language: a percentage is a value, not prose.
  const zoomLabel = zoom === undefined ? undefined : `${String(Math.round(zoom * 100))}%`;
  const saveLabel = saveState === undefined ? undefined : labels.save[saveState];
  const regionLabel = label ?? labels.region;
  const emptyText = emptyLabel === undefined ? labels.empty : emptyLabel;
  const hasInteractiveTools = tools.length > 0 && onToolSelect !== undefined;
  const hasEditorDetails =
    zoomLabel !== undefined || deviceLabel !== undefined || saveLabel !== undefined;

  return (
    <div className="bldr-statusbar" role="region" aria-label={regionLabel}>
      <div
        className="bldr-statusbar__start"
        role={hasInteractiveTools ? 'group' : undefined}
        aria-label={hasInteractiveTools ? labels.tools : undefined}
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
        {agent === undefined ? null : <div className="bldr-statusbar__agent">{agent}</div>}
      </div>

      <div className="bldr-statusbar__centre">
        {changes.length === 0 ? (
          emptyText === null ? null : (
            <span className="bldr-statusbar__empty" role="status">
              {emptyText}
            </span>
          )
        ) : (
          <ol className="bldr-statusbar__changes" aria-label={labels.recentChanges}>
            {changes.map((change, index) => {
              const door = DOOR_ICONS[change.door];
              const isCurrent = index === 0;
              /*
                A label that already names its door ("Assistant: 3/4 — Menu",
                how the build labels its transactions) is not prefixed again —
                the bar read "Assistant: Assistant: 3/4" on every build.
              */
              const accessibleLabel = namesItsDoor(change, labels)
                ? change.label
                : `${labels.doors[change.door]}: ${change.label}`;
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
        aria-label={hasEditorDetails ? labels.details : undefined}
      >
        {zoomLabel === undefined ? null : (
          <span
            className="bldr-statusbar__detail bldr-statusbar__zoom"
            aria-label={labels.zoom(zoomLabel)}
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
            aria-label={labels.saveStatus}
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
