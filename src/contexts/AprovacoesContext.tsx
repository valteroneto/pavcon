import { createContext, useContext, useState, type ReactNode } from 'react'

export type CampoRestrito = 'conclusaoPrevista' | 'executivo' | 'venda'

export const CAMPO_LABELS: Record<CampoRestrito, string> = {
  conclusaoPrevista: 'Data Prev. Conclusão',
  executivo: 'Executivo (R$)',
  venda: 'Venda (R$)',
}

export type StatusAprovacao = 'pendente' | 'aprovado' | 'rejeitado'

export interface AlcadaEntry {
  nome: string
  cargo: string
  nivel: 1 | 2 | 3
  data: string
}

export interface Aprovacao {
  id: string
  obraId: string
  obraLabel: string
  campo: CampoRestrito
  valorAtual: string | number
  valorNovo: string | number
  solicitante: string
  justificativa: string
  dataSolicitacao: string
  /** Lista de aprovações já concedidas — máx. 3 (uma por nível) */
  alcadas: AlcadaEntry[]
  status: StatusAprovacao
  dataResolucao?: string
}

interface AprovacoesContextType {
  aprovacoes: Aprovacao[]
  solicitarAprovacao: (
    obraId: string,
    obraLabel: string,
    campo: CampoRestrito,
    valorAtual: string | number,
    valorNovo: string | number,
    solicitante: string,
    justificativa: string
  ) => void
  /** cargo e nivel são opcionais por retrocompatibilidade */
  aprovar: (id: string, aprovador: string, cargo?: string, nivel?: 1 | 2 | 3) => Aprovacao
  rejeitar: (id: string, aprovador: string) => void
}

const AprovacoesContext = createContext<AprovacoesContextType | null>(null)
const STORAGE_KEY = 'pavcon_aprovacoes'

function migrateAlcada(raw: unknown): AlcadaEntry {
  if (typeof raw === 'string') return { nome: raw, cargo: '—', nivel: 1, data: '' }
  return raw as AlcadaEntry
}

function load(): Aprovacao[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as Aprovacao[]
    return parsed.map(a => ({ ...a, alcadas: (a.alcadas as unknown[]).map(migrateAlcada) }))
  } catch { return [] }
}

function persist(list: Aprovacao[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

export function AprovacoesProvider({ children }: { children: ReactNode }) {
  const [aprovacoes, setAprovacoes] = useState<Aprovacao[]>(load)

  const update = (next: Aprovacao[]) => { persist(next); setAprovacoes(next) }

  const solicitarAprovacao = (
    obraId: string, obraLabel: string, campo: CampoRestrito,
    valorAtual: string | number, valorNovo: string | number,
    solicitante: string, justificativa: string
  ) => {
    const sem = aprovacoes.filter(a => !(a.obraId === obraId && a.campo === campo && a.status === 'pendente'))
    const nova: Aprovacao = {
      id: crypto.randomUUID(),
      obraId, obraLabel, campo, valorAtual, valorNovo, solicitante, justificativa,
      dataSolicitacao: new Date().toISOString(),
      alcadas: [],
      status: 'pendente',
    }
    update([...sem, nova])
  }

  const aprovar = (id: string, aprovador: string, cargo = '—', nivel?: 1 | 2 | 3): Aprovacao => {
    let resultado!: Aprovacao
    const next = aprovacoes.map(a => {
      if (a.id !== id || a.status !== 'pendente') return a
      // Impede aprovação dupla pelo mesmo usuário
      if (a.alcadas.some(al => al.nome === aprovador)) return a

      const proximoNivel = (a.alcadas.length + 1) as 1 | 2 | 3
      // Nível do cargo deve ser >= ao próximo slot necessário
      // (Diretor pode aprovar alçada 1 ou 2; Supervisor pode aprovar alçada 1)
      if (nivel != null && nivel < proximoNivel) return a

      // A entrada registra o slot preenchido (em ordem), não o nível do cargo
      const entrada: AlcadaEntry = { nome: aprovador, cargo, nivel: proximoNivel, data: new Date().toISOString() }
      const novasAlcadas = [...a.alcadas, entrada]
      // Aprovado se: Supervisor (≥ 2ª alçada) ou Diretor (3ª) aprovarem,
      // ou se todas as 3 alçadas forem preenchidas por Analistas
      const aprovadoPorSuperiorOuCompleto = (nivel != null && nivel >= 2) || novasAlcadas.length >= 3
      const status: StatusAprovacao = aprovadoPorSuperiorOuCompleto ? 'aprovado' : 'pendente'
      resultado = { ...a, alcadas: novasAlcadas, status, dataResolucao: status === 'aprovado' ? new Date().toISOString() : undefined }
      return resultado
    })
    update(next)
    return resultado
  }

  const rejeitar = (id: string, aprovador: string) => {
    const next = aprovacoes.map(a =>
      a.id === id && a.status === 'pendente'
        ? {
            ...a,
            status: 'rejeitado' as StatusAprovacao,
            alcadas: [...a.alcadas, { nome: aprovador, cargo: '—', nivel: (a.alcadas.length + 1) as 1 | 2 | 3, data: new Date().toISOString() }],
            dataResolucao: new Date().toISOString(),
          }
        : a
    )
    update(next)
  }

  return (
    <AprovacoesContext.Provider value={{ aprovacoes, solicitarAprovacao, aprovar, rejeitar }}>
      {children}
    </AprovacoesContext.Provider>
  )
}

export function useAprovacoes() {
  const ctx = useContext(AprovacoesContext)
  if (!ctx) throw new Error('useAprovacoes must be used within AprovacoesProvider')
  return ctx
}
