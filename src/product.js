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
