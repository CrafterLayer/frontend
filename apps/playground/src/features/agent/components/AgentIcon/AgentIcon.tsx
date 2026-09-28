import './AgentIcon.css';
import { ICONS, type AgentIconName } from './icon-paths';

export interface AgentIconProps {
  readonly name: AgentIconName;
  /** Appended to `ck-agent-icon`. */
  readonly className?: string | undefined;
}

/**
 * One glyph of the agent panel (SPEC §4.21): 16px, 1.5px stroke, `currentColor`, always
 * `aria-hidden`. The button or line it sits in owns the accessible name; a glyph never
 * speaks.
 *
 * The shapes are static JSX from `icon-paths.tsx`, so they are the same DOM nodes for the
 * life of the icon, however often its button re-renders (see that file for the first-click
 * bug this replaces). Directional glyphs carry `data-mirror` and flip under `:dir(rtl)`.
 */
export function AgentIcon({ name, className }: AgentIconProps) {
  const icon = ICONS[name];
  return (
    <svg
      className={className === undefined ? 'ck-agent-icon' : `ck-agent-icon ${className}`}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-icon={name}
      data-mirror={icon.mirror ? '' : undefined}
    >
      {icon.shapes}
    </svg>
  );
}
