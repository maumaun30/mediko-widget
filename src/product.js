// Product cards read the store's public AJAX endpoint (/products/<handle>.js).
// The widget runs on the storefront itself, so this is same-origin and needs
// no Storefront API token.

const HANDLE_RE = /^[a-z0-9][a-z0-9-]*$/i

/** Product handle from a store product URL, or '' when it isn't one. */
export function productHandle(url) {
  const raw = String(url || '').split('/products/')[1]?.split(/[?#/]/)[0] || ''
  return HANDLE_RE.test(raw) ? raw : ''
}

/** Same-origin storefront JSON path for a handle. */
export function productJsonPath(handle) {
  return `/products/${encodeURIComponent(handle)}.js`
}

/** Map Shopify AJAX product JSON to the card's { title, price, currency, image }. */
export function fromAjaxProduct(d, currency = 'PHP') {
  if (!d || typeof d.title !== 'string' || !d.title) return null
  const cents = Number(d.price)
  let image = typeof d.featured_image === 'string' ? d.featured_image : null
  if (image && image.startsWith('//')) image = `https:${image}`
  if (image && !/^https:\/\//i.test(image)) image = null
  return {
    title: d.title,
    price: Number.isFinite(cents) ? (cents / 100).toFixed(2) : null,
    currency,
    image,
  }
}
