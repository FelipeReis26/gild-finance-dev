// Receipt OCR benchmark. Dev-only: not referenced by the app and not part
// of the production build. Renders a corpus of receipt layouts, degrades
// each one the way a real phone photo is degraded, runs the REAL pipeline
// (preprocess -> tesseract -> parseReceiptText), and scores the result
// against known ground truth so accuracy changes are measured, not guessed.
import { createWorker } from 'tesseract.js'
import { preprocess, parseReceiptText } from './receipt.js'

const out = document.getElementById('out')
const log = (s) => {
  out.textContent += '\n' + s
  console.log(s)
}

// --- Corpus: layouts with known truth --------------------------------------
const LAYOUTS = [
  {
    id: 'tesco-ie',
    truth: { amount: 19, merchant: /tesco/i, date: '2026-08-15', category: 'food' },
    lines: ['TESCO', 'IRELAND', 'Newmarket Yards', 'VAT Number: IE 8W5 545', '15 Aug 2026',
      '1 Dishmatic Unit      3.30', '1 Finish Lemon        7.70', '1 Fairy Original      2.20',
      '1 Fairy Skip Soak     5.80', 'TOTAL:               19.00', 'Card                 19.00',
      'JOIN CLUBCARD TODAY', 'This visit you missed out on', '2.55 Clubcard savings']
  },
  {
    id: 'diner-chk',
    truth: { amount: 19.85, merchant: /eddie|rockets/i, date: '2026-08-28', category: 'food' },
    lines: ['Eddie Rockets Bray', '93 Main Street', 'Tel: 01 563 9654', 'VAT No : 3658631MH',
      'CHK 239        GST 1', "28 Aug'26 20:24", 'Takeaway', '1 Bacon Cheese Fries  6.95',
      '1 Vanilla Oreo Shake  6.45', '1 Kinder Bueno Shake  6.45', 'Payment              19.85',
      'Card Payment         19.85']
  },
  {
    id: 'pub-columns',
    truth: { amount: 165.35, merchant: /camden/i, date: '2026-08-18', category: 'food' },
    lines: ['The Camden', 'Camden Street', 'Table #46', '18/08/2026 18:56',
      'Quan Descript          Cost', '14 PT PERONI         106.40', '3 PINT CORDIAL         7.50',
      '2 PT MORETTI          15.60', '3 CBC FRIES           35.85', 'Net Total:           136.87',
      '23% VAT               24.22', 'TOTAL:               165.35', 'Amount Due:          165.35']
  },
  {
    id: 'pharmacy-saved',
    truth: { amount: 71.16, merchant: /coombe/i, date: '2026-07-15', category: null },
    lines: ['Coombe Community', 'Unit 2 Earls Court', 'DUBLIN 8', 'Date: 15/07/2026   Time:12:02',
      'Till No.1     Operator Kellie', 'PRIVATE RX........... 71.16', 'TOTAL                 71.16',
      'CREDIT CARD TENDERED  71.16', 'CHANGE                 0.00', 'YOU SAVED 17.79']
  },
  {
    id: 'spanish-comma',
    truth: { amount: 12, merchant: /taylor/i, date: '2026-05-26', category: 'food' },
    lines: ['COCKTAILS BAR', "Taylor's", 'C/DUQUE ESTREMERA 14', 'CIF:B-16663288  IVA 10%',
      'Mesa 014', 'Fra Sim: COMPR.   26/05/2026', 'Unid. Descripcion Precio Importe',
      '4 SAN MIGUEL      3,00    12,00', 'TOTAL                     12,00', 'PENDIENTE DE COBRO 12,00']
  },
  {
    id: 'fuel',
    truth: { amount: 68.4, merchant: /circle/i, date: '2026-08-22', category: 'fuel-insurance' },
    lines: ['CIRCLE K', 'Bray Road', '22 Aug 2026  07:41', 'Pump 4', 'Unleaded 40.00 L',
      'Price/L    1.710', 'TOTAL       68.40', 'DEBIT CARD  68.40']
  },
  {
    id: 'uk-thousands',
    truth: { amount: 1234.56, merchant: /currys/i, date: '2026-06-02', category: 'purchases' },
    lines: ['CURRYS PC WORLD', 'Blanchardstown', '02/06/2026', '1 Washing Machine  1,199.99',
      '1 Installation        34.57', 'SUBTOTAL          1,234.56', 'TOTAL             1,234.56',
      'VISA              1,234.56']
  },
  {
    id: 'coffee-tiny',
    truth: { amount: 4.75, merchant: /insomnia|coffee/i, date: null, category: 'food' },
    lines: ['Insomnia Coffee Co', '1 Flat White   3.30', '1 Croissant     1.45', 'TOTAL    4.75']
  },
  {
    id: 'independent',
    truth: { amount: 8.5, merchant: /murphy/i, date: '2026-09-01', category: null },
    lines: ['MURPHYS HARDWARE', '12 Lower Road', 'D09 X4T2', 'Tel: 01 8371234', '01 Sep 2026',
      '1 Paint Brush   8.50', 'TOTAL           8.50', 'CASH           10.00', 'CHANGE          1.50']
  },
  {
    id: 'subscription',
    truth: { amount: 15.99, merchant: /netflix/i, date: '2026-08-05', category: 'streaming' },
    lines: ['NETFLIX.COM', 'Invoice', 'Date: 05/08/2026', 'Standard plan     15.99',
      'Amount Due        15.99', 'Card ending 7142']
  }
]

// --- Degradations: what a phone photo actually does to a receipt -----------
function render(lines, opt = {}) {
  const scale = opt.scale ?? 1
  const w = Math.round(620 * scale)
  const lh = Math.round(30 * scale)
  const h = Math.round((lines.length * 30 + 70) * scale)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  // Paper colour: white, pink or yellow thermal
  g.fillStyle = opt.paper || '#ffffff'
  g.fillRect(0, 0, w, h)
  // Ink: black, or faded grey for worn thermal print
  g.fillStyle = opt.ink || '#111111'
  g.font = `${Math.round(21 * scale)}px monospace`
  g.textBaseline = 'top'
  lines.forEach((t, i) => g.fillText(t, Math.round(24 * scale), Math.round(30 * scale) + i * lh))

  let canvas = c
  // Rotation / skew
  if (opt.rotate) {
    const r = document.createElement('canvas')
    r.width = w
    r.height = h
    const rg = r.getContext('2d')
    rg.fillStyle = opt.paper || '#ffffff'
    rg.fillRect(0, 0, w, h)
    rg.translate(w / 2, h / 2)
    rg.rotate((opt.rotate * Math.PI) / 180)
    rg.drawImage(canvas, -w / 2, -h / 2)
    canvas = r
  }
  // Glare: a bright diagonal wash
  if (opt.glare) {
    const gg = canvas.getContext('2d')
    const grad = gg.createLinearGradient(0, 0, canvas.width, canvas.height)
    grad.addColorStop(0, 'rgba(255,255,255,0)')
    grad.addColorStop(0.5, `rgba(255,255,255,${opt.glare})`)
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    gg.fillStyle = grad
    gg.fillRect(0, 0, canvas.width, canvas.height)
  }
  // Blur (out-of-focus phone shot)
  if (opt.blur) {
    const b = document.createElement('canvas')
    b.width = canvas.width
    b.height = canvas.height
    const bg = b.getContext('2d')
    bg.filter = `blur(${opt.blur}px)`
    bg.drawImage(canvas, 0, 0)
    canvas = b
  }
  // Sensor noise
  if (opt.noise) {
    const ng = canvas.getContext('2d')
    const img = ng.getImageData(0, 0, canvas.width, canvas.height)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * opt.noise * 2
      d[i] += n
      d[i + 1] += n
      d[i + 2] += n
    }
    ng.putImageData(img, 0, 0)
  }
  return new Promise((resolve) => canvas.toBlob(resolve, opt.jpeg ? 'image/jpeg' : 'image/png', opt.jpeg || undefined))
}

const CONDITIONS = [
  { id: 'clean', opt: {} },
  { id: 'rot-3', opt: { rotate: 3 } },
  { id: 'rot-neg2', opt: { rotate: -2 } },
  { id: 'blur', opt: { blur: 1.2 } },
  { id: 'faded-thermal', opt: { ink: '#6b6b6b' } },
  { id: 'pink-paper', opt: { paper: '#f6d4d8' } },
  { id: 'yellow-paper', opt: { paper: '#f2ead0', ink: '#4a4a4a' } },
  { id: 'glare', opt: { glare: 0.55 } },
  { id: 'noise', opt: { noise: 26 } },
  { id: 'lowres', opt: { scale: 0.55 } },
  { id: 'jpeg-40', opt: { jpeg: 0.4 } },
  { id: 'worst-case', opt: { paper: '#f6d4d8', ink: '#5f5f5f', rotate: 2, blur: 0.9, noise: 14, jpeg: 0.6 } }
]

// --- Scoring ---------------------------------------------------------------
function score(truth, got) {
  return {
    amount: truth.amount == null ? null : Math.abs((got.amount || 0) - truth.amount) < 0.005,
    merchant: truth.merchant == null ? null : truth.merchant.test(got.merchant || ''),
    date: truth.date == null ? null : got.date === truth.date,
    category: truth.category == null ? null : got.category === truth.category
  }
}

window.runBench = async function runBench({ conditions = null, layouts = null, realFiles = null } = {}) {
  out.textContent = 'running…'
  const conds = conditions ? CONDITIONS.filter((c) => conditions.includes(c.id)) : CONDITIONS
  const lays = layouts ? LAYOUTS.filter((l) => layouts.includes(l.id)) : LAYOUTS
  const worker = await createWorker('eng')
  const rows = []
  try {
    for (const lay of lays) {
      for (const cond of conds) {
        const blob = await render(lay.lines, cond.opt)
        const prepared = await preprocess(blob)
        const { data } = await worker.recognize(prepared)
        const parsed = parseReceiptText(data.text || '')
        const got = {
          amount: parsed.amount,
          merchant: parsed.merchant,
          date: parsed.date,
          category: parsed.guessedCategoryId
        }
        rows.push({ layout: lay.id, cond: cond.id, conf: Math.round(data.confidence ?? -1), got, s: score(lay.truth, got) })
        log(`${lay.id}/${cond.id}  amt=${got.amount} ${JSON.stringify(score(lay.truth, got))}`)
      }
    }
  } finally {
    await worker.terminate()
  }
  // Aggregate
  const agg = (key) => {
    const vals = rows.map((r) => r.s[key]).filter((v) => v !== null)
    return vals.length ? Math.round((vals.filter(Boolean).length / vals.length) * 100) : null
  }
  const byCond = {}
  for (const r of rows) {
    byCond[r.cond] ||= { n: 0, amount: 0, merchant: 0, date: 0 }
    byCond[r.cond].n++
    for (const k of ['amount', 'merchant', 'date']) if (r.s[k]) byCond[r.cond][k]++
  }
  const failures = rows
    .filter((r) => Object.values(r.s).some((v) => v === false))
    .map((r) => ({ layout: r.layout, cond: r.cond, conf: r.conf, got: r.got, failed: Object.entries(r.s).filter(([, v]) => v === false).map(([k]) => k) }))
  const result = { total: rows.length, overall: { amount: agg('amount'), merchant: agg('merchant'), date: agg('date'), category: agg('category') }, byCond, failures }
  window.__BENCH__ = result
  log('\n=== RESULT ===\n' + JSON.stringify(result.overall))
  return result
}

// Run the real downloaded photos: no ground truth, so this reports what was
// extracted and how often the pipeline produced anything usable at all.
window.runReal = async function runReal(urls) {
  out.textContent = 'running real photos…'
  const worker = await createWorker('eng')
  const rows = []
  try {
    for (const u of urls) {
      try {
        const blob = await (await fetch(u)).blob()
        const prepared = await preprocess(blob)
        const { data } = await worker.recognize(prepared)
        const p = parseReceiptText(data.text || '')
        rows.push({ file: u.split('/').pop(), conf: Math.round(data.confidence ?? -1), amount: p.amount, merchant: p.merchant, date: p.date, cat: p.guessedCategoryId })
        log(`${u.split('/').pop().slice(0, 34)}  amt=${p.amount}  ${String(p.merchant).slice(0, 26)}  ${p.date}`)
      } catch (e) {
        rows.push({ file: u.split('/').pop(), error: String(e).slice(0, 60) })
      }
    }
  } finally {
    await worker.terminate()
  }
  const withAmount = rows.filter((r) => r.amount).length
  window.__REAL__ = { total: rows.length, withAmount, rows }
  log(`\n=== REAL ===\nfound an amount on ${withAmount}/${rows.length}`)
  return window.__REAL__
}
