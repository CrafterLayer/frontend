# Codex subscription development server

Scope: `apps/ai-server`; local development only. Authorized by the owner's request on 2026-10-20 to
also run this server through their Codex CLI subscription.

## Requirements

- FR-001 Add `codex:` routes beside `cli:` models using the installed `codex exec` and ChatGPT
  login, without API-key fallback or changing existing SDK, Claude CLI or OpenRouter behavior. A
  standalone `codex` backend uses the same existing command and settings.
- FR-002 Preserve `/plan`, prompt enhancement, plan validation, JSON/SSE responses, model
  allowlisting, cancellation and complete-call deadlines through the existing client seam.
- FR-003 Run ephemeral, read-only, never-approve children in disposable directories with user
  configuration, project instructions, shell, apps, MCP and web access disabled. Keep credentials in
  the CLI's existing credential store; never copy or print them.
- FR-004 Bound concurrency (six active, no pending queue), output and process lifetime; clean files
  and terminate process groups on cancellation, failures and server shutdown.
- FR-005 Expose measured token counts when available and unknown cache-write/cost values. Report
  missing CLI/login, failed turns and invalid output honestly. Do not expose private reasoning or
  raw provider diagnostics to HTTP clients.
- FR-006 Use the existing `"dev": "sh scripts/dev.sh"` command, server, port and
  `CRAFTKIT_AI_MODEL(S)` list exactly like Claude. The owner explicitly rejected additional commands
  or a separate server. Add `codex:` to the local allowlist and document account limits, setup and
  unsupported batches/authored runs.

## Acceptance

1. A logged-in owner starts the existing dev command and can select Codex alongside Claude.
2. A successful child final answer reaches the existing handler and validation with usage.
3. Abort, timeout, oversized output, stdin/spawn errors and nonzero exit settle once and release
   resources; late events cannot become successful results.
4. Configured allowed models work; arbitrary request models remain refused.
5. Existing providers keep their configured behavior. Codex never silently uses an API key.
6. Screenshot inputs used by scene review are forwarded as bounded local images, or an unsupported
   input is rejected explicitly rather than silently dropped.
