import React, { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { useChat } from '../hooks/useChat.js'
import { validatePrechat } from '../prechat.js'
import { formatSchedule } from '../schedule.js'
import { TrackOrder } from './TrackOrder.jsx'
import { Message, TypingIndicator, isStaffRole, STAFF_LABEL, PreviewCard } from './Message.jsx'
import { storeProductLink } from '../product.js'
import { useStorePreview } from '../hooks/useStorePreview.js'

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

// Header shows only Online/Offline; office hours live in the 🕗 popover.
function statusLine(online, serverDown) {
  if (serverDown || online === false) return 'Offline'
  if (online === true) return 'Online'
  return null
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
      <p className="prechat-intro">Enter your details to start.</p>

      <label className="prechat-field">
        <span className="prechat-label">Name *</span>
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
        {starting ? 'Starting…' : 'Start chat'}
      </button>

      <p className="prechat-privacy">We only use your details to reply to your message.</p>
    </form>
  )
}

const INPUT_MAX_H = 120

export function ChatWidget() {
  const [open,        setOpen]        = useState(false)
  const [input,       setInput]       = useState('')
  const [unread,      setUnread]      = useState(0)
  const [showTooltip, setShowTooltip] = useState(false)
  const [showHours,   setShowHours]   = useState(false)
  const [view,        setView]        = useState('chat')   // 'chat' | 'track'
  const hoursToggled = useRef(false)   // once the customer uses 🕗, stop auto showing/hiding
  const messagesEndRef = useRef(null)
  const inputRef       = useRef(null)
  const prevCount      = useRef(0)

  const {
    messages, isTyping, agentTyping, needsPrechat, ready, online, schedule,
    error, sessionId, autoOpen, starting, serverDown,
    startChat, sendMessage, notifyTyping, resetSession, trackOrder
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

  const canType = !!sessionId && !isTyping && !serverDown

  // WhatsApp-style: a store product link in the draft shows a card above the box;
  // × removes it (for that link), and the message is then sent with hidePreview.
  const [dismissedLinks, setDismissedLinks] = useState(() => new Set())
  const draftLink = storeProductLink(input, location.host)
  const draftCardLink = draftLink && !dismissedLinks.has(draftLink.url) ? draftLink : null
  const { preview: draftPreview, loading: draftLoading } = useStorePreview(draftCardLink)

  function handleSend() {
    const text = input.trim()
    if (!text || !canType) return
    const link = storeProductLink(text, location.host)
    setInput('')
    sendMessage(text, { hidePreview: !!link && dismissedLinks.has(link.url) })
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  function handleChange(e) {
    setInput(e.target.value)
    if (e.target.value.trim()) notifyTyping()
  }

  // Fit the box to its text (1 line up to INPUT_MAX_H) whenever the text changes
  // or the window reopens (the textarea remounts). Scrollbar only past the max.
  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    const border = el.offsetHeight - el.clientHeight
    const want = el.scrollHeight + border
    el.style.height = Math.min(want, INPUT_MAX_H) + 'px'
    el.style.overflowY = want > INPUT_MAX_H ? 'auto' : 'hidden'
  }, [input, open, needsPrechat, ready])

  const status = statusLine(online, serverDown)

  // Outside office hours the schedule starts open; during office hours it starts closed.
  useEffect(() => {
    if (!hoursToggled.current && online !== null) setShowHours(online === false)
  }, [online])
  const scheduleRows = formatSchedule(schedule)

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
                <div className={`header-status ${online && !serverDown ? 'online' : 'offline'}`}>
                  <span className="status-dot" aria-hidden="true" />{status}
                  {scheduleRows.length > 0 && (
                    <button className="hours-btn" type="button" onClick={() => { hoursToggled.current = true; setShowHours(v => !v) }}
                      aria-expanded={showHours} aria-label="Office hours" title="Office hours">🕗</button>
                  )}
                </div>
              )}
            </div>
            <div className="header-btns">
              {sessionId && (
                <button className="icon-btn" onClick={resetSession} title="New chat" aria-label="New chat"><ResetIcon /></button>
              )}
              <button className="icon-btn" onClick={() => setOpen(false)} title="Close" aria-label="Close"><CloseIcon /></button>
            </div>
          </div>

          {showHours && scheduleRows.length > 0 && (
            <div className="hours-panel">
              {scheduleRows.map(r => (
                <div className="hours-row" key={r.days}><span>{r.days}</span><span>{r.hours}</span></div>
              ))}
            </div>
          )}

          {serverDown && (
            <div className="offline-banner" role="status">No connection. Retrying…</div>
          )}

          {ready && view === 'chat' && (
            <div className="track-entry">
              <button type="button" className="track-entry-btn" onClick={() => setView('track')}>📦 Track my order</button>
            </div>
          )}

          {view === 'track' ? (
            <TrackOrder
              trackOrder={trackOrder}
              onBack={() => setView('chat')}
              onChat={(order) => {
                // Start the chat with the order number so the agent sees it flagged.
                setInput(cur => (cur.trim() ? cur : `Order ${order}: `))
                setView('chat')
                setTimeout(() => inputRef.current?.focus(), 50)
              }}
            />
          ) : !ready ? (
            <div className="messages" aria-busy="true" aria-label="Loading">
              <div className="skeleton-row left"><div className="skeleton-bubble w70" /></div>
              <div className="skeleton-row right"><div className="skeleton-bubble w50" /></div>
              <div className="skeleton-row left"><div className="skeleton-bubble w60" /></div>
            </div>
          ) : needsPrechat ? (
            <div className="messages prechat-wrap">
              {error && <div className="prechat-form-error" role="alert">⚠️ {error}</div>}
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
                    preview={m.preview}
                    hidePreview={m.hidePreview}
                    showLabel={isStaffRole(m.role) && (idx === 0 || !isStaffRole(messages[idx - 1]?.role))}
                  />
                ))}
                {isTyping    && <TypingIndicator />}
                {agentTyping && <TypingIndicator />}
                {error && !serverDown && (
                  <div className="msg-row assistant">
                    <div className="bubble" style={{ background: '#fff0f0', borderColor: '#fecaca', color: '#991b1b' }}>
                      ⚠️ {error}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Link preview for the draft */}
              {draftCardLink && (draftLoading || draftPreview) && (
                <div className="draft-preview">
                  {draftPreview
                    ? <PreviewCard preview={draftPreview} />
                    : <div className="draft-preview-loading">Loading preview…</div>}
                  <button className="draft-preview-remove" type="button" aria-label="Remove preview"
                    onClick={() => setDismissedLinks(s => new Set(s).add(draftCardLink.url))}>×</button>
                </div>
              )}

              {/* Input */}
              <div className="input-area">
                <textarea
                  ref={inputRef}
                  className="msg-input"
                  value={input}
                  onChange={handleChange}
                  onKeyDown={handleKey}
                  placeholder={serverDown ? 'Offline' : 'I-type ang inyong mensahe...'}
                  rows={1}
                  disabled={!canType}
                  aria-label="Message input"
                />
                <button className="send-btn" onClick={handleSend} disabled={!input.trim() || !canType} aria-label="Send">
                  <SendIcon />
                </button>
              </div>
            </>
          )}

        </div>
      )}

      {/* FAB */}
      <div className="fab-wrap">
        <button className={`fab${open ? ' open' : ''}`} onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Close chat' : 'Open chat'}>
          {!open && <div className="fab-pulse" />}
          {open ? <CloseIcon /> : <ChatIcon />}
        </button>
        {!open && unread > 0 && <div className="fab-badge">{unread > 9 ? '9+' : unread}</div>}
      </div>
    </>
  )
}
