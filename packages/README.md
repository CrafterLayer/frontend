# Packages

Each direct child of `packages/` is a private reusable contract with one owner, explicit
`exports`, colocated tests, and acyclic dependencies. Internal dependencies always use
`workspace:*`.

Do not create catch-all `shared`, `common`, or `utils` packages. A package must represent a
clear platform/tooling boundary or have credible reusable consumers. Publishing requires a
separate release, compatibility, registry, and provenance decision.
