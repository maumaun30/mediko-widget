import React, { useState } from 'react'
import { validateTrack, trackStateLabel, trackDate } from '../track.js'

// "Track my order": order number + the email/mobile used on the order.
// Shows only state, dates, carrier and tracking (the server sends nothing else).
export function TrackOrder({ trackOrder, onBack, onChat }) {
  const [form, setForm] = useState({ order: '', contact: '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)   // { found, status } | { error }

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

  const s = result?.found ? result.status : null

  return (
    <div className="messages track-wrap">
      <div className="track-head">
        <button className="track-back" type="button" onClick={onBack}>← Back</button>
        <span className="track-title">Track my order</span>
      </div>

      {!s && (
        <form className="prechat-form" onSubmit={submit} noValidate>
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
        </form>
      )}

      {s && (
        <div className="track-result">
          <div className="track-order">
            <span className="track-order-name">{s.order}</span>
            <span className={`track-state ${s.state}`}>{trackStateLabel(s.state)}</span>
          </div>
          {s.placedAt && <div className="track-line">Placed {trackDate(s.placedAt)}</div>}
          {s.shippedAt && <div className="track-line">Shipped {trackDate(s.shippedAt)}{s.carrier ? ` via ${s.carrier}` : ''}</div>}
          {s.trackingNumber && <div className="track-line">Tracking number: <b>{s.trackingNumber}</b></div>}
          {s.trackingUrl && (
            <a className="prechat-cta track-link" href={s.trackingUrl} target="_blank" rel="noopener noreferrer">Track shipment</a>
          )}
          <button className="track-secondary" type="button" onClick={() => onChat(s.order)}>Chat with us about this order</button>
          <button className="track-secondary" type="button" onClick={() => { setResult(null) }}>Check another order</button>
        </div>
      )}
    </div>
  )
}
