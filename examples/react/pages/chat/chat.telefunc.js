// Telefunction for the AI chat demo (#297) — the "Vike app -> agent" seam, live.
//
// The browser calls sendMessage() directly; telefunc transforms this file into a typed RPC
// client. It runs SERVER-SIDE (this module never reaches the client bundle, so the AI
// provider and its API key stay on the server), forwards the conversation to vike-ai's
// neutral chat(), and returns the assistant reply.
//
// vike-ai is the AI twin of @universal-orm/core: with NO provider registered it runs the
// built-in echo provider (zero config, CI-safe, obviously fake), and with ANTHROPIC_API_KEY
// set, +onCreateGlobalContext registers vike-ai-gemstack -> @gemstack/ai-sdk so the SAME
// call returns a real model reply. The code here does not change between the two paths —
// that is the whole point of the port.
//
// Like pages/rpc-demo, this rides vike-rbac's single Telefunc middleware (#128), so
// getContext() carries the signed-in user. Chat is open to everyone (no requirePermission)
// so the echo demo works signed out; a real app could gate it exactly as userCount() does.
import { chat } from 'vike-ai'

const SYSTEM = {
  role: 'system',
  content:
    'You are a concise, friendly assistant embedded in a Vike demo app. Keep answers short and to the point.',
}

export async function sendMessage(history) {
  // history: [{ role: 'user' | 'assistant', content }, ...] sent from the browser.
  const messages = [SYSTEM, ...sanitize(history)]
  const { text, model, provider } = await chat({ messages })
  return { text, model, provider }
}

// Trust nothing from the client: keep only well-formed user/assistant turns with non-empty
// string content, cap the transcript length, and clamp each message, so a caller cannot send
// an unbounded or malformed history to the provider.
function sanitize(history) {
  if (!Array.isArray(history)) return []
  return history
    .filter(
      (m) =>
        m &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string' &&
        m.content !== '',
    )
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
}
