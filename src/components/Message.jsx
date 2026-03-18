import React from 'react'

function formatTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
}

export function Message({ role, content, ts }) {
  return (
    <div className={`msg-row ${role}`}>
      <div className="bubble">{content}</div>
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
