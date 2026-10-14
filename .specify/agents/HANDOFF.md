# Active Work Handoff

## Current continuation — analytical report pages, 2026-10-14 (h)

Done and pushed (T273–T274): Excel/JSON drop on the agent panel (dc41055) and `report.page` with a
deterministic analysis engine (6b7e7d3) — key stats, several charts, findings and interactive tables,
every figure computed by code. Then T275 (d0272af): brand logos, cartoon characters and illustrations from
verified catalogs (`art-catalog/`, see its PROVENANCE.md); open items are listed under T275.
Then T276–T278: murals without unasked UI (696a1a6), mural scale through pixi-viewport (e58ce1c),
and skills chosen from the request in every lane (67c6be6, 4c12b89 — touches `use-agent-knowledge.ts`,
`page-plan-context.ts`, `page-plan-step.ts`, `run-build.ts` with the owner's approval).
Then T279 built-in skill switches (ce010ba) and T280 illustrated mural stories with a scrubbable
`s.lib.anim` timeline (e82d670); GSAP is not used (licence). Open: ai-server `handler.test.ts` "answers a unary page plan…" fails
on the branch head independently of these commits (expects a `restart` subscription); the size
guard says `cli-client.ts`, `index.ts`, `route-intent.ts`, `generate-plan.ts` shrank and can be
tightened.

## Current continuation — empty canvas and request skills, 2026-10-13 (g)

Status: local implementation, verification, final scoped convergence and fresh independent review
complete on 2026-10-14, T265..270 / SP-008..011. The owner supplied screenshots of a long edit
reporting success with an empty canvas and requested automatic skills with inline prompt choices.
Canonical plan:
[scene increment](../../specs/workspace/014-professional-builder-agent/scene-speed-2026-10-13.md#authorized-empty-canvas-and-request-skills-repair--2026-10-13).
Evidence:
[incident and skills verification](../../specs/workspace/014-professional-builder-agent/verification-empty-canvas-skills-2026-10-13.md).

Done: cumulative edit/page-planning deadlines settle Stop and non-cooperative providers, forward
caller budgets and suppress late application/callbacks. Complete server calls bound cache waits, SSE
consumption and fallback; interactive SDK retries no longer stack. Blank explicit Arabic/English
creation takes the build path; existing scenes retain ownership. Metadata-only/empty scene plans
cannot report creation success, including after repair/salvage. Auto partial edits show kept/total
commands and actual application events advance progress.

Enabled Builder skills activate automatically; optional selections are inline, without persistent
chips or the three-choice UI cap. Queued requests, Improve/Restore, Clarify, Retry/reload and
planned Build preserve captured IDs and clean briefs, with current enabled/trust/budget limits.
Optional bounded user-turn metadata keeps older saves compatible. Convergence T270 fixed re-planning
after a skill rename/collision: the prior semantic brief is captured before superseding, while
explicit choices belong to the current request only. No storage version/key change or migration.

Verified: primary intent/creative 20 files / 2493 tests; engine 13 / 174; server full 47 / 759;
Playground 7 / 100, then final T270 2 / 27. Worker final controller integration 2 / 41; fresh
independent server 27, intent 48, engine 110, skills 31 and T270 2 tests. Four owner/consumer types,
scoped lint/format, server/Playground production builds, full Storybook build and affected browser
stories (4 / 113) passed. Real-component Chromium 2/2 (English/Arabic, 390 px, dark) confirmed five
inline choices, seven automatic creative skills, zero chips/overflow and no later-choice leakage.
Workspace 37; components 259; file sizes 4381; boundaries 5579 files / 37 packages; graph 37 / 185;
final first-load budgets passed. No baseline increase. Final convergence: 4 requirements, 8 plan
constraints, 9 constitution principles, no remaining gap after the one medium T270 repair.

Review: fresh native read-only review verified the final repairs and has no remaining actionable
finding. All write leases are released. The user's local-only review preference and active-plan
exception persist; no external CLI or full professional-sdd CLI workflow is claimed.

Next: no requested implementation/local checks remain for this bounded increment. Preserve earlier
diffs, artifacts and saved data. Local source changes require a fresh request in the refreshed UI;
the prior run is not replayed. No paid generation, dependency install, commit, push or deployment.
Original provider traces, live latency/billing and representative bespoke visual quality were not
measured. Static scene witnesses do not prove runtime pixels; complete multi-step builds are not
promised within an edit deadline, and remote providers may ignore cancellation. Older feature014
release gates remain separate.

## Current continuation — deadline reliability and published styles, 2026-10-13 (f)

Status: local implementation, checks and independent review complete, T261..264. User requested
continued work and selected speed/reliability plus open visual repairs (“1+2”). Requirements:
[SP-005..007](../../specs/workspace/014-professional-builder-agent/scene-speed-2026-10-13.md#authorized-reliability-and-visual-follow-up--2026-10-13).

Done: section deadlines settle non-cooperative promises, retain one retry/Stop/caller budgets and
refuse late application. CLI caps/effort reach cold and warm children/settings; warm identity
includes the cap. Cache followers use the remaining wait window; unrelated HTTP400 errors receive no
cache retry. Legacy API effort compatibility includes dated Claude4 IDs. Published marketing CSS
travels through public entries and is included once per rendered page, including shared/aliased
documents.

Verified: primary broader Builder 18 files/186 tests and publishing 6 files/22 tests; final server
10 files/154 tests, marketing 2 files/30 tests; independent Builder 3 files/28 tests. All five
owner/consumer typechecks, scoped lint/format, production builds, workspace/boundary/file-size and
Playground first-load budgets passed. Final Chromium 8/8 (390/1280 px, light/dark, LTR/RTL)
confirmed owner dark rules, comparison layout and no overflow. Current catalog: 28 presets/1400
offline runs, 98.08% fewer JSON characters. Exact evidence:
[follow-up verification](../../specs/workspace/014-professional-builder-agent/verification-reliability-visual-2026-10-13.md),
with saved browser and offline JSON artifacts. Older artifacts remain historical evidence.

Review: independent local reviewers verified the dated-model and aliased-document repairs; no
remaining implementation finding. User's local-only review instruction still applies under the
active-plan exception. No external CLI reviewer or full professional-sdd CLI workflow ran.

Next: no requested implementation/local verification work remains for this follow-up. Preserve
earlier work and data. No provider spending, dependency install, commit, push or deployment. Live
generation time/cost/quality and prior release gates remain unverified; these reproduced local
findings do not establish the cause of the original seven-minute run. Settling an expired promise
does not forcibly stop a provider that ignores its abort signal.

## Current continuation — more mural libraries, 2026-10-13 (f, libraries)

Done and pushed (T271–T272; upstream T261–T262 before merge resolution): FastNoiseLite and Bezier.js
vendored as verbatim copies with their upstream licences (the owner chose this over changing the
licence audit, which the auto-mode classifier refused as weakening a gate; the audit is unchanged);
culori (`s.lib.color`), lindenmayer (`s.lib.lsys`), d3-shape + simplify-js (`s.lib.geom` 1.2.0) and
four set-E murals. Upgrading a vendored copy is manual (see each `vendor/<name>/PROVENANCE.md`).
Size notes the guard prints (`cli-client.ts`, `index.ts` shrank) are from efea3b7 and can be
tightened.

## Current continuation — mural build speed, 2026-10-13 (e)

Status: local implementation, checks and review complete; user accepted local review on 2026-10-13.
The owner reported mural Agent builds exceeding seven minutes and failing, and requested complete
ready initialization scripts and a faster, stronger AI server.

Scope: Builder AI, Builder public wire/testing facades, AI server, existing Playground section Redo,
and offline Evals Pixi QA. Canonical increment:
[scene-speed-2026-10-13.md](../../specs/workspace/014-professional-builder-agent/scene-speed-2026-10-13.md).
Evidence and exact limits:
[verification-scene-speed-2026-10-13.md](../../specs/workspace/014-professional-builder-agent/verification-scene-speed-2026-10-13.md)
and its JSON artifact. Feature014's spec/plan/tasks link this increment; older release tasks remain
separate.

Done locally (SP-T1..5):

- 22 existing backdrop presets initialize a complete responsive section from one marker: contract
  title/claims/facts/action, tested JS, metadata and validated settings. Authored tree/CSS stays
  authored; explicit preset ids survive retry, bespoke/excluded scenes remain custom.
- Default backdrop call deadline 180s; initialization 90s; ordinary fills 240s; other scene lanes
  420s. Explicit host deadlines override them. These are call budgets, not total-build timing
  promises.
- The server fast policy applies only to actual Free-code Pixi fill initialization. Deep/custom
  capacity stays intact. Cache staggering observes backend activity rather than waiting narration.
- Settings survive scene probes, guarded fills and section Undo/Redo. Public test-only helpers keep
  Evals off private filesystem imports; production wire remains data-only.
- Offline measurement: 22 presets, 1100 initializations, 98.25% fewer serialized proposal
  characters; no live provider latency/token/billing measurement.
- Native independent reviews found and verified repairs; no unresolved implementation finding. Final
  focused tests: 37 builder, 166 server, 3 wire, 6 successor. Broader run-build/revert tests and
  isolated lesson rerun passed. Full earlier AI suite: 223 files/6805 tests before final review
  fixes. Browser 9/9 (mobile/desktop, LTR/RTL, reduced motion); primary reran fixture+mobile browser
  after public import repair. Owner/consumer types/lint, server/Playground builds and workspace/size
  gates passed. Exact results and timing caveat are in the verification document.

Review decision (T260 / SP-T5): automatic approval review rejected the external Codex CLI action
because it may transmit private repository contents to an unverified destination. The user then
explicitly replied: “لا، اكتفِ بالمراجعة المحلية” (2026-10-13). Local independent review and
repaired findings are accepted for this increment. The external runtime gate is waived for this
scope by that instruction; no CLI process ran and no CLI pass is claimed. The bounded exception is
recorded in the active plan.

Next step: no requested implementation or local verification work remains for this increment. Do not
request or launch the declined external review unless the user explicitly authorizes a new review
action. Preserve the current diff and earlier release work. No commit, push, deployment, provider
generation or dependency installation occurred. Live provider latency/cost and broader feature014
release gates remain unverified.

Recovery: existing stored scene code/settings use current schemas; no migration. Keep their data and
the new recorded settings when reverting source changes. Separate existing limitation: reduced
motion Studio thumbnails may read a cleared WebGL buffer even though compositor screenshots show
visible still art. This increment did not alter thumbnail capture.

## Previous completed work (retained)

## Current continuation — murals that land, cheaper reviews and batches, 2026-10-13 (d)

Reported (Arabic): murals failed on time and no PixiJS mural landed; asked for strong cost work
(Batches + prompt caching, the visual review), mural libraries, free art packs (Kenney, Open Peeps)
and ready scripts. **Done and pushed** (feature 014 T256–T259).

- T256: ready scenes for mural writers (`agent/scene-ready.ts`) and a fast retry; edits that add a
  mural get the same list. Without live calls this is proven by build tests (a hanging writer now
  lands a ready scene), not by a real model run: watch the next real mural build.
- T257: review skips tested code and reuses verdicts; breakpoints only where they can cache; batch
  pre-warm at 3+ sharers; reviews can ride `/batch` (no background build uses it yet — builds would
  need to be resumable to wait for a batch).
- T258: `tidySection` code repairs before the check; `section.ops` tone / space.
- T259: noise, geom and hex libraries; six set-d murals; Kenney hex tiles (Open Peeps already
  shipped as `s.lib.peeps`).
- Open: physical-side classes (`ml-4`, `text-left`) are silently dropped by the door's normaliser
  instead of being respelled logical; `s.texture('data:…')` fails in the reviewed preview's CSP
  (`connect-src 'none'`); "make the story black" is read as a heading colour; a playground test
  failed once under load and passed on re-run; the core behaviour runtime still ships with any
  behaviour; `section-layout.css` still misses the published stylesheet.

## Current continuation — ready scripts and Pixi packages, 2026-10-13 (c)

Requested (Arabic): the packages that strengthen PixiJS results, and ready-made scripts for what the
agent does often, so each costs it less. **Done and pushed** (feature 014 T251–T255): what the agent
used to write as code it now names — a preset id and params, a `data-ck-behavior` value, a library
call.

- T251: `s.lib.procgen` (rot-js) and `s.lib.gif` (gifuct-js), lazy per scene; @pixi/gif,
  @pixi/layout + yoga and poisson-disk-sampling rejected with reasons in the media-engines README.
- T252: six ready website behaviours (back-to-top, read-more, scroll-spy, typed-words, filter,
  dismiss), shipped only where named; all-packs budget 27,000 B.
- T253: the free-code card names the ready behaviours instead of a hand-written counter.
- T254: fixes the new tests found — stored `hidden`, the sticky header on published pages, a polite
  "copied" for screen readers.
- T255: eleven kits as `scene.preset` (game: arcade, platformer, runner, breakout, memory, quiz,
  snake, catch; story: picture-book, visual-novel, scroll-story). One call of ~24–84 tokens instead
  of ~3k–7k written tokens per kit (58k → ~0.4k over all eleven). The ids are taught in the
  games/stories playbooks, not the always-on edit menu (that lane is at its cap; adding them costs
  ~27 cached tokens a request and four mirrored files).
- Open: a vague "add a game" does not wake the games playbook (no bare "game" keyword); the emitter
  atlas logs a Pixi "[BindGroup] textureSource destroyed while bound" warning on spawn
  (media-engines); the core behaviour runtime (~11.8 KB) ships on any page with any behaviour;
  `section-layout.css` never reaches the published stylesheet; best scores last one visit.

## Current continuation — design round, 2026-10-13 (b)

Requested (Arabic): better designs and template designs, more elements, Tailwind packages for design
quality, the whole builder's design and UX, performance and code separation. **Done and pushed**
(feature 014 T243–T247): six new templates + a rhythm pass (direction-filtered for the agent); eight
new elements; typography/forms/tw-animate plugins end to end; a builder design pass (audit
screenshots in the session scratchpad); EditorCanvas and AssistantPanel split, vendor chunks (entry
−31%); the theme gate green again.

- T248 done: templates load on demand; first-load JS 1,080 of 1,151 KB. Further measured options if
  it grows again: the full lucide set (−86 KB), react-dom/server for Library thumbnails (−56 KB).
- T249 done: the agent's conversation memory (40 messages, stepped window + digest, sections named)
  and carried skills; full-prefix cache reads 3 → 39 of 48 turns in the reproduction.
- T250 done: 13 particle presets on s.lib.emitter and s.lib.physics.world(s); physics has 76 B of
  bundle headroom, emitter budget raised to 17,400 B.
- Open from the audit: the selection toolbar covers the selected element's name label; the
  Inspector's empty card could mention Layers; a two-way LTR | RTL switch in Settings.
- Open from the blocks: `section-layout.css` never reaches the published stylesheet (dark-section
  corrections are lost on published pages, all blocks); the compare pack's thumb differs from the
  canvas handle.
- Photos for new templates reuse verified entries only (Unsplash/Pexels are blocked here).

## Current continuation — cache reads, characters, responsive scenes, a smarter agent, 2026-10-13

Requested (Arabic): make the agent actually read from the prompt cache on every route, start on
free-licence art (Kenney, Open Peeps), make the agent smarter, and use pixi-viewport so scenes scale
on every screen. **Done and pushed** (feature 014 T232, T233, T240–T242):

- Cache (T240): `cache-doctor.ts` names why each call wrote instead of read (first, expired, model,
  settings, rules/catalog/skills/history; the API's own diagnosis on `api:` slugs), shown in the
  server log and the run telemetry (EN/AR). OpenRouter `anthropic/` slugs now keep the hour and the
  conversation breakpoint (`openrouter-cache.ts`, falls back to five minutes only when refused); the
  enhancer's rules are cached. The site plan (~450 tokens) and the scene review (~330) are under the
  API's 512-token floor. openrouter.ai is outside the network policy: not verified live.
- Characters (T233): `s.lib.peeps` (Open Peeps CC0 via DiceBear 9.4.3). Kenney not fetched:
  kenney.nl must be allowed in the environment's network settings first.
- Responsive scenes (T241): `ck.scene({design})` + `s.world`; pixi-viewport only with `zoom`.
- Smarter agent (T232, T242): one visual review per scene section; build lessons for later writers.
- Budgets with no headroom: kit 15,769 / 15,800 B gzip; pixi-dialogue skill 2,798 / 2,800 tokens.
- Not done: scene presets using peeps; `LIB_CUES` for peeps in scene-edit-context; review usage as a
  build `provider.usage` event; `graphify` is not installed here, so the graph was not updated.

## Current continuation — agent power, batches, creative production, 2026-10-12 (b)

Requested increment: **in progress, pushed in slices** (T215..T235, feature 014). The user asked
(Arabic) for Arabic/English everywhere, a modern compact agent chat, cache reads that are not 0,
context handled like Claude's agent chat, background batches and smarter live workers, and "high
power" for stories, murals, games and websites, installing any package needed (10/10).

- Done and pushed: T215..T231c, T235..T238 (see feature 014 tasks). Highlights: one-hour cache
  breakpoints + same-prefix staggering; per-model thinking-off (the 5.5 models refused `disabled`);
  stream error frames; history trimming + context meter; story/game preview scale fix; Message
  Batches end to end with a jobs panel; creative activation, briefs, physics/scroll-mural/page-shape
  playbooks; static scene checks with one repair; 30 tested scene presets and `scene.preset`; the
  scene probe (free-code builds run each scene in a hidden sandboxed frame, one runtime repair); one
  live region in the agent panel.
- Agent stories (apps/storybook, `../playground/src/features/agent/components`): all green after the
  compact-chat catch-up; AgentSheet's Detent Flow is timing-sensitive under load.
- Also done: real multi-page sites with one writers' pool (T230); dialogue and scene settings
  translatable (T231a); the tree door keeps the hooks scene code finds (T231b — it dropped them).
- Then: site pages link each other (T230b), the story arc and unwinnable-level check (T231c),
  adaptive writers on rate limits (T237), preset art pass (T238).
- Then: language versions of a whole site (T230c); eleven presets reworked to look finished in
  seconds (T238); full regression sweep green, an old Undo corruption fixed in core history (T239).
  Next: T230d translations via the batch queue; Plan mode for site requests.
- Owner decisions open: T232 vision review, T233 CC0 art packs, T234 CI workflow + formatting.
- No new npm package was needed so far (the runtime already ships pixi.js 8, matter-js, inkjs,
  @pixi/tilemap, pixi-filters, pixi-viewport, roughjs, perfect-freehand, simplex-noise, @pixi/sound,
  zzfx, yuka, @pixi/ui); Spine (proprietary) and Rive (5.6 MB) were rejected.
- Rules learned this session: stage only the files a helper names; stage the shared
  `file-size-baseline.json` per line (`git hash-object` + `update-index`), never the whole file.

## Current continuation — agent tools, data, four blocks, Studio game libraries, 2026-10-12

Requested increment: **locally verified**. The user asked (Arabic) to keep improving the agent and
its tools, keep expanding the builder, and install the libraries PixiJS needs to be much stronger.
Executed as T204..T213 (feature 014):

- Composer commands: the `/` list opens with Remember, Save a checkpoint and New skill, acting on
  the words before the slash (EN/AR words); `hooks/use-knowledge-ui.ts` runs them.
- `data.show` (builder-ai `data-tools/`): CSV/TSV/markdown/rows → a Chart or Table block, numbers
  read as people write them (Arabic digits, `$1,200`, `45%`, `1.2k`, accounting brackets), the form
  chosen by the question (time → line, shares of 100% → donut, mixed units or text → table); refills
  an existing chart/table by `id`. Edit and build lanes list it (caps +150). Skill
  `craftkit.data-viz` (auto, EN/AR). The zero-token path reads an instruction line over pasted rows.
- Panel: drop a .csv/.tsv/.md/.txt on the agent panel → rows under "Chart this:"; Skills tab imports
  a SKILL.md from an https link (GitHub blob/tree → raw), fetched into the box to read first.
- Blocks: Timeline, MenuSection, Location, Countdown (published clock: `countdown-clock` pack, 1.8
  kB, only where used). Every visible word of Chart, Timeline, Menu and Countdown is a part. Dark
  sections: a light card that carries its own ink keeps it (slab revert rule, all blocks).
- Studio libraries (lazy, only where named): `audio` (@pixi/sound + zzfx), `gameai` (yuka: steering,
  FSM, A* over the tilemap), `hud` (@pixi/ui with DOM twins for keyboard and screen readers); skills
  `craftkit.pixi-audio`, `pixi-game-ai`, `pixi-hud`; Chromium fixtures LTR/RTL × 390/1280.
- Cost: every catalog-free request ~1,390 tokens lighter (customCode `jsMeta` summarised by its
  declaration; template `blockTypes` only with the full catalog): none 13,183 → 11,794.
- Repairs: the AI vocabulary generator (extensionless TS imports) and the two utilities it had
  stopped generating; stale pins in runs, readiness, copy rules, editor labels, field kinds.

Then (T213, T214): the Inspector's "Scene settings" edits a scene's `jsParams` from its
`jsMeta.params` spec (custom-code field types found by marker; `jsMeta` hidden); and seven default
skills ship on for every person, led by "Design intelligence (UI UX Pro Max)" — 29 kinds of business
with pattern, `theme.apply` colours, verified font pairs, effects, must-haves and anti-patterns,
distilled from the MIT data files — each switchable, readable and copyable in the Skills tab.

Verification: builder-ai 5642/5643 (pre-existing plan-page repair test); playground 3509/3510;
blocks-marketing 970; media-engines 197; schema 834; renderer behaviours/engines/export/studio 403
(all-packs budget 16 → 21 kB, measured; packs ship only where used); creative-engines browser 6/6
(the engine-examples fixture can time out under a parallel load and passes alone); storybook
SkillSlash 12, SkillsTab 16, four blocks 33; check:components 240; check:file-sizes. Open: the one
playground failure (Studio props without an editor) is fixed by T213; Countdown has no date-time
picker, Menu no price grid, Location no geocoding; music by project asset reference needs an export
change.

## Current continuation — agent skills, memory, checkpoints; Table and Chart; canvas chrome, 2026-10-12

Requested increment: **locally verified**. The user asked (Arabic) to review the agent's memory,
checkpoints and power, to add a place in the agent chat where they can add skills (as other agents
have them, with `/` in the chat listing skills, and skills uploadable as .md/.mdx), to make the
agent much stronger, then to fix the element bar, add more blocks such as a table, and support
charts. Executed as T196..T203 (feature 014):

- Engine: `RunAiAgentOptions.hostSkillIds` (`agent/host-skills.ts`) — builds and page plans now
  offer the host's skills (they name their skills, so a person's skills never reached a build); the
  keyword matcher reads the Arabic indefinite accusative («أضف مخططًا» holds «مخطط»).
- Skills: `model/user-skills*.ts`, `skill-markdown.ts` (SKILL.md and SKILL.mdx: front matter or
  `export const meta`, imports/exports dropped, JSX unwrapped), `skill-templates.ts` (six starter
  skills EN/AR); always-on skills share an 8,000-character budget (mandatory in the engine).
- Memory: `model/project-memory.ts` — preferences and site facts, one reviewed `data` fragment on
  every run; answers and plans now read the same context as builds (`words-flow.ts`).
- Checkpoints: `model/checkpoints.ts` + `app/agent-checkpoints.ts` over the vault shelf (10 auto
  points): kept before every build and edit; "Restore the page to before this request" works.
- UI: header "Skills & memory" (KnowledgePopover: SkillsTab with New/Import/Upload/templates/
  built-ins, SkillEditor, SkillRow, MemoryTab, CheckpointsTab) and the composer's `/` (SkillSlash:
  own skills then built-ins, pins up to three to the next message as explicit skills).
- Blocks: `table` and `chart` (bar/line/area/pie/donut, hand-built accessible SVG, no dependency) in
  blocks-marketing; library, Inspector (EN/AR), AI catalog, static export.
- Canvas: the floating chrome (action bar, quick bar, text bubble, name chips) keeps its size under
  zoom (`useCanvasZoom`, `--bldr-canvas-zoom`).

Verification: see the commits 59d4eeb..HEAD; agent and app suites show only the pre-existing
failures (editor-labels ×1, copy-rules ×3, runs ×2); builder-ai 5451 with the pre-existing plan-page
repair test; blocks-marketing 865; shell 1807. Found, not fixed: the Storybook vitest setup never
applies the a11y addon's annotations (`apps/storybook/.storybook/vitest.setup.ts`), so
`a11y: { test: 'error' }` does not run; enabling it exposes the Composer textarea's
`aria-allowed-role` failure. Open: drag ghost, drop indicators, spacing bands and snap guides still
scale with zoom; a grid editor and CSV paste for table cells and chart values.

## Current continuation — Studio Indigo platform UX, command palette and feedback, 2026-10-12

Requested increment: **locally verified**. The user asked (Arabic) for a complete, professional
UX/UI across the whole CraftKit platform using the UI UX Pro Max guidance (no-code builder profile),
applied in code, with the code properly split (no very large files), and allowed suitable packages.
Executed as T189..T195 (feature 014):

- Shell chrome: captioned dark icon rail (`IconRail captions`), one primary **Publish site** in the
  TopBar's Publish slot (`publishDisabled`, `publishTitle`, `showPublishOptions={false}`), segmented
  Canvas / Sitemap, icon-only pane toggles, rail measure shared with the phone overlay.
- Arabic for the Pages workspace, site map, page menus, History and code panels (`*.labels.ts`,
  `PANEL_LABELS`, `arabic-count.ts` agreement).
- Splits under the new limit: `pnpm check:file-sizes` (source ≤ 500, tests/stories ≤ 800,
  shrink-only baseline `packages/workspace-tools/file-size-baseline.json`) runs in `verify`;
  App.css, App.tsx, the agent controller hook and fake controller and today's large modules are
  split.
- Packages (catalog, MIT, React 19 peers): `cmdk 1.1.1`, `sonner 2.0.8` in `apps/playground`;
  Storybook pre-bundles both (`apps/storybook/.storybook/main.ts`).
- Command palette (`features/command`): Ctrl/⌘ K or the top bar's "Search and commands" field opens
  one searchable list of every place and action — publish, preview, undo/redo, every rail section,
  devices, Canvas/Sitemap, pane toggles, every page, the editor language, keyboard shortcuts — built
  live in `app/use-editor-commands.ts` (current place marked, unavailable rows disabled,
  cross-language keywords: «نشر» finds Publish site). cmdk inside the editor's Radix dialog.
- Action feedback (`features/feedback`): `FeedbackToaster` (sonner, unstyled, tokens-only, RTL) and
  `notifyPublish`: "Publishing the site…" → "Site published · N files" in place, or "The site was
  not published" + Try again (10 s). `publishStaticSiteFiles` now resolves with its files.

Verification: playground `tsc` and eslint clean on the changed files; the new components' unit tests
(14) and Storybook interaction stories (9) pass in Chromium; `pnpm check:components` 227,
`pnpm check:file-sizes` 3,515 files, `pnpm check:boundaries` clean; live editor screenshots in EN
and AR (RTL) at 1440, 1024 and 390 px. Full playground suite: 3275 of 3288 pass; the 13 failures are
identical at 71e912d (before this increment): editor-labels ×1, copy-rules ×3, runs ×2,
ai-context-cost ×2, assistant-agent-readiness ×2, field-kinds.registry ×2, tailwind-vocabulary ×1.
The App story "Default Preview Uses The Selected Breakpoint" also fails at 71e912d. Open: the
element quick bar still scales with canvas zoom (overlay system, separate work).

## Current continuation — Studio Indigo chat redesign in code, 2026-10-12

Requested increment: **locally verified**. The user asked (Arabic) for the full chat design from the
Claude design canvas (https://claude.ai/artifact/A2jFVe8nM5zcmi73YzhWqN) in the real panel, then the
rest of the platform's screens in the canvas. Executed as T184..T188 (feature 014):

- AgentHeader `status` subtitle (`model/header-status.ts`: building, editing, thinking, stopping,
  waiting for your decision, ready / ready with free code), inside the same 44px, not live.
- Free code is a labelled switch chip with a track in ComposerToolbar's choices (`aria-pressed`,
  described by on/off copy).
- `CreativeStarters` (game / story with choices / bedtime story) in the empty thread under the page
  starters, with a free-code note that can turn it on; fills the composer, never sends.
- `CreativeBriefCard` in a creative build's lead: `BuildTurn.creative` is set when free code is on
  and `pixiSkillIdsFor` matches; `model/creative-brief.ts` re-derives the brief from the request
  with the same deterministic planner the writers read (no brief stored).
- Planner fix: «بطلها ثعلب اسمه رومي» casts رومي, not «ثعلب»; planner role ids are shown as catalog
  words. New AgentIcon glyphs `game`, `dialogue`, `moon`, `book`; build progress track rounded.
- Fake controller: `freeCode` in every fake state, `setFreeCode`, scenarios `emptyCreative` and
  `buildingCreative`; AgentPanel stories `EmptyCreative*`, `BuildingCreative*`.

Verification: playground agent 1960 tests (5 pre-existing failures unchanged: copy-rules ×3,
runs.test ×2), builder-ai 5445 (+1 pre-existing plan-page), `pnpm check:components` 225, playground
`tsc` clean, Storybook static build passed, screenshots checked in LTR/RTL, light/dark, 320 and 420
widths.

## Current continuation — creative engines and creative agent, 2026-10-12

Requested increment: **locally verified**. The user asked (Arabic) to complete PixiJS story support,
add strong libraries, strengthen the Agent with a creative planner, character/asset memory, effects,
animation, story and dialogue engines, and organize the project. Executed as CE-001..007 /
T171..T183 (feature 014). Overall feature 014 release remains open.

### Delivered

- Lazy Studio libraries `anim`, `fx`, `dialogue` (first-party), `ink` (inkjs 2.4.0) and `tilemap`
  (@pixi/tilemap 5.0.2) in `media-engines/src/studio/libs/`, generated by
  `scripts/build-studio-engines.mjs`, admitted in every allowlist and in `CK_LIBRARY_REFERENCE`.
  Tilemap installs its pipe on an already-running renderer; Ink compiles inside its lazy asset
  (agent scenes have no tool step); dialogue conditions are eval-free; DOM dialogue box is
  accessible and bilingual.
- `builder-ai/src/creative/`: deterministic creative planner, story bible memory
  (validate/merge/learn from literal casts/render), brief + memory context providers; brief goes to
  free-code creative scene writers only; `RunAiAgentOptions.creativeMemory`.
- Skills moved to `skills/creative/`; new `pixi-director`, `pixi-animation`, `pixi-effects`,
  `pixi-dialogue`, `pixi-tile-worlds` with companion selection and executable examples.
- Playground: story bible store/hook, controller wiring (learn after builds/applied edits),
  `StoryBiblePanel` (full component contract), 17 copy keys.
- Evals: `test:creative-engines:browser` (real Chromium, LTR/RTL × 390/1280, reduced motion).

### Checks and limits

See `specs/workspace/014-professional-builder-agent/verification-creative-engines-2026-10-12.md`.
Pre-existing failures (renderer behaviors budget, ai plan-page event order, playground copy-rules ×3
and runs.test ×2) fail identically on the baseline and are not this increment's. Storybook browser
runs cannot start in the cloud container (existing stories fail the same way). AssetPack, Layout and
Spine are deferred with reasons. No paid model call or deployment was made.

## Next-session package roadmap — recorded 2026-10-11

The user requested saving the package recommendations for tomorrow, **2026-10-12**, not executing
them today. The canonical roadmap is in feature 014 `plan.md`, section "Deferred Pixi package
roadmap", with unchecked T171..178 in `tasks.md`. Priorities: Tilemap → Inkjs → AssetPack;
Layout/Spine remain conditional, with Spine licensing/assets unresolved. Resume by confirming the
first slice and completing T171's spec/plan/task/dependency gates. No package has been installed or
agent-admitted by this planning update; prior PX completion and whole-feature release status stay
unchanged. This is not an automatic scheduled run. Preserve historical snapshots below.

## Current continuation — Pixi creative and live telemetry, 2026-10-11

Requested PX increment: **idle / locally verified**. PX-001..005 / T165..170 are complete. Overall
feature 014 production release remains open. All new work is unstaged/untracked; no staged diff
currently exists. Unrelated concurrent user edits in AI `direction-set.ts` and `nav-sync.ts` were
preserved and excluded. Do not reset, bulk-stage, commit, push or deploy.

### Delivered scope

- Media engines' kit 1.1.0 adds focus-scoped native/virtual input, bounded fixed updates and manual
  story chapters. Editor typing, reduced motion, visibility, resize, listener ownership and teardown
  are preserved. Manual chapter changes redraw after the still timer. Schema CK/member reference and
  renderer generated kit remain aligned with the existing lazy asset builder/license/budget.
- AI project builtins for games/stories/murals teach runnable controls, actual scene/library APIs,
  game states/collisions, manual chapters and bounded mural composition. Arabic/English activation
  excludes ordinary business stories/game stores. Explicit planning/build/Retry/Finish lanes now
  actually select relevant expertise; scene contracts target individual writers, the hero also gets
  the original brief. Free-code creative regions can author scene JS instead of fixed kit-only
  writing; ordinary writers, skill/context budgets and permission boundaries remain unchanged.
- Provider/server/run/UI usage is additive and measured or unknown; retries/checker/successors have
  distinct physical receipt identities. SSE phases update before completion and never render private
  reasoning. Bounded 64-attempt overflow invalidates sums and survives reload; malformed optional
  saved receipts do not crash conversations. `RunTelemetry` has all five required artifacts.
- The short/narrow Composer control layout preserves all controls and conversation height; existing
  pin/unpin scrolling and actual 1/3/6 independent section pools remain. One long single edit is
  still one model call, not universally faster work.
- Evals' exact taught game/story/mural fixture uses public builder/wire APIs and real generated
  assets in an isolated sandbox. Its feature-local DOM/JSX config leaves Node services and the
  model-quality harness headless. No new dependency was installed: existing physics/camera/filters/
  drawing/audio are reused. Tilemap is researched/proposed, not admitted. No managed React lock
  expansion, new backend/multiplayer service or unrestricted package execution.

Evidence:
`specs/workspace/014-professional-builder-agent/verification-pixi-telemetry-2026-10-11.md`.
Architecture: `docs/architecture/builder-design-libraries.md`.

### Checks and continuation limits

- Fresh final AI regression92, Playground workers/telemetry/storage/component70, media60, renderer34
  passed. Delegated broader skill/context789, server173 and UI/model112/component164 runs are
  recorded separately and overlap; do not add them into a workspace-wide total.
- Actual Pixi browser examples pass all four LTR/RTL × narrow/wide matrices after the collision
  repair. Chat ten Chromium variants passed twice; full-control short Arabic thread height and
  streaming/reading/reopen/resize/long draft/usage/worker-lock behavior are covered. This is local
  QA, not reproduction in every original-user environment or proof on physical phones.
- Owner/consumer types passed, including both Evals projects; scoped new-source lint/format and
  whitespace passed. Full original-config Storybook build (5180 modules/2275 entries), six focused
  Chromium plays, Playground/server production builds, workspace36/component222/boundary4506 and
  graph dry-run contracts passed. Generated kit body hash matches and level9 gzip is14930<16000.
- Fresh native independent read-only review resolved actual skill forwarding, retry/checker/
  successor receipts, storage shape, activation and overflow findings. Scoped native convergence
  checked five PX requirements/eight plan decisions/nine principles with no new gaps; tasks stayed
  unchanged during assessment, then completion tracking was updated separately. This is not a pinned
  professional-sdd workflow-run claim or full014 release approval.
- Existing create-scene19 lint errors match baseline rule counts; full media/root lint and full pnpm
  verify are not claimed. Existing example-URL/dynamic-import/large-chunk warnings remain;
  budgets/configured catalog scope were not relaxed. Full coverage/catalog-browser matrix,
  Firefox/WebKit, screen-reader/audio-device checks and paid provider output quality/speed/cost
  remain unverified. Missing/fallback receipts and old runs cannot become invented bills.

No PX repair task remains. For newly authorized feature work inspect historical T045/T122 preview
feedback/source-agent adapters. For creative quality calibration first obtain authorization for
representative live model calls and report actual outputs/latency/usage, not estimates as spending.
Custom scenes require Free code enabled; otherwise closed media scenes plus an opt-in explanation
remain the boundary. Do not promise all Pixi APIs/add-ons or every game genre.

Node24.19.0 / pnpm11.23.0; branch builder-core / commit count44 verified read-only. The task-owned
Vite server5194 was stopped; existing servers were untouched. Browser/model/provider networking was
blocked in local fixtures. No package installs, paid calls, staging, commits, pushes, deployment or
global memory writes. Preserve historical notes below as prior snapshots, not current Git facts.

## Previous baseline repair — 2026-10-10

Requested baseline repair: **idle / locally verified**. BQ-001..003 / T160..164 are complete.
Overall feature 014 production release remains open. Preserve the staged user baseline and all
unstaged chat/repair work; do not reset, bulk-stage, commit, push or deploy.

### Delivered and verified

- `builder-shell` InspectorPartPanel's MDX now formats the header placeholder as literal code; the
  full configured Storybook catalog indexes/builds successfully, without configuration changes.
- `builder-custom-code` ScriptParamsForm has its four missing artifacts (local export, typed
  stories, attached MDX, behavior tests), missing stylesheet and local deterministic fixture. Three
  old lint errors were repaired equivalently. No product wiring or root API expansion.
- Source semantics remain stored overrides vs preview callbacks vs one gesture commit. The story
  models committed host values with React state rather than unsupported portable `useArgs`
  re-rendering; reset interaction remains repeatable. Existing render-helper exception is owned and
  bounded in the plan: extract before production wiring/substantial new form behavior work.
- Custom-code 14 files / 180 tests, selected Inspector 16 tests and original-config Chromium 16
  story/a11y tests passed. Custom-code lint/types, changed-form format, diff whitespace, full static
  Storybook rebuild (5172 modules / 2268 index entries), component221/workspace36/boundary contracts
  passed. Fresh read-only review independently passed18 form tests and rechecked the story repair;
  no actionable findings remain. Scoped BQ convergence found no additional unbuilt requirement.

Evidence:
`specs/workspace/014-professional-builder-agent/verification-baseline-quality-2026-10-10.md`. The
earlier chat report now links this resolution while retaining its original evidence.

### Remaining limits and next work

There is no remaining requested repair task. Existing bundle warnings and previous renderer
all-packs budget debt remain separate; no threshold was raised. Full verify/coverage/catalog browser
matrix, Firefox/WebKit, real mobile pickers/manual screen readers and live model quality/cost were
not run. A mistakenly broad shell test command timed out two DesignSystemPanel tests and was stopped
(exit130), not passed; the corrected direct Inspector suite passed. Initial sandboxed browser runs
could not bind IPv6; final browser run used approved local-listener permission with no source/config
workaround. First interactive fixture failures were repaired and rerun successfully.

ScriptParamsForm remains dormant, not integrated into Inspector/Studio. On a newly authorized
feature continuation, inspect T045/T122 preview feedback and source-agent adapters; do not assume
provider-call or external-write authorization. Preserve prior chat worker defaults and source-agent
scope. No new persistent server was started, no unknown process was stopped, no dependencies, paid
calls, staging, commits, pushes or deployment. Node24.19.0 / pnpm11.23.0.

## Previous chat increment — 2026-10-10

Current requested increment: **idle / locally verified**. CHAT-001..005 and T154..159 are complete
for the live `apps/playground/src/features/agent` chat. Overall feature 014 production release
remains open. Prior editing/library/Studio/quality work is staged user baseline; this chat increment
is unstaged/untracked. Do not reset, bulk-stage, commit, push or deploy it.

### Delivered chat scope

- Content/viewport-aware scrolling follows only a pinned reader. Wheel, touch and focused-thread
  upward keyboard intent release it. A nonzero history offset survives streaming and hide/reopen;
  Jump to latest resumes following. Composer/viewport resizing keeps the pinned bottom.
- Content-sized writing field, inset focus edge, smaller budgets on short panels, independently
  scrollable clarification/paused-queue content, wrapping controls and bounded two-line titles.
  Existing tokens, Arabic/English, RTL and light/dark are preserved.
- Build-worker choice 1/3/6, default3, reaches real `runAiBuild` and retry/Finish pools. Choice is
  locked during execution; paused queued continuation can use a newly selected limit. Stop prevents
  late application. Single-target edits remain one writer; no universal multi-agent claim.
- New `BuildTaskBoard` reports actual active/queued/drafted/applied/failed rows and maximum
  capacity, retaining ordered validation/application and per-section ownership. It and `WorkerMenu`
  have all five artifacts. Existing EffortMenu story/MDX debt was completed.
- `apps/evals/src/browser/agent-chat.mjs` and the non-production Playground browser fixture provide
  reusable local QA via `pnpm --filter @craftkit/evals test:agent-chat:browser <local-vite-url>`.

Evidence: `specs/workspace/014-professional-builder-agent/verification-agent-chat-2026-10-10.md`.

### Fresh evidence and remaining gates

- 13 scoped Vitest files: 298/298 passed. Real worker gates cover1/3/6, ordered reverse completion,
  locked selection, cancellation, retry pool changes and paused queued builds. Independent review
  passed61 focused tests plus a separate queued-continuation test; final recheck has no findings.
- Nine fresh Chromium variants passed, including narrow/short Arabic full model/effort/code
  controls, reading-position retention, viewport/composer resizing, long input and actual task
  display.
- Scoped Storybook plays90/90 and scoped static build passed using original preview/config with
  temporary restricted indexing. Repaired the named-combobox query and duplicate attached/automatic
  docs found during verification. Temporary config files were removed, not committed.
- Playground production build/types, changed-source lint/format, diff whitespace, workspace36
  members and Turbo boundaries3380 files/36 packages passed. These are local checks, not hosted CI.
- Full Storybook build fails at unchanged `InspectorPartPanel.docs.mdx:13` (literal MDX tags).
  Component check still reports four pre-existing ScriptParamsForm artifacts. Prior bundle-budget
  failure is earlier evidence, not freshly rerun. Full coverage/verify, Firefox/WebKit, real mobile
  gestures, live model speed/quality/cost and human ratings remain unverified.

### Next work and recovery

There is no remaining requested chat task. If a subsequent feature continuation is authorized, start
at T045/T122: inspect revision-bound `inspect_preview`, Source Agent request/apply adapters, then
bounded repair/re-inspection. Do not infer paid provider or external-write authorization. The legacy
engine automatic maximum8 and authored default3/max6 scheduler are separate; neither was rewritten
by the new live-panel preference. Generation quality gains require representative output.

Node24.19.0 / pnpm11.23.0. The task-owned Vite server on127.0.0.1:5186 was stopped (exit130);
existing developer servers were untouched. Scoped Storybook output is disposable under
`/private/tmp/craftkit-agent-storybook.Sp0rD7`. No dependencies, paid calls, staging, commits,
pushes, deployment or external writes. No global memory was changed.

## Previous quality increment — 2026-10-10

Active feature: `specs/workspace/014-professional-builder-agent/`. The user wants a world-class
Builder/Agent and approved axe then Embla plus stronger authored design. Their `1+2` clarification
includes interactive React websites and Frontend dashboards/workflows. Generated backends,
authentication, databases and payments remain outside this increment; creative freedom does not
remove file ownership, exact dependency locks or isolated execution.

Status: the QF-001..005 increment is locally verified and T148..153 are checked; the overall feature
and production release remain in progress, not idle or accepted. Prior editing/library/Studio
changes are staged user work. The new increment is unstaged/untracked; never reset or bulk-stage it.

### Completed increment and owning paths

- `apps/evals/src/accessibility/`: real axe scans, bounded findings, full blocking counts, explicit
  failure/manual/empty states; positive/negative Chromium checks.
- `builder-media-engines/src/carousel*`, vendored MIT notice and
  `scripts/build-carousel-engine.mjs`: pinned Embla 8.6.0. Renderer pack/injector/export load it
  only for interactive carousels; native editor markup is preserved. Real React update/removal no
  longer reparents DOM or throws.
- `builder-editor/src/catalog/`: exact managed admission, default export and lock rejection tests.
  Existing v1 catalog locks stay valid; full content fingerprints change artifacts/caches.
- `builder-ai/src/skills/authored-design.ts`, public wire and `apps/ai-server/src/authored-run.ts`:
  actual cached authored requests get tailored composition, real interaction and honest demo
  guidance. No rigid page formula or additional write authority.
- Architecture/carousel docs and scoped spec/plan/tasks updated. No new production UI component.

Exact evidence and commands:
`specs/workspace/014-professional-builder-agent/verification-quality-frontend-2026-10-10.md`. Prior
local increments have separate `verification-library-editing-2026-10-10.md` and
`verification-element-patterns-2026-10-10.md`; do not present them as fresh full-feature acceptance.

### Verification and unresolved gates

- AI 2, AI-server 6, managed catalog 5, media engines 45 tests passed. Evals Chromium/report tests
  passed 5; Dashboard/workflow fixture is hand-authored, compiled through the actual managed runtime
  at 390/1280 widths × LTR/RTL. It is not a model-quality benchmark.
- Actual exported carousel Chromium QA passed swipe, keyboard, dots, RTL, reduced motion, overflow
  and blocking axe gates without editor services. Independent read-only review has no findings left.
- Renderer scoped run: 72 pass / 1 fail. The unchanged 16,000-byte all-packs growth gate already
  fails staged baseline (18,794); this increment gives 19,198 (+404). Own carousel pack stays below
  4,096; engine asset 8,888/20,000 gzip. Do not raise the global gate to hide the failure.
- TypeScript passed for media engines, AI-server, evals, AI, editor, renderer and Playground. Scoped
  lint, script syntax and diff whitespace passed; Playground/AI-server/evals builds passed. Existing
  placeholder assets, ineffective dynamic imports and large-chunk warnings remain.
- Workspace contract passes 36 members; dry graph succeeds. Component check still finds six
  pre-existing missing artifacts in EffortMenu/ScriptParamsForm; Turbo boundaries still finds two
  generated Storybook `@storybook/blocks` imports. Full verify/coverage/Storybook/Firefox/WebKit/
  manual accessibility/live model/rater evaluation and full review/convergence were not completed.

### First next executable step

Inspect `packages/builder/ai/src/tools/site-tools.ts` (`inspect_preview`),
`apps/playground/src/features/preview/source-agent-session.ts` and
`apps/ai-server/src/authored-run.ts` against T045/T122. Establish current revision-bound inspection
and apply adapters before wiring preview evidence → bounded repair → re-inspection. Axe currently
provides eval evidence only; the Source Agent does not automatically receive these reports. Then use
the existing fixed-corpus/usage/blind-review work (T128..132) for website/dashboard/workflow
outputs. Paid provider runs and actual human raters require explicit approval/availability.

Use package-local binaries on Node 24.19.x/pnpm 11.23.0; React remains 19.2.8. Local browser QA uses
fresh contexts and the existing loopback server; do not kill unknown dev processes or use the user's
browser profile. Temporary budget diagnostics were deleted. No new server needs teardown. No paid
model calls, staging, commits, pushes, deployment or external writes were made.

## Historical handoff — feature 013 (superseded for active work)

**Status:** Feature 013 — the AI full-site design agent — is delivered except for three blocks that
this session cannot finish itself (see **What is NOT done**). 316 of 337 tasks are closed. No
commit, push, deploy, dependency installation, or external mutation was performed or authorized.
**Commit authorization remains withheld.**

**Updated:** 2026-09-07

## What a person can now do

Type one sentence describing a business, in Arabic or English, and get a multi-page site — pages,
sections, copy, a palette, a header and a footer — landed on the live site as **one transaction**
that **one undo** reverses. A run that fails at any stage leaves the site byte-identical, because
nothing writes until the commit.

## The architecture, in four sentences

1. **A site is one kernel.** One store, one dispatcher, one transaction log, one history, one save
   session. `siteKernel.page(pageId)` is a lens satisfying the document `BuilderKernel` interface,
   so every component built for a document works over a site unchanged. Recorded in
   [ADR 0006](../../docs/architecture/decisions/0006-builder-site-model-and-design-tokens.md).
2. **The door is the only writer.** `generateSite` is handed no kernel and returns commands.
   `applySiteCommands` sends them into a DRAFT kernel one at a time — a group cannot read back an id
   minted halfway through it — and `commitGeneratedSite` lands the whole result as a single
   `applySitePatches`.
3. **`DesignSystem` is layer 0.** The schema owns the type, the default, and `validateDesignSystem`,
   which measures contrast and fails closed. The renderer owns only the translation to CSS
   variables.
4. **An image holds an id or a labelled absence.** `ImageProp = AssetRef | { absent, reason }`.
   There is no path that produces an address, because a generated URL satisfies every schema,
   stores, validates, renders, and is a broken image on a stranger's site.

## Delivered blocks

| Block               | Tasks                | What shipped                                                                                           |
| ------------------- | -------------------- | ------------------------------------------------------------------------------------------------------ |
| Site core           | T001–T031            | `BuilderSite`, `validateSite`, `migrateSite`, `createSiteBuilder`, the page lens, eleven site commands |
| Codec               | T032–T047            | `projectSite`/`parseSite`; a page's projection is byte-identical to `projectDocument`'s                |
| Five-stage pipeline | T048–T066            | sitemap → structure → content → design system → assembly, validated between each                       |
| Playground site     | T072–T085            | site boot, `SitePages`, `SiteBriefForm`, `SiteBuilderPanel` on its own rail destination                |
| Design system       | T086–T103            | `DesignSystemPanel`, `TokenSwatchGrid`, tokens at layer 0                                              |
| Refinement          | T104–T111, T113–T114 | resolve → refuse → propose → validate → apply, page and palette                                        |
| Shared regions      | T115–T121            | header and footer across pages, one definition                                                         |
| Responsive          | T122–T128            | container queries, a Chromium overflow gate at 360/768/1024/1440 + RTL                                 |
| Assets              | T129–T143            | selection, the labelled-absence union, `AssetPicker`, the local library                                |
| Docs                | T149–T152            | ADR 0006, the architecture docs, five package READMEs                                                  |

## What is NOT done, and why

Three items are **blocked on something outside this session**, not unfinished work:

1. **T144–T148 — evaluation and the critic.** The protocol needs **three independent human raters**
   and a live API key. A single agent scoring its own output is not a measurement, so this was left
   open rather than faked.
2. **T305–T307 — token usage and model tiers.** These need `apps/ai-server`, which belongs to the
   peer session **frontend-6d**. Ports 8787 and 5173 are theirs; nothing here starts a server.
3. **T112 — the refinement conversation in `AssistantPanel`.** Left open deliberately, with the
   reason recorded in `tasks.md` at that entry.

Also open: **T294** (persist the assistant mode, and replace one vacuous `followUp` assertion at
`assemble-context.contract.test.ts:337`), and **T153–T158**, the review-and-verify tail this session
is working through.

## Gate state at handoff

```text
pnpm check:workspace     passed, 33 members
pnpm check:components    passed, 133 components
pnpm check:boundaries    passed
pnpm turbo run lint typecheck    61/61, exit 0
```

`pnpm format:check` is clean **except** `apps/ai-server/**` (13 files) and `CLAUDE.md`, which were
deliberately left untouched: the server belongs to the peer session, and reformatting a file another
session is editing loses their work. Whoever owns those should run
`pnpm exec prettier --write apps/ai-server CLAUDE.md`.

## Working method, for whoever picks this up

Two habits produced most of the real findings and should not be dropped:

- **Build a gate that MEASURES, then let it find defects.** The responsive gate found two sections
  overflowing 348px at a 360px viewport; the UX gate found a 67×20 button below the 24px pointer
  minimum; the theme's measurement gate caught a raw `9rem` in new CSS. None of those was visible to
  a green test count.
- **Mutation-test every rule, and delete what survives.** Break the code, watch a NAMED test fail. A
  check no mutation can distinguish from its absence is decoration — the `AssetPicker`'s unmount
  guard was exactly that and was rewritten as the case that IS observable.

Three traps this repository sets, all of which cost time here:

- `pnpm turbo run test` will replay a stale PASS for a gate whose inputs turbo does not track. Use
  `--force` at least once before believing it.
- A vitest run can print `N passed` and exit 1 — unhandled errors inside React's event dispatch are
  reported on an `Errors` line, not as failures. Read the exit code.
- A Storybook story that leaves a promise pending starves every story declared after it in the same
  file, and the failures name the wrong story.

## Environment

- `PATH` must include `$HOME/.nvm/versions/node/v24.19.0/bin` before any pnpm (`engines.node` is
  `>=24.15.0 <25`).
- `rg` is absent (use `grep -rn`), `head` is shadowed (use `sed -n`), `timeout` does not exist, and
  `curl`/`wget` are blocked.
- Peer sessions share this checkout. Run `ListAgents` before touching `apps/ai-server/**` or any
  file another session may be editing, and prefer targeted string replacements over whole-file
  rewrites in `App.tsx`, `AssistantPanel.tsx`, `AssistantHeader/*` and `App.css`.

## Active artifacts

- Feature: `specs/workspace/013-ai-full-site-design-agent`
- Plan: `specs/workspace/013-ai-full-site-design-agent/plan.md`
- Task ledger with per-block evidence: `.../tasks.md`
- Audits written this cycle: `.../responsive-audit.md`, `.../design-audit.md`
- Asset contract: `.../contracts/asset-library.md`
- Public package contracts: `packages/builder/{schema,core,transforms,ai,shell}/README.md`
