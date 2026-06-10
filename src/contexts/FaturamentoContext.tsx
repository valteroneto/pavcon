import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Mes, MesesProjecao } from '../data/faturamentoData'

export interface Scenario {
  id: string
  nome: string
  createdAt: string
  editedProjecoes: Record<string, Partial<MesesProjecao>>
}

interface FaturamentoContextType {
  editedProjecoes: Record<string, Partial<MesesProjecao>>
  setMesProjecao: (item: string, mes: Mes, valor: number) => void
  realOverrides: Record<string, Partial<MesesProjecao>>
  setMesReal: (item: string, mes: Mes, valor: number) => void
  scenarios: Scenario[]
  saveScenario: (nome: string) => void
  loadScenario: (id: string) => void
  deleteScenario: (id: string) => void
  activeScenarioId: string | null
  resetProjecoes: () => void
}

const FaturamentoContext = createContext<FaturamentoContextType | null>(null)

const KEY_PROJ = 'pavcon_fat_projecoes'
const KEY_REAL = 'pavcon_fat_real'
const KEY_SCEN = 'pavcon_fat_scenarios'

function load<T>(key: string, fallback: T): T {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback } catch { return fallback }
}
function persist(key: string, val: unknown) { localStorage.setItem(key, JSON.stringify(val)) }

export function FaturamentoProvider({ children }: { children: ReactNode }) {
  const [editedProjecoes, setEditedProjecoes] = useState<Record<string, Partial<MesesProjecao>>>(
    () => load(KEY_PROJ, {})
  )
  const [realOverrides, setRealOverrides] = useState<Record<string, Partial<MesesProjecao>>>(
    () => load(KEY_REAL, {})
  )
  const [scenarios, setScenarios] = useState<Scenario[]>(() => load(KEY_SCEN, []))
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null)

  const setMesProjecao = (item: string, mes: Mes, valor: number) => {
    setEditedProjecoes(prev => {
      const next = { ...prev, [item]: { ...prev[item], [mes]: valor } }
      persist(KEY_PROJ, next)
      return next
    })
  }

  const setMesReal = (item: string, mes: Mes, valor: number) => {
    setRealOverrides(prev => {
      const next = { ...prev, [item]: { ...prev[item], [mes]: valor } }
      persist(KEY_REAL, next)
      return next
    })
  }

  const saveScenario = (nome: string) => {
    const sc: Scenario = {
      id: crypto.randomUUID(),
      nome,
      createdAt: new Date().toISOString(),
      editedProjecoes: JSON.parse(JSON.stringify(editedProjecoes)),
    }
    const next = [...scenarios, sc]
    setScenarios(next)
    persist(KEY_SCEN, next)
    setActiveScenarioId(sc.id)
  }

  const loadScenario = (id: string) => {
    const sc = scenarios.find(s => s.id === id)
    if (!sc) return
    setEditedProjecoes(sc.editedProjecoes)
    persist(KEY_PROJ, sc.editedProjecoes)
    setActiveScenarioId(id)
  }

  const deleteScenario = (id: string) => {
    const next = scenarios.filter(s => s.id !== id)
    setScenarios(next)
    persist(KEY_SCEN, next)
    if (activeScenarioId === id) setActiveScenarioId(null)
  }

  const resetProjecoes = () => {
    setEditedProjecoes({})
    persist(KEY_PROJ, {})
    setActiveScenarioId(null)
  }

  return (
    <FaturamentoContext.Provider value={{
      editedProjecoes, setMesProjecao,
      realOverrides, setMesReal,
      scenarios, saveScenario, loadScenario, deleteScenario,
      activeScenarioId, resetProjecoes,
    }}>
      {children}
    </FaturamentoContext.Provider>
  )
}

export function useFaturamento() {
  const ctx = useContext(FaturamentoContext)
  if (!ctx) throw new Error('useFaturamento must be used within FaturamentoProvider')
  return ctx
}
