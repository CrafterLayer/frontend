/**
 * A deterministic AgentController for stories and component tests (SPEC §7.2, WP-11/16):
 * every §3 frame as an `AgentViewState`, in both locales, with no engine, no kernel and no
 * clock of its own.
 *
 * Three doors, from static to live:
 * - `fakeViewState(scenario, locale)`: the view of one SPEC §3 state (and the Improve and
 *   clarify states the owner asked for), built from the SPEC's own example page (the
 *   dental clinic of §3.4). Pure: the same scenario is the same object shape every time.
 * - `createFakeController(state)`: that view behind every AgentController action. Each
 *   call is recorded in `calls` (action name and arguments) and changes nothing, so a
 *   component test asserts "Retry called `retrySections(turn, [key])`" without a spy
 *   library, and a story renders exactly the state it names.
 * - `useFakeController(scenario)`: the same, as a React hook whose actions move the state
 *   the way the real controller would for the parts a story can show on its own: typing,
 *   chips, mentions, the mode and model menus, the queue, Improve and Restore, the
 *   clarifying questions, Apply / Discard, Build, row Undo / Redo, Stop.
 *
 * Nothing here imports the engine or vitest: stories load it in the browser.
 *
 * Times: every live `RunBarView.startedAt` is `now - elapsed`, with `now` from the options
 * (default `FAKE_NOW`, a fixed instant, so tests are deterministic). A story that shows a
 * ticking RunClock passes `{ now: Date.now() }`.
 *
 * This file is the public entry; the code lives in `./fake/` (scenarios, words, view
 * builders, the per-family `fakeViewState` switch, the static controller and the hook).
 */
export {
  FAKE_CAPABILITIES,
  FAKE_NOW,
  FAKE_SCENARIOS,
  type FakeScenario,
  type FakeViewOptions,
} from './fake/scenarios';
export { fakeViewState } from './fake/view-state';
export {
  createFakeController,
  type FakeAction,
  type FakeCall,
  type FakeController,
  type FakeControllerOptions,
} from './fake/controller';
export { useFakeController } from './fake/use-fake-controller';
