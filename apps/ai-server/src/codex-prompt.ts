import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { CODEX_MAX_OUTPUT_BYTES, CodexBackendError } from './codex-config';

export interface CodexParams {
  readonly model?: string;
  readonly max_tokens?: number;
  readonly system?: string | readonly { readonly text: string }[];
  readonly messages?: readonly { readonly role: string; readonly content: unknown }[];
  readonly output_config?: {
    readonly effort?: string;
    readonly format?: { readonly schema?: unknown };
  };
  readonly thinking?: { readonly type?: string };
}

export interface CodexFiles {
  readonly directory: string;
  readonly instructionsPath: string;
  readonly outputPath: string;
  readonly images: readonly string[];
  readonly prompt: string;
  readonly answer: () => string;
  readonly remove: () => void;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Inputs are data, never paths chosen by a remote caller. */
export function prepareCodexFiles(params: CodexParams): CodexFiles {
  const directory = mkdtempSync(join(tmpdir(), 'craftkit-codex-'));
  const images: string[] = [];
  const remove = (): void => {
    rmSync(directory, { recursive: true, force: true });
  };
  let imageBytes = 0;
  const contentText = (content: unknown): string => {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content))
      throw new CodexBackendError('Unsupported Codex message content.', 400, false);
    return content
      .map((block: unknown) => {
        if (isRecord(block) && block['type'] === 'text' && typeof block['text'] === 'string')
          return block['text'];
        if (isRecord(block) && block['type'] === 'image' && isRecord(block['source'])) {
          const source = block['source'];
          const media = source['media_type'];
          const extensions: Record<string, string> = {
            'image/png': 'png',
            'image/jpeg': 'jpg',
            'image/webp': 'webp',
            'image/gif': 'gif',
          };
          if (
            source['type'] === 'base64' &&
            typeof source['data'] === 'string' &&
            typeof media === 'string' &&
            extensions[media] !== undefined
          ) {
            const bytes = Buffer.from(source['data'], 'base64');
            imageBytes += bytes.length;
            if (bytes.length === 0 || images.length >= 4 || imageBytes > 10 * 1024 * 1024)
              throw new CodexBackendError(
                'Codex image input exceeds the local image limit.',
                413,
                false,
              );
            const path = join(directory, `image-${String(images.length)}.${extensions[media]}`);
            writeFileSync(path, bytes, { mode: 0o600 });
            images.push(path);
            return `[Attached image ${String(images.length)}]`;
          }
        }
        throw new CodexBackendError(
          'This input type is not supported by the Codex CLI backend.',
          400,
          false,
        );
      })
      .join('\n');
  };
  try {
    const system =
      typeof params.system === 'string'
        ? params.system
        : (params.system ?? []).map((block) => block.text).join('\n\n');
    const schema = params.output_config?.format?.schema;
    const instructions = [
      system,
      'Answer only the supplied generation request. Do not use tools, read files, run commands or delegate.',
      schema === undefined
        ? ''
        : `Reply with raw JSON only, conforming to this JSON Schema:\n${JSON.stringify(schema)}`,
      params.max_tokens === undefined
        ? ''
        : `Keep the answer within ${String(params.max_tokens)} output tokens.`,
    ]
      .filter(Boolean)
      .join('\n\n');
    const prompt = (params.messages ?? [])
      .map(
        (turn) =>
          `${turn.role === 'assistant' ? 'Assistant' : 'User'}: ${contentText(turn.content)}`,
      )
      .join('\n\n');
    const instructionsPath = join(directory, 'instructions.md');
    const outputPath = join(directory, 'answer.txt');
    writeFileSync(instructionsPath, instructions, { mode: 0o600 });
    return {
      directory,
      instructionsPath,
      outputPath,
      images,
      prompt,
      remove,
      answer: () => {
        try {
          if (statSync(outputPath).size > CODEX_MAX_OUTPUT_BYTES)
            throw new CodexBackendError(
              'Codex output exceeded the local response limit.',
              502,
              false,
            );
          const text = readFileSync(outputPath, 'utf8').trim();
          if (text === '') throw new Error('empty');
          return text;
        } catch (cause) {
          if (cause instanceof CodexBackendError) throw cause;
          throw new CodexBackendError('Codex finished without a final answer. Retry the request.');
        }
      },
    };
  } catch (cause) {
    remove();
    throw cause;
  }
}
