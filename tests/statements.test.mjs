// Statement import: Bank of Ireland CSV and Revolut CSV are read, rows already
// in Gild are skipped (including a move already counted from the other
// account), shops get last time's category, bills tick themselves off, and
// the bank's balance is checked.
globalThis.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.has(k) ? this._m.get(k) : null },
  setItem(k, v) { this._m.set(k, String(v)) },
  removeItem(k) { this._m.delete(k) }
}
const db = await import('../src/db.js')
const st = await import('../src/statements.js')
let pass = 0, fail = 0
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('FAIL:', msg) } }

// --- parsing ---------------------------------------------------------------
ok(JSON.stringify(st.parseCsv('a,"b, c","d ""e"""\r\n1,2,3\n')) === JSON.stringify([['a', 'b, c', 'd "e"'], ['1', '2', '3']]), 'CSV quotes, commas and CRLF')

const boi = `Date,Details,Debit,Credit,Balance
16/11/2026,POSC15NOV SV MAINSTREET,21.53,,410.00
12/11/2026,POS11NOV PLAYSTATION,18.99,,
12/11/2026,C1111GB  6.75@1.20000,8.10,,
12/11/2026,NECLSCHGGBP 000000.16,0.16,,
05/11/2026,POSC04NOV MCDONALDS70,31.20,,
04/11/2026,POS03NOV Revolut**000,100.00,,
03/01/2027,POSC31DEC SV MAINSTREET,5.00,,
19/11/2026,ACME LTD  SALARY,,3000.00,
`
const pb = st.detectStatement(boi)
ok(pb.bank === 'boi' && pb.rows.length === 8, 'BOI detected')
ok(pb.rows[0].date === '2026-11-15' && pb.rows[0].name === 'Sv Mainstreet' && pb.rows[0].amount === -21.53, `the card code's date wins (${pb.rows[0].date})`)
ok(pb.rows[2].name === 'Card purchase (GBP 6.75)' && pb.rows[2].date === '2026-11-11', `foreign purchase (${pb.rows[2].name}, ${pb.rows[2].date})`)
ok(pb.rows[3].name === 'Non-euro transaction fee', 'fee line')
ok(pb.rows[6].date === '2026-12-31', `a December code posting in January is last year (${pb.rows[6].date})`)
ok(pb.rows[7].amount === 3000, 'credit is income')
ok(pb.endBalance.balance === 410 && pb.endBalance.date === '2026-11-16', 'closing balance from the newest row')

const rev = `Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
CARD_PAYMENT,Current,2026-11-20 10:00:00,2026-11-21 09:00:00,Tesco,-12.50,0.00,EUR,COMPLETED,87.50
TOPUP,Current,2026-11-19 08:00:00,2026-11-19 08:00:01,Apple Pay top-up by *0000,100.00,0.00,EUR,COMPLETED,100.00
TRANSFER,Current,2026-11-22 08:00:00,2026-11-22 08:00:00,Bankinter,-640.00,0.00,EUR,COMPLETED,-552.50
CARD_PAYMENT,Current,2026-11-23 08:00:00,,Uber,-38.61,0.00,EUR,REVERTED,
EXCHANGE,Current,2026-11-24 08:00:00,2026-11-24 08:00:00,Exchanged to USD,-50.00,0.50,EUR,COMPLETED,-603.00
`
const pr = st.detectStatement(rev)
ok(pr.bank === 'revolut' && pr.product === 'current', 'Revolut detected')
ok(pr.rows.length === 5, `reverted skipped, fee split out (${pr.rows.length})`)
ok(pr.rows.some((r) => r.name === 'Fee: Exchanged to USD' && r.amount === -0.5), 'fee row')
ok(pr.endBalance.balance === -603 && pr.endBalance.date === '2026-11-24', 'Revolut closing balance')
ok(st.detectStatement('hello,world\n1,2') === null, 'unknown file')

const accounts = [
  { id: 'main', name: 'Current account', primary: true, anchor: { enabled: true, openingValue: 600, openingDate: '2026-11-01' } },
  { id: 'revolut', name: 'Revolut', anchor: { enabled: true, openingValue: 0, openingDate: '2026-11-01' } },
  { id: 'revolut-savings', name: 'Revolut Savings', anchor: { enabled: true, openingValue: 0, openingDate: '2026-11-01' } },
  { id: 'avant', name: 'Credit card (Avant)', anchor: { enabled: true, openingValue: -2000, openingDate: '2026-11-01' } }
]
ok(st.suggestAccount(pb, accounts) === 'main' && st.suggestAccount(pr, accounts) === 'revolut', 'account suggestions')
ok(st.suggestAccount({ bank: 'revolut', product: 'savings' }, accounts) === 'revolut-savings', 'savings statement → savings account')

// --- matching ----------------------------------------------------------------
const categories = [
  { id: 'food', name: 'Food', kind: 'expense' },
  { id: 'utilities', name: 'Utilities', kind: 'expense' },
  { id: 'other', name: 'Other', kind: 'expense' },
  { id: 'wages', name: 'Wages', kind: 'income' },
  { id: 'transfers', name: 'Transfers', kind: 'expense', transfer: true },
  { id: 'transfers-in', name: 'Transfers in', kind: 'income', transfer: true }
]
const history = [
  { id: 'h1', type: 'expense', amount: 30.1, date: '2026-10-20', note: 'SV Mainstreet', categoryId: 'food', accountId: 'main' },
  { id: 'h2', type: 'expense', amount: 35, date: '2026-10-21', note: "McDonald's", categoryId: 'food', accountId: 'main' },
  { id: 'h3', type: 'expense', amount: 228, date: '2026-10-29', note: 'Revolut**000 top-up', categoryId: 'transfers', transfer: true, accountId: 'main' },
  { id: 'h4', type: 'expense', amount: 18.99, date: '2026-10-09', note: 'PlayStation Premium', bankNote: 'POS09OCT PLAYSTATION', categoryId: 'utilities', accountId: 'main' },
  { id: 'h5', type: 'expense', amount: 100, date: '2026-10-04', note: 'Avant card payment', bankNote: 'Bankinter', categoryId: 'transfers', transfer: true, counterAccountId: 'avant', accountId: 'revolut' },
  { id: 'h6', type: 'income', amount: 100, date: '2026-10-29', note: 'Apple Pay top-up by *0000', categoryId: 'transfers-in', transfer: true, accountId: 'revolut' },
  // already in: McDonald's on 4 Nov
  { id: 'd1', type: 'expense', amount: 31.2, date: '2026-11-04', note: "McDonald's", categoryId: 'food', accountId: 'main' },
  { id: 'w0', type: 'income', amount: 3000.00, date: '2026-10-19', note: 'Acme Ltd', categoryId: 'wages', accountId: 'main' }
]
const bills = [
  { id: 'ps', name: 'PlayStation Premium', amount: 18.99, categoryId: 'utilities', dueDay: 22, payments: { '2026-09': { transactionId: 'h4' } } },
  { id: 'card', name: 'Credit card (Avant)', amount: 640, categoryId: 'transfers', dueDay: 19, payments: {}, counterAccountId: 'avant', startPeriod: '2026-11' }
]
const prepB = st.prepareImport({ parsed: pb, accountId: 'main', transactions: history, bills, categories, accounts, payDay: 19 })
const row = (name) => prepB.rows.find((r) => r.bankNote.includes(name))
ok(row('SV MAINSTREET').categoryId === 'food' && row('SV MAINSTREET').why === 'learned' && row('SV MAINSTREET').note === 'SV Mainstreet', "shop filed like last time, with last time's name")
ok(row('MCDONALDS70').status === 'duplicate', 'already in Gild is skipped')
ok(row('Revolut**000').transfer && row('Revolut**000').categoryId === 'transfers', 'top-up is a transfer')
ok(row('PLAYSTATION').billId === 'ps' && row('PLAYSTATION').billPeriod === '2026-10' && row('PLAYSTATION').categoryId === 'utilities', `pays the PlayStation bill in its period (${row('PLAYSTATION').billPeriod})`)
ok(row('C1111GB').categoryId === null && row('C1111GB').why === 'none', 'generic line needs a category')
ok(row('ACME').categoryId === 'wages', 'salary learned')
ok(prepB.counts.new === 7 && prepB.counts.already === 1, `counts (${JSON.stringify(prepB.counts)})`)

const prepR = st.prepareImport({ parsed: pr, accountId: 'revolut', transactions: history, bills, categories, accounts, payDay: 19 })
const rr = (name) => prepR.rows.find((r) => r.bankNote === name)
ok(rr('Bankinter').transfer && rr('Bankinter').counterAccountId === 'avant', 'card payment learned as a transfer to the card')
ok(rr('Bankinter').billId === 'card' && rr('Bankinter').billPeriod === '2026-11', 'and pays the card bill')
ok(rr('Apple Pay top-up by *0000').transfer && rr('Apple Pay top-up by *0000').categoryId === 'transfers-in', 'top-up in is a transfer in')
ok(rr('Tesco').categoryId === null, 'a new shop needs a category')

// balance check (Revolut: 0 opening + 100 − 12.50 − 640 − 50 − 0.50 = −603)
ok(prepR.balanceCheck && prepR.balanceCheck.matches && prepR.balanceCheck.gild === -603, `balance matches (${JSON.stringify(prepR.balanceCheck)})`)
const off = st.prepareImport({ parsed: { ...pr, endBalance: { date: '2026-11-24', balance: -600 } }, accountId: 'revolut', transactions: history, bills, categories, accounts, payDay: 19 })
ok(off.balanceCheck && !off.balanceCheck.matches, 'a gap is flagged')

// mirror: importing the savings statement after the current one recorded the move
const withMove = [...history, { id: 'm1', type: 'expense', amount: 700, date: '2026-11-19', note: 'To EUR Flexible Cash Funds', categoryId: 'transfers', transfer: true, counterAccountId: 'revolut-savings', accountId: 'revolut' }]
const sav = st.detectStatement(`Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
TRANSFER,Savings,2026-11-19 09:00:00,2026-11-19 09:00:00,From EUR Current,700.00,0.00,EUR,COMPLETED,700.00
INTEREST,Savings,2026-11-20 09:00:00,2026-11-20 09:00:00,Interest earned,0.12,0.00,EUR,COMPLETED,700.12
`)
ok(sav.product === 'savings', 'savings statement')
const prepS = st.prepareImport({ parsed: sav, accountId: 'revolut-savings', transactions: withMove, bills, categories, accounts, payDay: 19 })
ok(prepS.rows[0].status === 'mirror', 'a move already counted from the other side is skipped')
ok(prepS.rows[1].status === 'new' && prepS.balanceCheck?.matches, `interest is new and the balance matches (${JSON.stringify(prepS.balanceCheck)})`)

// --- saving ------------------------------------------------------------------
await db.importBackup({
  schemaVersion: 2,
  ft_payday: 19,
  ft_categories: categories,
  ft_accounts: accounts.map((a) => ({ ...a, anchor: { ...a.anchor, openingValue: Math.round(a.anchor.openingValue * 100) } })),
  ft_bills: [{ ...bills[1], amount: 64000, balanceAccountId: 'debtcard' }],
  ft_balances: [{ id: 'debtcard', name: 'Card', type: 'debt', entries: [{ date: '2026-11-01', value: 200000 }] }],
  ft_transactions: []
})
const res = await db.importStatementRows(prepR.rows.map((r) => ({ ...r, categoryId: r.categoryId || 'other' })))
ok(res.added === 5 && res.billsMarked === 1, `saved (${JSON.stringify(res)})`)
const saved = await db.getTransactions()
const pay = saved.find((t) => t.bankNote === 'Bankinter')
ok(pay.transfer && pay.counterAccountId === 'avant' && pay.source === 'import', 'saved as a transfer to the card, with the bank text kept')
const billNow = (await db.getBills())[0]
ok(billNow.payments['2026-11']?.transactionId === pay.id, 'bill marked paid by the imported row')
const card = (await db.getBalances())[0]
ok(db.latestEntry(card).value === 1360, `card balance down by 640 (${db.latestEntry(card).value})`)
await db.deleteTransaction(pay.id)
ok(db.latestEntry((await db.getBalances())[0]).value === 2000, 'deleting the row puts the card back')

// --- Avant PDF ----------------------------------------------------------------
const { linesFromTextItems } = await import('../src/pdfText.js')
const item = (str, x, y, width = str.length * 5) => ({ str, transform: [1, 0, 0, 1, x, y], width })
const lines = linesFromTextItems([[item('Amount', 300, 700), item('Date', 10, 700), item('62.75', 400, 650), item('20 Oct 26 20 Oct 26 ET Airbnb', 10, 651), item('Car', 160, 650)]])
ok(lines[0] === 'Date Amount' && lines[1] === '20 Oct 26 20 Oct 26 ET Airbnb Car 62.75', `PDF pieces rebuilt into lines (${JSON.stringify(lines)})`)

const avant = [
  'Your Avant Money', 'Statement date', 'Transaction Posting Promotional Description of Transactions Amount € 06 Dec 26',
  'Balance previous statement 1,900.00',
  '20 Nov 26 21 Nov 26 ET TESCO STORES DUBLIN IRL 40.00 Available to spend',
  '24 Nov 26 26 Nov 26 SHOP CO. CHICAGO IL 21.75 Download the Avant Money App &',
  'Exchange Rate: 0.894326 €2,699.87', '24/11/26 24.32 USD',
  '24 Nov 26 26 Nov 26 FOREIGN CURRENCY FEE 0.58',
  'Balance from previous page 2,351.06',
  '19 Nov 26 19 Nov 26 CARD PAYMENT RECEIVED - THANK YOU 640.00 Cr',
  '06 Dec 26 06 Dec 26 FINANCE CHARGE 20.00',
  'Current Statement Balance 1,742.46', 'Total Payment Due must be received by 02 Jan 27'
]
const pa = st.detectPdfStatement(avant)
ok(pa && pa.bank === 'avant' && pa.rows.length === 5, `Avant statement read (${pa && pa.rows.length})`)
ok(pa.rows[0].name === 'Tesco Stores Dublin Irl' && pa.rows[0].amount === -40 && pa.rows[0].date === '2026-11-20', `plan code dropped, purchase (${pa.rows[0].name})`)
ok(pa.rows[1].name === 'Shop Co. Chicago Il (USD 24.32)' && pa.rows[1].amount === -21.75, `foreign purchase keeps its currency (${pa.rows[1].name})`)
ok(pa.rows[2].name === 'Foreign currency fee (Avant)' && pa.rows[4].name === 'Interest (Avant)', 'fees and interest named')
ok(pa.rows[3].amount === 640 && pa.rows[3].transfer === true, 'a payment onto the card is a transfer in')
ok(pa.endBalance.balance === -1742.46 && pa.endBalance.date === '2026-12-06', `closing balance is owed, dated the statement (${JSON.stringify(pa.endBalance)})`)
ok(st.detectPdfStatement(['Some other bank', '01 Jan 26 01 Jan 26 THING 1.00']) === null, 'not Avant')
ok(st.suggestAccount(pa, accounts) === 'avant', 'Avant → the card account')

// card payment: imported from the card first, then from Revolut, counted once
const cardFirst = [
  ...history,
  { id: 'cp', type: 'income', amount: 640, date: '2026-11-19', note: 'Card payment received', categoryId: 'transfers-in', transfer: true, accountId: 'avant' }
]
const revPay = st.detectStatement(`Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
TRANSFER,Current,2026-11-19 08:00:00,2026-11-19 08:00:00,Bankinter,-640.00,0.00,EUR,COMPLETED,-640.00
`)
const pp = st.prepareImport({ parsed: revPay, accountId: 'revolut', transactions: cardFirst, bills, categories, accounts, payDay: 19 })
ok(pp.rows[0].transfer && !pp.rows[0].counterAccountId, 'the card already has its side, so no far-end counting')
// and the other way round: Revolut first (with the card as far end), then the card statement
const revFirst = [...history, { id: 'rp', type: 'expense', amount: 640, date: '2026-11-19', note: 'Avant card payment', bankNote: 'Bankinter', categoryId: 'transfers', transfer: true, counterAccountId: 'avant', accountId: 'revolut' }]
const pc = st.prepareImport({ parsed: pa, accountId: 'avant', transactions: revFirst, bills, categories, accounts, payDay: 19 })
ok(pc.rows.find((r) => r.amount === 640).status === 'mirror', 'the card statement skips a payment already counted from Revolut')

// Trip-pot bill paid in Gild (current account → savings), then the Revolut
// statement's own leg into savings arrives: savings must count it once.
const billPaid = [...history, { id: 'bp', type: 'expense', amount: 700, date: '2026-11-19', note: 'Trip pot', categoryId: 'transfers', transfer: true, accountId: 'main', counterAccountId: 'revolut-savings', source: 'bill' },
  { id: 'hs', type: 'expense', amount: 5, date: '2026-10-01', note: 'To EUR Flexible Cash Funds', categoryId: 'transfers', transfer: true, counterAccountId: 'revolut-savings', accountId: 'revolut' }]
const revLeg = st.detectStatement(`Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
TOPUP,Current,2026-11-19 08:00:00,2026-11-19 08:00:00,Apple Pay top-up by *0000,700.00,0.00,EUR,COMPLETED,700.00
TRANSFER,Current,2026-11-19 08:05:00,2026-11-19 08:05:00,To EUR Flexible Cash Funds,-700.00,0.00,EUR,COMPLETED,0.00
`)
const pl = st.prepareImport({ parsed: revLeg, accountId: 'revolut', transactions: billPaid, bills, categories, accounts, payDay: 19 })
const leg = pl.rows.find((r) => r.amount === 700 && r.type === 'expense')
ok(leg.status === 'new' && leg.transfer && !leg.counterAccountId, 'the Revolut leg counts for Revolut only, not into savings again')
ok(pl.balanceCheck?.matches, `Revolut balance still matches (${JSON.stringify(pl.balanceCheck)})`)

console.log(`statements: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
