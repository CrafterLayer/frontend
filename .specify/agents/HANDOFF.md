# Active Work Handoff

**Status:** paused — the observable Claude-to-Codex bridge is implemented and verified, but Spec Kit
regeneration for the inactive Claude and Cursor integrations awaits one explicit user choice. B3c
implementation remains in the working tree; its evidence, dual review, convergence, final handoff,
and commit proposal tasks remain open.

**Updated:** 2026-08-27

**Scope:** `specs/workspace/009-builder-b3c-inline-editing` plus workspace agent governance under
`.specify/agents/`.

**Active Spec:** `specs/workspace/009-builder-b3c-inline-editing`.

## Objective

Finish B3c inline editing and floating toolbars without weakening its transaction, rendering,
accessibility, or containment laws. Codex is now the project default and remains self-contained for
Codex-initiated work; Claude remains an optional coordinator that may delegate bounded path-disjoint
work to Codex through the transport-neutral Spec Kit contract.

## Completed

- B3c tasks T001-T019 and field-report tasks T025-T030 are marked complete in `tasks.md`; their
  existing implementation diff was not modified by the collaboration-governance work.
- Constitution v1.2.0 formalizes coordinator ownership, least-privilege workers, non-overlapping
  write leases, no recursive delegation, evidence-based integration, and fail-closed required work.
- `workspace@1.4.1` adds `speckit.workspace.delegate`, the engine-visible delegation result
  contract, and recursion-safe review behavior; generated skills exist for Claude, Codex, and
  Cursor.
- `react-monorepo-quality@1.0.3` makes `speckit-implement` load the collaboration contract when
  worker output is integrated.
- `professional-sdd@1.5.0` has 24 steps. It initializes and validates a run-local delegation result
  before implementation; `required` accepts only delegated work with an independently accepted
  result. Mandatory reviews use a packaged fresh ephemeral Codex launcher with enforced
  read-only/never-approve flags and non-empty evidence gates.
- `.mcp.json` now keeps both adapters without replacing or interrupting the existing one:
  `codex-craftkit-async` for observable read-only work and `codex-craftkit-worker` as the
  synchronous fallback for explicitly authorized writes. Both avoid the user-scope `codex` name
  collision; local trust remains ignored and per-machine.
- The async adapter exposes start/status/result/cancel over dependency-free MCP stdio. It enforces
  read-only, never-approve, ignored user config, disabled plugins, a core-only model shell
  environment, repository-contained `cwd`, bounded state/output/concurrency, and POSIX process-group
  cleanup; Windows fails closed.
- `docs/development/agent-collaboration.md` records topology, preflight, task envelopes, exact
  sandbox/approval profiles, troubleshooting, and migration conditions.
- Project routing is deliberately one-way by default: Codex does not auto-start Claude; an explicit
  Claude session may call Codex. Long read-only work uses `codex-craftkit-async`, whose status reads
  local state every 30–55 seconds without starting another Codex call.

## Verification

- `specify extension list`: workspace v1.4.1, four commands.
- `specify preset list`: react-monorepo-quality v1.0.3, priority 5.
- `specify workflow info professional-sdd`: v1.5.0, 24 steps, delegation prepare/verify and two
  enforced Codex review launcher steps present.
- `specify integration status --json`: default Codex, all three integrations installed, no missing
  or invalid managed files; the known nine preset-composition warnings remain expected.
- Source and installed extension/workflow/preset files match; the installed extension has only its
  expected generated `.specify-dev` directory in addition.
- `claude mcp get codex-craftkit-async`: Project config, Connected. The synchronous worker also
  reports Connected from the real host; its expected sandbox-only state-database failure was not
  treated as a transport regression.
- End-to-end async smoke: one real `start → status → result` task returned
  `# Spec Kit Agent System`. A SHA-256 snapshot of `git diff --binary HEAD` plus every Git-visible
  untracked path, mode, and content matched before and after
  (`c14ee48de057e81516e4164db78c44d2fb587be2d99af7983fafbae7554222ba`).
- `node --test .specify/agents/bridges/codex-async/tests/*.test.mjs`: 18 tests passed, covering MCP
  negotiation/no-batch behavior, immediate start, coalesced status, result integrity, failure,
  cancellation, concurrency, late stdout, SIGTERM lifecycle, secret/config isolation arguments,
  descendant cleanup on cancel and successful completion, and the Windows fail-closed guard.
- A separate read-only reviewer reported no blocking findings after process lifecycle, MCP protocol,
  user-config/plugin isolation, and success-path descendant cleanup repairs.
- `node --test .specify/workflows/professional-sdd/tests/runtime-enforcement.test.mjs`: six tests
  passed, covering required/auto/off delegation results, malformed or stale state, exact Codex
  sandbox/approval/ephemeral arguments, rejection of exit-zero review without fresh evidence, and
  termination of a hung reviewer before the outer workflow timeout.
- JSON parsing, constitution placeholder/version checks, and `git diff --check` passed for the
  governance work.
- B3c application/package suites were not rerun by this governance task; T020 remains the source of
  truth for that evidence.

## Incomplete

- Recreate the four generated workspace skills for Claude and Cursor. Spec Kit 1.0.1 only exposes
  this through temporarily selecting each installed integration. The attempted Claude switch was
  rejected to preserve the user's Codex-only default; do not retry without explicit permission, and
  always return the final default to Codex if permission is given.
- T020: run and record the B3c evidence sequence.
- T021: two independent read-only final reviews and accepted-finding repairs.
- T022: convergence/adversarial verification and the editor-local-undo decision.
- T023: final B3c handoff refresh after product verification.
- T024: generate a commit proposal only.

## Decisions / Blockers

- No commit, push, or deployment is authorized.
- Codex-initiated tasks stay in Codex unless the user explicitly selects Claude. Claude-to-Codex
  bounded delegation remains available for deliberate load distribution.
- Do not silently switch the Spec Kit default to regenerate inactive integration skills. The user
  must explicitly approve the temporary switch after being told why it is needed.
- `codex mcp-server` is deprecated. The current adapter is verified compatibility plumbing, not
  permanent policy; migrate to the official Codex Claude Code plugin/app-server path when installed.

## Next Exact Action

Ask whether Spec Kit may temporarily select Claude and Cursor solely to regenerate `workspace@1.4.1`
skills, then restore Codex as default. If approved, run each supported activation, verify all three
generated skill sets and final default Codex, and rerun integration status. If not approved, leave
Codex default and report that Claude/Cursor still use the MCP config and shared documents but lack
the regenerated delegate/review/handoff/commit skills. Then execute T020 from
`specs/workspace/009-builder-b3c-inline-editing/tasks.md` and proceed through T024.

## Recovery

The product state is recoverable from the 009 spec, plan, contract, tasks, and current working tree.
The collaboration system is recoverable from the constitution, `rules/collaboration.md`, the local
async bridge, workspace extension/preset/workflow sources, and
`docs/development/agent-collaboration.md`. Reconcile generated integrations through Spec Kit; never
hand-edit their skill folders. The async bridge is additive: removing only its `.mcp.json` entry and
`.specify/agents/bridges/codex-async/` leaves the synchronous adapter unchanged.
