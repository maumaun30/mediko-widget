import React, { useState, useEffect } from 'react'
import { tokenizeLinks } from '../linkify.js'

const API_URL = import.meta.env.VITE_API_URL

function formatPrice(amount, currency = 'PHP') {
  if (amount == null || amount === '') return ''
  const n = parseFloat(amount)
  if (Number.isNaN(n)) return ''
  return `${currency === 'PHP' ? '₱' : ''}${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Small module-level cache so the same product isn't re-fetched per card/render.
const productCache = new Map()

// ── Product card renderer ────────────────────────────────
// Detects [[PRODUCT:title|price|url|image]] tags injected by the API
// and renders them as visual cards instead of raw text.
const PRODUCT_RE = /\[\[PRODUCT:([^\]]+)\]\]/g

function renderProductCard(raw, key) {
  // Format: [[PRODUCT:Title|₱999|https://...|https://image...]]
  const [title, price, url, image] = raw.split('|')
  return (
    <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="product-card">
      {image && <img src={image} alt={title} className="product-card-img" />}
      <div className="product-card-body">
        <div className="product-card-title">{title}</div>
        {price && <div className="product-card-price">{price}</div>}
        <div className="product-card-cta">View product →</div>
      </div>
    </a>
  )
}

function formatTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Turn message text into elements. http(s) links (markdown or bare) become
 * anchors; markdown links to /products/ pages are also collected so staff
 * bubbles can show product cards. Any other scheme stays plain text.
 */
function renderContent(text) {
  if (!text) return null

  const productLinks = []
  const elements = []
  let key = 0

  for (const tok of tokenizeLinks(text)) {
    if (tok.type === 'text') {
      pushText(tok.text, key++, elements)
    } else if (tok.type === 'product') {
      productLinks.push({ label: tok.label, url: tok.href })
      elements.push(
        <span key={key++} style={{ color: 'var(--mdk-primary)', fontWeight: 500 }}>
          {tok.label}
        </span>
      )
    } else {
      elements.push(
        <a key={key++} href={tok.href} target="_blank" rel="noopener noreferrer"
           style={{ fontWeight: 500, textDecoration: 'underline', color: 'inherit', wordBreak: 'break-all' }}>
          {tok.label}
        </a>
      )
    }
  }

  return { elements, productLinks }
}

// Render a single line of text, turning **bold** into <strong>.
function renderInline(text, keyBase) {
  const out = []
  const re = /\*\*([^*]+)\*\*/g
  let last = 0, m, k = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(<span key={`${keyBase}-t${k++}`}>{text.slice(last, m.index)}</span>)
    out.push(<strong key={`${keyBase}-b${k++}`}>{m[1]}</strong>)
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(<span key={`${keyBase}-t${k++}`}>{text.slice(last)}</span>)
  return out
}

function pushText(str, key, elements) {
  if (!str) return
  const lines = str.split('\n')
  lines.forEach((line, j) => {
    if (j > 0) elements.push(<br key={`${key}-br-${j}`} />)
    // Strip a leading markdown bullet marker (*, -, +) → render a clean •
    const bullet = line.match(/^\s*[-*+]\s+(.*)$/)
    const content = bullet ? bullet[1] : line
    if (bullet) elements.push(<span key={`${key}-${j}-li`} className="li-bullet">• </span>)
    if (content) elements.push(...renderInline(content, `${key}-${j}`))
  })
}

function ProductCard({ label, url }) {
  const handle = url.split('/products/')[1]?.split('?')[0] || ''
  const [data, setData] = useState(() => productCache.get(handle) || null)

  useEffect(() => {
    if (!handle || data) return
    let alive = true
    fetch(`${API_URL}/api/products/by-handle/${handle}`, { credentials: 'omit', mode: 'cors' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) { productCache.set(handle, d); if (alive) setData(d) } })
      .catch(() => {})
    return () => { alive = false }
  }, [handle])

  const title = data?.title || label
  const price = formatPrice(data?.price, data?.currency)

  return (
    <a className="product-card" href={url} target="_blank" rel="noopener noreferrer">
      {data?.image
        ? <img className="product-card-img" src={data.image} alt={title} loading="lazy" />
        : <div className="product-card-img-placeholder">💊</div>}
      <div className="product-card-info">
        <div className="product-card-name">{title}</div>
        <div className="product-card-price">{price || ' '}</div>
      </div>
      <span className="product-card-arrow">→</span>
    </a>
  )
}

export const STAFF_LABEL = 'Mediko Support'

// agent replies and legacy AI (assistant) answers both render as a "Mediko Support" bubble.
export function isStaffRole(role) {
  return role === 'agent' || role === 'assistant'
}

export function Message({ role, content, ts, showLabel }) {
  if (!content) return null

  const parsed = renderContent(content)
  if (!parsed) return null

  const { elements, productLinks } = parsed
  const staff = isStaffRole(role)

  return (
    <div className={`msg-row ${staff ? 'assistant' : 'user'}`}>
      {staff && showLabel && (
        <div className="bot-label">{STAFF_LABEL}</div>
      )}
      <div className="bubble">{elements}</div>
      {productLinks.length > 0 && staff && (
        <div className="product-cards">
          {productLinks.map((p, i) => (
            <ProductCard key={i} label={p.label} url={p.url} />
          ))}
        </div>
      )}
      <div className="msg-time">{formatTime(ts)}</div>
    </div>
  )
}

export function TypingIndicator({ label = STAFF_LABEL }) {
  return (
    <div className="typing-row">
      <div className="typing-bubble">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </div>
      <span className="typing-label">{label} is typing...</span>
    </div>
  )
}
