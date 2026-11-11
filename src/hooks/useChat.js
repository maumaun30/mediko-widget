import { useState, useCallback, useRef, useEffect } from 'react'

const API_URL          = import.meta.env.VITE_API_URL
const GREETING         = 'Kumusta po! Paano ko kayo matutulungan ngayon? 😊'
const STORAGE_KEY      = 'mediko_session_id'

export function useChat() {
  const [messages,      setMessages]      = useState([])
  const [isTyping,      setIsTyping]      = useState(false)
  const [agentTyping,   setAgentTyping]   = useState(false)
  const [sessionId,     setSessionId]     = useState(null)
  const [mode,          setMode]          = useState('ai')
  const [error,         setError]         = useState(null)
  const [quickReplies,  setQuickReplies]  = useState([])
  const [aiEnabled,     setAiEnabled]     = useState(true)

  const sessionRef  = useRef(null)
  const abortRef    = useRef(null)
  const realtimeRef = useRef(null)
  const initialised = useRef(false)
  const agentTypingTimer = useRef(null)

  const addMessage = useCallback((role, content, extra = {}) => {
    setMessages(prev => [...prev, {
      id:      `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role, content, ts: new Date().toISOString(), ...extra
    }])
  }, [])

  useEffect(() => {
    if (initialised.current) return
    initialised.current = true
    fetchConfig()
    fetchQuickReplies()
    restoreSession()
  }, [])

  // ── Config (AI kill-switch, etc.) ────────────────────────

  async function fetchConfig() {
    try {
      const res = await fetch(`${API_URL}/api/chat/config`, { credentials: 'omit', mode: 'cors' })
      if (!res.ok) return
      const cfg = await res.json()
      if (typeof cfg.aiEnabled === 'boolean') setAiEnabled(cfg.aiEnabled)
    } catch {}
  }

  // ── Quick replies ────────────────────────────────────────

  async function fetchQuickReplies() {
    try {
      const res = await fetch(`${API_URL}/api/quick-replies`, { credentials: 'omit', mode: 'cors' })
      if (!res.ok) return
      const { quickReplies } = await res.json()
      setQuickReplies(quickReplies.map(q => ({ label: q.label, message: q.message })))
    } catch {}
  }

  // ── Session restore ──────────────────────────────────────

  async function restoreSession() {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) { addMessage('assistant', GREETING); return }
    try {
      const res = await fetch(`${API_URL}/api/chat/history/${stored}`, { credentials: 'omit', mode: 'cors' })
      if (!res.ok) { localStorage.removeItem(STORAGE_KEY); addMessage('assistant', GREETING); return }
      const { messages: history } = await res.json()
      sessionRef.current = stored
      setSessionId(stored)
      if (history.length) {
        setMessages(history.map(m => ({ id: m.id, role: m.role, content: m.content, ts: m.created_at })))
      } else { addMessage('assistant', GREETING) }
      try {
        const modeRes = await fetch(`${API_URL}/api/chat/mode/${stored}`, { credentials: 'omit', mode: 'cors' })
        if (modeRes.ok) {
          const { mode: cur } = await modeRes.json()
          if (cur === 'agent' || cur === 'handoff') { setMode(cur); subscribeRealtime(stored) }
        }
      } catch {}
    } catch { addMessage('assistant', GREETING) }
  }

  // ── Session creation ──────────────────────────────────────

  async function createSession() {
    try {
      const res = await fetch(`${API_URL}/api/chat/session`, {
        method: 'POST', credentials: 'omit', mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metadata: { url: location.href } })
      })
      if (!res.ok) throw new Error()
      const { sessionId: id } = await res.json()
      localStorage.setItem(STORAGE_KEY, id)
      sessionRef.current = id; setSessionId(id)
      return id
    } catch { setError('Hindi makakonekta sa server. I-refresh po ang page.'); return null }
  }

  // ── Realtime (agent push) via the API's SSE /listen stream ──
  // Replaces the old Supabase Realtime WebSocket. The server pushes:
  //   { type: 'agent_message', text }  — agent reply
  //   { type: 'agent_typing', ... }    — agent typing indicator
  //   { type: 'mode_changed',  mode }  — handed back to AI (mode='ai') or taken over
  //   { type: 'connected' | 'ping' }   — lifecycle/keepalive (ignored)
  // EventSource is a native browser API and auto-reconnects on drop.

  function subscribeRealtime(sid) {
    if (realtimeRef.current) return

    const es = new EventSource(`${API_URL}/api/chat/listen/${sid}`)
    realtimeRef.current = es

    es.onmessage = (e) => {
      let evt
      try { evt = JSON.parse(e.data) } catch { return }

      switch (evt.type) {
        case 'agent_message': {
          setAgentTyping(false)
          clearTimeout(agentTypingTimer.current)
          const raw     = evt.text || ''
          const content = raw.startsWith('[Agent] ') ? raw.slice(8) : raw
          addMessage('assistant', content)
          break
        }
        case 'agent_typing': {
          setAgentTyping(true)
          clearTimeout(agentTypingTimer.current)
          agentTypingTimer.current = setTimeout(() => setAgentTyping(false), 8000)
          break
        }
        case 'mode_changed': {
          if (evt.mode === 'ai') {
            setMode('ai')
            setAgentTyping(false)
            addMessage('assistant', 'Naibalik na po kayo sa aming Mediko Assistant. Paano ko pa kayo matutulungan?')
          } else if (evt.mode === 'agent') {
            setMode('agent')
          }
          break
        }
        // 'connected', 'ping' — no-op
      }
    }

    es.onerror = () => { /* EventSource reconnects automatically */ }
  }

  function unsubscribeRealtime() {
    try { realtimeRef.current?.close() } catch {}
    realtimeRef.current = null
  }

  // ── Rating ────────────────────────────────────────────────

  const rateMessage = useCallback(async (messageId, rating) => {
    const sid = sessionRef.current
    if (!sid) return
    try {
      await fetch(`${API_URL}/api/analytics/rate`, {
        method: 'POST', credentials: 'omit', mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid, messageId, rating })
      })
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, rated: rating } : m))
    } catch {}
  }, [])

  // ── Send message ──────────────────────────────────────────

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || isTyping) return
    setError(null)
    addMessage('user', text)
    setIsTyping(true)

    let sid = sessionRef.current
    if (!sid) { sid = await createSession(); if (!sid) { setIsTyping(false); return } }

    abortRef.current?.abort()
    abortRef.current = new AbortController()
    const assistantId = `msg-${Date.now()}`
    let slotAdded = false, fullContent = ''

    function ensureSlot() {
      if (!slotAdded) {
        slotAdded = true; setIsTyping(false)
        setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', ts: new Date().toISOString() }])
      }
    }

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST', credentials: 'omit', mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId: sid }),
        signal: abortRef.current.signal
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      if (!res.body) throw new Error('no body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) { if (buffer.trim()) processLine(buffer.trim()); break }
        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split(/\n\n/)
        buffer = events.pop()
        for (const ev of events) for (const line of ev.split('\n')) processLine(line)
      }
    } catch (err) {
      if (err.name === 'AbortError') return
      setIsTyping(false)
      if (slotAdded && !fullContent) setMessages(prev => prev.filter(m => m.id !== assistantId))
      setError('May nangyaring mali. Subukan ulit po.')
    }

    function processLine(line) {
      if (!line.startsWith('data: ')) return
      let evt; try { evt = JSON.parse(line.slice(6)) } catch { return }
      switch (evt.type) {
        case 'chunk':
          ensureSlot(); fullContent += evt.text
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: m.content + evt.text } : m))
          break
        case 'done':
          ensureSlot(); setIsTyping(false)
          // Mark last assistant message as rateable
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, rateable: true } : m))
          break
        case 'handoff':
          ensureSlot(); setMode('handoff'); setIsTyping(false)
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: evt.message } : m))
          subscribeRealtime(sid)
          break
        case 'agent_mode':
          ensureSlot(); setMode('agent'); setIsTyping(false)
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: evt.message } : m))
          subscribeRealtime(sid)
          break
        case 'away':
          ensureSlot(); setIsTyping(false)
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: evt.message } : m))
          break
        case 'agent_ack':
          setIsTyping(false); break
        case 'error':
          setIsTyping(false)
          if (slotAdded) setMessages(prev => prev.filter(m => m.id !== assistantId))
          setError(evt.message)
          break
      }
    }
  }, [isTyping, addMessage])

  // ── Reset ─────────────────────────────────────────────────

  function resetSession() {
    localStorage.removeItem(STORAGE_KEY)
    sessionRef.current = null
    abortRef.current?.abort()
    unsubscribeRealtime()
    setMessages([]); setMode('ai'); setError(null); setSessionId(null)
    setAgentTyping(false)
    setTimeout(() => addMessage('assistant', GREETING), 50)
  }

  return {
    messages, isTyping, agentTyping, mode, error,
    sessionId, quickReplies, aiEnabled,
    sendMessage, resetSession, rateMessage
  }
}
