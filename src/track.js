// "Track my order" helpers (pure; no React, no DOM).

const ORDER_RE = /^\s*(?:order\s*)?(?:no\.?\s*)?#?\s*\d{3,10}\s*$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MOBILE_RE = /^(\+639|639|09)\d{9}$/

/** { ok: true, value } or { ok: false, errors: { order?, contact? } }. */
export function validateTrack({ order, contact } = {}) {
  const o = String(order || '').trim()
  const c = String(contact || '').trim()
  const errors = {}
  if (!ORDER_RE.test(o)) errors.order = 'Please enter your order number (e.g. #1042).'
  if (!EMAIL_RE.test(c) && !MOBILE_RE.test(c.replace(/[\s-]/g, ''))) {
    errors.contact = 'Please enter the email or mobile number used for the order.'
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: { order: o, contact: c } }
}

const LABELS = {
  shipped: 'Shipped',
  partially_shipped: 'Partially shipped',
  cancelled: 'Cancelled',
  processing: 'Being prepared'
}

export function trackStateLabel(state) {
  return LABELS[state] || LABELS.processing
}

/** "Nov 10, 2026" in Manila time, '' when missing. */
export function trackDate(iso) {
  const d = iso ? new Date(iso) : null
  return d && !Number.isNaN(d.getTime())
    ? d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' })
    : ''
}

/** /apps/mediko/orders (app proxy) → { loggedIn, orders[] } with safe fields only. */
export function ordersFromProxy(json) {
  if (!json || json.loggedIn !== true || !Array.isArray(json.orders)) return { loggedIn: false, orders: [] }
  const str = (v) => (typeof v === 'string' && v ? v : null)
  const orders = json.orders
    .filter(o => o && typeof o.order === 'string' && o.order)
    .map(o => ({
      order: o.order,
      state: str(o.state) || 'processing',
      placedAt: str(o.placedAt),
      shippedAt: str(o.shippedAt),
      carrier: str(o.carrier),
      trackingNumber: str(o.trackingNumber),
      trackingUrl: typeof o.trackingUrl === 'string' && /^https:\/\//i.test(o.trackingUrl) ? o.trackingUrl : null
    }))
  return { loggedIn: true, orders }
}
