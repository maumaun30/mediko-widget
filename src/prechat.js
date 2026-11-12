// Pure helpers for the pre-chat form and resume link (no React, no DOM).
// Imported by the widget and by mediko-chatbot/tests/widget.test.js.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^(\+639|09)\d{9}$/

export const PRECHAT_ERRORS = {
  name:  'Please enter your name.',
  email: 'Please enter a valid email.',
  phone: 'Please enter a valid mobile number (09XXXXXXXXX).'
}

/**
 * Validate the pre-chat form.
 * @returns {{ ok: true, value: { customerName, customerEmail, customerPhone } }
 *         | { ok: false, errors: { name?, email?, phone? } }}
 */
export function validatePrechat({ name, email, phone } = {}) {
  const customerName  = String(name ?? '').trim()
  const customerEmail = String(email ?? '').trim()
  const customerPhone = String(phone ?? '').replace(/[\s-]/g, '')

  const errors = {}
  if (customerName.length < 1 || customerName.length > 100) errors.name = PRECHAT_ERRORS.name
  if (!EMAIL_RE.test(customerEmail)) errors.email = PRECHAT_ERRORS.email
  if (!PHONE_RE.test(customerPhone)) errors.phone = PRECHAT_ERRORS.phone

  if (Object.keys(errors).length) return { ok: false, errors }
  return { ok: true, value: { customerName, customerEmail, customerPhone } }
}

/** Read the signed resume token (`mdk_chat`) from a query string, or null. */
export function readResumeToken(search) {
  try {
    const t = new URLSearchParams(search || '').get('mdk_chat')
    return t ? t : null
  } catch {
    return null
  }
}

