const BASE = '/api'

export async function generateMesh(prompt, params) {
  const r = await fetch(`${BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, ...params }),
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export async function getPrimitive(shape) {
  const r = await fetch(`${BASE}/primitive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shape }),
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export async function uploadMesh(file) {
  const fd = new FormData()
  fd.append('file', file)
  const r = await fetch(`${BASE}/upload`, { method: 'POST', body: fd })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export async function exportMesh(mesh, format) {
  const r = await fetch(`${BASE}/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mesh, format }),
  })
  if (!r.ok) throw new Error(await r.text())
  const blob = await r.blob()
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${mesh.name || 'model'}${format}`
  a.click()
  URL.revokeObjectURL(url)
}

export async function getFormats() {
  const r = await fetch(`${BASE}/formats`)
  return r.json()
}

/**
 * Stream mesh generation over WebSocket.
 * onProgress(frac, msg) called each step; resolves with final mesh.
 */
export function generateWS(prompt, params, onProgress) {
  return new Promise((resolve, reject) => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${proto}://${location.host}/ws/generate`)
    ws.onopen  = () => ws.send(JSON.stringify({ prompt, ...params }))
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data)
      if (d.type === 'progress') onProgress(d.frac, d.msg)
      if (d.type === 'done')     { ws.close(); resolve(d.mesh) }
      if (d.type === 'error')    { ws.close(); reject(new Error(d.msg)) }
    }
    ws.onerror = () => reject(new Error('WebSocket error'))
  })
}

/**
 * Stream morph animation generation over WebSocket.
 */
export function morphWS(prompt1, prompt2, frames, resolution, onProgress) {
  return new Promise((resolve, reject) => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${proto}://${location.host}/ws/morph`)
    ws.onopen  = () => ws.send(JSON.stringify({ prompt1, prompt2, frames, resolution }))
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data)
      if (d.type === 'progress') onProgress(d.frac, d.msg)
      if (d.type === 'done')     { ws.close(); resolve(d.frames) }
      if (d.type === 'error')    { ws.close(); reject(new Error(d.msg)) }
    }
    ws.onerror = () => reject(new Error('WebSocket error'))
  })
}
