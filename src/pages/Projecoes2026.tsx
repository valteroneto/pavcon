import { useState, useMemo, useRef, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ReferenceLine,
} from 'recharts'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { MultiSelect } from '../components/MultiSelect'
import {
  faturamentoContratos, MESES, MESES_LABEL, METAS, TOTAIS_MENSAIS, ESTADOS_FAT,
  type FaturamentoContrato, type MesesProjecao,
} from '../data/faturamentoData'

type EditedProjecoes = Record<string, Partial<MesesProjecao>>

const fmt = (v: number) =>
  v === 0 ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)

const fmtM = (v: number) => {
  if (v === 0) return '—'
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}K`
  return `R$ ${v.toFixed(0)}`
}

const sumMes = (arr: FaturamentoContrato[], key: 'projecao' | 'real') =>
  MESES.map((m, i) => ({
    mes: MESES_LABEL[i],
    value: arr.reduce((s, c) => s + (c[key]?.[m] ?? 0), 0),
  }))

function EstadoBadge({ estado }: { estado: string }) {
  const colorMap: Record<string, string> = {
    'PIAUÍ':           'bg-indigo-50 text-indigo-700',
    'MARANHÃO':        'bg-blue-50 text-blue-700',
    'ESPÍRITO SANTO':  'bg-teal-50 text-teal-700',
    'PARÁ':            'bg-cyan-50 text-cyan-700',
    'DISTRITO FEDERAL':'bg-purple-50 text-purple-700',
    'RORAIMA':         'bg-rose-50 text-rose-700',
    'MATO GROSSO':     'bg-amber-50 text-amber-700',
    'ACRE':            'bg-green-50 text-green-700',
  }
  const cls = colorMap[estado] ?? 'bg-gray-100 text-gray-600'
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${cls}`}>{estado}</span>
}

function ContratoRow({
  c, expandido, projecaoEditada, onEditProjecao,
}: {
  c: FaturamentoContrato
  expandido: boolean
  projecaoEditada: Partial<MesesProjecao>
  onEditProjecao: (mes: typeof MESES[number], valor: number) => void
}) {
  const [editingMes, setEditingMes] = useState<typeof MESES[number] | null>(null)
  const [inputVal, setInputVal]     = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const getProj = (m: typeof MESES[number]) => projecaoEditada[m] ?? c.projecao[m] ?? 0

  const totalProj = MESES.reduce((s, m) => s + getProj(m), 0)
  const totalReal = MESES.reduce((s, m) => s + (c.real?.[m] ?? 0), 0)
  const pct = totalProj > 0 ? (totalReal / totalProj) * 100 : null
  const saldoAtual = c.saldo - totalReal

  const startEdit = (m: typeof MESES[number]) => {
    setEditingMes(m)
    setInputVal(String(getProj(m) || ''))
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const commitEdit = (m: typeof MESES[number]) => {
    const num = parseFloat(inputVal.replace(',', '.'))
    if (!isNaN(num) && num >= 0) onEditProjecao(m, num)
    setEditingMes(null)
  }

  return (
    <>
      {/* Linha de totais do contrato */}
      <tr className="border-b border-gray-100 hover:bg-gray-50/50">
        <td className="px-3 py-2 text-xs text-gray-500 font-mono">{c.item}</td>
        <td className="px-3 py-2 max-w-[220px]">
          <div className="text-xs font-medium text-gray-900 leading-tight">{c.contrato}</div>
          <div className="text-[10px] text-gray-400 truncate mt-0.5">{c.contratante}</div>
        </td>
        <td className="px-3 py-2"><EstadoBadge estado={c.estado} /></td>
        <td className="px-3 py-2">
          <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{c.tipo_contrato}</span>
        </td>
        <td className="px-3 py-2 text-right text-xs text-gray-500 whitespace-nowrap">{fmt(c.valor_contrato + c.aditivo)}</td>
        <td className="px-3 py-2 text-right text-xs whitespace-nowrap">
          {c.saldo !== 0
            ? <span className={saldoAtual < 0 ? 'text-red-600 font-medium' : 'text-gray-500'}>{fmt(saldoAtual)}</span>
            : <span className="text-gray-300">—</span>}
        </td>

        {MESES.map((m, i) => {
          const proj = getProj(m)
          const real = c.real?.[m] ?? 0
          const hasReal = i <= 4
          const isEdited = projecaoEditada[m] !== undefined
          const isEditing = editingMes === m
          return (
            <td
              key={m}
              className="px-1 py-1 text-right align-top border-l border-gray-50 group"
              style={{ minWidth: 72 }}
            >
              {isEditing ? (
                <input
                  ref={inputRef}
                  type="number"
                  min="0"
                  step="1000"
                  value={inputVal}
                  onChange={e => setInputVal(e.target.value)}
                  onBlur={() => commitEdit(m)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { commitEdit(m); e.preventDefault() }
                    if (e.key === 'Escape') { setEditingMes(null) }
                  }}
                  className="w-full text-[10px] text-right border border-blue-400 rounded px-1 py-0.5 outline-none bg-blue-50"
                />
              ) : (
                <div
                  onClick={() => startEdit(m)}
                  className="cursor-pointer rounded hover:bg-blue-50 px-1 py-0.5 transition-colors"
                  title="Clique para editar"
                >
                  {proj > 0
                    ? <div className={`text-[10px] font-medium ${isEdited ? 'text-orange-600' : 'text-blue-700'}`}>
                        {fmtM(proj)}{isEdited && ' ✎'}
                      </div>
                    : <div className="text-[10px] text-gray-200 group-hover:text-blue-300">+</div>
                  }
                </div>
              )}
              {hasReal && real > 0 && (
                <div className={`text-[10px] font-semibold px-1 ${real >= proj * 0.9 ? 'text-green-600' : 'text-amber-600'}`}>
                  ✓ {fmtM(real)}
                </div>
              )}
            </td>
          )
        })}

        <td className="px-3 py-2 text-right whitespace-nowrap border-l border-gray-100">
          <div className="text-xs font-semibold text-blue-700">{fmtM(totalProj)}</div>
          {totalReal > 0 && <div className="text-[10px] text-green-600 font-medium">✓ {fmtM(totalReal)}</div>}
          {pct !== null && <div className="text-[10px] text-gray-400">{pct.toFixed(0)}%</div>}
        </td>
      </tr>

      {/* Detalhe expandido */}
      {expandido && (
        <tr className="bg-blue-50/30 border-b border-blue-100">
          <td colSpan={5} className="px-4 py-3">
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs text-gray-600">
              <div><span className="font-medium text-gray-500">Tipo de obra:</span> {c.tipo_obra}</div>
              <div><span className="font-medium text-gray-500">Cidade:</span> {c.cidade}</div>
              <div><span className="font-medium text-gray-500">Objeto:</span> {c.objeto}</div>
              <div><span className="font-medium text-gray-500">Faturamento 2025:</span> {fmt(c.faturamento_2025)}</div>
              {c.data_inicio && <div><span className="font-medium text-gray-500">Início:</span> {c.data_inicio}</div>}
              {c.data_fim && <div><span className="font-medium text-gray-500">Fim:</span> {c.data_fim}</div>}
              {c.aditivo > 0 && <div><span className="font-medium text-gray-500">Aditivo:</span> {fmt(c.aditivo)}</div>}
              {c.saldo !== 0 && <div><span className="font-medium text-gray-500">Saldo:</span> {fmt(c.saldo)}</div>}
            </div>
          </td>
          <td colSpan={MESES.length + 1} />
        </tr>
      )}
    </>
  )
}

export default function Projecoes2026() {
  const [filtroEstados, setFiltroEstados]     = useState<string[]>([])
  const [expandidos, setExpandidos]           = useState<Set<string>>(new Set())
  const [expandEstados, setExpandEstados]     = useState<Set<string>>(new Set(ESTADOS_FAT))
  const [editedProjecoes, setEditedProjecoes] = useState<EditedProjecoes>({})

  const handleEditProjecao = useCallback((item: string, mes: typeof MESES[number], valor: number) => {
    setEditedProjecoes(prev => ({
      ...prev,
      [item]: { ...prev[item], [mes]: valor },
    }))
  }, [])

  const getProjecao = useCallback((c: FaturamentoContrato, m: typeof MESES[number]) =>
    editedProjecoes[c.item]?.[m] ?? c.projecao[m] ?? 0,
  [editedProjecoes])

  const contratos = useMemo(() =>
    filtroEstados.length === 0
      ? faturamentoContratos
      : faturamentoContratos.filter(c => filtroEstados.includes(c.estado)),
    [filtroEstados]
  )

  const totalProj  = contratos.reduce((s, c) => s + MESES.reduce((ss, m) => ss + getProjecao(c, m), 0), 0)
  const totalReal  = contratos.reduce((s, c) => s + MESES.reduce((ss, m) => ss + (c.real?.[m] ?? 0), 0), 0)
  const pctExec    = totalProj > 0 ? (totalReal / totalProj) * 100 : 0

  // Gráfico mensal (acumulado dos contratos filtrados)
  const chartData = MESES.map((m, i) => ({
    mes: MESES_LABEL[i],
    Projetado: contratos.reduce((s, c) => s + getProjecao(c, m), 0),
    Realizado: contratos.reduce((s, c) => s + (c.real?.[m] ?? 0), 0),
  }))

  // Total acumulado realizado para comparar com metas
  const acumuladoReal = contratos.reduce((s, c) =>
    s + MESES.reduce((ss, m) => ss + (c.real?.[m] ?? 0), 0), 0)

  const estadosPresentes = [...new Set(contratos.map(c => c.estado).filter(Boolean))].sort()

  const toggleExpand = (item: string) => {
    setExpandidos(prev => {
      const next = new Set(prev)
      next.has(item) ? next.delete(item) : next.add(item)
      return next
    })
  }

  const toggleEstado = (estado: string) => {
    setExpandEstados(prev => {
      const next = new Set(prev)
      next.has(estado) ? next.delete(estado) : next.add(estado)
      return next
    })
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Faturamento 2026</h1>
          <p className="text-gray-500 text-sm mt-1">Projeção de faturamento por contrato e mês — exercício 2026</p>
        </div>
        <div className="flex items-center gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Filtrar por estado</label>
            <MultiSelect
              placeholder="Todos os estados"
              opcoes={ESTADOS_FAT.map(e => ({ value: e, label: e }))}
              selecionadas={filtroEstados}
              onChange={setFiltroEstados}
            />
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Total Projetado 2026</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{fmtM(totalProj)}</p>
          <p className="text-xs text-gray-400 mt-1">{contratos.length} contrato(s)</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Total Realizado (Jan–Mai)</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{fmtM(totalReal)}</p>
          <p className="text-xs text-gray-400 mt-1">{pctExec.toFixed(1)}% do projetado</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">META 01</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">R$ 130M</p>
          <p className={`text-xs mt-1 font-medium ${acumuladoReal >= METAS.META01 ? 'text-green-600' : 'text-red-500'}`}>
            {acumuladoReal >= METAS.META01 ? '✓ Atingida' : `Faltam ${fmtM(METAS.META01 - acumuladoReal)}`}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">META 02 / META 03</p>
          <p className="text-2xl font-bold text-purple-700 mt-1">R$ 170M / 200M</p>
          <p className="text-xs text-gray-400 mt-1">Metas anuais escalonadas</p>
        </div>
      </div>

      {/* Gráfico mensal */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Faturamento Mensal — Projetado vs Realizado</h3>
        <p className="text-xs text-gray-400 mb-4">Valores realizados disponíveis até maio/2026. Linhas de meta anuais (META01 R$130M · META02 R$170M · META03 R$200M) são acumuladas.</p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ left: 10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis
              tickFormatter={v => v >= 1_000_000 ? `${(v/1_000_000).toFixed(0)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)}
              tick={{ fontSize: 10 }}
              width={45}
            />
            <Tooltip formatter={(v: number) => fmt(v)} />
            <Legend />
            <Bar dataKey="Projetado" fill="#93c5fd" radius={[4,4,0,0]} />
            <Bar dataKey="Realizado" fill="#2563eb" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tabela por estado → contratos */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Detalhamento por Estado e Contrato</h3>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Projetado</span>
            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Realizado</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 1200 }}>
            <thead className="sticky top-0 z-10 bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider w-8">#</th>
                <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider" style={{ minWidth: 220 }}>Contrato</th>
                <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Estado</th>
                <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tipo</th>
                <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Valor Contrato</th>
                <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Saldo</th>
                {MESES_LABEL.map(m => (
                  <th key={m} className="px-2 py-2 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider border-l border-gray-100" style={{ minWidth: 72 }}>{m}</th>
                ))}
                <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider border-l border-gray-100 whitespace-nowrap">Total 2026</th>
              </tr>
            </thead>
            <tbody>
              {estadosPresentes.map(estado => {
                const estadoContratos = contratos.filter(c => c.estado === estado)
                const isExpanded = expandEstados.has(estado)
                const totalEstadoProj = estadoContratos.reduce((s, c) => s + MESES.reduce((ss, m) => ss + getProjecao(c, m), 0), 0)
                const totalEstadoReal = estadoContratos.reduce((s, c) => s + MESES.reduce((ss, m) => ss + (c.real?.[m] ?? 0), 0), 0)

                return (
                  <>
                    {/* Linha de agrupamento por estado */}
                    <tr
                      key={`g-${estado}`}
                      className="bg-gray-100 cursor-pointer hover:bg-gray-200 select-none"
                      onClick={() => toggleEstado(estado)}
                    >
                      <td colSpan={3} className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {isExpanded ? <ChevronDown size={13} className="text-gray-500" /> : <ChevronRight size={13} className="text-gray-500" />}
                          <EstadoBadge estado={estado} />
                          <span className="text-[10px] text-gray-400">({estadoContratos.length} contrato{estadoContratos.length > 1 ? 's' : ''})</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="text-xs font-bold text-blue-700">{fmtM(estadoContratos.reduce((s,c) => s + c.valor_contrato + c.aditivo, 0))}</span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="text-xs text-gray-500">{fmtM(estadoContratos.reduce((s,c) => {
                          const real = MESES.reduce((ss, m) => ss + (c.real?.[m] ?? 0), 0)
                          return s + (c.saldo - real)
                        }, 0))}</span>
                      </td>
                      {MESES.map((m, i) => {
                        const proj = estadoContratos.reduce((s, c) => s + getProjecao(c, m), 0)
                        const real = estadoContratos.reduce((s, c) => s + (c.real?.[m] ?? 0), 0)
                        return (
                          <td key={m} className="px-2 py-1.5 text-right border-l border-gray-200" style={{ minWidth: 72 }}>
                            {proj > 0 && <div className="text-[10px] font-semibold text-blue-700">{fmtM(proj)}</div>}
                          {i <= 4 && real > 0 && <div className="text-[10px] font-semibold text-green-600">{fmtM(real)}</div>}
                          </td>
                        )
                      })}
                      <td className="px-3 py-2 text-right border-l border-gray-200">
                        <div className="text-xs font-bold text-blue-700">{fmtM(totalEstadoProj)}</div>
                        {totalEstadoReal > 0 && <div className="text-[10px] text-green-600">✓ {fmtM(totalEstadoReal)}</div>}
                      </td>
                    </tr>

                    {/* Contratos do estado */}
                    {isExpanded && estadoContratos.map(c => (
                      <ContratoRow
                        key={c.item}
                        c={c}
                        expandido={expandidos.has(c.item)}
                        projecaoEditada={editedProjecoes[c.item] ?? {}}
                        onEditProjecao={(mes, valor) => handleEditProjecao(c.item, mes, valor)}
                      />
                    ))}
                  </>
                )
              })}

              {/* Linha de totais gerais */}
              <tr className="bg-blue-50 border-t-2 border-blue-200">
                <td colSpan={4} className="px-4 py-3 text-xs font-bold text-blue-900 uppercase tracking-wider">TOTAL GERAL</td>
                <td className="px-3 py-3 text-right text-xs font-bold text-blue-900">
                  {fmt(contratos.reduce((s, c) => s + c.valor_contrato + c.aditivo, 0))}
                </td>
                <td className="px-3 py-3 text-right text-xs font-bold text-blue-900">
                  {fmt(contratos.reduce((s, c) => {
                    const real = MESES.reduce((ss, m) => ss + (c.real?.[m] ?? 0), 0)
                    return s + (c.saldo - real)
                  }, 0))}
                </td>
                {MESES.map((m, i) => {
                  const proj = contratos.reduce((s, c) => s + getProjecao(c, m), 0)
                  const real = contratos.reduce((s, c) => s + (c.real?.[m] ?? 0), 0)
                  return (
                    <td key={m} className="px-2 py-3 text-right border-l border-blue-200" style={{ minWidth: 72 }}>
                      <div className="text-[10px] font-bold text-blue-700">{fmtM(proj)}</div>
                      {i <= 4 && real > 0 && <div className="text-[10px] font-bold text-green-700">{fmtM(real)}</div>}
                    </td>
                  )
                })}
                <td className="px-3 py-3 text-right border-l border-blue-200">
                  <div className="text-xs font-bold text-blue-700">{fmtM(totalProj)}</div>
                  {totalReal > 0 && <div className="text-[10px] font-bold text-green-700">{fmtM(totalReal)}</div>}
                  <div className="text-[10px] text-gray-500">{pctExec.toFixed(0)}% exec.</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Legenda de metas */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex flex-wrap gap-4 text-xs text-gray-500">
          <span><strong className="text-amber-600">META 01:</strong> R$ 130.000.000</span>
          <span><strong className="text-orange-600">META 02:</strong> R$ 170.000.000</span>
          <span><strong className="text-red-600">META 03:</strong> R$ 200.000.000</span>
          <span className="ml-auto text-gray-400">* Valores realizados disponíveis até maio/2026</span>
        </div>
      </div>
    </div>
  )
}
