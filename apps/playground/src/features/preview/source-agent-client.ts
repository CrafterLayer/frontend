import { z } from 'zod';
import type { SourceAgentMode } from './source-agent-types';

export interface SourceAgentRequest {
  readonly version: 1;
  readonly mode: SourceAgentMode;
  readonly runId: string;
  readonly projectId: string;
  readonly sourceRevision: string;
  readonly designContract: Readonly<Record<string, unknown>>;
  readonly projectIndex: Readonly<Record<string, unknown>>;
  readonly units: readonly {
    readonly unitId: string;
    readonly role: 'context' | 'copy' | 'code' | 'design' | 'visual-review';
    readonly filePaths: readonly string[];
    readonly prompt: string;
    readonly relevantContext: Readonly<Record<string, unknown>>;
  }[];
}

export const sourceAgentOutputSchema = z.object({
  unitId: z.string(), summary: z.string(),
  changes: z.array(z.object({ path: z.string(), language: z.enum(['js', 'jsx', 'ts', 'tsx', 'css', 'json']), source: z.string() })),
  model: z.string(), provider: z.string(), effort: z.string(), attempt: z.number().int().positive(), escalated: z.boolean(),
});
const resultSchema = z.object({
  version: z.literal(1), mode: z.enum(['ask', 'plan', 'auto']), runId: z.string(), projectId: z.string(), sourceRevision: z.string(),
  units: z.array(z.object({ unitId: z.string(), status: z.enum(['completed', 'failed', 'cancelled']), attempts: z.number().int().nonnegative(), output: sourceAgentOutputSchema.optional(), reason: z.string().optional() })),
});
export type SourceAgentOutput = z.infer<typeof sourceAgentOutputSchema>;
export type SourceAgentResult = z.infer<typeof resultSchema>;
export interface SourceAgentClient {
  run(request: SourceAgentRequest, signal: AbortSignal): Promise<SourceAgentResult>;
}

/** Transport boundary validates identity, mode and file ownership before proposals reach a draft. */
export function createSourceAgentClient(endpoint: string, token?: string, fetcher: typeof fetch = fetch): SourceAgentClient {
  const url = new URL(endpoint);
  if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) throw new Error('Agent endpoint requires HTTPS or a local development origin.');
  return {
    run: async (request, signal) => {
      const response = await fetcher(`${endpoint.replace(/\/$/u, '')}/v1/agent/run`, {
        method: 'POST', signal, credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer',
        headers: { 'content-type': 'application/json', ...(token === undefined ? {} : { authorization: `Bearer ${token}` }) },
        body: JSON.stringify(request),
      });
      const reader = response.body?.getReader();
      if (reader === undefined) throw new Error('Agent returned no response.');
      const decoder = new TextDecoder();
      let text = ''; let bytes = 0;
      try {
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > 8 * 1024 * 1024) throw new Error('Agent response exceeds its source budget.');
          text += decoder.decode(chunk.value, { stream: true });
        }
        text += decoder.decode();
      } finally { await reader.cancel(); reader.releaseLock(); }
      if (!response.ok) throw new Error(`Agent request failed (${String(response.status)}).`);
      const payload: unknown = JSON.parse(text);
      const envelope = z.object({ ok: z.literal(true), result: resultSchema }).safeParse(payload);
      const result = envelope.success ? envelope.data.result : resultSchema.parse(payload);
      if (result.runId !== request.runId || result.projectId !== request.projectId || result.sourceRevision !== request.sourceRevision || result.mode !== request.mode) throw new Error('Agent response belongs to a different run or revision.');
      if (result.units.length !== request.units.length || new Set(result.units.map(({ unitId }) => unitId)).size !== result.units.length) throw new Error('Agent returned a different task set.');
      for (const unit of result.units) {
        const expected = request.units.find(({ unitId }) => unitId === unit.unitId);
        if (expected === undefined || (unit.status === 'completed' && unit.output === undefined) || (unit.output !== undefined && unit.output.unitId !== unit.unitId)) throw new Error('Agent returned an invalid task result.');
        const changes = unit.output?.changes ?? [];
        if ((request.mode !== 'auto' && changes.length !== 0) || changes.some(({ path }) => !expected.filePaths.includes(path)) || new Set(changes.map(({ path }) => path)).size !== changes.length) throw new Error('Agent proposed a change outside its captured scope.');
      }
      return result;
    },
  };
}
