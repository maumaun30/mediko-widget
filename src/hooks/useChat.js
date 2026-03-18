/**
 * useChat.js — fixed for Shopify cross-origin SSE streaming
 *
 * Key fixes:
 *  1. Don't add the assistant message slot until first chunk arrives
 *     (avoids Shopify's div:empty → display:none killing the bubble)
 *  2. isTyping stays true until first chunk, not until fetch resolves
 *  3. Robust SSE line parsing that handles multi-line buffers correctly
 *  4. Explicit credentials: 'omit' and mode: 'cors' for cross-origin fetch
 */

import { useState, useCallback, useRef, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL

export function useChat() {
  const [messages,  setMessages]  = useState([])
  const [isTyping,  setIsTyping]  = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const [mode,      setMode]      = useState('ai')
  const [error,     setError]     = useState(null)
  const abortRef    = useRef(null)
  const sessionRef  = useRef(null)   // mirror sessionId for callbacks

  useEffect(() => { initSession() }, [])

  // ── Session init ─────────────────────────────────────────

  async function initSession() {
    const stored = localStorage.getItem('mediko_session_id')
    if (stored) {
      sessionRef.current = stored
      setSessionId(stored)
      await loadHistory(stored)
      return
    }
    try {
      const res = await fetch(`${API_URL}/api/chat/session`, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'omit',
        mode:        'cors',
        body:        JSON.stringify({ metadata: { url: location.href } })
      })
      const { sessionId: id } = await res.json()
      localStorage.setItem('mediko_session_id', id)
      sessionRef.current = id
      setSessionId(id)
      addMessage('assistant', 'Kumusta po! Ako si Medi, ang inyong Mediko assistant. Paano ko kayo matutulungan ngayon? 😊')
    } catch (e) {
      setError('Hindi makakonekta sa server. I-refresh po ang page.')
    }
  }

  async function loadHistory(sid) {
    try {
      const res = await fetch(`${API_URL}/api/chat/history/${sid}`, {
        credentials: 'omit',
        mode:        'cors'
      })
      if (!res.ok) {
        localStorage.removeItem('mediko_session_id')
        sessionRef.current = null
        initSession()
        return
      }
      const { messages: history } = await res.json()
      if (history.length) {
        setMessages(history.map(m => ({
          id:      m.id,
          role:    m.role,
          content: m.content,
          ts:      m.created_at
        })))
      } else {
        addMessage('assistant', 'Kumusta po! Ako si Medi, ang inyong Mediko assistant. Paano ko kayo matutulungan ngayon? 😊')
      }
    } catch {
      addMessage('assistant', 'Kumusta po! Ako si Medi. Paano ko kayo matutulungan?')
    }
  }

  // ── Send message ─────────────────────────────────────────

  const sendMessage = useCallback(async (text) => {
    const sid = sessionRef.current
    if (!text.trim() || !sid || isTyping) return

    setError(null)
    addMessage('user', text)
    setIsTyping(true)

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    // assistantId is created here but the message slot is added only
    // when the first chunk arrives — prevents Shopify hiding an empty div
    const assistantId   = `msg-${Date.now()}`
    let   slotAdded     = false
    let   fullContent   = ''

    function ensureSlot() {
      if (!slotAdded) {
        slotAdded = true
        setIsTyping(false)
        setMessages(prev => [
          ...prev,
          { id: assistantId, role: 'assistant', content: '', ts: new Date().toISOString() }
        ])
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
          // Process any remaining buffer content on stream close
          if (buffer.trim()) processLine(buffer.trim())
          break
        }

        buffer += decoder.decode(value, { stream: true })

        // Split on double-newline (SSE event delimiter)
        const events = buffer.split(/\n\n/)
        buffer = events.pop()  // last element may be incomplete

        for (const event of events) {
          // Each event may have multiple lines; find the data: line
          for (const line of event.split('\n')) {
            processLine(line)
          }
        }
      }

    } catch (err) {
      if (err.name === 'AbortError') return
      console.error('[Mediko widget] Stream error:', err)
      setIsTyping(false)
      // Remove empty slot if it was added but no content came through
      if (slotAdded && !fullContent) {
        setMessages(prev => prev.filter(m => m.id !== assistantId))
      }
      setError('May nangyaring mali. Subukan ulit po.')
    }

    // ── SSE line processor ──────────────────────────────────

    function processLine(line) {
      if (!line.startsWith('data: ')) return
      let evt
      try { evt = JSON.parse(line.slice(6)) } catch { return }

      switch (evt.type) {

        case 'chunk':
          ensureSlot()
          fullContent += evt.text
          setMessages(prev => prev.map(m =>
            m.id === assistantId
              ? { ...m, content: m.content + evt.text }
              : m
          ))
          break

        case 'done':
          ensureSlot()   // in case model returned empty string
          setIsTyping(false)
          break

        case 'handoff':
          ensureSlot()
          setMode('handoff')
          setIsTyping(false)
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, content: evt.message } : m
          ))
          break

        case 'agent_mode':
          ensureSlot()
          setMode('agent')
          setIsTyping(false)
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, content: evt.message } : m
          ))
          break

        case 'error':
          setIsTyping(false)
          if (slotAdded) {
            setMessages(prev => prev.filter(m => m.id !== assistantId))
          }
          setError(evt.message)
          break
      }
    }

  }, [isTyping])

  // ── Helpers ───────────────────────────────────────────────

  function addMessage(role, content) {
    setMessages(prev => [...prev, {
      id:      `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role,
      content,
      ts:      new Date().toISOString()
    }])
  }

  function resetSession() {
    localStorage.removeItem('mediko_session_id')
    sessionRef.current = null
    abortRef.current?.abort()
    setMessages([])
    setMode('ai')
    setError(null)
    setSessionId(null)
    setTimeout(initSession, 100)
  }

  return { messages, isTyping, mode, error, sessionId, sendMessage, resetSession }
}
