import React from 'react'

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
 * Parse [label](url) markdown links and bare URLs.
 * Product links (store.mediko.ph/products/...) are rendered as cards.
 * Other links render as inline anchor tags.
 * Bare URLs are silently dropped (they're duplicates of markdown links).
 */
function renderContent(text) {
  if (!text) return null

  const TOKEN = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)|https?:\/\/[^\s)]+/g
  const productLinks = []
  const elements = []
  let lastIndex = 0
  let match
  let key = 0

  // First pass — extract product links separately, render rest inline
  while ((match = TOKEN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      pushText(text.slice(lastIndex, match.index), key++, elements)
    }

    if (match[1]) {
      const url   = match[2]
      const label = match[1]
      if (url.includes('/products/')) {
        // Product link — collect for card rendering below the text
        productLinks.push({ label, url })
        // Still show inline text reference but subtly
        elements.push(
          <span key={key++} style={{ color: 'var(--mdk-primary)', fontWeight: 500 }}>
            {label}
          </span>
        )
      } else {
        elements.push(
          <a key={key++} href={url} target="_blank" rel="noopener noreferrer"
             style={{ fontWeight: 500, textDecoration: 'underline', color: 'inherit' }}>
            {label}
          </a>
        )
      }
    }
    // bare URLs silently dropped

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    pushText(text.slice(lastIndex), key++, elements)
  }

  return { elements, productLinks }
}

function pushText(str, key, elements) {
  if (!str) return
  const lines = str.split('\n')
  lines.forEach((line, j) => {
    if (j > 0) elements.push(<br key={`${key}-br-${j}`} />)
    if (line)  elements.push(<span key={`${key}-${j}`}>{line}</span>)
  })
}

function ProductCard({ label, url }) {
  // Extract handle from URL for display
  const handle = url.split('/products/')[1]?.split('?')[0] || ''
  return (
    <a className="product-card" href={url} target="_blank" rel="noopener noreferrer">
      <div className="product-card-img-placeholder">💊</div>
      <div className="product-card-info">
        <div className="product-card-name">{label}</div>
        <div className="product-card-price">store.mediko.ph</div>
      </div>
      <span className="product-card-arrow">→</span>
    </a>
  )
}

export function Message({ role, content, ts, showLabel }) {
  if (!content) return null

  const parsed = renderContent(content)
  if (!parsed) return null

  const { elements, productLinks } = parsed

  return (
    <div className={`msg-row ${role}`}>
      {role === 'assistant' && showLabel && (
        <div className="bot-label">Medi</div>
      )}
      <div className="bubble">{elements}</div>
      {productLinks.length > 0 && role === 'assistant' && (
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

export function TypingIndicator({ label = 'Medi' }) {
  const avatar = label === 'Agent' ? '👤' : '🌿'
  return (
    <div className="typing-row">
      <div className="typing-avatar">{avatar}</div>
      <div className="typing-bubble">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </div>
      <span className="typing-label">{label} is typing...</span>
    </div>
  )
}
