import type { JsonValue } from '@craftkit/builder-schema';

export const tableExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'a clean table of service prices and durations',
    node: {
      type: 'table',
      props: {
        title: 'Services and prices',
        caption: 'Prices include tax. Group workshops are priced per person.',
        columns: [
          { label: 'Service', align: 'start' },
          { label: 'Duration', align: 'start' },
          { label: 'Price', align: 'end' },
        ],
        rows: [
          { cells: ['Strategy session', '45 min', '$120'] },
          { cells: ['Brand review', '90 min', '$240'] },
          { cells: ['Website audit', '2 hours', '$380'] },
          { cells: ['Team workshop', 'Half day', '$60'] },
        ],
        headerRow: true,
        firstColumnIsHeader: true,
        striped: false,
        density: 'comfortable',
        variant: 'boxed',
        scrollLabel: 'Scrollable table of services and prices',
        align: 'start',
        tone: 'transparent',
        spacing: 'md',
        width: 'standard',
      },
    },
  },
  {
    prompt: 'a compact striped shipping rates table with numbers aligned to the end',
    node: {
      type: 'table',
      props: {
        title: 'Shipping rates',
        columns: [
          { label: 'Region', align: 'start' },
          { label: 'Standard', align: 'end' },
          { label: 'Express', align: 'end' },
          { label: 'Delivery time', align: 'center' },
        ],
        rows: [
          { cells: ['Domestic', '$4.90', '$12.00', '2–3 days'] },
          { cells: ['Europe', '$9.50', '$24.00', '4–6 days'] },
          { cells: ['North America', '$11.00', '$28.00', '5–7 days'] },
          { cells: ['Rest of world', '$14.00', '$35.00', '7–12 days'] },
        ],
        striped: true,
        density: 'compact',
        variant: 'minimal',
        width: 'wide',
      },
    },
  },
  {
    prompt: 'جدول مواعيد العيادة',
    node: {
      type: 'table',
      props: {
        title: 'مواعيد العيادة',
        caption: 'المواعيد بتوقيت مكة المكرمة، والعيادة مغلقة في العطل الرسمية.',
        columns: [
          { label: 'اليوم', align: 'start' },
          { label: 'الفترة الصباحية', align: 'center' },
          { label: 'الفترة المسائية', align: 'center' },
        ],
        rows: [
          { cells: ['الأحد – الأربعاء', '٩:٠٠ – ١:٠٠', '٤:٠٠ – ٩:٠٠'] },
          { cells: ['الخميس', '٩:٠٠ – ١:٠٠', 'مغلق'] },
          { cells: ['الجمعة', 'مغلق', 'مغلق'] },
          { cells: ['السبت', '١٠:٠٠ – ٢:٠٠', '٥:٠٠ – ٩:٠٠'] },
        ],
        headerRow: true,
        firstColumnIsHeader: true,
        striped: true,
        scrollLabel: 'جدول مواعيد العيادة قابل للتمرير',
        align: 'start',
        tone: 'light',
        width: 'standard',
      },
    },
  },
];
