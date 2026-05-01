import { useState, useRef } from 'react'
import { useMesh } from '../context/MeshContext'
import { generateWS, getPrimitive, uploadMesh } from '../api'

const PRIMITIVES = ['sphere','cube','cylinder','torus','cone','plane','capsule']
const PRIM_ICONS  = { sphere:'🔵', cube:'🟦', cylinder:'🟫', torus:'🍩', cone:'🔺', plane:'▬', capsule:'💊' }

export default function GeneratePanel() {
  const { setMesh, pushHistory, setStatus, setLoading, loading } = useMesh()

  const [prompt,      setPrompt]      = useState('a smooth sphere')
  const [resolution,  setResolution]  = useState(48)
  const [neuralBlend, setNeuralBlend] = useState(0)
  const [seed,        setSeed]        = useState(0)
  const [smoothIters, setSmoothIters] = useState(1)
  const [tab,         setTab]         = useState('generate') // 'generate'|'primitives'|'history'
  const { history }                   = useMesh()
  const fileRef = useRef()

  async function doGenerate() {
    if (!prompt.trim()) return
    setLoading(true)
    setStatus({ msg: `Generating: "${prompt}"…`, frac: 0 })
    try {
      const mesh = await generateWS(
        prompt,
        { resolution, neuralBlend, seed, smoothIters },
        (frac, msg) => setStatus({ frac, msg })
      )
      setMesh(mesh)
      pushHistory(mesh)
      setStatus({ msg: `✓ ${mesh.stats.vertices.toLocaleString()} verts · ${mesh.stats.faces.toLocaleString()} faces`, frac: 1 })
    } catch (e) {
      setStatus({ msg: `Error: ${e.message}`, frac: 0 })
    } finally {
      setLoading(false)
    }
  }

  async function doPrimitive(shape) {
    setLoading(true)
    setStatus({ msg: `Building ${shape}…`, frac: 0.5 })
    try {
      const mesh = await getPrimitive(shape)
      setMesh(mesh); pushHistory(mesh)
      setStatus({ msg: `✓ ${shape}`, frac: 1 })
    } catch (e) {
      setStatus({ msg: `Error: ${e.message}`, frac: 0 })
    } finally { setLoading(false) }
  }

  async function doUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setStatus({ msg: `Loading ${file.name}…`, frac: 0.5 })
    try {
      const mesh = await uploadMesh(file)
      setMesh(mesh); pushHistory(mesh)
      setStatus({ msg: `✓ Loaded ${file.name}`, frac: 1 })
    } catch (e) {
      setStatus({ msg: `Error: ${e.message}`, frac: 0 })
    } finally { setLoading(false) }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="logo">🎲 RenderBender</span>
      </div>

      <div className="tab-bar">
        {['generate','primitives','history'].map(t => (
          <button key={t} className={`tab ${tab===t?'active':''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'generate' && (
        <div className="panel-body">
          <label className="field-label">Prompt</label>
          <textarea
            className="prompt-input"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) doGenerate() }}
            rows={3}
            placeholder="Describe your 3D model…"
          />
          <div className="hint">Ctrl+Enter to generate</div>

          <label className="field-label">Resolution
            <span className="value-badge">{resolution}³</span>
          </label>
          <div className="radio-row">
            {[32,48,64].map(r => (
              <label key={r} className={`radio-chip ${resolution===r?'active':''}`}>
                <input type="radio" value={r} checked={resolution===r}
                  onChange={() => setResolution(r)} />
                {r}
              </label>
            ))}
          </div>

          <label className="field-label">Neural blend
            <span className="value-badge">{neuralBlend.toFixed(2)}</span>
          </label>
          <input type="range" min={0} max={1} step={0.05} value={neuralBlend}
            onChange={e => setNeuralBlend(+e.target.value)} />

          <div className="row-2">
            <div>
              <label className="field-label">Seed</label>
              <input type="number" className="num-input" value={seed}
                onChange={e => setSeed(+e.target.value)} />
            </div>
            <div>
              <label className="field-label">Smooth</label>
              <input type="number" className="num-input" min={0} max={3} value={smoothIters}
                onChange={e => setSmoothIters(+e.target.value)} />
            </div>
          </div>

          <button className="btn-primary" onClick={doGenerate} disabled={loading}>
            {loading ? <span className="spinner" /> : '⚡'} Generate
          </button>

          <div className="divider" />

          <button className="btn-secondary" onClick={() => fileRef.current?.click()}>
            📂 Open file
          </button>
          <input ref={fileRef} type="file"
            accept=".obj,.stl,.ply,.blend,.glb,.gltf,.fbx,.off"
            style={{ display: 'none' }} onChange={doUpload} />
        </div>
      )}

      {tab === 'primitives' && (
        <div className="panel-body">
          <p className="hint">Click to instantly generate</p>
          {PRIMITIVES.map(s => (
            <button key={s} className="prim-btn" onClick={() => doPrimitive(s)} disabled={loading}>
              {PRIM_ICONS[s]} {s}
            </button>
          ))}
        </div>
      )}

      {tab === 'history' && (
        <div className="panel-body">
          {history.length === 0
            ? <p className="hint">No history yet.</p>
            : [...history].reverse().map((item, i) => (
              <button key={i} className="hist-item"
                onClick={() => { setMesh(item.mesh); setStatus({ msg: `Restored: ${item.name}`, frac: 1 }) }}>
                🗂 {item.name}
              </button>
            ))
          }
        </div>
      )}
    </aside>
  )
}
