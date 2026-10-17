/** AI-context examples (B0 contract): prompt → the node an assistant should emit. */
export const richTextBlockExamples = [
  {
    prompt: 'Add an about section with a heading and a short paragraph',
    node: {
      type: 'richText',
      props: {
        content: {
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: 'About us' }],
            },
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'We build ' },
                { type: 'text', text: 'reliable', marks: [{ type: 'bold' }] },
                { type: 'text', text: ' tools for the web.' },
              ],
            },
          ],
        },
      },
    },
  },
];
