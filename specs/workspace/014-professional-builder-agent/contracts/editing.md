# Editing and Page Command Contract

## Source edits

```ts
applyCodeChanges({ projectId, expectedProjectRevision, changes, attribution })
```

Each file change names an expected hash or expected absence. The kernel either applies all changes as
one transaction or applies none. Disjoint edits may be rebased only after the merged graph compiles.

Supported visual source changes are literal text, literal props, literal class/style values, declared
editable data, and supported structural insert/move/duplicate/delete. Expressions and unbound dynamic
output expose shared-source editing rather than guessed markup.

## Page commands

- `duplicatePage` mints page, document, private module, and source identities while retaining explicit
  shared imports.
- `setHomePage` assigns `/` to the target and a unique derived address to the former home atomically.
- `removePage` requires a link resolution plan and cannot remove the final page.
- `clearPage` preserves page identity, address, and home status while replacing private content.
- System-generated internal links store page identity. Literal external or user-authored URL strings
  remain strings with diagnostics.

## Selection and insertion

All selection consumers receive the same `SelectionTarget`. Commands reject a mismatched revision or
missing capability. `InsertionAnchor` resolution never falls back to appending at an arbitrary parent.

The selection revision is the site transaction revision and a source handle revision is the authored
project revision. Page switching clears the visual selection, but a submitted operation retains and
revalidates its own captured target. Ambiguous, removed, or capability-changing targets are cleared.

Shared-source approval carries an impact fingerprint over affected page and instance identities. If
that set changes before apply, the command writes zero patches, refreshes the impact preview, and
requires acknowledgement of the new scope.

Escape order is popup, text edit, parent, clear. Drag begins only from the structural handle after an
8px threshold.
