// Parser tests. Imports the real module (no string surgery), with a
// localStorage polyfill because db.js touches storage at module load.
globalThis.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.has(k) ? this._m.get(k) : null },
  setItem(k, v) { this._m.set(k, String(v)) },
  removeItem(k) { this._m.delete(k) }
}
const { parseReceiptText, learnFromHistory } =
  await import('../src/receipt.js')

const TODAY = (() => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()

let pass = 0, fail = 0
const ok = (cond, msg, got) => { if (cond) pass++; else { fail++; console.log(`FAIL: ${msg}` + (got !== undefined ? ` (got ${JSON.stringify(got)})` : '')) } }

// 1. Grand total beats subtotal and beats a bigger unrelated number.
let r = parseReceiptText(`SPAR EXPRESS\nLoyalty 1234567\nSUBTOTAL 12.00\nTAX 2.85\nTOTAL 14.85\nCARD 4539 1234`)
ok(r.amount === 14.85, 'grand total wins over subtotal/card digits', r.amount)

// 2. Thousands separator, European format.
r = parseReceiptText(`MOBILIA\nTOTAL 1.234,56`)
ok(r.amount === 1234.56, 'european thousands 1.234,56', r.amount)

// 3. Thousands separator, US format.
r = parseReceiptText(`HARDWARE CO\nAMOUNT DUE 1,234.56`)
ok(r.amount === 1234.56, 'us thousands 1,234.56', r.amount)

// 4. OCR reading 0 as O.
r = parseReceiptText(`CAFE\nTOTAL 1O.5O`)
ok(r.amount === 10.50, 'OCR O->0', r.amount)

// 5. No keyword line at all — largest plausible money value.
r = parseReceiptText(`CORNER SHOP\n3.50\n11.20\n0872341122`)
ok(r.amount === 11.20, 'fallback to largest money value', r.amount)

// 6. Receipt date is used, not today.
r = parseReceiptText(`TESCO\n24/08/2026\nTOTAL 30.00`)
ok(r.date === '2026-08-24', 'european day-first date', r.date)

// 7. ISO date.
r = parseReceiptText(`TESCO\n2026-08-20\nTOTAL 30.00`)
ok(r.date === '2026-08-20', 'iso date', r.date)

// 8. Future / absurd date is rejected in favour of today.
r = parseReceiptText(`TESCO\n01/01/2099\nTOTAL 30.00`)
ok(r.date === TODAY, 'future date rejected (falls back to today)', r.date)

// 9. Two-digit year.
r = parseReceiptText(`TESCO\n15/07/26\nTOTAL 30.00`)
ok(r.date === '2026-07-15', 'two-digit year', r.date)

// 10. Merchant title-cased out of all-caps, punctuation stripped.
r = parseReceiptText(`*** SPAR EXPRESS DUBLIN ***\nTOTAL 5.00`)
ok(r.merchant === 'Spar', 'known brand normalises to its canonical name', r.merchant)

// 11. Noise lines never become the merchant.
r = parseReceiptText(`THANK YOU FOR SHOPPING\nCONTACTLESS\nMERCHANT ID 88213\nTOTAL 9.99`)
ok(!/thank you|contactless|merchant id/i.test(r.merchant), 'noise rejected as merchant', r.merchant)

// 12. Category keyword still works.
r = parseReceiptText(`NETFLIX.COM\nTOTAL 15.99`)
ok(r.guessedCategoryId === 'streaming', 'keyword category', r.guessedCategoryId)


// 13. THE REAL TESCO RECEIPT (the failing case from the user's phone).
const TESCO = `TESCO
IRELAND
Newmarket Yards
Any questions please visit
www.tesco.ie/store-locator
VAT Number: IE 8W5 545 1I
1 Dishmatic Unit With Sponge Head And
1 Bonus Refill  E3.30
1 Finish Lemon Dishwasher Cleaner
250ml  E7.70
1 Fairy Original Washing Up Liquid
320ml  E2.20
1 Fairy Skip The Soak Power Spray
Fresh 500ml  E5.80
TOTAL:
Card  E19.00
E19.00
JOIN CLUBCARD TODAY
This visit you missed out on
E2.55 Clubcard Prices savings
16 Clubcard points
Download the Tesco Grocery &
Clubcard app, or visit
tesco.ie/clubcard
Visa Debit
AID: A0000000031010
Number: ************7142
Pan sequence no: 0`
r = parseReceiptText(TESCO)
ok(r.amount === 19, 'TESCO: amount is the 19.00 total', r.amount)
ok(r.merchant === 'Tesco', 'TESCO: merchant is Tesco, not the Clubcard blurb', r.merchant)
ok(r.guessedCategoryId === 'food', 'TESCO: category food via brand', r.guessedCategoryId)
ok(r.brandMatched === true, 'TESCO: brandMatched set (blocks history override)', r.brandMatched)

// 14. History must NOT fire on loyalty prose (the "Holidays" bug).
const hist = [
  { type:'expense', note:'Flights to Lisbon', categoryId:'holidays' },
  { type:'expense', note:'Weekly shop', categoryId:'food' }
]
ok(learnFromHistory('This visit you missed out on', hist) === null, 'history ignores marketing prose')
ok(learnFromHistory('Tesco', hist) === null, 'history needs real evidence, not a coincidence')
ok(learnFromHistory('Flights to Lisbon', hist)?.categoryId === 'holidays', 'history fires on a genuine repeat')

// 15. Unknown shop still gets a sensible merchant from the top lines.
r = parseReceiptText(`BRENNANS BUTCHERS\n12 Main Street\nTOTAL 24.50\nThis visit you missed out on savings`)
ok(/Brennans/i.test(r.merchant), 'unknown shop: top caps line wins', r.merchant)


// 16. THE EDDIE ROCKETS RECEIPT (second real failure from the phone).
const ER = `Red RE
CR
Eddie Rockets Bray
93 Main Street
Bray, A98 N1F9
Tel: 01 563 9654
VAT No : 3658631MH
70 Craig
WS#: 1
CHK 239        GST 1
28 Aug'23 20:24
Takeaway
1 Bacon & Cheese Fries   6.95
1 Vanilla Oreo Shake     6.45
1 Kinder Bueno Shake     6.45
1.64 VAT Reduced 9%     19.85
Food                     6.95
Beverage                12.90
Payment                 19.85
Card Payment            19.85
Check Closed
28 Aug'23 20:25`
r = parseReceiptText(ER)
ok(r.amount === 19.85, 'ER: amount 19.85', r.amount)
ok(/Eddie Rockets/i.test(r.merchant), 'ER: merchant is Eddie Rockets, not the address', r.merchant)
ok(r.guessedCategoryId === 'food', 'ER: category food, NOT rent', r.guessedCategoryId)
ok(r.date === '2023-08-28', "ER: date from 28 Aug'23", r.date)

// 17. 'rent' must not match inside another word.
r = parseReceiptText(`CURRENT ACCOUNT SERVICES\nDifferent Parent Co\nTOTAL 10.00`)
ok(r.guessedCategoryId !== 'rent', "substring 'rent' does not trigger Rent", r.guessedCategoryId)
r = parseReceiptText(`MONTHLY RENT\nTOTAL 1100.00`)
ok(r.guessedCategoryId === 'rent', 'a real Rent receipt still matches', r.guessedCategoryId)

// 18. Month-name date variants.
ok(parseReceiptText(`SHOP\n28 Aug 2023\nTOTAL 5.00`).date === '2023-08-28', 'day month year')
ok(parseReceiptText(`SHOP\nAUG 28, 2023\nTOTAL 5.00`).date === '2023-08-28', 'month day, year')
ok(parseReceiptText(`SHOP\n28-AUG-23\nTOTAL 5.00`).date === '2023-08-28', 'dd-MON-yy')

// 19. Address / phone / postcode lines never become the merchant.
r = parseReceiptText(`GARBAGE X\nQUINNS OF DRUMCONDRA\n12 Lower Road\nD09 X4T2\nTel: 01 8371234\nTOTAL 8.00`)
ok(/Quinns/i.test(r.merchant), 'address+phone rejected, real name wins', r.merchant)


// 20. THE CAMDEN (pub). Total repeats twice; an OCR garble appears once.
const CAMDEN = `The Camden
Camden Street
Table #46
Trans #: 2402888   Serv: EVREN
15/09/2024 18:56  # Cust: 2
Quan Descript              Cost
14 PT PERONI             106.40
3 PINT CORDIAL             7.50
2 PT MORETTI              15.60
3 CBC FRIES               35.85
Net Total:               136.87
13.5% VAT                  4.26
23% VAT                   24.22
TOTAL:                   656.35
Amount Due:              165.35
VAT: IE3867813KH
Service Charge of 12.5% not included`
r = parseReceiptText(CAMDEN)
ok(r.amount === 165.35, 'CAMDEN: repeated 165.35 beats one-off OCR garble', r.amount)
ok(/Camden/i.test(r.merchant), 'CAMDEN: merchant', r.merchant)
ok(r.guessedCategoryId === 'food', 'CAMDEN: pints/fries -> food', r.guessedCategoryId)
ok(r.date === '2024-09-15', 'CAMDEN: date', r.date)

// 21. COOMBE COMMUNITY (pharmacy). "YOU SAVED 17.79" must never be the total.
const COOMBE = `BE Coombe Community
Unit 2 Earls Court
Dolphins Barn Street
DUBLIN 8
D08RDC9
Date: 15/07/2024        Time:12:02
Till No.1          Operator Kellie
PRIVATE RX................ 71.16
TOTAL                      71.16
CREDIT CARD TENDERED       71.16
CHANGE                      0.00
YOU SAVED 17.79`
r = parseReceiptText(COOMBE)
ok(r.amount === 71.16, 'COOMBE: total 71.16, not the 17.79 saving', r.amount)
ok(r.merchant === 'Coombe Community', 'COOMBE: orphan "BE" stripped', r.merchant)
ok(r.date === '2024-07-15', 'COOMBE: labelled date', r.date)

// 22. TAYLOR'S (Spanish). Column headers must not become the merchant.
const TAYLORS = `COCKTAILS BAR
Taylor's
TAYLOR'S COCKTAILS BAR C.B.
C/DUQUE ESTREMERA N14, PALMA NOVA
CIF:B-16663288   IVA 10% INCLUIDO
Mesa 014
Fra Sim: COMPR.        26/05/2024
Unid. Descripcion   Precio Importe
4 SAN MIGUEL         3,00    12,00
Base   % IVA   Total IVA
10,91  10,00   1,09
TOTAL                        12,00
PENDIENTE DE COBRO           12,00
FACTURA SIMPLIFICADA
Gracias por su Visita`
r = parseReceiptText(TAYLORS)
ok(r.amount === 12, "TAYLOR'S: comma-decimal total 12,00", r.amount)
ok(!/descrip|precio|importe/i.test(r.merchant), "TAYLOR'S: column header rejected", r.merchant)
ok(r.guessedCategoryId === 'food', "TAYLOR'S: san miguel -> food", r.guessedCategoryId)
ok(r.date === '2024-05-26', "TAYLOR'S: date", r.date)

// 23. VAT / savings lines are never the amount.
r = parseReceiptText(`SHOP\n23% VAT 24.22\nYOU SAVED 99.99\nTOTAL 10.00`)
ok(r.amount === 10, 'VAT and savings lines excluded', r.amount)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
