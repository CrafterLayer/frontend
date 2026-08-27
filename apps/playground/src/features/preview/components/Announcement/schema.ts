import { z } from 'zod';

import { defineBlockSchema } from '@craftkit/builder';

/**
 * The runtime-registration demo block (FR-013): its TYPE is pre-allowed by the
 * preset page's vocabulary, but this schema+renderer only enter the kernel when
 * the user clicks "Register demo extension".
 */
export const announcementSchema = defineBlockSchema({
  type: 'announcement',
  description:
    'A slim page-wide announcement bar with a short message and an informational or success tone.',
  props: z.object({
    message: z.string().min(1).max(120).default('Registered at runtime — no reload.'),
    tone: z.enum(['info', 'success']).default('info'),
  }),
  // B3c: the message IS this block's text, so it edits in place on the canvas.
  inlineEditable: 'message',
  examples: [
    {
      prompt: 'شريط إعلان أخضر عن شحن مجاني',
      node: { type: 'announcement', props: { message: 'شحن مجاني هذا الأسبوع', tone: 'success' } },
    },
  ],
});

export type AnnouncementProps = z.output<typeof announcementSchema.props>;
