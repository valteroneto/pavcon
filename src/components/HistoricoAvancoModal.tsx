import { useState, useRef } from 'react'
import { X, Plus, TrendingUp, Trash2 } from 'lucide-react'
import type { Obra } from '../types'
import { useObras } from '../contexts/ObrasContext'

interface Props {
  obra: Obra
  onClose: () => void
}

export default function HistoricoAvancoModal({ obra, onClose }: Props) {
  const { registrarAvanco, updateObra } = useObras()
  const [novoAvanco, setNovoAvanco] = useState(String(obra.avancoPct))
  const [novaData, setNovaData] = useState(new Date().toISOString().split('T')[0])
  const [erro, setErro] = useState('')

  const historico = obra.historicoAvanco ?? []

  // Garante que o avanço atual sempre apareça se o histórico estiver vazio
  const pontos = historico.length === 0 && obra.dataInicio
    ? [{ data: obra.dataInicio, avancoPct: 0 }, { data: new Date().toISOString().split('T')[0], avancoPct: obra.avancoPct }]
    : historico.length === 1
      ? [{ data: obra.dataInicio || historico[0].data, avancoPct: 0 }, ...historico]
      : [...historico]

  // Normaliza para chart
  const sorted = [...pontos].sort((a, b) => a.data.localeCompare(b.data))

  const handleAdd = () => {
    const pct = parseFloat(novoAvanco)
    if (isNaN(pct) || pct < 0 || pct > 100) { setErro('Valor entre 0 e 100'); return }
    setErro('')
    // Adiciona ao histórico
    const novaEntrada = { data: novaData, avancoPct: pct }
    const hist = [...historico, novaEntrada].sort((a, b) => a.data.localeCompare(b.data))
    // Atualiza avancoPct da obra com o valor mais recente
    const ultimo = hist[hist.length - 1]
    updateObra(obra.id, { historicoAvanco: hist, avancoPct: ultimo.avancoPct })
    setNovoAvanco(String(pct))
  }

  const handleDelete = (idx: number) => {
    const novoHist = historico.filter((_, i) => i !== idx)
    const ultimo = novoHist.length > 0 ? novoHist[novoHist.length - 1].avancoPct : obra.avancoPct
    updateObra(obra.id, { historicoAvanco: novoHist, avancoPct: ultimo })
  }

  // SVG Line Chart
  const W = 520, H = 160, PAD = { t: 16, r: 20, b: 32, l: 44 }
  const chartW = W - PAD.l - PAD.r
  const chartH = H - PAD.t - PAD.b

  const minDate = sorted.length > 0 ? sorted[0].data : ''
  const maxDate = sorted.length > 0 ? sorted[sorted.length - 1].data : ''
  const dateRange = minDate && maxDate && minDate !== maxDate
    ? new Date(maxDate).getTime() - new Date(minDate).getTime()
    : 1

  const toX = (d: string) => {
    if (!minDate || dateRange === 0) return PAD.l + chartW / 2
    return PAD.l + ((new Date(d).getTime() - new Date(minDate).getTime()) / dateRange) * chartW
  }
  const toY = (v: number) => PAD.t + chartH - (v / 100) * chartH

  const pathD = sorted.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${toX(p.data).toFixed(1)} ${toY(p.avancoPct).toFixed(1)}`
  ).join(' ')

  const fmtDate = (d: string) => {
    const [y, m, dd] = d.split('-')
    return `${dd}/${m}/${y}`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp size={18} className="text-blue-600" />
              Histórico de Avanço
            </h2>
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[400px]">{obra.localidade}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Avanço atual */}
          <div className="flex items-center gap-4">
            <div className="bg-blue-50 rounded-2xl px-6 py-3 text-center">
              <p className="text-3xl font-black text-blue-700">{obra.avancoPct}%</p>
              <p className="text-xs text-blue-500 mt-0.5">Avanço atual</p>
            </div>
            <div className="flex-1">
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-3 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all"
                  style={{ width: `${Math.min(obra.avancoPct, 100)}%` }} />
              </div>
              <p className="text-xs text-gray-400 mt-1.5">{historico.length} registro{historico.length !== 1 ? 's' : ''} no histórico</p>
            </div>
          </div>

          {/* Gráfico */}
          {sorted.length >= 2 && (
            <div className="bg-gray-50 rounded-xl p-3 overflow-x-auto">
              <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block min-w-full">
                {/* Grid lines */}
                {[0, 25, 50, 75, 100].map(v => (
                  <g key={v}>
                    <line x1={PAD.l} y1={toY(v)} x2={PAD.l + chartW} y2={toY(v)}
                      stroke="#e5e7eb" strokeWidth={1} strokeDasharray="4 4" />
                    <text x={PAD.l - 6} y={toY(v) + 4} textAnchor="end" fontSize={10} fill="#9ca3af">{v}%</text>
                  </g>
                ))}

                {/* Area fill */}
                {sorted.length >= 2 && (
                  <path
                    d={`${pathD} L ${toX(sorted[sorted.length - 1].data).toFixed(1)} ${(PAD.t + chartH).toFixed(1)} L ${toX(sorted[0].data).toFixed(1)} ${(PAD.t + chartH).toFixed(1)} Z`}
                    fill="url(#areaGrad)" opacity={0.3}
                  />
                )}

                {/* Gradient */}
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
                  </linearGradient>
                </defs>

                {/* Line */}
                <path d={pathD} fill="none" stroke="#2563eb" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

                {/* Points */}
                {sorted.map((p, i) => (
                  <g key={i}>
                    <circle cx={toX(p.data)} cy={toY(p.avancoPct)} r={4} fill="white" stroke="#2563eb" strokeWidth={2} />
                    {i === sorted.length - 1 && (
                      <text x={toX(p.data)} y={toY(p.avancoPct) - 8} textAnchor="middle" fontSize={10} fontWeight="bold" fill="#2563eb">
                        {p.avancoPct}%
                      </text>
                    )}
                  </g>
                ))}

                {/* X axis dates */}
                {sorted.map((p, i) => (
                  (i === 0 || i === sorted.length - 1 || sorted.length <= 5) && (
                    <text key={i} x={toX(p.data)} y={H - 4} textAnchor="middle" fontSize={9} fill="#9ca3af">
                      {fmtDate(p.data)}
                    </text>
                  )
                ))}
              </svg>
            </div>
          )}

          {/* Adicionar registro */}
          <div className="border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Plus size={14} className="text-green-500" />
              Registrar avanço
            </h3>
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Data</label>
                <input type="date" value={novaData} onChange={e => setNovaData(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Avanço (%)</label>
                <input type="number" min={0} max={100} step={0.1} value={novoAvanco}
                  onChange={e => setNovoAvanco(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <button onClick={handleAdd}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                <Plus size={14} />
                Registrar
              </button>
            </div>
            {erro && <p className="text-xs text-red-500 mt-1.5">{erro}</p>}
          </div>

          {/* Tabela de registros */}
          {historico.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Registros</h3>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Data</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Avanço</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Variação</th>
                      <th className="px-1 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[...historico].sort((a, b) => b.data.localeCompare(a.data)).map((h, i, arr) => {
                      const prev = arr[i + 1]
                      const delta = prev ? h.avancoPct - prev.avancoPct : null
                      return (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-700">{fmtDate(h.data)}</td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-1.5 rounded-full bg-blue-500"
                                  style={{ width: `${Math.min(h.avancoPct, 100)}%` }} />
                              </div>
                              <span className="font-semibold text-blue-700">{h.avancoPct}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            {delta !== null && (
                              <span className={`text-xs font-medium ${delta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2">
                            <button onClick={() => handleDelete(historico.findIndex(x => x.data === h.data && x.avancoPct === h.avancoPct))}
                              className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
