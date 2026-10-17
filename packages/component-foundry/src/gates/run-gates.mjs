import { spawn } from 'node:child_process';

import { GATE_PROFILE, KNOWN_BLIND_SPOTS } from './gate-profile.mjs';

/**
 * Run the promotion gates and return a verdict with its evidence.
 *
 * ## The rule this module exists to enforce
 *
 * A gate that was not RUN is not a gate. Every verdict below carries the exit
 * code and the tail of the real output that produced it, because the failure
 * this project has already seen twice is an agent reporting success for
 * commands that never executed.
 *
 * ## Why the caller supplies the workspace
 *
 * Gates must run where the candidate will actually live — same lockfile, same
 * tsconfig, same eslint config, same registry. Running them anywhere else
 * answers a question nobody asked. The caller prepares that workspace (a git
 * worktree with dependencies installed) and passes its path; this module does
 * not create one, so it cannot quietly run against the wrong tree.
 */

/** How long any single gate may run before it is treated as a failure. */
const DEFAULT_GATE_TIMEOUT_MS = 900_000;

/**
 * The environment every gate runs under.
 *
 * Two entries are load-bearing rather than cosmetic:
 *
 * - `PATH` is set explicitly because `head` on this machine resolves to an
 *   HTML tool and coreutils must win; a gate that fails on `Unknown option: 4`
 *   would look like a real failure.
 * - `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false` because pnpm otherwise attempts
 *   an install the sandbox forbids, and the gate fails for a reason that has
 *   nothing to do with the candidate.
 */
function gateEnvironment(nodeBinDirectory) {
  const path = ['/usr/bin', '/bin', nodeBinDirectory, process.env['PATH'] ?? '']
    .filter((entry) => entry !== '')
    .join(':');

  return {
    ...process.env,
    PATH: path,
    PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN: 'false',
    CI: '1',
  };
}

/** Keep the tail; a passing gate needs none of it and a failing one needs the end. */
function tail(text, lines = 40) {
  const all = text.split('\n');
  return all.length <= lines ? text : all.slice(-lines).join('\n');
}

/**
 * Run one command and capture what it actually did.
 *
 * The exit code comes from the CHILD, never from a shell wrapper. Reading a
 * wrapper's status instead of the command's is a mistake this project has made
 * and written down: `pnpm verify > log; echo $?` reports the echo's status.
 */
function runOne(gate, cwd, environment, timeoutMs) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const [command, ...args] = gate.argv;
    const child = spawn(command, args, { cwd, env: environment });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({
        id: gate.id,
        ran: false,
        passed: false,
        exitCode: null,
        durationMs: Date.now() - startedAt,
        meaning: gate.meaning,
        /*
          A gate that could not START is reported as NOT RUN rather than as a
          failure. The distinction matters: a missing binary is an environment
          problem, and reporting it as "the candidate failed lint" sends the
          reader after the wrong thing.
        */
        evidence: `Gate could not start: ${error.message}`,
      });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      const output = `${stdout}${stderr}`;
      resolve({
        id: gate.id,
        ran: !timedOut,
        passed: !timedOut && code === 0,
        exitCode: code,
        durationMs: Date.now() - startedAt,
        meaning: gate.meaning,
        evidence: timedOut
          ? `Gate exceeded ${String(timeoutMs)}ms and was killed. A gate that cannot finish has not passed.`
          : tail(output),
      });
    });
  });
}

/**
 * Run every gate in the profile, in order, against a prepared workspace.
 *
 * Gates run SEQUENTIALLY on purpose. Several of this workspace's tests assert
 * wall-clock behaviour — one is literally named "scales linearly" — and under
 * parallel load they fail for reasons that have nothing to do with the code
 * being judged. A promotion decision made on a contention flake is a promotion
 * decision made at random. Measured here: the same suite failed twice with two
 * different tests under load and passed 24/24 serially.
 *
 * @param {{ workspace: string, nodeBinDirectory: string, gates?: readonly object[], timeoutMs?: number, onGateStart?: (id: string) => void }} options
 */
export async function runPromotionGates(options) {
  const {
    workspace,
    nodeBinDirectory,
    gates = GATE_PROFILE,
    timeoutMs = DEFAULT_GATE_TIMEOUT_MS,
    onGateStart,
  } = options;

  if (typeof workspace !== 'string' || workspace === '') {
    throw new Error('runPromotionGates needs the path of a prepared workspace.');
  }

  const environment = gateEnvironment(nodeBinDirectory);
  const results = [];

  for (const gate of gates) {
    onGateStart?.(gate.id);
    const result = await runOne(gate, workspace, environment, timeoutMs);
    results.push(result);

    /*
      Stop at the first blocking failure.

      Not to save time — to keep the report honest. Running lint after
      typecheck already failed produces a cascade of consequences that read
      like additional independent problems, and the person reading the report
      then cannot tell which one is the cause.
    */
    if (gate.blocking && !result.passed) {
      break;
    }
  }

  const failed = results.filter((result) => !result.passed);
  const notRun = gates.length - results.length;

  return {
    /*
      Promotion requires every gate to have RUN and PASSED. "No failures" is
      not the same as "all passed" — a profile that never executed has no
      failures either, which is exactly how unchecked code gets promoted.
    */
    promotable: failed.length === 0 && results.length === gates.length,
    results,
    failed,
    skippedAfterFailure: notRun,
    /*
      Carried in the verdict rather than left in a document nobody opens. A
      promotion report that shows green without stating what green cannot see
      is claiming a guarantee this profile does not provide.
    */
    blindSpots: KNOWN_BLIND_SPOTS,
  };
}

export { GATE_PROFILE, KNOWN_BLIND_SPOTS };
