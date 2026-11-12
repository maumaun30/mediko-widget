import { useState, useCallback, useRef, useEffect } from 'react'
import { readResumeToken } from '../prechat.js'
import { fromServer, appendMissing, reconcileSent, shouldClearSession, SESSION_GONE } from '../messages.js'

const API_URL          = import.meta.env.VITE_API_URL
const GREETING         = 'Kumusta po! Paano ko kayo matutulungan ngayon? 😊'
const STORAGE_KEY      = 'mediko_session_id'
const RESUME_PARAM     = 'mdk_chat'
const TYPING_THROTTLE  = 3000
const CONFIG_REFRESH   = 5 * 60 * 1000
const GENERIC_ERROR    = 'May nangyaring mali. Subukan ulit po.'
const CONNECT_ERROR    = 'Hindi makakonekta sa server. Sinusubukan naming muli…'
const FETCH_OPTS       = { credentials: 'omit', mode: 'cors' }
const RETRY_DELAYS     = [3000, 10000, 30000]   // history retry backoff; the last one repeats
const SSE_REOPEN_DELAY = 5000
const FETCH_TIMEOUT    = 8000            // a hung request must not freeze the widget
const DOWN_RETRY       = 15000           // config re-check while the server is unreachable

function localId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// fetch with a timeout: an unreachable server fails fast instead of hanging.
function timedFetch(url, opts = {}, ms = FETCH_TIMEOUT) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t))
}

async function readError(res, fallback) {
  try { const body = await res.json(); return body?.error || fallback } catch { return fallback }
}

export function useChat() {
  const [messages,     setMessages]     = useState([])
  const [isTyping,     setIsTyping]     = useState(false)   // AI streaming only
  const [agentTyping,  setAgentTyping]  = useState(false)
  const [sessionId,    setSessionId]    = useState(null)
  const [needsPrechat, setNeedsPrechat] = useState(false)
  const [ready,        setReady]        = useState(false)
  const [online,       setOnline]       = useState(null)
  const [nextOpenAt,   setNextOpenAt]   = useState(null)
  const [error,        setError]        = useState(null)
  const [autoOpen,     setAutoOpen]     = useState(false)
  const [starting,     setStarting]     = useState(false)
  const [serverDown,   setServerDown]   = useState(false)   // config check failed; retrying

  const sessionRef       = useRef(null)
  const aiRef            = useRef(false)
  const abortRef         = useRef(null)
  const realtimeRef      = useRef(null)
  const initialised      = useRef(false)
  const agentTypingTimer = useRef(null)
  const lastTypingSent   = useRef(0)
  const awayShown        = useRef(false)
  const retryTimer       = useRef(null)
  const retryAttempt     = useRef(0)
  const downTimer        = useRef(null)
  const wasDown          = useRef(false)
  const sseReopenTimer   = useRef(null)

  const addMessage = useCallback((role, content, extra = {}) => {
    setMessages(prev => [...prev, { id: localId(), role, content, ts: new Date().toISOString(), ...extra }])
  }, [])

  // Append server rows we do not have yet (by id).
  const mergeServerMessages = useCallback((rows) => {
    setMessages(prev => appendMissing(prev, rows))
  }, [])

  useEffect(() => {
    if (initialised.current) return
    initialised.current = true
    fetchConfig()
    init()
    const t = setInterval(fetchConfig, CONFIG_REFRESH)
    return () => {
      clearInterval(t); clearTimeout(downTimer.current); unsubscribeRealtime(); clearHistoryRetry()
      clearTimeout(agentTypingTimer.current)
    }
  }, [])

  // ── Config ───────────────────────────────────────────────

  // A failed check marks the server down and re-checks every DOWN_RETRY until it
  // answers; coming back refills the open chat so nothing sent meanwhile is missed.
  async function fetchConfig() {
    clearTimeout(downTimer.current)
    let ok = false
    try {
      const res = await timedFetch(`${API_URL}/api/chat/config`, FETCH_OPTS)
      if (res.ok) {
        const cfg = await res.json()
        aiRef.current = cfg.aiEnabled === true
        setOnline(typeof cfg.online === 'boolean' ? cfg.online : null)
        setNextOpenAt(cfg.nextOpenAt || null)
        ok = true
      }
    } catch {}
    if (ok) {
      if (wasDown.current) {
        wasDown.current = false
        setError(e => (e === CONNECT_ERROR ? null : e))
        if (sessionRef.current) refillHistory(sessionRef.current)
      }
      setServerDown(false)
    } else {
      wasDown.current = true
      setServerDown(true)
      downTimer.current = setTimeout(fetchConfig, DOWN_RETRY)
    }
  }

  // ── Session bootstrap: resume link → localStorage → pre-chat form ──

  async function init() {
    let sid = null

    const token = readResumeToken(location.search)
    if (token) {
      try {
        const res = await timedFetch(`${API_URL}/api/chat/resume?t=${encodeURIComponent(token)}`, FETCH_OPTS)
        if (res.ok) {
          const body = await res.json()
          if (body?.sessionId) {
            sid = body.sessionId
            try { localStorage.setItem(STORAGE_KEY, sid) } catch {}
            setAutoOpen(true)
            removeResumeParam()
          }
        }
        // 410 (expired/invalid): ignore and fall back to the stored session.
      } catch {}
    }

    if (!sid) {
      try { sid = localStorage.getItem(STORAGE_KEY) } catch {}
    }

    const outcome = sid ? await loadHistory(sid) : 'gone'
    if (outcome === 'gone') {
      if (sid) { try { localStorage.removeItem(STORAGE_KEY) } catch {} }
      setNeedsPrechat(true)
    } else {
      attachSession(sid)
      if (outcome === 'error') {
        // Server down or unreachable: keep the session, say so, and keep retrying.
        setError(CONNECT_ERROR)
        scheduleHistoryRetry(sid)
      }
    }
    setReady(true)
  }

  function removeResumeParam() {
    try {
      const url = new URL(location.href)
      url.searchParams.delete(RESUME_PARAM)
      history.replaceState(history.state, '', url.pathname + url.search + url.hash)
    } catch {}
  }

  // GET history. Returns { outcome: 'ok' | 'gone' | 'error', rows }.
  // Only a 404 means the session is gone; 5xx and network errors are 'error'.
  async function fetchHistory(sid) {
    let status = null
    try {
      const res = await timedFetch(`${API_URL}/api/chat/history/${sid}`, FETCH_OPTS)
      status = res.status
      if (res.ok) {
        const { messages: rows = [] } = await res.json()
        return { outcome: 'ok', rows }
      }
    } catch {}
    return { outcome: shouldClearSession(status) ? 'gone' : 'error', rows: [] }
  }

  // First load: replace the list. Returns the outcome.
  async function loadHistory(sid) {
    const { outcome, rows } = await fetchHistory(sid)
    if (outcome === 'ok') {
      setMessages(rows.map(fromServer))
      if (!rows.length) addMessage('agent', GREETING)
    }
    return outcome
  }

  // Later loads (retry after an outage, SSE reconnect): merge in what is missing.
  async function refillHistory(sid) {
    const { outcome, rows } = await fetchHistory(sid)
    if (sessionRef.current !== sid) return outcome
    if (outcome === 'ok') {
      clearHistoryRetry()
      setError(e => (e === CONNECT_ERROR ? null : e))
      if (rows.length) mergeServerMessages(rows)
      else setMessages(prev => prev.length ? prev : [{ id: localId(), role: 'agent', content: GREETING, ts: new Date().toISOString() }])
    } else if (outcome === 'gone') {
      endSession()
    }
    return outcome
  }

  function scheduleHistoryRetry(sid) {
    clearTimeout(retryTimer.current)
    const delay = RETRY_DELAYS[Math.min(retryAttempt.current, RETRY_DELAYS.length - 1)]
    retryAttempt.current += 1
    retryTimer.current = setTimeout(async () => {
      if (sessionRef.current !== sid) return
      if (await refillHistory(sid) === 'error' && sessionRef.current === sid) scheduleHistoryRetry(sid)
    }, delay)
  }

  function clearHistoryRetry() {
    clearTimeout(retryTimer.current)
    retryTimer.current = null
    retryAttempt.current = 0
  }

  function attachSession(sid) {
    sessionRef.current = sid
    setSessionId(sid)
    setNeedsPrechat(false)
    subscribeRealtime(sid)
  }

  // ── Pre-chat → POST /api/chat/session ────────────────────

  const startChat = useCallback(async (value) => {
    if (starting) return { ok: false }
    setStarting(true)
    setError(null)
    try {
      const res = await timedFetch(`${API_URL}/api/chat/session`, {
        ...FETCH_OPTS, method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...value, metadata: { url: location.href } })
      })
      if (!res.ok) {
        const msg = res.status === 400 ? await readError(res, GENERIC_ERROR) : CONNECT_ERROR
        return { ok: false, error: msg }
      }
      const { sessionId: id } = await res.json()
      try { localStorage.setItem(STORAGE_KEY, id) } catch {}
      setMessages([])
      addMessage('agent', GREETING)
      attachSession(id)
      return { ok: true }
    } catch {
      return { ok: false, error: CONNECT_ERROR }
    } finally {
      setStarting(false)
    }
  }, [starting, addMessage])

  // ── Realtime push via the API's SSE /listen stream (always open with a session) ──
  //   { type: 'agent_message', message: { id, role, content, created_at } }
  //   { type: 'agent_typing',  value: boolean }
  //   { type: 'connected' | 'ping' }
  // EventSource reconnects on a dropped connection by itself, but gives up for good
  // on a non-200 answer (e.g. 5xx while the server restarts), so then we reopen it.
  // Every 'connected' after the first one re-reads history to fill gaps.

  function subscribeRealtime(sid, connectedBefore = false) {
    if (realtimeRef.current) return

    const es = new EventSource(`${API_URL}/api/chat/listen/${sid}`)
    realtimeRef.current = es

    es.onmessage = (e) => {
      let evt
      try { evt = JSON.parse(e.data) } catch { return }

      switch (evt.type) {
        case 'connected': {
          // Refill on a reconnect, or right away if the first history load failed.
          if (connectedBefore || retryTimer.current) refillHistory(sid)
          connectedBefore = true
          break
        }
        case 'agent_message': {
          setAgentTyping(false)
          clearTimeout(agentTypingTimer.current)
          if (evt.message?.content) mergeServerMessages([{ ...evt.message, role: 'agent' }])
          break
        }
        case 'agent_typing': {
          clearTimeout(agentTypingTimer.current)
          setAgentTyping(!!evt.value)
          if (evt.value) agentTypingTimer.current = setTimeout(() => setAgentTyping(false), 8000)
          break
        }
        // 'ping' — no-op
      }
    }

    es.onerror = () => {
      if (es.readyState !== EventSource.CLOSED) return   // browser is reconnecting
      if (realtimeRef.current === es) realtimeRef.current = null
      clearTimeout(sseReopenTimer.current)
      sseReopenTimer.current = setTimeout(async () => {
        if (sessionRef.current !== sid) return
        // A 404 here means the session is gone: refillHistory ends it, so do not reopen.
        if (await refillHistory(sid) === 'gone') return
        if (sessionRef.current === sid) subscribeRealtime(sid, true)
      }, SSE_REOPEN_DELAY)
    }
  }

  function unsubscribeRealtime() {
    clearTimeout(sseReopenTimer.current)
    try { realtimeRef.current?.close() } catch {}
    realtimeRef.current = null
  }

  // ── Customer typing → POST /api/chat/typing (at most one per 3 s) ──

  const notifyTyping = useCallback(() => {
    const sid = sessionRef.current
    if (!sid) return
    const now = Date.now()
    if (now - lastTypingSent.current < TYPING_THROTTLE) return
    lastTypingSent.current = now
    timedFetch(`${API_URL}/api/chat/typing`, {
      ...FETCH_OPTS, method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sid })
    }).catch(() => {})
  }, [])

  // ── Send message ─────────────────────────────────────────

  const sendMessage = useCallback(async (text) => {
    const sid = sessionRef.current
    if (!text.trim() || isTyping || !sid) return
    setError(null)
    if (aiRef.current === true) return sendToAi(sid, text)

    // Human-only path: POST /api/chat/message
    const tempId = localId()
    setMessages(prev => [...prev, { id: tempId, role: 'user', content: text, ts: new Date().toISOString() }])
    try {
      const res = await timedFetch(`${API_URL}/api/chat/message`, {
        ...FETCH_OPTS, method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid, message: text })
      })
      if (res.status === 404) {
        setMessages(prev => prev.filter(m => m.id !== tempId))
        endSession()
        setError(SESSION_GONE)   // local Filipino copy, not the server's English text
        return
      }
      if (!res.ok) {
        setMessages(prev => prev.filter(m => m.id !== tempId))
        setError(await readError(res, GENERIC_ERROR))
        return
      }
      const { message: saved, away } = await res.json()
      // If a history refill already added this message, drop the temp row (no duplicate ids).
      setMessages(prev => reconcileSent(prev, tempId, saved))
      if (away && !awayShown.current) {
        awayShown.current = true
        addMessage('agent', away)
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setError(GENERIC_ERROR)
    }
  }, [isTyping, addMessage])

  // ── AI streaming path (only when config.aiEnabled === true) ──

  async function sendToAi(sid, text) {
    addMessage('user', text)
    setIsTyping(true)

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

    function setSlot(content) {
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content } : m))
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
          break
        case 'handoff':
        case 'agent_mode':
        case 'away':
          ensureSlot(); setIsTyping(false); setSlot(evt.message)
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

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        ...FETCH_OPTS, method: 'POST',
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
      setError(GENERIC_ERROR)
    }
  }

  // ── Reset ────────────────────────────────────────────────

  function endSession() {
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
    sessionRef.current = null
    abortRef.current?.abort()
    unsubscribeRealtime()
    clearHistoryRetry()
    clearTimeout(agentTypingTimer.current)
    setMessages([]); setSessionId(null); setAgentTyping(false); setIsTyping(false)
    setNeedsPrechat(true)
  }

  function resetSession() {
    endSession()
    setError(null)
  }

  return {
    messages, isTyping, agentTyping, needsPrechat, ready, online, nextOpenAt,
    error, sessionId, autoOpen, starting, serverDown,
    startChat, sendMessage, notifyTyping, resetSession
  }
}
