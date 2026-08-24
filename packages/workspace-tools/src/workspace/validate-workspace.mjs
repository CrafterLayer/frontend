import path from 'node:path';

import { createDiagnostic, compareDiagnostics } from '../shared/diagnostics.mjs';
import { isPathInside } from '../shared/paths.mjs';
import { discoverWorkspace } from './discover-workspace.mjs';

const DEPENDENCY_SECTIONS = Object.freeze([
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
]);

/**
 * Validate repository member identities, privacy, internal ranges, dependency direction,
 * package exports, and cycles without mutating any manifest.
 *
 * @param {string} repositoryRoot
 */
export async function validateWorkspace(repositoryRoot) {
  const discovery = await discoverWorkspace(repositoryRoot);
  const diagnostics = [...discovery.diagnostics];
  const membersByName = indexMembersByName(discovery.members);

  validateIdentities(discovery.members, membersByName, diagnostics);
  validatePrivacy(discovery.members, diagnostics);
  validatePackageExports(discovery.members, diagnostics);

  const graph = validateDependencies(discovery.members, membersByName, diagnostics);
  validateCycles(graph, membersByName, diagnostics);

  diagnostics.sort(compareDiagnostics);

  return {
    repositoryRoot: discovery.repositoryRoot,
    members: discovery.members,
    diagnostics,
    valid: diagnostics.length === 0,
  };
}

function indexMembersByName(members) {
  const membersByName = new Map();
  for (const member of members) {
    if (member.name === undefined) {
      continue;
    }
    const owners = membersByName.get(member.name) ?? [];
    owners.push(member);
    membersByName.set(member.name, owners);
  }
  return membersByName;
}

function validateIdentities(members, membersByName, diagnostics) {
  for (const member of members) {
    if (member.name === undefined) {
      diagnostics.push(
        createDiagnostic({
          code: 'MISSING_MEMBER_NAME',
          ownerPath: member.manifestPath,
          message:
            'Declare a non-empty package.json name so pnpm and Turbo can identify this member.',
        }),
      );
    }
  }

  for (const [name, owners] of membersByName) {
    if (owners.length < 2) {
      continue;
    }
    const ownerPaths = owners.map((owner) => owner.manifestPath).sort();
    diagnostics.push(
      createDiagnostic({
        code: 'DUPLICATE_MEMBER_NAME',
        ownerPath: ownerPaths[0],
        message: `Workspace name "${name}" is also declared by ${ownerPaths.slice(1).join(', ')}. Give every direct member a unique name.`,
      }),
    );
  }
}

function validatePrivacy(members, diagnostics) {
  for (const member of members) {
    if (member.manifest.private === true) {
      continue;
    }
    diagnostics.push(
      createDiagnostic({
        code: 'MEMBER_NOT_PRIVATE',
        ownerPath: member.manifestPath,
        message: `${member.kind === 'app' ? 'Applications' : 'Foundation packages'} must declare "private": true until a publishing plan is approved.`,
      }),
    );
  }
}

function validateDependencies(members, membersByName, diagnostics) {
  const uniqueMembersByName = new Map(
    [...membersByName.entries()]
      .filter(([, owners]) => owners.length === 1)
      .map(([name, owners]) => [name, owners[0]]),
  );
  const graph = new Map([...uniqueMembersByName.keys()].map((name) => [name, new Set()]));

  for (const member of members) {
    if (member.name === undefined || !uniqueMembersByName.has(member.name)) {
      continue;
    }

    for (const section of DEPENDENCY_SECTIONS) {
      const dependencyRecord = member.manifest[section];
      if (!isPlainObject(dependencyRecord)) {
        continue;
      }

      for (const [dependencyName, declaredRange] of Object.entries(dependencyRecord)) {
        const range = typeof declaredRange === 'string' ? declaredRange : String(declaredRange);
        const targetOwners = membersByName.get(dependencyName) ?? [];
        const target = uniqueMembersByName.get(dependencyName);
        const usesWorkspaceProtocol = range.startsWith('workspace:');

        if (usesWorkspaceProtocol && targetOwners.length === 0) {
          diagnostics.push(
            createDiagnostic({
              code: 'MISSING_WORKSPACE_TARGET',
              ownerPath: member.manifestPath,
              dependency: dependencyName,
              message: `${section} declares "${dependencyName}": "${range}", but no direct apps/* or packages/* member has that name.`,
            }),
          );
          continue;
        }

        // Duplicate targets are already an identity failure. Avoid misreporting them as
        // missing or guessing which owner determines dependency direction.
        if (target === undefined) {
          continue;
        }

        graph.get(member.name)?.add(dependencyName);

        if (range !== 'workspace:*') {
          diagnostics.push(
            createDiagnostic({
              code: 'INVALID_WORKSPACE_RANGE',
              ownerPath: member.manifestPath,
              dependency: dependencyName,
              message: `${section} references internal member "${dependencyName}" with "${range}"; use exactly "workspace:*".`,
            }),
          );
        }

        if (member.kind === 'app' && target.kind === 'app') {
          diagnostics.push(
            createDiagnostic({
              code: 'APP_TO_APP_DEPENDENCY',
              ownerPath: member.manifestPath,
              dependency: dependencyName,
              message: `Application "${member.name}" must not depend on application "${dependencyName}"; move an intentional reusable contract into a package.`,
            }),
          );
        }

        if (member.kind === 'package' && target.kind === 'app') {
          diagnostics.push(
            createDiagnostic({
              code: 'PACKAGE_TO_APP_DEPENDENCY',
              ownerPath: member.manifestPath,
              dependency: dependencyName,
              message: `Package "${member.name}" must not depend on application "${dependencyName}"; packages must remain reusable below applications.`,
            }),
          );
        }
      }
    }
  }

  return graph;
}

function validatePackageExports(members, diagnostics) {
  for (const member of members) {
    if (member.kind !== 'package') {
      continue;
    }

    if (!Object.hasOwn(member.manifest, 'exports')) {
      diagnostics.push(
        createDiagnostic({
          code: 'MISSING_PACKAGE_EXPORTS',
          ownerPath: member.manifestPath,
          message:
            'Declare package.json exports so consumers use intentional public entrypoints instead of source deep imports.',
        }),
      );
      continue;
    }

    const exportResult = inspectExports(member.manifest.exports, member.absolutePath);
    if (exportResult.targetCount === 0) {
      diagnostics.push(
        createDiagnostic({
          code: 'MISSING_PACKAGE_EXPORT_TARGET',
          ownerPath: member.manifestPath,
          message: 'The exports contract must expose at least one repository-local file target.',
        }),
      );
    }

    for (const problem of exportResult.problems) {
      diagnostics.push(
        createDiagnostic({
          code: problem.code,
          ownerPath: member.manifestPath,
          message: problem.message,
        }),
      );
    }
  }
}

function inspectExports(exportsValue, memberPath) {
  const problems = [];
  let targetCount = 0;

  if (isPlainObject(exportsValue)) {
    const keys = Object.keys(exportsValue);
    const subpathKeys = keys.filter((key) => key.startsWith('.'));
    const conditionKeys = keys.filter((key) => !key.startsWith('.'));

    if (subpathKeys.length > 0 && conditionKeys.length > 0) {
      problems.push({
        code: 'INVALID_PACKAGE_EXPORTS',
        message:
          'The top-level exports map mixes subpath keys with condition keys; use one valid Node exports shape.',
      });
    }

    for (const key of subpathKeys) {
      if (key !== '.' && (!key.startsWith('./') || hasParentSegment(key))) {
        problems.push({
          code: 'UNSAFE_PACKAGE_EXPORT_KEY',
          message: `Export key "${key}" is not a safe package subpath. Use "." or a "./subpath" key without parent traversal.`,
        });
      }
    }
  }

  visit(exportsValue, 'exports');
  return { problems, targetCount };

  function visit(value, location) {
    if (typeof value === 'string') {
      targetCount += 1;
      if (!value.startsWith('./')) {
        problems.push({
          code: 'UNSAFE_PACKAGE_EXPORT_TARGET',
          message: `${location} target "${value}" must start with "./" and stay inside the package.`,
        });
        return;
      }

      const resolvedTarget = path.resolve(memberPath, value);
      if (!isPathInside(memberPath, resolvedTarget)) {
        problems.push({
          code: 'UNSAFE_PACKAGE_EXPORT_TARGET',
          message: `${location} target "${value}" escapes the package directory. Point it at a file owned by this member.`,
        });
      }
      return;
    }

    if (value === null) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${location}[${index}]`));
      return;
    }

    if (isPlainObject(value)) {
      for (const [key, nestedValue] of Object.entries(value)) {
        visit(nestedValue, `${location}.${key}`);
      }
      return;
    }

    problems.push({
      code: 'INVALID_PACKAGE_EXPORTS',
      message: `${location} contains unsupported ${typeof value} data; use string targets, conditions, arrays, or null blocks.`,
    });
  }
}

function validateCycles(graph, membersByName, diagnostics) {
  const state = new Map();
  const stack = [];
  const reportedCycles = new Set();

  for (const memberName of [...graph.keys()].sort()) {
    if (state.get(memberName) === undefined) {
      visit(memberName);
    }
  }

  function visit(memberName) {
    state.set(memberName, 'visiting');
    stack.push(memberName);

    const dependencies = [...(graph.get(memberName) ?? [])].sort();
    for (const dependencyName of dependencies) {
      const dependencyState = state.get(dependencyName);
      if (dependencyState === undefined) {
        visit(dependencyName);
      } else if (dependencyState === 'visiting') {
        const cycleStart = stack.indexOf(dependencyName);
        const cycle = [...stack.slice(cycleStart), dependencyName];
        const cycleKey = canonicalCycleKey(cycle.slice(0, -1));
        if (reportedCycles.has(cycleKey)) {
          continue;
        }
        reportedCycles.add(cycleKey);
        const owner = membersByName.get(cycle[0])?.[0];
        diagnostics.push(
          createDiagnostic({
            code: 'WORKSPACE_DEPENDENCY_CYCLE',
            ownerPath: owner?.manifestPath ?? '.',
            dependency: dependencyName,
            message: `Internal dependency cycle detected: ${cycle.join(' -> ')}. Remove an edge or extract a lower-level contract.`,
          }),
        );
      }
    }

    stack.pop();
    state.set(memberName, 'visited');
  }
}

function canonicalCycleKey(cycle) {
  if (cycle.length === 0) {
    return '';
  }
  const rotations = cycle.map((_, index) =>
    [...cycle.slice(index), ...cycle.slice(0, index)].join('\u0000'),
  );
  return rotations.sort()[0];
}

function hasParentSegment(value) {
  return value.split('/').includes('..');
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
