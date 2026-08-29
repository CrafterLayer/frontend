import { createDiagnostic } from '../shared/diagnostics.mjs';

const BUILDER_PATH_PREFIX = 'packages/builder/';
const EXTENSIONS_PATH_PREFIX = 'packages/builder/extensions/';
const BUILDER_PRESET_NAME = '@craftkit/builder';

const DEPENDENCY_SECTIONS = Object.freeze([
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
]);

/**
 * Builder dependency law (ADR 0003): schema(0) ← core(1) ← engines(2) ← shell(3) ←
 * extensions(4) ← editor preset(5). A builder member may depend only on strictly
 * lower builder layers plus the approved tooling packages; extensions never depend
 * on other extensions; non-builder members reach the builder family only through
 * the preset. Every builder member must be placed here deliberately.
 */
const BUILDER_LAYERS = Object.freeze({
  '@craftkit/builder-schema': 0,
  '@craftkit/builder-core': 1,
  '@craftkit/builder-react': 2,
  '@craftkit/builder-renderer': 2,
  '@craftkit/builder-transforms': 2,
  '@craftkit/builder-theme': 2,
  '@craftkit/builder-ai': 2,
  '@craftkit/builder-shell': 3,
  [BUILDER_PRESET_NAME]: 5,
});
const EXTENSION_LAYER = 4;

const TOOLING_DEPENDENCIES = Object.freeze(
  new Set(['@craftkit/eslint-config', '@craftkit/test-config', '@craftkit/typescript-config']),
);

/**
 * Engine containment (008 contract §3 e6): a heavyweight third-party engine is
 * adoptable ONLY inside its designated owner package — any other member,
 * builder or not, declaring it in any dependency section fails with a named
 * violation. This is what keeps "the published path never loads the editor"
 * mechanical rather than disciplinary.
 */
const CONTAINED_DEPENDENCIES = Object.freeze([
  Object.freeze({
    label: 'rich-text editing engine',
    matches: (name) => name.startsWith('@tiptap/') || name.startsWith('prosemirror-'),
    owners: Object.freeze(new Set(['@craftkit/builder-richtext'])),
  }),
]);

/**
 * A contained dependency can be smuggled in two ways beyond its own name: as an
 * npm ALIAS (`"engine": "npm:@tiptap/react@3"`), and through the WORKSPACE ROOT
 * manifest — which is not a member, yet installs into the root `node_modules`
 * every package resolves through. Both are checked (008 §10 review fixes).
 *
 * @param {string} name
 * @param {unknown} spec
 */
function containedRuleFor(name, spec) {
  const aliasTarget = typeof spec === 'string' && spec.startsWith('npm:') ? spec.slice(4) : '';
  return CONTAINED_DEPENDENCIES.find(
    (rule) => rule.matches(name) || (aliasTarget !== '' && rule.matches(aliasTarget)),
  );
}

/**
 * Contained-dependency check for one manifest, member or root.
 *
 * @param {Record<string, unknown>} manifest
 * @param {string} manifestPath
 * @param {string} ownerName
 * @param {import('../shared/diagnostics.mjs').ContractDiagnostic[]} diagnostics
 */
function checkContainedDependencies(manifest, manifestPath, ownerName, diagnostics) {
  for (const section of DEPENDENCY_SECTIONS) {
    const record = manifest[section];
    if (!isPlainObject(record)) {
      continue;
    }
    for (const [dependencyName, spec] of Object.entries(record)) {
      const rule = containedRuleFor(dependencyName, spec);
      if (rule !== undefined && !rule.owners.has(ownerName)) {
        diagnostics.push(
          createDiagnostic({
            code: 'BUILDER_CONTAINED_DEPENDENCY',
            ownerPath: manifestPath,
            dependency: dependencyName,
            message: `${section} declares the contained ${rule.label} dependency "${dependencyName}". Only ${[...rule.owners].join(', ')} may own it; every other surface consumes the stored JSON through the dependency-free read path.`,
          }),
        );
      }
    }
  }
}

/**
 * The workspace ROOT manifest is not a discovered member, but a contained
 * dependency declared there hoists into every package's resolution path.
 *
 * @param {Record<string, unknown> | undefined} rootManifest
 * @param {string} rootManifestPath
 * @param {import('../shared/diagnostics.mjs').ContractDiagnostic[]} diagnostics
 */
export function validateRootContainedDependencies(rootManifest, rootManifestPath, diagnostics) {
  if (!isPlainObject(rootManifest)) {
    return;
  }
  checkContainedDependencies(rootManifest, rootManifestPath, '<workspace root>', diagnostics);
}

/**
 * @param {import('./discover-workspace.mjs').WorkspaceMember} member
 */
function isBuilderMember(member) {
  return member.path.startsWith(BUILDER_PATH_PREFIX);
}

/**
 * @param {import('./discover-workspace.mjs').WorkspaceMember} member
 * @returns {number | undefined}
 */
function builderLayer(member) {
  if (member.name !== undefined && Object.hasOwn(BUILDER_LAYERS, member.name)) {
    return BUILDER_LAYERS[member.name];
  }
  if (member.path.startsWith(EXTENSIONS_PATH_PREFIX)) {
    return EXTENSION_LAYER;
  }
  return undefined;
}

/**
 * Enforce the builder layer law over workspace-internal dependency edges. Non-builder
 * members' other dependencies remain governed exclusively by the general workspace
 * rules in validate-workspace.mjs.
 *
 * @param {import('./discover-workspace.mjs').WorkspaceMember[]} members
 * @param {Map<string, import('./discover-workspace.mjs').WorkspaceMember[]>} membersByName
 * @param {import('../shared/diagnostics.mjs').ContractDiagnostic[]} diagnostics
 */
export function validateBuilderBoundaries(members, membersByName, diagnostics) {
  for (const member of members) {
    checkContainedDependencies(
      member.manifest,
      member.manifestPath,
      member.name ?? '',
      diagnostics,
    );

    const memberIsBuilder = isBuilderMember(member);
    const sourceLayer = memberIsBuilder ? builderLayer(member) : undefined;

    if (memberIsBuilder && sourceLayer === undefined) {
      diagnostics.push(
        createDiagnostic({
          code: 'BUILDER_UNKNOWN_LAYER',
          ownerPath: member.manifestPath,
          message: `Builder member "${member.name ?? member.path}" has no layer assignment. Add it to BUILDER_LAYERS in validate-builder-boundaries.mjs deliberately; unplaced builder packages are a boundary hazard.`,
        }),
      );
    }

    for (const section of DEPENDENCY_SECTIONS) {
      const dependencyRecord = member.manifest[section];
      if (!isPlainObject(dependencyRecord)) {
        continue;
      }

      for (const dependencyName of Object.keys(dependencyRecord)) {
        const owners = membersByName.get(dependencyName) ?? [];
        if (owners.length !== 1) {
          // External dependencies and duplicate-name identity failures are handled by
          // catalog policy and validate-workspace respectively.
          continue;
        }
        const target = owners[0];
        const targetIsBuilder = isBuilderMember(target);

        if (!memberIsBuilder) {
          if (targetIsBuilder && dependencyName !== BUILDER_PRESET_NAME) {
            diagnostics.push(
              createDiagnostic({
                code: 'BUILDER_FAMILY_ACCESS',
                ownerPath: member.manifestPath,
                dependency: dependencyName,
                message: `${section} reaches into the builder family via "${dependencyName}". Non-builder members may depend only on "${BUILDER_PRESET_NAME}".`,
              }),
            );
          }
          continue;
        }

        if (!targetIsBuilder) {
          if (!TOOLING_DEPENDENCIES.has(dependencyName)) {
            diagnostics.push(
              createDiagnostic({
                code: 'BUILDER_FOREIGN_DEPENDENCY',
                ownerPath: member.manifestPath,
                dependency: dependencyName,
                message: `${section} depends on workspace member "${dependencyName}", which is outside the builder family and the approved tooling set. Keep the kernel self-contained or amend the law deliberately.`,
              }),
            );
          }
          continue;
        }

        const targetLayer = builderLayer(target);
        if (sourceLayer === undefined || targetLayer === undefined) {
          // The unplaced member already produced BUILDER_UNKNOWN_LAYER above.
          continue;
        }

        if (sourceLayer === EXTENSION_LAYER && targetLayer === EXTENSION_LAYER) {
          diagnostics.push(
            createDiagnostic({
              code: 'BUILDER_EXTENSION_COUPLING',
              ownerPath: member.manifestPath,
              dependency: dependencyName,
              message: `${section} couples extension "${member.name ?? member.path}" to extension "${dependencyName}". Extensions communicate only through the command bus and events, never by importing each other.`,
            }),
          );
          continue;
        }

        if (targetLayer >= sourceLayer) {
          diagnostics.push(
            createDiagnostic({
              code: 'BUILDER_LAYER_VIOLATION',
              ownerPath: member.manifestPath,
              dependency: dependencyName,
              message: `${section} depends upward or sideways: "${member.name ?? member.path}" (layer ${String(sourceLayer)}) → "${dependencyName}" (layer ${String(targetLayer)}). Builder members depend only on strictly lower layers.`,
            }),
          );
        }
      }
    }
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
