/**
 * main.jsx
 *
 * Widget entry point. Mounts the React app inside a Shadow DOM so
 * Shopify's theme CSS can never interfere with the widget's styles.
 *
 * Injection: <script src="mediko-chat.iife.js" defer></script>
 * The script auto-mounts on DOMContentLoaded.
 */

import React from 'react'
import { createRoot } from 'react-dom/client'
import { ChatWidget } from './components/ChatWidget.jsx'
import widgetCss from './widget.css?inline'

function mount() {
  // Avoid double-mounting (e.g. Shopify theme editor reloads)
  if (document.getElementById('mediko-chat-root')) return

  // Host element — sits outside all Shopify DOM
  const host = document.createElement('div')
  host.id = 'mediko-chat-root'
  document.body.appendChild(host)

  // Shadow DOM — CSS is fully isolated
  const shadow = host.attachShadow({ mode: 'open' })

  // Inject widget styles into shadow root
  const style = document.createElement('style')
  style.textContent = widgetCss
  shadow.appendChild(style)

  // Mount point inside shadow
  const mountPoint = document.createElement('div')
  shadow.appendChild(mountPoint)

  // React root
  createRoot(mountPoint).render(<ChatWidget />)
}

// Mount after DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount)
} else {
  mount()
}
