import { describe, expect, it, vi } from 'vitest';

import {
  createRuntimeWorkerSupervisor,
  type RuntimeWorkerPort,
  type RuntimeWorkerResult,
} from './runtime-workers';

class FakeWorker implements RuntimeWorkerPort {
  messages: unknown[] = [];
  terminated = false;
  disposed = false;
  messageListener: (message: unknown) => void = () => undefined;
  errorListener: (error: Error) => void = () => undefined;
  exitListener: (code: number | null, signal: NodeJS.Signals | null) => void = () => undefined;

  send(message: unknown): void {
    this.messages.push(message);
  }
  onMessage(listener: (message: unknown) => void): void {
    this.messageListener = listener;
  }
  onError(listener: (error: Error) => void): void {
    this.errorListener = listener;
  }
  onExit(listener: (code: number | null, signal: NodeJS.Signals | null) => void): void {
    this.exitListener = listener;
  }
  terminate(): void {
    this.terminated = true;
  }
  dispose(): void {
    this.disposed = true;
  }
}

const snapshot = {
  projectId: 'project',
  pageId: 'home',
  address: '/',
  entry: 'pages/home.tsx',
  project: {
    formatVersion: 1 as const,
    runtimeProfile: 'craftkit-react-v1' as const,
    dependencyLock: { catalogVersion: 'v1', packages: {} },
    revision: 'r1',
    files: {},
  },
  inputs: {},
};

describe('runtime worker supervisor', () => {
  it('resolves the matching task and ignores forged or late messages', async () => {
    const worker = new FakeWorker();
    const supervisor = createRuntimeWorkerSupervisor({ spawn: () => worker, nowId: () => 'task' });
    const pending = supervisor.run({ kind: 'compile', snapshot });
    const result = {
      kind: 'compile',
      artifact: {} as never,
      sourceElements: [],
      cacheHit: false,
    } satisfies RuntimeWorkerResult;
    worker.messageListener({ type: 'result', taskId: 'forged', result });
    worker.messageListener({ type: 'result', taskId: 'task', result });
    await expect(pending).resolves.toBe(result);
    expect(worker.disposed).toBe(true);
    worker.messageListener({ type: 'error', taskId: 'task', message: 'late' });
  });

  it('propagates cancellation, terminates owned work, and rejects late success', async () => {
    const worker = new FakeWorker();
    const controller = new AbortController();
    const supervisor = createRuntimeWorkerSupervisor({ spawn: () => worker, nowId: () => 'task' });
    const pending = supervisor.run({ kind: 'compile', snapshot }, controller.signal);
    controller.abort(new Error('Stop and revise'));

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(worker.messages).toContainEqual({ type: 'cancel', taskId: 'task' });
    expect(worker.terminated).toBe(true);
    worker.messageListener({ type: 'result', taskId: 'task', result: {} });
  });

  it('terminates a timed-out worker and cleans its listeners', async () => {
    vi.useFakeTimers();
    const worker = new FakeWorker();
    const supervisor = createRuntimeWorkerSupervisor({
      spawn: () => worker,
      nowId: () => 'task',
      compileTimeoutMs: 5,
    });
    const pending = supervisor.run({ kind: 'compile', snapshot });
    const assertion = expect(pending).rejects.toThrow('exceeded 5ms');
    await vi.advanceTimersByTimeAsync(6);

    await assertion;
    expect(worker.terminated).toBe(true);
    expect(worker.disposed).toBe(true);
    vi.useRealTimers();
  });

  it('fails when worker output exceeds the configured limit', async () => {
    const worker = new FakeWorker();
    const supervisor = createRuntimeWorkerSupervisor({
      spawn: () => worker,
      nowId: () => 'task',
      maxOutputBytes: 20,
    });
    const pending = supervisor.run({ kind: 'compile', snapshot });
    worker.messageListener({
      type: 'result',
      taskId: 'task',
      result: { kind: 'prerender', result: { html: 'x'.repeat(100), hasPrimaryContent: true } },
    });

    await expect(pending).rejects.toThrow('output exceeded');
    expect(worker.terminated).toBe(true);
  });
});
