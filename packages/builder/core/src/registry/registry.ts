import {
  builderError,
  type AiContextProvider,
  type CompositionDef,
  type DeclarativeExtensionManifest,
  type DeclarativeWidgetTypeDef,
  type FieldTypeDef,
  type InlineEditorDef,
  type KeymapDef,
  type PanelContribution,
  type ProjectionDef,
  type OverlayToolDef,
  type RegisteredBlock,
  type RegisteredCommand,
  type RegistryRead,
  type Surface,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

type Contributes = NonNullable<TrustedExtensionManifest['contributes']>;
type DeclarativeContributes = NonNullable<DeclarativeExtensionManifest['contributes']>;

interface Owned<T> {
  owner: string;
  item: T;
}

export interface RegistryHandle {
  read: RegistryRead;
  /** Compile a manifest's contributions into the keyed catalogs (O(1) dispatch). */
  register(owner: string, contributes: Contributes | undefined): void;
  /** Tier-2 catalogs: all-or-nothing registration of validated declarative rows. */
  registerDeclarative(owner: string, contributes: DeclarativeContributes | undefined): void;
  /** Remove every contribution a previous registration under `owner` added. */
  unregister(owner: string): void;
}

export function createRegistry(): RegistryHandle {
  const blocks = new Map<string, Owned<RegisteredBlock>>();
  const commands = new Map<string, Owned<RegisteredCommand>>();
  const compositions = new Map<string, Owned<CompositionDef>>();
  const widgetTypes = new Map<string, Owned<DeclarativeWidgetTypeDef>>();
  const canvasTools = new Map<string, Owned<OverlayToolDef>>();
  // Insertion order IS the contract: fieldTypes() ties break by registration position.
  const fieldTypes = new Map<string, Owned<FieldTypeDef>>();
  // Same law: registration order decides, so `inlineEditor(kind)` is the FIRST
  // contribution for that kind — never "whichever extension loaded last".
  const inlineEditors = new Map<string, Owned<InlineEditorDef>>();
  const projections = new Map<string, Owned<ProjectionDef>>();
  const panels = new Map<string, Owned<PanelContribution>>();
  // Provider order is prompt-significant, so the insertion order is public contract.
  const aiContextProviders = new Map<string, Owned<AiContextProvider>>();
  let keymaps: Owned<KeymapDef>[] = [];
  // Remaining contribution kinds are stored opaquely per point until their
  // consumers arrive (panels/fields in B3, projections in B4, …).
  const buckets = new Map<string, Owned<unknown>[]>();

  const read: RegistryRead = {
    block: (type) => blocks.get(type)?.item,
    blocks(surface?: Surface) {
      const all = [...blocks.values()].map((owned) => owned.item);
      if (surface === undefined) {
        return all;
      }
      return all.filter(
        (entry) => entry.schema.surfaces === undefined || entry.schema.surfaces.includes(surface),
      );
    },
    command: (name) => commands.get(name)?.item,
    commandNames: () => [...commands.keys()],
    canvasTools: () =>
      [...canvasTools.values()]
        .map((owned) => owned.item)
        .sort(
          (a, b) =>
            (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
            a.id.localeCompare(b.id),
        ),
    fieldTypes: () => [...fieldTypes.values()].map((owned) => owned.item),
    inlineEditor: (kind) => {
      for (const owned of inlineEditors.values()) {
        if (owned.item.kind === kind) {
          return owned.item;
        }
      }
      return undefined;
    },
    inlineEditors: () => [...inlineEditors.values()].map((owned) => owned.item),
    projection: (id) => projections.get(id)?.item,
    projections: () => [...projections.values()].map((owned) => owned.item),
    panel: (id) => panels.get(id)?.item,
    panels(slot?: PanelContribution['slot']) {
      const all = [...panels.values()].map((owned) => owned.item);
      return slot === undefined ? all : all.filter((entry) => entry.slot === slot);
    },
    aiContextProviders: () => [...aiContextProviders.values()].map((owned) => owned.item),
    keymaps: () => keymaps.map((owned) => owned.item),
    composition: (compositionId) => compositions.get(compositionId)?.item,
    compositions(surface?: Surface) {
      const all = [...compositions.values()].map((owned) => owned.item);
      if (surface === undefined) {
        return all;
      }
      return all.filter(
        (entry) => entry.surfaces === undefined || entry.surfaces.includes(surface),
      );
    },
    widgetType: (type) => widgetTypes.get(type)?.item,
    widgetTypes: () => [...widgetTypes.values()].map((owned) => owned.item),
  };

  return {
    read,
    register(owner, contributes) {
      if (contributes === undefined) {
        return;
      }

      // All-or-nothing: probe every key for clashes BEFORE inserting anything, so
      // a duplicate mid-manifest can never leave orphaned partial contributions.
      for (const contribution of contributes.blocks ?? []) {
        const existing = blocks.get(contribution.schema.type);
        if (existing !== undefined) {
          throw builderError(
            'ext/duplicate',
            `Block type "${contribution.schema.type}" from "${owner}" is already registered by "${existing.owner}".`,
            ['contributes', 'blocks'],
          );
        }
      }
      for (const name of Object.keys(contributes.commands ?? {})) {
        const existing = commands.get(name);
        if (existing !== undefined) {
          throw builderError(
            'ext/duplicate',
            `Command "${name}" from "${owner}" is already registered by "${existing.owner}".`,
            ['contributes', 'commands', name],
          );
        }
      }
      for (const tool of contributes.canvasTools ?? []) {
        const existing = canvasTools.get(tool.id);
        if (existing !== undefined) {
          throw builderError(
            'ext/duplicate',
            `Canvas tool "${tool.id}" from "${owner}" is already registered by "${existing.owner}".`,
            ['contributes', 'canvasTools'],
          );
        }
      }
      for (const field of contributes.fieldTypes ?? []) {
        const existing = fieldTypes.get(field.id);
        if (existing !== undefined) {
          throw builderError(
            'ext/duplicate',
            `Field type "${field.id}" from "${owner}" is already registered by "${existing.owner}".`,
            ['contributes', 'fieldTypes'],
          );
        }
      }
      for (const editor of contributes.inlineEditors ?? []) {
        const existing = inlineEditors.get(editor.id);
        if (existing !== undefined) {
          throw builderError(
            'ext/duplicate',
            `Inline editor "${editor.id}" from "${owner}" is already registered by "${existing.owner}".`,
            ['contributes', 'inlineEditors'],
          );
        }
      }
      for (const projection of contributes.projections ?? []) {
        const existing = projections.get(projection.id);
        if (existing !== undefined) {
          throw builderError(
            'ext/duplicate',
            `Projection "${projection.id}" from "${owner}" is already registered by "${existing.owner}".`,
            ['contributes', 'projections'],
          );
        }
      }
      for (const panel of contributes.panels ?? []) {
        const existing = panels.get(panel.id);
        if (existing !== undefined) {
          throw builderError(
            'ext/duplicate',
            `Panel "${panel.id}" from "${owner}" is already registered by "${existing.owner}".`,
            ['contributes', 'panels'],
          );
        }
      }
      const manifestAiProviderIds = new Set<string>();
      for (const provider of contributes.aiContext ?? []) {
        const existing = aiContextProviders.get(provider.id);
        if (existing !== undefined) {
          throw builderError(
            'ext/duplicate',
            `AI context provider "${provider.id}" from "${owner}" is already registered by "${existing.owner}".`,
            ['contributes', 'aiContext'],
          );
        }
        if (manifestAiProviderIds.has(provider.id)) {
          throw builderError(
            'ext/duplicate',
            `AI context provider "${provider.id}" appears more than once in extension "${owner}".`,
            ['contributes', 'aiContext'],
          );
        }
        manifestAiProviderIds.add(provider.id);
      }

      for (const contribution of contributes.blocks ?? []) {
        blocks.set(contribution.schema.type, {
          owner,
          item: { schema: contribution.schema, render: contribution.render },
        });
      }
      for (const [name, command] of Object.entries(contributes.commands ?? {})) {
        commands.set(name, { owner, item: command });
      }

      for (const tool of contributes.canvasTools ?? []) {
        canvasTools.set(tool.id, { owner, item: tool });
      }
      for (const field of contributes.fieldTypes ?? []) {
        fieldTypes.set(field.id, { owner, item: field });
      }
      for (const editor of contributes.inlineEditors ?? []) {
        inlineEditors.set(editor.id, { owner, item: editor });
      }
      for (const projection of contributes.projections ?? []) {
        projections.set(projection.id, { owner, item: projection });
      }
      for (const panel of contributes.panels ?? []) {
        panels.set(panel.id, { owner, item: panel });
      }
      for (const provider of contributes.aiContext ?? []) {
        aiContextProviders.set(provider.id, { owner, item: provider });
      }
      for (const keymap of contributes.keymaps ?? []) {
        keymaps.push({ owner, item: keymap });
      }

      for (const [point, items] of Object.entries(contributes)) {
        if (
          point === 'blocks' ||
          point === 'commands' ||
          point === 'canvasTools' ||
          point === 'fieldTypes' ||
          point === 'inlineEditors' ||
          point === 'projections' ||
          point === 'panels' ||
          point === 'aiContext' ||
          point === 'keymaps'
        ) {
          continue;
        }
        if (!Array.isArray(items)) {
          continue;
        }
        const bucket = buckets.get(point) ?? [];
        for (const item of items) {
          bucket.push({ owner, item });
        }
        buckets.set(point, bucket);
      }
    },
    registerDeclarative(owner, contributes) {
      if (contributes === undefined) {
        return;
      }
      // All-or-nothing: probe every key for clashes BEFORE inserting anything.
      for (const composition of contributes.compositions ?? []) {
        const existing = compositions.get(composition.id);
        if (existing !== undefined) {
          throw builderError(
            'ext/duplicate',
            `Composition "${composition.id}" from "${owner}" is already registered by "${existing.owner}".`,
            ['contributes', 'compositions'],
          );
        }
      }
      for (const widget of contributes.widgetTypes ?? []) {
        const existing = widgetTypes.get(widget.type);
        if (existing !== undefined) {
          throw builderError(
            'ext/duplicate',
            `Widget type "${widget.type}" from "${owner}" is already registered by "${existing.owner}".`,
            ['contributes', 'widgetTypes'],
          );
        }
      }
      for (const composition of contributes.compositions ?? []) {
        compositions.set(composition.id, { owner, item: composition });
      }
      for (const widget of contributes.widgetTypes ?? []) {
        widgetTypes.set(widget.type, { owner, item: widget });
      }
    },
    unregister(owner) {
      for (const [type, owned] of [...blocks]) {
        if (owned.owner === owner) {
          blocks.delete(type);
        }
      }
      for (const [name, owned] of [...commands]) {
        if (owned.owner === owner) {
          commands.delete(name);
        }
      }
      for (const [compositionId, owned] of [...compositions]) {
        if (owned.owner === owner) {
          compositions.delete(compositionId);
        }
      }
      for (const [type, owned] of [...widgetTypes]) {
        if (owned.owner === owner) {
          widgetTypes.delete(type);
        }
      }
      for (const [toolId, owned] of [...canvasTools]) {
        if (owned.owner === owner) {
          canvasTools.delete(toolId);
        }
      }
      for (const [fieldId, owned] of [...fieldTypes]) {
        if (owned.owner === owner) {
          fieldTypes.delete(fieldId);
        }
      }
      for (const [editorId, owned] of [...inlineEditors]) {
        if (owned.owner === owner) {
          inlineEditors.delete(editorId);
        }
      }
      for (const [projectionId, owned] of [...projections]) {
        if (owned.owner === owner) {
          projections.delete(projectionId);
        }
      }
      for (const [panelId, owned] of [...panels]) {
        if (owned.owner === owner) {
          panels.delete(panelId);
        }
      }
      for (const [providerId, owned] of [...aiContextProviders]) {
        if (owned.owner === owner) {
          aiContextProviders.delete(providerId);
        }
      }
      keymaps = keymaps.filter((owned) => owned.owner !== owner);
      for (const [point, bucket] of buckets) {
        buckets.set(
          point,
          bucket.filter((owned) => owned.owner !== owner),
        );
      }
    },
  };
}
