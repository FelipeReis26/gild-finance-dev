// Development history of this app, in the order features actually shipped.
export const changelog = [
  {
    version: '1.0.0',
    summary: 'Real screenshot recognition, bug fixes, and a self-hosted icon font',
    changes: [
      'Screenshot scanning now reads real text on your device (tesseract.js), no more placeholder result',
      'Fixed the month-forward navigation bug caused by a timezone edge case',
      'Bill payments can now be undone, removing the linked transaction too',
      'Transactions can be deleted directly from the Activity list',
      'Icon font is now self-hosted instead of pulled from an external CDN'
    ]
  },
  {
    version: '0.9.0',
    summary: 'Liquid glass redesign',
    changes: [
      'Full glassmorphic UI: blurred background color, frosted cards, glossy gold buttons',
      'Reduced blur layers for better performance on real devices'
    ]
  },
  {
    version: '0.8.0',
    summary: 'Budgeting flexibility and account settings',
    changes: [
      'Category budgets became optional instead of fixed monthly caps',
      'Added currency selection (EUR, USD, GBP)',
      'Added and removed categories from Settings',
      'Split categories into separate income and expense lists',
      'Added edit and delete for existing transactions',
      'Added data export and import for backup',
      'Added a Balances tab for tracking debts and savings pots over time',
      'Added month navigation on the dashboard'
    ]
  },
  {
    version: '0.7.0',
    summary: 'Gild rebrand',
    changes: [
      'Renamed the app to Gild with a custom gold monogram icon',
      'Categories rebuilt to match the real household budget spreadsheet'
    ]
  },
  {
    version: '0.6.0',
    summary: 'Dark, gold-accented redesign',
    changes: [
      'Replaced the flat dashboard with a circular progress gauge',
      'Introduced the dark charcoal and gold visual identity'
    ]
  },
  {
    version: '0.5.0',
    summary: 'Deployed as an installable app',
    changes: [
      'Added a web app manifest and home screen icons',
      'Deployed to Netlify as a home-screen installable PWA',
      'Generated the native iOS project folder for Capacitor'
    ]
  },
  {
    version: '0.1.0',
    summary: 'First working version',
    changes: [
      'Dashboard, add transaction, activity list, bills, and screenshot scan screens',
      'Local on-device storage, no account or server required'
    ]
  }
]
