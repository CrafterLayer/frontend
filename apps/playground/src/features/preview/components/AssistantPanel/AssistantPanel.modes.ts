/**
 * How eagerly the assistant acts, the way Claude's own modes read.
 *
 * Data, not markup, and in its own module because two things need it: the
 * control that renders the row, and the panel that decides what a run may do.
 * A copy in either would drift the first time a mode is added.
 */
export type AssistantMode = 'ask' | 'auto' | 'plan';

export const MODES: readonly { id: AssistantMode; label: string; hint: string }[] = [
  { id: 'ask', label: 'Ask', hint: 'Propose, then wait for Apply' },
  { id: 'auto', label: 'Auto', hint: 'Apply validated plans immediately' },
  { id: 'plan', label: 'Plan', hint: 'Only plan — never apply' },
];
