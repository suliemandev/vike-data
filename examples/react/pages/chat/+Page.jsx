// AI chat demo (#297): a message list + input over vike-ai's neutral port. With no key it
// talks to the built-in echo provider (zero config, works in CI and offline); with
// ANTHROPIC_API_KEY set it talks to a real model through vike-ai-gemstack -> @gemstack/ai-sdk
// — the page does not change. The model/provider that actually answered is shown under the
// reply, so the swap from echo to a real model is visible.
import { useEffect, useRef, useState } from 'react'
import { sendMessage } from './chat.telefunc.js'

export default function Page() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [meta, setMeta] = useState(null)
  const endRef = useRef(null)

  // Keep the latest turn in view as the conversation grows / reveals.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function onSubmit(e) {
    e.preventDefault()
    const content = input.trim()
    if (!content || pending) return
    const history = [...messages, { role: 'user', content }]
    setMessages(history)
    setInput('')
    setPending(true)
    try {
      const reply = await sendMessage(history)
      setMeta(reply.model ? { model: reply.model, provider: reply.provider } : null)
      await revealAssistant(reply.text, setMessages)
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: '(the assistant could not respond)' }])
    } finally {
      setPending(false)
    }
  }

  return (
    <main style={{ display: 'grid', gap: '1rem', maxWidth: 640, margin: '0 auto' }}>
      <header>
        <h1 style={{ marginBottom: '0.25rem' }}>Chat</h1>
        <p style={{ color: 'var(--color-muted)', margin: 0, fontSize: 14, lineHeight: 1.6 }}>
          A server function calls <code>chat()</code> on the neutral <code>vike-ai</code> port. With no key it
          replies through the built-in <strong>echo</strong> provider; set <code>ANTHROPIC_API_KEY</code> and the same
          call routes to a real model via <code>vike-ai-gemstack</code>.
        </p>
      </header>

      <section
        style={{
          display: 'grid',
          gap: '0.75rem',
          padding: '1rem',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius, 6px)',
          background: 'var(--color-surface)',
          minHeight: 200,
        }}
      >
        {messages.length === 0 ? (
          <p style={{ color: 'var(--color-muted)', margin: 0 }}>Say hello to start the conversation.</p>
        ) : (
          messages.map((m, i) => <Bubble key={i} role={m.role} content={m.content} />)
        )}
        {pending && messages[messages.length - 1]?.role === 'user' && (
          <p style={{ color: 'var(--color-muted)', margin: 0 }}>Thinking…</p>
        )}
        <div ref={endRef} />
      </section>

      {meta && (
        <p style={{ color: 'var(--color-muted)', margin: 0, fontSize: 13 }}>
          answered by <code>{meta.provider || 'echo'}</code>
          {meta.model ? <> · <code>{meta.model}</code></> : null}
        </p>
      )}

      <form onSubmit={onSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          aria-label="Message"
          style={{
            flex: 1,
            padding: '0.5rem 0.75rem',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius, 6px)',
            background: 'var(--color-bg)',
            color: 'var(--color-text)',
          }}
        />
        <button
          type="submit"
          disabled={pending || input.trim() === ''}
          style={{
            padding: '0.5rem 1rem',
            border: '1px solid var(--color-primary)',
            borderRadius: 'var(--radius, 6px)',
            background: 'var(--color-primary)',
            color: 'var(--color-primary-text)',
            cursor: pending ? 'default' : 'pointer',
            opacity: pending || input.trim() === '' ? 0.6 : 1,
          }}
        >
          Send
        </button>
      </form>
    </main>
  )
}

function Bubble({ role, content }) {
  const isUser = role === 'user'
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', alignItems: 'flex-start' }}>
      <div
        style={{
          maxWidth: '80%',
          padding: '0.4rem 0.7rem',
          borderRadius: 'var(--radius, 6px)',
          whiteSpace: 'pre-wrap',
          lineHeight: 1.45,
          background: isUser ? 'var(--color-primary)' : 'var(--color-bg)',
          color: isUser ? 'var(--color-primary-text)' : 'var(--color-text)',
          border: isUser ? 'none' : '1px solid var(--color-border)',
        }}
      >
        {content}
      </div>
    </div>
  )
}

// Telefunc is request/response: sendMessage() returns the COMPLETE reply. We reveal it a
// word at a time so the UI reads like a chat. (vike-ai's genuine token-stream seam is
// stream(), an AsyncIterable already unit-tested; surfacing it live would be an SSE endpoint
// over stream() — a clean follow-up, deliberately out of scope for this first demo.)
async function revealAssistant(text, setMessages) {
  const words = String(text).split(' ')
  setMessages((m) => [...m, { role: 'assistant', content: '' }])
  for (let i = 0; i < words.length; i++) {
    const chunk = i === 0 ? words[i] : ` ${words[i]}`
    setMessages((m) => {
      const next = m.slice()
      const last = next[next.length - 1]
      next[next.length - 1] = { role: 'assistant', content: last.content + chunk }
      return next
    })
    await sleep(18)
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
