import { useState } from 'react'
import { X, Plus, DollarSign, Trash2 } from 'lucide-react'
import type { Obra } from '../types'
import { useObras } from '../contexts/ObrasContext'

interface Props {
  obra: Obra
  onClose: () => void
}

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const fmtDate = (d: string) => { const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}` }

export default function HistoricoMedicoesModal({ obra, onClose }: Props) {
  const { updateObra } = useObras()
  const [novaData, setNovaData] = useState(new Date().toISOString().split('T')[0])
  const [novoValor, setNovoValor] = useState('')
  const [novaDescricao, setNovaDescricao] = useState('')
  const [erro, setErro] = useState('')

  const historico = [...(obra.historicoMedicoes ?? [])].sort((a, b) => b.data.localeCompare(a.data))
  const totalMedido = historico.reduce((s, h) => s + h.valorMedido, 0)

  const handleAdd = () => {
    const val = parseFloat(novoValor.replace(',', '.'))
    if (isNaN(val) || val <= 0) { setErro('Digite um valor válido maior que zero.'); return }
    setErro('')
    const nova = { data: novaData, valorMedido: val, descricao: novaDescricao.trim() || undefined }
    const hist = [...(obra.historicoMedicoes ?? []), nova].sort((a, b) => a.data.localeCompare(b.data))
    updateObra(obra.id, { historicoMedicoes: hist, valorMedido: hist.reduce((s, h) => s + h.valorMedido, 0) })
    setNovoValor('')
    setNovaDescricao('')
  }

  const handleDelete = (idx: number) => {
    const sorted = [...(obra.historicoMedicoes ?? [])].sort((a, b) => b.data.localeCompare(a.data))
    const item = sorted[idx]
    const novoHist = (obra.historicoMedicoes ?? []).filter(
      h => !(h.data === item.data && h.valorMedido === item.valorMedido)
    )
    updateObra(obra.id, { historicoMedicoes: novoHist, valorMedido: novoHist.reduce((s, h) => s + h.valorMedido, 0) })
  }

  // SVG chart
  const W = 520, H = 130, PAD = { t: 16, r: 20, b: 28, l: 60 }
  const chartW = W - PAD.l - PAD.r
  const chartH = H - PAD.t - PAD.b
  const sorted = [...historico].sort((a, b) => a.data.localeCompare(b.data))
  const maxVal = Math.max(...sorted.map(h => h.valorMedido), 1)
  const toX = (i: number) => PAD.l + (sorted.length > 1 ? (i / (sorted.length - 1)) * chartW : chartW / 2)
  const toY = (v: number) => PAD.t + chartH - (v / maxVal) * chartH

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <DollarSign size={18} className="text-green-600" />
              Histórico de Medições
            </h2>
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[400px]">{obra.localidade}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Resumo */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Medido', value: fmtBRL(totalMedido), cor: 'text-green-700', bg: 'bg-green-50' },
              { label: 'Valor de Venda', value: fmtBRL(obra.venda || 0), cor: 'text-blue-700', bg: 'bg-blue-50' },
              { label: 'Medições', value: `${historico.length}`, cor: 'text-gray-700', bg: 'bg-gray-50' },
            ].map(c => (
              <div key={c.label} className={`${c.bg} rounded-xl px-4 py-3 text-center`}>
                <p className={`text-lg font-black ${c.cor}`}>{c.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{c.label}</p>
              </div>
            ))}
          </div>

          {/* Gráfico */}
          {sorted.length >= 2 && (
            <div className="bg-gray-50 rounded-xl p-3 overflow-x-auto">
              <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block min-w-full">
                <defs>
                  <linearGradient id="medGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#16a34a" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#16a34a" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                {[0, 0.25, 0.5, 0.75, 1].map(f => (
                  <g key={f}>
                    <line x1={PAD.l} y1={toY(maxVal * f)} x2={PAD.l + chartW} y2={toY(maxVal * f)}
                      stroke="#e5e7eb" strokeWidth={1} strokeDasharray="4 4" />
                    <text x={PAD.l - 4} y={toY(maxVal * f) + 4} textAnchor="end" fontSize={9} fill="#9ca3af">
                      {(maxVal * f / 1000).toFixed(0)}k
                    </text>
                  </g>
                ))}
                <path
                  d={sorted.map((h, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(h.valorMedido).toFixed(1)}`).join(' ')
                    + ` L ${toX(sorted.length - 1).toFixed(1)} ${(PAD.t + chartH).toFixed(1)} L ${toX(0).toFixed(1)} ${(PAD.t + chartH).toFixed(1)} Z`}
                  fill="url(#medGrad)"
                />
                <path
                  d={sorted.map((h, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(h.valorMedido).toFixed(1)}`).join(' ')}
                  fill="none" stroke="#16a34a" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                />
                {sorted.map((h, i) => (
                  <circle key={i} cx={toX(i)} cy={toY(h.valorMedido)} r={3.5} fill="white" stroke="#16a34a" strokeWidth={2} />
                ))}
                {sorted.map((h, i) => (
                  (i === 0 || i === sorted.length - 1) && (
                    <text key={i} x={toX(i)} y={H - 4} textAnchor="middle" fontSize={9} fill="#9ca3af">
                      {fmtDate(h.data)}
                    </text>
                  )
                ))}
              </svg>
            </div>
          )}

          {/* Formulário */}
          <div className="border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Plus size={14} className="text-green-500" /> Registrar medição
            </h3>
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Data</label>
                <input type="date" value={novaData} onChange={e => setNovaData(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Valor medido (R$)</label>
                <input type="number" min={0} step={1000} value={novoValor} onChange={e => setNovoValor(e.target.value)}
                  placeholder="Ex: 50000"
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-green-400" />
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="text-xs text-gray-500 block mb-1">Descrição (opcional)</label>
                <input type="text" value={novaDescricao} onChange={e => setNovaDescricao(e.target.value)}
                  placeholder="Ex: Medição nº 3"
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              </div>
              <button onClick={handleAdd}
                className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                <Plus size={14} /> Registrar
              </button>
            </div>
            {erro && <p className="text-xs text-red-500 mt-1.5">{erro}</p>}
          </div>

          {/* Tabela */}
          {historico.length > 0 && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Data</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Valor</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Descrição</th>
                    <th className="px-1 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {historico.map((h, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-700 whitespace-nowrap">{fmtDate(h.data)}</td>
                      <td className="px-4 py-2 font-semibold text-green-700 whitespace-nowrap">{fmtBRL(h.valorMedido)}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{h.descricao ?? '—'}</td>
                      <td className="px-2 py-2">
                        <button onClick={() => handleDelete(i)}
                          className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {historico.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-6">Nenhuma medição registrada ainda.</p>
          )}
        </div>
      </div>
    </div>
  )
}
