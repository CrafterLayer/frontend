# First Build on an Empty Page: Research Report
*Generated: 2026-11-05 | Sources: ~35 (7 OSS repos read in code/PRs, 10 products' docs, 4 UX studies) | Confidence: Medium*

## Executive Summary
No serious builder leaves the page blank until the end. Two patterns dominate:
- **Developer builders** stream the code first and show the preview per finished file or at the end. bolt.diy, open-lovable, llamacoder and dyad do this. Where the output is plain HTML, the partial page streams live into the preview: screenshot-to-code throttles it to 200 ms, and openui does it too.
- **Website builders** put a short, always-skippable step before building, and restyle after building. Wix, Durable, 10Web and Hostinger ask a few questions or offer chips. Webflow and Relume show an editable page/section outline. Webflow, Wix and Hostinger offer theme and colour shuffles afterwards.

Recovery is per-turn versions everywhere. Only dyad (an "[Interrupted]" commit) and llamacoder (completed code fences survive an abort) keep partial work on purpose.

UX research puts builds longer than 10 s in the band where **real progress** beats a spinner or an empty skeleton.

CraftKit already streams a provisional skeleton and starts the writers early, which is further than most. What remains:
- a blank gap before the outline arrives;
- title-only placeholders;
- a gate that holds every finished section until the whole plan validates;
- no run journal for page builds.

## 1. What builders show during the first build
- **screenshot-to-code** (code): `iframe.srcdoc` updated from `useThrottle(code, 200)`, so the page grows live; four variants are pre-sized "to avoid a flash". A cancelled *first* build resets to blank. [App.tsx](https://github.com/abi/screenshot-to-code/blob/main/frontend/src/App.tsx)
- **bolt.diy** (code): files stream into the code view, debounced 100 ms; each closed file is written and the dev server reloads. The chat's action list is a live checklist. [workbench.ts](https://github.com/stackblitz-labs/bolt.diy)
- **open-lovable** (code): a file tree with streaming code, a stage list ("Analyzing / Installing / Applying"), and a screenshot under a "Generating code…" overlay until it is applied. [firecrawl/open-lovable](https://github.com/firecrawl/open-lovable)
- **llamacoder** (code): the code tab while streaming, the preview at the end. [Nutlope/llamacoder](https://github.com/Nutlope/llamacoder)
- **dyad** (PRs): a "Writing…" card per file in chat. [PR #3431](https://github.com/dyad-sh/dyad/pull/3431)
- **Framer AI**: a "Created a design plan" step listing the sections, then the build in 30–60 s. [framer.com/ai](https://www.framer.com/ai/)
- **Durable**: claimed to build "section by section… rather than wait for a loading screen". This is a weak, competitor source. [butternut.ai](https://www.butternut.ai/blogs/gamma-vs-durable-vs-butternut-ai)

## 2. Questions and choices before building
- 9 of 10 products ask something first, and it is always skippable or minimal:
  - Wix offers Answer, "Help me answer", Skip, or "End chat & continue". [Wix](https://support.wix.com/en/article/wix-editor-creating-an-ai-generated-site)
  - Durable asks 3 questions.
  - Hostinger shows chips "to avoid starting with a blank page".
  - v0, Lovable and bolt offer an opt-in Plan mode with Approve/Skip. [Lovable](https://docs.lovable.dev/features/plan-mode) · [bolt](https://support.bolt.new/prompting/plan-mode)
- In open source, only 2 of 7 ask:
  - dyad's questionnaire asks up to 5 questions, and only when the request is ambiguous. [PR #4247](https://github.com/dyad-sh/dyad/pull/4247)
  - bolt.diy has a discuss mode with buttons. [PR #1735](https://github.com/stackblitz-labs/bolt.diy/pull/1735)
- Outline-first builders:
  - **Relume** builds a sitemap, then wireframes, then a style guide; the user edits section names and descriptions before generation. [Relume](https://www.relume.ai/resources/docs/building-a-sitemap-with-ai)
  - **Webflow** proposes a page/section structure the user refines before "Generate site". [Webflow](https://help.webflow.com/hc/en-us/articles/38840145286035)
- Style choices mostly come **after** generation: Webflow's theme picker, Wix's "Shuffle colors/layout", Hostinger's palette, and Framer, which picks for the user.

## 3. Crash and partial-build recovery
- **Versions per turn** (most common):
  - v0 versions with restore. [v0](https://v0.app/docs/versions)
  - Lovable's automatic versions plus "Try to fix". [Lovable history](https://docs.lovable.dev/features/projects/history)
  - bolt.diy's IndexedDB snapshots, taken only after a turn completes.
  - screenshot-to-code's commit tree.
- **Partial work kept on purpose**:
  - dyad records why each turn ended and commits the partial tree as "[Interrupted]". [PR #4312](https://github.com/dyad-sh/dyad/pull/4312)
  - llamacoder keeps completed fences and drops the unfinished one.
- No product documents keeping partial work after an interruption.

## 4. Perceived performance
- **NN/g** says to use skeletons for full-page loads under 10 s, and a progress bar or explicit progress over 10 s. Skeletons are no substitute for speed. [NN/g](https://www.nngroup.com/articles/skeleton-screens/)
- **Evidence is mixed on skeletons vs spinners**:
  - Mejtoft et al. 2018 found a small, non-significant gain. [ACM](https://dl.acm.org/doi/10.1145/3232078.3232086)
  - Viget 2017 found skeletons were perceived as the slowest.
  - A 2025 mobile study (N=90) found progressive loading reduces temporal cognitive load. [ResearchGate](https://www.researchgate.net/publication/392741648_Design_Strategies_for_Mobile_Click-and-Load_Waiting_Scenarios)
- **Inference**: an AI build takes 30 s to several minutes, so it should show *real* progress (named sections appearing and finished content landing). A spinner or a permanent skeleton does not count.

## 5. CraftKit today (code-traced, 2026-11-05)
- **Auto mode, clear request**: no choice step. Clarify chips appear only for low-confidence or unsure requests (`send.ts:331-361`, `ClarifyPanel`).
- **Streamed path**: the page plan streams. When the outline closes, a provisional skeleton lands (`run-build.ts:3433-3440`) and writers start while the planner still writes (`:3475`).
- **Gaps**:
  1. Before the outline closes, the canvas shows only the empty-state card.
  2. Placeholders are title-only `<section>`s (`skeleton-from-plan.ts:974`), so the page still reads as near-blank.
  3. Finished sections wait at a gate until the *whole* final plan validates (`run-build.ts:1835`, `:3746`).
  4. `features/vault/run-journal.ts` and `InterruptedCard` are not wired to page builds. "Finish the rest" (`successor-flow.ts`) is wired.

## Key Takeaways
- Never wait for the end: land each finished section as soon as it is valid, and show *named, shaped* placeholders until then.
- Ask before building only when the request is vague (keep it to 1–3 skippable chips), and offer restyle choices *after* the first build.
- Make every landed section durable, and record why a run stopped, so a reload resumes instead of starting over.

## Methodology
Three parallel research agents (open-source code, product docs and UX evidence, the CraftKit code path) ran about 50 searches and scrapes. Not verified: what v0, Lovable and Framer actually show mid-generation, because no live session was possible since browser MCPs were down.
