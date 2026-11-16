// Widget copy that staff can edit in Gateway › Templates › Chat.
// Blank or missing saved text falls back to the built-in Tagalog.

export const GREETING = 'Kumusta po! Paano ko kayo matutulungan ngayon? 😊'

/** { bubble, greeting } from /api/chat/config `texts`. */
export function textsFromConfig(cfg) {
  const pick = (v) => (typeof v === 'string' && v.trim() ? v.trim() : GREETING)
  return { bubble: pick(cfg?.texts?.bubble), greeting: pick(cfg?.texts?.greeting) }
}
