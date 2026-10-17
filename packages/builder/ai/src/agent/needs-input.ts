import { AiPlanRejectedError } from '../plan/validate-plan';

/*
  media-motion fix pass (2026-10-06): a request that cannot run without
  something only the person has — «حط فيديو تعريفي من يوتيوب» with no link —
  is answered with a question, for 0 tokens, instead of a model that makes
  the missing thing up. It is a refusal (`plan-rejected`: nothing landed, no
  plan exists) that carries the words a host shows as the assistant's answer,
  in the shape of a words-only plan (`rationale`, no commands).
*/
export interface AiNeedsInputWords {
  readonly rationale: string;
  readonly commands: readonly never[];
  readonly followUp?: string;
}

export class AiNeedsInputError extends AiPlanRejectedError {
  readonly words: AiNeedsInputWords;

  constructor(question: string) {
    super([{ code: 'invalid-plan', message: question }]);
    this.words = Object.freeze({ rationale: question, commands: Object.freeze([]) });
  }
}

/** Whether a run ended by asking the person (see `AiNeedsInputError`). */
export function isAiNeedsInputError(cause: unknown): cause is AiNeedsInputError {
  return cause instanceof AiNeedsInputError;
}
