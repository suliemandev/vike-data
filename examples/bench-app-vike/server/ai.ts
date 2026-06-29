// AI summarize, wired through the `vike-ai` extension (the neutral AI port).
//
// summarize() calls vike-ai's `generate()`; the concrete provider is registered in
// bootstrap.ts (a deterministic stub by default, a real provider when a key is set). The
// app never imports a model SDK here, exactly like it never imports a DB driver for notes.
import { generate } from 'vike-ai'

/** First sentence of `text`, trimmed to <= 140 chars. The stub provider's behaviour. */
export function summaryOf(text: string): string {
  const trimmed = text.trim()
  const match = trimmed.match(/^[\s\S]*?[.!?](?:\s|$)/)
  const sentence = (match ? match[0] : trimmed).trim()
  return sentence.length > 140 ? sentence.slice(0, 140).trim() : sentence
}

/** Summarize a note body through vike-ai. Returns the one-sentence summary string. */
export async function summarize(body: string): Promise<string> {
  const { text } = await generate({ prompt: body })
  return text.trim()
}
