import { useState } from 'react'
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps'
import { useObras } from '../contexts/ObrasContext'
import type { StatusObra } from '../types'

const GEO_URL = '/brazil-states.geojson'

const STATUS_COLORS: Record<StatusObra, string> = {
  'A Iniciar': '#f59e0b',
  'Execução':  '#2563eb',
  'Concluída': '#16a34a',
  'Paralisada':'#9ca3af',
}

const ESTADOS: Record<string, string> = {
  AC:'Acre', AL:'Alagoas', AP:'Amapá', AM:'Amazonas', BA:'Bahia',
  CE:'Ceará', DF:'Distrito Federal', ES:'Espírito Santo', GO:'Goiás',
  MA:'Maranhão', MT:'Mato Grosso', MS:'Mato Grosso do Sul', MG:'Minas Gerais',
  PA:'Pará', PB:'Paraíba', PR:'Paraná', PE:'Pernambuco', PI:'Piauí',
  RJ:'Rio de Janeiro', RN:'Rio Grande do Norte', RS:'Rio Grande do Sul',
  RO:'Rondônia', RR:'Roraima', SC:'Santa Catarina', SP:'São Paulo',
  SE:'Sergipe', TO:'Tocantins',
}

function fillColor(count: number): string {
  if (count === 0) return '#e2e8f0'
  if (count <= 2)  return '#93c5fd'
  if (count <= 5)  return '#3b82f6'
  return '#1d4ed8'
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

export default function Mapa() {
  const { obras } = useObras()
  const [selectedUFs, setSelectedUFs] = useState<Set<string>>(new Set())
  const [tooltip, setTooltip] = useState<{ uf: string; nome: string; count: number; x: number; y: number } | null>(null)

  const ufCount: Record<string, number> = {}
  for (const o of obras) {
    const uf = (o.engenharia ?? '').toUpperCase()
    if (uf) ufCount[uf] = (ufCount[uf] ?? 0) + 1
  }

  const toggleUF = (uf: string) => {
    setSelectedUFs(prev => {
      const next = new Set(prev)
      next.has(uf) ? next.delete(uf) : next.add(uf)
      return next
    })
  }

  const clearSelection = () => setSelectedUFs(new Set())

  const obrasFiltradas = selectedUFs.size > 0
    ? obras.filter(o => selectedUFs.has((o.engenharia ?? '').toUpperCase()))
    : []

  const statusCount = (s: StatusObra) => obrasFiltradas.filter(o => o.status === s).length
  const totalVenda   = obrasFiltradas.reduce((s, o) => s + (o.venda ?? 0), 0)
  const mediaAvanco  = obrasFiltradas.length
    ? obrasFiltradas.reduce((s, o) => s + (o.avancoPct ?? 0), 0) / obrasFiltradas.length
    : 0

  const selectedLabel = selectedUFs.size === 0
    ? null
    : selectedUFs.size === 1
      ? ESTADOS[[...selectedUFs][0]] ?? [...selectedUFs][0]
      : `${selectedUFs.size} estados`

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mapa das Obras</h1>
          <p className="text-gray-500 text-sm mt-1">
            Distribuição geográfica por estado — clique para selecionar (múltipla seleção)
          </p>
        </div>
        {selectedUFs.size > 0 && (
          <button
            onClick={clearSelection}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-500 border border-gray-200 hover:border-red-300 rounded-lg px-3 py-1.5 transition-colors"
          >
            ✕ Limpar seleção ({selectedUFs.size})
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Mapa SVG */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-4 relative">
          {/* Tags dos estados selecionados */}
          {selectedUFs.size > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {[...selectedUFs].map(uf => (
                <span
                  key={uf}
                  className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 border border-orange-200 text-xs font-semibold px-2 py-0.5 rounded-full"
                >
                  {uf}
                  <button onClick={() => toggleUF(uf)} className="hover:text-red-600 leading-none">×</button>
                </span>
              ))}
            </div>
          )}

          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ center: [-54, -15], scale: 680 }}
            width={700}
            height={520}
            style={{ width: '100%', height: 'auto' }}
          >
            <ZoomableGroup zoom={1}>
              <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                  geographies.map(geo => {
                    const uf        = (geo.properties.sigla as string).toUpperCase()
                    const count     = ufCount[uf] ?? 0
                    const isSelected = selectedUFs.has(uf)
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        onClick={() => toggleUF(uf)}
                        onMouseEnter={e => {
                          const rect = (e.target as SVGElement).closest('svg')?.getBoundingClientRect()
                          setTooltip({ uf, nome: ESTADOS[uf] ?? uf, count, x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) })
                        }}
                        onMouseLeave={() => setTooltip(null)}
                        style={{
                          default: {
                            fill: isSelected ? '#f97316' : fillColor(count),
                            stroke: '#fff',
                            strokeWidth: isSelected ? 1.8 : 0.8,
                            outline: 'none',
                            cursor: 'pointer',
                            transition: 'fill 0.12s',
                          },
                          hover: {
                            fill: isSelected ? '#ea580c' : '#fb923c',
                            stroke: '#fff',
                            strokeWidth: 1.5,
                            outline: 'none',
                            cursor: 'pointer',
                          },
                          pressed: {
                            fill: '#ea580c',
                            outline: 'none',
                          },
                        }}
                      />
                    )
                  })
                }
              </Geographies>
            </ZoomableGroup>
          </ComposableMap>

          {/* Tooltip */}
          {tooltip && (
            <div
              className="absolute pointer-events-none bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg z-10"
              style={{ left: tooltip.x + 10, top: tooltip.y - 36 }}
            >
              <span className="font-bold">{tooltip.nome}</span>
              {' — '}
              <span>{tooltip.count} obra{tooltip.count !== 1 ? 's' : ''}</span>
              {selectedUFs.has(tooltip.uf) && <span className="ml-1 text-orange-300">(selecionado)</span>}
            </div>
          )}

          {/* Legenda */}
          <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600">
            <p className="font-semibold mb-1.5 text-gray-700">Nº de obras</p>
            {[
              { bg: '#e2e8f0', label: '0' },
              { bg: '#93c5fd', label: '1–2' },
              { bg: '#3b82f6', label: '3–5' },
              { bg: '#1d4ed8', label: '6+' },
              { bg: '#f97316', label: 'Selecionado' },
            ].map(({ bg, label }) => (
              <div key={label} className="flex items-center gap-1.5 mb-0.5">
                <div className="w-3.5 h-3.5 rounded-sm border border-gray-300" style={{ background: bg }} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Painel lateral */}
        <div className="flex flex-col gap-4 overflow-hidden" style={{ maxHeight: 560 }}>
          {selectedUFs.size === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col items-center justify-center h-48 text-gray-400">
              <svg className="w-8 h-8 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <p className="text-sm">Clique em um ou mais estados</p>
            </div>
          ) : (
            <>
              {/* Resumo da seleção */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-gray-900">{selectedLabel}</h3>
                    {selectedUFs.size > 1 && (
                      <p className="text-xs text-gray-400 mt-0.5">{[...selectedUFs].join(', ')}</p>
                    )}
                  </div>
                  <button onClick={clearSelection}
                    className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-2 py-1">
                    Limpar
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-blue-700">{obrasFiltradas.length}</p>
                    <p className="text-xs text-blue-500">Total de obras</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-orange-600">{mediaAvanco.toFixed(0)}%</p>
                    <p className="text-xs text-orange-500">Avanço médio</p>
                  </div>
                  {totalVenda > 0 && (
                    <div className="col-span-2 bg-green-50 rounded-lg p-3 text-center">
                      <p className="text-base font-bold text-green-700">{fmtBRL(totalVenda)}</p>
                      <p className="text-xs text-green-500">Total contratado (venda)</p>
                    </div>
                  )}
                </div>

                {/* Status breakdown */}
                <div className="grid grid-cols-2 gap-1.5">
                  {(['A Iniciar','Execução','Concluída','Paralisada'] as StatusObra[]).map(s => (
                    <div key={s} className="bg-gray-50 rounded-lg p-2 text-center">
                      <p className="text-base font-bold" style={{ color: STATUS_COLORS[s] }}>{statusCount(s)}</p>
                      <p className="text-[10px] text-gray-500">{s}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lista de obras */}
              {obrasFiltradas.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
                    <p className="text-xs font-semibold text-gray-600">
                      {obrasFiltradas.length} obra{obrasFiltradas.length !== 1 ? 's' : ''} — {selectedLabel}
                    </p>
                  </div>
                  <div className="overflow-y-auto max-h-64 divide-y divide-gray-50">
                    {obrasFiltradas.map(o => (
                      <div key={o.id} className="flex items-start gap-2 px-4 py-2.5">
                        <div className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: STATUS_COLORS[o.status] }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">{o.localidade}</p>
                          <p className="text-[10px] text-gray-400">
                            {o.engenharia} · {o.municipio} · {o.avancoPct}%
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Ranking de estados */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col flex-1 min-h-0">
            <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-600">Obras por estado</p>
              {selectedUFs.size > 0 && (
                <button onClick={clearSelection} className="text-[10px] text-orange-500 hover:text-orange-700">
                  Desmarcar todos
                </button>
              )}
            </div>
            <div className="overflow-y-auto flex-1 divide-y divide-gray-50">
              {Object.entries(ufCount)
                .sort(([, a], [, b]) => b - a)
                .map(([uf, count]) => {
                  const isSelected = selectedUFs.has(uf)
                  return (
                    <button
                      key={uf}
                      onClick={() => toggleUF(uf)}
                      className={`w-full flex items-center justify-between px-4 py-2 text-xs hover:bg-orange-50 transition-colors ${isSelected ? 'bg-orange-50' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-sm border ${isSelected ? 'bg-orange-400 border-orange-400' : 'border-gray-300'}`} />
                        <span className={`font-semibold ${isSelected ? 'text-orange-600' : 'text-gray-700'}`}>
                          {ESTADOS[uf] ?? uf}
                        </span>
                      </div>
                      <span className="font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-full">{count}</span>
                    </button>
                  )
                })}
              {Object.keys(ufCount).length === 0 && (
                <p className="px-4 py-3 text-xs text-gray-400">Nenhuma obra cadastrada</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
