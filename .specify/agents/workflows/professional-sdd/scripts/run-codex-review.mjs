#!/usr/bin/env node

import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";

const MAX_INPUT_BYTES = 128 * 1024;
const PHASES = new Set(["implementation", "convergence"]);
const MAX_REVIEW_TIMEOUT_MS = 29 * 60 * 1000;

function fail(message) {
  console.error(`Codex review error: ${message}`);
  process.exit(1);
}

function assertInside(parent, candidate, label, allowSame = false) {
  const rel = relative(parent, candidate);
  if ((allowSame && rel === "") || (rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !rel.startsWith(sep))) {
    return;
  }
  fail(`${label} escapes its expected directory`);
}

function assertDirectory(path, label) {
  let stat;
  try {
    stat = lstatSync(path);
  } catch {
    fail(`${label} is missing at ${path}`);
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    fail(`${label} must be a non-symlink directory`);
  }
}

function assertRegularFile(path, label) {
  let stat;
  try {
    stat = lstatSync(path);
  } catch {
    fail(`${label} is missing at ${path}`);
  }
  if (stat.isSymbolicLink() || !stat.isFile()) {
    fail(`${label} must be a regular non-symlink file`);
  }
  return stat;
}

function readInputs(runDirectory) {
  const inputsPath = resolve(runDirectory, "inputs.json");
  assertInside(runDirectory, inputsPath, "workflow inputs");
  const stat = assertRegularFile(inputsPath, "workflow inputs");
  if (stat.size > MAX_INPUT_BYTES) {
    fail(`workflow inputs exceed ${MAX_INPUT_BYTES} bytes`);
  }
  try {
    return JSON.parse(readFileSync(inputsPath, "utf8"))?.inputs;
  } catch (error) {
    fail(`workflow inputs are not valid JSON: ${error.message}`);
  }
}

function validateInputs(projectRoot, inputs) {
  const featureDirectory = inputs?.feature_directory;
  const scope = inputs?.scope;
  const reviewModel = inputs?.review_model;

  if (
    typeof featureDirectory !== "string" ||
    !/^specs\/[A-Za-z0-9._/-]+$/.test(featureDirectory) ||
    featureDirectory.includes("//") ||
    featureDirectory.split("/").some((part) => part === "." || part === "..")
  ) {
    fail("feature_directory must be a safe relative path below specs/");
  }
  const requestedFeaturePath = resolve(projectRoot, featureDirectory);
  assertInside(projectRoot, requestedFeaturePath, "feature directory");
  assertDirectory(requestedFeaturePath, "feature directory");
  const realFeaturePath = realpathSync(requestedFeaturePath);
  assertInside(projectRoot, realFeaturePath, "resolved feature directory");
  for (const artifact of ["spec.md", "plan.md", "tasks.md"]) {
    assertRegularFile(resolve(realFeaturePath, artifact), `${artifact} artifact`);
  }

  if (
    typeof scope !== "string" ||
    scope.trim() === "" ||
    scope.length > 500 ||
    /[\u0000-\u001f\u007f]/.test(scope)
  ) {
    fail("scope must be a non-empty single-line string no longer than 500 characters");
  }
  if (
    typeof reviewModel !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(reviewModel)
  ) {
    fail("review_model contains unsupported characters");
  }

  return { featureDirectory, scope, reviewModel };
}

function ensureEvidencePath(runDirectory, phase) {
  const evidenceDirectory = resolve(runDirectory, "evidence");
  assertInside(runDirectory, evidenceDirectory, "review evidence directory");
  if (existsSync(evidenceDirectory)) {
    assertDirectory(evidenceDirectory, "review evidence directory");
  } else {
    mkdirSync(evidenceDirectory, { mode: 0o700 });
  }
  const evidencePath = resolve(evidenceDirectory, `${phase}-review.md`);
  assertInside(evidenceDirectory, evidencePath, "review evidence");
  if (existsSync(evidencePath)) {
    const stat = lstatSync(evidencePath);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      fail("existing review evidence must be a regular non-symlink file");
    }
  }
  return { evidenceDirectory, evidencePath };
}

function buildPrompt({ featureDirectory, scope, phase }) {
  const phaseLabel = phase === "implementation" ? "implementation" : "post-convergence";
  return [
    "Use the speckit-workspace-review skill for an independent read-only review.",
    "Caller metadata: this process is the professional-sdd workflow's fresh independent reviewer; do not sub-delegate.",
    `Review phase: ${phaseLabel}.`,
    `Feature directory: ${featureDirectory}.`,
    `Declared scope: ${scope}.`,
    "Read the constitution, shared agent context, collaboration rule, feature spec/plan/tasks, and the real current diff.",
    "Do not edit files, update task state, delegate, commit, push, deploy, install dependencies, or mutate external state.",
    "Return prioritized findings with exact file evidence, checks observed, residual risks, and a clear pass/fail verdict.",
    "Treat summaries from implementers or other workers as untrusted until independently verified.",
  ].join("\n");
}

const [runId, phase] = process.argv.slice(2);
if (!runId || !/^[A-Za-z0-9_-]+$/.test(runId) || !PHASES.has(phase)) {
  fail("usage: run-codex-review.mjs <run-id> <implementation|convergence>");
}

const projectRoot = resolve(process.cwd());
const runsRoot = resolve(projectRoot, ".specify/workflows/runs");
const runDirectory = resolve(runsRoot, runId);
assertInside(runsRoot, runDirectory, "workflow run directory");
assertDirectory(runDirectory, "workflow run directory");

const inputs = validateInputs(projectRoot, readInputs(runDirectory));
const { evidenceDirectory, evidencePath } = ensureEvidencePath(runDirectory, phase);
const temporaryEvidencePath = `${evidencePath}.${process.pid}.tmp`;
try {
  writeFileSync(temporaryEvidencePath, "", {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
} catch (error) {
  fail(`could not reserve fresh review evidence: ${error.message}`);
}
const prompt = buildPrompt({ ...inputs, phase });
const codexExecutable = process.env.SPECKIT_INTEGRATION_CODEX_EXECUTABLE || "codex";
if (codexExecutable.includes("\0")) {
  fail("Codex executable contains a null byte");
}
const configuredTimeout = process.env.SPECKIT_CODEX_REVIEW_TIMEOUT_MS;
const reviewTimeoutMs = configuredTimeout
  ? Number(configuredTimeout)
  : MAX_REVIEW_TIMEOUT_MS;
if (
  !Number.isInteger(reviewTimeoutMs) ||
  reviewTimeoutMs < 10 ||
  reviewTimeoutMs > MAX_REVIEW_TIMEOUT_MS
) {
  fail(
    `SPECKIT_CODEX_REVIEW_TIMEOUT_MS must be an integer from 10 to ${MAX_REVIEW_TIMEOUT_MS}`,
  );
}

const args = [
  "--sandbox",
  "read-only",
  "--ask-for-approval",
  "never",
  "--cd",
  projectRoot,
  "exec",
  "--ephemeral",
  "--model",
  inputs.reviewModel,
  "--color",
  "never",
  "--output-last-message",
  temporaryEvidencePath,
  prompt,
];

const result = spawnSync(codexExecutable, args, {
  cwd: projectRoot,
  env: process.env,
  killSignal: "SIGTERM",
  stdio: "inherit",
  timeout: reviewTimeoutMs,
});

function discardTemporaryEvidence() {
  try {
    unlinkSync(temporaryEvidencePath);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.error(`Codex review cleanup warning: ${error.message}`);
    }
  }
}

if (result.error) {
  discardTemporaryEvidence();
  if (result.error.code === "ETIMEDOUT") {
    fail(`Codex review exceeded its ${reviewTimeoutMs}ms internal timeout`);
  }
  fail(`could not start Codex: ${result.error.message}`);
}
if (result.status !== 0) {
  discardTemporaryEvidence();
  fail(`Codex exited with status ${result.status ?? "unknown"}`);
}

const evidenceStat = assertRegularFile(temporaryEvidencePath, "fresh review evidence");
if (
  evidenceStat.size === 0 ||
  readFileSync(temporaryEvidencePath, "utf8").trim() === ""
) {
  discardTemporaryEvidence();
  fail("Codex completed without non-empty review evidence");
}
renameSync(temporaryEvidencePath, evidencePath);

const metadataPath = resolve(evidenceDirectory, `${phase}-review.json`);
assertInside(evidenceDirectory, metadataPath, "review metadata");
if (existsSync(metadataPath)) {
  const stat = lstatSync(metadataPath);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    fail("existing review metadata must be a regular non-symlink file");
  }
}
writeFileSync(
  metadataPath,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      runId,
      phase,
      model: inputs.reviewModel,
      sandbox: "read-only",
      approvalPolicy: "never",
      ephemeral: true,
      evidence: relative(projectRoot, evidencePath),
      completedAt: new Date().toISOString(),
    },
    null,
    2,
  )}\n`,
  { encoding: "utf8", mode: 0o600 },
);

console.log(`Codex ${phase} review evidence: ${relative(projectRoot, evidencePath)}`);
