import { readPromptSkillSnapshot, type PromptSkillSnapshot } from './prompt-skills';

/** The page or named blocks a request was sent about, with their labels at that time. */
export type SentContext =
  | { readonly kind: 'page' }
  | { readonly kind: 'selection' | 'mention'; readonly id: string; readonly label: string };

/** The person's own turn (SPEC §4.5); optional metadata preserves a Retry's choices. */
export interface UserTurn {
  readonly id: string;
  readonly kind: 'user';
  readonly text: string;
  readonly context: readonly SentContext[];
  readonly skillSnapshot?: PromptSkillSnapshot | undefined;
  /** Its run was stopped before any output (SPEC §4.5 `message.notRun`). */
  readonly notRun?: true | undefined;
}

/** Older turns remain valid; optional request metadata never supplies instructions. */
export function reviveUserTurn(turn: UserTurn): UserTurn {
  if (turn.skillSnapshot === undefined) return turn;
  const skillSnapshot = readPromptSkillSnapshot(turn.skillSnapshot);
  const { skillSnapshot: _stored, ...rest } = turn;
  void _stored;
  return skillSnapshot === undefined ? rest : { ...rest, skillSnapshot };
}
