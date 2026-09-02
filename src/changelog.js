// Development history of this app, in the order features actually shipped.
export const changelog = [
  {
    version: '2.1.0',
    summary: 'New look, calmer and more honest dashboard, and a slide-out menu',
    changes: [
      'A whole new look: a watch-dial face in black and gold — the pay period reads as a power reserve of day ticks, and your top budgets as small dials',
      'Pay day can now follow a weekday rule: a fixed day of the month, the last chosen weekday (e.g. the last Friday), or the last working day of the month',
      'The diamond app icon returns, redrawn in gold line-work to match the new look, along with matching launch screens',
      'Scanning is now much better at reading receipts: it recognises well-known shops by name (Tesco, Lidl, Circle K, Boots and many more) and files them correctly, picks the real total instead of the biggest number on the page, understands thousands separators, uses the date printed on the receipt, and no longer mistakes loyalty-card marketing text for the shop name',
      'Scanning also learns your own filing habits — but only when there is real evidence, so it will not guess wildly',
      'Photos of receipts are now cleaned up before reading (converted to grey with the contrast stretched, and small images enlarged), which makes a big difference on coloured thermal paper, glare and faint print — and if a first read finds no figures at all, it automatically tries again reading the page as a single column',
      'The app now remembers which category you file each shop under: correct it once and the next receipt from that shop is already right, marked "remembered"',
      'A receipt that was read poorly is now flagged "unclear scan — check" instead of quietly presenting shaky figures',
      'Receipt reading was tested against 120 simulated photos (skewed, blurred, faded, coloured paper, glare, noise, low resolution, heavy compression) plus 20 real receipt photographs from several countries, and the failures that testing exposed were fixed: the shop name is no longer taken from a slogan ("everyday low prices"), a column header, an address, or an item line, and dates printed on older receipts are now accepted',
      'You can jump straight to Scan from the Add transaction screen',
      'Balances accounts now separate money moving from a simple balance reading. "Log payment" on a debt takes the amount paid, brings the balance down and records an expense; "Add to savings" takes the amount added, puts the balance up and records an expense; "Log repayment" on money owed to you takes the amount repaid, brings it down and records income. "Update balance" is still there for when you just want to enter the new figure (a card balance rises from new spending too), and that never creates a transaction',
      'Each of those movements lets you pick the category it lands in, defaulting sensibly (an account called "Car loan" finds the matching category, savings default to Savings), and you can untick logging the transaction if you already entered it by hand',
      'Fixed the backup preview showing English text in other languages, and no longer says a file will be "converted automatically" while also saying it contains no usable data',
      'When someone pays you back, you can now mark that income as a repayment against an "owed to you" account — the money is logged and what they still owe comes down in one step, with a preview of the new balance before you save',
      'Scan several receipts at once: pick as many screenshots as you like, review them all in one list, drop any you do not want, and save them together. Likely duplicates of things you already have are flagged',
      'The dashboard now leads with how much is left to spend this pay period and how many days it has to last, instead of a "% of budget used" figure that could read over 100% just because a big unbudgeted expense like rent had landed',
      'A pace bar shows how fast money is going against how far through the period you are, so overspending is visible before the period ends',
      'Consistent colours throughout: mint always means money in, apricot money out, and the alert colour is reserved for genuinely over-budget',
      'Navigation lives in a slide-out menu behind the top-left button, with every screen one tap away',
      'The trend chart and category breakdown now live under an "Insights" section, and categories with no activity are tucked behind a "Show unused" toggle, so the first thing you see stays glanceable',
      'Amounts and month names now follow your chosen language properly (correct thousands separators and localised months), and month-over-month figures are shown plainly rather than as an alarming percentage'
    ]
  },
  {
    version: '2.0.0',
    summary: 'Data integrity hardening and weekend-aware pay periods',
    changes: [
      'Money is now stored as integer cents internally instead of decimal floats, preventing rounding drift when summing many transactions',
      'Deleting a category now archives it instead of erasing it — old transactions keep showing its name and icon correctly, and it can be restored',
      'Deleting a transaction now shows an "Undo" toast for a few seconds instead of a confirmation prompt',
      'Backups are now tagged with a schema version, export date, and app version',
      'Restoring a backup shows a preview of what it contains before anything is replaced, and automatically downloads a safety copy of current data first',
      'Bulk transaction import now flags likely duplicates (same date, amount, and note) so they can be skipped or deliberately kept',
      'A pay day that falls on a weekend is now treated as landing on the nearest working day before it, matching how salary payments actually settle'
    ]
  },
  {
    version: '1.6.0',
    summary: 'First-run setup and gesture navigation',
    changes: [
      'A first-run setup wizard now walks new installs through language, currency, pay day, which categories to keep, and an optional first income entry',
      'Swipe left or right on the dashboard to move between periods',
      'Tap a bar in the trend chart to jump straight to that period',
      'Added a proper edge-swipe-back gesture to return to the previous screen, including stepping back one level inside Settings',
      'The trend chart now shows income and spending as separate bars over the last 3 months instead of one 6-month expense-only bar',
      'Fixed a duplicated category filter indicator on the Activity screen'
    ]
  },
  {
    version: '1.5.0',
    summary: 'Pay periods instead of calendar months',
    changes: [
      'Added a configurable pay day in Settings — the whole app now reorganizes around a real salary cycle (e.g. the 19th to the 18th) instead of the 1st to the end of the calendar month',
      'Bills correctly account for a due day that falls on the other side of payday within a period'
    ]
  },
  {
    version: '1.4.0',
    summary: 'Visual fixes and a new app icon',
    changes: [
      'New diamond app icon, replacing the original gold monogram',
      'Added an "Add to Home Screen" reminder for anyone opening the app in a browser instead of the installed version',
      'Fixed the budget gauge freezing at 100% — it now shows the real number and turns red when over budget',
      'Fixed input fields zooming in unexpectedly on iOS by correcting their font size',
      'Restored the category breakdown donut chart, which had been dropped by mistake during an earlier rewrite',
      'Choosing "Import transactions now" during setup now goes straight to the import screen instead of the general Settings menu',
      'Added a guard screen with a QR code for anyone opening the app on a desktop browser instead of a phone'
    ]
  },
  {
    version: '1.3.0',
    summary: 'Search, security, and smarter budgeting',
    changes: [
      'Added search by note across all transactions',
      'Added an optional passcode lock',
      'Categories can now roll over unused budget into the next month',
      'The dashboard now shows a spending trend versus last month per category, plus a 6-month chart',
      'Fixed bills due near the end of the month breaking in shorter months like February',
      'Prepared the project for automatic deploys from GitHub'
    ]
  },
  {
    version: '1.2.0',
    summary: 'Languages, reorganized settings, and refined scanning',
    changes: [
      'Added French, Brazilian Portuguese, Italian, and Spanish',
      'Settings reorganized into a proper menu of sub-screens instead of one long scroll',
      'Tapping a category on the dashboard now jumps to a filtered, pre-scoped view of its transactions',
      'The screenshot scanner now prefers a line that says "total" for the amount, filters out receipt boilerplate when guessing the merchant, and shows the raw recognized text for transparency',
      'General spacing and margin fixes across several screens'
    ]
  },
  {
    version: '1.1.0',
    summary: 'Recurring bills and a cleaner nav bar',
    changes: [
      'Replaced the bottom tab bar with a floating hamburger menu',
      'Bills are now genuinely recurring — a due day each month with paid status tracked per month, instead of one-off entries',
      'Added a third Balances account type for money other people owe you',
      'Fixed a same-day balance update sorting bug that could show the wrong figure as the latest value',
      'Fixed the date input field rendering as an odd oversized pill on iOS'
    ]
  },
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
