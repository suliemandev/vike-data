import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  generate, chat, stream,
  setAiProvider, getAiProvider, clearAiProvider,
} from '../index.js'

// Reset the provider between tests so the zero-config echo default is restored.
function reset() {
  clearAiProvider()
}

async function collect(iter) {
  const chunks = []
  for await (const c of iter) chunks.push(c)
  return chunks
}

test('generate validates the request', async () => {
  reset()
  await assert.rejects(() => generate(null), /must be an object/)
  await assert.rejects(() => generate({}), /request.prompt is required/)
  await assert.rejects(() => generate({ prompt: '' }), /request.prompt is required/)
})

test('generate runs through the echo provider zero-config', async () => {
  reset()
  const res = await generate({ prompt: 'hello' })
  assert.equal(res.text, '[echo] hello')
  assert.equal(res.provider, 'echo')
  assert.equal(res.model, 'echo')
})

test('generate forwards model/provider selectors verbatim to the provider', async () => {
  reset()
  let seen
  setAiProvider({
    async generate(req) { seen = req; return { text: 'ok', model: req.model, provider: req.provider } },
    async chat() { return { text: '' } },
  })
  const res = await generate({ prompt: 'hi', model: 'claude-x', provider: 'gemini', temperature: 0.2 })
  assert.equal(seen.model, 'claude-x')
  assert.equal(seen.provider, 'gemini')
  assert.equal(seen.temperature, 0.2)
  assert.equal(res.model, 'claude-x')
})

test('chat validates the messages', async () => {
  reset()
  await assert.rejects(() => chat(null), /must be an object/)
  await assert.rejects(() => chat({ messages: [] }), /non-empty array/)
  await assert.rejects(() => chat({ messages: [{ role: 'user' }] }), /role: string, content: string/)
})

test('chat echoes the latest user turn zero-config', async () => {
  reset()
  const res = await chat({
    messages: [
      { role: 'system', content: 'be terse' },
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'ok' },
      { role: 'user', content: 'second' },
    ],
  })
  assert.equal(res.text, '[echo] second')
  assert.equal(res.message.role, 'assistant')
  assert.equal(res.message.content, '[echo] second')
})

test('setAiProvider rejects an incomplete provider', () => {
  reset()
  assert.throws(() => setAiProvider({}), /generate\(req\) and chat\(req\)/)
  assert.throws(() => setAiProvider({ generate() {}, chat() {}, stream: 'no' }), /stream.*must be a function/)
})

test('a custom provider replaces the echo default', async () => {
  reset()
  setAiProvider({
    async generate() { return { text: 'real', model: 'm', provider: 'p' } },
    async chat() { return { text: 'real-chat' } },
  })
  assert.equal((await generate({ prompt: 'x' })).text, 'real')
  assert.equal((await chat({ messages: [{ role: 'user', content: 'x' }] })).text, 'real-chat')
  clearAiProvider()
  assert.equal((await generate({ prompt: 'x' })).text, '[echo] x')
})

test('stream yields chunks from the echo provider (prompt form)', async () => {
  reset()
  const chunks = await collect(stream({ prompt: 'hi there' }))
  assert.ok(chunks.length > 1)
  assert.equal(chunks.join(''), '[echo] hi there')
})

test('stream accepts a chat-style request', async () => {
  reset()
  const chunks = await collect(stream({ messages: [{ role: 'user', content: 'yo' }] }))
  assert.equal(chunks.join(''), '[echo] yo')
})

test('stream falls back to generate when the provider has no stream', async () => {
  reset()
  setAiProvider({
    async generate() { return { text: 'whole answer' } },
    async chat() { return { text: 'whole chat' } },
  })
  assert.deepEqual(await collect(stream({ prompt: 'x' })), ['whole answer'])
  assert.deepEqual(await collect(stream({ messages: [{ role: 'user', content: 'x' }] })), ['whole chat'])
})

test('getAiProvider returns the echo default when nothing is registered', async () => {
  reset()
  const p = getAiProvider()
  assert.equal(typeof p.generate, 'function')
  assert.equal((await p.generate({ prompt: 'q' })).text, '[echo] q')
})
