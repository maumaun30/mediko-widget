import React from 'react'
import { tokenizeLinks } from '../linkify.js'
import { formatPreviewPrice } from '../product.js'


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
 * anchors; any other scheme stays plain text. Product cards come only from the
 * reply's `preview` (see PreviewCard).
 */
function renderContent(text) {
  if (!text) return null

  const elements = []
  let key = 0

  for (const tok of tokenizeLinks(text)) {
    if (tok.type === 'text') {
      pushText(tok.text, key++, elements)
    } else {
      elements.push(
        <a key={key++} href={tok.href} target="_blank" rel="noopener noreferrer"
           style={{ fontWeight: 500, textDecoration: 'underline', color: 'inherit', wordBreak: 'break-all' }}>
          {tok.label}
        </a>
      )
    }
  }

  return { elements }
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

// Link preview sent with an agent reply (already sanitized by safePreview).
function PreviewCard({ preview }) {
  const price = formatPreviewPrice(preview.price, preview.currency)
  return (
    <a className="product-card" href={preview.url} target="_blank" rel="noopener noreferrer">
      {preview.image
        ? <img className="product-card-img" src={preview.image} alt="" loading="lazy" />
        : <div className="product-card-img-placeholder">💊</div>}
      <div className="product-card-info">
        <div className="product-card-name">{preview.title}</div>
        {price && <div className="product-card-price">{price}</div>}
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

export function Message({ role, content, ts, showLabel, preview }) {
  if (!content) return null

  const parsed = renderContent(content)
  if (!parsed) return null

  const { elements } = parsed
  const staff = isStaffRole(role)

  return (
    <div className={`msg-row ${staff ? 'assistant' : 'user'}`}>
      {staff && showLabel && (
        <div className="bot-label">{STAFF_LABEL}</div>
      )}
      <div className="bubble">{elements}</div>
      {staff && preview && (
        <div className="product-cards"><PreviewCard preview={preview} /></div>
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
