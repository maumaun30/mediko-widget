/**
 * useChat.js
 *
 * Core chat hook. Manages:
 *   - Session lifecycle (create on mount, persist in localStorage)
 *   - Message state
 *   - SSE streaming from POST /api/chat
 *   - Handoff state
 *   - History reload on re-open
 */

import { useState, useCallback, useRef, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL

export function useChat() {
  const [messages,    setMessages]    = useState([])
  const [isTyping,    setIsTyping]    = useState(false)
  const [sessionId,   setSessionId]   = useState(null)
  const [mode,        setMode]        = useState('ai')   // 'ai' | 'agent' | 'handoff'
  const [error,       setError]       = useState(null)
  const abortRef = useRef(null)

  // ── Session init ───────────────────────────────────────────

  useEffect(() => {
    initSession()
  }, [])

  async function initSession() {
    // Re-use existing session from localStorage if available
    const stored = localStorage.getItem('mediko_session_id')
    if (stored) {
      setSessionId(stored)
      await loadHistory(stored)
      return
    }

    try {
      const res  = await fetch(`${API_URL}/api/chat/session`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ metadata: { url: location.href } })
      })
      const { sessionId: id } = await res.json()
      localStorage.setItem('mediko_session_id', id)
      setSessionId(id)
      addMessage('assistant', 'Kumusta po! Ako si Medi, ang inyong Mediko assistant. Paano ko kayo matutulungan ngayon? 😊')
    } catch {
      setError('Hindi makakonekta sa server. Subukan ulit po.')
    }
  }

  async function loadHistory(sid) {
    try {
      const res  = await fetch(`${API_URL}/api/chat/history/${sid}`)
      if (!res.ok) {
        // Session expired or not found — create new one
        localStorage.removeItem('mediko_session_id')
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

  // ── Send message ───────────────────────────────────────────

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || !sessionId || isTyping) return

    setError(null)
    addMessage('user', text)
    setIsTyping(true)

    // Cancel any in-progress stream
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: text, sessionId }),
        signal:  abortRef.current.signal
      })

      if (!res.ok) throw new Error(`Server error ${res.status}`)

      // Stream SSE
      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantId = `msg-${Date.now()}`
      let buffer = ''

      // Add empty assistant message slot for streaming into
      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', ts: new Date().toISOString() }])
      setIsTyping(false)

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()  // keep incomplete line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const evt = JSON.parse(line.slice(6))
            handleSseEvent(evt, assistantId)
          } catch {}
        }
      }

    } catch (err) {
      if (err.name === 'AbortError') return
      setIsTyping(false)
      setError('May nangyaring mali. Subukan ulit po.')
    }
  }, [sessionId, isTyping])

  // ── SSE event handler ──────────────────────────────────────

  function handleSseEvent(evt, assistantId) {
    switch (evt.type) {

      case 'chunk':
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: m.content + evt.text }
            : m
        ))
        break

      case 'done':
        setIsTyping(false)
        break

      case 'handoff':
        setMode('handoff')
        setIsTyping(false)
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: evt.message }
            : m
        ))
        break

      case 'agent_mode':
        setMode('agent')
        setIsTyping(false)
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: evt.message }
            : m
        ))
        break

      case 'error':
        setIsTyping(false)
        setError(evt.message)
        setMessages(prev => prev.filter(m => m.id !== assistantId))
        break
    }
  }

  // ── Helpers ────────────────────────────────────────────────

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
    setMessages([])
    setMode('ai')
    setError(null)
    setSessionId(null)
    setTimeout(initSession, 100)
  }

  return { messages, isTyping, mode, error, sessionId, sendMessage, resetSession }
}
