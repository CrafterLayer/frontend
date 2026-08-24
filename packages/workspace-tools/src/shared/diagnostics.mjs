/**
 * @typedef {object} ContractDiagnostic
 * @property {string} code Stable machine-readable diagnostic identifier.
 * @property {string} ownerPath Repository-relative path that owns the violation.
 * @property {string} message Human-readable remediation guidance.
 * @property {string | undefined} [dependency] Exact dependency name when relevant.
 */

/**
 * @param {ContractDiagnostic} diagnostic
 * @returns {ContractDiagnostic}
 */
export function createDiagnostic(diagnostic) {
  return Object.freeze({ ...diagnostic });
}

/**
 * @param {ContractDiagnostic} left
 * @param {ContractDiagnostic} right
 */
export function compareDiagnostics(left, right) {
  return (
    left.ownerPath.localeCompare(right.ownerPath) ||
    left.code.localeCompare(right.code) ||
    left.message.localeCompare(right.message)
  );
}

/**
 * @param {ContractDiagnostic} diagnostic
 */
export function formatDiagnostic(diagnostic) {
  return `[${diagnostic.code}] ${diagnostic.ownerPath}: ${diagnostic.message}`;
}
