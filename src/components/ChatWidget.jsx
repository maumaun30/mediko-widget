import React, { useState, useRef, useEffect } from 'react'
import { useChat } from '../hooks/useChat.js'
import { Message, TypingIndicator } from './Message.jsx'

const QUICK_REPLIES = [
  'Ano ang mga produkto ninyo?',
  'Para sa immunity',
  'Saan ang order ko?',
  'Makausap ng agent'
]

// SVG icons
const ChatIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>
)
const CloseIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
)
const SendIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
)
const ResetIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
)

export function ChatWidget() {
  const [open,     setOpen]     = useState(false)
  const [input,    setInput]    = useState('')
  const [unread,   setUnread]   = useState(0)
  const messagesEndRef           = useRef(null)
  const inputRef                 = useRef(null)
  const prevMsgCount             = useRef(0)

  const { messages, isTyping, mode, error, sendMessage, resetSession } = useChat()

  // Auto-scroll to bottom when messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    if (!open && messages.length > prevMsgCount.current) {
      setUnread(n => n + (messages.length - prevMsgCount.current))
    }
    prevMsgCount.current = messages.length
  }, [messages, isTyping])

  // Clear unread badge when opened
  useEffect(() => {
    if (open) {
      setUnread(0)
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [open])

  function handleSend() {
    const text = input.trim()
    if (!text || isTyping) return
    setInput('')
    inputRef.current.style.height = ''
    sendMessage(text)
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleQuickReply(text) {
    sendMessage(text)
    setOpen(true)
  }

  function autoResize(e) {
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 110) + 'px'
  }

  const statusText = mode === 'agent'
    ? 'Naka-konekta sa agent'
    : mode === 'handoff'
    ? 'Naghihintay ng agent...'
    : 'Online · Karaniwang sumasagot agad'

  return (
    <>
      {/* ── Chat window ── */}
      {open && (
        <div className="chat-window" role="dialog" aria-label="Mediko Chat">

          {/* Header */}
          <div className="chat-header">
            <div className="avatar">🌿</div>
            <div className="header-text">
              <div className="header-name">Medi — Mediko Assistant</div>
              <div className="header-status">{statusText}</div>
            </div>
            <div className="header-actions">
              <button className="icon-btn" onClick={resetSession} title="Bagong usapan">
                <ResetIcon />
              </button>
              <button className="icon-btn" onClick={() => setOpen(false)} title="Isara">
                <CloseIcon />
              </button>
            </div>
          </div>

          {/* Mode banner */}
          {mode === 'handoff' && (
            <div className="mode-banner">
              ⏳ Naghihintay ng available na agent. Sandali lang po.
            </div>
          )}
          {mode === 'agent' && (
            <div className="mode-banner agent">
              ✅ Naka-konekta na kayo sa aming support team.
            </div>
          )}

          {/* Messages */}
          <div className="messages">
            {messages.map(m => (
              <Message key={m.id} role={m.role} content={m.content} ts={m.ts} />
            ))}
            {isTyping && <TypingIndicator />}
            {error && (
              <div className="msg-row assistant">
                <div className="bubble" style={{ color: '#c53030', background: '#fff5f5' }}>
                  {error}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick replies — only show when no messages yet or last is from assistant */}
          {messages.length <= 1 && mode === 'ai' && (
            <div className="quick-replies">
              {QUICK_REPLIES.map(q => (
                <button key={q} className="quick-reply" onClick={() => handleQuickReply(q)}>
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="input-area">
            <textarea
              ref={inputRef}
              className="msg-input"
              value={input}
              onChange={e => { setInput(e.target.value); autoResize(e) }}
              onKeyDown={handleKey}
              placeholder={mode === 'agent' ? 'Mag-type ng mensahe...' : 'Mag-tanong kay Medi...'}
              rows={1}
              disabled={isTyping}
              aria-label="Message input"
            />
            <button
              className="send-btn"
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              aria-label="Send"
            >
              <SendIcon />
            </button>
          </div>

          <div className="powered-by">
            Powered by <a href="https://store.mediko.ph" target="_blank" rel="noopener">Mediko</a>
          </div>
        </div>
      )}

      {/* ── FAB ── */}
      <button
        className="fab"
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Isara ang chat' : 'Buksan ang chat'}
      >
        {open ? <CloseIcon /> : <ChatIcon />}
        {!open && unread > 0 && (
          <span className="fab-badge">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>
    </>
  )
}
