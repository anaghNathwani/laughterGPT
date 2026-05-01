import { useState } from 'react'
import { useMesh } from '../context/MeshContext'
import { exportMesh } from '../api'

const FORMATS = ['.obj', '.stl', '.ply', '.glb', '.gltf', '.off']

export default function PropertiesPanel({ onExportGLB }) {
  const { mesh, setStatus } = useMesh()
  const [fmt, setFmt] = useState('.obj')

  const s = mesh?.stats

  async function doExport() {
    if (!mesh) return
    try {
      setStatus({ msg: `Exporting ${fmt}…`, frac: 0.5 })
      await exportMesh(mesh, fmt)
      setStatus({ msg: `✓ Exported ${mesh.name}${fmt}`, frac: 1 })
    } catch (e) {
      setStatus({ msg: `Export error: ${e.message}`, frac: 0 })
    }
  }

  return (
    <div className="right-panel">
      <section className="right-section">
        <div className="section-title">📐 Properties</div>
        {!mesh
          ? <p className="hint">No mesh loaded.</p>
          : (
            <table className="stats-table">
              <tbody>
                <tr><td>Name</td><td>{mesh.name}</td></tr>
                <tr><td>Vertices</td><td>{s.vertices.toLocaleString()}</td></tr>
                <tr><td>Faces</td><td>{s.faces.toLocaleString()}</td></tr>
                <tr><td>Volume</td><td>{s.volume}</td></tr>
                <tr><td>Surface</td><td>{s.surfaceArea}</td></tr>
                <tr>
                  <td>Extents</td>
                  <td>{s.extents.map(v => v.toFixed(3)).join(' × ')}</td>
                </tr>
              </tbody>
            </table>
          )
        }
      </section>

      <section className="right-section">
        <div className="section-title">💾 Export</div>
        <div className="fmt-chips">
          {FORMATS.map(f => (
            <button key={f} className={`fmt-chip ${fmt===f?'active':''}`}
              onClick={() => setFmt(f)}>
              {f}
            </button>
          ))}
        </div>
        <button className="btn-secondary" onClick={doExport} disabled={!mesh}>
          Download {fmt}
        </button>
        <button className="btn-secondary" onClick={onExportGLB} disabled={!mesh}>
          🎬 Export animated .glb
        </button>
      </section>

      <section className="right-section">
        <div className="section-title">🖥 Display</div>
        <DisplayModeButtons />
      </section>
    </div>
  )
}

function DisplayModeButtons() {
  const [mode, setMode] = useState('solid')
  // bubble up via custom event so Viewport can listen
  function pick(m) {
    setMode(m)
    window.dispatchEvent(new CustomEvent('displaymode', { detail: m }))
  }
  return (
    <div className="anim-grid">
      {['solid','wireframe','points'].map(m => (
        <button key={m} className={`anim-chip ${mode===m?'active':''}`} onClick={() => pick(m)}>
          {m}
        </button>
      ))}
    </div>
  )
}
