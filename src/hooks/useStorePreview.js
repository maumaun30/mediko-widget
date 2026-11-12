import { useEffect, useState } from 'react'
import { productJsonPath, fromAjaxProduct } from '../product.js'

// One request per product link for the page's lifetime: url → Promise<preview|null>.
const cache = new Map()
const TIMEOUT_MS = 8000

function load(url, handle) {
  if (!cache.has(url)) {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    const currency = window.Shopify?.currency?.active || 'PHP'
    cache.set(url, fetch(productJsonPath(handle), { credentials: 'same-origin', headers: { Accept: 'application/json' }, signal: ctrl.signal })
      .then(r => (r.ok ? r.json() : null))
      .then(d => fromAjaxProduct(d, url, currency))
      .catch(() => null)
      .finally(() => clearTimeout(t)))
  }
  return cache.get(url)
}

/**
 * Preview for a store product link ({ url, handle } from storeProductLink), built
 * in the customer's browser from the store's own /products/<handle>.js.
 * Returns { preview, loading }.
 */
export function useStorePreview(link) {
  const url = link?.url || null
  const [state, setState] = useState({ url: null, preview: null, loading: false })

  useEffect(() => {
    if (!url) { setState({ url: null, preview: null, loading: false }); return }
    let alive = true
    setState({ url, preview: null, loading: true })
    load(url, link.handle).then(preview => { if (alive) setState({ url, preview, loading: false }) })
    return () => { alive = false }
  }, [url])

  return state.url === url ? state : { url, preview: null, loading: !!url }
}
