/**
 * A run narrated from what the stream actually carries.
 *
 * Shared by the backends that cannot forward the model's own reasoning — the
 * dev CLI redacts it, and many OpenRouter models never produce any. What such
 * a run does carry is a phase and two measurements, and a measurement that
 * moves is what separates a live run from a panel that has looked identical
 * for four minutes. (`claude.ts` splits this channel on newlines, so every
 * line ends with one.)
 */
export class RunNarrator {
  private phase: 'starting' | 'thinking' | 'writing' = 'starting';
  private thinkingTokens = 0;
  private writtenCharacters = 0;
  private lastLine = '';

  constructor(
    private readonly report: (line: string) => void,
    private readonly startedAt: number,
  ) {}

  enterPhase(phase: 'thinking' | 'writing'): void {
    if (this.phase === phase) return;
    this.phase = phase;
    this.emit();
  }

  addThinking(estimatedTokens: number): void {
    this.thinkingTokens = Math.max(this.thinkingTokens, estimatedTokens);
    if (this.phase === 'starting') this.phase = 'thinking';
  }

  addText(characters: number): void {
    this.writtenCharacters += characters;
    if (this.phase !== 'writing') this.phase = 'writing';
  }

  writtenSoFar(): number {
    return this.writtenCharacters;
  }

  /** Called on a timer too, so silence never reads as a hang. */
  emit(now: number = Date.now()): void {
    const elapsed = formatElapsed(now - this.startedAt);
    /*
      A count is only shown once there is one. The CLI reports
      `estimated_tokens: null` on most deltas and delivers the plan text in a
      few large chunks, so "0 tokens" would be an artefact of the transport
      rather than a fact about the run.
    */
    const line =
      this.phase === 'thinking'
        ? this.thinkingTokens === 0
          ? `Thinking (${elapsed})`
          : `Thinking — about ${formatCount(this.thinkingTokens)} tokens so far (${elapsed})`
        : this.phase === 'writing'
          ? this.writtenCharacters === 0
            ? `Writing the plan (${elapsed})`
            : `Writing the plan — ${formatCount(this.writtenCharacters)} characters so far (${elapsed})`
          : `Waiting for the model to start (${elapsed})`;
    if (line === this.lastLine) return;
    this.lastLine = line;
    this.report(`${line}\n`);
  }
}

/** `mm:ss`, so a four-minute run reads as one. */
export function formatElapsed(ms: number): string {
  const whole = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
}

export function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

/** How often the narrator speaks when nothing else moves it. */
export const NARRATION_INTERVAL_MS = 3_000;
