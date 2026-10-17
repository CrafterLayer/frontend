# Baseline component/catalog repairs — 2026-10-10

Scope: BQ-001..003 / T160..164. `builder-shell` owns the InspectorPartPanel documentation fix;
`builder-custom-code` owns the existing ScriptParamsForm artifacts and stylesheet. The shared
Storybook configuration and all its indexing/a11y gates are unchanged. Prior staged features and
unstaged chat work were preserved. No dependencies, root API expansion, product wiring, staging,
commits, pushes, deployment or paid/provider calls.

## Reproduced failures and repairs

- `pnpm check:components` failed with exactly four missing ScriptParamsForm artifacts: local export,
  typed story, attached MDX and behavior test. All now exist, alongside a deterministic local
  fixture. The implementation already imported `ScriptParamsForm.css`, but that file was absent; the
  missing chrome-token, logical-property stylesheet was supplied.
- Full `pnpm --filter @craftkit/storybook build-storybook` failed at
  `InspectorPartPanel.docs.mdx:13`: `<part label> · <block name>` was parsed as unclosed MDX tags.
  Inline-code formatting fixes the literal without changing the catalog scope or component logic.
- The existing form source had three lint errors: computed-key `delete`, a suppression referring to
  an uninstalled React lint rule, and an unnecessary group assertion. Equivalent immutable
  filtering, removal of the invalid suppression and the inferred group type repair them.
- The first Chromium run reached the stories but failed two new interactive fixtures: `useArgs` did
  not re-render committed values in portable tests. The story now models the committed host with
  React state; preview callbacks do not update stored props. Changed-story reset also works on
  repeated Interactions runs. Production form behavior was not rewritten.

## Fresh passed checks

```sh
pnpm --filter @craftkit/builder-custom-code test
# 14 files, 180/180 tests; includes 18 ScriptParamsForm tests.

pnpm --filter @craftkit/builder-custom-code lint
pnpm --filter @craftkit/builder-custom-code typecheck

# cwd: packages/builder/shell; direct executable keeps the filter effective
node_modules/.bin/vitest run --config vitest.config.ts \
  src/components/Inspector/InspectorPartPanel.test.tsx --maxWorkers=2
# One file, 16/16 tests.

# cwd: root; unchanged full Storybook configuration, only tests filtered
pnpm --filter @craftkit/storybook exec vitest run --config vitest.config.ts \
  ../../packages/builder/extensions/custom-code/src/ScriptParamsForm/ScriptParamsForm.stories.tsx \
  ../../packages/builder/shell/src/components/Inspector/InspectorPartPanel.stories.tsx
# Two files, 16/16 Chromium story/a11y tests (nine form + seven Inspector).

pnpm --filter @craftkit/storybook build-storybook
pnpm check:components
# All 221 component contracts pass.
pnpm check:workspace
# All 36 workspace members pass.
pnpm check:boundaries
# 4486 files / 36 packages, no issues; includes generated full Storybook output.
node_modules/.bin/prettier --check packages/builder/extensions/custom-code/src/ScriptParamsForm
git diff --check
```

The full static catalog build passed again after the final story-state repair (exit 0, 5172
modules). Its index contains 2268 entries, including nine form stories, seven Inspector stories and
both attached documentation pages. No temporary catalog or reduced indexing configuration was used.

Coverage includes default/stored overrides, preview vs one gesture commit, Enter/blur/native range
and colour change, pointer and keyboard release, reset, unchanged drafts, numeric clamp/unknown-key
filtering, segmented/dropdown choices, custom palette add/remove/limit/theme, images/host picker
cancellation, free/known/legacy sound references, empty, disabled and Arabic labels/help/direction.
Stories also include the narrow 288px wrapper and dark chrome. No live script/provider execution.

## Independent review and scoped convergence

A fresh read-only reviewer inspected the real files and diff, reran the 18 form tests independently
(18/18 passed), then rechecked the final story-state repair. No actionable findings remain. No
recursive delegation, edits or broad check duplication. Direct review skill, not a model-pinned
professional-sdd release process.

The three BQ requirements, the owner/API/dependency decisions and component/verification gates are
checked within this increment. Existing dormant render helpers are explicitly bounded by the plan
exception: extract before new production wiring/substantial behavior work. No new production
component was added. Whole feature 014 convergence and release remain open, not certified by this
repair. No unbuilt BQ requirement needs another implementation task.

## Attempts not counted as passes and remaining limits

- Initial browser attempts were blocked by sandbox `listen EPERM ::1:63315`. The CLI host override
  did not change that listener. The final browser command ran with approved local-listener
  permission; no source/configuration gate was weakened or production service contacted.
- `pnpm --filter @craftkit/builder-shell test -- <file>` did not constrain the suite as intended.
  The broad run produced two DesignSystemPanel test timeouts under contention and was stopped (exit
  130). It is not a passing/full-suite result. The effective direct Inspector run above passed; the
  full shell suite needs a separately scoped, controlled run before release.
- The earlier chat report's Inspector/component blockers are resolved by this increment. Existing
  large-chunk, placeholder-asset and plugin timing warnings remain. Previous renderer all-packs
  budget debt was not rerun or hidden by raising its threshold.
- Full `pnpm verify`, coverage, all 2268 catalog entries' browser tests, Firefox/WebKit, real mobile
  colour pickers and manual screen-reader review were not run. ScriptParamsForm remains dormant;
  this repair does not claim it is wired into Inspector/Studio. Picker error handling and live scene
  preview integration remain host responsibilities documented in its MDX.

Final status: all required BQ repair checks passed, including the final full static Storybook build.
The broader release/verification limits above remain open.
