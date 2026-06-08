import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodeServerStream, resolveStream } from './lib/stream.js'
import { proxyHlsRequest } from './lib/hls-proxy.js'
import { parseStreamRequest } from './lib/content-path.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const indexPath = path.join(__dirname, 'public/index.html')
const port = Number(process.env.PORT || 7860)

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
  res.end(JSON.stringify(body))
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://0.0.0.0:${port}`)

  if (url.pathname === '/api/hls') {
    const target = url.searchParams.get('url')
    if (!target) return sendJson(res, 400, { error: 'url required' })
    try {
      const proxied = await proxyHlsRequest(target, `${url.origin}/api/hls`)
      res.writeHead(proxied.status, proxied.headers)
      res.end(proxied.body)
      return
    } catch (err) {
      return sendJson(res, 502, { ok: false, error: String(err.message || err) })
    }
  }

  if (url.pathname === '/api/server') {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'POST required' })
    let body = ''
    for await (const chunk of req) body += chunk
    let payload
    try {
      payload = JSON.parse(body)
    } catch {
      return sendJson(res, 400, { error: 'invalid json' })
    }
    if (!payload.contentPath || !payload.data) {
      return sendJson(res, 400, { error: 'contentPath and data required' })
    }
    try {
      const data = await decodeServerStream(payload.contentPath, payload.data, {
        type: payload.type,
        serverName: payload.serverName,
        serverIndex: payload.serverIndex,
      })
      if (data.ok && data.streamUrl) {
        data.playbackUrl = `/api/hls?url=${encodeURIComponent(data.streamUrl)}`
      }
      return sendJson(res, 200, data)
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: String(err.message || err) })
    }
  }

  if (url.pathname === '/api/stream') {
    const parsed = parseStreamRequest(url.searchParams)
    if (parsed.error) return sendJson(res, 400, { error: parsed.error })
    try {
      const data = await resolveStream(parsed, { server: url.searchParams.get('server') })
      if (data.ok && data.streamUrl) {
        data.playbackUrl = `/api/hls?url=${encodeURIComponent(data.streamUrl)}`
      }
      return sendJson(res, 200, data)
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: String(err.message || err) })
    }
  }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    fs.createReadStream(indexPath).pipe(res)
    return
  }

  res.writeHead(404)
  res.end('not found')
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`port ${port} is already in use`)
    process.exit(1)
  }
  throw err
})

server.listen(port, () => {
  console.log(`vidfast-stream-resolver on http://127.0.0.1:${port}`)
})
