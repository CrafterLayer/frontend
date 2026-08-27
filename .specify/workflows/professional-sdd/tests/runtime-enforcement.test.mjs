import assert from "node:assert/strict";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const scriptsDirectory = resolve(testDirectory, "../scripts");
const delegationScript = join(scriptsDirectory, "delegation-result.mjs");
const reviewScript = join(scriptsDirectory, "run-codex-review.mjs");
const runId = "runtime-test";

function createProject(mode = "required") {
  const root = mkdtempSync(join(tmpdir(), "craftkit-workflow-test-"));
  const runDirectory = join(root, ".specify/workflows/runs", runId);
  const featureDirectory = join(root, "specs/workspace/001-test-feature");
  mkdirSync(runDirectory, { recursive: true });
  mkdirSync(featureDirectory, { recursive: true });
  for (const artifact of ["spec.md", "plan.md", "tasks.md"]) {
    writeFileSync(join(featureDirectory, artifact), `# ${artifact}\n`, "utf8");
  }
  writeFileSync(
    join(runDirectory, "inputs.json"),
    `${JSON.stringify(
      {
        inputs: {
          delegation_mode: mode,
          feature_directory: "specs/workspace/001-test-feature",
          scope: "workspace",
          review_model: "gpt-5.6-terra",
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  return { root, runDirectory };
}

function runNode(script, args, root, env = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

function writeDelegation(runDirectory, mode, overrides = {}) {
  const result = {
    schemaVersion: 1,
    runId,
    mode,
    status: "delegated",
    transport: "test-transport",
    delegatedTaskCount: 1,
    acceptedResultCount: 1,
    reason: "",
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
  writeFileSync(
    join(runDirectory, "delegation.json"),
    `${JSON.stringify(result, null, 2)}\n`,
    "utf8",
  );
}

test("required delegation fails closed for pending and unavailable results", () => {
  const { root, runDirectory } = createProject("required");
  assert.equal(runNode(delegationScript, ["prepare", runId], root).status, 0);
  assert.equal(runNode(delegationScript, ["verify", runId], root).status, 1);

  writeDelegation(runDirectory, "required", {
    status: "unavailable",
    transport: null,
    delegatedTaskCount: 0,
    acceptedResultCount: 0,
    reason: "test transport unavailable",
  });
  assert.equal(runNode(delegationScript, ["verify", runId], root).status, 1);
});

test("required delegation accepts only a delegated and accepted result", () => {
  const { root, runDirectory } = createProject("required");
  writeDelegation(runDirectory, "required");
  assert.equal(runNode(delegationScript, ["verify", runId], root).status, 0);

  writeDelegation(runDirectory, "required", { acceptedResultCount: 0 });
  assert.equal(runNode(delegationScript, ["verify", runId], root).status, 1);

  writeFileSync(join(runDirectory, "delegation.json"), "{not-json\n", "utf8");
  assert.equal(runNode(delegationScript, ["verify", runId], root).status, 1);
});

test("auto unavailable and off disabled are explicit accepted outcomes", () => {
  const autoProject = createProject("auto");
  writeDelegation(autoProject.runDirectory, "auto", {
    status: "unavailable",
    transport: null,
    delegatedTaskCount: 0,
    acceptedResultCount: 0,
    reason: "test transport unavailable",
  });
  assert.equal(
    runNode(delegationScript, ["verify", runId], autoProject.root).status,
    0,
  );

  const offProject = createProject("off");
  writeDelegation(offProject.runDirectory, "off", {
    status: "disabled",
    transport: null,
    delegatedTaskCount: 0,
    acceptedResultCount: 0,
    reason: "delegation disabled",
  });
  assert.equal(runNode(delegationScript, ["verify", runId], offProject.root).status, 0);
});

function createFakeCodex(root) {
  const executable = join(root, "fake-codex.mjs");
  writeFileSync(
    executable,
    `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
const args = process.argv.slice(2);
writeFileSync(process.env.FAKE_CODEX_ARGS, JSON.stringify(args), "utf8");
const outputIndex = args.indexOf("--output-last-message");
if (process.env.FAKE_CODEX_MODE === "write") {
  writeFileSync(args[outputIndex + 1], "No findings from test reviewer.\\n", "utf8");
}
if (process.env.FAKE_CODEX_MODE === "hang") {
  await new Promise((resolve) => setTimeout(resolve, 10_000));
}
process.exit(process.env.FAKE_CODEX_MODE === "fail" ? 7 : 0);
`,
    { encoding: "utf8", mode: 0o700 },
  );
  chmodSync(executable, 0o700);
  return executable;
}

test("review launcher enforces Codex runtime flags and writes fresh evidence", () => {
  const { root, runDirectory } = createProject();
  const executable = createFakeCodex(root);
  const argsPath = join(root, "codex-args.json");
  const result = runNode(reviewScript, [runId, "implementation"], root, {
    SPECKIT_INTEGRATION_CODEX_EXECUTABLE: executable,
    FAKE_CODEX_ARGS: argsPath,
    FAKE_CODEX_MODE: "write",
  });
  assert.equal(result.status, 0, result.stderr);

  const args = JSON.parse(readFileSync(argsPath, "utf8"));
  assert.deepEqual(args.slice(0, 6), [
    "--sandbox",
    "read-only",
    "--ask-for-approval",
    "never",
    "--cd",
    realpathSync(root),
  ]);
  assert.ok(args.includes("exec"));
  assert.ok(args.includes("--ephemeral"));
  assert.equal(args[args.indexOf("--model") + 1], "gpt-5.6-terra");

  const evidence = join(runDirectory, "evidence/implementation-review.md");
  assert.equal(readFileSync(evidence, "utf8"), "No findings from test reviewer.\n");
  const metadata = JSON.parse(
    readFileSync(join(runDirectory, "evidence/implementation-review.json"), "utf8"),
  );
  assert.equal(metadata.sandbox, "read-only");
  assert.equal(metadata.approvalPolicy, "never");
  assert.equal(metadata.ephemeral, true);
});

test("review launcher rejects exit zero without fresh evidence", () => {
  const { root, runDirectory } = createProject();
  const executable = createFakeCodex(root);
  const evidenceDirectory = join(runDirectory, "evidence");
  mkdirSync(evidenceDirectory, { recursive: true });
  const evidence = join(evidenceDirectory, "implementation-review.md");
  writeFileSync(evidence, "stale review must not pass\n", "utf8");

  const result = runNode(reviewScript, [runId, "implementation"], root, {
    SPECKIT_INTEGRATION_CODEX_EXECUTABLE: executable,
    FAKE_CODEX_ARGS: join(root, "codex-args.json"),
    FAKE_CODEX_MODE: "empty",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /without non-empty review evidence/);
  assert.equal(readFileSync(evidence, "utf8"), "stale review must not pass\n");
});

test("review launcher terminates a hung Codex process before the workflow timeout", () => {
  const { root } = createProject();
  const executable = createFakeCodex(root);
  const startedAt = Date.now();
  const result = runNode(reviewScript, [runId, "implementation"], root, {
    SPECKIT_INTEGRATION_CODEX_EXECUTABLE: executable,
    SPECKIT_CODEX_REVIEW_TIMEOUT_MS: "100",
    FAKE_CODEX_ARGS: join(root, "codex-args.json"),
    FAKE_CODEX_MODE: "hang",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /exceeded its 100ms internal timeout/);
  assert.ok(Date.now() - startedAt < 5_000);
});
