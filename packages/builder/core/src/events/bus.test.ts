import { describe, expect, it } from 'vitest';

import { createEventBus } from './bus';

describe('event bus', () => {
  it('emitting with no listeners is a safe no-op', () => {
    const bus = createEventBus();
    expect(() => {
      bus.emit('extension.disposed', { name: 'x' });
    }).not.toThrow();
  });

  it('unsubscribing stops delivery without affecting other listeners', () => {
    const bus = createEventBus();
    const seen: string[] = [];
    const off = bus.on('extension.disposed', (payload) => {
      seen.push(`a:${payload.name}`);
    });
    bus.on('extension.disposed', (payload) => {
      seen.push(`b:${payload.name}`);
    });

    bus.emit('extension.disposed', { name: 'one' });
    off();
    bus.emit('extension.disposed', { name: 'two' });

    expect(seen).toEqual(['a:one', 'b:one', 'b:two']);
  });

  it('isolates a throwing observer so committed work is not reported as failed', () => {
    const bus = createEventBus();
    const seen: string[] = [];
    bus.on('extension.disposed', () => {
      throw new Error('observer failed');
    });
    bus.on('extension.disposed', ({ name }) => {
      seen.push(name);
    });

    expect(() => {
      bus.emit('extension.disposed', { name: 'safe' });
    }).not.toThrow();
    expect(seen).toEqual(['safe']);
  });
});
