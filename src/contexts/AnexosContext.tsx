import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Anexo } from '../types'

const STORAGE_KEY = 'pavcon_anexos'

function load(): Anexo[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}
function save(list: Anexo[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

interface AnexosContextType {
  anexos: Anexo[]
  getAnexosObra: (obraId: string) => Anexo[]
  addAnexo: (anexo: Omit<Anexo, 'id'>) => void
  deleteAnexo: (id: string) => void
  updateAnexo: (id: string, updates: Partial<Pick<Anexo, 'descricao'>>) => void
}

const AnexosContext = createContext<AnexosContextType | null>(null)

export function AnexosProvider({ children }: { children: ReactNode }) {
  const [anexos, setAnexos] = useState<Anexo[]>(load)

  const getAnexosObra = (obraId: string) => anexos.filter(a => a.obraId === obraId)

  const addAnexo = (anexo: Omit<Anexo, 'id'>) => {
    setAnexos(prev => {
      const next = [...prev, { ...anexo, id: crypto.randomUUID() }]
      save(next)
      return next
    })
  }

  const deleteAnexo = (id: string) => {
    setAnexos(prev => {
      const next = prev.filter(a => a.id !== id)
      save(next)
      return next
    })
  }

  const updateAnexo = (id: string, updates: Partial<Pick<Anexo, 'descricao'>>) => {
    setAnexos(prev => {
      const next = prev.map(a => a.id === id ? { ...a, ...updates } : a)
      save(next)
      return next
    })
  }

  return (
    <AnexosContext.Provider value={{ anexos, getAnexosObra, addAnexo, deleteAnexo, updateAnexo }}>
      {children}
    </AnexosContext.Provider>
  )
}

export function useAnexos() {
  const ctx = useContext(AnexosContext)
  if (!ctx) throw new Error('useAnexos must be used within AnexosProvider')
  return ctx
}
