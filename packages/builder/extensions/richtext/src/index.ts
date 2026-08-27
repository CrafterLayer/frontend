// @craftkit/builder-richtext — the ONLY package that may depend on the editing
// engine (008 contract §3 e6). The manifest contributes TWO lazy surfaces — the
// inspector's field and the canvas's inline editor — and nothing else; a session
// that edits no rich text never loads the engine at all (009 SC-005).
import { isRichTextSchema, type TrustedExtensionManifest } from '@craftkit/builder-schema';

export const richTextExtension: TrustedExtensionManifest = {
  tier: 1,
  name: 'craftkit.rich-text',
  version: '0.1.0',
  contributes: {
    fieldTypes: [
      {
        id: 'craftkit.rich-text',
        match: (schema) => (isRichTextSchema(schema) ? 100 : 0),
        load: () =>
          import('./RichTextField').then((module) => ({
            default: module.RichTextField,
          })),
      },
    ],
    // The canvas resolves this by KIND (009 §11) — the shell is layer 3 and can
    // never import an editing engine, so the engine comes to it, lazily.
    inlineEditors: [
      {
        id: 'craftkit.rich-text.inline',
        kind: 'rich',
        load: () => import('./InlineRichText/inline-editor'),
      },
    ],
  },
};

export type { RichTextFieldProps } from './RichTextField';
