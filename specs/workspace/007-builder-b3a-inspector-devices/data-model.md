# Data Model: Builder B3a Inspector, Devices & Preview

All new state is VIEW state; every document change is a single kernel transaction. Normative
TypeScript lives in [contracts/builder-inspector.md](contracts/builder-inspector.md).

## Field resolution (pure derivation)

```text
property schema ──▶ contributions (fieldTypes, score desc, ties by registration) ──▶ winner
                └─▶ unwrap optional/default/nullable ──▶ core kind ──▶ default control
                                                                └─▶ readonly fallback
```

| Core kind | Control  | Commit shape   |
| --------- | -------- | -------------- |
| string    | Text     | string         |
| enum      | Select   | member string  |
| boolean   | Switch   | boolean        |
| number    | Number   | finite number  |
| other     | ReadOnly | — (no commits) |

Failure containment: a contributed winner that fails load/render degrades to the DEFAULT resolution
for that schema, per property.

## Editing bucket

| Width    | Bucket | Read path                                     | Write command   |
| -------- | ------ | --------------------------------------------- | --------------- |
| ≥ 1024   | base   | `node.props[key]`                             | `setProp`       |
| 768–1023 | tablet | `responsive.tablet[key]` (placeholder = base) | `setResponsive` |
| < 768    | mobile | `responsive.mobile[key]` (placeholder = base) | `setResponsive` |

Clear-override = `setResponsive` with `null` (one transaction). Override marker ⇔ the bucket owns
the key. Law R: only VALUES vary by bucket.

## Device state (view)

`{ width: number, bucket: EditingBucket }` — presets desktop 1280 / tablet 834 / mobile 390; custom
width maps through `bucketForWidth`. Lives in the composing surface (playground), handed to
DeviceBar (control) + Inspector (bucket) + EditorCanvas (frameWidth).

## Preview state (view)

`{ active: boolean, dirOverride: ContentDirection | null }` — entering hides all editing chrome
(composition swap); dirOverride affects frame rendering only; Escape/exit restores editing with the
untouched kernel selection.

## Inspector row lifecycle

```text
selection ──▶ schema properties ──▶ resolveField per property ──▶ control (FieldProps)
control focus ──▶ resolution LOCKED (R8) ──▶ blur/selection change ──▶ re-resolve
onChange ──▶ ONE dispatch ──▶ door validates ──▶ success: document notifies control
                                          └──▶ throw: caught, aria-describedby reason, no change
```

## Relationships

```text
DeviceBar ──{width,bucket}──▶ composing surface ──frameWidth──▶ EditorCanvas
                                   └──bucket──▶ Inspector ──dispatch──▶ kernel ──▶ canvas
registry.fieldTypes() ──▶ resolveField ◀── property zod schema
PreviewMode ──renders──▶ publish-safe path (no attachment, no chrome) ── kernel READ-ONLY
```
