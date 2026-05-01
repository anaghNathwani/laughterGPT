import { useState, useEffect, useRef } from 'react'
import { MeshProvider, useMesh } from './context/MeshContext'
import GeneratePanel    from './components/GeneratePanel'
import AnimationPanel   from './components/AnimationPanel'
import PropertiesPanel  from './components/PropertiesPanel'
import Viewport, { exportAnimatedGLB } from './components/Viewport'

function Inner() {
  const { status, loading, animation, mesh } = useMesh()
  const [displayMode, setDisplayMode] = useState('solid')
  const sceneRef = useRef(null)

  // Listen for display-mode changes emitted by PropertiesPanel
  useEffect(() => {
    const handler = e => setDisplayMode(e.detail)
    window.addEventListener('displaymode', handler)
    return () => window.removeEventListener('displaymode', handler)
  }, [])

  // Expose mesh context to Viewport's export button via a global
  useEffect(() => {
    window.__meshCtx = { mesh, animation }
  }, [mesh, animation])

  async function handleExportGLB() {
    if (!sceneRef.current) return
    await exportAnimatedGLB(sceneRef.current, animation.type, animation.speed)
  }

  return (
    <div className="app">
      {/* Top nav */}
      <nav className="navbar">
        <span className="nav-brand">🎲 RenderBender</span>
        <span className="nav-sub">3D Model Generator</span>
        <div className="nav-spacer" />
        {loading && <span className="nav-loading">
          <span className="spinner" /> generating…
        </span>}
      </nav>

      {/* Main 3-column layout */}
      <div className="layout">
        <GeneratePanel />

        <main className="center">
          <Viewport
            displayMode={displayMode}
            onSceneReady={s => { sceneRef.current = s }}
          />
        </main>

        <div className="right-col">
          <PropertiesPanel onExportGLB={handleExportGLB} />
          <AnimationPanel  onExportGLB={handleExportGLB} />
        </div>
      </div>

      {/* Status bar */}
      <footer className="statusbar">
        <div
          className="progress-fill"
          style={{ width: `${(status.frac ?? 0) * 100}%` }}
        />
        <span className="status-msg">{status.msg}</span>
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <MeshProvider>
      <Inner />
    </MeshProvider>
  )
}
