# Operational Runbooks

**Status:** Index ready; no deployment or production platform has been selected.

Runbooks are executable procedures for releases, incidents, recovery, migrations, and
other operational work where order and evidence matter. Create a runbook only after the
relevant runtime or platform exists.

Every runbook must include:

1. purpose, owner, environment, and prerequisites;
2. exact target and safety checks;
3. ordered commands or actions with expected output;
4. verification and observable success criteria;
5. rollback or recovery steps;
6. escalation conditions; and
7. last-reviewed date plus links to the owning architecture decision.

Never store tokens, credentials, private keys, cookies, production payloads, or personal
data in a runbook. Reference the approved secret-management location by name only.
