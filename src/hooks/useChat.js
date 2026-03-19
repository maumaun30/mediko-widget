import { useState, useCallback, useRef, useEffect } from 'react'

const API_URL     = import.meta.env.VITE_API_URL
const GREETING    = 'Kumusta po! Paano ko kayo matutulungan ngayon? 😊'
const STORAGE_KEY = 'mediko_session_id'

export function useChat() {
  const [messages,     setMessages]     = useState([])
  const [isTyping,     setIsTyping]     = useState(false)
  const [sessionId,    setSessionId]    = useState(null)
  const [mode,         setMode]         = useState('ai')
  const [error,        setError]        = useState(null)
  const [quickReplies, setQuickReplies] = useState([])

  // Stable refs — never stale inside async callbacks
  const sessionRef    = useRef(null)
  const abortRef      = useRef(null)   // aborts the chat SSE stream
  const listenRef     = useRef(null)   // aborts the agent listen stream
  const initialised   = useRef(false)
  const setMessagesRef = useRef(setMessages)
  const setModeRef     = useRef(setMode)
  const setIsTypingRef = useRef(setIsTyping)
  const setErrorRef    = useRef(setError)

  // Keep refs in sync with latest setters (always stable in React)
  useEffect(() => { setMessagesRef.current = setMessages }, [])

  useEffect(() => {
    if (initialised.current) return
    initialised.current = true
    fetchQuickReplies()
    restoreSession()
  }, [])

  // ── Stable addMessage (uses ref, never stale) ────────────

  const addMessage = useCallback((role, content) => {
    setMessages(prev => [...prev, {
      id:      `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role,
      content,
      ts:      new Date().toISOString()
    }])
  }, [])

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
    if (!stored) {
      addMessage('assistant', GREETING)
      return
    }

    try {
      const res = await fetch(`${API_URL}/api/chat/history/${stored}`, {
        credentials: 'omit', mode: 'cors'
      })
      if (!res.ok) {
        localStorage.removeItem(STORAGE_KEY)
        addMessage('assistant', GREETING)
        return
      }

      const { messages: history } = await res.json()
      sessionRef.current = stored
      setSessionId(stored)

      if (history.length) {
        setMessages(history.map(m => ({
          id: m.id, role: m.role, content: m.content, ts: m.created_at
        })))
      } else {
        addMessage('assistant', GREETING)
      }

      // Check mode — if already in agent mode, open listen stream
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
      } catch {}

    } catch {
      addMessage('assistant', GREETING)
    }
  }

  // ── Lazy session creation ────────────────────────────────

  async function createSession() {
    try {
      const res = await fetch(`${API_URL}/api/chat/session`, {
        method: 'POST', credentials: 'omit', mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metadata: { url: location.href } })
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

  // ── Agent listen stream ──────────────────────────────────
  // Defined as a stable function using refs — never stale in closures

  function openListenStream(sid) {
    if (listenRef.current) return  // already open

    const controller = new AbortController()
    listenRef.current = controller

    // Capture stable callbacks via closure over the useCallback versions
    const _addMessage = addMessage

    ;(async () => {
      try {
        const res = await fetch(`${API_URL}/api/chat/listen/${sid}`, {
          method: 'GET', credentials: 'omit', mode: 'cors',
          signal: controller.signal
        })

        if (!res.ok || !res.body) {
          console.error('[Mediko] Listen stream failed:', res.status)
          return
        }

        const reader  = res.body.getReader()
        const decoder = new TextDecoder()
        let   buffer  = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const events = buffer.split(/\n\n/)
          buffer = events.pop()

          for (const event of events) {
            for (const line of event.split('\n')) {
              if (!line.startsWith('data: ')) continue
              try {
                const evt = JSON.parse(line.slice(6))
                if (evt.type === 'ping' || evt.type === 'connected') continue

                if (evt.type === 'agent_message') {
                  _addMessage('assistant', evt.text)
                }

                if (evt.type === 'mode_changed' && evt.mode === 'ai') {
                  setMode('ai')
                  _addMessage('assistant', 'Naibalik na po kayo sa aming AI assistant na si Medi. Paano ko pa kayo matutulungan?')
                  closeListenStream()
                  return
                }
              } catch {}
            }
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') return
        console.error('[Mediko] Listen stream error:', err)
      }
    })()
  }

  function closeListenStream() {
    listenRef.current?.abort()
    listenRef.current = null
  }

  // ── Send message ─────────────────────────────────────────

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || isTyping) return

    setError(null)
    addMessage('user', text)
    setIsTyping(true)

    // Lazy session creation on first message
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
        method: 'POST', credentials: 'omit', mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body:   JSON.stringify({ message: text, sessionId: sid }),
        signal: abortRef.current.signal
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
          openListenStream(sid)
          break
        case 'agent_mode':
          ensureSlot()
          setMode('agent')
          setIsTyping(false)
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, content: evt.message } : m
          ))
          openListenStream(sid)
          break
        case 'error':
          setIsTyping(false)
          if (slotAdded) setMessages(prev => prev.filter(m => m.id !== assistantId))
          setError(evt.message)
          break
      }
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTyping, addMessage])

  // ── Reset ────────────────────────────────────────────────

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

  return { messages, isTyping, mode, error, sessionId, quickReplies, sendMessage, resetSession }
}
