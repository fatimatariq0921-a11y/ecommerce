/**
 * API client
 * - Local dev: leave VITE_API_URL empty → Vite proxies /api to localhost:5000
 * - Vercel production: set VITE_API_URL to your Railway URL (required)
 */
function normalizeApiBase(raw) {
  let base = String(raw ?? '').trim().replace(/^['"]|['"]$/g, '')
  if (!base) return ''

  if (!/^https?:\/\//i.test(base)) {
    base = `https://${base}`
  }

  return base.replace(/\/+$/, '').replace(/\/api$/, '')
}

function isBadBase(base) {
  if (!base) return false
  try {
    const host = new URL(base).hostname.toLowerCase()
    return host.endsWith('.vercel.app') || host === 'vercel.app'
  } catch {
    return true
  }
}

const envBase = normalizeApiBase(import.meta.env.VITE_API_URL)
export const API_BASE = isBadBase(envBase) ? '' : envBase

export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  if (import.meta.env.PROD && !API_BASE) {
    throw new Error(
      'VITE_API_URL is missing on Vercel. Add it (your Railway URL, e.g. https://xxx.up.railway.app), then redeploy.',
    )
  }
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
    res = await fetch(url, {
      ...options,
      mode: 'cors',
    })
  } catch (err) {
    const hint =
      err.message === 'Failed to fetch'
        ? `Cannot reach API at ${API_BASE}. Redeploy Railway with latest code, set JWT_SECRET + MONGO_URI, and open ${API_BASE}/api/health in the browser.`
        : err.message
    throw new Error(hint)
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
        `API returned HTML (status ${res.status}). VITE_API_URL must be your Railway URL, not your Vercel site.`,
      )
    }
    if (res.status === 405) {
      throw new Error(
        'Method not allowed (405). Set VITE_API_URL to your Railway URL on Vercel and redeploy — do not use /api on the Vercel domain.',
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
