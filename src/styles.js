// Widget styles as a plain JS string — reliable in Vite IIFE library mode.
export const WIDGET_CSS = `/* ═══════════════════════════════════════════════════════
   Mediko Chat Widget — Senior-Friendly Redesign
   Primary: #187adc  Secondary: #ffb73a  Font: Poppins
   ═══════════════════════════════════════════════════════ */

:host {
  --mdk-primary:      #187adc;
  --mdk-primary-dk:   #115fa8;
  --mdk-primary-lt:   #e8f3fd;
  --mdk-secondary:    #ffb73a;
  --mdk-secondary-dk: #e09a1a;
  --mdk-secondary-lt: #fff8e8;
  --mdk-bg:           #ffffff;
  --mdk-surface:      #f7faff;
  --mdk-border:       #d0e4f7;
  --mdk-text:         #1a2e4a;
  --mdk-muted:        #6b85a3;
  --mdk-user-bg:      #187adc;
  --mdk-user-text:    #ffffff;
  --mdk-bot-bg:       #f0f7ff;
  --mdk-bot-text:     #1a2e4a;
  --mdk-radius:       20px;
  --mdk-shadow:       0 12px 48px rgba(24,122,220,.22), 0 2px 8px rgba(0,0,0,.08);
  --mdk-shadow-fab:   0 6px 24px rgba(255,183,58,.55);
  font-family: 'Poppins', -apple-system, sans-serif;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* Force Poppins on every element — Shadow DOM doesn't inherit from :host automatically */
* { font-family: 'Poppins', -apple-system, sans-serif; }

/* ══ Tooltip popup ════════════════════════════════════ */

.tooltip-popup {
  position: fixed;
  bottom: 102px;
  right: 24px;
  background: var(--mdk-secondary);
  color: #1a2e4a;
  font-family: 'Poppins', sans-serif;
  font-size: 15px;
  font-weight: 600;
  padding: 13px 18px 13px 16px;
  border-radius: 16px 16px 4px 16px;
  box-shadow: 0 6px 20px rgba(255,183,58,.45);
  white-space: nowrap;
  pointer-events: none;
  animation: tooltipIn .5s cubic-bezier(.34,1.56,.64,1) both;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 2147483645;
}
.tooltip-popup::before {
  content: '💊';
  font-size: 18px;
}
.tooltip-popup::after {
  content: '';
  position: absolute;
  bottom: -8px;
  right: 20px;
  border: 8px solid transparent;
  border-top-color: var(--mdk-secondary);
  border-bottom: none;
}
.tooltip-popup.hide {
  animation: tooltipOut .3s ease forwards;
}
@keyframes tooltipIn {
  from { opacity: 0; transform: translateY(10px) scale(.9); }
  to   { opacity: 1; transform: translateY(0)    scale(1);  }
}
@keyframes tooltipOut {
  to { opacity: 0; transform: translateY(6px) scale(.95); }
}

/* ══ FAB ═══════════════════════════════════════════════ */

.fab-wrap {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 2147483646;
  pointer-events: auto;
}
.fab {
  width: 66px;
  height: 66px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ffb73a 40%, #ffd815 100%);
  border: 3px solid rgba(255,255,255,.45);
  cursor: pointer;
  box-shadow: 0 6px 24px rgba(255,183,58,.55);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform .25s cubic-bezier(.34,1.56,.64,1), box-shadow .2s;
  position: relative;
  outline: none;
}
.fab:hover  { transform: scale(1.1); box-shadow: 0 8px 32px rgba(255,183,58,.65); }
.fab:active { transform: scale(.96); }
.fab svg    { width: 30px; height: 30px; fill: #1a2e4a; transition: transform .3s; }
.fab.open svg { transform: rotate(90deg); }

/* Pulse ring */
.fab-pulse {
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  background: rgba(255,183,58,.35);
  animation: pulse 2.2s ease-out infinite;
}
.fab-pulse:nth-child(2) { animation-delay: .7s; }
@keyframes pulse {
  0%   { transform: scale(1);   opacity: .7; }
  100% { transform: scale(1.6); opacity: 0;  }
}

.fab-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: var(--mdk-secondary);
  color: #1a2e4a;
  font-family: 'Poppins', sans-serif;
  font-size: 11px;
  font-weight: 700;
  border-radius: 12px;
  min-width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
  border: 2px solid #fff;
  animation: badgePop .3s cubic-bezier(.34,1.56,.64,1);
}
@keyframes badgePop {
  from { transform: scale(0); }
  to   { transform: scale(1); }
}

/* ══ Chat window ════════════════════════════════════════ */

.chat-window {
  position: fixed;
  bottom: 102px;
  right: 24px;
  width: 390px;
  max-width: calc(100vw - 32px);
  height: 580px;
  max-height: calc(100vh - 120px);
  background: var(--mdk-bg);
  border-radius: var(--mdk-radius);
  box-shadow: var(--mdk-shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 2147483645;
  transform-origin: bottom right;
  pointer-events: auto;
  border: 1.5px solid var(--mdk-border);
  animation: windowIn .3s cubic-bezier(.34,1.56,.64,1);
}
@keyframes windowIn {
  from { transform: scale(.88) translateY(12px); opacity: 0; }
  to   { transform: scale(1)   translateY(0);    opacity: 1; }
}

/* ══ Header ══════════════════════════════════════════════ */

.chat-header {
  background: linear-gradient(135deg, #187adc 0%, #1260b0 100%);
  padding: 16px 18px;
  display: flex;
  align-items: center;
  gap: 13px;
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
}
.chat-header::after {
  content: '';
  position: absolute;
  right: -20px;
  top: -20px;
  width: 100px;
  height: 100px;
  background: rgba(255,183,58,.15);
  border-radius: 50%;
}
.avatar-wrap {
  position: relative;
  flex-shrink: 0;
}
.avatar {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: var(--mdk-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  border: 2.5px solid rgba(255,255,255,.5);
  box-shadow: 0 2px 8px rgba(0,0,0,.2);
}
.avatar-online {
  position: absolute;
  bottom: 1px;
  right: 1px;
  width: 12px;
  height: 12px;
  background: #4ade80;
  border-radius: 50%;
  border: 2px solid #fff;
  animation: onlinePulse 2s ease infinite;
}
@keyframes onlinePulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(74,222,128,.5); }
  50%     { box-shadow: 0 0 0 5px rgba(74,222,128,0); }
}
.header-text    { flex: 1; position: relative; z-index: 1; }
.header-name    { color: #fff; font-weight: 700; font-size: 16px; line-height: 1.2; letter-spacing: -.2px; }
.header-tagline { color: rgba(255,255,255,.82); font-size: 12px; margin-top: 2px; }
.header-btns    { display: flex; gap: 6px; position: relative; z-index: 1; }
.icon-btn {
  background: rgba(255,255,255,.18);
  border: 1.5px solid rgba(255,255,255,.25);
  border-radius: 10px;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background .15s;
}
.icon-btn:hover { background: rgba(255,255,255,.3); }
.icon-btn svg   { width: 16px; height: 16px; fill: #fff; }

/* ══ Mode banner ══════════════════════════════════════════ */

.mode-banner {
  padding: 10px 18px;
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--mdk-border);
}
.mode-banner.handoff { background: var(--mdk-secondary-lt); color: #7a5000; }
.mode-banner.agent   { background: #edfcf2; color: #166534; }

/* ══ Messages ════════════════════════════════════════════ */

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 18px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  scroll-behavior: smooth;
  background:
    radial-gradient(ellipse at 0% 0%, rgba(24,122,220,.04) 0%, transparent 60%),
    radial-gradient(ellipse at 100% 100%, rgba(255,183,58,.05) 0%, transparent 60%),
    #fff;
}
.messages::-webkit-scrollbar { width: 4px; }
.messages::-webkit-scrollbar-thumb { background: var(--mdk-border); border-radius: 2px; }

/* Message row */
.msg-row { display: flex; flex-direction: column; }
.msg-row.user      { align-items: flex-end; }
.msg-row.assistant { align-items: flex-start; }

/* Bot label */
.bot-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--mdk-primary);
  margin-bottom: 4px;
  padding-left: 2px;
  letter-spacing: .3px;
  text-transform: uppercase;
}

/* Bubble */
.bubble {
  max-width: 84%;
  padding: 12px 16px;
  font-size: 15px;
  line-height: 1.6;
  word-break: break-word;
  white-space: pre-wrap;
  position: relative;
}
.msg-row.user .bubble {
  background: linear-gradient(135deg, #187adc, #1563b8);
  color: #fff;
  border-radius: 18px 18px 4px 18px;
  box-shadow: 0 3px 12px rgba(24,122,220,.3);
}
.msg-row.assistant .bubble {
  background: var(--mdk-bot-bg);
  color: var(--mdk-bot-text);
  border-radius: 18px 18px 18px 4px;
  border: 1.5px solid var(--mdk-border);
}

/* Links inside bubbles */
.msg-row.assistant .bubble a {
  color: var(--mdk-primary);
  font-weight: 600;
  text-decoration: underline;
  text-decoration-color: rgba(24,122,220,.4);
  text-underline-offset: 2px;
  transition: text-decoration-color .15s;
}
.msg-row.assistant .bubble a:hover { text-decoration-color: var(--mdk-primary); }
.msg-row.user .bubble a { color: rgba(255,255,255,.9); text-decoration: underline; }

.msg-time {
  font-size: 11px;
  color: var(--mdk-muted);
  margin-top: 4px;
  padding: 0 4px;
}

/* Message entry animation */
.msg-row {
  animation: msgIn .25s cubic-bezier(.34,1.2,.64,1) both;
}
@keyframes msgIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ══ Typing indicator ════════════════════════════════════ */

.typing-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  animation: msgIn .25s ease both;
}
.typing-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--mdk-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
  margin-top: 2px;
}
.typing-bubble {
  background: var(--mdk-bot-bg);
  border: 1.5px solid var(--mdk-border);
  border-radius: 18px 18px 18px 4px;
  padding: 14px 18px;
  display: flex;
  gap: 6px;
  align-items: center;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--mdk-primary);
  animation: typingBounce 1.1s ease-in-out infinite;
  opacity: .7;
}
.dot:nth-child(2) { animation-delay: .18s; }
.dot:nth-child(3) { animation-delay: .36s; }
@keyframes typingBounce {
  0%,80%,100% { transform: translateY(0);    opacity: .5; }
  40%          { transform: translateY(-7px); opacity: 1;  }
}

/* ══ Quick replies ════════════════════════════════════════ */

.quick-replies {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 4px 16px 12px;
}
.quick-reply {
  background: var(--mdk-primary-lt);
  border: 1.5px solid var(--mdk-border);
  border-radius: 20px;
  padding: 8px 16px;
  font-size: 14px;
  font-family: 'Poppins', sans-serif;
  font-weight: 500;
  color: var(--mdk-primary);
  cursor: pointer;
  transition: all .2s;
  line-height: 1.3;
}
.quick-reply:hover {
  background: var(--mdk-primary);
  color: #fff;
  border-color: var(--mdk-primary);
  transform: translateY(-1px);
  box-shadow: 0 3px 10px rgba(24,122,220,.25);
}
.quick-reply:active { transform: translateY(0); }

/* ══ Input area ═══════════════════════════════════════════ */

.input-area {
  padding: 14px 16px;
  border-top: 1.5px solid var(--mdk-border);
  display: flex;
  gap: 10px;
  align-items: flex-end;
  background: var(--mdk-surface);
  flex-shrink: 0;
}
.msg-input {
  flex: 1;
  border: 1.5px solid var(--mdk-border);
  border-radius: 16px;
  padding: 12px 16px;
  font-size: 15px;
  font-family: 'Poppins', sans-serif;
  color: var(--mdk-text);
  resize: none;
  outline: none;
  min-height: 46px;
  max-height: 120px;
  background: #fff;
  line-height: 1.4;
  transition: border-color .2s, box-shadow .2s;
}
.msg-input:focus {
  border-color: var(--mdk-primary);
  box-shadow: 0 0 0 3px rgba(24,122,220,.12);
}
.msg-input::placeholder { color: var(--mdk-muted); }

.send-btn {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: linear-gradient(135deg, #187adc, #1563b8);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform .2s cubic-bezier(.34,1.56,.64,1), box-shadow .2s, opacity .2s;
  box-shadow: 0 4px 14px rgba(24,122,220,.35);
}
.send-btn:hover:not(:disabled) {
  transform: scale(1.1);
  box-shadow: 0 6px 18px rgba(24,122,220,.45);
}
.send-btn:active:not(:disabled) { transform: scale(.95); }
.send-btn:disabled { opacity: .4; cursor: default; box-shadow: none; }
.send-btn svg { width: 20px; height: 20px; fill: #fff; transform: translateX(1px); }

/* ══ Footer ═══════════════════════════════════════════════ */

.chat-footer {
  text-align: center;
  font-size: 11px;
  color: var(--mdk-muted);
  padding: 5px 0 8px;
  background: var(--mdk-surface);
}
.chat-footer a { color: var(--mdk-primary); text-decoration: none; font-weight: 500; }

/* ══ Scrollbar ════════════════════════════════════════════ */

::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--mdk-border); border-radius: 2px; }
`
