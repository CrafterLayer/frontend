# Professional authored page generation: research

Generated 2026-10-20. Scope: varied designs across page types, explicit design skills, free
composition and reliable continuation. Six official GitHub repositories compared; 15 principal
source documents, plus license files. Sources describe mechanisms, not a benchmark establishing that
one product produces better designs.

## Findings and implementation direction

The useful common mechanism is a concrete design brief carried into source generation, then checked
against the rendered result. Merely naming a skill or installing a UI package does not establish
that path. This is an engineering inference from the sources below; CraftKit's local audit and tests
determine which changes actually apply.

1. **Skill selection must lead to usable design evidence.** UI UX Pro Max calls a local
   design-system search for new pages, combines product/style/color/type/layout evidence, and
   requires checking whether the returned matches fit. Empty results must be declared fallback. Its
   Python implementation offers bounded output and a machine-readable format. [Skill][1], [search
   implementation][2]
2. **Differentiate structure before writing code.** Current Anthropic frontend-design asks for a
   subject-specific palette, typography and layout plan, then reviews it against generic defaults
   before implementation. Explicit user choices win. Screenshot critique is recommended when the
   environment supports it. This supports a compact design artifact rather than another fixed
   section recipe. [Frontend design][5]
3. **Free source composition needs an explicit application contract.** Bolt generates complete
   source artifacts in dependency order. Its current raw prompt accepts an underscore-prefixed
   designScheme argument but does not serialize it; older indexed snippets showed different code.
   Use the source-first mechanism as a reference, not a claim that current Bolt proves structured
   design-scheme injection. [Prompt][6]
4. **Preserve design and target identity across edits.** Dyad's blueprint includes design direction,
   primary color and assets, and its instructions preserve fields not being revised. Small edits use
   targeted replacement. Its prompt construction passes themes into supported modes. Open Lovable
   distinguishes creation from edits and retrieves the relevant existing files; screenshot-to-code
   builds an update from the selected previous version. [Dyad agent][8], [prompt construction][9],
   [generation][12], [editor][15]
5. **References should produce concrete evidence.** Open Lovable extracts branding into structured
   guidelines. This is a possible later pattern for user-supplied references, not a reason to add
   crawling or copy assets for the current repair. [Brand extraction][11]
6. **Render evaluation is separate from prompt-contract tests.** Screenshot-to-code documents a
   16-screenshot corpus, rating UI and repeated model/prompt/stack runs. That supports measuring
   variation and visual quality over multiple outputs, not treating a successful local fixture as
   evidence of provider artistry. [Evaluation][14]

## Decisions for this increment

- Repair explicit skill aliases and preserve selected expertise through planning, writing,
  Retry/Finish and continuation. Report implemented skill activation accurately; no claim that an
  upstream Python skill ran unless it actually did.
- Default new designs of every kind to authored composition. Carry bounded design intent and section
  geometry; permit one complete authored region. Kits remain optional for requested reuse or where
  deliberately chosen, with no mandatory landing-page sequence.
- Preserve supplied content and explicit aesthetics. CVs need truthful personal facts, readable
  chronology and print behavior; portfolios organize project evidence. These are proposed acceptance
  criteria, not capabilities proven in every researched repository.
- Use existing admitted semantic trees, scoped CSS, runtime libraries and permissioned JavaScript.
  No new dependency is justified solely by the quality complaint.
- Check actual renderer output at desktop/mobile/RTL and visible follow-up edits. Record
  structure/type/density differences, not just palette differences. Live quality, speed and cost
  improvements remain unproven without repeated provider evaluation.

## Package and licensing observations

The inspected Pro Max CLI manifest declares version **2.5.0**, not independently verified as the
latest npm release; it includes relevance and data-verification scripts. Its skill says Python
search needs no external dependencies. The repository is MIT. Anthropic's frontend-design skill
carries Apache-2.0. Dyad distinguishes Apache-2.0 code from fair-source `src/pro`. No upstream code
or data was copied or installed in this increment. [CLI manifest][3], [Pro Max license][16],
[Anthropic license][17], [Dyad README][10]

## Caveats

- Source inspection was access-date based on current `main`; GitHub commit API endpoints were
  unavailable through the research tool, so no commit-pinned provenance is claimed.
- Indexed copies of Anthropic and Bolt differed from their raw current files. Current raw sources
  were preferred; no old hard ban on individual fonts was imported.
- Open Lovable's first-generation prompt still requires header/hero/features/footer, and some edit
  records assume success after generation. Those mechanisms should not be copied for arbitrary
  documents or used as proof that output was applied. [Generation][12]
- Repo popularity, screenshots and maintainer marketing do not establish quality or speed.
- Confidence is high for inspected source mechanisms, medium for design-quality benefits inferred
  from them, and unproven for provider quality, latency or billing improvements.

## Methodology

Used the explicitly requested `ecc:deep-research` workflow. No Exa/Firecrawl tool was configured;
the available web tool was used. Twelve search queries covered four questions:

1. How do design skills become actionable guidance, explicitly and automatically?
2. How do builders choose distinctive design direction instead of recurring templates?
3. How do free source composition, references and later edits preserve project identity?
4. How is generated visual quality verified rather than inferred from successful code?

Query variations targeted Pro Max search/design systems; Anthropic frontend-design and critique;
Dyad prompts/themes/screenshots; Bolt prompts/artifacts; Open Lovable generation, branding and
screenshots; and screenshot-to-code evaluation. Only official source material was used in
conclusions. Four short key sources were read fully: Pro Max skill, Anthropic frontend-design,
current Bolt prompt and Open Lovable branding endpoint. Longer implementation files were inspected
at relevant regions. No provider calls or external mutations occurred.

## Principal sources

1. [Pro Max skill][1] — retrieval, fit verification and persistence rules.
2. [Pro Max search][2] — JSON output, bounded matches and design controls.
3. [Pro Max CLI manifest][3] — inspected version and data/relevance verification scripts.
4. [Pro Max README][4] — toolkit overview and examples, not independent benchmarks.
5. [Anthropic frontend-design][5] — subject grounding, plan review and visual critique.
6. [Bolt prompt][6] — complete source artifacts and current design instructions.
7. [Bolt repository][7] — project identity and runtime context.
8. [Dyad local-agent prompt][8] — blueprint persistence and targeted edits.
9. [Dyad prompt construction][9] — theme forwarding by mode.
10. [Dyad README][10] — local builder scope and licensing boundaries.
11. [Open Lovable branding endpoint][11] — structured reference-derived guidelines.
12. [Open Lovable generation][12] — create/edit context and limitations.
13. [Open Lovable repository][13] — project scope and sandbox dependencies.
14. [Screenshot-to-code evaluation][14] — repeated rendered-output evaluation.
15. [Screenshot-to-code editor][15] — prior-version-aware continuation.

[1]:
  https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/.claude/skills/ui-ux-pro-max/SKILL.md
[2]:
  https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/src/ui-ux-pro-max/scripts/search.py
[3]: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/cli/package.json
[4]: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/README.md
[5]: https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md
[6]: https://github.com/stackblitz-labs/bolt.diy/blob/main/app/lib/common/prompts/prompts.ts
[7]: https://github.com/stackblitz-labs/bolt.diy
[8]: https://github.com/dyad-sh/dyad/blob/main/src/prompts/local_agent_prompt.ts
[9]: https://github.com/dyad-sh/dyad/blob/main/src/prompts/system_prompt.ts
[10]: https://github.com/dyad-sh/dyad/blob/main/README.md
[11]: https://github.com/firecrawl/open-lovable/blob/main/app/api/extract-brand-styles/route.ts
[12]: https://github.com/firecrawl/open-lovable/blob/main/app/api/generate-ai-code-stream/route.ts
[13]: https://github.com/firecrawl/open-lovable
[14]: https://github.com/abi/screenshot-to-code/blob/main/Evaluation.md
[15]: https://github.com/abi/screenshot-to-code/blob/main/frontend/src/App.tsx
[16]: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/LICENSE
[17]: https://github.com/anthropics/skills/blob/main/skills/frontend-design/LICENSE.txt
