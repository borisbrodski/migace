export interface NavItem { title: string; href: string; }
export interface NavGroup { title: string; items: NavItem[]; }

/** Documentation sidebar. The order here also drives the previous/next links. */
export const docsNav: NavGroup[] = [
  {
    title: 'Start here',
    items: [
      { title: 'How MIG-Ace works', href: '/docs/' },
      { title: 'Getting started', href: '/docs/getting-started/' },
      { title: 'The bookshop example', href: '/docs/bookshop/' },
    ],
  },
  {
    title: 'Writing migrations',
    items: [
      { title: 'Snippets', href: '/docs/snippets/' },
      { title: 'Statements', href: '/docs/statements/' },
      { title: 'Data migrations', href: '/docs/data-migrations/' },
      { title: 'Conditions', href: '/docs/conditions/' },
      { title: 'Test data', href: '/docs/test-data/' },
      { title: 'Native SQL', href: '/docs/native-sql/' },
    ],
  },
  {
    title: 'How it is proven',
    items: [
      { title: 'The proof loop', href: '/docs/proof-loop/' },
      { title: 'The desired schema', href: '/docs/desired-schema/' },
    ],
  },
  {
    title: 'Life after release',
    items: [
      { title: 'Running migrations', href: '/docs/running-migrations/' },
      { title: 'Fixing mistakes', href: '/docs/fixing-mistakes/' },
      { title: 'Releases and branches', href: '/docs/releases-and-branches/' },
      { title: 'Zero-downtime changes', href: '/docs/zero-downtime/' },
    ],
  },
  {
    title: 'Reference',
    items: [
      { title: 'Complete example', href: '/docs/complete-example/' },
      { title: 'Commands', href: '/docs/commands/' },
      { title: 'Editor support', href: '/docs/editor-support/' },
      { title: 'Glossary', href: '/docs/glossary/' },
    ],
  },
];

export const docsFlat: NavItem[] = docsNav.flatMap((g) => g.items);
