import React from 'react'

function formatTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Parse Markdown-style links [text](url) and plain URLs into <a> tags.
 * Everything else is rendered as plain text — no full Markdown parser needed.
 */
function renderContent(text) {
  if (!text) return null

  // Split on [text](url) patterns and bare https:// URLs
  const parts = text.split(/(\[([^\]]+)\]\((https?:\/\/[^)]+)\)|https?:\/\/\S+)/g)

  const elements = []
  let i = 0

  while (i < parts.length) {
    const part = parts[i]
    if (!part) { i++; continue }

    // Full markdown link match: [label](url)
    const mdMatch = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/)
    if (mdMatch) {
      elements.push(
        <a key={i} href={mdMatch[2]} target="_blank" rel="noopener noreferrer"
           style={{ color: 'var(--mdk-accent)', textDecoration: 'underline', wordBreak: 'break-all' }}>
          {mdMatch[1]}
        </a>
      )
      i++
      continue
    }

    // Bare URL
    const urlMatch = part.match(/^https?:\/\/\S+$/)
    if (urlMatch) {
      elements.push(
        <a key={i} href={part} target="_blank" rel="noopener noreferrer"
           style={{ color: 'var(--mdk-accent)', textDecoration: 'underline', wordBreak: 'break-all' }}>
          {part}
        </a>
      )
      i++
      continue
    }

    // Plain text — preserve newlines
    if (part.includes('\n')) {
      const lines = part.split('\n')
      lines.forEach((line, j) => {
        if (j > 0) elements.push(<br key={`${i}-br-${j}`} />)
        if (line) elements.push(<span key={`${i}-${j}`}>{line}</span>)
      })
    } else if (part) {
      elements.push(<span key={i}>{part}</span>)
    }
    i++
  }

  return elements
}

export function Message({ role, content, ts }) {
  return (
    <div className={`msg-row ${role}`}>
      <div className="bubble">{renderContent(content)}</div>
      <div className="msg-time">{formatTime(ts)}</div>
    </div>
  )
}

export function TypingIndicator() {
  return (
    <div className="msg-row assistant">
      <div className="typing-bubble">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </div>
    </div>
  )
}
