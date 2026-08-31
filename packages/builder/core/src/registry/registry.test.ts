import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  BuilderError,
  type AiContextProvider,
  type RegisteredCommand,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { coreCommands } from '../commands/core-commands';
import { createBuilder } from '../kernel/create-builder';
import { createRegistry } from './registry';

const noopCommand: RegisteredCommand = {
  argsSchema: z.object({}),
  apply: () => () => undefined,
};

function contextProvider(id: string): AiContextProvider {
  return {
    id,
    collect: () => ({ title: id, body: `${id} body` }),
  };
}

describe('registry live read catalogs', () => {
  it('exposes AI context providers by registration order and removes only the disposed owner', () => {
    const registry = createRegistry();
    const structure = contextProvider('structure');
    const selection = contextProvider('selection');
    const brand = contextProvider('brand');

    registry.register('editor', { aiContext: [structure, selection] });
    registry.register('brand-kit', { aiContext: [brand] });

    expect(registry.read.aiContextProviders()).toEqual([structure, selection, brand]);
    expect(registry.read.aiContextProviders()[0]).toBe(structure);

    registry.unregister('editor');
    expect(registry.read.aiContextProviders()).toEqual([brand]);

    registry.register('editor-v2', { aiContext: [structure] });
    expect(registry.read.aiContextProviders()).toEqual([brand, structure]);
  });

  it('rejects duplicate AI provider identities atomically, including duplicates in one manifest', () => {
    const registry = createRegistry();
    const shared = contextProvider('shared');
    registry.register('base', { aiContext: [shared] });

    let crossOwnerError: BuilderError | undefined;
    try {
      registry.register('rival', {
        commands: { 'rival.command': noopCommand },
        aiContext: [contextProvider('rival-only'), contextProvider('shared')],
      });
    } catch (error) {
      crossOwnerError = error as BuilderError;
    }

    expect(crossOwnerError?.code).toBe('ext/duplicate');
    expect(crossOwnerError?.path).toEqual(['contributes', 'aiContext']);
    expect(registry.read.aiContextProviders()).toEqual([shared]);
    expect(registry.read.command('rival.command')).toBeUndefined();

    expect(() => {
      registry.register('self-conflict', {
        aiContext: [contextProvider('repeated'), contextProvider('repeated')],
      });
    }).toThrow(BuilderError);
    expect(registry.read.aiContextProviders()).toEqual([shared]);
  });

  it('lists the complete live command catalog in registration order', () => {
    const extension: TrustedExtensionManifest = {
      tier: 1,
      name: 'workflow',
      version: '1.0.0',
      contributes: {
        commands: {
          'workflow.prepare': noopCommand,
          'workflow.finish': noopCommand,
        },
      },
    };
    const kernel = createBuilder({ extensions: [extension] });

    expect(kernel.context.registry.commandNames()).toEqual([
      ...Object.keys(coreCommands),
      'workflow.prepare',
      'workflow.finish',
    ]);

    expect(kernel.extensions.dispose('workflow')).toBe(true);
    expect(kernel.context.registry.commandNames()).toEqual(Object.keys(coreCommands));
  });
});
