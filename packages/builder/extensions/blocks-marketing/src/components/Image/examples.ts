import type { JsonValue } from '@craftkit/builder-schema';

export const imageExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'أضف صورة واسعة لمدينة القدس مع وصف بديل واضح',
    node: {
      type: 'image',
      props: {
        src: 'https://images.unsplash.com/photo-1527414674854-bd016e1d3496?auto=format&fit=crop&w=1600&q=80',
        alt: 'قبة الصخرة ومباني البلدة القديمة وقت الغروب',
        ratio: 'wide',
        radius: 'md',
      },
    },
  },
  {
    prompt: 'Add a contained square product photo with rounded corners',
    node: {
      type: 'image',
      props: {
        src: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1200&q=80',
        alt: 'Green travel backpack on a neutral background',
        fit: 'contain',
        ratio: 'square',
        radius: 'md',
      },
    },
  },
];
