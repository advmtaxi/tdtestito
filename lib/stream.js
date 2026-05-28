import { Buffer } from 'node:buffer'
import { CSRF_HEADERS, ORIGIN, USER_AGENT } from './constants.js'
import { buildContentPath, buildStreamPath } from './content-path.js'
import { createVmRuntime } from './vm-engine.js'

function parsePageToken(html) {
  const en = html.match(/\\"en\\":\\"([^\\"]+)\\"/)?.[1] ?? html.match(/"en":"([^"]+)"/)?.[1]
  const host = html.match(/\\"host\\":\\"([^\\"]+)\\"/)?.[1] ?? html.match(/"host":"([^"]+)"/)?.[1]
  const id = html.match(/\\"id\\":\\"(\d+)\\"/)?.[1] ?? html.match(/"id":"(\d+)"/)?.[1]
  return { en, host, id }
}

function pickServer(servers, options = {}) {
  if (options.server != null && options.server !== '') {
    const raw = String(options.server)
    const asIndex = Number(raw)
    if (Number.isInteger(asIndex) && asIndex >= 0 && asIndex < servers.length) {
      return { server: servers[asIndex], index: asIndex }
    }
    const byName = servers.findIndex((s) => s.name.toLowerCase() === raw.toLowerCase())
    if (byName >= 0) return { server: servers[byName], index: byName }
  }
  const index = servers.findIndex((s) => s.name !== 'Mega')
  if (index >= 0) return { server: servers[index], index: index }
  return { server: servers[0], index: 0 }
}

function resolveContentPath(request) {
  return typeof request === 'string' ? request : buildContentPath(request)
}

async function fetchPageToken(request, options = {}) {
  const base = options.origin || ORIGIN
  const contentPath = resolveContentPath(request)
  const pageUrl = `${base}${contentPath}`
  const res = await fetch(pageUrl, { headers: { 'User-Agent': USER_AGENT } })
  const html = await res.text()
  return { pageUrl, contentPath, ...parsePageToken(html) }
}

async function checkServerPost(contentPath, serverData, options = {}) {
  const base = options.origin || ORIGIN
  const postPath = buildStreamPath(String(serverData).replace(/^\//, ''))
  const postUrl = `${base}/${postPath}`
  try {
    const res = await fetch(postUrl, {
      method: 'POST',
      headers: {
        ...CSRF_HEADERS,
        'User-Agent': USER_AGENT,
        Origin: base,
        Referer: `${base}${contentPath}`,
      },
    })
    return res.ok
  } catch {
    return false
  }
}

async function probeAvailableServers(contentPath, servers, options = {}) {
  const concurrency = options.concurrency ?? 8
  const available = []
  let next = 0

  async function worker() {
    while (next < servers.length) {
      const index = next++
      const server = servers[index]
      if (!server?.data) continue
      const ok = await checkServerPost(contentPath, server.data, options)
      if (ok) available.push(server)
    }
  }

  const workers = Math.min(concurrency, servers.length)
  await Promise.all(Array.from({ length: workers }, () => worker()))
  return available
}

export async function decodeServerStream(contentPath, serverData, options = {}) {
  const base = options.origin || ORIGIN
  const type = options.type || 'movie'
  const serverName = options.serverName || null
  const serverIndex = options.serverIndex ?? null

  let vm
  try {
    vm = createVmRuntime({ Buffer, origin: base, contentPath })
  } catch (err) {
    return { ok: false, stage: 'vm-load', error: String(err.message || err), type, contentPath }
  }

  const postPath = buildStreamPath(String(serverData).replace(/^\//, ''))
  const postUrl = `${base}/${postPath}`

  let responseText
  try {
    const res = await fetch(postUrl, {
      method: 'POST',
      headers: {
        ...CSRF_HEADERS,
        'User-Agent': USER_AGENT,
        Origin: base,
        Referer: `${base}${contentPath}`,
      },
    })
    responseText = await res.text()
    if (!res.ok) {
      return { ok: false, stage: 'post', error: `upstream ${res.status}`, type, contentPath, postUrl, bodyPreview: responseText.slice(0, 500) }
    }
  } catch (err) {
    return { ok: false, stage: 'post', error: String(err.message || err), type, contentPath, postUrl }
  }

  let decoded
  try {
    decoded = await vm.runDecode(responseText)
  } catch (err) {
    return { ok: false, stage: 'mZ', error: String(err.message || err), type, contentPath, postUrl, bodyPreview: responseText.slice(0, 500) }
  }

  const streamUrl = typeof decoded === 'string' ? decoded : decoded?.url
  if (!streamUrl) {
    return { ok: false, stage: 'mZ', error: 'decode returned empty url', type, contentPath, postUrl, bodyPreview: responseText.slice(0, 500), decoded }
  }

  return {
    ok: true,
    type,
    contentPath,
    streamUrl,
    source: decoded,
    selectedServer: serverName != null && serverIndex != null ? { index: serverIndex, name: serverName } : undefined,
    postUrl,
  }
}

export async function resolveStream(request, options = {}) {
  const base = options.origin || ORIGIN
  const contentPath = resolveContentPath(request)
  const type = typeof request === 'object' ? request.type || 'movie' : 'movie'
  const token = await fetchPageToken(contentPath, { origin: base })
  if (!token.en) {
    return { ok: false, stage: 'page-token', error: 'en token missing', type, contentPath, token }
  }

  let vm
  try {
    vm = createVmRuntime({ Buffer, origin: base, contentPath })
  } catch (err) {
    return { ok: false, stage: 'vm-load', error: String(err.message || err), type, contentPath, token }
  }

  let allServers = []
  try {
    allServers = await vm.runServers(token.en)
  } catch (err) {
    return { ok: false, stage: 'mf', error: String(err.message || err), type, contentPath, token, vmLoaded: true }
  }

  if (!allServers?.length) {
    return { ok: false, stage: 'mf', error: 'no servers returned', type, contentPath, token, servers: allServers }
  }

  const servers = await probeAvailableServers(contentPath, allServers, { origin: base })
  if (!servers.length) {
    return { ok: false, stage: 'probe', error: 'no available servers', type, contentPath, token, servers: [], allServers }
  }

  const picked = pickServer(servers, options)
  const selected = picked.server
  if (!selected?.data) {
    return { ok: false, stage: 'servers', error: 'server entry missing data field', type, contentPath, token, servers }
  }

  const decoded = await decodeServerStream(contentPath, selected.data, {
    origin: base,
    type,
    serverName: selected.name,
    serverIndex: picked.index,
  })

  if (!decoded.ok) {
    return { ...decoded, token, servers, allServers }
  }

  return {
    ...decoded,
    servers,
    allServers,
    selectedServer: { index: picked.index, name: selected.name },
    token,
  }
}
