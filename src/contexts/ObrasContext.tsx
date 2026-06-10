import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { obras as initialObras } from '../data/mockData'
import type { Obra } from '../types'

export interface Snapshot {
  id: string
  date: string   // ISO date string when snapshot was created
  label: string  // e.g. "Importação — 07/06/2026" or "Manual"
  obras: Obra[]
}

interface ObrasContextType {
  obras: Obra[]
  updateObra: (id: string, updates: Partial<Obra>) => void
  addObra: (obra: Omit<Obra, 'id'>) => void
  deleteObra: (id: string) => void
  registrarAvanco: (id: string, avancoPct: number) => void
  // Histórico
  snapshots: Snapshot[]
  createSnapshot: (label?: string) => void
  deleteSnapshot: (id: string) => void
}

const ObrasContext = createContext<ObrasContextType | null>(null)

const STORAGE_KEY  = 'pavcon_obras'
const SNAP_KEY     = 'pavcon_snapshots'
const VERSION_KEY  = 'pavcon_obras_version'

function load(): Obra[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      // Primeira vez: carrega os dados iniciais
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialObras))
      return initialObras
    }
    const parsed: Obra[] = JSON.parse(raw)
    return parsed.map(o => ({ ...o, engenharia: o.engenharia ?? '' }))
  } catch {
    return initialObras
  }
}

function loadSnapshots(): Snapshot[] {
  try {
    const raw = localStorage.getItem(SNAP_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function save(obras: Obra[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obras))
}

function saveSnaps(snaps: Snapshot[]) {
  localStorage.setItem(SNAP_KEY, JSON.stringify(snaps))
}

export function ObrasProvider({ children }: { children: ReactNode }) {
  const [obras, setObras]         = useState<Obra[]>(load)
  const [snapshots, setSnapshots] = useState<Snapshot[]>(loadSnapshots)

  const updateObra = (id: string, updates: Partial<Obra>) => {
    setObras(prev => {
      const next = prev.map(o => o.id === id ? { ...o, ...updates } : o)
      save(next)
      return next
    })
  }

  const addObra = (obra: Omit<Obra, 'id'>) => {
    setObras(prev => {
      const next = [...prev, { ...obra, id: crypto.randomUUID() }]
      save(next)
      return next
    })
  }

  const deleteObra = (id: string) => {
    setObras(prev => {
      const next = prev.filter(o => o.id !== id)
      save(next)
      return next
    })
  }

  const registrarAvanco = (id: string, avancoPct: number) => {
    setObras(prev => {
      const next = prev.map(o => {
        if (o.id !== id) return o
        const entrada = { data: new Date().toISOString().slice(0, 10), avancoPct }
        return { ...o, historicoAvanco: [...(o.historicoAvanco ?? []), entrada] }
      })
      save(next)
      return next
    })
  }

  const createSnapshot = useCallback((label?: string) => {
    setObras(currentObras => {
      const now = new Date()
      const datePt = now.toLocaleDateString('pt-BR')
      const snap: Snapshot = {
        id: crypto.randomUUID(),
        date: now.toISOString(),
        label: label ? `${label} — ${datePt}` : `Manual — ${datePt}`,
        obras: currentObras,
      }
      setSnapshots(prev => {
        const next = [snap, ...prev]
        saveSnaps(next)
        return next
      })
      return currentObras   // não altera obras
    })
  }, [])

  const deleteSnapshot = useCallback((id: string) => {
    setSnapshots(prev => {
      const next = prev.filter(s => s.id !== id)
      saveSnaps(next)
      return next
    })
  }, [])

  return (
    <ObrasContext.Provider value={{
      obras, updateObra, addObra, deleteObra, registrarAvanco,
      snapshots, createSnapshot, deleteSnapshot,
    }}>
      {children}
    </ObrasContext.Provider>
  )
}

export function useObras() {
  const ctx = useContext(ObrasContext)
  if (!ctx) throw new Error('useObras must be used within ObrasProvider')
  return ctx
}
