import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { faturamentoContratos } from '../data/faturamentoData'

const TODAY = new Date('2026-06-08')

function diasRestantes(dataFim: string): number {
  const fim = new Date(dataFim + 'T00:00:00')
  return Math.ceil((fim.getTime() - TODAY.getTime()) / 86400000)
}

export default function AlertasPrazo({ collapsible = false }: { collapsible?: boolean }) {
  const [collapsed, setCollapsed] = useState(false)

  const alertas = faturamentoContratos
    .map(c => ({ ...c, dias: diasRestantes(c.data_fim) }))
    .filter(c => c.dias <= 60 && c.dias >= 0)
    .sort((a, b) => a.dias - b.dias)

  const vermelhos = alertas.filter(c => c.dias <= 30)
  const ambareis  = alertas.filter(c => c.dias > 30)

  if (alertas.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
      <div
        className={`flex items-center justify-between px-4 py-3 bg-amber-50 border-b border-amber-200 ${collapsible ? 'cursor-pointer' : ''}`}
        onClick={() => collapsible && setCollapsed(v => !v)}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-600" />
          <span className="text-sm font-semibold text-amber-800">
            Contratos com Prazo Próximo — {alertas.length} contrato(s)
          </span>
          {vermelhos.length > 0 && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
              {vermelhos.length} crítico(s) ≤30 dias
            </span>
          )}
        </div>
        {collapsible && (collapsed ? <ChevronDown size={16} className="text-amber-600" /> : <ChevronUp size={16} className="text-amber-600" />)}
      </div>

      {(!collapsible || !collapsed) && (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {vermelhos.map(c => (
            <div key={c.item} className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold text-red-800 leading-tight flex-1">{c.contrato}</p>
                <span className="shrink-0 text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                  {c.dias}d
                </span>
              </div>
              <p className="text-xs text-red-600 mt-1">Vence em: {new Date(c.data_fim + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
            </div>
          ))}
          {ambareis.map(c => (
            <div key={c.item} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold text-amber-800 leading-tight flex-1">{c.contrato}</p>
                <span className="shrink-0 text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                  {c.dias}d
                </span>
              </div>
              <p className="text-xs text-amber-600 mt-1">Vence em: {new Date(c.data_fim + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
