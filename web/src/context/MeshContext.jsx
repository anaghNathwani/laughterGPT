import { createContext, useContext, useState, useCallback } from 'react'

const Ctx = createContext(null)

export function MeshProvider({ children }) {
  const [mesh,       setMesh]       = useState(null)
  const [morphFrames,setMorphFrames]= useState(null)   // [{vertices,faces},...] for morph anim
  const [history,    setHistory]    = useState([])
  const [status,     setStatus]     = useState({ msg: 'Ready.', frac: 0 })
  const [loading,    setLoading]    = useState(false)
  const [animation,  setAnimation]  = useState({
    type:     'none',   // 'none'|'spin'|'float'|'pulse'|'bounce'|'wobble'|'wave'|'morph'
    speed:    1.0,
    playing:  false,
  })

  const pushHistory = useCallback((m) => {
    setHistory(h => [...h.slice(-19), { name: m.name, mesh: m }])
  }, [])

  return (
    <Ctx.Provider value={{
      mesh, setMesh,
      morphFrames, setMorphFrames,
      history, pushHistory,
      status, setStatus,
      loading, setLoading,
      animation, setAnimation,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useMesh = () => useContext(Ctx)
