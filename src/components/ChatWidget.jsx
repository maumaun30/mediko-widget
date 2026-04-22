import React, { useState, useRef, useEffect } from 'react'
import { useChat } from '../hooks/useChat.js'
import { Message, TypingIndicator } from './Message.jsx'

const ChatIcon  = () => <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>
const CloseIcon = () => <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
const SendIcon  = () => <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
const ResetIcon = () => <svg viewBox="0 0 24 24"><path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
const AgentIcon = () => <svg viewBox="0 0 24 24"><path d="M12 1a9 9 0 00-9 9v7a3 3 0 003 3h3v-8H5v-2a7 7 0 1114 0v2h-4v8h3a3 3 0 003-3v-7a9 9 0 00-9-9z"/></svg>

function TooltipPopup({ onDismiss }) {
  const [hiding, setHiding] = useState(false)
  function dismiss() { setHiding(true); setTimeout(onDismiss, 320) }
  useEffect(() => { const t = setTimeout(dismiss, 6000); return () => clearTimeout(t) }, [])
  return (
    <div className={`tooltip-popup${hiding ? ' hide' : ''}`} onClick={dismiss}>
      Kumusta po! Paano ko kayo matutulungan ngayon? 😊
    </div>
  )
}

export function ChatWidget() {
  const [open,        setOpen]        = useState(false)
  const [input,       setInput]       = useState('')
  const [unread,      setUnread]      = useState(0)
  const [showTooltip, setShowTooltip] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef       = useRef(null)
  const prevCount      = useRef(0)

  const {
    messages, isTyping, agentTyping, mode, error,
    quickReplies, aiEnabled,
    sendMessage, resetSession, rateMessage
  } = useChat()

  useEffect(() => { const t = setTimeout(() => setShowTooltip(true), 2500); return () => clearTimeout(t) }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    if (!open && messages.length > prevCount.current) setUnread(n => n + (messages.length - prevCount.current))
    prevCount.current = messages.length
  }, [messages, isTyping, agentTyping])

  useEffect(() => {
    if (open) { setUnread(0); setShowTooltip(false); setTimeout(() => inputRef.current?.focus(), 200) }
  }, [open])

  function handleSend() {
    const text = input.trim()
    if (!text || isTyping) return
    setInput(''); if (inputRef.current) inputRef.current.style.height = ''
    sendMessage(text)
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  function autoResize(e) {
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  function handleQuickReply(msg) { setOpen(true); setTimeout(() => sendMessage(msg), 100) }

  function handleTalkToAgent() {
    if (isTyping || mode !== 'ai') return
    sendMessage('Gusto ko pong makausap ang isang ahente.')
  }

  const aiOff = !aiEnabled && mode === 'ai'

  const statusText = mode === 'agent'   ? '● Naka-konekta sa ahente'
                   : mode === 'handoff' ? '● Naghihintay ng ahente...'
                   : aiOff               ? '● Live agent support lang pansamantala'
                   : '● Online — handang tumulong'

  const showQuickReplies = messages.length <= 1 && mode === 'ai' && !aiOff

  return (
    <>
      {showTooltip && !open && <TooltipPopup onDismiss={() => setShowTooltip(false)} />}

      {open && (
        <div className="chat-window" role="dialog" aria-label="Mediko Chat">
          {/* Header */}
          <div className="chat-header">
            <div className="avatar-wrap">
              <div className="avatar">🌿</div>
              <div className="avatar-online" />
            </div>
            <div className="header-text">
              <div className="header-name">Medi — Mediko Assistant</div>
              <div className="header-tagline">{statusText}</div>
            </div>
            <div className="header-btns">
              {mode === 'ai' && (
                <button className="icon-btn agent-btn" onClick={handleTalkToAgent} disabled={isTyping}
                  title="Kausapin ang ahente" aria-label="Kausapin ang ahente"><AgentIcon /></button>
              )}
              <button className="icon-btn" onClick={resetSession} title="Bagong usapan" aria-label="Bagong usapan"><ResetIcon /></button>
              <button className="icon-btn" onClick={() => setOpen(false)} title="Isara" aria-label="Isara"><CloseIcon /></button>
            </div>
          </div>

          {/* Mode banners */}
          {aiOff && (
            <div className="mode-banner ai-off">
              ℹ️ Pansamantalang hindi available ang AI assistant. Pindutin ang button sa ibaba para makausap ang ahente.
            </div>
          )}
          {mode === 'handoff' && (
            <div className="mode-banner handoff">⏳ Sandali lang po — ikinokonekta kayo sa aming team.</div>
          )}
          {mode === 'agent' && (
            <div className="mode-banner agent">✅ Naka-konekta na kayo sa aming support team.</div>
          )}

          {/* Messages */}
          <div className="messages">
            {messages.map((m, idx) => (
              <Message
                key={m.id}
                id={m.id}
                role={m.role}
                content={m.content}
                ts={m.ts}
                showLabel={m.role === 'assistant' && (idx === 0 || messages[idx-1]?.role !== 'assistant')}
                rateable={m.rateable}
                rated={m.rated}
                onRate={rateMessage}
              />
            ))}
            {isTyping     && <TypingIndicator />}
            {agentTyping  && <TypingIndicator label="Agent is typing..." />}
            {error && (
              <div className="msg-row assistant">
                <div className="bubble" style={{ background: '#fff0f0', borderColor: '#fecaca', color: '#991b1b' }}>
                  ⚠️ {error}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick replies */}
          {showQuickReplies && quickReplies.length > 0 && (
            <div className="quick-replies">
              {quickReplies.map(q => (
                <button key={q.label} className="quick-reply" onClick={() => handleQuickReply(q.message)}>
                  {q.label}
                </button>
              ))}
            </div>
          )}

          {/* AI-off prominent CTA */}
          {aiOff && (
            <div className="agent-cta-wrap">
              <button className="agent-cta" onClick={handleTalkToAgent} disabled={isTyping}>
                <AgentIcon /> Kausapin ang Ahente
              </button>
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
              placeholder={mode === 'agent' ? 'Mag-type ng mensahe...'
                         : aiOff             ? 'Pindutin ang "Kausapin ang Ahente" sa itaas...'
                         : 'I-type ang inyong tanong dito...'}
              rows={1}
              disabled={isTyping}
              aria-label="Message input"
            />
            <button className="send-btn" onClick={handleSend} disabled={!input.trim() || isTyping} aria-label="Ipadala">
              <SendIcon />
            </button>
          </div>

          <div className="chat-footer">
            Powered by <a href="https://store.mediko.ph" target="_blank" rel="noopener">Mediko.ph</a>
          </div>
        </div>
      )}

      {/* FAB */}
      <div className="fab-wrap">
        <button className={`fab${open ? ' open' : ''}`} onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Isara' : 'Buksan ang chat'}>
          {!open && <><div className="fab-pulse" /><div className="fab-pulse" /></>}
          {open ? <CloseIcon /> : <ChatIcon />}
        </button>
        {!open && unread > 0 && <div className="fab-badge">{unread > 9 ? '9+' : unread}</div>}
      </div>
    </>
  )
}
