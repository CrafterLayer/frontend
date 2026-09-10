import type { JsonRecord } from '@craftkit/builder-schema';
import type { PreviewArtifact, PreviewBridge } from '../contracts';

export interface PreviewOptions {
  readonly artifact: PreviewArtifact;
  readonly publicData: JsonRecord;
  readonly previewUrl: string;
  readonly expectedOrigin: string;
  readonly bridge: PreviewBridge;
  readonly signal?: AbortSignal;
  readonly heartbeatTimeoutMs?: number;
}

export interface PreviewSession {
  readonly frame: HTMLIFrameElement;
  readonly channel: string;
  focus(astNodeId: string): void;
  dispose(): void;
}
