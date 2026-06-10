import { useState, useMemo } from 'react'
import { Save, RefreshCw } from 'lucide-react'
import { faturamentoContratos, MESES, MESES_LABEL } from '../data/faturamentoData'
import type { Mes } from '../data/faturamentoData'
import { useFaturamento } from '../contexts/FaturamentoContext'
import { useObras } from '../contexts/ObrasContext'

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

export default function Medicoes() {
  const { editedProjecoes, realOverrides, setMesReal } = useFaturamento()
  const { obras } = useObras()
  const [mesSel, setMesSel] = useState<Mes>('junho')
  const [localValues, setLocalValues] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)

  // Soma de valorMedido das obras vinculadas a cada contrato
  const valorMedidoPorContrato = useMemo(() => {
    const map: Record<string, number> = {}
    for (const o of obras) {
      if (o.contratoItem) {
        map[o.contratoItem] = (map[o.contratoItem] ?? 0) + (o.valorMedido ?? 0)
      }
    }
    return map
  }, [obras])

  const getProj = (id: string, m: Mes) =>
    editedProjecoes[id]?.[m] ?? faturamentoContratos.find(c => c.item === id)?.projecao[m] ?? 0

  // Prioridade: edição local > override salvo > soma das obras vinculadas
  const getReal = (id: string, m: Mes): number => {
    if (localValues[id] !== undefined) return Number(localValues[id]) || 0
    if (realOverrides[id]?.[m] !== undefined) return realOverrides[id][m]
    return valorMedidoPorContrato[id] ?? 0
  }

  // Indica se o valor vem das obras (sem override manual)
  const isFromObras = (id: string, m: Mes) =>
    localValues[id] === undefined && realOverrides[id]?.[m] === undefined && (valorMedidoPorContrato[id] ?? 0) > 0

  const handleChange = (id: string, val: string) => {
    setLocalValues(prev => ({ ...prev, [id]: val }))
    setSaved(false)
  }

  const handleSave = () => {
    for (const c of faturamentoContratos) {
      if (localValues[c.item] !== undefined) {
        setMesReal(c.item, mesSel, Number(localValues[c.item]) || 0)
      }
    }
    setLocalValues({})
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const totalProj = faturamentoContratos.reduce((s, c) => s + getProj(c.item, mesSel), 0)
  const totalReal = faturamentoContratos.reduce((s, c) => s + getReal(c.item, mesSel), 0)
  const totalDiff = totalReal - totalProj
  const totalPct = totalProj > 0 ? (totalReal / totalProj) * 100 : 0

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Medições Mensais</h1>
          <p className="text-gray-500 text-sm mt-1">
            Valores realizados por contrato — preenchidos automaticamente da aba de Obras
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={mesSel}
            onChange={e => { setMesSel(e.target.value as Mes); setLocalValues({}) }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium"
          >
            {MESES.map(m => (
              <option key={m} value={m}>{MESES_LABEL[MESES.indexOf(m)]} 2026</option>
            ))}
          </select>
          <button
            onClick={handleSave}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${saved ? 'bg-green-600 text-white' : 'bg-blue-700 hover:bg-blue-800 text-white'}`}
          >
            <Save size={15} /> {saved ? 'Salvo!' : 'Salvar'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 w-8">#</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Contrato</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Estado</th>
                <th className="px-4 py-3 text-right font-semibold text-blue-700">Projetado</th>
                <th className="px-4 py-3 text-right font-semibold text-green-700">
                  <div>Realizado</div>
                  <div className="text-[10px] font-normal text-gray-400 normal-case">🔗 = soma das obras vinculadas</div>
                </th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Diferença</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">% Atingido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {faturamentoContratos.map((c, idx) => {
                const proj = getProj(c.item, mesSel)
                const real = getReal(c.item, mesSel)
                const diff = real - proj
                const pct = proj > 0 ? (real / proj) * 100 : 0
                return (
                  <tr key={c.item} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-800 max-w-[220px]">
                      <div className="truncate" title={c.contrato}>{c.contrato}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.estado}</td>
                    <td className="px-4 py-3 text-right text-blue-700 font-medium">{fmtBRL(proj)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <div className="flex items-center gap-1">
                          {isFromObras(c.item, mesSel) && (
                            <span title="Valor automático das obras vinculadas" className="text-[9px] font-bold text-teal-600 bg-teal-50 border border-teal-200 px-1 rounded">OBRAS</span>
                          )}
                          <input
                            type="number"
                            value={localValues[c.item] ?? (realOverrides[c.item]?.[mesSel] ?? valorMedidoPorContrato[c.item] ?? 0)}
                            onChange={e => handleChange(c.item, e.target.value)}
                            className={`w-32 text-right border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400 ${isFromObras(c.item, mesSel) ? 'border-teal-300 bg-teal-50/40' : 'border-gray-300'}`}
                          />
                        </div>
                        {realOverrides[c.item]?.[mesSel] !== undefined && localValues[c.item] === undefined && (
                          <button
                            onClick={() => { setMesReal(c.item, mesSel, valorMedidoPorContrato[c.item] ?? 0); setSaved(false) }}
                            className="flex items-center gap-0.5 text-[9px] text-gray-400 hover:text-teal-600 transition-colors"
                            title="Restaurar valor das obras"
                          >
                            <RefreshCw size={9} /> restaurar das obras
                          </button>
                        )}
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${diff >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {diff >= 0 ? '+' : ''}{fmtBRL(diff)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pct >= 100 ? 'bg-green-100 text-green-700' : pct >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                        {pct.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-[#0f2557] text-white font-bold text-sm">
                <td className="px-4 py-3" colSpan={3}>TOTAL — {MESES_LABEL[MESES.indexOf(mesSel)]} 2026</td>
                <td className="px-4 py-3 text-right text-amber-300">{fmtBRL(totalProj)}</td>
                <td className="px-4 py-3 text-right text-green-300">{fmtBRL(totalReal)}</td>
                <td className={`px-4 py-3 text-right ${totalDiff >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                  {totalDiff >= 0 ? '+' : ''}{fmtBRL(totalDiff)}
                </td>
                <td className="px-4 py-3 text-right text-amber-300">{totalPct.toFixed(1)}%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
