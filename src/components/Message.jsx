import React from 'react'

function formatTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Render message content:
 *   [Label](https://url)  → <a href="url">Label</a>   (product name as hyperlink)
 *   https://bare.url      → stripped out entirely       (already covered by Markdown format)
 *   plain text            → rendered as-is with <br> for newlines
 *
 * We intentionally hide raw URLs — the AI is instructed to always use
 * Markdown [label](url) format, so bare URLs only appear as noise.
 */
function renderContent(text) {
  if (!text) return null

  // Single regex: captures [label](url) blocks and bare URLs
  const TOKEN = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)|https?:\/\/[^\s)]+/g

  const elements = []
  let lastIndex  = 0
  let match
  let key = 0

  while ((match = TOKEN.exec(text)) !== null) {
    // Push any plain text before this match
    if (match.index > lastIndex) {
      pushText(text.slice(lastIndex, match.index), key++, elements)
    }

    if (match[1]) {
      // Markdown link [label](url) → hyperlink showing label only
      elements.push(
        <a key={key++}
           href={match[2]}
           target="_blank"
           rel="noopener noreferrer"
           style={{ fontWeight: 500, textDecoration: 'underline', color: 'inherit' }}>
          {match[1]}
        </a>
      )
    }
    // Bare URL — silently drop it (it's a duplicate of the Markdown label above)

    lastIndex = match.index + match[0].length
  }

  // Remaining text after last match
  if (lastIndex < text.length) {
    pushText(text.slice(lastIndex), key++, elements)
  }

  return elements
}

function pushText(str, key, elements) {
  if (!str) return
  const lines = str.split('\n')
  lines.forEach((line, j) => {
    if (j > 0) elements.push(<br key={`${key}-br-${j}`} />)
    if (line)  elements.push(<span key={`${key}-${j}`}>{line}</span>)
  })
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
