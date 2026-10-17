import { money, type NavLink } from '../../build';

interface Dish {
  readonly name: string;
  readonly description: string;
  readonly badge?: string;
}

/* The English copy of restaurant; the Arabic copy in ./copy-ar.ts has the same shape. */
export const EN = {
  brand: 'Olive House',
  nav: [
    { label: 'Menu', href: '#menu' },
    { label: 'About', href: '#about' },
    { label: 'Reservations', href: '#reserve' },
    { label: 'Visit', href: '#visit' },
  ] as NavLink[],
  headerCta: { label: 'Reserve', href: '#reserve' },
  hero: {
    eyebrow: 'Levantine kitchen · Jabal Amman',
    heading: 'Levantine home cooking, slow and generous',
    body: 'Charcoal grills, mezze made every morning and bread from our own taboon oven, served at long tables meant for sharing.',
    trustLine: 'Open daily 12:00–23:30 · Terrace seating · Family tables for up to 14',
    primary: 'Book a table',
    secondary: 'See the menu',
  },
  signatures: {
    eyebrow: 'Our signatures',
    heading: 'Three reasons our regulars keep their Thursday table',
    body: 'Everything is cooked to order from Jordanian produce, and nothing on the menu is older than this morning.',
    items: [
      {
        kicker: 'From the charcoal grill',
        title: 'Mixed grill over olive wood',
        body: 'Lamb kofta, shish tawook and lamb chops grilled to order over olive wood, then rested on warm bread that soaks up every drop.',
        metric: 'Since 2009',
      },
      {
        kicker: 'Baked every hour',
        title: 'Taboon bread from our own oven',
        body: 'Dough rested overnight and baked in our stone taboon from noon until close.',
      },
      {
        kicker: 'Made each morning',
        title: 'Mezze from family recipes',
        body: 'Hummus, moutabal and muhammara made daily with olive oil pressed in Ajloun.',
      },
    ],
  },
  menu: {
    eyebrow: 'The menu',
    heading: 'Mezze, grills and something sweet',
    body: 'Prices in Jordanian dinars, service included. Ask us about vegetarian and gluten-free options.',
    actionLabel: 'Order for pickup',
    ratingPrefix: 'Rating',
    ratingSuffix: 'of 5',
    reviewCountLabel: 'guest reviews',
    dishes: [
      {
        name: 'Hummus with olive oil',
        description: 'Chickpeas whipped with tahini and lemon, finished with Ajloun olive oil.',
        badge: 'Vegan',
      },
      {
        name: 'Falafel plate',
        description: 'Six crisp falafel with tahini sauce, pickles and warm bread.',
      },
      {
        name: 'Cheese sambousek',
        description:
          'Golden pastries filled with white cheese and parsley, served with green chilli.',
      },
      {
        name: 'Strawberry and white cheese salad',
        description:
          'Seasonal leaves, strawberries and crumbled white cheese with a pomegranate dressing.',
        badge: 'New',
      },
      {
        name: 'Olive House mixed grill',
        description: 'Lamb kofta, shish tawook and lamb chops with grilled vegetables, for two.',
        badge: "Chef's pick",
      },
      {
        name: 'Chicken shawarma plate',
        description:
          'Marinated chicken carved from the spit, with garlic sauce, fries and pickles.',
      },
      {
        name: 'Grilled salmon with greens',
        description: 'Salmon fillet with sumac, sautéed greens and lemon.',
      },
      {
        name: 'Sliced beef with herbs',
        description: 'Grilled beef with fresh herbs, chilli and a pomegranate glaze.',
      },
      {
        name: 'Spiced vegetable rice',
        description: 'Long-grain rice with seven spices, carrots and spring onions.',
      },
      {
        name: 'Strawberry muhallabia',
        description: 'Orange-blossom milk pudding topped with fresh strawberries.',
      },
      {
        name: 'Chocolate layer cake',
        description: 'Dark chocolate sponge layered with ganache, baked daily.',
      },
      {
        name: 'Lemon and mint',
        description: 'Fresh lemon blended with mint and crushed ice.',
      },
    ] as Dish[],
  },
  gallery: {
    eyebrow: 'Inside Olive House',
    heading: 'A kitchen you can watch and a room built for long dinners',
    body: 'Pull up a chair by the open grill, or take the quiet hall for a family celebration.',
    linkLabel: 'Open the photo',
    captions: [
      'The charcoal grill runs from noon until the last order.',
      'Kunafa dough, shredded fresh for every tray.',
      'Every plate is checked at the pass before it leaves.',
      'The garden hall seats 80 in natural light.',
      'Baklava layered by hand each afternoon.',
      'The quiet room for celebrations and business lunches.',
    ],
  },
  quotes: {
    eyebrow: 'Guests',
    heading: 'What our guests come back for',
    items: [
      {
        quote:
          "The mixed grill tastes like my grandmother's Friday lunch, and the bread arrives straight from the oven. We book every month.",
        author: 'Dana Khoury',
        role: 'Regular guest since 2015',
      },
      {
        quote:
          "We hosted forty people for my father's retirement. The team handled every detail and the kunafa was still warm.",
        author: 'Hani Mansour',
        role: 'Hosted a family dinner',
      },
      {
        quote: 'Honest prices, generous plates and a team that remembers how you take your coffee.',
        author: 'Lara Saleh',
        role: 'Weekly lunch guest',
      },
      {
        quote:
          'The best hummus in Amman, and I have tried most of them. The terrace on a summer evening is hard to beat.',
        author: 'Sami Odeh',
        role: 'Food writer',
      },
    ],
  },
  contact: {
    eyebrow: 'Visit us',
    heading: 'Find us on Rainbow Street',
    body: 'Walk-ins are welcome at lunch. For dinner and groups of six or more, send a request and we confirm within the hour.',
    address: 'Rainbow Street 34, Jabal Amman, Amman 11181, Jordan',
    availability: 'Daily 12:00–23:30 · Friday from 13:00',
    formTitle: 'Request a table',
    formBody: 'Tell us the date, the time and how many guests are coming.',
    nameLabel: 'Your name',
    emailLabel: 'Email',
    messageLabel: 'Date, time and guests',
    submitLabel: 'Send request',
  },
  promo: {
    label: 'Private dining',
    headline: 'Book the family table for up to 14 guests',
    body: `Set menus from ${money(22, 'JOD', 'en')} per person, with a dedicated host and a dessert table for birthdays and engagements.`,
    primary: 'Reserve your evening',
    secondary: 'Call the restaurant',
  },
  footer: {
    tagline: 'Levantine home cooking on Rainbow Street, Amman, since 2009.',
    columns: [
      {
        title: 'Restaurant',
        links: [
          { label: 'Menu', href: '#menu' },
          { label: 'Our story', href: '#about' },
          { label: 'Private dining', href: '#private' },
          { label: 'Gift cards', href: '#gifts' },
        ],
      },
      {
        title: 'Visit',
        links: [
          { label: 'Reservations', href: '#reserve' },
          { label: 'Location', href: '#visit' },
          { label: 'Opening hours', href: '#hours' },
        ],
      },
      {
        title: 'Follow',
        links: [
          { label: 'Instagram', href: '#instagram' },
          { label: 'Facebook', href: '#facebook' },
        ],
      },
    ],
  },
};

export type RestaurantCopy = typeof EN;
