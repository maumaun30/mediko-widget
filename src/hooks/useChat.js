/**
 * useChat.js
 *
 * Session is created LAZILY — only when the customer sends their first message.
 * Page visits never hit the API. Returning visitors with a stored session
 * still load their history normally.
 */

import { useState, useCallback, useRef, useEffect } from 'react'

const API_URL  = import.meta.env.VITE_API_URL
const GREETING = 'Kumusta po! Ako si Medi, ang inyong Mediko assistant. Paano ko kayo matutulungan ngayon? 😊'
const STORAGE_KEY = 'mediko_session_id'

export function useChat() {
  const [messages,     setMessages]     = useState([])
  const [isTyping,     setIsTyping]     = useState(false)
  const [sessionId,    setSessionId]    = useState(null)
  const [mode,         setMode]         = useState('ai')
  const [error,        setError]        = useState(null)
  const [quickReplies, setQuickReplies] = useState([])

  const sessionRef  = useRef(null)   // mirrors sessionId for use inside callbacks
  const abortRef    = useRef(null)
  const listenRef   = useRef(null)  // SSE connection for agent messages
  const initialised = useRef(false)  // prevents double-init in StrictMode

  useEffect(() => {
    if (initialised.current) return
    initialised.current = true
    fetchQuickReplies()
    restoreSession()
  }, [])

  // ── Quick replies (public, no auth) ─────────────────────

  async function fetchQuickReplies() {
    try {
      const res = await fetch(`${API_URL}/api/quick-replies`, {
        credentials: 'omit', mode: 'cors'
      })
      if (!res.ok) return
      const { quickReplies } = await res.json()
      setQuickReplies(quickReplies.map(q => ({ label: q.label, message: q.message })))
    } catch { /* graceful degradation — widget still works without quick replies */ }
  }

  // ── Session restore (returning visitors only) ────────────

  async function restoreSession() {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      // New visitor — show greeting locally, no API call yet
      addMessage('assistant', GREETING)
      return
    }

    // Returning visitor — verify session still exists and load history
    try {
      const res = await fetch(`${API_URL}/api/chat/history/${stored}`, {
        credentials: 'omit', mode: 'cors'
      })

      if (!res.ok) {
        // Session expired or not found — treat as new visitor
        localStorage.removeItem(STORAGE_KEY)
        addMessage('assistant', GREETING)
        return
      }

      const { messages: history } = await res.json()
      sessionRef.current = stored
      setSessionId(stored)

      if (history.length) {
        setMessages(history.map(m => ({
          id:      m.id,
          role:    m.role,
          content: m.content,
          ts:      m.created_at
        })))
      } else {
        addMessage('assistant', GREETING)
      }

      // Check if session is in agent mode — if so open the listen stream
      try {
        const modeRes = await fetch(`${API_URL}/api/chat/mode/${stored}`, {
          credentials: 'omit', mode: 'cors'
        })
        if (modeRes.ok) {
          const { mode: currentMode } = await modeRes.json()
          if (currentMode === 'agent' || currentMode === 'handoff') {
            setMode(currentMode)
            openListenStream(stored)
          }
        }
      } catch { /* non-critical */ }

    } catch {
      addMessage('assistant', GREETING)
    }
  }

  // ── Lazy session creation ────────────────────────────────

  /**
   * Create a session on the first message send.
   * Returns the new sessionId, or null on failure.
   */
  async function createSession() {
    try {
      const res = await fetch(`${API_URL}/api/chat/session`, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'omit',
        mode:        'cors',
        body:        JSON.stringify({ metadata: { url: location.href } })
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const { sessionId: id } = await res.json()
      localStorage.setItem(STORAGE_KEY, id)
      sessionRef.current = id
      setSessionId(id)
      return id
    } catch {
      setError('Hindi makakonekta sa server. I-refresh po ang page.')
      return null
    }
  }

  // ── Send message ─────────────────────────────────────────

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || isTyping) return

    setError(null)
    addMessage('user', text)
    setIsTyping(true)

    // Create session lazily on first ever message
    let sid = sessionRef.current
    if (!sid) {
      sid = await createSession()
      if (!sid) { setIsTyping(false); return }
    }

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    const assistantId = `msg-${Date.now()}`
    let   slotAdded   = false
    let   fullContent = ''

    function ensureSlot() {
      if (!slotAdded) {
        slotAdded = true
        setIsTyping(false)
        setMessages(prev => [...prev, {
          id: assistantId, role: 'assistant', content: '', ts: new Date().toISOString()
        }])
      }
    }

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'omit',
        mode:        'cors',
        body:        JSON.stringify({ message: text, sessionId: sid }),
        signal:      abortRef.current.signal
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      if (!res.body) throw new Error('ReadableStream not supported')

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   buffer  = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          if (buffer.trim()) processLine(buffer.trim())
          break
        }
        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split(/\n\n/)
        buffer = events.pop()
        for (const event of events) {
          for (const line of event.split('\n')) processLine(line)
        }
      }

    } catch (err) {
      if (err.name === 'AbortError') return
      console.error('[Mediko widget] Stream error:', err)
      setIsTyping(false)
      if (slotAdded && !fullContent) {
        setMessages(prev => prev.filter(m => m.id !== assistantId))
      }
      setError('May nangyaring mali. Subukan ulit po.')
    }

    function processLine(line) {
      if (!line.startsWith('data: ')) return
      let evt
      try { evt = JSON.parse(line.slice(6)) } catch { return }

      switch (evt.type) {
        case 'chunk':
          ensureSlot()
          fullContent += evt.text
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, content: m.content + evt.text } : m
          ))
          break
        case 'done':
          ensureSlot()
          setIsTyping(false)
          break
        case 'handoff':
          ensureSlot()
          setMode('handoff')
          setIsTyping(false)
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, content: evt.message } : m
          ))
          // Open listener so agent replies appear in real time
          if (sid) openListenStream(sid)
          break
        case 'agent_mode':
          ensureSlot()
          setMode('agent')
          setIsTyping(false)
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, content: evt.message } : m
          ))
          if (sid) openListenStream(sid)
          break
        case 'error':
          setIsTyping(false)
          if (slotAdded) setMessages(prev => prev.filter(m => m.id !== assistantId))
          setError(evt.message)
          break
      }
    }

  }, [isTyping])

  // ── Reset ────────────────────────────────────────────────

  // ── Agent message listener ──────────────────────────────

  /**
   * Open a long-lived SSE connection to /api/chat/listen/:sessionId
   * so agent messages are pushed to the widget in real time.
   * Called automatically when mode switches to 'agent' or 'handoff'.
   */
  function openListenStream(sid) {
    if (listenRef.current) return  // already open
    const url = `${API_URL}/api/chat/listen/${sid}`
    const es  = new EventSource(url, { withCredentials: false })

    es.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data)
        if (evt.type === 'ping') return

        if (evt.type === 'agent_message') {
          // Add the agent reply as an assistant bubble
          addMessage('assistant', evt.text)
        }

        if (evt.type === 'mode_changed' && evt.mode === 'ai') {
          // Agent returned control to AI — close listen stream, reset mode
          setMode('ai')
          addMessage('assistant', 'Naibalik na po kayo sa aming AI assistant na si Medi. Paano ko pa kayo matutulungan?')
          closeListenStream()
        }
      } catch {}
    }

    es.onerror = () => {
      // Connection lost — retry is handled by EventSource automatically
    }

    listenRef.current = es
  }

  function closeListenStream() {
    listenRef.current?.close()
    listenRef.current = null
  }

  function resetSession() {
    localStorage.removeItem(STORAGE_KEY)
    sessionRef.current = null
    abortRef.current?.abort()
    closeListenStream()
    setMessages([])
    setMode('ai')
    setError(null)
    setSessionId(null)
    setTimeout(() => addMessage('assistant', GREETING), 50)
  }

  // ── Helpers ──────────────────────────────────────────────

  function addMessage(role, content) {
    setMessages(prev => [...prev, {
      id:      `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role,
      content,
      ts:      new Date().toISOString()
    }])
  }

  return { messages, isTyping, mode, error, sessionId, quickReplies, sendMessage, resetSession }
}
