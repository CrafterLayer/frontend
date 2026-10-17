# Applications

Each direct child of `apps/` is a private deployable or workspace tooling application with its own
manifest, README, source, tests, and Turbo task contract.

Applications may consume package public APIs. They must never import another application or a
package's internal source. Product applications require an app-scoped Spec Kit feature and an ADR
for framework/deployment decisions.

`apps/storybook` is the central workspace component catalog; it is tooling, not a product
application.
