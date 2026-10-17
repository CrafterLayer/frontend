import type { JsonValue } from '@craftkit/builder-schema';

export const menuSectionExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'قائمة طعام مطعم مشاوي بالأسعار بالريال',
    node: {
      type: 'menuSection',
      props: {
        eyebrow: 'من الفحم مباشرة',
        heading: 'قائمة الطعام',
        categories: [
          {
            name: 'المشاوي',
            items: [
              {
                name: 'كباب لحم',
                description: 'لحم بلدي مع البصل والسماق.',
                price: '٤٢',
                tags: ['الأكثر طلبًا'],
              },
              { name: 'شيش طاووق', description: 'دجاج متبّل بالثوم والليمون.', price: '٣٥' },
              { name: 'ريش غنم', price: '٦٨' },
            ],
          },
          {
            name: 'المقبلات',
            items: [
              { name: 'حمص بالطحينة', price: '١٤', tags: ['نباتي'] },
              { name: 'متبل باذنجان', price: '١٦', tags: ['نباتي', 'حار'] },
            ],
          },
        ],
        currency: 'ر.س',
        currencyPosition: 'after',
        priceAlign: 'end',
        leaders: true,
        columns: '2',
        note: 'الأسعار تشمل ضريبة القيمة المضافة.',
        tone: 'light',
      },
    },
  },
  {
    prompt: 'a café drinks menu with dotted leaders and dollar prices',
    node: {
      type: 'menuSection',
      props: {
        heading: 'Drinks',
        body: 'Single-origin beans, roasted every Monday.',
        categories: [
          {
            name: 'Espresso bar',
            description: 'Oat or almond milk at no extra charge.',
            items: [
              { name: 'Cortado', price: '3.75' },
              { name: 'Cappuccino', description: 'Six ounces, dry foam.', price: '4.25' },
              { name: 'Spanish latte', price: '5.00', tags: ['New'] },
            ],
          },
          {
            name: 'Cold',
            items: [
              { name: 'Cold brew', description: 'Steeped for eighteen hours.', price: '4.75' },
              { name: 'Hibiscus iced tea', price: '3.50', tags: ['Caffeine free'] },
            ],
          },
        ],
        currency: '$',
        currencyPosition: 'before',
        leaders: true,
        columns: '2',
        width: 'standard',
      },
    },
  },
  {
    prompt: 'a barber shop price list for services',
    node: {
      type: 'menuSection',
      props: {
        heading: 'Services',
        categories: [
          {
            name: 'Hair',
            items: [
              { name: 'Classic cut', description: 'Wash, cut and style.', price: '25' },
              { name: 'Skin fade', price: '30' },
              { name: 'Kids cut', description: 'Under twelve.', price: '18' },
            ],
          },
          {
            name: 'Beard',
            items: [
              { name: 'Beard trim', price: '15' },
              { name: 'Hot towel shave', price: '28', tags: ['Signature'] },
            ],
          },
        ],
        currency: 'AED',
        currencyPosition: 'after',
        priceAlign: 'inline',
        leaders: false,
        showImages: false,
        columns: '1',
        width: 'narrow',
      },
    },
  },
];
