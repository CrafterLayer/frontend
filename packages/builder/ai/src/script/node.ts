/**
 * `@craftkit/builder-ai/script-node`: the Node script runner (worker_threads),
 * kept off the main entry so browser bundles never see `node:worker_threads`.
 */

export {
  createNodeScriptRunner,
  DEFAULT_WORKER_RESOURCE_LIMITS,
  type NodeScriptRunnerOptions,
} from './runner-node';
