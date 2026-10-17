import type { JsonValue } from '@craftkit/builder-schema';

export const bentoGridExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'premium bento section for an AI operations platform',
    node: {
      type: 'bento-grid',
      props: {
        eyebrow: 'One connected workspace',
        heading: 'Move from signal to decision without losing context',
        body: 'A flexible operating layer that keeps every team aligned, fast, and accountable.',
        layout: 'mosaic',
        align: 'start',
        tone: 'light',
        spacing: 'lg',
        width: 'wide',
        items: [
          {
            kicker: 'Intelligence',
            title: 'Answers grounded in your work',
            body: 'Bring conversations, metrics, and decisions into one explainable view.',
            metric: '3.4×',
            size: 'featured',
            emphasis: 'inverse',
          },
          {
            kicker: 'Automation',
            title: 'Workflows that stay observable',
            body: 'Automate the repetitive parts while people keep control of every important step.',
            size: 'tall',
            emphasis: 'neutral',
          },
          {
            kicker: 'Reliability',
            title: 'Built-in guardrails',
            body: 'Policies travel with the work so quality does not depend on memory.',
            metric: '99.99%',
            size: 'small',
            emphasis: 'accent',
          },
          {
            kicker: 'Visibility',
            title: 'A shared view of progress',
            body: 'See ownership, risk, and next steps before a handoff becomes a blocker.',
            size: 'wide',
            emphasis: 'neutral',
          },
        ],
      },
    },
  },
  {
    prompt: 'شبكة بنتو عربية متوازنة لخدمة مالية',
    node: {
      type: 'bento-grid',
      props: {
        eyebrow: 'وضوح كامل',
        heading: 'كل ما تحتاجه لإدارة أموالك بثقة',
        body: 'تجربة مالية تجمع الرؤية والتحكم والحماية في مكان واحد.',
        layout: 'equal',
        align: 'start',
        tone: 'transparent',
        spacing: 'lg',
        width: 'wide',
        items: [
          {
            title: 'صورة لحظية',
            body: 'اعرف أين تذهب أموالك من دون جداول معقدة.',
            metric: '24/7',
            size: 'small',
            emphasis: 'accent',
          },
          {
            title: 'حماية ذكية',
            body: 'تنبيهات استباقية وإعدادات أمان واضحة.',
            size: 'small',
            emphasis: 'neutral',
          },
          {
            title: 'قرارات أسرع',
            body: 'توصيات مفهومة مبنية على نمطك الحقيقي.',
            size: 'small',
            emphasis: 'inverse',
          },
        ],
      },
    },
  },
];
