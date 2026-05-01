import { useState } from 'react'
import { useMesh } from '../context/MeshContext'
import { morphWS } from '../api'

const ANIM_TYPES = [
  { id: 'none',       label: '⬜ None',         desc: 'Static mesh' },
  { id: 'spin',       label: '🔄 Spin',          desc: 'Rotate around Y axis' },
  { id: 'float',      label: '🌊 Float',         desc: 'Sine-wave vertical drift' },
  { id: 'pulse',      label: '💓 Pulse',         desc: 'Breathe in/out (scale)' },
  { id: 'bounce',     label: '🏀 Bounce',        desc: 'Elastic bounce' },
  { id: 'wobble',     label: '🥴 Wobble',        desc: 'Random axis rotation' },
  { id: 'wave',       label: '〰️ Wave',          desc: 'Vertex sine deformation' },
  { id: 'spin+float', label: '🌀 Spin+Float',    desc: 'Combined spin and float' },
  { id: 'morph',      label: '🔀 Morph',         desc: 'Interpolate to another shape' },
]

export default function AnimationPanel({ onExportGLB }) {
  const { animation, setAnimation, setMorphFrames, setStatus, setLoading, loading } = useMesh()
  const [morphPrompt2,  setMorphPrompt2]  = useState('a cube')
  const [morphFrames,   setMorphFramesN]  = useState(24)
  const [morphRes,      setMorphRes]      = useState(32)
  const [morphBuilt,    setMorphBuilt]    = useState(false)

  function setType(type) {
    setAnimation(a => ({ ...a, type }))
    if (type !== 'morph') {
      setMorphFrames(null)
      setMorphBuilt(false)
    }
  }

  async function buildMorph() {
    const { mesh } = window.__meshCtx ?? {}
    const prompt1  = mesh?.name ?? 'a sphere'
    setLoading(true)
    setMorphBuilt(false)
    setStatus({ msg: 'Generating morph frames…', frac: 0 })
    try {
      const frames = await morphWS(
        prompt1, morphPrompt2, morphFrames, morphRes,
        (frac, msg) => setStatus({ frac, msg })
      )
      setMorphFrames(frames)
      setMorphBuilt(true)
      setStatus({ msg: `✓ Morph ready — ${frames.length} frames`, frac: 1 })
    } catch (e) {
      setStatus({ msg: `Error: ${e.message}`, frac: 0 })
    } finally { setLoading(false) }
  }

  const playing = animation.playing

  return (
    <section className="right-section">
      <div className="section-title">🎬 Animation</div>

      <div className="anim-grid">
        {ANIM_TYPES.map(a => (
          <button
            key={a.id}
            className={`anim-chip ${animation.type === a.id ? 'active' : ''}`}
            onClick={() => setType(a.id)}
            title={a.desc}
          >
            {a.label}
          </button>
        ))}
      </div>

      {animation.type !== 'none' && (
        <>
          <label className="field-label">Speed
            <span className="value-badge">{animation.speed.toFixed(1)}×</span>
          </label>
          <input type="range" min={0.1} max={4} step={0.1} value={animation.speed}
            onChange={e => setAnimation(a => ({ ...a, speed: +e.target.value }))} />

          <div className="playback-row">
            <button
              className={`btn-icon ${playing ? 'active' : ''}`}
              onClick={() => setAnimation(a => ({ ...a, playing: !a.playing }))}
              title={playing ? 'Pause' : 'Play'}
            >
              {playing ? '⏸' : '▶'}
            </button>
            <button className="btn-icon"
              onClick={() => setAnimation(a => ({ ...a, playing: false }))}
              title="Stop">⏹</button>
          </div>
        </>
      )}

      {animation.type === 'morph' && (
        <div className="morph-box">
          <label className="field-label">Morph to</label>
          <input className="text-input" value={morphPrompt2}
            onChange={e => setMorphPrompt2(e.target.value)}
            placeholder="e.g. a cube" />

          <div className="row-2">
            <div>
              <label className="field-label">Frames</label>
              <input type="number" className="num-input" min={4} max={60} value={morphFrames}
                onChange={e => setMorphFramesN(+e.target.value)} />
            </div>
            <div>
              <label className="field-label">Res</label>
              <input type="number" className="num-input" min={16} max={48} value={morphRes}
                onChange={e => setMorphRes(+e.target.value)} />
            </div>
          </div>

          <button className="btn-primary" onClick={buildMorph} disabled={loading}>
            {loading ? <span className="spinner" /> : '🔀'} Build morph
          </button>
          {morphBuilt && <p className="hint ok">✓ Morph ready — press ▶ to play</p>}
        </div>
      )}

      {animation.type !== 'none' && (
        <>
          <div className="divider" />
          <label className="field-label">Export</label>
          <button className="btn-secondary" onClick={onExportGLB}>
            💾 Export animated .glb
          </button>
        </>
      )}
    </section>
  )
}
