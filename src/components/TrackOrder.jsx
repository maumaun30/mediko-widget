import React, { useEffect, useState } from 'react'
import { validateTrack, trackStateLabel, trackDate, ordersFromProxy } from '../track.js'

const PROXY_PATH = '/apps/mediko/orders'   // Shopify app proxy → Gateway /proxy/orders
const PROXY_TIMEOUT_MS = 8000

// Logged-in customers: Shopify forwards the request with their (signed) customer
// id, so we can list their orders without asking for anything. Logged out, not on
// the store, or proxy unavailable → { loggedIn: false } and the form is shown.
async function loadMyOrders() {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), PROXY_TIMEOUT_MS)
  try {
    const res = await fetch(PROXY_PATH, { credentials: 'same-origin', headers: { Accept: 'application/json' }, signal: ctrl.signal })
    if (!res.ok) return { loggedIn: false, orders: [] }
    return ordersFromProxy(await res.json())
  } catch {
    return { loggedIn: false, orders: [] }
  } finally {
    clearTimeout(t)
  }
}

function prefillContact() {
  const c = typeof window !== 'undefined' ? window.MEDIKO_CUSTOMER : null
  return (c && (c.email || c.phone)) || ''
}

function OrderStatus({ s, onChat, onBack, backLabel }) {
  return (
    <div className="track-result">
      <div className="track-order">
        <span className="track-order-name">{s.order}</span>
        <span className={`track-state ${s.state}`}>{trackStateLabel(s.state)}</span>
      </div>
      {s.placedAt && <div className="track-line">Placed {trackDate(s.placedAt)}</div>}
      {s.shippedAt && <div className="track-line">Shipped {trackDate(s.shippedAt)}{s.carrier ? ` via ${s.carrier}` : ''}</div>}
      {s.deliveredAt && <div className="track-line">Delivered {trackDate(s.deliveredAt)}</div>}
      {s.trackingNumber && <div className="track-line">Tracking number: <b>{s.trackingNumber}</b></div>}
      {s.trackingUrl && (
        <a className="prechat-cta track-link" href={s.trackingUrl} target="_blank" rel="noopener noreferrer">Track shipment</a>
      )}
      <button className="track-secondary" type="button" onClick={() => onChat(s.order)}>Chat with us about this order</button>
      <button className="track-secondary" type="button" onClick={onBack}>{backLabel}</button>
    </div>
  )
}

// "Track my order": a logged-in customer's recent orders, or order number + the
// email/mobile used for the order. Only state, dates, carrier and tracking are shown.
export function TrackOrder({ trackOrder, onBack, onChat }) {
  const [mine, setMine] = useState(null)        // null = loading; { loggedIn, orders }
  const [picked, setPicked] = useState(null)    // an order from the list
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(() => ({ order: '', contact: prefillContact() }))
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)    // { found, status } | { error }

  useEffect(() => {
    let alive = true
    loadMyOrders().then(r => { if (alive) setMine(r) })
    return () => { alive = false }
  }, [])

  const update = (field) => (e) => {
    setForm(f => ({ ...f, [field]: e.target.value }))
    if (errors[field]) setErrors(er => ({ ...er, [field]: undefined }))
  }

  async function submit(e) {
    e.preventDefault()
    if (busy) return
    const v = validateTrack(form)
    if (!v.ok) { setErrors(v.errors); return }
    setBusy(true)
    const r = await trackOrder(v.value)
    setBusy(false)
    setResult(r.ok ? { found: r.found, status: r.status } : { error: r.error })
  }

  const hasList = mine?.loggedIn && mine.orders.length > 0
  const found = result?.found ? result.status : null
  const formVisible = mine && !found && !picked && (!hasList || showForm)

  return (
    <div className="messages track-wrap">
      <div className="track-head">
        <button className="track-back" type="button" onClick={onBack}>← Back</button>
        <span className="track-title">Track my order</span>
      </div>

      {!mine && (
        <div className="track-list" aria-busy="true" aria-label="Loading">
          <div className="skeleton-bubble w70" /><div className="skeleton-bubble w60" />
        </div>
      )}

      {picked && <OrderStatus s={picked} onChat={onChat} onBack={() => setPicked(null)} backLabel="Back to my orders" />}
      {found && <OrderStatus s={found} onChat={onChat} onBack={() => setResult(null)} backLabel="Check another order" />}

      {hasList && !picked && !found && !showForm && (
        <>
          <div className="track-subtitle">Your recent orders</div>
          <div className="track-list">
            {mine.orders.map(o => (
              <button key={o.order} type="button" className="track-item" onClick={() => setPicked(o)}>
                <span className="track-item-main">
                  <span className="track-order-name">{o.order}</span>
                  {o.placedAt && <span className="track-item-date">{trackDate(o.placedAt)}</span>}
                </span>
                <span className={`track-state ${o.state}`}>{trackStateLabel(o.state)}</span>
              </button>
            ))}
          </div>
          <button className="track-secondary" type="button" onClick={() => setShowForm(true)}>Track a different order</button>
        </>
      )}

      {mine?.loggedIn && !hasList && !found && (
        <div className="track-line">No orders on your account yet. You can still look one up below.</div>
      )}

      {formVisible && (
        <form className="track-form" onSubmit={submit} noValidate>
          <label className="prechat-field">
            <span className="prechat-label">Order number</span>
            <input className={`prechat-input${errors.order ? ' invalid' : ''}`} type="text" inputMode="numeric"
              placeholder="#1042" value={form.order} onChange={update('order')} aria-invalid={!!errors.order} />
            {errors.order && <span className="prechat-error">{errors.order}</span>}
          </label>
          <label className="prechat-field">
            <span className="prechat-label">Email or mobile number used for the order</span>
            <input className={`prechat-input${errors.contact ? ' invalid' : ''}`} type="text" autoComplete="email"
              value={form.contact} onChange={update('contact')} aria-invalid={!!errors.contact} />
            {errors.contact && <span className="prechat-error">{errors.contact}</span>}
          </label>
          {result?.error && <div className="prechat-form-error" role="alert">⚠️ {result.error}</div>}
          {result && !result.error && !result.found && (
            <div className="prechat-form-error" role="alert">
              We couldn’t find an order with those details. Check the order number and the email or mobile number used at checkout.
            </div>
          )}
          <button className="prechat-cta" type="submit" disabled={busy}>{busy ? 'Checking…' : 'Check status'}</button>
          {hasList && <button className="track-secondary" type="button" onClick={() => setShowForm(false)}>Back to my orders</button>}
        </form>
      )}
    </div>
  )
}
