import React, { useState, useRef, useEffect } from 'react'
import { useChat } from '../hooks/useChat.js'
import { validatePrechat, formatNextOpen } from '../prechat.js'
import { Message, TypingIndicator, isStaffRole, STAFF_LABEL } from './Message.jsx'

const ChatIcon  = () => <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>
const CloseIcon = () => <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
const SendIcon  = () => <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
const ResetIcon = () => <svg viewBox="0 0 24 24"><path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>

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

function statusLine(online, nextOpenAt) {
  if (online === true) return 'Online · karaniwang sumasagot sa loob ng ilang minuto'
  if (online === false) {
    const when = formatNextOpen(nextOpenAt)
    return when ? `Offline · babalik ${when}` : 'Offline'
  }
  return ''
}

// Logged-in Shopify customer passed from the theme: window.MEDIKO_CUSTOMER = { name, email, phone }
function themeCustomer() {
  try {
    const c = typeof window !== 'undefined' ? window.MEDIKO_CUSTOMER : null
    if (!c || typeof c !== 'object') return { name: '', email: '', phone: '' }
    return { name: String(c.name || ''), email: String(c.email || ''), phone: String(c.phone || '') }
  } catch {
    return { name: '', email: '', phone: '' }
  }
}

function PrechatForm({ onStart, starting }) {
  const [form,      setForm]      = useState(themeCustomer)
  const [errors,    setErrors]    = useState({})
  const [formError, setFormError] = useState(null)

  function update(field) {
    return e => {
      const v = e.target.value
      setForm(f => ({ ...f, [field]: v }))
      if (errors[field]) setErrors(er => ({ ...er, [field]: undefined }))
    }
  }

  async function submit(e) {
    e.preventDefault()
    if (starting) return
    setFormError(null)
    const r = validatePrechat(form)
    if (!r.ok) { setErrors(r.errors); return }
    setErrors({})
    const res = await onStart(r.value)
    if (!res?.ok && res?.error) setFormError(res.error)
  }

  return (
    <form className="prechat" onSubmit={submit} noValidate>
      <p className="prechat-intro">Bago tayo magsimula, pakilagay po ang inyong detalye:</p>

      <label className="prechat-field">
        <span className="prechat-label">Pangalan *</span>
        <input className={`prechat-input${errors.name ? ' invalid' : ''}`} type="text" autoComplete="name"
          maxLength={100} value={form.name} onChange={update('name')} aria-invalid={!!errors.name} />
        {errors.name && <span className="prechat-error">{errors.name}</span>}
      </label>

      <label className="prechat-field">
        <span className="prechat-label">Email *</span>
        <input className={`prechat-input${errors.email ? ' invalid' : ''}`} type="email" autoComplete="email"
          value={form.email} onChange={update('email')} aria-invalid={!!errors.email} />
        {errors.email && <span className="prechat-error">{errors.email}</span>}
      </label>

      <label className="prechat-field">
        <span className="prechat-label">Mobile number *</span>
        <input className={`prechat-input${errors.phone ? ' invalid' : ''}`} type="tel" autoComplete="tel"
          inputMode="tel" placeholder="09XXXXXXXXX" value={form.phone} onChange={update('phone')}
          aria-invalid={!!errors.phone} />
        {errors.phone && <span className="prechat-error">{errors.phone}</span>}
      </label>

      {formError && <div className="prechat-form-error" role="alert">⚠️ {formError}</div>}

      <button className="prechat-cta" type="submit" disabled={starting}>
        {starting ? 'Sandali lang po…' : 'Simulan ang chat'}
      </button>

      <p className="prechat-privacy">Gagamitin lang po namin ang inyong detalye para sagutin ang inyong mensahe.</p>
    </form>
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
    messages, isTyping, agentTyping, needsPrechat, ready, online, nextOpenAt,
    error, sessionId, autoOpen, starting,
    startChat, sendMessage, notifyTyping, resetSession
  } = useChat()

  useEffect(() => { const t = setTimeout(() => setShowTooltip(true), 2500); return () => clearTimeout(t) }, [])

  // Resume link (?mdk_chat=…) reopens the chat automatically.
  useEffect(() => { if (autoOpen) setOpen(true) }, [autoOpen])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    // Count only staff replies that arrive after the initial load.
    if (ready && !open && messages.length > prevCount.current) {
      const fresh = messages.slice(prevCount.current).filter(m => isStaffRole(m.role)).length
      if (fresh) setUnread(n => n + fresh)
    }
    prevCount.current = messages.length
  }, [messages, isTyping, agentTyping])

  useEffect(() => {
    if (open) { setUnread(0); setShowTooltip(false); setTimeout(() => inputRef.current?.focus(), 200) }
  }, [open])

  const canType = !!sessionId && !isTyping

  function handleSend() {
    const text = input.trim()
    if (!text || !canType) return
    setInput(''); if (inputRef.current) inputRef.current.style.height = ''
    sendMessage(text)
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  function handleChange(e) {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
    if (e.target.value.trim()) notifyTyping()
  }

  const status = statusLine(online, nextOpenAt)

  return (
    <>
      {showTooltip && !open && <TooltipPopup onDismiss={() => setShowTooltip(false)} />}

      {open && (
        <div className="chat-window" role="dialog" aria-label="Mediko Chat">
          {/* Header */}
          <div className="chat-header">
            <div className="header-text">
              <div className="header-name">{STAFF_LABEL}</div>
              {status && (
                <div className={`header-status ${online ? 'online' : 'offline'}`}>
                  <span className="status-dot" aria-hidden="true" />{status}
                </div>
              )}
            </div>
            <div className="header-btns">
              {sessionId && (
                <button className="icon-btn" onClick={resetSession} title="Bagong usapan" aria-label="Bagong usapan"><ResetIcon /></button>
              )}
              <button className="icon-btn" onClick={() => setOpen(false)} title="Isara" aria-label="Isara"><CloseIcon /></button>
            </div>
          </div>

          {needsPrechat ? (
            <div className="messages prechat-wrap">
              <PrechatForm onStart={startChat} starting={starting} />
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="messages">
                {messages.map((m, idx) => (
                  <Message
                    key={m.id}
                    role={m.role}
                    content={m.content}
                    ts={m.ts}
                    showLabel={isStaffRole(m.role) && (idx === 0 || !isStaffRole(messages[idx - 1]?.role))}
                  />
                ))}
                {isTyping    && <TypingIndicator />}
                {agentTyping && <TypingIndicator />}
                {error && (
                  <div className="msg-row assistant">
                    <div className="bubble" style={{ background: '#fff0f0', borderColor: '#fecaca', color: '#991b1b' }}>
                      ⚠️ {error}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="input-area">
                <textarea
                  ref={inputRef}
                  className="msg-input"
                  value={input}
                  onChange={handleChange}
                  onKeyDown={handleKey}
                  placeholder="I-type ang inyong mensahe..."
                  rows={1}
                  disabled={!canType}
                  aria-label="Message input"
                />
                <button className="send-btn" onClick={handleSend} disabled={!input.trim() || !canType} aria-label="Ipadala">
                  <SendIcon />
                </button>
              </div>
            </>
          )}

          <div className="chat-footer">
            Powered by <a href="https://store.mediko.ph" target="_blank" rel="noopener">Mediko.ph</a>
          </div>
        </div>
      )}

      {/* FAB */}
      <div className="fab-wrap">
        <button className={`fab${open ? ' open' : ''}`} onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Isara' : 'Buksan ang chat'}>
          {!open && <div className="fab-pulse" />}
          {open ? <CloseIcon /> : <ChatIcon />}
        </button>
        {!open && unread > 0 && <div className="fab-badge">{unread > 9 ? '9+' : unread}</div>}
      </div>
    </>
  )
}
