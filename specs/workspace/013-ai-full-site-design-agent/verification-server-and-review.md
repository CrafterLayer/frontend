# Verification: server, review, `none` mode, icons, colour freedom (T235–T254)

**Feature**: [spec.md](./spec.md) · **Tasks**: T235–T254 · **Date**: 2026-09-02

Five things happened in one stretch: the server that makes the remote path real; the review that
followed it; the `none` catalog mode; Lucide icons; and — after the **first live run** — the
removal of a colour law the product's owner never wanted on composed regions. This record separates
what was executed from what was reasoned, and keeps one incident in full because its lesson is
worth more than the embarrassment.

## The first live run, and what it proved — with a correction

The owner ran the playground with a real model and asked, in Arabic, for a farewell banner over a
travel photo from the internet. **Correction (2026-09-02):** that run did NOT go through
`apps/ai-server`. Port 8787 — the endpoint in `.env.local` — was held by the older
`scripts/ai-plan-bridge.mjs` (a CLI-spawned-model dev bridge, running for hours), which this work
had never been told about; my server was only ever smoke-tested on 8799. So the live evidence
proves the CLIENT path (doors, repair round, apply, the panel) against a model, and says nothing
about this server's prompt. The generic "The model returned an invalid plan response." in the
owner's screenshot is the bridge's wording, not this server's. Three facts still stand:

1. **The client path works end to end against a real model.** The plan crossed the wire, the
   validator refused it, the repair round ran, and the second plan applied. `apps/ai-server` itself
   remains verified over HTTP with a fake key only — its first live call is still ahead, and the
   owner has to stop the bridge (or point `VITE_AI_PLAN_ENDPOINT` elsewhere) for it to happen.
2. **The refusal was wrong.** The first plan used raw colour codes and an https image, and three
   separate gates refused them: the AI door's theming law on tree classes, the kernel door's
   raw-literal scan on the `css` prop, and the CSS sanitizer's refusal of every external `url()`.
   The assistant retreated to tokens and a grey panel. The owner had said from the start that
   composed regions may use anything Tailwind can — this was the brief, not a preference.
3. **A refused stylesheet failed silently.** One refused rule dropped the whole sheet, and the
   canvas showed an unstyled panel with no explanation (the owner's screenshot).

All three are fixed and pinned:

| Gate | Before | Now |
| --- | --- | --- |
| AI door, tree classes | theming law always | `colourPolicy: 'free'` by default; `'tokens'` restores it |
| Kernel door, raw literals | scanned every prop | props declared `customCss()`/`customCodeTree()` exempt — by marker, never by name |
| CSS sanitizer, `url()` | every external URL refused | `https://` allowed; `http://` and `//` still refused |
| Vocabulary | roles only | + Tailwind's palette (2,178 utilities; 4,875 total, est. ~40 KB gzip) |
| Canvas | silence | a `role="note"` names the refused construct; never published |

The theming law is untouched for a registered block's own `className` prop. Recorded as
[[colours-free-for-agent-trees]] in project memory so it is not "tightened" back by accident.

## What was executed

| Gate | Result |
| --- | --- |
| `@craftkit/builder-schema` | 260 tests (icon nodes, palette vocabulary, raw-literal exemption) |
| `@craftkit/builder-renderer` | 144 tests (icon drift gate: all 1,791 generated names resolve) |
| `@craftkit/builder-ai` | 325 tests (`none` mode, icon door, free/tokens colour policy) |
| `@craftkit/builder-custom-code` | 54 tests (sanitizer, parity, example validity, rejection note) |
| `@craftkit/builder` | 115 tests |
| `@craftkit/ai-server` | 40 tests (translation, prompt, Node adapter over a real socket) |
| `@craftkit/playground` | 102 tests (cost gate measures the WIRE request; drift gate on the regenerated vocabulary) |
| `pnpm lint` / `pnpm typecheck` | 29/29 · 28/28 |
| Server over HTTP | `dist/main.js` (Vite SSR, ~28 kB); 405 / 400 / 400 / 500-plain-sentence / SSE `result` |
| Storybook in Chromium | 461 / 463 (last full measurement; two pre-existing failures below) |

## Cost, on the real registry

| Mode | Tokens |
| --- | --- |
| `full` | 63,782 — overflows on the 12th short follow-up (measured) |
| `index` | 8,330 |
| **`none`** (what the playground sends) | **~4,500** |

## The review's other findings

- The server was green on every gate and did not start (extensionless workspace imports). Built
  with Vite SSR; adapter tested over a socket. → [[node-apps-need-vite-ssr-build]]
- The cost gate measured the context; the budget charges the wire request. Re-pointed.
- `providerKind` was inferred from "a provider was passed"; two Chromium stories starved. Declared.
- Storybook's indexer had failed on every run (29 `autodocs` + attached MDX pairs). Fixed.
- Three load-sensitive timeouts (`kernel-laws`, SC-005 `manager.test`, `page-independence`)
  each measured, each given 30 s with the measurement in the comment.
- Lucide ships no brand logos; the prompt's own examples said `github`. Corrected, pinned.

## The two Chromium failures — resolved (T257)

Both were run in Chromium with a temporary computed-style print and turned out to be STALE
STORIES rather than product defects: the Hero contract measured `rowGap` on a single-child
column that never had a gap (the rhythm is on the copy stack, `gap-6`), and the VideoSection
story quoted example copy that no longer existed. Both stories now measure what the component
actually renders; a filtered Chromium run passes them. The earlier attribution by reasoning below
is kept for the record — it was right about "not caused by this work" and wrong about "real
product defects".

## Two Chromium failures NOT attributed by execution (superseded above)

`Hero > Unthemed Publish Contract` (`rowGap` is `NaN` unthemed) and `VideoSection > Split` (region
named by heading, story expects the video title). Two clean-tree probes were attempted: the first
used `git stash` and was killed by a timeout with the tree stashed — nothing lost, but the pop
staged every file; the second used an isolated worktree and hung in Vite's dependency
re-optimisation. Attribution therefore rests on reasoning, stated as such: neither story imports a
changed path, and Storybook renders through its own Tailwind entry. **Both are real product
defects and remain open.**

## Hardening added after the live run (T255–T256)

- **Sanitizer sees through disguises.** The refusal list is matched against a normalised copy
  (comments stripped, `\69`-style and `\x` escapes decoded), so `@\69mport`, `u\72l(`,
  `@/**/import`, and `\6a avascript:` are refused as a browser would read them, while the
  rendered text stays the author's own (`.\31 st` survives). Web-font `@import` from
  `fonts.googleapis.com` / `fonts.bunny.net` is allowed and lifted in front of the scoped rules;
  look-alike hosts and a second import behind a font import are refused. 12 tests.
- **Links and buttons.** `a` (via `safeHref`, which now admits `tel:`; `rel="noopener noreferrer"`
  on external links; only `_blank`; canvas clicks swallowed) and `button` (always
  `type="button"`, no handler) join the 35-tag vocabulary. 9 tests, including the static path.

## Residual risk

- **Brand icons.** None in Lucide by policy; `simple-icons` is the addition if social links need
  logos.
- **Colours no longer re-theme** in composed regions when the palette or hex is used — by decision.
- `strict` CSS policy throws by design; the tree Inspector is a JSON surface; the LIBRARY default
  catalog stays `full` while the playground runs `none`.

## Skills layer, after the activation verifier (T259)

The Skills workflow's adversarial verifier refuted keyword-only activation with four findings;
all four are fixed at the root rather than by adding keywords:

- **Language is a script, not a phrase.** `activation.scripts: ['arabic']` fires on any Arabic
  character (base block, supplement, extended ranges, presentation forms). Before: "صمم لي معرض
  أعمال" got RTL expertise and "اعمل معرض أعمال" did not. After: every Arabic row in the matrix
  carries `craftkit.arabic-rtl`; no English row does.
- **Occasions have an archetype.** `craftkit.occasion-page` (invitation, wedding, farewell,
  greeting, condolence) — the request behind the owner's transcript ("بانر وداع سامر ووسيم مع
  خلفية سفر") now activates copywriting + occasion-page + arabic-rtl instead of nothing.
- **Tone and readability asks route.** darker / lighter / background colour / أغمق / أفتح →
  design-direction; easier to read / readable / أوضح / مقروء → accessibility review.
- **The budget rule is written down.** Floor plus at most three auto Skills per request (an
  archetype, its copywriting dependency, the language); the ten-row matrix pins every row under
  the 2,400-token row ceiling.

| Gate | Result |
|---|---|
| `@craftkit/builder-ai` test | 39 files, 372/372 |
| `@craftkit/builder-ai` typecheck + lint | clean |
| `@craftkit/playground` test | 19 files, 102/102 |
| `@craftkit/ai-server` build + test + typecheck + lint | dist rebuilt, 51/51, clean |

## "The assistant server could not be reached: Failed to fetch" (T260)

Reproduced with Node `fetch` against both loopback families while both processes listened:

| Target | Preflight `OPTIONS` | `POST` |
|---|---|---|
| `[::1]:8787` (this server, old build) | 405, no CORS headers | 400, no CORS headers |
| `127.0.0.1:8787` (deprecated bridge) | 204 with `Access-Control-Allow-Origin` | 401 with CORS headers |

The browser prefers `::1`, so the panel reached the new server and the missing
`Access-Control-Allow-Origin` became "Failed to fetch". Fix: `apps/ai-server/src/cors.ts`
(see T260). The bridge was stopped; the server was rebuilt and restarted; the same probe now
returns 204 with the origin echoed on `[::1]:8787`. The running server still has no
`ANTHROPIC_API_KEY` in its environment — the next error the panel shows will be the provider's
credential error, which is the honest one; `apps/ai-server/.env` is where the key goes.

## Driven from a real browser (T261)

Playwright against the running playground at `http://localhost:5173`, Assistant tab, request
"كبّر عنوان الهيرو":

| Step | Observed |
|---|---|
| Page-context `fetch` to `localhost` / `127.0.0.1` / `[::1]` :8787 | all answered (400 for an empty body) — no CORS failure |
| Panel request | `POST /plan` → 200, `text/event-stream` |
| Result frame | `invalidOutput.message = "The assistant server failed unexpectedly."` |

The server had no credentials; the SDK's request-time error is a plain `Error`, unrecognised
by the translator. Fixed (T261): the frame now names the cause and where the key goes.
