// Pure message-list helpers for useChat (no React, no DOM).
// Imported by the widget and by mediko-chatbot/tests/widget.test.js.

// Server timestamps are UTC 'YYYY-MM-DD HH:MM:SS(.sss)' strings; make them ISO so
// the browser does not read them as local time.
export function toIso(v) {
  if (!v) return new Date().toISOString()
  const s = String(v)
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s) ? s.replace(' ', 'T') + 'Z' : s
}

// Legacy agent replies were stored with an "[Agent] " prefix.
function stripLegacyPrefix(content) {
  return typeof content === 'string' && content.startsWith('[Agent] ') ? content.slice(8) : content
}

/** History/SSE row → UI message. agent and legacy assistant rows are staff bubbles. */
export function fromServer(m) {
  const staff = m.role === 'agent' || m.role === 'assistant'
  return {
    id:      m.id,
    role:    staff ? 'agent' : 'user',
    content: staff ? stripLegacyPrefix(m.content) : m.content,
    ts:      toIso(m.created_at)
  }
}

/**
 * Append server rows whose id is not in the list yet. New rows are always the
 * latest ones, so appending keeps order without trusting the client clock.
 * Returns `prev` itself when nothing is new.
 */
export function appendMissing(prev, rows) {
  const have = new Set(prev.map(m => m.id))
  const fresh = rows.map(fromServer).filter(m => !have.has(m.id))
  return fresh.length ? [...prev, ...fresh] : prev
}

/**
 * A customer send resolved: give the optimistic temp row its server id. If a
 * history refill already added that server row, drop the temp row instead so
 * ids (and React keys) stay unique. Returns `prev` when there is no saved id.
 */
export function reconcileSent(prev, tempId, saved) {
  if (!saved?.id) return prev
  if (prev.some(m => m.id === saved.id)) return prev.filter(m => m.id !== tempId)
  return prev.map(m => m.id === tempId ? { ...m, id: saved.id, ts: toIso(saved.created_at) } : m)
}

/**
 * Should a failed history load forget the stored session? Only when the server
 * says it does not exist (404). 5xx and network errors (status null) keep it.
 */
export function shouldClearSession(status) {
  return status === 404
}

/** Shown when the server no longer knows the session (404). Local Filipino copy, never the server's text. */
export const SESSION_GONE = 'Natapos na po ang chat na ito. Pakisagutan ulit ang form para makapagsimula ng bagong chat.'
