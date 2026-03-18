import React from 'react'
import { createRoot } from 'react-dom/client'
import { ChatWidget } from './components/ChatWidget.jsx'

// CSS is inlined as a plain string — avoids Vite ?inline issues in IIFE mode.
// Import the raw CSS text via the shared styles module below.
import { WIDGET_CSS } from './styles.js'

function mount() {
  if (document.getElementById('mediko-chat-root')) return

  const host = document.createElement('div')
  host.id = 'mediko-chat-root'

  // Neutralise any Shopify theme CSS that could hide or shrink the host element
  host.style.cssText = [
    'all: initial',
    'position: fixed',
    'bottom: 0',
    'right: 0',
    'width: 0',
    'height: 0',
    'z-index: 2147483647',
    'pointer-events: none'
  ].join('; ')

  host.innerHTML = '\u00A0'  // non-breaking space — prevents Shopify div:empty { display:none }
  document.body.appendChild(host)

  const shadow = host.attachShadow({ mode: 'open' })

  // Load Poppins inside the Shadow DOM
  const fontLink = document.createElement('link')
  fontLink.rel  = 'stylesheet'
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap'
  shadow.appendChild(fontLink)

  const style = document.createElement('style')
  style.textContent = WIDGET_CSS
  shadow.appendChild(style)

  const mountPoint = document.createElement('div')
  shadow.appendChild(mountPoint)

  createRoot(mountPoint).render(<ChatWidget />)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount)
} else {
  mount()
}
