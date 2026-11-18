// Apple Pay payments from the Shortcuts automation. The native "Log Apple Pay
// in GILD" action (ios/App/App/AppDelegate.swift) appends each payment to an
// inbox file; this picks them up when Gild opens or comes back to the front,
// and they wait on the dashboard until confirmed. Nothing is logged silently:
// the trigger's text varies, and it only sees Apple Pay, not card taps,
// online orders or direct debits (the statement import covers those).
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { isNativeApp } from './deviceStore.js'

const INBOX = 'gild-applepay-inbox.json'
const TAKING = 'gild-applepay-inbox.taking.json'

// "€31.20", "31,20 €", "EUR 1,031.20", "-€5.00", "$12" → { amount, currency }
const SYMBOLS = { '€': 'EUR', '$': 'USD', '£': 'GBP', 'R$': 'BRL' }
export function parseAmount(text) {
  const raw = String(text ?? '').trim()
  if (!raw) return null
  let currency = null
  const code = raw.match(/\b([A-Z]{3})\b/)
  if (code) currency = code[1]
  else if (/R\$/.test(raw)) currency = 'BRL'
  else for (const [sym, c] of Object.entries(SYMBOLS)) if (raw.includes(sym)) currency = currency || c
  const negative = /^[^\d]*-|\(.*\)|-\s*$/.test(raw)
  let num = raw.replace(/[^\d.,]/g, '')
  if (!num) return null
  // the last separator followed by exactly two digits is the decimal point
  const m = num.match(/^(.*)[.,](\d{2})$/)
  num = m ? `${m[1].replace(/[.,]/g, '')}.${m[2]}` : num.replace(/[.,]/g, '')
  const value = parseFloat(num)
  if (!Number.isFinite(value) || value === 0) return null
  return { amount: Math.round(value * 100) / 100, currency, refund: negative }
}

// Which Gild account a Wallet card name belongs to: what the person chose in
// Settings → Apple Pay first, then a guess from the name.
export function accountForCard(card, accounts, chosen = {}) {
  const list = accounts || []
  if (card && chosen[card] && list.some((a) => a.id === chosen[card])) return chosen[card]
  const name = String(card || '')
  const by = (re) => list.find((a) => re.test(`${a.id} ${a.name}`))?.id
  if (/revolut/i.test(name))
    return list.find((a) => /revolut/i.test(`${a.id} ${a.name}`) && !/saving|flexible/i.test(`${a.id} ${a.name}`))?.id || by(/revolut/i)
  if (/avant/i.test(name)) return by(/avant|credit card/i)
  if (/boi|bank of ireland/i.test(name)) return list.find((a) => a.primary)?.id || by(/current|main/i)
  return list.find((a) => a.primary)?.id || list[0]?.id
}

// Payments waiting in the inbox file, taken out of it so each arrives once.
// Renaming first means a payment logged while this runs lands in a new inbox.
export async function takeInbox() {
  if (!isNativeApp) return []
  try {
    await Filesystem.rename({ from: INBOX, to: TAKING, directory: Directory.Library })
  } catch {
    // no inbox file (nothing new), or a previous take is still there
  }
  let items = []
  try {
    const { data } = await Filesystem.readFile({ path: TAKING, directory: Directory.Library, encoding: Encoding.UTF8 })
    items = JSON.parse(data)
  } catch {
    return []
  }
  try {
    await Filesystem.deleteFile({ path: TAKING, directory: Directory.Library })
  } catch {
    // already gone
  }
  return Array.isArray(items) ? items : []
}

// Inbox entries → pending payments: amount parsed, date in local time, the
// raw text kept so nothing is lost if it doesn't parse cleanly.
export function toPending(items) {
  const out = []
  for (const it of items || []) {
    const parsed = parseAmount(it.amount)
    if (!parsed) continue
    const when = new Date(it.at || Date.now())
    const date = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-${String(when.getDate()).padStart(2, '0')}`
    out.push({
      id: String(it.id || `${it.at}|${it.merchant}|${it.amount}`),
      at: it.at || when.toISOString(),
      date,
      amount: parsed.amount,
      currency: parsed.currency,
      refund: parsed.refund,
      merchant: String(it.merchant || '').trim() || 'Apple Pay',
      card: String(it.card || '').trim(),
      rawAmount: String(it.amount ?? '')
    })
  }
  return out
}
