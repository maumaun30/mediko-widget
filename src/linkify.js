// Pure link tokenizer for chat bubbles (no React, no DOM).
// Imported by Message.jsx and by mediko-chatbot/tests/widget.test.js.

// [label](http(s)://…) markdown links, or bare http(s)://… URLs.
const TOKEN = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|https?:\/\/[^\s<>"]+/gi
const TRAILING = /[.,!?;:'"]+$/

/** The URL itself when it parses as http: or https:, else null. */
export function safeHref(raw) {
  try {
    const u = new URL(raw)
    return u.protocol === 'http:' || u.protocol === 'https:' ? raw : null
  } catch {
    return null
  }
}

// Sentence punctuation after a bare URL is not part of it; neither is an
// unbalanced closing parenthesis ("(see https://x.ph/a)").
function trimBare(url) {
  let u = url
  for (;;) {
    const before = u
    u = u.replace(TRAILING, '')
    if (u.endsWith(')') && (u.match(/\(/g) || []).length < (u.match(/\)/g) || []).length) u = u.slice(0, -1)
    if (u === before) return u
  }
}

/**
 * Split message text into tokens:
 *   { type: 'text', text }
 *   { type: 'link', href, label }      inline anchor
 *   { type: 'product', href, label }   markdown link to a /products/ page (card)
 * Only http(s) URLs ever become links; anything else stays text.
 */
export function tokenizeLinks(text) {
  const out = []
  if (!text) return out
  const pushText = (t) => {
    if (!t) return
    const last = out[out.length - 1]
    if (last?.type === 'text') last.text += t
    else out.push({ type: 'text', text: t })
  }
  let last = 0, m
  TOKEN.lastIndex = 0
  while ((m = TOKEN.exec(text)) !== null) {
    pushText(text.slice(last, m.index))
    if (m[1]) {
      const href = safeHref(m[2])
      if (!href) pushText(m[0])
      else out.push({ type: href.includes('/products/') ? 'product' : 'link', href, label: m[1] })
      last = m.index + m[0].length
    } else {
      const url = trimBare(m[0])
      const href = safeHref(url)
      if (href) out.push({ type: 'link', href, label: url })
      else pushText(url)
      last = m.index + url.length
      TOKEN.lastIndex = last
    }
  }
  pushText(text.slice(last))
  return out
}
