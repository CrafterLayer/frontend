#!/usr/bin/env node

import {
  lstatSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { relative, resolve, sep } from "node:path";

const MAX_RESULT_BYTES = 64 * 1024;
const VALID_MODES = new Set(["auto", "required", "off"]);

function fail(message) {
  console.error(`Delegation result error: ${message}`);
  process.exit(1);
}

function assertSafeRunId(runId) {
  if (!/^[A-Za-z0-9_-]+$/.test(runId)) {
    fail(`invalid workflow run id ${JSON.stringify(runId)}`);
  }
}

function assertInside(parent, candidate, label) {
  const rel = relative(parent, candidate);
  if (rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !rel.startsWith(sep))) {
    return;
  }
  fail(`${label} escapes its expected directory`);
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

function assertRunDirectory(path) {
  let stat;
  try {
    stat = lstatSync(path);
  } catch {
    fail(`workflow run directory is missing at ${path}`);
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    fail("workflow run directory must be a non-symlink directory");
  }
}

function readJson(path, label, maxBytes = MAX_RESULT_BYTES) {
  const stat = assertRegularFile(path, label);
  if (stat.size > maxBytes) {
    fail(`${label} exceeds ${maxBytes} bytes`);
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`${label} is not valid JSON: ${error.message}`);
  }
}

function readMode(inputsPath) {
  const document = readJson(inputsPath, "workflow inputs");
  const mode = document?.inputs?.delegation_mode;
  if (!VALID_MODES.has(mode)) {
    fail(`workflow delegation_mode is invalid: ${JSON.stringify(mode)}`);
  }
  return mode;
}

function writePending(resultPath, runId, mode) {
  try {
    const existing = lstatSync(resultPath);
    if (existing.isSymbolicLink() || !existing.isFile()) {
      fail("existing delegation result must be a regular non-symlink file");
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }

  const pending = {
    schemaVersion: 1,
    runId,
    mode,
    status: "pending",
    transport: null,
    delegatedTaskCount: 0,
    acceptedResultCount: 0,
    reason: "Awaiting the coordinating agent's delegation result.",
    updatedAt: new Date().toISOString(),
  };
  const tempPath = `${resultPath}.${process.pid}.tmp`;
  try {
    writeFileSync(tempPath, `${JSON.stringify(pending, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    renameSync(tempPath, resultPath);
  } catch (error) {
    fail(`could not initialize ${resultPath}: ${error.message}`);
  }
  console.log(`Initialized delegation result for run ${runId} in mode ${mode}.`);
}

function requireInteger(value, field) {
  if (!Number.isInteger(value) || value < 0) {
    fail(`${field} must be a non-negative integer`);
  }
}

function verifyResult(resultPath, runId, mode) {
  const result = readJson(resultPath, "delegation result");
  if (result?.schemaVersion !== 1) {
    fail("delegation result schemaVersion must be 1");
  }
  if (result.runId !== runId || result.mode !== mode) {
    fail("delegation result does not belong to this workflow run and mode");
  }
  requireInteger(result.delegatedTaskCount, "delegatedTaskCount");
  requireInteger(result.acceptedResultCount, "acceptedResultCount");
  if (result.acceptedResultCount > result.delegatedTaskCount) {
    fail("acceptedResultCount cannot exceed delegatedTaskCount");
  }
  if (typeof result.updatedAt !== "string" || Number.isNaN(Date.parse(result.updatedAt))) {
    fail("updatedAt must be an ISO-compatible timestamp");
  }

  const status = result.status;
  if (status === "delegated") {
    if (result.delegatedTaskCount < 1 || result.acceptedResultCount < 1) {
      fail("delegated status requires at least one delegated and accepted result");
    }
    if (typeof result.transport !== "string" || result.transport.trim() === "") {
      fail("delegated status requires the selected transport");
    }
  } else if (typeof result.reason !== "string" || result.reason.trim() === "") {
    fail("a non-delegated result requires a reason");
  }

  const acceptedByMode = {
    auto: new Set(["delegated", "not-needed", "unavailable"]),
    required: new Set(["delegated"]),
    off: new Set(["disabled"]),
  };
  if (!acceptedByMode[mode].has(status)) {
    fail(`status ${JSON.stringify(status)} is not acceptable for mode ${mode}`);
  }

  console.log(
    JSON.stringify({
      runId,
      mode,
      status,
      transport: result.transport,
      delegatedTaskCount: result.delegatedTaskCount,
      acceptedResultCount: result.acceptedResultCount,
    }),
  );
}

const [action, runId] = process.argv.slice(2);
if (!new Set(["prepare", "verify"]).has(action) || !runId) {
  fail("usage: delegation-result.mjs <prepare|verify> <run-id>");
}
assertSafeRunId(runId);

const projectRoot = resolve(process.cwd());
const runsRoot = resolve(projectRoot, ".specify/workflows/runs");
const runDirectory = resolve(runsRoot, runId);
assertInside(runsRoot, runDirectory, "workflow run directory");
assertRunDirectory(runDirectory);

const inputsPath = resolve(runDirectory, "inputs.json");
const resultPath = resolve(runDirectory, "delegation.json");
assertInside(runDirectory, inputsPath, "workflow inputs");
assertInside(runDirectory, resultPath, "delegation result");
const mode = readMode(inputsPath);

if (action === "prepare") {
  writePending(resultPath, runId, mode);
} else {
  verifyResult(resultPath, runId, mode);
}
