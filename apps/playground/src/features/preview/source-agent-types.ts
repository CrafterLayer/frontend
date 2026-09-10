export type SourceAgentMode = 'ask' | 'plan' | 'auto';

export interface SourceAgentTurn {
  readonly id: string;
  readonly prompt: string;
  readonly pageTitle: string;
  readonly status: 'running' | 'done' | 'stopped' | 'failed';
  readonly summary: string;
  readonly currentTask: string;
  readonly completed: number;
  readonly total: number;
  readonly files: readonly string[];
  readonly details: readonly string[];
  readonly canUndo: boolean;
  readonly canResume: boolean;
}

export interface SourceAgentSnapshot {
  readonly mode: SourceAgentMode;
  readonly draft: string;
  readonly busy: boolean;
  readonly enabled: boolean;
  readonly context: string;
  readonly message: string | undefined;
  readonly turns: readonly SourceAgentTurn[];
  readonly queued: { readonly prompt: string; readonly context: string } | null;
}

export interface SourceAgentPort {
  subscribe(listener: () => void): () => void;
  getSnapshot(): SourceAgentSnapshot;
  setMode(mode: SourceAgentMode): void;
  setDraft(draft: string): void;
  submit(): void | Promise<void>;
  stop(): void | Promise<void>;
  editQueued(prompt: string): void | Promise<void>;
  removeQueued(): void | Promise<void>;
  newConversation(): void;
  reviewChanges(turnId: string): void;
  undo(turnId: string): void;
  resume(turnId: string): void | Promise<void>;
}
