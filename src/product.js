// Link previews on agent replies. Gateway builds them from the Shopify Admin
// API and the chat service validates them; the widget only draws what comes
// with the message (no storefront fetch, which Shopify rate-limits).
// Still re-checked here, since it ends up in the customer's page.

const IMAGE_PREFIX = 'https://cdn.shopify.com/'

/** A preview safe to render, or null. */
export function safePreview(p) {
  if (!p || typeof p !== 'object') return null
  let url
  try { url = new URL(String(p.url)) } catch { return null }
  if (url.protocol !== 'https:') return null
  if (typeof p.title !== 'string' || !p.title.trim()) return null
  const image = typeof p.image === 'string' && p.image.startsWith(IMAGE_PREFIX) ? p.image : null
  const price = typeof p.price === 'string' && /^\d+(\.\d{1,2})?$/.test(p.price) ? p.price : null
  const currency = typeof p.currency === 'string' && /^[A-Z]{3}$/.test(p.currency) ? p.currency : null
  return { url: String(p.url), title: p.title.slice(0, 200), image, price, currency }
}

/** "₱1,899.00" for PHP, "USD 12.00" otherwise, '' without a price. */
export function formatPreviewPrice(price, currency) {
  if (!price) return ''
  const n = Number(price)
  if (!Number.isFinite(n)) return ''
  const amount = n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return !currency || currency === 'PHP' ? `₱${amount}` : `${currency} ${amount}`
}

// ── Customer-side link previews ────────────────────────────
// A customer pasting a product link sees a card built in their own browser from
// the store's public /products/<handle>.js (same origin, no token). Agents never
// trust this: Gateway builds its own card from the Admin API.

const HANDLE_RE = /^[a-z0-9][a-z0-9-]*$/i
const URL_RE = /https:\/\/[^\s<>"]+/gi

/** First https product link on `host` in the text: { url, handle } or null. */
export function storeProductLink(text, host) {
  for (const m of String(text || '').matchAll(URL_RE)) {
    const raw = m[0].replace(/[.,!?;:)'"]+$/, '')
    let u
    try { u = new URL(raw) } catch { continue }
    if (u.host !== host) continue
    const hm = /\/products\/([^/?#]+)\/?$/.exec(u.pathname)
    if (hm && HANDLE_RE.test(hm[1])) return { url: raw, handle: hm[1] }
  }
  return null
}

/** Same-origin storefront JSON path for a handle. */
export function productJsonPath(handle) {
  return `/products/${encodeURIComponent(handle)}.js`
}

/** Map /products/<handle>.js JSON (price in cents) to a preview, via safePreview. */
export function fromAjaxProduct(d, url, currency = 'PHP') {
  if (!d || typeof d.title !== 'string') return null
  let image = typeof d.featured_image === 'string' ? d.featured_image : null
  if (image && image.startsWith('//')) image = `https:${image}`
  const cents = Number(d.price)
  return safePreview({
    url,
    title: d.title,
    image,
    price: Number.isFinite(cents) ? (cents / 100).toFixed(2) : null,
    currency
  })
}
