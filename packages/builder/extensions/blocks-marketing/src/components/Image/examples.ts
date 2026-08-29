import type { JsonValue } from '@craftkit/builder-schema';

export const imageExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'أضف صورة واسعة لمدينة القدس مع وصف بديل واضح',
    node: {
      type: 'image',
      props: {
        src: 'https://images.example.com/jerusalem.jpg',
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
        src: 'https://images.example.com/product.jpg',
        alt: 'Green travel backpack on a neutral background',
        fit: 'contain',
        ratio: 'square',
        radius: 'md',
      },
    },
  },
];
