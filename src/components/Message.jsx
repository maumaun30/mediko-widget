import React from 'react'

function formatTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
}

function renderContent(text) {
  if (!text) return null

  const TOKEN = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)|https?:\/\/[^\s)]+/g
  const elements = []
  let lastIndex = 0
  let match
  let key = 0

  while ((match = TOKEN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      pushText(text.slice(lastIndex, match.index), key++, elements)
    }
    if (match[1]) {
      elements.push(
        <a key={key++} href={match[2]} target="_blank" rel="noopener noreferrer">
          {match[1]}
        </a>
      )
    }
    // bare URLs silently dropped — always use [label](url) format
    lastIndex = match.index + match[0].length
  }

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

export function Message({ role, content, ts, showLabel }) {
  return (
    <div className={`msg-row ${role}`}>
      {role === 'assistant' && showLabel && (
        <div className="bot-label">Medi</div>
      )}
      <div className="bubble">{renderContent(content)}</div>
      <div className="msg-time">{formatTime(ts)}</div>
    </div>
  )
}

export function TypingIndicator() {
  return (
    <div className="typing-row">
      <div className="typing-avatar">🌿</div>
      <div className="typing-bubble">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </div>
    </div>
  )
}
