import { useState } from 'react'
import { createWorker } from 'tesseract.js'
import { useApp } from '../context/AppContext.jsx'
import { todayLocalDate, findImportDuplicates, getMerchantMap, rememberMerchantCategory, lookupMerchantCategory } from '../db.js'

// Real on-device text recognition, no server or API key needed.
// Runs entirely in the browser via tesseract.js, then a few rules
// guess the amount, merchant, and category from the raw text.
// One worker for the whole batch: spinning one up is the slow part, so
// reusing it across images makes scanning several receipts far quicker
// than scanning them one at a time.
// Photographed receipts are the hard case: coloured thermal paper, glare,
// faint print, phone-camera noise. Converting to grey and stretching the
// contrast between the paper and the ink — and upscaling small crops —
// gives the recogniser a far cleaner image than the raw photo. All of it
// happens on the device, in a canvas.
async function preprocess(file) {
  try {
    const bitmap = await createImageBitmap(file)
    const longest = Math.max(bitmap.width, bitmap.height)
    // Small images are upscaled (OCR likes ~1600px of receipt), huge phone
    // photos are capped so a batch cannot exhaust memory.
    const scale = Math.min(3, Math.max(0.5, 1600 / longest))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()

    const img = ctx.getImageData(0, 0, w, h)
    const d = img.data
    // Luminance, and a histogram to find where paper and ink actually sit.
    const hist = new Uint32Array(256)
    for (let i = 0; i < d.length; i += 4) {
      const g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0
      d[i] = d[i + 1] = d[i + 2] = g
      hist[g]++
    }
    // Percentile clip: ignore the darkest/lightest 2% so a glare spot or a
    // dark background does not flatten the whole page.
    const total = w * h
    const cut = total * 0.02
    let acc = 0
    let lo = 0
    let hi = 255
    for (let v = 0; v < 256; v++) {
      acc += hist[v]
      if (acc > cut) {
        lo = v
        break
      }
    }
    acc = 0
    for (let v = 255; v >= 0; v--) {
      acc += hist[v]
      if (acc > cut) {
        hi = v
        break
      }
    }
    const span = Math.max(1, hi - lo)
    for (let i = 0; i < d.length; i += 4) {
      let v = ((d[i] - lo) / span) * 255
      v = v < 0 ? 0 : v > 255 ? 255 : v
      d[i] = d[i + 1] = d[i + 2] = v
    }
    ctx.putImageData(img, 0, 0)
    return await new Promise((resolve) => canvas.toBlob((b) => resolve(b || file), 'image/png'))
  } catch {
    // Any failure just means the recogniser sees the original photo.
    return file
  }
}

async function scanImages(files, onProgress) {
  const worker = await createWorker('eng')
  const results = []
  try {
    for (let i = 0; i < files.length; i++) {
      onProgress?.(i + 1, files.length)
      const prepared = await preprocess(files[i])
      let { data } = await worker.recognize(prepared)
      // Second chance: when the first pass finds no money at all, the page
      // segmentation is usually the problem, so retry reading it as one
      // single column — which is what a receipt is.
      if (!/\d[.,]\d{2}/.test(data.text || '')) {
        try {
          await worker.setParameters({ tessedit_pageseg_mode: '4' })
          const retry = await worker.recognize(prepared)
          if (/\d[.,]\d{2}/.test(retry.data.text || '')) data = retry.data
        } catch {
          /* keep the first pass */
        } finally {
          try {
            await worker.setParameters({ tessedit_pageseg_mode: '3' })
          } catch {
            /* ignore */
          }
        }
      }
      results.push({ text: data.text || '', confidence: data.confidence ?? null })
    }
  } finally {
    await worker.terminate()
  }
  return results
}

// What the person has actually saved before beats any keyword table: if
// "SPAR" was filed under Food last time, it is Food this time. Built from
// the local transaction history, so it stays on the device and gets more
// accurate the longer the app is used.
function learnFromHistory(merchant, transactions) {
  // Matched against the detected MERCHANT only, never the whole receipt:
  // matching raw OCR text let loyalty boilerplate ("this visit you missed
  // out on…") trigger a confident-looking wrong category.
  if (!merchant) return null
  const target = merchant.toLowerCase()
  const targetWords = new Set(
    target.split(/[^a-z0-9&]+/).filter((w) => w.length >= 5 && !STOPWORDS.has(w))
  )
  if (!targetWords.size) return null

  const scores = new Map()
  for (const tx of transactions) {
    if (tx.type !== 'expense' || !tx.note || !tx.categoryId) continue
    const note = tx.note.toLowerCase()
    // Whole-name agreement is the strong signal.
    if (note === target) {
      scores.set(tx.categoryId, (scores.get(tx.categoryId) || 0) + 20)
      continue
    }
    for (const w of note.split(/[^a-z0-9&]+/)) {
      if (w.length < 5 || STOPWORDS.has(w)) continue
      if (targetWords.has(w)) scores.set(tx.categoryId, (scores.get(tx.categoryId) || 0) + w.length)
    }
  }
  if (!scores.size) return null
  const [best] = [...scores.entries()].sort((a, b) => b[1] - a[1])
  // Below this, the "evidence" is a coincidence, not a habit.
  if (best[1] < 10) return null
  return { categoryId: best[0], learned: true }
}

const NOISE_WORDS = [
  'receipt', 'subtotal', 'total', 'tax', 'vat', 'change', 'cash', 'card',
  'visa', 'mastercard', 'thank you', 'balance', 'tel:', 'www.', 'http',
  'auth code', 'approved', 'terminal', 'merchant id', 'contactless',
  // Loyalty and marketing boilerplate, which is often the longest prose on
  // the page and used to win the merchant guess outright.
  'clubcard', 'loyalty', 'points', 'savings', 'saved', 'you missed', 'missed out',
  'download', 'join ', 'sign up', 'register', 'app,', 'the app', 'store-locator',
  'any questions', 'please visit', 'customer', 'survey', 'feedback', 'win ',
  'voucher', 'coupon', 'offer', 'promotion', 'terms', 'conditions', 'returns',
  'exchange', 'policy', 'retain', 'keep this', 'proof of purchase',
  // Payment trailer
  'debit', 'credit', 'aid:', 'pan ', 'sequence', 'authorisation', 'authorization',
  'aut code', 'ref:', 'reference', 'till', 'operator', 'cashier', 'transaction',
  'expiry', 'contact', 'iban', 'sort code', 'account no'
]

// Known retailers: the strongest signal on the page. A brand hit names the
// merchant AND its category outright, which beats every heuristic below.
const BRANDS = [
  { match: ['tesco'], name: 'Tesco', categoryId: 'food' },
  { match: ['lidl'], name: 'Lidl', categoryId: 'food' },
  { match: ['aldi'], name: 'Aldi', categoryId: 'food' },
  { match: ['dunnes'], name: 'Dunnes Stores', categoryId: 'food' },
  { match: ['supervalu', 'super valu'], name: 'SuperValu', categoryId: 'food' },
  { match: ['centra'], name: 'Centra', categoryId: 'food' },
  { match: ['spar'], name: 'Spar', categoryId: 'food' },
  { match: ['marks & spencer', 'marks and spencer', 'm&s '], name: 'Marks & Spencer', categoryId: 'food' },
  { match: ['sainsbury'], name: "Sainsbury's", categoryId: 'food' },
  { match: ['asda'], name: 'Asda', categoryId: 'food' },
  { match: ['waitrose'], name: 'Waitrose', categoryId: 'food' },
  { match: ['carrefour'], name: 'Carrefour', categoryId: 'food' },
  { match: ['mercadona'], name: 'Mercadona', categoryId: 'food' },
  { match: ['starbucks'], name: 'Starbucks', categoryId: 'food' },
  { match: ['costa coffee'], name: 'Costa Coffee', categoryId: 'food' },
  { match: ["mcdonald"], name: "McDonald's", categoryId: 'food' },
  { match: ['circle k'], name: 'Circle K', categoryId: 'fuel-insurance' },
  { match: ['applegreen'], name: 'Applegreen', categoryId: 'fuel-insurance' },
  { match: ['maxol'], name: 'Maxol', categoryId: 'fuel-insurance' },
  { match: ['shell'], name: 'Shell', categoryId: 'fuel-insurance' },
  { match: ['esso'], name: 'Esso', categoryId: 'fuel-insurance' },
  { match: ['eddie rocket'], name: "Eddie Rockets", categoryId: 'food' },
  { match: ['supermac'], name: "Supermac's", categoryId: 'food' },
  { match: ['insomnia'], name: 'Insomnia Coffee', categoryId: 'food' },
  { match: ['butler', 'bewley'], name: 'Coffee shop', categoryId: 'food' },
  { match: ['domino'], name: "Domino's", categoryId: 'food' },
  { match: ['subway'], name: 'Subway', categoryId: 'food' },
  { match: ['kfc'], name: 'KFC', categoryId: 'food' },
  { match: ['burger king'], name: 'Burger King', categoryId: 'food' },
  { match: ['boots'], name: 'Boots', categoryId: 'health' },
  { match: ['mccabe', 'hickey', 'lloyds pharmacy'], name: 'Pharmacy', categoryId: 'health' },
  { match: ['pharmacy', 'chemist'], name: 'Pharmacy', categoryId: 'health' },
  { match: ['ikea'], name: 'IKEA', categoryId: 'purchases' },
  { match: ['penneys', 'primark'], name: 'Penneys', categoryId: 'purchases' },
  { match: ['argos'], name: 'Argos', categoryId: 'purchases' },
  { match: ['currys'], name: 'Currys', categoryId: 'purchases' },
  { match: ['amazon'], name: 'Amazon', categoryId: 'purchases' },
  { match: ['netflix'], name: 'Netflix', categoryId: 'streaming' },
  { match: ['spotify'], name: 'Spotify', categoryId: 'streaming' },
  { match: ['disney'], name: 'Disney+', categoryId: 'streaming' },
  { match: ['vodafone'], name: 'Vodafone', categoryId: 'utilities' },
  { match: ['electric ireland'], name: 'Electric Ireland', categoryId: 'utilities' },
  { match: ['bord gais', 'bord gáis'], name: 'Bord Gáis', categoryId: 'utilities' }
]

// Words too common to prove anything when matching against past notes.
const STOPWORDS = new Set([
  'this', 'that', 'with', 'from', 'your', 'you', 'the', 'and', 'for', 'was',
  'visit', 'missed', 'store', 'shop', 'today', 'total', 'card', 'cash', 'paid',
  'payment', 'purchase', 'item', 'items', 'unit', 'price', 'prices', 'refill',
  'original', 'bonus', 'fresh', 'power', 'clean', 'cleaner', 'liquid', 'spray',
  'number', 'code', 'date', 'time', 'thank', 'please', 'here', 'have', 'been'
])
const TOTAL_KEYWORDS = ['total', 'amount', 'amount due', 'balance due', 'paid', 'subtotal', 'grand total']

const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function looksLikeDate(line) {
  return (
    /\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/.test(line) ||
    /\d{4}-\d{2}-\d{2}/.test(line) ||
    new RegExp(`\\d{1,2}\\s*[-\\s]\\s*(${MONTH_NAMES.join('|')})`, 'i').test(line)
  )
}

// Lines that are structurally not a shop name: addresses, phone numbers,
// tax and till references, Eircode/postcode blocks. These used to win the
// merchant guess whenever OCR mangled the logo above them.
function looksLikeAddressOrRef(line) {
  const l = line.toLowerCase()
  if (/\btel\b|\bvat\b|\bfax\b|\bwww\.|\bno\s*:|#|\bchk\b|\bgst\b|\bws\b|\bemail\b/.test(l)) return true
  if (/\b(street|road|avenue|lane|drive|square|st\.|rd\.|ave\.|floor|unit|suite)\b/.test(l)) return true
  // Column headers from the item table ("Quan Descript Cost", "Unid.
  // Descripcion Precio Importe") used to win the merchant guess.
  if (/\b(quan|qty|descript|descripci|description|precio|importe|import|cost|price|amount|unid|mesa|table|serv)\b/.test(l)) return true
  // Irish Eircode / UK-style postcode: a letter-digit block next to another.
  if (/\b[a-z]\d{2}\s?[a-z0-9]{4}\b/i.test(line)) return true
  // Phone-like runs of digits.
  if (/\d[\d\s]{6,}/.test(line)) return true
  return false
}

function parseReceiptText(text) {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  // Amount. Ranked strategies, best first, because grabbing the biggest
  // number on the page picks up phone numbers, loyalty points, and card
  // digits. Handles thousands separators (1.234,56 and 1,234.56) and
  // OCR's habit of reading 0 as O.
  const moneyPattern = /(\d{1,3}(?:[.,\s]\d{3})*[.,]\d{2}|\d{1,5}[.,]\d{2})/g
  // OCR reads 0 as O. Only swap where the letter sits against digits or a
  // decimal point, so merchant names keep their real spelling.
  const fixDigits = (str) => str.replace(/(?<=[\d.,])[Oo]|[Oo](?=[\d.,])/g, '0')
  const toNumber = (raw) => {
    let s = raw.replace(/\s/g, '')
    // The last separator is the decimal one; anything earlier is grouping.
    const lastSep = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','))
    if (lastSep === -1) return parseFloat(s)
    const intPart = s.slice(0, lastSep).replace(/[.,]/g, '')
    return parseFloat(`${intPart}.${s.slice(lastSep + 1)}`)
  }
  const amountsIn = (str) =>
    [...fixDigits(str).matchAll(moneyPattern)].map((m) => toNumber(m[1])).filter((n) => !isNaN(n) && n > 0)

  // Lines whose figures are never the amount charged: savings, discounts,
  // loyalty credit, change, and VAT components.
  const isNegativeContext = (l) => /saved|saving|discount|off\b|change|points|vat|iva|tax|tip|service charge/i.test(l)

  // Count how often each value appears. A till receipt repeats the amount
  // charged (TOTAL, AMOUNT DUE, CARD TENDERED), while an OCR misread of it
  // appears once — so repetition is strong evidence of the real total.
  const occurrences = new Map()
  for (const line of lines) {
    if (isNegativeContext(line)) continue
    for (const n of amountsIn(line)) occurrences.set(n, (occurrences.get(n) || 0) + 1)
  }

  let amount = ''
  // 1. A line naming the grand total wins outright, and the strongest
  //    keyword wins over a mere "subtotal".
  const scoreLine = (l) => {
    const t = l.toLowerCase()
    if (isNegativeContext(l)) return -1
    if (/grand total|amount due|balance due|total due/.test(t)) return 3
    if (/\btotal\b/.test(t) && !/sub/.test(t)) return 2
    if (/subtotal|amount|paid|tendered/.test(t)) return 1
    return 0
  }
  const ranked = [...lines].filter((l) => scoreLine(l) > 0).sort((a, b) => scoreLine(b) - scoreLine(a))
  const totalCandidates = []
  for (const line of ranked) {
    for (const n of amountsIn(line)) totalCandidates.push({ n, weight: scoreLine(line) })
  }
  if (totalCandidates.length) {
    // Among keyword-line figures, prefer the one that repeats across the
    // receipt, then the strongest keyword, then the largest.
    totalCandidates.sort(
      (a, b) =>
        (occurrences.get(b.n) || 0) - (occurrences.get(a.n) || 0) || b.weight - a.weight || b.n - a.n
    )
    amount = totalCandidates[0].n
  }
  // 2. Otherwise the most-repeated plausible money value, then the largest.
  if (!amount) {
    const all = [...occurrences.entries()].filter(([n]) => n < 100000)
    if (all.length) {
      all.sort((a, b) => b[1] - a[1] || b[0] - a[0])
      amount = all[0][0]
    }
  }

  // Merchant. A shop's name sits in the first few lines, is short, and is
  // usually set in caps — it is never the longest prose on the page, which
  // is what the old "longest line" rule kept picking (loyalty blurbs).
  const brand = BRANDS.find((b) => b.match.some((m) => text.toLowerCase().includes(m)))
  const candidates = lines
    .map((line, i) => ({ line, i }))
    .filter(({ line }) => {
      if (!/[a-zA-Z]{3,}/.test(line)) return false
      if (/^\d/.test(line)) return false
      if (looksLikeDate(line)) return false
      // A line carrying a price is an item line, not the shop name.
      if (/\d[.,]\d{2}/.test(line)) return false
      if (looksLikeAddressOrRef(line)) return false
      const lower = line.toLowerCase()
      if (NOISE_WORDS.some((w) => lower.includes(w))) return false
      // Sentences are marketing copy, not names.
      if (/^(this|any|please|we |our |all |if |to |for |get |download|join|sign)/.test(lower)) return false
      const words = line.split(/\s+/).length
      return words <= 6
    })
    .map(({ line, i }) => {
      let score = 0
      // Gentler decay over the header block: OCR often mangles the logo
      // lines, so line 3 can easily be the real name.
      score += Math.max(0, 10 - i)
      const letters = line.replace(/[^a-zA-Z]/g, '')
      if (letters && letters === letters.toUpperCase()) score += 4 // caps header
      if (line.length >= 4 && line.length <= 28) score += 3 // name-shaped
      // A shop name rarely contains digits, and OCR fragments ("RE", "CR")
      // are short orphan tokens.
      if (/\d/.test(line)) score -= 6
      const tokens = line.split(/\s+/).map((w) => w.replace(/[^a-zA-Z]/g, ''))
      // A lone letter is OCR debris; two-letter words ("of", "st") are real.
      score -= tokens.filter((w) => w.length === 1).length * 5
      score -= tokens.filter((w) => w.length === 2).length * 1
      // Two or more substantial words read as a business name.
      if (tokens.filter((w) => w.length >= 4).length >= 2) score += 4
      // Mostly-letters lines read as names; symbol soup does not.
      if (letters.length / Math.max(1, line.replace(/\s/g, '').length) > 0.8) score += 3
      return { line, score }
    })
    .sort((a, b) => b.score - a.score)
  const merchantLine = brand ? brand.name : candidates[0]?.line

  // Category guess from keywords in the recognized text.
  const lower = text.toLowerCase()
  const keywordMap = [
    { keywords: ['netflix', 'spotify', 'disney', 'prime video', 'patreon'], categoryId: 'streaming' },
    { keywords: ['tesco', 'supermarket', 'grocery', 'lidl', 'aldi', 'spar', 'dunnes', 'mcdonald', 'coffee'], categoryId: 'food' },
    { keywords: ['shell', 'esso', 'circle k', 'fuel', 'petrol', 'freenow', 'taxi', 'uber', 'eflow', 'toll'], categoryId: 'fuel-insurance' },
    { keywords: ['takeaway', 'restaurant', 'diner', 'cafe', 'deli', 'bakery', 'burger', 'pizza', 'fries', 'shake', 'sandwich', 'kebab', 'sushi', 'bar & grill'], categoryId: 'food' },
    { keywords: ['pint', 'pt', 'peroni', 'moretti', 'guinness', 'heineken', 'carlsberg', 'san miguel', 'lager', 'beer', 'wine', 'cocktail', 'gin', 'vodka', 'whiskey', 'cordial', 'tap room', 'brewery'], categoryId: 'food' },
    { keywords: ['rent', 'landlord', 'tenancy'], categoryId: 'rent' },
    { keywords: ['vodafone', 'three', 'eir', 'internet', 'broadband', 'virgin media', 'apple.com'], categoryId: 'utilities' }
  ]
  // Whole-word matching only: a bare substring test let 'rent' match inside
  // unrelated words and file a diner receipt under Rent.
  const hasWord = (haystack, needle) =>
    new RegExp(`(^|[^a-z0-9])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i').test(haystack)
  const match = brand || keywordMap.find((k) => k.keywords.some((word) => hasWord(lower, word)))

  // Date: use the receipt's own date when one is legible and sane, rather
  // than always stamping today — a receipt scanned days later belongs to
  // the day it happened, which is what the pay-period maths reads.
  let date = todayLocalDate()
  // Normalise OCR digit confusion before matching dates, and prefer a line
  // that labels itself as the date.
  const dateSource = (() => {
    const labelled = lines.filter((l) => /\bdate\b|\bfecha\b|\bdata\b/i.test(l)).join('\n')
    const body = labelled || text
    return body.replace(/(?<=[\d\/.\-])[OoQ]|[OoQ](?=[\d\/.\-])/g, '0').replace(/(?<=[\d\/.\-])[lI]|[lI](?=[\d\/.\-])/g, '1')
  })()
  // Month-name dates first — "28 Aug'23", "28 Aug 2023", "AUG 28, 2023",
  // "28-AUG-23". These are everywhere on till receipts and used to fall
  // through to today, silently filing the expense in the wrong period.
  const monthAlt = MONTH_NAMES.join('|')
  const named =
    dateSource.match(new RegExp(`\\b(\\d{1,2})\\s*[-\\s]\\s*(${monthAlt})[a-z]*\\.?\\s*[-,\\s]*['\`]?\\s*(\\d{2,4})?\\b`, 'i')) ||
    dateSource.match(new RegExp(`\\b(${monthAlt})[a-z]*\\.?\\s*[-,\\s]+(\\d{1,2})\\s*[-,\\s]*['\`]?\\s*(\\d{2,4})?\\b`, 'i'))
  const dm =
    dateSource.match(/(\d{4})-(\d{2})-(\d{2})/) ||
    dateSource.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/) ||
    dateSource.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})(?!\d)/)

  let parsedParts = null
  if (named) {
    const isDayFirst = /^\d/.test(named[1])
    const dayRaw = isDayFirst ? named[1] : named[2]
    const monRaw = (isDayFirst ? named[2] : named[1]).toLowerCase().slice(0, 3)
    let yearRaw = named[3]
    const mIdx = MONTH_NAMES.indexOf(monRaw)
    if (mIdx !== -1) {
      if (!yearRaw) yearRaw = String(new Date().getFullYear())
      else if (yearRaw.length === 2) yearRaw = `20${yearRaw}`
      parsedParts = { y: yearRaw, mo: mIdx + 1, d: dayRaw }
    }
  }
  if (!parsedParts && dm) {
    let y, mo, d
    if (dm[1].length === 4) {
      ;[, y, mo, d] = dm
    } else {
      // Day-first (European receipts); fall back to month-first when the
      // first number cannot be a day.
      const a = parseInt(dm[1], 10)
      const b = parseInt(dm[2], 10)
      d = a > 12 || b <= 12 ? a : b
      mo = a > 12 || b <= 12 ? b : a
      y = dm[3].length === 2 ? `20${dm[3]}` : dm[3]
    }
    parsedParts = { y, mo, d }
  }
  if (parsedParts) {
    const { y, mo, d } = parsedParts
    const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const parsed = new Date(iso + 'T00:00:00')
    const now = new Date()
    // Trust any real, non-future date within five years. A genuinely old
    // receipt is the user's business — silently substituting today would
    // book the expense into the wrong pay period, which is worse.
    if (
      !isNaN(parsed) &&
      parsed <= now &&
      now - parsed < 5 * 365 * 86400000 &&
      Number(mo) >= 1 &&
      Number(mo) <= 12 &&
      Number(d) >= 1 &&
      Number(d) <= 31
    ) {
      date = iso
    }
  }

  // Merchant: strip trailing punctuation and OCR debris, and title-case
  // the shouty all-caps that receipts are printed in.
  let merchant = (merchantLine || '').replace(/[^\w&'.\- ]/g, ' ').replace(/\s{2,}/g, ' ').trim()
  // OCR often prefixes a stray one- or two-letter fragment ("BE Coombe
  // Community"); drop orphan tokens at either end when real words remain.
  if (!brand) {
    let parts = merchant.split(' ')
    while (parts.length > 1 && parts[0].replace(/[^a-zA-Z]/g, '').length <= 2) parts.shift()
    while (parts.length > 1 && parts[parts.length - 1].replace(/[^a-zA-Z]/g, '').length <= 2) parts.pop()
    merchant = parts.join(' ')
  }
  if (merchant && merchant === merchant.toUpperCase()) {
    merchant = merchant
      .toLowerCase()
      .split(' ')
      .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w.toUpperCase()))
      .join(' ')
  }

  return {
    amount,
    merchant: merchant || 'Unknown merchant',
    date,
    guessedCategoryId: match?.categoryId || null,
    brandMatched: Boolean(brand),
    rawText: text.trim()
  }
}

export default function ScanImport({ onConfirmed }) {
  const { categories, transactions, addTransaction, t } = useApp()
  const expenseCategories = categories.filter((c) => c.kind !== 'income' && !c.archived)
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [results, setResults] = useState([])
  const [error, setError] = useState('')

  function interpret(rawText, merchantMap, confidence) {
    const parsed = parseReceiptText(rawText)
    // What the person filed this shop under before outranks everything,
    // including the brand table: an explicit correction is a decision.
    const remembered = lookupMerchantCategory(merchantMap, parsed.merchant)
    // Priority: a recognized brand is definitive; otherwise a strong history
    // match on the merchant name; otherwise the keyword guess. History never
    // overrides a known brand.
    const learned = parsed.brandMatched ? null : learnFromHistory(parsed.merchant, transactions)
    const known = learned && expenseCategories.some((c) => c.id === learned.categoryId)
    // With no signal at all, fall back to a neutral catch-all rather than
    // whichever category happens to be first in the list — that made every
    // unrecognised receipt look confidently like "Rent".
    const neutral =
      expenseCategories.find((c) => c.id === 'other')?.id ||
      expenseCategories.find((c) => /other|misc/i.test(c.name))?.id ||
      expenseCategories[expenseCategories.length - 1]?.id
    const rememberedOk = remembered && expenseCategories.some((c) => c.id === remembered)
    const guessed = (rememberedOk && remembered) || (known && learned.categoryId) || parsed.guessedCategoryId
    return {
      ...parsed,
      // Money shows its cents: "3.30", not "3.3".
      amount: parsed.amount ? Number(parsed.amount).toFixed(2) : '',
      id: Math.random().toString(36).slice(2, 9),
      guessedCategoryId: guessed || neutral,
      remembered: Boolean(rememberedOk),
      unclear: typeof confidence === 'number' && confidence > 0 && confidence < 60,
      learned: Boolean(known) && !rememberedOk && Boolean(guessed)
    }
  }

  async function handleFiles(e) {
    const chosen = [...(e.target.files || [])]
    if (!chosen.length) return
    setScanning(true)
    setError('')
    setProgress({ done: 0, total: chosen.length })
    try {
      const scans = await scanImages(chosen, (done, total) => setProgress({ done, total }))
      const merchantMap = await getMerchantMap()
      const parsed = scans
        .map((sc) => interpret(sc.text, merchantMap, sc.confidence))
        .filter((r) => r.amount || r.merchant !== 'Unknown merchant')
      if (!parsed.length) {
        setError(t('couldNotRead'))
      } else {
        setResults(parsed)
        // Tell the person which of these look like something already saved.
        const flagged = await findImportDuplicates(
          parsed.map((r) => ({ date: r.date, amount: parseFloat(r.amount) || 0, note: r.merchant }))
        )
        setResults(parsed.map((r, i) => ({ ...r, isDuplicate: flagged[i]?.isDuplicate })))
      }
    } catch {
      setError(t('couldNotRead'))
    } finally {
      setScanning(false)
      e.target.value = ''
    }
  }

  const patch = (id, changes) => setResults((rs) => rs.map((r) => (r.id === id ? { ...r, ...changes } : r)))
  const drop = (id) => setResults((rs) => rs.filter((r) => r.id !== id))

  async function handleConfirmAll() {
    const valid = results.filter((r) => {
      const v = parseFloat(r.amount)
      return !isNaN(v) && v > 0
    })
    if (!valid.length) {
      setError(t('enterValidAmount'))
      return
    }
    for (const r of valid) {
      await addTransaction({
        type: 'expense',
        amount: parseFloat(r.amount),
        categoryId: r.guessedCategoryId,
        date: r.date,
        note: r.merchant
      })
      // Confirming is the teaching moment: whatever category this shop ends
      // up in, that is what it means next time.
      if (r.merchant && r.merchant !== 'Unknown merchant') {
        await rememberMerchantCategory(r.merchant, r.guessedCategoryId)
      }
    }
    setResults([])
    onConfirmed?.()
  }

  if (!scanning && !results.length && !error) {
    return (
      <div className="screen">
        <div className="card scan-drop">
          <i className="ti ti-camera scan-icon" aria-hidden="true"></i>
          <p className="section-title">{t('scanTitle')}</p>
          <p className="muted center">{t('scanSubtitle')}</p>
          <p className="muted center" style={{ fontSize: 12 }}>
            {t('scanMultipleHint')}
          </p>
          <label className="primary-button file-button">
            {t('chooseScreenshot')}
            <input type="file" accept="image/*" multiple onChange={handleFiles} hidden />
          </label>
        </div>
      </div>
    )
  }

  if (scanning) {
    return (
      <div className="screen">
        <div className="card scan-drop">
          {/* A sweeping hand: the world's own way of saying "working". */}
          <svg className="sweep" viewBox="0 0 64 64" role="img" aria-label={t('readingScreenshot')}>
            {Array.from({ length: 12 }, (_, i) => {
              const a = ((i / 12) * 360 - 90) * (Math.PI / 180)
              return (
                <line
                  key={i}
                  x1={32 + Math.cos(a) * 27}
                  y1={32 + Math.sin(a) * 27}
                  x2={32 + Math.cos(a) * 30}
                  y2={32 + Math.sin(a) * 30}
                  stroke="var(--ink)"
                  strokeOpacity="0.18"
                  strokeWidth="1.5"
                />
              )
            })}
            <g className="sweep-hand">
              <line x1="32" y1="32" x2="32" y2="9" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" />
            </g>
            <circle cx="32" cy="32" r="2.5" fill="var(--gold)" />
          </svg>
          <p className="muted">
            {t('readingScreenshot')}
            {progress.total > 1 ? ` · ${progress.done} / ${progress.total}` : ''}
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="screen">
        <div className="card scan-drop">
          <p className="error-text" role="alert">{error}</p>
          <button
            type="button"
            className="secondary-button"
            style={{ width: '100%' }}
            onClick={() => setError('')}
          >
            {t('tryAnother')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="row between">
        <p className="section-title" style={{ margin: 0 }}>
          {results.length > 1 ? t('confirmTransactions') : t('confirmTransaction')}
        </p>
        {results.length > 1 && (
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            {results.length} {t('receiptsFound')}
          </p>
        )}
      </div>
      <p className="muted" style={{ margin: '-6px 2px 0', fontSize: 13 }}>
        {results.length > 1 ? t('confirmSubtitlePlural') : t('confirmSubtitle')}
      </p>

      {results.map((r) => (
        <div className="card" key={r.id}>
          <div className="row between" style={{ marginBottom: 10 }}>
            <label className="field-label" style={{ margin: 0 }}>
              {t('amount')}
              {r.isDuplicate && (
                <span style={{ color: 'var(--debit)', marginLeft: 6 }}>· {t('possibleDuplicate')}</span>
              )}
              {r.unclear && <span style={{ color: 'var(--debit)', marginLeft: 6 }}>· {t('unclearScan')}</span>}
            </label>
            <button
              type="button"
              className="mini-button"
              onClick={() => drop(r.id)}
              aria-label={t('discard')}
            >
              <i className="ti ti-x" aria-hidden="true"></i>
            </button>
          </div>
          <input
            className="amount-input"
            type="number"
            inputMode="decimal"
            value={r.amount}
            onChange={(e) => {
              patch(r.id, { amount: e.target.value })
              setError('')
            }}
          />

          <label className="field-label">{t('merchant')}</label>
          <input type="text" value={r.merchant} onChange={(e) => patch(r.id, { merchant: e.target.value })} />

          <label className="field-label">
            {t('category')}
            {r.remembered && <span style={{ color: 'var(--credit)', marginLeft: 6 }}>· {t('rememberedShop')}</span>}
            {!r.remembered && r.learned && (
              <span style={{ color: 'var(--credit)', marginLeft: 6 }}>· {t('learnedFromHistory')}</span>
            )}
          </label>
          <select value={r.guessedCategoryId || ''} onChange={(e) => patch(r.id, { guessedCategoryId: e.target.value })}>
            {expenseCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <label className="field-label">{t('date')}</label>
          <input
            type="date"
            value={r.date}
            onChange={(e) => patch(r.id, { date: e.target.value })}
            style={{ marginBottom: r.rawText ? 14 : 0 }}
          />

          {r.rawText && (
            <details>
              <summary style={{ fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                {t('rawRecognizedText')}
              </summary>
              <pre
                style={{
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  whiteSpace: 'pre-wrap',
                  marginTop: 8,
                  maxHeight: 140,
                  overflowY: 'auto'
                }}
              >
                {r.rawText}
              </pre>
            </details>
          )}
        </div>
      ))}

      {error && (
        <p className="error-text" role="alert" style={{ margin: '0 4px' }}>
          {error}
        </p>
      )}

      <div className="row gap">
        <button type="button" className="secondary-button" style={{ flex: 1 }} onClick={() => setResults([])}>
          {t('discard')}
        </button>
        <button type="button" className="primary-button" style={{ flex: 2, width: 'auto' }} onClick={handleConfirmAll}>
          {results.length > 1 ? `${t('confirm')} (${results.length})` : t('confirm')}
        </button>
      </div>

      <label className="secondary-button file-button" style={{ textAlign: 'center', lineHeight: '48px' }}>
        {t('addMoreScreenshots')}
        <input type="file" accept="image/*" multiple onChange={handleFiles} hidden />
      </label>
    </div>
  )
}
