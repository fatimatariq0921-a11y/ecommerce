/**
 * Vercel serverless proxy: /api/* → Railway backend.
 * Set API_URL in Vercel (your Railway public URL, no trailing slash).
 */
function backendRoot() {
  const raw = process.env.API_URL || process.env.VITE_API_URL || ''
  return String(raw)
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\/+$/, '')
    .replace(/\/api$/, '')
}

export default async function handler(req, res) {
  const base = backendRoot()
  if (!base) {
    return res.status(500).json({
      message:
        'API_URL is not set on Vercel. Add your Railway URL (e.g. https://xxx.up.railway.app) and redeploy.',
    })
  }

  const slug = req.query.slug
  const pathPart = Array.isArray(slug) ? slug.join('/') : slug || ''
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'slug') continue
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v))
    else if (value != null) params.append(key, value)
  }
  const query = params.toString()
  const target = `${base}/api/${pathPart}${query ? `?${query}` : ''}`

  const headers = {}
  for (const [key, value] of Object.entries(req.headers)) {
    const lower = key.toLowerCase()
    if (lower === 'host' || lower === 'connection' || lower === 'content-length') continue
    headers[key] = value
  }

  const init = { method: req.method, headers }
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.body != null) {
    init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    if (!headers['content-type'] && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json'
    }
  }

  try {
    const upstream = await fetch(target, init)
    const text = await upstream.text()
    res.status(upstream.status)
    const contentType = upstream.headers.get('content-type')
    if (contentType) res.setHeader('Content-Type', contentType)
    res.send(text)
  } catch (error) {
    res.status(502).json({
      message: 'Cannot reach Railway backend',
      detail: error.message,
      target,
    })
  }
}
