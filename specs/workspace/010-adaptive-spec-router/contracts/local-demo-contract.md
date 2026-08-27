# Local Demo Contract

## Product Boundary

The Adaptive Spec Router app is an illustrative deterministic user interface. It must not:

- authenticate a provider or request a credential;
- call a Claude, Codex, MCP, repository, or network endpoint;
- start, stop, inspect, bill, or modify a real agent task;
- read, write, stage, commit, or publish repository content; or
- represent its example evidence as a real provider response.

## Input Contract

The scenario composer accepts:

| Input      | Allowed values                                             | Error state                                |
| ---------- | ---------------------------------------------------------- | ------------------------------------------ |
| Brief      | Non-empty text with at least 12 trimmed characters         | Explain that more task context is needed.  |
| Work class | Mechanical, implementation, architecture, security, review | Use the selected value only.               |
| Risk       | Low, standard, critical                                    | Use the selected value only.               |
| Entry mode | Codex-native, Claude-adaptive                              | Do not cross into the other mode silently. |
| Model tier | One illustrative unavailable tier or none                  | Use an explicit allowed-tier fallback.     |

## Output Contract

For a valid scenario, a displayed route has all of the following:

- one writer provider and model tier;
- one independent reviewer provider and model tier;
- reasoning effort and safety lane;
- at least one visible decision signal;
- an explicit fallback statement; and
- a one-writer ownership statement.

If provider availability changes a preferred route, the output explicitly identifies the fallback.
If the preferred model tier is unavailable, the output identifies both the unavailable tier and the
selected allowed fallback. It must never silently retain an unavailable tier. If a brief is too
short, no false route is shown.

`Codex-native` is the default. It keeps routing and review inside Codex and never starts Claude
automatically. `Claude-adaptive` is explicitly selected before a route can coordinate Claude with
Codex. A route must not silently cross that boundary.

## Review Freshness Contract

A plan audit is `ready` only if it has a current Claude review and a current Codex review, both
attached to the same frozen plan revision. A material revision makes prior review records `stale`;
it cannot be called ready until current review evidence exists.

Codex-native may show its current Codex review, but it remains `needs-review` because it cannot
start the Claude reviewer automatically. The developer must explicitly start Claude-adaptive mode to
obtain a cross-provider plan audit.

## Reset Contract

Reset restores the original deterministic example state in the current browser session. It has no
effect outside the product interface.
