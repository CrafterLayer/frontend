import {
  builderError,
  validateTier2Manifest,
  type DeclarativeExtensionManifest,
  type EventBus,
  type KernelApi,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import type { RegistryHandle } from '../registry/registry';

export interface ExtensionManagerHandle {
  /** Register one trusted extension; its dependencies must already be active. */
  register(manifest: TrustedExtensionManifest): void;
  /** Register a batch in topological dependency order; cycles are rejected. */
  registerAll(manifests: TrustedExtensionManifest[]): void;
  /**
   * Validate a raw database row (Law T defense-in-depth) and register its
   * declarative contributions all-or-nothing. Lookups afterwards are
   * indistinguishable from trusted content.
   */
  hydrateDeclarative(raw: unknown): DeclarativeExtensionManifest;
  /** Dispose an extension: run its teardown, remove every contribution. */
  dispose(name: string): boolean;
  has(name: string): boolean;
  /**
   * Monotonic catalog version — increments on every successful registration,
   * hydration, and disposal. Kernel-intrinsic on purpose: view layers read it
   * as a `useSyncExternalStore` snapshot, so a change that fires BEFORE a
   * subscriber attaches is still observed by the post-subscribe snapshot
   * re-check (the event bus alone has no replay).
   */
  version(): number;
}

interface ActiveExtension {
  tier: 1 | 2;
  teardown?: (() => void) | undefined;
}

export function createExtensionManager(
  registry: RegistryHandle,
  events: EventBus,
  context: () => KernelApi,
): ExtensionManagerHandle {
  const active = new Map<string, ActiveExtension>();
  let catalogVersion = 0;

  function register(manifest: TrustedExtensionManifest): void {
    if (active.has(manifest.name)) {
      throw builderError('ext/duplicate', `Extension "${manifest.name}" is already registered.`);
    }
    for (const dependency of manifest.dependencies ?? []) {
      if (!active.has(dependency)) {
        throw builderError(
          'ext/missing-dependency',
          `Extension "${manifest.name}" depends on "${dependency}", which is not registered.`,
          ['dependencies'],
        );
      }
    }
    registry.register(manifest.name, manifest.contributes);
    let teardown: (() => void) | undefined;
    try {
      teardown = manifest.setup?.(context()) ?? undefined;
    } catch (error) {
      // A failing setup must not leave half-registered contributions behind.
      registry.unregister(manifest.name);
      throw error;
    }
    active.set(manifest.name, { tier: 1, teardown });
    catalogVersion += 1;
    events.emit('extension.registered', { name: manifest.name, tier: 1 });
  }

  function registerAll(manifests: TrustedExtensionManifest[]): void {
    const byName = new Map(manifests.map((manifest) => [manifest.name, manifest]));
    const state = new Map<string, 'visiting' | 'done'>();
    const order: TrustedExtensionManifest[] = [];
    const stack: string[] = [];

    const visit = (name: string): void => {
      const manifest = byName.get(name);
      if (manifest === undefined || active.has(name)) {
        return; // already active, or an external dependency checked in register()
      }
      const marker = state.get(name);
      if (marker === 'done') {
        return;
      }
      if (marker === 'visiting') {
        const cycleStart = stack.indexOf(name);
        const cycle = [...stack.slice(cycleStart), name];
        throw builderError(
          'ext/cycle',
          `Extension dependency cycle: ${cycle.join(' -> ')}.`,
          ['dependencies'],
          { cycle },
        );
      }
      state.set(name, 'visiting');
      stack.push(name);
      for (const dependency of manifest.dependencies ?? []) {
        visit(dependency);
      }
      stack.pop();
      state.set(name, 'done');
      order.push(manifest);
    };

    for (const manifest of manifests) {
      visit(manifest.name);
    }
    for (const manifest of order) {
      register(manifest);
    }
  }

  function hydrateDeclarative(raw: unknown): DeclarativeExtensionManifest {
    const result = validateTier2Manifest(raw);
    if (!result.ok) {
      const first = result.errors[0];
      if (first === undefined) {
        throw builderError('ext/tier2-invalid', 'Stored manifest failed validation.');
      }
      throw first;
    }
    const manifest = result.manifest;
    if (active.has(manifest.name)) {
      throw builderError('ext/duplicate', `Extension "${manifest.name}" is already registered.`);
    }
    registry.registerDeclarative(manifest.name, manifest.contributes);
    active.set(manifest.name, { tier: 2 });
    catalogVersion += 1;
    events.emit('extension.registered', { name: manifest.name, tier: 2 });
    return manifest;
  }

  function dispose(name: string): boolean {
    const entry = active.get(name);
    if (entry === undefined) {
      return false;
    }
    entry.teardown?.();
    registry.unregister(name);
    active.delete(name);
    catalogVersion += 1;
    events.emit('extension.disposed', { name });
    return true;
  }

  return {
    register,
    registerAll,
    hydrateDeclarative,
    dispose,
    has: (name) => active.has(name),
    version: () => catalogVersion,
  };
}
