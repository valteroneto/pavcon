import { useState, useMemo, useRef, useEffect, useCallback, createContext, useContext } from 'react'
import { Download, X, Save, Plus, Trash2, ChevronRight, ChevronDown, Send, Lock, TrendingUp, Paperclip, DollarSign } from 'lucide-react'
import { engenheiros } from '../data/mockData'
import type { Obra, StatusObra, Regiao, Prioridade, StatusIDP } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { useObras } from '../contexts/ObrasContext'
import { useAprovacoes, type CampoRestrito, CAMPO_LABELS } from '../contexts/AprovacoesContext'
import { useAnexos } from '../contexts/AnexosContext'
import { MultiSelect } from '../components/MultiSelect'
import { faturamentoContratos } from '../data/faturamentoData'
import HistoricoAvancoModal from '../components/HistoricoAvancoModal'
import HistoricoMedicoesModal from '../components/HistoricoMedicoesModal'
import AnexosModal from '../components/AnexosModal'

// Campos que exigem aprovação em 2 alçadas
const CAMPOS_RESTRITOS: CampoRestrito[] = ['conclusaoPrevista', 'executivo', 'venda']

// ── Contexto para edição inline (evita redefinir EditableCell a cada render) ──
interface EditCtx {
  editCell: { obraId: string; campo: string } | null
  editVal: string
  setEditVal: (v: string) => void
  setInputRef: (r: HTMLInputElement | HTMLSelectElement | null) => void
  // val é o valor atual do DOM no momento do evento (evita stale state/ref)
  commitEdit: (o: Obra, campo: string, val: string) => void
  setEditCell: (v: { obraId: string; campo: string } | null) => void
  startEdit: (obraId: string, campo: string, valor: string | number) => void
  isAdmin: boolean
  temPendente: (obraId: string, campo: string) => boolean
}
const EditContext = createContext<EditCtx | null>(null)
const useEditCtx = () => useContext(EditContext)!

function EditableCell({
  o, campo, children, className = '', type = 'text', options, style,
}: {
  o: Obra; campo: string; children: React.ReactNode
  className?: string; type?: string; options?: string[]; style?: React.CSSProperties
}) {
  const { editCell, editVal, setEditVal, setInputRef, commitEdit, setEditCell, startEdit, isAdmin, temPendente } = useEditCtx()
  const isEditing  = editCell?.obraId === o.id && editCell?.campo === campo
  const isRestrito = CAMPOS_RESTRITOS.includes(campo as CampoRestrito)
  const isPendente = temPendente(o.id, campo)

  if (isEditing) {
    if (options) {
      // Select: confirma imediatamente no onChange (sem depender de blur)
      return (
        <td className={className} style={style}>
          <select
            ref={setInputRef}
            value={editVal}
            onChange={e => { setEditVal(e.target.value); commitEdit(o, campo, e.target.value) }}
            onKeyDown={e => { if (e.key === 'Escape') setEditCell(null) }}
            className="w-full border border-blue-400 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {options.map(op => <option key={op} value={op}>{op}</option>)}
          </select>
        </td>
      )
    }
    // Input: usa e.target.value do evento (valor real do DOM, sem dependência de re-render)
    return (
      <td className={className} style={style}>
        <input
          ref={setInputRef}
          type={type}
          value={editVal}
          onChange={e => setEditVal(e.target.value)}
          onBlur={e => commitEdit(o, campo, e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') commitEdit(o, campo, (e.target as HTMLInputElement).value)
            if (e.key === 'Escape') setEditCell(null)
          }}
          className="w-full border border-blue-400 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </td>
    )
  }

  return (
    <td
      className={`${className} ${isAdmin ? 'group/cell cursor-pointer select-none' : ''} relative`}
      style={style}
      onClick={() => isAdmin && startEdit(o.id, campo, (o as any)[campo] ?? '')}
      title={isAdmin ? (isRestrito ? 'Clique para solicitar alteração (requer 2 aprovações)' : 'Clique para editar') : undefined}
    >
      <div className="flex items-center gap-1">
        <span className="flex-1">{children}</span>
        {isAdmin && isPendente && (
          <span title="Aprovação pendente" className="text-amber-500 shrink-0"><Send size={10} /></span>
        )}
        {isAdmin && isRestrito && !isPendente && (
          <Lock size={9} className="text-gray-300 opacity-0 group-hover/cell:opacity-100 shrink-0 transition-opacity" />
        )}
      </div>
    </td>
  )
}

/** Célula de contrato: select com value=item, label=nome do contrato */
function ContratoCell({ o, className = '' }: { o: Obra; className?: string }) {
  const { editCell, editVal, setEditVal, setInputRef, commitEdit, setEditCell, startEdit, isAdmin } = useEditCtx()
  const isEditing = editCell?.obraId === o.id && editCell?.campo === 'contratoItem'
  const contrato  = faturamentoContratos.find(c => c.item === o.contratoItem)

  if (isEditing) {
    return (
      <td className={className}>
        <select
          ref={setInputRef}
          value={editVal}
          onChange={e => { setEditVal(e.target.value); commitEdit(o, 'contratoItem', e.target.value) }}
          onKeyDown={e => { if (e.key === 'Escape') setEditCell(null) }}
          className="w-full border border-blue-400 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">— sem vínculo —</option>
          {faturamentoContratos.map(c => (
            <option key={c.item} value={c.item}>{c.contrato} ({c.estado})</option>
          ))}
        </select>
      </td>
    )
  }

  return (
    <td
      className={`${className} ${isAdmin ? 'group/cell cursor-pointer select-none' : ''} relative`}
      onClick={() => isAdmin && startEdit(o.id, 'contratoItem', o.contratoItem ?? '')}
      title={isAdmin ? 'Clique para vincular contrato' : undefined}
    >
      <div className="flex items-center gap-1">
        {contrato
          ? <span className="text-xs text-blue-700 font-medium truncate max-w-[120px]" title={contrato.contrato}>{contrato.contrato}</span>
          : <span className="text-gray-300 text-xs">—</span>
        }
      </div>
    </td>
  )
}

const STATUS_COLORS: Record<StatusObra, { bg: string; text: string; border: string }> = {
  'A Iniciar':  { bg: '#fffbeb', text: '#d97706', border: '#fcd34d' },
  'Execução':   { bg: '#eff6ff', text: '#2563eb', border: '#93c5fd' },
  'Concluída':  { bg: '#f0fdf4', text: '#16a34a', border: '#86efac' },
  'Paralisada': { bg: '#f9fafb', text: '#6b7280', border: '#d1d5db' },
}

const IDP_COLORS: Record<StatusIDP, { bg: string; text: string }> = {
  'ATINGIDO':      { bg: '#f0fdf4', text: '#16a34a' },
  'NÃO ATINGIDO':  { bg: '#fef2f2', text: '#dc2626' },
  '—':             { bg: '#f9fafb', text: '#9ca3af' },
}

const REGIOES: Regiao[]      = ['Norte', 'Sul', 'Metropolitana', 'Centro-Oeste', 'Leste']
const STATUSES: StatusObra[] = ['A Iniciar', 'Execução', 'Concluída', 'Paralisada']
const _PRIORIDADES: Prioridade[] = ['Alta', 'Média', 'Baixa']; void _PRIORIDADES
const TIPOS = ['Própria', 'Terceirizada']
const TIPOS_SERVICO = ['Reforma', 'Construção Nova', 'Ampliação', 'Adequação Estrutural', 'Reforma e Ampliação', 'Manutenção']

const fmtDate = (d: string) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—'

const fmtBRL = (v: number) =>
  v != null && v !== 0
    ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
    : '—'

const fmtPct = (v: number) =>
  v != null ? `${v.toFixed(2).replace('.', ',')}%` : '—'

// ── Cálculos automáticos de prazo ──────────────────────────────────────────
const diffDays = (a: string, b: string): number => {
  const da = new Date(a + 'T00:00:00')
  const db = new Date(b + 'T00:00:00')
  return Math.round((db.getTime() - da.getTime()) / 86_400_000)
}

const TODAY = new Date().toISOString().split('T')[0]

function calcPrazo(o: Obra) {
  // Tempo previsto: conclusão prevista - início
  const tempoPrevisto =
    o.dataInicio && o.conclusaoPrevista
      ? diffDays(o.dataInicio, o.conclusaoPrevista)
      : null

  // Tempo atual: hoje - início (ou data real se concluída)
  const fimParaAtual =
    o.status === 'Concluída' && o.dataRealConclusao
      ? o.dataRealConclusao
      : TODAY
  const tempoAtual =
    o.dataInicio ? diffDays(o.dataInicio, fimParaAtual) : null

  // Velocidade planejada = 100 / T.Prev  (%/dia)  ex: 100/305 = 0,33%/dia
  const velPlanej =
    tempoPrevisto && tempoPrevisto > 0 ? 100 / tempoPrevisto : null

  // Velocidade real = Avanço% / T.Atual  (%/dia)  ex: 62/828 = 0,075%/dia
  const velReal =
    tempoAtual && tempoAtual > 0 ? o.avancoPct / tempoAtual : null

  // IDP = (Vel.Real / Vel.Plan.) * 100
  const idp =
    velReal != null && velPlanej != null && velPlanej > 0
      ? (velReal / velPlanej) * 100
      : null

  const statusIdp: StatusIDP =
    idp == null ? '—' : idp >= 90 ? 'ATINGIDO' : 'NÃO ATINGIDO'

  return { tempoPrevisto, tempoAtual, velPlanej, velReal, idp, statusIdp }
}

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']

interface ObraForm {
  engenharia: string
  tipo: string
  engenheiro: string
  orgao: string
  municipio: string
  regiao: Regiao
  localidade: string
  servico: string
  tipoServico: string
  dataOS: string
  ordemServico: string
  numeroObra: string
  dataInicio: string
  conclusaoPrevista: string
  dataRealConclusao: string
  status: StatusObra
  prioridade: Prioridade
  ano: number
  executivo: number
  venda: number
  avancoPct: number
  avancoReais: number
  realizado: number
  comprometido: number
  valorMedido: number
  saldo: number
  proximaMedicao: number
  dataMedicao: string
  tempoPrevisto: number
  tempoAtual: number
  velocidadePlanej: number
  velocidadeReal: number
  idp: number
  statusIdp: StatusIDP
  contratoItem?: string
}

const EMPTY_FORM: ObraForm = {
  engenharia: 'ES',
  tipo: 'Própria',
  engenheiro: engenheiros[0]?.nome ?? '',
  orgao: 'SESA',
  municipio: '',
  regiao: 'Metropolitana',
  localidade: '',
  servico: '',
  tipoServico: 'Reforma',
  dataOS: '',
  ordemServico: '',
  numeroObra: '',
  dataInicio: '',
  conclusaoPrevista: '',
  dataRealConclusao: '',
  status: 'A Iniciar',
  prioridade: 'Média',
  ano: new Date().getFullYear(),
  executivo: 0, venda: 0,
  avancoPct: 0, avancoReais: 0,
  realizado: 0, comprometido: 0, valorMedido: 0,
  saldo: 0, proximaMedicao: 0, dataMedicao: '',
  tempoPrevisto: 0, tempoAtual: 0,
  velocidadePlanej: 0, velocidadeReal: 0, idp: 0,
  statusIdp: '—',
  contratoItem: '',
}


type ModalMode = 'edit' | 'add'

// Grupos de colunas visíveis (toggle)
type ColGroup = 'financeiro' | 'prazo'

// ── Detecção automática de contrato por órgão + estado ────────────────────
// Normaliza string: remove acentos, minúsculas, colapsa espaços
function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
}

function autoDetectContrato(o: Obra): string {
  const org = norm(o.orgao ?? '')
  const uf  = norm(o.engenharia ?? '')
  const loc = norm(o.localidade ?? '')
  const mun = norm(o.municipio ?? '')

  // Maranhão
  if (org.includes('SEGOV'))                                         return '3.0'
  if (org.includes('QUALITECH') && (loc.includes('PADRE DELFINO') || mun.includes('TIMON'))) return '21.0'
  if (org.includes('QUALITECH') && (loc.includes('SAO F') || mun.includes('SAO F')))         return '22.0'
  if (org.includes('QUALITECH'))                                     return '21.0'
  if (org.includes('AGEMLESTE'))                                     return '27.0'
  if (org.includes('AGEMSUL'))                                       return '26.0'
  if (org.includes('SINFRA') && (loc.includes('PADRE DELFINO') || mun.includes('TIMON')))   return '21.0'
  if (org.includes('SINFRA') && (loc.includes('SAO F') || mun.includes('SAO F')))            return '22.0'
  if (org.includes('SINFRA') && mun.includes('IMPERATRIZ'))         return '24.0'
  if (org.includes('SINFRA'))                                        return '25.0'

  // Piauí — SESAPI / SECRETARIA DE ESTADO DA SAUDE
  if (org.includes('SESAPI') || (uf === 'PI' && org.includes('SAUDE') && org.includes('ESTADO'))) return '2.0'

  // Piauí — SEDUC / SECRETARIA DE ESTADO DA EDUCAÇÃO
  if (org.includes('SEDUC') || (uf === 'PI' && org.includes('EDUCACAO') && org.includes('ESTADO'))) return '4.0'

  // Piauí — SEDEC
  if (org.includes('SEDEC'))                                         return '15.0'

  // Piauí — CDTER
  if (org.includes('CDTER'))                                         return '17.0'

  // Piauí — FUESPI / UESPI
  if (org.includes('FUESPI') || org.includes('UESPI'))              return '11.0'

  // Piauí — COOPANESTI
  if (org.includes('COOPANEST'))                                     return '13.0'

  // Piauí — Pedro II iluminação pública
  if ((org.includes('PEDRO II') || mun.includes('PEDRO II')) && (org.includes('ILUMINA') || loc.includes('ILUMINA'))) return '28.0'

  // Piauí — Pedro II escola em tempo integral
  if ((org.includes('PEDRO II') || mun.includes('PEDRO II')) && loc.includes('TEMPO INTEGRAL')) return '8.0'

  // Piauí — Pedro II gerenciamento
  if (org.includes('PEDRO II') || (uf === 'PI' && mun.includes('PEDRO II') && org.includes('PREFEITURA'))) return '1.0'

  // Piauí — Piripiri
  if (org.includes('PIRIPIRI') || (uf === 'PI' && mun.includes('PIRIPIRI') && org.includes('PREFEITURA'))) return '19.0'

  // Piauí — Joaquim Pires
  if (org.includes('JOAQUIM PIRES') || org.includes('PREF') && mun.includes('JOAQUIM PIRES')) return '23.0'

  // Piauí — Lagoa de São Francisco
  if (org.includes('LSF') || mun.includes('LAGOA DE SAO FRANCISCO') || org.includes('LAGOA DE SAO')) return '14.0'

  // Piauí — Ilha Grande
  if (uf === 'PI' && mun.includes('ILHA GRANDE'))                   return '5.0'

  // Piauí — Elesbão Veloso
  if (uf === 'PI' && mun.includes('ELESBAO VELOSO'))                return '10.0'

  // Piauí — Elesbão Veloso creche especificamente
  if (uf === 'PI' && (loc.includes('VOVO EMILIA') || loc.includes('CRECHE') && mun.includes('ELESBAO'))) return '10.0'

  // Distrito Federal — FJZB / Zoológico
  if (org.includes('FJZB') || org.includes('ZOOLOGICO') || org.includes('ZOO')) return '7.0'

  // Pará — IGEPPS
  if (org.includes('IGEPPS'))                                        return '9.0'

  // Acre — SEMSA
  if (org.includes('SEMSA'))                                         return '16.0'

  // Espírito Santo — SESA
  if (uf === 'ES' && org.includes('SESA'))                          return '12.0'

  // Roraima — SMEC
  if (org.includes('SMEC'))                                          return '18.0'

  // Mato Grosso — IPEM
  if (uf === 'MT' && org.includes('IPEM'))                          return '6.0'

  // Fallback: se só tem um contrato para o estado, usa ele
  const contratosPorEstado: Record<string, string> = {
    'AC': '16.0', 'RR': '18.0', 'ES': '12.0',
  }
  if (contratosPorEstado[uf]) return contratosPorEstado[uf]

  return ''
}

// ── Modal de vinculação em massa com drag-to-fill ─────────────────────────
function VincularModal({
  obras, vincMap, setVincMap, onClose, onSave,
}: {
  obras: Obra[]
  vincMap: Record<string, string>
  setVincMap: React.Dispatch<React.SetStateAction<Record<string, string>>>
  onClose: () => void
  onSave: () => void
}) {
  // drag state: qual linha está sendo arrastada (índice) e valor a replicar
  const dragRef = useRef<{ fromIdx: number; value: string } | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  const handleDragStart = (idx: number, value: string) => {
    dragRef.current = { fromIdx: idx, value }
  }

  const handleDragEnter = (idx: number) => {
    if (!dragRef.current) return
    setDragOver(idx)
    // preenche do índice de origem até o atual
    const { fromIdx, value } = dragRef.current
    const start = Math.min(fromIdx, idx)
    const end   = Math.max(fromIdx, idx)
    setVincMap(prev => {
      const next = { ...prev }
      for (let i = start; i <= end; i++) next[obras[i].id] = value
      return next
    })
  }

  const handleDragEnd = () => {
    dragRef.current = null
    setDragOver(null)
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onMouseUp={handleDragEnd}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900">Vincular Obras a Contratos</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Selecione um contrato e <span className="font-semibold text-blue-600">arraste o ⠿ para baixo</span> para replicar
            </p>
          </div>
          <button
            onClick={() => {
              const next: Record<string, string> = { ...vincMap }
              obras.forEach(o => {
                const detected = autoDetectContrato(o)
                if (detected) next[o.id] = detected
              })
              setVincMap(next)
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 mr-2 text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors"
            title="Preencher automaticamente pelo órgão da obra"
          >
            🤖 Auto-detectar
          </button>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4" onMouseLeave={handleDragEnd}>
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b border-gray-200">
                <th className="pb-2 text-left text-xs font-semibold text-gray-500 uppercase w-6" />
                <th className="pb-2 text-left text-xs font-semibold text-gray-500 uppercase">Obra</th>
                <th className="pb-2 text-left text-xs font-semibold text-gray-500 uppercase w-10">UF</th>
                <th className="pb-2 text-left text-xs font-semibold text-gray-500 uppercase">Contrato vinculado</th>
              </tr>
            </thead>
            <tbody>
              {obras.map((o, idx) => {
                const isDragging = dragRef.current !== null
                const isHighlighted = dragOver !== null && dragRef.current !== null &&
                  idx >= Math.min(dragRef.current.fromIdx, dragOver) &&
                  idx <= Math.max(dragRef.current.fromIdx, dragOver)
                return (
                  <tr
                    key={o.id}
                    className={`border-b border-gray-50 transition-colors ${isHighlighted ? 'bg-blue-50' : 'hover:bg-gray-50/60'}`}
                    onMouseEnter={() => isDragging && handleDragEnter(idx)}
                  >
                    {/* Handle de arrasto */}
                    <td className="py-2 pr-1 w-6">
                      <div
                        className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-blue-500 select-none flex items-center justify-center h-full transition-colors"
                        title="Arraste para preencher as linhas abaixo"
                        onMouseDown={() => handleDragStart(idx, vincMap[o.id] ?? '')}
                      >
                        ⠿
                      </div>
                    </td>
                    <td className="py-2 pr-3">
                      <div className="font-medium text-gray-800 text-xs truncate max-w-[220px]" title={o.localidade}>{o.localidade}</div>
                      <div className="text-[10px] text-gray-400">{o.orgao} · {o.municipio}</div>
                    </td>
                    <td className="py-2 pr-3">
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded font-mono">
                        {o.engenharia}
                      </span>
                    </td>
                    <td className="py-2">
                      <select
                        value={vincMap[o.id] ?? ''}
                        onChange={e => {
                          const val = e.target.value
                          setVincMap(prev => ({ ...prev, [o.id]: val }))
                          // se estava arrastando, atualiza a origem
                          if (dragRef.current?.fromIdx === idx) dragRef.current.value = val
                        }}
                        className={`w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white transition-colors ${isHighlighted ? 'border-blue-400 ring-1 ring-blue-300' : 'border-gray-300'}`}
                      >
                        <option value="">— sem vínculo —</option>
                        {faturamentoContratos.map(c => (
                          <option key={c.item} value={c.item}>{c.contrato} ({c.estado})</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400">
            {Object.values(vincMap).filter(Boolean).length} de {obras.length} obras vinculadas
          </p>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button onClick={onSave}
              className="px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2">
              <Save size={14} /> Salvar vínculos
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TabelaDetalhada() {
  const { isAdmin, user } = useAuth()
  const { obras, updateObra, addObra, deleteObra, snapshots, createSnapshot, deleteSnapshot } = useObras()
  const { solicitarAprovacao, aprovacoes } = useAprovacoes()
  const { getAnexosObra } = useAnexos()

  // Modais de histórico e anexos
  const [historicoObra, setHistoricoObra]     = useState<Obra | null>(null)
  const [medicoesObra, setMedicoesObra]       = useState<Obra | null>(null)
  const [anexosObra, setAnexosObra]           = useState<Obra | null>(null)

  // Edição inline
  const [editCell, setEditCell] = useState<{ obraId: string; campo: string } | null>(null)
  const [editVal, setEditVal]   = useState<string>('')
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null)
  // Ref callback estável: não causa detach/reattach do DOM a cada render
  const setInputRef = useCallback((r: HTMLInputElement | HTMLSelectElement | null) => {
    inputRef.current = r
  }, [])

  // Modal de confirmação para campos restritos
  const [aprovModal, setAprovModal] = useState<{
    obraId: string; obraLabel: string; campo: CampoRestrito
    valorAtual: string | number; valorNovo: string | number
  } | null>(null)
  const [justificativa, setJustificativa] = useState('')

  useEffect(() => {
    if (editCell) (inputRef.current as HTMLElement | null)?.focus()
  }, [editCell])

  const startEdit = useCallback((obraId: string, campo: string, valor: string | number) => {
    if (!isAdmin) return
    setEditCell({ obraId, campo })
    setEditVal(String(valor ?? ''))
  }, [isAdmin])

  // val vem diretamente do evento DOM (e.target.value), nunca fica stale
  const commitEdit = useCallback((o: Obra, campo: string, val: string) => {
    setEditCell(null)
    const valorAtual = (o as any)[campo]
    const NUMERICOS = ['executivo', 'venda', 'avancoPct', 'realizado', 'comprometido', 'valorMedido', 'proximaMedicao']
    const valorNovo = NUMERICOS.includes(campo) ? Number(val) : val

    if (String(valorNovo) === String(valorAtual)) return   // sem mudança

    // Se status mudou para Concluída, salva o status e abre o campo de data inline
    if (campo === 'status' && valorNovo === 'Concluída' && !o.dataRealConclusao) {
      updateObra(o.id, { status: 'Concluída' } as Partial<Obra>)
      // Abre o campo "CONCLUSÃO REAL" para edição inline após fechar o select atual
      setTimeout(() => {
        setEditCell({ obraId: o.id, campo: 'dataRealConclusao' })
        setEditVal('')
      }, 0)
      return
    }

    if (CAMPOS_RESTRITOS.includes(campo as CampoRestrito)) {
      setAprovModal({
        obraId: o.id,
        obraLabel: o.localidade,
        campo: campo as CampoRestrito,
        valorAtual,
        valorNovo,
      })
    } else {
      updateObra(o.id, { [campo]: valorNovo } as Partial<Obra>)
    }
  }, [updateObra])

  const confirmarSolicitacao = () => {
    if (!aprovModal || !user) return
    solicitarAprovacao(
      aprovModal.obraId,
      aprovModal.obraLabel,
      aprovModal.campo,
      aprovModal.valorAtual,
      aprovModal.valorNovo,
      user.name,
      justificativa.trim()
    )
    setAprovModal(null)
    setJustificativa('')
  }

  // Verifica se há aprovação pendente para um campo/obra
  const temPendente = (obraId: string, campo: string) =>
    aprovacoes.some(a => a.obraId === obraId && a.campo === campo && a.status === 'pendente')

  const fmtVal = (campo: string, val: string | number) => {
    if (campo === 'conclusaoPrevista') return val ? new Date(String(val) + 'T00:00:00').toLocaleDateString('pt-BR') : '—'
    return typeof val === 'number'
      ? val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
      : String(val)
  }

  const [filtroStatus, setFiltroStatus]   = useState<string[]>([])
  const [filtroEng, setFiltroEng]         = useState<string[]>([])
  const [filtroEstados, setFiltroEstados] = useState<string[]>([])
  const [filtroRegiao, setFiltroRegiao]   = useState<string[]>([])
  const [filtroIdp, setFiltroIdp]         = useState<string[]>([])
  const [filtroVenda, setFiltroVenda]     = useState<string[]>([])
  const [busca, setBusca]               = useState('')
  const [filtroDataDe, setFiltroDataDe] = useState('')
  const [filtroDataAte, setFiltroDataAte] = useState('')
  const [snapshotId, setSnapshotId]     = useState('')   // '' = dados atuais

  const [visibleGroups, setVisibleGroups] = useState<Record<ColGroup, boolean>>({
    financeiro: true,
    prazo: true,
  })

  const toggleGroup = (g: ColGroup) =>
    setVisibleGroups(prev => ({ ...prev, [g]: !prev[g] }))

  const [modalMode, setModalMode]         = useState<ModalMode>('edit')
  const [editingId, setEditingId]         = useState<string | null>(null)
  const [form, setForm]                   = useState<ObraForm | null>(null)
  const [saved, setSaved]                 = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [vincularModal, setVincularModal] = useState(false)
  const [vincMap, setVincMap]             = useState<Record<string, string>>({}) // obraId Ç' contratoItem

  // Seleção múltipla (state; helpers calculados após filtradas)
  const [selecionadas, setSelecionadas]             = useState<Set<string>>(new Set())
  const [confirmDeleteMulti, setConfirmDeleteMulti] = useState(false)

  const toggleSelecionada = (id: string) =>
    setSelecionadas(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const excluirSelecionadas = () => {
    selecionadas.forEach(id => deleteObra(id))
    setSelecionadas(new Set())
    setConfirmDeleteMulti(false)
  }

  // Fonte de dados: snapshot selecionado ou obras atuais
  const fonteObras = useMemo(() => {
    if (!snapshotId) return obras
    return snapshots.find(s => s.id === snapshotId)?.obras ?? obras
  }, [obras, snapshots, snapshotId])

  // Lista de engenheiros disponíveis (para select inline)
  const engNomes = useMemo(() =>
    [...new Set(fonteObras.map(o => o.engenheiro).filter(Boolean))].sort()
  , [fonteObras])

  const filtradas = useMemo(() => {
    const faixaVenda = (venda: number) => {
      if (filtroVenda.length === 0) return true
      return filtroVenda.some(f => {
        if (f === 'ate1m')   return venda <= 1_000_000
        if (f === '1m-2m')   return venda > 1_000_000 && venda <= 2_000_000
        if (f === '2m-3m')   return venda > 2_000_000 && venda <= 3_000_000
        if (f === 'acima3m') return venda > 3_000_000
        return false
      })
    }
    const dentroIntervalo = (o: Obra) => {
      if (!filtroDataDe && !filtroDataAte) return true
      const inicio  = o.dataInicio || ''
      const prevFim = o.conclusaoPrevista || ''
      const realFim = o.dataRealConclusao || ''
      const fim = realFim || prevFim
      if (filtroDataDe && filtroDataAte) {
        if (inicio && inicio > filtroDataAte) return false
        if (fim    && fim    < filtroDataDe)  return false
        return true
      }
      if (filtroDataDe) return !fim || fim >= filtroDataDe
      if (filtroDataAte) return !inicio || inicio <= filtroDataAte
      return true
    }
    return fonteObras.filter(o =>
      (filtroStatus.length === 0  || filtroStatus.includes(o.status)) &&
      (filtroEng.length === 0     || filtroEng.includes(o.engenheiro)) &&
      (filtroEstados.length === 0 || filtroEstados.includes(o.engenharia)) &&
      (filtroRegiao.length === 0 || filtroRegiao.includes(o.regiao)) &&
      (filtroIdp.length === 0    || filtroIdp.includes(o.statusIdp)) &&
      faixaVenda(o.venda) &&
      dentroIntervalo(o) &&
      (!busca ||
        o.localidade.toLowerCase().includes(busca.toLowerCase()) ||
        o.municipio.toLowerCase().includes(busca.toLowerCase()) ||
        o.ordemServico.toLowerCase().includes(busca.toLowerCase()) ||
        o.orgao?.toLowerCase().includes(busca.toLowerCase()) ||
        o.servico?.toLowerCase().includes(busca.toLowerCase()))
    )
  }, [fonteObras, filtroStatus, filtroEng, filtroEstados, filtroRegiao, filtroIdp, filtroVenda, filtroDataDe, filtroDataAte, busca])

  // Derivados de seleção (dependem de filtradas)
  const todasSelecionadas   = filtradas.length > 0 && filtradas.every(o => selecionadas.has(o.id))
  const algumasSelecionadas = !todasSelecionadas && filtradas.some(o => selecionadas.has(o.id))
  const toggleTodas = () => {
    if (todasSelecionadas) setSelecionadas(prev => { const s = new Set(prev); filtradas.forEach(o => s.delete(o.id)); return s })
    else setSelecionadas(prev => { const s = new Set(prev); filtradas.forEach(o => s.add(o.id)); return s })
  }

  const openAdd   = ()        => { setModalMode('add');  setEditingId(null); setForm({ ...EMPTY_FORM }); setSaved(false) }
  const closeModal = ()       => { setEditingId(null); setForm(null) }

  const handleSave = () => {
    if (!form) return
    if (modalMode === 'edit' && editingId) { updateObra(editingId, form); setSaved(true); setTimeout(closeModal, 700) }
    else if (modalMode === 'add')          { addObra(form);               setSaved(true); setTimeout(closeModal, 700) }
  }

  const handleDelete = (id: string) => { deleteObra(id); setConfirmDelete(null) }

  const set = <K extends keyof ObraForm>(key: K, value: ObraForm[K]) =>
    setForm(prev => prev ? { ...prev, [key]: value } : prev)

  const exportCSV = () => {
    const headers = [
      'TIPO','ENG. RESP.','ÓRGÃO','CONTRATO','CIDADE','OBRA','CÓD.','STATUS',
      'INÍCIO','DATA PREV. CONCLUSÃO','DATA REAL CONCLUSÃO',
      'EXECUTIVO (R$)','VENDA (R$)','AVANÇO %','AVANÇO R$',
      'REALIZADO','COMPROMETIDO','VALOR MEDIDO','SALDO',
      'PRÓXIMA MED.','DATA MED.',
      'TEMPO PREV. (DIAS)','TEMPO ATUAL (DIAS)',
      'VELOC. PLANEJ. (%/DIA)','VELOC. REAL (%/DIA)',
      'IDP (%)','STATUS IDP',
    ]
    const rows = filtradas.map(o => [
      o.tipo, o.engenheiro, o.orgao,
      faturamentoContratos.find(c => c.item === o.contratoItem)?.contrato ?? '',
      o.municipio, o.localidade, o.ordemServico, o.status,
      fmtDate(o.dataInicio), fmtDate(o.conclusaoPrevista), fmtDate(o.dataRealConclusao),
      o.executivo, o.venda, o.avancoPct, o.avancoReais,
      o.realizado, o.comprometido, o.valorMedido, o.saldo,
      o.proximaMedicao, fmtDate(o.dataMedicao),
      o.tempoPrevisto, o.tempoAtual,
      o.velocidadePlanej, o.velocidadeReal,
      o.idp, o.statusIdp,
    ])
    const csv = [headers, ...rows].map(r => r.join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'obras_pavcon.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  // Quando um snapshot histórico está ativo, desabilitar edição inline
  const isEditingEnabled = isAdmin && !snapshotId

  const inputCls  = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const numCls    = inputCls + ' text-right'
  const labelCls  = 'block text-xs font-medium text-gray-500 mb-1'

  const groupToggle = (group: ColGroup, label: string) => (
    <button
      key={group}
      onClick={() => toggleGroup(group)}
      className="flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg border border-blue-200 transition-colors"
    >
      {visibleGroups[group] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      {label}
    </button>
  )

  // Contexto estabilizado: só muda quando mudam editCell/editVal ou callbacks estáveis
  // Assim os EditableCells em modo exibição NÃO rerenderizam a cada keystroke
  const editCtxValue = useMemo<EditCtx>(() => ({
    editCell, editVal, setEditVal, setInputRef, commitEdit, setEditCell, startEdit,
    isAdmin: isEditingEnabled,
    temPendente,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [editCell, editVal, commitEdit, startEdit, isEditingEnabled, temPendente, setInputRef])

  return (
  <EditContext.Provider value={editCtxValue}>
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tabela Detalhada</h1>
          <p className="text-gray-500 text-sm mt-0.5">Acompanhamento completo de obras — formato planilha</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isEditingEnabled && selecionadas.size > 0 && (
            <button onClick={() => setConfirmDeleteMulti(true)}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
              <Trash2 size={15} /> Excluir {selecionadas.size} selecionada(s)
            </button>
          )}
          {isAdmin && (
            <button onClick={() => createSnapshot()}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              title="Salva uma fotografia do estado atual para consulta histórica">
              <Save size={15} /> Salvar estado
            </button>
          )}
          {isEditingEnabled && (
            <button
              onClick={() => {
                // Aplica auto-detecção direto em todas as obras, sem abrir modal
                obras.forEach(o => {
                  const detected = autoDetectContrato(o)
                  if (detected && detected !== (o.contratoItem ?? '')) {
                    updateObra(o.id, { contratoItem: detected })
                  }
                })
              }}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              title="Detectar e preencher contratos automaticamente pelo órgão"
            >
              🤖 Preencher Contratos
            </button>
          )}
          {isEditingEnabled && (
            <button
              onClick={() => {
                const init: Record<string, string> = {}
                obras.forEach(o => {
                  init[o.id] = o.contratoItem || autoDetectContrato(o)
                })
                setVincMap(init)
                setVincularModal(true)
              }}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              🔗 Vincular Contratos
            </button>
          )}
          {isEditingEnabled && (
            <button onClick={openAdd}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              <Plus size={15} /> Nova Obra
            </button>
          )}
          <button onClick={exportCSV}
            className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Download size={15} /> Exportar CSV
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-wrap gap-2 items-center">
        <input
          placeholder="Buscar obra, cidade, órgão..."
          value={busca} onChange={e => setBusca(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-56"
        />
        <MultiSelect
          placeholder="Todos os status"
          opcoes={STATUSES.map(s => ({ value: s, label: s }))}
          selecionadas={filtroStatus}
          onChange={setFiltroStatus}
        />
        <MultiSelect
          placeholder="Todos os engenheiros"
          opcoes={[...new Set(fonteObras.map(o => o.engenheiro).filter(Boolean))].sort().map(e => ({ value: e, label: e }))}
          selecionadas={filtroEng}
          onChange={setFiltroEng}
        />
        <MultiSelect
          placeholder="Todas as engenharias"
          opcoes={[...new Set(fonteObras.map(o => o.engenharia).filter(Boolean))].sort().map(uf => ({ value: uf, label: uf }))}
          selecionadas={filtroEstados}
          onChange={setFiltroEstados}
          mono
        />
        <MultiSelect
          placeholder="Todas as regiões"
          opcoes={REGIOES.map(r => ({ value: r, label: r }))}
          selecionadas={filtroRegiao}
          onChange={setFiltroRegiao}
        />
        <MultiSelect
          placeholder="IDP (todos)"
          opcoes={[
            { value: 'ATINGIDO', label: 'ATINGIDO' },
            { value: 'NÃO ATINGIDO', label: 'NÃO ATINGIDO' },
          ]}
          selecionadas={filtroIdp}
          onChange={setFiltroIdp}
        />
        <MultiSelect
          placeholder="Venda (todas)"
          opcoes={[
            { value: 'ate1m',   label: 'Até R$ 1M' },
            { value: '1m-2m',   label: 'R$ 1M — R$ 2M' },
            { value: '2m-3m',   label: 'R$ 2M — R$ 3M' },
            { value: 'acima3m', label: 'Acima de R$ 3M' },
          ]}
          selecionadas={filtroVenda}
          onChange={setFiltroVenda}
        />

        {/* Intervalo de datas */}
        <div className="flex items-center gap-1.5 border-l border-gray-200 pl-2">
          <span className="text-xs text-gray-400 whitespace-nowrap">De:</span>
          <input type="date" value={filtroDataDe} onChange={e => setFiltroDataDe(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
          <span className="text-xs text-gray-400">Até:</span>
          <input type="date" value={filtroDataAte} onChange={e => setFiltroDataAte(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
          {(filtroDataDe || filtroDataAte) && (
            <button onClick={() => { setFiltroDataDe(''); setFiltroDataAte('') }}
              className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
          )}
        </div>

        {/* Histórico / Snapshots */}
        {snapshots.length > 0 && (
          <div className="flex items-center gap-1.5 border-l border-gray-200 pl-2">
            <span className="text-xs text-gray-400 whitespace-nowrap">Histórico:</span>
            <select value={snapshotId} onChange={e => setSnapshotId(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm max-w-[200px]">
              <option value="">Dados atuais</option>
              {snapshots.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            {snapshotId && isAdmin && (
              <button onClick={() => { deleteSnapshot(snapshotId); setSnapshotId('') }}
                className="text-red-400 hover:text-red-600" title="Excluir este snapshot">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}

        {/* Toggles de grupo de colunas */}
        <div className="flex items-center gap-1.5 ml-auto border-l border-gray-200 pl-3">
          <span className="text-xs text-gray-400 mr-1">Colunas:</span>
          {groupToggle('financeiro', 'Financeiro')}
          {groupToggle('prazo', 'Prazo')}
        </div>

        <span className="text-sm text-gray-400 border-l border-gray-200 pl-3">
          {filtradas.length} obra(s)
        </span>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-260px)]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              {/* Linha de grupo */}
              <tr className="bg-[#0f2557] text-white">
                {isEditingEnabled && <th className="w-8" />}
                {isEditingEnabled && <th className="w-12" />}
                {/* Obra: ENGENHARIA Ç' CONCLUSÃO REAL */}
                <th colSpan={12} className="px-2 py-1.5 text-left font-bold tracking-wider border-r border-white/20 uppercase text-[11px]">
                  ▸ Obra
                </th>
                {visibleGroups.financeiro && (
                  <th colSpan={10} className="px-2 py-1.5 text-center font-bold tracking-wider border-r border-white/20 uppercase text-[11px]" style={{ background: 'rgba(245,146,29,0.15)' }}>
                    💰 Financeiro
                  </th>
                )}
                {visibleGroups.prazo && (
                  <th colSpan={6} className="px-2 py-1.5 text-center font-bold tracking-wider uppercase text-[11px]" style={{ background: 'rgba(99,102,241,0.15)' }}>
                    ⏱ Prazo / IDP
                  </th>
                )}
                <th className="w-16" />
              </tr>

              {/* Linha de coluna */}
              <tr className="bg-gray-50 border-b-2 border-gray-200">
                {isEditingEnabled && (
                  <th className="w-8 px-2 py-2 text-center">
                    <input type="checkbox"
                      checked={todasSelecionadas}
                      ref={el => { if (el) el.indeterminate = algumasSelecionadas }}
                      onChange={toggleTodas}
                      className="w-3.5 h-3.5 rounded accent-orange-400 cursor-pointer" />
                  </th>
                )}
                {isEditingEnabled && <th className="w-12 px-2 py-1" />}
                {/* Colunas base */}
                {[
                  'ENGENHARIA', 'CÓD.', 'TIPO', 'ENG. RESP.', 'ÓRGÃO', 'CONTRATO', 'CIDADE', 'OBRA', 'STATUS',
                ].map(h => (
                  <th key={h} className="px-2 py-1.5 text-left font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap border-r border-gray-200">
                    {h}
                  </th>
                ))}

                {/* Datas — parte do grupo Obra */}
                {['INÍCIO PREV.', 'CONCLUSÃO PREV.', 'CONCLUSÃO REAL'].map(h => (
                  <th key={h} className="px-2 py-1.5 text-left font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap border-r border-gray-200">
                    {h}
                  </th>
                ))}

                {/* Financeiro */}
                {visibleGroups.financeiro && [
                  { h: 'EXECUTIVO', sienge: false },
                  { h: 'VENDA', sienge: false },
                  { h: 'AVANÇO %', sienge: false },
                  { h: 'AVANÇO R$', sienge: false },
                  { h: 'REALIZADO', sienge: true },
                  { h: 'COMPROMETIDO', sienge: true },
                  { h: 'VL. MEDIDO', sienge: false },
                  { h: 'SALDO', sienge: false },
                  { h: 'PRÓX. MED. R$', sienge: false },
                  { h: 'DATA MED.', sienge: false },
                ].map(({ h, sienge }) => (
                  <th key={h} className="px-2 py-1.5 text-right font-semibold text-amber-700 uppercase tracking-wide whitespace-nowrap border-r border-amber-100" style={{ background: '#fffbf0' }}>
                    <div className="flex items-center justify-end gap-1">
                      {sienge && <span className="text-[8px] font-bold text-teal-600 bg-teal-50 border border-teal-200 px-1 rounded leading-tight normal-case">SIENGE</span>}
                      {h}
                    </div>
                  </th>
                ))}

                {/* Prazo */}
                {visibleGroups.prazo && [
                  'T. PREV.(D)', 'T. ATUAL(D)', 'VEL. PLAN. (%/dia)', 'VEL. REAL (%/dia)', 'IDP %', 'STATUS IDP',
                ].map(h => (
                  <th key={h} className="px-2 py-1.5 text-center font-semibold text-indigo-700 uppercase tracking-wide whitespace-nowrap border-r border-indigo-100" style={{ background: '#f5f3ff' }}>
                    {h}
                  </th>
                ))}
                <th className="px-2 py-1.5 text-center font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap w-16">
                  Ações
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {filtradas.map((o, idx) => {
                const sc = STATUS_COLORS[o.status]
                const { tempoPrevisto, tempoAtual, velPlanej, velReal, idp, statusIdp } = calcPrazo(o)
                const ic = IDP_COLORS[statusIdp]
                const rowBg = idx % 2 === 0 ? 'white' : '#f8fafc'
                return (
                  <tr key={o.id}
                    className={`group transition-colors ${selecionadas.has(o.id) ? 'bg-blue-50' : 'hover:bg-blue-50/40'}`}
                    style={selecionadas.has(o.id) ? undefined : { background: rowBg }}>
                    {isEditingEnabled && (
                      <td className="px-2 py-2 text-center whitespace-nowrap">
                        <input type="checkbox"
                          checked={selecionadas.has(o.id)}
                          onChange={() => toggleSelecionada(o.id)}
                          className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer" />
                      </td>
                    )}
                    {isEditingEnabled && (
                      <td className="px-2 py-2 whitespace-nowrap">
                        <div className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => setConfirmDelete(o.id)} title="Excluir obra"
                            className="p-1.5 rounded text-gray-300 hover:text-red-600 hover:bg-red-50 transition-colors">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    )}

                    {/* ENGENHARIA */}
                    <EditableCell o={o} campo="engenharia" className="px-2 py-1 whitespace-nowrap border-r border-gray-100"
                      options={UFS}>
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200 font-mono">
                        {o.engenharia || '—'}
                      </span>
                    </EditableCell>
                    {/* CÓD. */}
                    <td className="px-2 py-1 font-mono font-bold text-blue-800 whitespace-nowrap border-r border-gray-100">{o.ordemServico}</td>
                    {/* TIPO */}
                    <td className="px-2 py-1 whitespace-nowrap border-r border-gray-100">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${o.tipo === 'Própria' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                        {o.tipo}
                      </span>
                    </td>
                    {/* ENG. RESP. — editável */}
                    <EditableCell o={o} campo="engenheiro" className="px-2 py-1 font-medium text-gray-800 whitespace-nowrap border-r border-gray-100"
                      options={engNomes}>
                      {o.engenheiro}
                    </EditableCell>
                    {/* ÓRGÃO — editável */}
                    <EditableCell o={o} campo="orgao" className="px-2 py-1 text-gray-600 whitespace-nowrap border-r border-gray-100">
                      {o.orgao}
                    </EditableCell>
                    {/* CONTRATO — editável */}
                    <ContratoCell o={o} className="px-2 py-1 border-r border-gray-100 max-w-[140px]" />
                    {/* CIDADE — editável */}
                    <EditableCell o={o} campo="municipio" className="px-2 py-1 text-gray-600 whitespace-nowrap border-r border-gray-100">
                      {o.municipio}
                    </EditableCell>
                    {/* OBRA — editável */}
                    <EditableCell o={o} campo="localidade" className="px-2 py-1 font-medium text-gray-900 w-[160px] max-w-[160px] border-r border-gray-200">
                      <div className="whitespace-normal break-words leading-tight">{o.localidade}</div>
                    </EditableCell>
                    {/* STATUS — editável */}
                    <EditableCell o={o} campo="status" className="px-2 py-1 whitespace-nowrap border-r border-gray-200"
                      options={['A Iniciar', 'Execução', 'Concluída', 'Paralisada']}>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border"
                        style={{ backgroundColor: sc.bg, color: sc.text, borderColor: sc.border }}>
                        {o.status.toUpperCase()}
                      </span>
                    </EditableCell>

                    {/* ── Datas (parte do grupo Obra) ── */}
                    {/* INÍCIO — editável */}
                    <EditableCell o={o} campo="dataInicio" type="date"
                      className="px-2 py-1 whitespace-nowrap text-gray-500 border-r border-gray-200">
                      {fmtDate(o.dataInicio)}
                    </EditableCell>
                    {/* CONCLUSÃO PREV — restrita */}
                    <EditableCell o={o} campo="conclusaoPrevista" type="date"
                      className="px-2 py-1 whitespace-nowrap text-gray-500 border-r border-gray-200">
                      <span className={temPendente(o.id, 'conclusaoPrevista') ? 'text-amber-600 font-semibold' : ''}>
                        {fmtDate(o.conclusaoPrevista)}
                      </span>
                    </EditableCell>
                    {/* CONCLUSÃO REAL — editável */}
                    <EditableCell o={o} campo="dataRealConclusao" type="date"
                      className="px-2 py-1 whitespace-nowrap border-r border-gray-200">
                      {o.dataRealConclusao
                        ? <span className="text-green-700 font-medium">{fmtDate(o.dataRealConclusao)}</span>
                        : <span className="text-gray-300">—</span>}
                    </EditableCell>

                    {/* ── Financeiro ── */}
                    {visibleGroups.financeiro && (
                      <>
                        {/* EXECUTIVO — restrito (2 alçadas) */}
                        <EditableCell o={o} campo="executivo" type="number"
                          className="px-2 py-1 whitespace-nowrap text-right text-gray-700 border-r border-amber-100"
                          style={{ background: '#fffdf5' } as any}>
                          <span className={temPendente(o.id, 'executivo') ? 'text-amber-600 font-semibold' : ''}>
                            {fmtBRL(o.executivo)}
                          </span>
                        </EditableCell>
                        {/* VENDA — restrita (2 alçadas) */}
                        <EditableCell o={o} campo="venda" type="number"
                          className="px-2 py-1 whitespace-nowrap text-right font-semibold text-gray-900 border-r border-amber-100"
                          style={{ background: '#fffdf5' } as any}>
                          <span className={temPendente(o.id, 'venda') ? 'text-amber-600 font-semibold' : ''}>
                            {fmtBRL(o.venda)}
                          </span>
                        </EditableCell>
                        {/* AVANÇO % — editável */}
                        <td className="px-2 py-1 whitespace-nowrap border-r border-amber-100 min-w-[90px]" style={{ background: '#fffdf5' }}>
                          <EditableCell o={o} campo="avancoPct" type="number" className="text-right font-bold"
                            style={{ color: o.avancoPct >= 90 ? '#16a34a' : o.avancoPct >= 70 ? '#d97706' : '#dc2626' } as any}>
                            <div className="flex items-center gap-2 justify-end">
                              <button onClick={e => { e.stopPropagation(); setHistoricoObra(o) }}
                                className="p-0.5 rounded text-gray-300 hover:text-blue-500 transition-colors flex-shrink-0" title="Histórico de avanço">
                                <TrendingUp size={11} />
                              </button>
                              <div className="flex-1 h-1.5 bg-gray-200 rounded-full min-w-[40px] max-w-[50px]">
                                <div className="h-1.5 rounded-full transition-all"
                                  style={{ width: `${Math.min(o.avancoPct, 100)}%`, background: o.avancoPct >= 90 ? '#16a34a' : o.avancoPct >= 70 ? '#d97706' : '#dc2626' }} />
                              </div>
                              <span className="font-bold" style={{ color: o.avancoPct >= 90 ? '#16a34a' : o.avancoPct >= 70 ? '#d97706' : '#dc2626' }}>
                                {fmtPct(o.avancoPct)}
                              </span>
                            </div>
                          </EditableCell>
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap text-right text-gray-700 border-r border-amber-100" style={{ background: '#fffdf5' }}>{fmtBRL((o.avancoPct / 100) * o.venda)}</td>
                        {/* REALIZADO — SIENGE (somente leitura) */}
                        <td className="px-2 py-1 whitespace-nowrap border-r border-amber-100" style={{ background: '#fffdf5' }}>
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-gray-700">{fmtBRL(o.realizado)}</span>
                            <span className="text-[8px] font-bold text-teal-600 bg-teal-50 border border-teal-200 px-1 rounded leading-tight">SIENGE</span>
                          </div>
                        </td>
                        {/* COMPROMETIDO — SIENGE (somente leitura) */}
                        <td className="px-2 py-1 whitespace-nowrap border-r border-amber-100" style={{ background: '#fffdf5' }}>
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-gray-700">{fmtBRL(o.comprometido)}</span>
                            <span className="text-[8px] font-bold text-teal-600 bg-teal-50 border border-teal-200 px-1 rounded leading-tight">SIENGE</span>
                          </div>
                        </td>
                        {/* VL. MEDIDO */}
                        <td className="px-2 py-1 whitespace-nowrap text-right border-r border-amber-100" style={{ background: '#fffdf5' }}>
                          <EditableCell o={o} campo="valorMedido" type="number" className="text-right text-gray-700">{fmtBRL(o.valorMedido)}</EditableCell>
                        </td>
                        {/* SALDO */}
                        <td className="px-2 py-1 whitespace-nowrap text-right font-semibold border-r border-amber-100" style={{ background: '#fffdf5', color: (o.venda - o.valorMedido) > 0 ? '#2563eb' : '#6b7280' }}>{fmtBRL(o.venda - o.valorMedido)}</td>
                        {/* PRÓX. MED. */}
                        <td className="px-2 py-1 whitespace-nowrap text-right border-r border-amber-100" style={{ background: '#fffdf5' }}>
                          <EditableCell o={o} campo="proximaMedicao" type="number" className="text-right text-gray-600">{o.proximaMedicao ? fmtBRL(o.proximaMedicao) : '—'}</EditableCell>
                        </td>
                        {/* DATA MED. */}
                        <td className="px-2 py-1 whitespace-nowrap border-r border-amber-100" style={{ background: '#fffdf5' }}>
                          <EditableCell o={o} campo="dataMedicao" type="date" className="text-gray-500">{fmtDate(o.dataMedicao)}</EditableCell>
                        </td>
                      </>
                    )}

                    {/* ── Prazo / IDP ── */}
                    {visibleGroups.prazo && (
                      <>
                        {/* TEMPO PREVISTO */}
                        <td className="px-2 py-1 whitespace-nowrap text-center text-gray-600 border-r border-indigo-100" style={{ background: '#f8f7ff' }}>
                          {tempoPrevisto != null ? tempoPrevisto : '—'}
                        </td>
                        {/* TEMPO ATUAL */}
                        <td className="px-2 py-1 whitespace-nowrap text-center border-r border-indigo-100" style={{ background: '#f8f7ff' }}>
                          {tempoAtual != null
                            ? <span className={tempoPrevisto != null && tempoAtual > tempoPrevisto ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                                {tempoAtual}
                              </span>
                            : '—'}
                        </td>
                        {/* VELOCIDADE PLANEJADA */}
                        <td className="px-2 py-1 whitespace-nowrap text-center text-gray-600 border-r border-indigo-100" style={{ background: '#f8f7ff' }}>
                          {velPlanej != null ? `${velPlanej.toFixed(2).replace('.', ',')}%` : '—'}
                        </td>
                        {/* VELOCIDADE REAL */}
                        <td className="px-2 py-1 whitespace-nowrap text-center border-r border-indigo-100" style={{ background: '#f8f7ff' }}>
                          {velReal != null
                            ? <span className={velPlanej != null && velReal < velPlanej ? 'text-red-600' : 'text-green-700'}>
                                {`${velReal.toFixed(2).replace('.', ',')}%`}
                              </span>
                            : '—'}
                        </td>
                        {/* IDP % */}
                        <td className="px-2 py-1 whitespace-nowrap text-center border-r border-indigo-100" style={{ background: '#f8f7ff' }}>
                          {idp != null
                            ? <span className={`font-bold ${idp >= 90 ? 'text-green-700' : idp >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                                {idp.toFixed(2).replace('.', ',')}%
                              </span>
                            : '—'}
                        </td>
                        {/* STATUS IDP */}
                        <td className="px-2 py-1 whitespace-nowrap text-center border-r border-indigo-100" style={{ background: '#f8f7ff' }}>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold"
                            style={{ backgroundColor: ic.bg, color: ic.text }}>
                            {statusIdp}
                          </span>
                        </td>
                      </>
                    )}

                    {/* Ações rápidas: Histórico + Anexos */}
                    <td className="px-1 py-1 whitespace-nowrap w-16">
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => setHistoricoObra(o)} title="Histórico de avanço"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                          <TrendingUp size={13} />
                        </button>
                        <button onClick={() => setMedicoesObra(o)} title="Histórico de medições"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors">
                          <DollarSign size={13} />
                        </button>
                        <button onClick={() => setAnexosObra(o)} title="Anexos e fotos"
                          className={`p-1.5 rounded-lg transition-colors relative ${
                            getAnexosObra(o.id).length > 0
                              ? 'text-purple-500 hover:bg-purple-50'
                              : 'text-gray-400 hover:text-purple-500 hover:bg-purple-50'
                          }`}>
                          <Paperclip size={13} />
                          {getAnexosObra(o.id).length > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-purple-500 text-white text-[8px] font-bold flex items-center justify-center leading-none">
                              {getAnexosObra(o.id).length}
                            </span>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}

              {filtradas.length === 0 && (
                <tr>
                  <td colSpan={40} className="px-4 py-12 text-center text-gray-400 text-sm">
                    Nenhuma obra encontrada.
                  </td>
                </tr>
              )}
            </tbody>

            {/* Totais */}
            {filtradas.length > 0 && (
              <tfoot>
                <tr className="bg-[#0f2557] text-white text-xs font-bold">
                  {isEditingEnabled && <td />}
                  {isEditingEnabled && <td />}
                  <td className="px-2 py-1" colSpan={12}>TOTAIS / MÉDIAS — {filtradas.length} obra(s)</td>
                  {visibleGroups.financeiro && (
                    <>
                      <td className="px-2 py-1 text-right" style={{ color: '#fbbf24' }}>
                        {fmtBRL(filtradas.reduce((s, o) => s + (o.executivo ?? 0), 0))}
                      </td>
                      <td className="px-2 py-1 text-right" style={{ color: '#fbbf24' }}>
                        {fmtBRL(filtradas.reduce((s, o) => s + (o.venda ?? 0), 0))}
                      </td>
                      <td className="px-2 py-1 text-center" style={{ color: '#fbbf24' }}>
                        {fmtPct(filtradas.reduce((s, o) => s + (o.avancoPct ?? 0), 0) / filtradas.length)}
                      </td>
                      <td className="px-2 py-1 text-right" style={{ color: '#fbbf24' }}>
                        {fmtBRL(filtradas.reduce((s, o) => s + (o.avancoPct / 100) * o.venda, 0))}
                      </td>
                      <td className="px-2 py-1 text-right" style={{ color: '#fbbf24' }}>
                        {fmtBRL(filtradas.reduce((s, o) => s + (o.realizado ?? 0), 0))}
                      </td>
                      <td className="px-2 py-1 text-right" style={{ color: '#fbbf24' }}>
                        {fmtBRL(filtradas.reduce((s, o) => s + (o.comprometido ?? 0), 0))}
                      </td>
                      <td className="px-2 py-1 text-right" style={{ color: '#fbbf24' }}>
                        {fmtBRL(filtradas.reduce((s, o) => s + (o.valorMedido ?? 0), 0))}
                      </td>
                      <td className="px-2 py-1 text-right" style={{ color: '#fbbf24' }}>
                        {fmtBRL(filtradas.reduce((s, o) => s + (o.venda - o.valorMedido), 0))}
                      </td>
                      <td className="px-2 py-1 text-right" style={{ color: '#fbbf24' }}>
                        {fmtBRL(filtradas.reduce((s, o) => s + (o.proximaMedicao ?? 0), 0))}
                      </td>
                    </>
                  )}
                  {visibleGroups.prazo && (() => {
                    const calculos = filtradas.map(o => calcPrazo(o))
                    const comPrevisto = calculos.filter(c => c.tempoPrevisto != null)
                    const comAtual    = calculos.filter(c => c.tempoAtual != null)
                    const comVelP     = calculos.filter(c => c.velPlanej != null)
                    const comVelR     = calculos.filter(c => c.velReal != null)
                    const comIdp      = calculos.filter(c => c.idp != null)
                    const atingidos   = calculos.filter(c => c.statusIdp === 'ATINGIDO').length
                    return (
                      <>
                        <td className="px-2 py-1 text-center" style={{ color: '#a5b4fc' }}>
                          {comPrevisto.length ? Math.round(comPrevisto.reduce((s, c) => s + c.tempoPrevisto!, 0) / comPrevisto.length) : '—'}
                        </td>
                        <td className="px-2 py-1 text-center" style={{ color: '#a5b4fc' }}>
                          {comAtual.length ? Math.round(comAtual.reduce((s, c) => s + c.tempoAtual!, 0) / comAtual.length) : '—'}
                        </td>
                        <td className="px-2 py-1 text-center" style={{ color: '#a5b4fc' }}>
                          {comVelP.length ? `${(comVelP.reduce((s, c) => s + c.velPlanej!, 0) / comVelP.length).toFixed(2).replace('.', ',')}%` : '—'}
                        </td>
                        <td className="px-2 py-1 text-center" style={{ color: '#a5b4fc' }}>
                          {comVelR.length ? `${(comVelR.reduce((s, c) => s + c.velReal!, 0) / comVelR.length).toFixed(2).replace('.', ',')}%` : '—'}
                        </td>
                        <td className="px-2 py-1 text-center" style={{ color: '#a5b4fc' }}>
                          {comIdp.length ? `${(comIdp.reduce((s, c) => s + c.idp!, 0) / comIdp.length).toFixed(2).replace('.', ',')}%` : '—'}
                        </td>
                        <td className="px-2 py-1 text-center" style={{ color: '#a5b4fc' }}>
                          {atingidos} atingido(s)
                        </td>
                      </>
                    )
                  })()}
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── Modais Histórico de Avanço e Anexos ── */}
      {historicoObra && <HistoricoAvancoModal obra={historicoObra} onClose={() => setHistoricoObra(null)} />}
      {medicoesObra && <HistoricoMedicoesModal obra={medicoesObra} onClose={() => setMedicoesObra(null)} />}
      {anexosObra    && <AnexosModal obra={anexosObra} onClose={() => setAnexosObra(null)} />}

      {/* ── Modal Solicitar Aprovação ── */}
      {aprovModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <Lock size={18} className="text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Campo protegido — solicitar alteração</h3>
                <p className="text-xs text-gray-500">Requer aprovação de 2 alçadas para ser aplicada</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Campo:</span>
                <span className="font-semibold text-gray-800">{CAMPO_LABELS[aprovModal.campo]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Obra:</span>
                <span className="font-medium text-gray-700 text-right max-w-[220px] truncate">{aprovModal.obraLabel}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between items-center">
                <span className="text-gray-500">Valor atual:</span>
                <span className="text-red-600 line-through font-medium">{fmtVal(aprovModal.campo, aprovModal.valorAtual)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Novo valor:</span>
                <span className="text-green-700 font-bold">{fmtVal(aprovModal.campo, aprovModal.valorNovo)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600">
                Justificativa <span className="text-red-500">*</span>
              </label>
              <textarea
                value={justificativa}
                onChange={e => setJustificativa(e.target.value)}
                placeholder="Descreva o motivo da alteração..."
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
              />
              <p className="text-[11px] text-gray-400">
                Obrigatória — ficará registrada junto à solicitação de aprovação.
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setAprovModal(null); setJustificativa('') }}
                className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={confirmarSolicitacao} disabled={!justificativa.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors">
                <Send size={14} /> Enviar para aprovação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Vincular Contratos ── */}
      {vincularModal && (() => {
        // drag-to-fill state (local via closure — reset on each open)
        return (
          <VincularModal
            obras={obras}
            vincMap={vincMap}
            setVincMap={setVincMap}
            onClose={() => setVincularModal(false)}
            onSave={() => {
              obras.forEach(o => {
                const novoContrato = vincMap[o.id] ?? ''
                if (novoContrato !== (o.contratoItem ?? '')) {
                  updateObra(o.id, { contratoItem: novoContrato || undefined })
                }
              })
              setVincularModal(false)
            }}
          />
        )
      })()}

      {/* ── Modal Editar / Adicionar ── */}
      {form && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {modalMode === 'add' ? 'Nova Obra' : 'Editar Obra'}
              </h2>
              <button onClick={closeModal} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5 space-y-6 flex-1">

              {/* Identificação */}
              <section>
                <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-3 pb-1 border-b border-blue-100">Identificação</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>Engenharia (Estado)</label>
                    <select value={form.engenharia} onChange={e => set('engenharia', e.target.value)} className={inputCls}>
                      <option value="">— Selecione —</option>
                      {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Tipo</label>
                    <select value={form.tipo} onChange={e => set('tipo', e.target.value)} className={inputCls}>
                      {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>CÓD. / Nº OS</label>
                    <input value={form.ordemServico} onChange={e => set('ordemServico', e.target.value)}
                      placeholder="Ex: 501" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Nº Obra</label>
                    <input value={form.numeroObra} onChange={e => set('numeroObra', e.target.value)}
                      placeholder="Ex: 501" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Engenheiro *</label>
                    <select value={form.engenheiro} onChange={e => set('engenheiro', e.target.value)} className={inputCls}>
                      {engenheiros.map(e => <option key={e.id} value={e.nome}>{e.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Órgão</label>
                    <input value={form.orgao} onChange={e => set('orgao', e.target.value)}
                      placeholder="Ex: SESA" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Contrato (Faturamento)</label>
                    <select
                      value={form.contratoItem ?? ''}
                      onChange={e => set('contratoItem', e.target.value)}
                      className={inputCls}
                    >
                      <option value="">— sem vínculo —</option>
                      {faturamentoContratos.map(c => (
                        <option key={c.item} value={c.item}>{c.contrato} ({c.estado})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Ano</label>
                    <input type="number" value={form.ano} onChange={e => set('ano', Number(e.target.value))}
                      min={2000} max={2099} className={inputCls} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>OBRA / Local *</label>
                    <input value={form.localidade} onChange={e => set('localidade', e.target.value)}
                      placeholder="Ex: UPA Norte" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Cidade *</label>
                    <input value={form.municipio} onChange={e => set('municipio', e.target.value)}
                      placeholder="Ex: Vitória" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Região</label>
                    <select value={form.regiao} onChange={e => set('regiao', e.target.value as Regiao)} className={inputCls}>
                      {REGIOES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Tipo de Serviço</label>
                    <select value={form.tipoServico} onChange={e => set('tipoServico', e.target.value)} className={inputCls}>
                      {TIPOS_SERVICO.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Status</label>
                    <select value={form.status} onChange={e => set('status', e.target.value as StatusObra)} className={inputCls}>
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </section>

              {/* Datas */}
              <section>
                <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-3 pb-1 border-b border-blue-100">Datas</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>Data da OS</label>
                    <input type="date" value={form.dataOS} onChange={e => set('dataOS', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Início</label>
                    <input type="date" value={form.dataInicio} onChange={e => set('dataInicio', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Data Prev. Conclusão</label>
                    <input type="date" value={form.conclusaoPrevista} onChange={e => set('conclusaoPrevista', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Data Real de Conclusão</label>
                    <input type="date" value={form.dataRealConclusao} onChange={e => set('dataRealConclusao', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Data Próxima Medição</label>
                    <input type="date" value={form.dataMedicao} onChange={e => set('dataMedicao', e.target.value)} className={inputCls} />
                  </div>
                </div>
              </section>

              {/* Financeiro */}
              <section>
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-3 pb-1 border-b border-amber-100">💰 Financeiro (R$)</p>
                <div className="grid grid-cols-3 gap-4">
                  {([
                    ['executivo',     'Executivo (R$)'],
                    ['venda',         'Venda (R$)'],
                    ['avancoPct',     'Avanço (%)'],
                    ['realizado',     'Realizado (R$)'],
                    ['comprometido',  'Comprometido (R$)'],
                    ['valorMedido',   'Valor Medido (R$)'],
                    ['proximaMedicao','Próxima Med. (R$)'],
                  ] as [keyof ObraForm, string][]).map(([key, lbl]) => (
                    <div key={key}>
                      <label className={labelCls}>{lbl}</label>
                      <input type="number" step="0.01" value={form[key] as number}
                        onChange={e => set(key, Number(e.target.value))}
                        className={numCls} />
                    </div>
                  ))}
                </div>
              </section>

              {/* Prazo / IDP */}
              <section>
                <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-3 pb-1 border-b border-indigo-100">⏱ Prazo / IDP</p>
                <div className="grid grid-cols-3 gap-4">
                  {([
                    ['tempoPrevisto',    'Tempo Previsto (dias)'],
                    ['tempoAtual',       'Tempo Atual (dias)'],
                    ['velocidadePlanej', 'Veloc. Planej. (%/dia)'],
                    ['velocidadeReal',   'Veloc. Real (%/dia)'],
                    ['idp',              'IDP (%)'],
                  ] as [keyof ObraForm, string][]).map(([key, lbl]) => (
                    <div key={key}>
                      <label className={labelCls}>{lbl}</label>
                      <input type="number" step="0.01" value={form[key] as number}
                        onChange={e => set(key, Number(e.target.value))}
                        className={numCls} />
                    </div>
                  ))}
                  <div>
                    <label className={labelCls}>Status IDP</label>
                    <select value={form.statusIdp} onChange={e => set('statusIdp', e.target.value as StatusIDP)} className={inputCls}>
                      <option value="—">—</option>
                      <option value="ATINGIDO">ATINGIDO</option>
                      <option value="NÃO ATINGIDO">NÃO ATINGIDO</option>
                    </select>
                  </div>
                </div>
              </section>
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
              <button onClick={closeModal}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={!form.localidade || !form.municipio}
                className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  saved ? 'bg-green-600 text-white'
                    : modalMode === 'add' ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-blue-700 hover:bg-blue-800 text-white'
                }`}>
                <Save size={14} />
                {saved
                  ? (modalMode === 'add' ? 'Obra adicionada!' : 'Salvo!')
                  : (modalMode === 'add' ? 'Adicionar obra'   : 'Salvar alterações')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar exclusão múltipla */}
      {confirmDeleteMulti && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <Trash2 size={22} className="text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Excluir {selecionadas.size} obra(s)?</h3>
              <p className="text-sm text-gray-500 mt-1">
                {[...selecionadas].map(id => obras.find(o => o.id === id)?.localidade).filter(Boolean).slice(0, 3).join(', ')}
                {selecionadas.size > 3 ? ` e mais ${selecionadas.size - 3}` : ''}
              </p>
              <p className="text-xs text-gray-400 mt-1">Essa ação não pode ser desfeita.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteMulti(false)}
                className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={excluirSelecionadas}
                className="flex-1 px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors">
                Excluir todas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar exclusão */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <Trash2 size={22} className="text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Excluir obra?</h3>
              <p className="text-sm text-gray-500 mt-1">{obras.find(o => o.id === confirmDelete)?.localidade}</p>
              <p className="text-xs text-gray-400 mt-1">Essa ação não pode ser desfeita.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={() => handleDelete(confirmDelete)}
                className="flex-1 px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </EditContext.Provider>
  )
}

