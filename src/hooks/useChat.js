import { useState, useCallback, useRef, useEffect } from 'react'

const API_URL     = import.meta.env.VITE_API_URL
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const GREETING    = 'Kumusta po! Paano ko kayo matutulungan ngayon? 😊'
const STORAGE_KEY = 'mediko_session_id'

export function useChat() {
  const [messages,     setMessages]     = useState([])
  const [isTyping,     setIsTyping]     = useState(false)
  const [sessionId,    setSessionId]    = useState(null)
  const [mode,         setMode]         = useState('ai')
  const [error,        setError]        = useState(null)
  const [quickReplies, setQuickReplies] = useState([])

  const sessionRef  = useRef(null)
  const abortRef    = useRef(null)
  const realtimeRef = useRef(null)   // Supabase realtime channel
  const initialised = useRef(false)

  const addMessage = useCallback((role, content) => {
    setMessages(prev => [...prev, {
      id:      `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role,
      content,
      ts:      new Date().toISOString()
    }])
  }, [])

  useEffect(() => {
    if (initialised.current) return
    initialised.current = true
    fetchQuickReplies()
    restoreSession()
  }, [])

  // ── Quick replies ────────────────────────────────────────

  async function fetchQuickReplies() {
    try {
      const res = await fetch(`${API_URL}/api/quick-replies`, {
        credentials: 'omit', mode: 'cors'
      })
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

      // Check mode — subscribe to realtime if already in agent/handoff mode
      try {
        const modeRes = await fetch(`${API_URL}/api/chat/mode/${stored}`, {
          credentials: 'omit', mode: 'cors'
        })
        if (modeRes.ok) {
          const { mode: currentMode } = await modeRes.json()
          if (currentMode === 'agent' || currentMode === 'handoff') {
            setMode(currentMode)
            subscribeRealtime(stored)
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

  // ── Supabase Realtime subscription ──────────────────────
  // Subscribes to the chat_messages table for this session.
  // Fires when a new row is inserted — picks up agent replies instantly
  // regardless of which server instance processed the agent command.

  function subscribeRealtime(sid) {
    if (realtimeRef.current) return
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.warn('[Mediko] Supabase env vars not set')
      return
    }

    // Supabase Realtime v2 — correct channel topic format and event names
    const CHANNEL_ID = `mediko-agent-${sid}`
    const wsUrl = `${SUPABASE_URL}/realtime/v1/websocket?apikey=${SUPABASE_ANON_KEY}&vsn=1.0.0`
      .replace('https://', 'wss://')
      .replace('http://', 'ws://')

    const ws = new WebSocket(wsUrl)
    realtimeRef.current = ws

    let heartbeatTimer = null

    ws.onopen = () => {
      // Send heartbeat every 30s to keep connection alive
      heartbeatTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: 'hb' }))
        }
      }, 30000)

      // Join with Supabase Realtime v2 format
      ws.send(JSON.stringify({
        topic:   `realtime:${CHANNEL_ID}`,
        event:   'phx_join',
        payload: {
          config: {
            postgres_changes: [{
              event:  'INSERT',
              schema: 'public',
              table:  'chat_messages',
              filter: `session_id=eq.${sid}`
            }]
          }
        },
        ref: '1'
      }))
    }

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)

        // Ignore heartbeat ack
        if (msg.topic === 'phoenix') return

        // JOIN confirmation
        if (msg.event === 'phx_reply' && msg.ref === '1') {
          if (msg.payload?.status !== 'ok') {
            console.error('[Mediko] Realtime join failed:', msg.payload?.response)
          }
          return
        }

        // Postgres change event — Supabase v2 wraps in payload.data
        if (msg.event === 'postgres_changes') {
          const record = msg.payload?.data?.record
          if (!record) return
          if (record.role !== 'assistant') return

          // Strip [Agent] prefix for display
          const raw     = record.content || ''
          const content = raw.startsWith('[Agent] ') ? raw.slice(8) : raw

          // Detect return-to-AI (saved by dispatchHandoffReturn)
          if (raw.includes('Naibalik na po')) {
            setMode('ai')
            addMessage('assistant', content)
            unsubscribeRealtime()
            return
          }

          addMessage('assistant', content)
        }

      } catch {}
    }

    ws.onerror = () => {}
    ws.onclose = () => {
      clearInterval(heartbeatTimer)
      realtimeRef.current = null
    }
  }

  function unsubscribeRealtime() {
    if (realtimeRef.current) {
      try { realtimeRef.current.close() } catch {}
      realtimeRef.current = null
    }
  }

  // ── Send message ─────────────────────────────────────────

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || isTyping) return

    setError(null)
    addMessage('user', text)
    setIsTyping(true)

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
          subscribeRealtime(sid)
          break
        case 'agent_mode':
          ensureSlot()
          setMode('agent')
          setIsTyping(false)
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, content: evt.message } : m
          ))
          subscribeRealtime(sid)
          break
        case 'agent_ack':
          // Customer message forwarded to agent — no response shown
          setIsTyping(false)
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
    unsubscribeRealtime()
    setMessages([])
    setMode('ai')
    setError(null)
    setSessionId(null)
    setTimeout(() => addMessage('assistant', GREETING), 50)
  }

  return { messages, isTyping, mode, error, sessionId, quickReplies, sendMessage, resetSession }
}
