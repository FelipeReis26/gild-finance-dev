// Bank statement import: reads a statement file on the device and works out
// what's new, what's already in Gild, which rows are transfers between the
// person's own accounts, which bills they pay, and what category each shop
// belongs to (from what it was filed under before). Pure functions only, so
// it's all testable without a phone; db.importStatementRows does the saving.
//
// Supported: Bank of Ireland CSV (Date, Details, Debit, Credit, Balance) and
// Revolut CSV (the statement's "Excel" option: Type, Product, Started Date,
// Completed Date, Description, Amount, Fee, Currency, State, Balance).
import { inPeriod, accountBalance, isExcludedFromTotals, accountOf } from './db.js'

const MONTHS = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 }
const COUNTRY_CURRENCY = { GB: 'GBP', US: 'USD', CA: 'CAD', CH: 'CHF', BR: 'BRL', QA: 'QAR', AE: 'AED', AU: 'AUD', JP: 'JPY', SE: 'SEK', DK: 'DKK', NO: 'NOK', PL: 'PLN', CZ: 'CZK', HU: 'HUF', TR: 'TRY' }

const pad = (n) => String(n).padStart(2, '0')
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`
const cents = (v) => Math.round(Number(v) * 100)
const money = (s) => {
  const v = parseFloat(String(s ?? '').replace(/[€$£,\s]/g, ''))
  return Number.isFinite(v) ? v : null
}

// --- CSV -------------------------------------------------------------------
export function parseCsv(text) {
  const src = String(text || '').replace(/^﻿/, '')
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      if (row.some((f) => f.trim() !== '')) rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  row.push(field)
  if (row.some((f) => f.trim() !== '')) rows.push(row)
  return rows
}

const titleCase = (s) =>
  s
    .toLowerCase()
    .replace(/(^|[\s/*\-(])([a-z])/g, (m, p, c) => p + c.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim()

// --- Bank of Ireland -------------------------------------------------------
// Details look like "POSC15NOV CORNER SHOP": a card code carrying the real
// purchase date, then the shop. The Date column is when it posted, so the
// code's date wins (that's how the existing rows were stored).
export function cleanBoiDetails(details, postedIso) {
  const raw = String(details || '').trim()
  const [py, pm] = postedIso.split('-').map(Number)
  const withYear = (day, mon) => {
    // a code from late December posting in January belongs to last year
    const y = mon > pm ? py - 1 : py
    return iso(y, mon, day)
  }
  let m = raw.match(/^POSC?\s?(\d{2})([A-Z]{3})\s+(.*)$/)
  if (m && MONTHS[m[2]]) return { date: withYear(Number(m[1]), MONTHS[m[2]]), name: titleCase(m[3]), bank: raw }
  m = raw.match(/^C(\d{2})(\d{2})([A-Z]{2})\s+([\d.]+)@/)
  if (m) {
    const cur = COUNTRY_CURRENCY[m[3]] || m[3]
    return { date: withYear(Number(m[1]), Number(m[2])), name: `Card purchase (${cur} ${m[4]})`, bank: raw }
  }
  m = raw.match(/^NECLSCHG([A-Z]{3})/)
  if (m) return { date: postedIso, name: 'Non-euro transaction fee', bank: raw }
  m = raw.match(/^(?:D\/D|DD|SO|BP|365 ONLINE|TO A\/C|FROM A\/C)\s*(.*)$/i)
  if (m && m[1]) return { date: postedIso, name: titleCase(m[1]), bank: raw }
  return { date: postedIso, name: titleCase(raw), bank: raw }
}

function parseBoi(rows) {
  const head = rows[0].map((h) => h.trim().toLowerCase())
  const ix = (n) => head.indexOf(n)
  const [iD, iDet, iDr, iCr, iBal] = [ix('date'), ix('details'), ix('debit'), ix('credit'), ix('balance')]
  const out = []
  let end = null
  for (const r of rows.slice(1)) {
    const dm = (r[iD] || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (!dm) continue
    const posted = iso(Number(dm[3]), Number(dm[2]), Number(dm[1]))
    const debit = money(r[iDr])
    const credit = money(r[iCr])
    if (debit == null && credit == null) continue
    const c = cleanBoiDetails(r[iDet], posted)
    const bal = money(r[iBal])
    // newest first in the file: the first balance seen at the latest posting date
    if (bal != null && (!end || posted > end.date)) end = { date: posted, balance: bal }
    out.push({ date: c.date, posted, name: c.name, bankNote: c.bank, amount: debit != null ? -debit : credit })
  }
  return { bank: 'boi', bankName: 'Bank of Ireland', product: 'current', rows: out, endBalance: end }
}

// --- Revolut ---------------------------------------------------------------
function parseRevolut(rows) {
  const head = rows[0].map((h) => h.trim().toLowerCase())
  const ix = (n) => head.indexOf(n)
  const c = {
    type: ix('type'),
    product: ix('product'),
    started: ix('started date'),
    completed: ix('completed date'),
    desc: ix('description'),
    amount: ix('amount'),
    fee: ix('fee'),
    currency: ix('currency'),
    state: ix('state'),
    balance: ix('balance')
  }
  const out = []
  const products = new Map()
  let end = null
  for (const r of rows.slice(1)) {
    const state = (r[c.state] || '').trim().toUpperCase()
    if (state && state !== 'COMPLETED') continue // reverted, pending, declined
    const when = (r[c.started] || r[c.completed] || '').trim().slice(0, 10)
    const doneAt = (r[c.completed] || r[c.started] || '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(when)) continue
    const amount = money(r[c.amount])
    if (amount == null) continue
    const fee = money(r[c.fee]) || 0
    const desc = (r[c.desc] || '').trim()
    const product = (r[c.product] || 'Current').trim()
    products.set(product, (products.get(product) || 0) + 1)
    const currency = (r[c.currency] || 'EUR').trim()
    const bal = money(r[c.balance])
    if (bal != null && (!end || doneAt > end.at)) end = { at: doneAt, date: doneAt.slice(0, 10), balance: bal }
    if (amount !== 0) out.push({ date: when, name: desc, bankNote: desc, amount, currency, type: (r[c.type] || '').trim() })
    if (fee) out.push({ date: when, name: `Fee: ${desc}`, bankNote: `Fee: ${desc}`, amount: -Math.abs(fee), currency, type: 'FEE' })
  }
  const main = [...products.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'Current'
  return {
    bank: 'revolut',
    bankName: 'Revolut',
    product: /saving|deposit|flexible/i.test(main) ? 'savings' : 'current',
    rows: out,
    endBalance: end ? { date: end.date, balance: end.balance } : null
  }
}

// --- Avant Money (PDF) -------------------------------------------------------
// Avant statements only come as PDFs. Read as lines (pdfText.js), each
// transaction is "20 Oct 26 20 Oct 26 [plan code] DESCRIPTION 62.75 [Cr]",
// sometimes with the next column's text run on after the amount. A foreign
// purchase adds "Exchange Rate: …" and "24/10/26 24.32 USD" lines after it.
const AVANT_NAMES = [
  [/^FINANCE CHARGE/i, 'Interest (Avant)'],
  [/^LATE FEE/i, 'Late fee (Avant)'],
  [/^FOREIGN CURRENCY FEE/i, 'Foreign currency fee (Avant)'],
  [/^OVERLIMIT/i, 'Over-limit fee (Avant)'],
  [/^CARD PAYMENT RECEIVED/i, 'Card payment received'],
  [/^GOVERNMENT STAMP DUTY/i, 'Government stamp duty (Avant)']
]
const avDate = (s) => {
  const m = String(s).match(/(\d{2}) ([A-Z][a-z]{2}) (\d{2})/)
  return m && MONTHS[m[2].toUpperCase()] ? iso(2000 + Number(m[3]), MONTHS[m[2].toUpperCase()], Number(m[1])) : null
}

export function parseAvantLines(lines) {
  const L = (lines || []).map((l) => String(l).replace(/\s+/g, ' ').trim())
  if (!L.some((l) => /avant money|avantmoney/i.test(l))) return null
  const rows = []
  let statementDate = null
  let closing = null
  const sd = L.findIndex((l) => /^Statement date/i.test(l))
  if (sd >= 0) for (const l of L.slice(sd, sd + 4)) if (!statementDate) statementDate = avDate(l)
  for (let i = 0; i < L.length; i++) {
    const l = L[i]
    const close = l.match(/^Current Statement Balance ([\d,]+\.\d{2})/)
    if (close) closing = money(close[1])
    const m = l.match(/^(\d{2} [A-Z][a-z]{2} \d{2}) (\d{2} [A-Z][a-z]{2} \d{2}) (.+?) ([\d,]+\.\d{2})( Cr)?(?: .*)?$/)
    if (!m) continue
    let desc = m[3].replace(/^[A-Z]{2} (?=\S)/, '') // promotional plan code ("ET")
    const amount = money(m[4])
    const credit = Boolean(m[5])
    let foreign = null
    for (const next of L.slice(i + 1, i + 3)) {
      const fx = next.match(/^\d{2}\/\d{2}\/\d{2} ([\d.,]+) ([A-Z]{3})\b/)
      if (fx) foreign = `${fx[2]} ${fx[1]}`
    }
    const known = AVANT_NAMES.find(([re]) => re.test(desc))
    const name = known ? known[1] : `${titleCase(desc)}${foreign ? ` (${foreign})` : ''}`
    // a payment onto the card is money moving between the person's accounts
    const transfer = /^CARD PAYMENT RECEIVED/i.test(desc)
    rows.push({ date: avDate(m[1]), posted: avDate(m[2]), name, bankNote: desc, amount: credit ? amount : -amount, ...(transfer ? { transfer: true } : {}) })
  }
  if (!rows.length) return { bank: 'avant', bankName: 'Avant Money', product: 'card', rows, endBalance: null }
  const last = rows.map((r) => r.date).sort().pop()
  return {
    bank: 'avant',
    bankName: 'Avant Money',
    product: 'card',
    rows,
    // the card's balance is money owed, so in Gild it's below zero
    endBalance: closing != null ? { date: statementDate || last, balance: -closing } : null
  }
}

export function detectPdfStatement(lines) {
  const parsed = parseAvantLines(lines)
  if (!parsed) return null
  const dates = parsed.rows.map((r) => r.date).sort()
  return { ...parsed, from: dates[0] || null, to: dates[dates.length - 1] || null }
}

// Works out which bank a file came from. Returns null if it's neither.
export function detectStatement(text) {
  const rows = parseCsv(text)
  if (!rows.length) return null
  const head = rows[0].map((h) => h.trim().toLowerCase())
  let parsed = null
  if (['date', 'details', 'debit', 'credit'].every((h) => head.includes(h))) parsed = parseBoi(rows)
  else if (['description', 'amount'].every((h) => head.includes(h)) && (head.includes('started date') || head.includes('completed date')))
    parsed = parseRevolut(rows)
  if (!parsed || !parsed.rows.length) return parsed && { ...parsed, from: null, to: null }
  const dates = parsed.rows.map((r) => r.date).sort()
  return { ...parsed, from: dates[0], to: dates[dates.length - 1] }
}

// Which Gild account a statement most likely belongs to.
export function suggestAccount(parsed, accounts) {
  const list = accounts || []
  const by = (re) => list.find((a) => re.test(`${a.id} ${a.name}`))
  if (parsed.bank === 'avant') return (by(/avant|credit card/i) || list[0])?.id
  if (parsed.bank === 'boi') return (by(/bank of ireland|boi/i) || list.find((a) => a.primary) || by(/current|main/i) || list[0])?.id
  if (parsed.product === 'savings') return (by(/flexible|saving/i) || by(/revolut/i) || list[0])?.id
  return (list.find((a) => /revolut/i.test(`${a.id} ${a.name}`) && !/saving|flexible/i.test(`${a.id} ${a.name}`)) || list[0])?.id
}

// --- Matching --------------------------------------------------------------
// Shop names compared with only their letters: "MCDONALDS70", "McDonald's"
// and "mcdonalds" are the same shop; a cut-off name ("THE BAR WIT") matches
// the full one ("The Bar Down The Road") by prefix, from five letters up.
export const letters = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '')
// A bank line's shop part: the card code with its date ("POSC15NOV ") would
// otherwise make the same shop look different every month.
const shopKey = (s) => letters(String(s || '').replace(/^POSC?\s?\d{2}[A-Z]{3}\s+/i, ''))

function nameMatches(a, b) {
  if (!a || !b) return false
  if (a === b) return true
  const [s, l] = a.length <= b.length ? [a, b] : [b, a]
  return s.length >= 5 && l.startsWith(s)
}

// Most recent filing of each shop, from the existing transactions. Bill
// rows ("source: bill") carry the bill's name, not the shop's, so they're left out.
function buildHistory(transactions) {
  return [...(transactions || [])]
    .filter((t) => t.source !== 'bill' && t.note)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((t) => ({ t, keys: [shopKey(t.bankNote), letters(t.note)].filter(Boolean) }))
}

function lookup(history, raw, name, accountId, type) {
  const keys = [shopKey(raw), letters(name)].filter(Boolean)
  let fallback = null
  for (const h of history) {
    if (h.t.type !== type) continue
    if (!keys.some((k) => h.keys.some((hk) => nameMatches(k, hk)))) continue
    if (h.t.accountId === accountId) return h.t
    fallback = fallback || h.t
  }
  return fallback
}

const GENERIC_LINE = /^(card purchase|non-euro transaction fee|exchanged to|cash withdrawal)/i

const dayDiff = (a, b) => Math.abs(Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86400000

// Turns a parsed statement into import rows. Each row: { key, date, note,
// bankNote, amount (positive), type, categoryId, transfer, counterAccountId,
// billId, billPeriod, why, status: 'new' | 'duplicate' | 'mirror' }.
// Also checks the bank's closing balance against what Gild would show.
export function prepareImport({ parsed, accountId, transactions, bills, categories, accounts, payDay, currencyCode = 'EUR' }) {
  const history = buildHistory(transactions)
  const catById = Object.fromEntries((categories || []).map((c) => [c.id, c]))
  const transferOut = (categories || []).find((c) => c.transfer && c.kind !== 'income')?.id || 'transfers'
  // a transfer only stays a transfer under a transfer category; with no
  // income-side one, any transfer category keeps it out of the totals
  const transferIn = (categories || []).find((c) => c.transfer && c.kind === 'income')?.id || (categories || []).find((c) => c.transfer)?.id || 'transfers-in'
  // rows without an account belong to the primary one (bill rows, older rows)
  const acctOf = (t) => accountOf(t, accounts)
  const used = new Set()
  const billUsed = new Set()
  const periodOf = (date) => {
    // the pay period a date falls in
    const [y, m] = date.split('-').map(Number)
    for (const k of [`${y}-${pad(m)}`, m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`]) if (inPeriod(date, k, payDay)) return k
    return `${y}-${pad(m)}`
  }

  const rows = parsed.rows.map((r, i) => {
    const type = r.amount < 0 ? 'expense' : 'income'
    const amount = Math.abs(r.amount)
    const amt = cents(amount)
    const base = { key: `${i}`, date: r.date, bankNote: r.bankNote, amount, type, accountId }

    // Gild works in one currency; a row in another (a USD pocket on a Revolut
    // statement) would be saved as the same number in euros, so it's left out.
    if (r.currency && currencyCode && r.currency !== currencyCode) {
      return { ...base, note: `${r.name} (${r.currency} ${amount})`, categoryId: null, transfer: false, status: 'foreign' }
    }

    // Already in Gild: same account, direction and amount within three days.
    const dup = (transactions || []).find(
      (t) => !used.has(t.id) && acctOf(t) === accountId && t.type === type && cents(t.amount) === amt && dayDiff(t.date, r.date) <= 3
    )
    if (dup) {
      used.add(dup.id)
      return { ...base, note: dup.note, categoryId: dup.categoryId, transfer: Boolean(dup.transfer), status: 'duplicate', matchId: dup.id }
    }

    // Generic bank lines ("Card purchase (GBP 6.75)", fees) say nothing about
    // the shop, so they don't borrow an old row's name or category.
    const generic = GENERIC_LINE.test(r.name)
    const learned = generic ? null : lookup(history, r.bankNote, r.name, accountId, type)
    const isTransfer = Boolean(learned?.transfer || r.transfer)
    let counterAccountId = isTransfer ? learned?.counterAccountId : undefined
    // The far end already has this move as its own row (imported from that
    // account's statement first): then this row counts only here.
    // Likewise when another account's row already carried this money into the
    // same far end: tapping Paid on a savings-pot bill records current account
    // → savings, and the Revolut statement then shows its own "To Flexible
    // Cash Funds" leg of the same money. The savings side must only count once.
    if (
      counterAccountId &&
      (transactions || []).some(
        (t) =>
          t.transfer &&
          cents(t.amount) === amt &&
          dayDiff(t.date, r.date) <= 3 &&
          ((acctOf(t) === counterAccountId && !t.counterAccountId && t.type !== type) ||
            (t.counterAccountId === counterAccountId && acctOf(t) !== accountId && t.type === type))
      )
    )
      counterAccountId = undefined

    // Already counted from the other side: another account's row recorded
    // this move with this account as its far end.
    const mirror = (transactions || []).find(
      (t) =>
        !used.has(t.id) &&
        t.transfer &&
        t.counterAccountId === accountId &&
        acctOf(t) !== accountId &&
        t.type !== type &&
        cents(t.amount) === amt &&
        dayDiff(t.date, r.date) <= 2
    )
    if (mirror) {
      used.add(mirror.id)
      return { ...base, note: learned?.note || r.name, categoryId: type === 'expense' ? transferOut : transferIn, transfer: true, status: 'mirror', matchId: mirror.id }
    }

    let categoryId = learned ? learned.categoryId : null
    let why = learned ? (isTransfer ? 'transfer' : 'learned') : 'none'
    if (categoryId && (!catById[categoryId] || catById[categoryId].archived)) {
      categoryId = null
      why = 'none'
    }

    // Which bill this pays, if any: unpaid in the row's pay period, about the
    // same amount, and either the same shop as before or (for a transfer
    // bill) the same far-end account.
    let billId = null
    let billPeriod = null
    if (type === 'expense') {
      const period = periodOf(r.date)
      const keys = [shopKey(r.bankNote), letters(r.name), letters(learned?.note)].filter(Boolean)
      const bill = (bills || []).find((b) => {
        if (billUsed.has(`${b.id}|${period}`) || b.payments?.[period]) return false
        if (b.startPeriod && period < b.startPeriod) return false
        const near = Math.abs(cents(b.amount) - amt) <= Math.max(Math.round(cents(b.amount) * 0.1), 100)
        if (!near) return false
        const bCat = catById[b.categoryId]
        if (bCat?.transfer) return isTransfer && b.counterAccountId && b.counterAccountId === counterAccountId
        const paidKeys = Object.values(b.payments || {})
          .map((p) => (transactions || []).find((t) => t.id === p.transactionId))
          .filter(Boolean)
          .flatMap((t) => [shopKey(t.bankNote), letters(t.note)])
        return [letters(b.name), ...paidKeys].filter(Boolean).some((bk) => keys.some((k) => nameMatches(k, bk)))
      })
      if (bill) {
        billUsed.add(`${bill.id}|${period}`)
        billId = bill.id
        billPeriod = period
        if (!isTransfer) categoryId = bill.categoryId
        why = 'bill'
      }
    }

    if (isTransfer) categoryId = type === 'expense' ? transferOut : transferIn
    return {
      ...base,
      note: learned?.note || r.name,
      categoryId,
      transfer: isTransfer,
      ...(counterAccountId ? { counterAccountId } : {}),
      billId,
      billPeriod,
      why,
      status: 'new'
    }
  })

  // Balance check: the bank's closing figure against Gild's after the import,
  // counting only up to the statement's last day. Only meaningful when that
  // day is on or after the account's starting point.
  let balanceCheck = null
  const account = (accounts || []).find((a) => a.id === accountId)
  const endB = parsed.endBalance
  if (account && endB && account.anchor?.enabled && account.anchor.openingDate <= endB.date) {
    const added = rows
      .filter((r) => r.status === 'new')
      .map((r) => ({ id: `imp${r.key}`, type: r.type, amount: r.amount, date: r.date, accountId, categoryId: r.categoryId, transfer: r.transfer, counterAccountId: r.counterAccountId }))
    const upTo = [...(transactions || []), ...added].filter((t) => t.date <= endB.date)
    const result = accountBalance(account, upTo, accounts)
    if (result) {
      const gild = result.balance
      balanceCheck = { date: endB.date, bank: endB.balance, gild, matches: Math.abs(gild - endB.balance) < 0.005 }
    }
  }

  const counts = {
    new: rows.filter((r) => r.status === 'new').length,
    already: rows.filter((r) => r.status === 'duplicate' || r.status === 'mirror').length,
    foreign: rows.filter((r) => r.status === 'foreign').length,
    transfers: rows.filter((r) => r.status === 'new' && r.transfer).length,
    bills: rows.filter((r) => r.status === 'new' && r.billId).length
  }
  return { rows, counts, balanceCheck }
}

// Spending categories a row can be filed under, for the picker.
export function importCategories(categories, type) {
  return (categories || []).filter((c) => !c.archived && (type === 'income' ? c.kind === 'income' : c.kind !== 'income') && !isExcludedFromTotals(c))
}

