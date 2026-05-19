/**
 * API client
 * - Local dev  : leave VITE_API_URL empty → Vite proxies /api to localhost:5000
 * - Production : set VITE_API_URL to your Railway public URL on Vercel, then redeploy
 *
 * How to get the correct Railway URL:
 *   Railway dashboard → your service → Settings → Networking → Public URL
 *   It looks like: https://ecommerce-production-xxxx.up.railway.app
 *                                               ^^^^  (random 4-char suffix)
 */

function normalizeApiBase(raw) {
  let base = String(raw ?? '').trim().replace(/^['"]+|['"]+$/g, '')
  if (!base) return ''
  if (!/^https?:\/\//i.test(base)) base = `https://${base}`
  return base.replace(/\/+$/, '').replace(/\/api\/?$/, '')
}

/** Detect common Railway URL mistakes */
function detectBadRailwayUrl(base) {
  if (!base) return null
  try {
    const { hostname } = new URL(base)
    // User put Vercel URL instead of Railway
    if (hostname.endsWith('.vercel.app')) {
      return `"${base}" is your VERCEL URL — that's the frontend, not the backend! Use your RAILWAY URL instead.`
    }
    // User put the placeholder from .env.example (no real hash suffix)
    if (hostname === 'ecommerce-api-production-xxxx.up.railway.app') {
      return `"${base}" is just the placeholder from .env.example. Replace it with the real URL from Railway → Settings → Networking.`
    }
    // Suspiciously short railway URL (missing the unique -xxxx suffix)
    if (hostname.endsWith('.up.railway.app') && !/\-[a-z0-9]{4,}\.up\.railway\.app$/.test(hostname)) {
      return `"${base}" looks like an incomplete Railway URL. The real URL has a unique suffix like "-a1b2.up.railway.app". Check Railway → Settings → Networking.`
    }
  } catch {
    return `"${base}" is not a valid URL.`
  }
  return null
}

const envBase = normalizeApiBase(import.meta.env.VITE_API_URL)
export const API_BASE = envBase

export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`

  if (import.meta.env.PROD && !API_BASE) {
    throw new Error(
      'MISSING_API_URL: VITE_API_URL is not set on Vercel. ' +
      'Go to Vercel → your project → Settings → Environment Variables, ' +
      'add VITE_API_URL = your Railway public URL (e.g. https://ecommerce-production-xxxx.up.railway.app), ' +
      'then redeploy.',
    )
  }

  const badMsg = detectBadRailwayUrl(API_BASE)
  if (badMsg) {
    throw new Error(`BAD_API_URL: ${badMsg}`)
  }

  return API_BASE ? `${API_BASE}${p}` : p
}

function isHtmlBody(text) {
  const s = text.trimStart().slice(0, 20).toLowerCase()
  return s.startsWith('<!doctype') || s.startsWith('<html')
}

export async function apiFetch(path, options = {}) {
  const url = apiUrl(path)
  let res

  try {
    res = await fetch(url, { ...options, mode: 'cors' })
  } catch (err) {
    if (err.message === 'Failed to fetch') {
      const tried = API_BASE || '(proxy)'
      throw new Error(
        `NETWORK_ERROR: Cannot reach the backend at ${tried}.\n` +
        `1. Open Railway → your service → Settings → Networking\n` +
        `2. Copy the Public URL (e.g. https://ecommerce-production-xxxx.up.railway.app)\n` +
        `3. Go to Vercel → your project → Settings → Environment Variables\n` +
        `4. Set VITE_API_URL = that Railway URL (no trailing slash)\n` +
        `5. Redeploy on Vercel (Deployments → Redeploy)`,
      )
    }
    throw new Error(err.message)
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
        `API returned HTML (status ${res.status}). ` +
        `VITE_API_URL must be your Railway URL, not your Vercel site URL.`,
      )
    }
    if (res.status === 405) {
      throw new Error(
        'Method not allowed (405). VITE_API_URL must point to Railway — not to your Vercel /api route.',
      )
    }
    throw new Error(text.slice(0, 200) || `Request failed (${res.status})`)
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
