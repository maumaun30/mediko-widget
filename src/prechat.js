// Pure helpers for the pre-chat form and resume link (no React, no DOM).
// Imported by the widget and by mediko-chatbot/tests/widget.test.js.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^(\+639|09)\d{9}$/

export const PRECHAT_ERRORS = {
  name:  'Pakilagay po ang inyong pangalan.',
  email: 'Pakilagay po ang tamang email.',
  phone: 'Pakilagay po ang tamang mobile number (09XXXXXXXXX).'
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

const DAYS = ['Lin', 'Lun', 'Mar', 'Miy', 'Huw', 'Biy', 'Sab']
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000 // Asia/Manila is UTC+8 with no DST

/** Format an ISO instant in Asia/Manila as e.g. "Lun 8:00 AM". '' when missing/invalid. */
export function formatNextOpen(iso) {
  if (!iso) return ''
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const d = new Date(t + MANILA_OFFSET_MS)
  const h24 = d.getUTCHours()
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  const mm  = String(d.getUTCMinutes()).padStart(2, '0')
  return `${DAYS[d.getUTCDay()]} ${h12}:${mm} ${h24 < 12 ? 'AM' : 'PM'}`
}
