// @craftkit/builder-richtext — the ONLY package that may depend on the editing
// engine (008 contract §3 e6). The manifest contributes ONE lazy field type;
// sessions that never edit rich text never load the engine's editor component.
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
  },
};

export type { RichTextFieldProps } from './RichTextField';
