import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from 'recharts'
import { BarChart2, Target, TrendingUp, Calendar, DollarSign, FileCheck, CheckCircle2, XCircle, Minus, Filter, Users, X } from 'lucide-react'
import { MultiSelect } from '../components/MultiSelect'
import { engenheiros } from '../data/mockData'
import { useObras } from '../contexts/ObrasContext'
import type { StatusObra, Regiao, Obra } from '../types'

const STATUS_COLORS: Record<StatusObra, string> = {
  'A Iniciar': '#f59e0b',
  'Execução':  '#2563eb',
  'Concluída': '#16a34a',
  'Paralisada':'#9ca3af',
}
const REGIOES: Regiao[]    = ['Norte', 'Sul', 'Metropolitana', 'Centro-Oeste', 'Leste']
const STATUSES: StatusObra[] = ['A Iniciar', 'Execução', 'Concluída', 'Paralisada']

// ── Gauge bar ────────────────────────────────────────────────────────────────
function Gauge({ value, meta, invertido = false }: { value: number; meta: number; invertido?: boolean }) {
  const pct = Math.min(Math.max(value, 0), 150)
  const ok  = invertido ? (value >= 100 - meta && value <= 100 + meta) : value >= meta
  const color = ok ? '#16a34a' : value >= meta * 0.7 ? '#d97706' : '#dc2626'
  return (
    <div className="space-y-1.5">
      <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden relative">
        {invertido && (
          <div className="absolute top-0 h-full rounded-full opacity-20"
            style={{
              left: `${Math.max(100 - meta, 0)}%`,
              width: `${meta * 2}%`,
              background: '#16a34a',
            }} />
        )}
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
        {!invertido && (
          <div className="absolute top-0 bottom-0 w-0.5 bg-gray-400 opacity-50"
            style={{ left: `${meta}%` }} />
        )}
      </div>
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>0%</span>
        {!invertido && <span className="text-gray-500">Meta: {meta}%</span>}
        {invertido && <span className="text-gray-500">Faixa: {100 - meta}% – {100 + meta}%</span>}
        <span>100%</span>
      </div>
    </div>
  )
}

// ── Card de KPI tático ───────────────────────────────────────────────────────
function KpiCard({
  icon: Icon, color, title, formula, value, meta, atingido, detalhe, invertido = false,
}: {
  icon: React.ElementType; color: string; title: string; formula: string
  value: number | null; meta: number; atingido: boolean | null; detalhe: string; invertido?: boolean
}) {
  const statusColor = atingido === null ? '#9ca3af' : atingido ? '#16a34a' : '#dc2626'
  const statusLabel = atingido === null ? 'Sem dados' : atingido ? 'Atingido' : 'Não Atingido'

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: color + '18' }}>
          <Icon size={19} style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 leading-tight">{title}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{formula}</p>
        </div>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full border shrink-0"
          style={{ color: statusColor, borderColor: statusColor + '40', background: statusColor + '10' }}>
          {statusLabel}
        </span>
      </div>

      <div className="flex items-end gap-3">
        <p className="text-4xl font-black" style={{ color: statusColor }}>
          {value != null ? `${value.toFixed(1).replace('.', ',')}%` : '—'}
        </p>
        <div className="pb-1 text-xs text-gray-400 leading-snug">
          <p className="font-semibold text-gray-600">
            {invertido ? `Meta: ${100 - meta}% – ${100 + meta}%` : `Meta: ≥ ${meta}%`}
          </p>
          <p>{detalhe}</p>
        </div>
      </div>

      {value != null && <Gauge value={value} meta={meta} invertido={invertido} />}
    </div>
  )
}

// ── Badge de status ───────────────────────────────────────────────────────────
function StatusBadge({ ok }: { ok: boolean | null }) {
  if (ok === null) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-400">
      <Minus size={10} /> Sem dados
    </span>
  )
  if (ok) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-50 text-green-700 border border-green-200">
      <CheckCircle2 size={10} /> Atingido
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
      <XCircle size={10} /> Não Atingido
    </span>
  )
}

// ── Indicadores Estratégicos ─────────────────────────────────────────────────
function IndicadoresEstrategicos({ obras, filtroMes }: { obras: Obra[]; filtroMes: string }) {

  const engsNasObras = [...new Set(obras.map(o => o.engenheiro).filter(Boolean))]

  // ── 1. Entregas no Prazo ────────────────────────────────────────────────
  const obrasEntregues = obras.filter(o => {
    if (o.status !== 'Concluída') return false
    if (!filtroMes || !o.dataRealConclusao) return true
    const [fAno, fMes] = filtroMes.split('-').map(Number)
    const d = new Date(o.dataRealConclusao + 'T00:00:00')
    return d.getFullYear() === fAno && d.getMonth() === fMes - 1
  })
  const obrasNoPrazo   = obrasEntregues.filter(o =>
    o.dataRealConclusao && o.conclusaoPrevista &&
    new Date(o.dataRealConclusao) <= new Date(o.conclusaoPrevista)
  )
  const indiceEntregasPrazo = obrasEntregues.length > 0
    ? (obrasNoPrazo.length / obrasEntregues.length) * 100
    : null
  const entregasPrazoOk = indiceEntregasPrazo != null ? indiceEntregasPrazo >= 70 : null

  // ── 2. IDP Médio por Engenharia ─────────────────────────────────────────
  type IdpRow = { nome: string; idpMedio: number | null; qtdObras: number; qtdComDados: number }

  const idpPorEng: IdpRow[] = engsNasObras.map(eng => {
    const obrasEng = obras.filter(o => o.engenheiro === eng && o.status !== 'Concluída' && o.status !== 'A Iniciar')
    const idps     = obrasEng.map(o => calcIdp(o)).filter((v): v is number => v !== null)
    return {
      nome:        eng,
      idpMedio:    idps.length > 0 ? idps.reduce((a, b) => a + b, 0) / idps.length : null,
      qtdObras:    obrasEng.length,
      qtdComDados: idps.length,
    }
  }).sort((a, b) => (b.idpMedio ?? -1) - (a.idpMedio ?? -1))

  const todosIdps = obras
    .filter(o => o.status !== 'Concluída' && o.status !== 'A Iniciar')
    .map(o => calcIdp(o)).filter((v): v is number => v !== null)
  const idpConsolidado = todosIdps.length > 0
    ? todosIdps.reduce((a, b) => a + b, 0) / todosIdps.length
    : null

  const idpColor = (v: number | null) => {
    if (v === null) return '#9ca3af'
    if (v >= 90) return '#16a34a'
    if (v >= 70) return '#d97706'
    return '#dc2626'
  }

  // ── 3. Controle de Custos ────────────────────────────────────────────────
  const obrasConcl = obras.filter(o => {
    if (o.status !== 'Concluída' || !o.dataRealConclusao) return false
    if (!filtroMes) return true
    const [fAno, fMes] = filtroMes.split('-').map(Number)
    const d = new Date(o.dataRealConclusao + 'T00:00:00')
    return d.getFullYear() === fAno && d.getMonth() === fMes - 1
  })
  const somaRealizadoConcl = obrasConcl.reduce((s, o) => s + (o.realizado   ?? 0), 0)
  const somaExecConcl      = obrasConcl.reduce((s, o) => s + (o.executivo   ?? 0), 0)
  const indiceCustos   = somaExecConcl > 0
    ? ((somaRealizadoConcl - somaExecConcl) / somaExecConcl) * 100
    : null
  const custosOk       = indiceCustos != null ? Math.abs(indiceCustos) <= 5 : null

  // ── 4. Faturamento Projetado por Engenharia ──────────────────────────────
  type FatRow = {
    nome: string; venda: number; medido: number; proximo: number
    pctMedido: number | null; pctProjetado: number | null
  }

  const fatPorEng: FatRow[] = engsNasObras.map(eng => {
    const oe      = obras.filter(o => o.engenheiro === eng)
    const venda   = oe.reduce((s, o) => s + (o.venda          ?? 0), 0)
    const medido  = oe.reduce((s, o) => s + (o.valorMedido     ?? 0), 0)
    const proximo = oe.reduce((s, o) => s + (o.proximaMedicao  ?? 0), 0)
    return {
      nome: eng, venda, medido, proximo,
      pctMedido:    venda > 0 ? (medido / venda) * 100 : null,
      pctProjetado: venda > 0 ? ((medido + proximo) / venda) * 100 : null,
    }
  }).sort((a, b) => (b.pctProjetado ?? 0) - (a.pctProjetado ?? 0))

  const fatTotalVenda   = obras.reduce((s, o) => s + (o.venda          ?? 0), 0)
  const fatTotalMedido  = obras.reduce((s, o) => s + (o.valorMedido     ?? 0), 0)
  const fatTotalProximo = obras.reduce((s, o) => s + (o.proximaMedicao  ?? 0), 0)
  const fatPctTotal     = fatTotalVenda > 0
    ? ((fatTotalMedido + fatTotalProximo) / fatTotalVenda) * 100
    : null

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp size={15} className="text-orange-500" />
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-widest">Indicadores Estratégicos</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Entregas no Prazo */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: '#16a34a18' }}>
              <CheckCircle2 size={19} style={{ color: '#16a34a' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 leading-tight">Entregas no Prazo</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Concluídas no prazo ÷ Total Concluídas</p>
            </div>
            <StatusBadge ok={entregasPrazoOk} />
          </div>
          <div className="flex items-end gap-3">
            <p className="text-4xl font-black" style={{ color: idpColor(indiceEntregasPrazo) }}>
              {indiceEntregasPrazo != null ? `${indiceEntregasPrazo.toFixed(1).replace('.', ',')}%` : '—'}
            </p>
            <div className="pb-1 text-xs text-gray-400 leading-snug">
              <p className="font-semibold text-gray-600">Meta: ≥ 70%</p>
              <p>{obrasNoPrazo.length} de {obrasEntregues.length} obra(s) concluída(s) no prazo</p>
            </div>
          </div>
          {indiceEntregasPrazo != null && <Gauge value={indiceEntregasPrazo} meta={70} />}
        </div>

        {/* Controle de Custos */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: '#dc262618' }}>
              <DollarSign size={19} style={{ color: '#dc2626' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 leading-tight">Controle de Custos (Concluídas)</p>
              <p className="text-[11px] text-gray-400 mt-0.5">(Realizado − Orçado) ÷ Orçado</p>
            </div>
            <StatusBadge ok={custosOk} />
          </div>
          <div className="flex items-end gap-3">
            <p className="text-4xl font-black"
              style={{ color: indiceCustos === null ? '#9ca3af' : Math.abs(indiceCustos) <= 5 ? '#16a34a' : '#dc2626' }}>
              {indiceCustos != null
                ? `${indiceCustos >= 0 ? '+' : ''}${indiceCustos.toFixed(1).replace('.', ',')}%`
                : '—'}
            </p>
            <div className="pb-1 text-xs text-gray-400 leading-snug">
              <p className="font-semibold text-gray-600">Meta: variação ≤ ±5%</p>
              <p>
                {obrasConcl.length} obra(s) concluída(s) ·{' '}
                {somaExecConcl > 0
                  ? `${fmtBRL(somaRealizadoConcl)} realiz. de ${fmtBRL(somaExecConcl)} orç.`
                  : 'Sem dados'}
              </p>
            </div>
          </div>
          {indiceCustos != null && (
            <div className="space-y-1.5">
              <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden relative">
                <div className="absolute top-0 h-full rounded-full opacity-20"
                  style={{ left: '61.67%', width: '6.67%', background: '#16a34a' }} />
                <div className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(Math.max((100 + indiceCustos) / 1.5, 0), 100)}%`,
                    background: Math.abs(indiceCustos) <= 5 ? '#16a34a' : '#dc2626',
                  }} />
                <div className="absolute top-0 bottom-0 w-0.5 bg-gray-400 opacity-50"
                  style={{ left: '66.67%' }} />
              </div>
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>−50%</span>
                <span className="text-gray-500">Faixa: −5% a +5%</span>
                <span>+100%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* IDP Médio por Engenharia */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-sm font-bold text-gray-900">IDP Médio por Engenharia</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Obras em execução · (Vel. Real ÷ Vel. Planejada) × 100</p>
          </div>
          {idpConsolidado !== null && (
            <div className="text-right shrink-0">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Consolidado</p>
              <p className="text-2xl font-black" style={{ color: idpColor(idpConsolidado) }}>
                {idpConsolidado.toFixed(1).replace('.', ',')}%
              </p>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Engenheiro', 'Obras em Exec.', 'IDP Médio', 'Status'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {idpPorEng.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-6 text-center text-sm text-gray-400">Sem dados de IDP.</td></tr>
              ) : idpPorEng.map(row => (
                <tr key={row.nome} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-gray-800 max-w-[200px] truncate">{row.nome}</td>
                  <td className="px-5 py-3 text-gray-500">{row.qtdObras} ({row.qtdComDados} c/ dados)</td>
                  <td className="px-5 py-3">
                    {row.idpMedio !== null ? (
                      <span className="font-bold text-base" style={{ color: idpColor(row.idpMedio) }}>
                        {row.idpMedio.toFixed(1).replace('.', ',')}%
                      </span>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge ok={row.idpMedio !== null ? row.idpMedio >= 90 : null} />
                  </td>
                </tr>
              ))}
            </tbody>
            {idpConsolidado !== null && (
              <tfoot className="bg-blue-50 border-t border-blue-100">
                <tr>
                  <td className="px-5 py-3 font-bold text-blue-900">Consolidado</td>
                  <td className="px-5 py-3 text-blue-700">{todosIdps.length} obra(s)</td>
                  <td className="px-5 py-3 font-black text-lg" style={{ color: idpColor(idpConsolidado) }}>
                    {idpConsolidado.toFixed(1).replace('.', ',')}%
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge ok={idpConsolidado >= 90} />
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Faturamento Projetado por Engenharia */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-sm font-bold text-gray-900">Faturamento Projetado por Engenharia</p>
            <p className="text-[11px] text-gray-400 mt-0.5">(Medido + Próxima Medição) ÷ Valor Contratado</p>
          </div>
          {fatPctTotal !== null && (
            <div className="text-right shrink-0">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Projeção Total</p>
              <p className="text-2xl font-black" style={{ color: fatPctTotal >= 85 ? '#16a34a' : '#d97706' }}>
                {fatPctTotal.toFixed(1).replace('.', ',')}%
              </p>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Engenheiro', 'Contrato (Venda)', 'Medido', 'Próx. Medição', '% Medido', '% Projetado'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {fatPorEng.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-6 text-center text-sm text-gray-400">Sem dados de faturamento.</td></tr>
              ) : fatPorEng.map(row => (
                <tr key={row.nome} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800 max-w-[180px] truncate">{row.nome}</td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmtBRL(row.venda)}</td>
                  <td className="px-4 py-3 text-blue-700 whitespace-nowrap">{fmtBRL(row.medido)}</td>
                  <td className="px-4 py-3 text-amber-700 whitespace-nowrap">{fmtBRL(row.proximo)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.pctMedido !== null
                      ? <span className="font-semibold text-gray-700">{row.pctMedido.toFixed(1).replace('.', ',')}%</span>
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.pctProjetado !== null ? (
                      <span className="font-bold" style={{ color: row.pctProjetado >= 85 ? '#16a34a' : '#d97706' }}>
                        {row.pctProjetado.toFixed(1).replace('.', ',')}%
                      </span>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            {fatPctTotal !== null && (
              <tfoot className="bg-blue-50 border-t border-blue-100">
                <tr>
                  <td className="px-4 py-3 font-bold text-blue-900">Consolidado</td>
                  <td className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">{fmtBRL(fatTotalVenda)}</td>
                  <td className="px-4 py-3 font-semibold text-blue-700 whitespace-nowrap">{fmtBRL(fatTotalMedido)}</td>
                  <td className="px-4 py-3 font-semibold text-amber-700 whitespace-nowrap">{fmtBRL(fatTotalProximo)}</td>
                  <td className="px-4 py-3 font-bold whitespace-nowrap">
                    {fatTotalVenda > 0
                      ? `${((fatTotalMedido / fatTotalVenda) * 100).toFixed(1).replace('.', ',')}%`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 font-black whitespace-nowrap"
                    style={{ color: fatPctTotal >= 85 ? '#16a34a' : '#d97706' }}>
                    {fatPctTotal.toFixed(1).replace('.', ',')}%
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </section>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const calcIdp = (o: Obra): number | null => {
  if (!o.tempoPrevisto || !o.tempoAtual || o.tempoPrevisto <= 0 || o.tempoAtual <= 0) return null
  const velPlanej = 100 / o.tempoPrevisto
  const velReal   = o.avancoPct / o.tempoAtual
  if (velPlanej === 0) return null
  return (velReal / velPlanej) * 100
}

function gerarOpcoesMes() {
  const opts: { value: string; label: string }[] = []
  const hoje = new Date()
  for (let i = 0; i <= 23; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      .replace(/^\w/, c => c.toUpperCase())
    opts.push({ value, label })
  }
  return opts
}
const OPCOES_MES = gerarOpcoesMes()

// ── Componente principal ─────────────────────────────────────────────────────
export default function Indicadores() {
  const { obras } = useObras()

  const hoje = new Date()
  const mesDefault = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`

  const [filtroEngs, setFiltroEngs]     = useState<string[]>([])
  const [filtroMes, setFiltroMes]       = useState(mesDefault)

  // Filtros de data: entrega prevista
  const [previstaDe, setPrevistaDe]     = useState('')
  const [previstaAte, setPrevistaAte]   = useState('')

  // Filtros de data: entrega real
  const [realDe, setRealDe]             = useState('')
  const [realAte, setRealAte]           = useState('')

  const engsDisponiveis = useMemo(
    () => [...new Set(obras.map(o => o.engenharia).filter(Boolean))].sort(),
    [obras]
  )

  const obrasFiltradas = obras.filter(o => {
    // Filtro de engenharia (UF)
    if (filtroEngs.length > 0 && !filtroEngs.includes(o.engenharia)) return false

    // Filtro de mês de referência (obras ativas no mês)
    if (filtroMes) {
      const [fAno, fMes] = filtroMes.split('-').map(Number)
      const refIni = new Date(fAno, fMes - 1, 1)
      const refFim = new Date(fAno, fMes, 0)
      const ini = o.dataInicio ? new Date(o.dataInicio + 'T00:00:00') : null
      const fim = o.conclusaoPrevista ? new Date(o.conclusaoPrevista + 'T00:00:00') : null
      if (ini && ini > refFim) return false
      if (fim && fim < refIni) return false
    }

    // Filtro de entrega prevista
    if (previstaDe && o.conclusaoPrevista && o.conclusaoPrevista < previstaDe) return false
    if (previstaAte && o.conclusaoPrevista && o.conclusaoPrevista > previstaAte) return false

    // Filtro de entrega real
    if (realDe && o.dataRealConclusao && o.dataRealConclusao < realDe) return false
    if (realAte && o.dataRealConclusao && o.dataRealConclusao > realAte) return false
    // se filtro real está ativo, exclui obras sem data real (a não ser que seja só o Até)
    if (realDe && !o.dataRealConclusao) return false

    return true
  })

  const [refAno, refMes] = filtroMes
    ? filtroMes.split('-').map(Number)
    : [hoje.getFullYear(), hoje.getMonth() + 1]

  // ── KPIs táticos ────────────────────────────────────────────────────────
  const previstasNoMes = obrasFiltradas.filter(o => {
    if (!o.conclusaoPrevista) return false
    const d = new Date(o.conclusaoPrevista + 'T00:00:00')
    return d.getMonth() === refMes - 1 && d.getFullYear() === refAno
  })
  const entreguesNoMes   = previstasNoMes.filter(o => o.status === 'Concluída')
  const indiceCronograma = previstasNoMes.length > 0
    ? (entreguesNoMes.length / previstasNoMes.length) * 100
    : null
  const cronogramaOk = indiceCronograma != null ? indiceCronograma >= 90 : null

  const concluidasNoMes = obrasFiltradas.filter(o => {
    if (o.status !== 'Concluída' || !o.dataRealConclusao) return false
    const d = new Date(o.dataRealConclusao + 'T00:00:00')
    return d.getFullYear() === refAno && d.getMonth() === refMes - 1
  })
  const totalRealizado = concluidasNoMes.reduce((s, o) => s + (o.comprometido ?? 0), 0)
  const totalExecutivo = concluidasNoMes.reduce((s, o) => s + (o.executivo   ?? 0), 0)
  const indiceExecutivo = totalExecutivo > 0
    ? (totalRealizado / totalExecutivo) * 100 : null
  const executivoOk = indiceExecutivo != null
    ? indiceExecutivo >= 95 && indiceExecutivo <= 105 : null

  const totalMedido = obrasFiltradas.reduce((s, o) => s + (o.valorMedido ?? 0), 0)
  const totalVenda  = obrasFiltradas.reduce((s, o) => s + (o.venda       ?? 0), 0)
  const indiceFaturamento = totalVenda > 0
    ? (totalMedido / totalVenda) * 100 : null
  const faturamentoOk = indiceFaturamento != null ? indiceFaturamento >= 85 : null

  // ── Gráficos ─────────────────────────────────────────────────────────────
  const statusData = STATUSES.map(s => ({
    name: s, value: obrasFiltradas.filter(o => o.status === s).length,
  })).filter(d => d.value > 0)

  const regiaoStatusData = REGIOES.map(r => {
    const reg = obrasFiltradas.filter(o => o.regiao === r)
    return {
      name: r,
      'Execução': reg.filter(o => o.status === 'Execução').length,
      'A Iniciar': reg.filter(o => o.status === 'A Iniciar').length,
      'Concluída': reg.filter(o => o.status === 'Concluída').length,
      'Paralisada': reg.filter(o => o.status === 'Paralisada').length,
    }
  }).filter(d => Object.values(d).slice(1).some(v => Number(v) > 0))

  const engData = engenheiros.map(e => ({
    name: e.nome.split(' ')[0],
    Ativas: e.obrasAtivas,
    Concluídas: e.obrasConcluidas,
  }))

  const total      = obrasFiltradas.length
  const concluidas = obrasFiltradas.filter(o => o.status === 'Concluída').length
  const emExecucao = obrasFiltradas.filter(o => o.status === 'Execução').length
  const aIniciar   = obrasFiltradas.filter(o => o.status === 'A Iniciar').length

  const temFiltroData = previstaDe || previstaAte || realDe || realAte
  const filtroAtivo   = filtroEngs.length > 0 || filtroMes !== mesDefault || !!temFiltroData

  const limparFiltros = () => {
    setFiltroEngs([])
    setFiltroMes(mesDefault)
    setPrevistaDe(''); setPrevistaAte('')
    setRealDe('');     setRealAte('')
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #1e3a8a, #2563eb)' }}>
            <BarChart2 size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Indicadores de Desempenho</h1>
            <p className="text-xs text-gray-500">KPIs táticos e estratégicos do portfólio</p>
          </div>
        </div>
      </div>

      {/* ── FILTROS ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={13} className="text-blue-600" />
          <span className="text-xs font-bold text-gray-600 uppercase tracking-widest">Filtros de Análise</span>
          {filtroAtivo && (
            <button onClick={limparFiltros}
              className="ml-auto text-[11px] text-blue-600 hover:underline font-medium flex items-center gap-1">
              <X size={11} /> Limpar filtros
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-4">

          {/* Engenharia */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
              <Users size={10} /> Engenharia
            </label>
            <MultiSelect
              placeholder="Todas as engenharias"
              opcoes={engsDisponiveis.map(uf => ({ value: uf, label: uf }))}
              selecionadas={filtroEngs}
              onChange={setFiltroEngs}
              mono
            />
          </div>

          {/* Mês de referência */}
          <div className="flex flex-col gap-1 min-w-[200px]">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
              <Calendar size={10} /> Mês de Referência
            </label>
            <select
              value={filtroMes}
              onChange={e => setFiltroMes(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              {OPCOES_MES.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Entrega Prevista */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
              <Calendar size={10} /> Entrega Prevista
              {(previstaDe || previstaAte) && (
                <button onClick={() => { setPrevistaDe(''); setPrevistaAte('') }}
                  className="text-red-400 hover:text-red-600 ml-0.5">
                  <X size={9} />
                </button>
              )}
            </label>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-400">De</span>
              <input
                type="date"
                value={previstaDe}
                onChange={e => setPrevistaDe(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <span className="text-[10px] text-gray-400">Até</span>
              <input
                type="date"
                value={previstaAte}
                onChange={e => setPrevistaAte(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          {/* Entrega Real */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
              <CheckCircle2 size={10} className="text-green-600" /> Entrega Real
              {(realDe || realAte) && (
                <button onClick={() => { setRealDe(''); setRealAte('') }}
                  className="text-red-400 hover:text-red-600 ml-0.5">
                  <X size={9} />
                </button>
              )}
            </label>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-400">De</span>
              <input
                type="date"
                value={realDe}
                onChange={e => setRealDe(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              <span className="text-[10px] text-gray-400">Até</span>
              <input
                type="date"
                value={realAte}
                onChange={e => setRealAte(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
          </div>

        </div>

        {/* Tags de filtros ativos */}
        {temFiltroData && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {(previstaDe || previstaAte) && (
              <span className="inline-flex items-center gap-1 text-[11px] bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">
                📅 Prevista: {previstaDe || '…'} → {previstaAte || '…'}
                <button onClick={() => { setPrevistaDe(''); setPrevistaAte('') }} className="hover:text-red-500"><X size={9} /></button>
              </span>
            )}
            {(realDe || realAte) && (
              <span className="inline-flex items-center gap-1 text-[11px] bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5">
                ✅ Real: {realDe || '…'} → {realAte || '…'}
                <button onClick={() => { setRealDe(''); setRealAte('') }} className="hover:text-red-500"><X size={9} /></button>
              </span>
            )}
          </div>
        )}

        <p className="mt-3 text-[11px] text-gray-400">
          Analisando <strong className="text-gray-600">{total} obra(s)</strong>
          {filtroEngs.length > 0 ? <> · Engenharia: <strong className="text-blue-600">{filtroEngs.join(', ')}</strong></> : null}
          {filtroMes ? <> · Referência: <strong className="text-blue-600">{OPCOES_MES.find(o => o.value === filtroMes)?.label ?? filtroMes}</strong></> : null}
        </p>
      </div>

      {/* ── INDICADORES TÁTICOS ─────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Target size={15} className="text-blue-600" />
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-widest">Indicadores Táticos</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          <KpiCard
            icon={Calendar}
            color="#2563eb"
            title="Índice de Atingimento de Cronograma"
            formula="Entregues ÷ Entregas Previstas (mês)"
            value={indiceCronograma}
            meta={90}
            atingido={cronogramaOk}
            detalhe={
              previstasNoMes.length > 0
                ? `${entreguesNoMes.length} de ${previstasNoMes.length} obra(s) prevista(s) no mês`
                : 'Nenhuma entrega prevista neste mês'
            }
          />

          <KpiCard
            icon={DollarSign}
            color="#7c3aed"
            title="Índice de Atingimento de Executivo"
            formula="Comprometido ÷ Executivo Orçado"
            value={indiceExecutivo}
            meta={5}
            atingido={executivoOk}
            invertido
            detalhe={
              concluidasNoMes.length > 0
                ? `${concluidasNoMes.length} obra(s) concluída(s) no mês · R$ ${(totalRealizado / 1e6).toFixed(2).replace('.', ',')}M comprometido de R$ ${(totalExecutivo / 1e6).toFixed(2).replace('.', ',')}M orç.`
                : 'Nenhuma obra concluída neste mês'
            }
          />

          <KpiCard
            icon={FileCheck}
            color="#0891b2"
            title="Índice de Faturamento de Contrato"
            formula="Valor Medido ÷ Valor Contratado (Venda)"
            value={indiceFaturamento}
            meta={85}
            atingido={faturamentoOk}
            detalhe={
              totalVenda > 0
                ? `R$ ${(totalMedido / 1e6).toFixed(2).replace('.', ',')}M medido de R$ ${(totalVenda / 1e6).toFixed(2).replace('.', ',')}M contrat.`
                : 'Sem dados de venda'
            }
          />

        </div>
      </section>

      {/* ── INDICADORES ESTRATÉGICOS ────────────────────────────────────── */}
      <IndicadoresEstrategicos obras={obrasFiltradas} filtroMes={filtroMes} />

      {/* ── PAINEL GERAL ─────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Painel Geral do Portfólio</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total de Obras', value: total,      sub: 'no filtro',                  color: '#2563eb' },
            { label: 'Em Execução',    value: emExecucao, sub: `${total > 0 ? ((emExecucao/total)*100).toFixed(0) : 0}% do total`, color: '#2563eb' },
            { label: 'Concluídas',     value: concluidas, sub: `${total > 0 ? ((concluidas/total)*100).toFixed(0) : 0}% do total`, color: '#16a34a' },
            { label: 'A Iniciar',      value: aIniciar,   sub: `${obrasFiltradas.filter(o=>o.status==='Paralisada').length} paralisada(s)`, color: '#d97706' },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <p className="text-xs text-gray-500 mb-2">{label}</p>
              <p className="text-3xl font-black" style={{ color }}>{value}</p>
              <p className="text-[11px] text-gray-400 mt-1">{sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Obras por Status</h3>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="45%" outerRadius={80} dataKey="value"
                  label={({ value }) => `${value}`} labelLine={false}>
                  {statusData.map(entry => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name as StatusObra]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend formatter={v => <span className="text-xs">{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Status por Região</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={regiaoStatusData} margin={{ left: 0, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend formatter={v => <span className="text-xs">{v}</span>} />
                {STATUSES.map(s => (
                  <Bar key={s} dataKey={s} fill={STATUS_COLORS[s]} stackId="a" />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Obras por Engenheiro — Ativas vs Concluídas</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={engData} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Ativas"    fill="#2563eb" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Concluídas" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

    </div>
  )
}
