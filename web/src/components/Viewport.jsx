import { useRef, useEffect, useMemo, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Grid, Environment, GizmoHelper, GizmoViewport } from '@react-three/drei'
import * as THREE from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { useMesh } from '../context/MeshContext'

// ── animation helpers ────────────────────────────────────────────────────────

function buildGeometry(meshData) {
  if (!meshData) return null
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position',
    new THREE.BufferAttribute(new Float32Array(meshData.vertices.flat()), 3))
  geo.setIndex(
    new THREE.BufferAttribute(new Uint32Array(meshData.faces.flat()), 1))
  geo.computeVertexNormals()
  return geo
}

function waveDisplace(geo, t, amplitude = 0.06, frequency = 6) {
  const pos = geo.attributes.position
  const orig = geo.userData.originalPositions
  if (!orig) {
    geo.userData.originalPositions = pos.array.slice()
    return
  }
  for (let i = 0; i < pos.count; i++) {
    const ox = orig[i * 3], oy = orig[i * 3 + 1], oz = orig[i * 3 + 2]
    const d  = amplitude * Math.sin(frequency * ox + t) * Math.cos(frequency * oz + t * 0.7)
    pos.setY(i, oy + d)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
}

// ── mesh object with full animation support ──────────────────────────────────

function MeshObject({ displayMode }) {
  const { mesh, morphFrames, animation } = useMesh()
  const meshRef    = useRef()
  const geoRef     = useRef()
  const frameIdx   = useRef(0)
  const frameTimer = useRef(0)

  const mainGeo = useMemo(() => buildGeometry(mesh),  [mesh])
  const morphGeos = useMemo(
    () => morphFrames?.map(buildGeometry).filter(Boolean) ?? [],
    [morphFrames]
  )

  useEffect(() => {
    if (geoRef.current) geoRef.current.dispose()
    geoRef.current = mainGeo
  }, [mainGeo])

  useFrame((state, delta) => {
    if (!meshRef.current) return
    const m   = meshRef.current
    const t   = state.clock.elapsedTime
    const spd = animation.speed

    if (!animation.playing || animation.type === 'none') return

    if (animation.type === 'morph' && morphGeos.length > 1) {
      const fps = 12 * spd
      frameTimer.current += delta
      if (frameTimer.current >= 1 / fps) {
        frameTimer.current = 0
        frameIdx.current   = (frameIdx.current + 1) % morphGeos.length
        if (m.geometry !== morphGeos[frameIdx.current]) {
          m.geometry = morphGeos[frameIdx.current]
        }
      }
      return
    }

    // Reset geometry to main when not morphing
    if (m.geometry !== geoRef.current && geoRef.current) {
      m.geometry = geoRef.current
    }

    switch (animation.type) {
      case 'spin':
        m.rotation.y += delta * spd * 1.5
        break
      case 'float':
        m.position.y = Math.sin(t * spd * 1.2) * 0.18
        break
      case 'pulse': {
        const s = 1 + Math.sin(t * spd * 2) * 0.15
        m.scale.setScalar(s)
        break
      }
      case 'bounce':
        m.position.y = Math.abs(Math.sin(t * spd * 2.5)) * 0.3 - 0.08
        break
      case 'wobble':
        m.rotation.x = Math.sin(t * spd * 1.4) * 0.25
        m.rotation.z = Math.cos(t * spd * 0.9) * 0.18
        break
      case 'wave':
        if (geoRef.current) waveDisplace(geoRef.current, t * spd)
        break
      case 'spin+float':
        m.rotation.y += delta * spd * 1.5
        m.position.y  = Math.sin(t * spd * 0.8) * 0.15
        break
      default: break
    }
  })

  if (!mesh && !morphFrames) return null

  const mat = displayMode === 'wireframe'
    ? <meshBasicMaterial color="#4a9af5" wireframe />
    : displayMode === 'points'
    ? <pointsMaterial color="#4a9af5" size={0.01} />
    : <meshStandardMaterial
        color="#4a9af5"
        metalness={0.15}
        roughness={0.45}
        envMapIntensity={0.8}
      />

  const geo = animation.type === 'morph' && morphGeos.length
    ? morphGeos[frameIdx.current] ?? mainGeo
    : mainGeo

  if (!geo) return null

  if (displayMode === 'points') {
    return <points ref={meshRef} geometry={geo}>{mat}</points>
  }
  return (
    <mesh ref={meshRef} geometry={geo} castShadow receiveShadow>
      {mat}
    </mesh>
  )
}

// ── scene ────────────────────────────────────────────────────────────────────

function Scene({ displayMode }) {
  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 6, 3]} intensity={1.2} castShadow
        shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-3, -2, -3]} intensity={0.3} color="#8899ff" />
      <Environment preset="studio" />
      <MeshObject displayMode={displayMode} />
      <Grid
        args={[6, 6]}
        position={[0, -0.55, 0]}
        cellColor="#334466"
        sectionColor="#445577"
        fadeDistance={5}
        infiniteGrid
      />
      <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
        <GizmoViewport labelColor="white" axisHeadScale={1} />
      </GizmoHelper>
      <OrbitControls makeDefault enableDamping dampingFactor={0.06} />
    </>
  )
}

// ── screenshot helper (called from parent via ref) ────────────────────────────

function ScreenshotCapture({ captureRef }) {
  const { gl } = useThree()
  captureRef.current = () => gl.domElement.toDataURL('image/png')
  return null
}

// ── export animated GLB ───────────────────────────────────────────────────────

export async function exportAnimatedGLB(scene, animationType, speed, duration = 4) {
  const exporter = new GLTFExporter()

  let clip = null
  const times = Array.from({ length: 60 }, (_, i) => (i / 59) * duration)

  if (animationType === 'spin') {
    const vals = times.map(t => [0, t * speed * Math.PI * 0.5, 0]).flat()
    clip = new THREE.AnimationClip('spin', duration, [
      new THREE.VectorKeyframeTrack('mesh.rotation', times, vals),
    ])
  } else if (animationType === 'float') {
    const vals = times.map(t => [0, Math.sin(t * speed * 1.2) * 0.18, 0]).flat()
    clip = new THREE.AnimationClip('float', duration, [
      new THREE.VectorKeyframeTrack('.position', times, vals),
    ])
  } else if (animationType === 'pulse') {
    const vals = times.map(t => {
      const s = 1 + Math.sin(t * speed * 2) * 0.15; return [s, s, s]
    }).flat()
    clip = new THREE.AnimationClip('pulse', duration, [
      new THREE.VectorKeyframeTrack('.scale', times, vals),
    ])
  }

  const animations = clip ? [clip] : []
  const binary = await new Promise((res, rej) =>
    exporter.parse(scene, res, rej, { binary: true, animations })
  )
  const blob = new Blob([binary], { type: 'model/gltf-binary' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = `animation_${animationType}.glb`; a.click()
  URL.revokeObjectURL(url)
}

// ── main viewport component ───────────────────────────────────────────────────

export default function Viewport({ displayMode = 'solid' }) {
  const captureRef = useRef()
  const sceneRef   = useRef()

  return (
    <div className="viewport">
      <Canvas
        shadows
        camera={{ position: [0, 0.3, 1.8], fov: 45 }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        onCreated={({ scene }) => { sceneRef.current = scene }}
        style={{ background: 'radial-gradient(ellipse at 50% 40%, #1a2a4a 0%, #0d1525 100%)' }}
      >
        <Scene displayMode={displayMode} />
        <ScreenshotCapture captureRef={captureRef} />
      </Canvas>

      <div className="viewport-actions">
        <button
          className="icon-btn"
          title="Screenshot"
          onClick={() => {
            if (!captureRef.current) return
            const a = document.createElement('a')
            a.href = captureRef.current(); a.download = 'render.png'; a.click()
          }}
        >📷</button>
        <button
          className="icon-btn"
          title="Export animated GLB"
          onClick={async () => {
            if (!sceneRef.current) return
            const { animation } = window.__meshCtx ?? {}
            await exportAnimatedGLB(sceneRef.current, animation?.type ?? 'spin',
              animation?.speed ?? 1)
          }}
        >🎬</button>
      </div>
    </div>
  )
}
