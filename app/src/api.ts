/**
 * Talks to the backend (server/main.py on Databricks Apps).
 * If the backend isn't there (Figma preview, local dev), falls back to clearly-labelled sample data.
 */
import { CONDITIONS, SAMPLE_ORIGIN, SERVICES, sampleCandidates } from './sampleData'
import type { ConditionMapping, SearchInput, SearchResponse, Service } from './types'

let mode: 'live' | 'sample' | null = null

async function getJson<T>(url: string, init?: RequestInit, timeoutMs = 20000): Promise<T> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal })
    const type = r.headers.get('content-type') || ''
    if (!type.includes('application/json')) throw new Error('not json')
    const body = await r.json()
    if (!r.ok) throw Object.assign(new Error(body?.detail || `HTTP ${r.status}`), { userFacing: true })
    return body as T
  } finally {
    clearTimeout(t)
  }
}

export async function detectMode(): Promise<'live' | 'sample'> {
  if (mode) return mode
  try {
    const h = await getJson<{ ok: boolean }>('/api/health', undefined, 4000)
    mode = h.ok ? 'live' : 'sample'
  } catch {
    mode = 'sample'
  }
  return mode
}

export async function loadServices(): Promise<{ services: Service[]; conditions: ConditionMapping[] }> {
  if ((await detectMode()) === 'live') {
    try {
      return await getJson('/api/catalog')
    } catch {
      /* fall through to built-in list */
    }
  }
  return { services: SERVICES, conditions: CONDITIONS }
}

export async function search(input: SearchInput): Promise<SearchResponse> {
  if ((await detectMode()) === 'live') {
    return getJson<SearchResponse>('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service: input.service,
        place: input.place,
        lat: input.lat ?? null,
        lon: input.lon ?? null,
        max_km: input.maxKm,
      }),
    }, 90000) // the SQL warehouse can take a moment to wake up
  }
  await new Promise((r) => setTimeout(r, 350))
  return { mode: 'sample', origin: SAMPLE_ORIGIN, candidates: sampleCandidates() }
}
