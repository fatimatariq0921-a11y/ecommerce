/**
 * API client
 * - Local dev: Vite proxies /api → localhost:5000 (leave VITE_API_URL empty)
 * - Vercel prod: uses same-origin /api → Vercel proxy (api/[...slug].js) → Railway
 *   Set API_URL on Vercel to your Railway URL.
 * - Optional: set VITE_API_URL to Railway URL for direct browser calls (needs CORS on Railway)
 */
function normalizeApiBase(raw) {
  let base = String(raw ?? '').trim().replace(/^['"]|['"]$/g, '')
  if (!base) return ''

  if (!/^https?:\/\//i.test(base)) {
    base = `https://${base}`
  }

  base = base.replace(/\/+$/, '').replace(/\/api$/, '')
  return base
}

function isBadProductionBase(base) {
  if (!base) return false
  try {
    const host = new URL(base).hostname.toLowerCase()
    return host.endsWith('.vercel.app') || host === 'vercel.app'
  } catch {
    return true
  }
}

function resolveApiBase() {
  const fromEnv = normalizeApiBase(import.meta.env.VITE_API_URL)
  if (isBadProductionBase(fromEnv)) return ''
  if (fromEnv) return fromEnv
  // Production on Vercel: same-origin /api proxy (see api/[...slug].js)
  if (import.meta.env.PROD) return ''
  return ''
}

export const API_BASE = resolveApiBase()

export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  return API_BASE ? `${API_BASE}${p}` : p
}

function isHtmlBody(text) {
  const start = text.trimStart().slice(0, 20).toLowerCase()
  return start.startsWith('<!doctype') || start.startsWith('<html')
}

export async function apiFetch(path, options = {}) {
  const url = apiUrl(path)
  let res
  try {
    res = await fetch(url, options)
  } catch (err) {
    throw new Error(
      err.message === 'Failed to fetch'
        ? 'Cannot reach API. On Vercel, set API_URL to your Railway URL and redeploy.'
        : err.message,
    )
  }

  const text = await res.text()
  const contentType = res.headers.get('content-type') || ''

  if (!text) {
    if (!res.ok) throw new Error(`Request failed (${res.status})`)
    return null
  }

  const looksJson =
    contentType.includes('application/json') ||
    contentType.includes('+json') ||
    text.trimStart().startsWith('{') ||
    text.trimStart().startsWith('[')

  if (!looksJson) {
    if (isHtmlBody(text)) {
      throw new Error(
        API_BASE
          ? `API returned HTML. Fix VITE_API_URL (use Railway URL, not Vercel). Current: ${API_BASE}`
          : 'API returned HTML. On Vercel, set API_URL to your Railway URL, redeploy, then try again.',
      )
    }
    throw new Error(text.slice(0, 160) || `Request failed (${res.status})`)
  }

  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Invalid JSON from API')
  }

  if (!res.ok) {
    throw new Error(data?.message || `Request failed (${res.status})`)
  }

  return data
}
