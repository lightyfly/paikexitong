import { withBackoffRetry } from './retry'

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<any> }
  }>
}

export function extractJsonFromText(text: string) {
  const raw = String(text || '')
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced?.[1] ?? raw
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  const startArr = candidate.indexOf('[')
  const endArr = candidate.lastIndexOf(']')
  const slice =
    start !== -1 && end !== -1 && end > start
      ? candidate.slice(start, end + 1)
      : startArr !== -1 && endArr !== -1 && endArr > startArr
        ? candidate.slice(startArr, endArr + 1)
        : candidate
  return JSON.parse(slice)
}

export async function geminiGenerateContent(opts: {
  apiKey: string
  model: string
  parts: GeminiPart[]
  system?: string
  responseMimeType?: string
  responseModalities?: Array<'TEXT' | 'AUDIO'>
  speechConfig?: any
}) {
  const apiKey = String(opts.apiKey || '').trim()
  if (!apiKey) throw new Error('Gemini API key missing')

  // Use same-origin proxy to avoid browser CORS.
  // In dev, Vite proxies /api/gemini -> https://generativelanguage.googleapis.com/v1beta
  const url = `/api/gemini/models/${encodeURIComponent(opts.model)}:generateContent?key=${encodeURIComponent(apiKey)}`

  const body = {
    contents: [
      {
        role: 'user',
        parts: opts.parts,
      },
    ],
    ...(opts.system
      ? {
          systemInstruction: {
            role: 'system',
            parts: [{ text: String(opts.system) }],
          },
        }
      : {}),
    generationConfig: {
      temperature: 0.2,
      ...(opts.responseMimeType ? { responseMimeType: opts.responseMimeType } : {}),
      ...(opts.responseModalities ? { responseModalities: opts.responseModalities } : {}),
      ...(opts.speechConfig ? { speechConfig: opts.speechConfig } : {}),
    },
  }

  const res = await withBackoffRetry(
    async () => {
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const t = await r.text().catch(() => '')
        throw new Error(`Gemini error ${r.status}: ${t}`)
      }
      return (await r.json()) as GeminiResponse
    },
    { shouldRetry: () => true },
  )
  return res
}

export function extractTextFromGemini(resp: GeminiResponse) {
  const parts = resp?.candidates?.[0]?.content?.parts ?? []
  const texts = parts
    .map((p: any) => (p?.text != null ? String(p.text) : ''))
    .filter((t) => t.trim().length > 0)
  return texts.join('\n')
}

export function extractInlineData(resp: GeminiResponse) {
  const parts = resp?.candidates?.[0]?.content?.parts ?? []
  for (const p of parts) {
    const inlineData = p?.inlineData ?? p?.inline_data
    if (inlineData?.data && (inlineData?.mimeType || inlineData?.mime_type)) {
      return {
        mimeType: String(inlineData.mimeType || inlineData.mime_type),
        data: String(inlineData.data),
      }
    }
  }
  return null
}
