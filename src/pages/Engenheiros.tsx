import { useMemo, useState } from 'react'
import { Mail, Phone, CheckCircle, Clock, Award, Search, TrendingUp, AlertTriangle, BarChart2 } from 'lucide-react'
import { engenheiros as engMock } from '../data/mockData'
import { useObras } from '../contexts/ObrasContext'
import type { Obra } from '../types'

const TODAY = new Date().toISOString().split('T')[0]

function diffDays(a: string, b: string) {
  return Math.round(
    (new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86_400_000
  )
}

function calcIdpObra(o: Obra): number | null {
  const tempoPrev = o.dataInicio && o.conclusaoPrevista ? diffDays(o.dataInicio, o.conclusaoPrevista) : null
  const fimAtual  = o.status === 'Concluída' && o.dataRealConclusao ? o.dataRealConclusao : TODAY
  const tempoAt   = o.dataInicio ? diffDays(o.dataInicio, fimAtual) : null
  if (!tempoPrev || !tempoAt || tempoPrev <= 0 || tempoAt <= 0) return null
  const vp = 100 / tempoPrev
  const vr = o.avancoPct / tempoAt
  return vp > 0 ? (vr / vp) * 100 : null
}

function idpColor(v: number | null) {
  if (v === null) return '#9ca3af'
  if (v >= 90) return '#16a34a'
  if (v >= 70) return '#d97706'
  return '#dc2626'
}

function pontualidadeColor(v: number) {
  if (v >= 90) return '#16a34a'
  if (v >= 75) return '#2563eb'
  if (v >= 60) return '#d97706'
  return '#dc2626'
}

export default function Engenheiros() {
  const { obras } = useObras()
  const [busca, setBusca] = useState('')

  // Agrupa obras por nome do engenheiro e computa métricas reais
  const engenheirosComDados = useMemo(() => {
    const nomes = [...new Set(obras.map(o => o.engenheiro).filter(Boolean))].sort()

    return nomes.map(nome => {
      const mock = engMock.find(e => e.nome === nome)
      const obrasEng = obras.filter(o => o.engenheiro === nome)

      const obrasAtivas    = obrasEng.filter(o => o.status === 'Execução' || o.status === 'A Iniciar')
      const obrasConcluidas = obrasEng.filter(o => o.status === 'Concluída')
      const obrasParalisadas = obrasEng.filter(o => o.status === 'Paralisada')

      // Pontualidade: concluídas no prazo (dataRealConclusao <= conclusaoPrevista)
      const conclComDatas = obrasConcluidas.filter(o => o.dataRealConclusao && o.conclusaoPrevista)
      const conclNoPrazo  = conclComDatas.filter(o =>
        new Date(o.dataRealConclusao!) <= new Date(o.conclusaoPrevista!)
      )
      const taxaPontualidade = conclComDatas.length > 0
        ? Math.round((conclNoPrazo.length / conclComDatas.length) * 100)
        : null

      // IDP médio das obras em execução
      const idps = obrasAtivas
        .filter(o => o.status === 'Execução')
        .map(calcIdpObra)
        .filter((v): v is number => v !== null)
      const idpMedio = idps.length > 0
        ? idps.reduce((a, b) => a + b, 0) / idps.length
        : null

      // Valor total de obras ativas
      const valorAtivo = obrasAtivas.reduce((s, o) => s + (o.venda ?? 0), 0)

      // Avanço médio das obras em execução
      const execObras = obrasEng.filter(o => o.status === 'Execução')
      const avancoMedio = execObras.length > 0
        ? execObras.reduce((s, o) => s + (o.avancoPct ?? 0), 0) / execObras.length
        : null

      return {
        id:     mock?.id ?? nome,
        nome,
        cargo:  mock?.cargo ?? 'Engenheiro(a)',
        email:  mock?.email ?? '',
        telefone: mock?.telefone ?? '',
        obrasAtivas:    obrasAtivas.length,
        obrasConcluidas: obrasConcluidas.length,
        obrasParalisadas: obrasParalisadas.length,
        totalObras: obrasEng.length,
        taxaPontualidade,
        idpMedio,
        valorAtivo,
        avancoMedio,
      }
    })
  }, [obras])

  const filtrados = engenheirosComDados.filter(e =>
    !busca || e.nome.toLowerCase().includes(busca.toLowerCase()) ||
    e.cargo.toLowerCase().includes(busca.toLowerCase())
  )

  const fmtBRL = (v: number) =>
    v >= 1e6
      ? `R$ ${(v / 1e6).toFixed(1).replace('.', ',')}M`
      : v >= 1e3
        ? `R$ ${(v / 1e3).toFixed(0)}K`
        : `R$ ${v.toLocaleString('pt-BR')}`

  // Métricas consolidadas
  const totalAtivas     = engenheirosComDados.reduce((s, e) => s + e.obrasAtivas, 0)
  const totalConcluidas = engenheirosComDados.reduce((s, e) => s + e.obrasConcluidas, 0)
  const mediaIDP = (() => {
    const vals = engenheirosComDados.map(e => e.idpMedio).filter((v): v is number => v !== null)
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  })()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Engenheiros</h1>
          <p className="text-gray-500 text-sm mt-1">
            {engenheirosComDados.length} engenheiro(s) · dados calculados em tempo real das obras
          </p>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Buscar engenheiro..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 w-52"
          />
        </div>
      </div>

      {/* Resumo consolidado */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Engenheiros', value: engenheirosComDados.length, color: '#2563eb', icon: '👷' },
          { label: 'Obras Ativas', value: totalAtivas, color: '#f59e0b', icon: '🏗️' },
          { label: 'Concluídas', value: totalConcluidas, color: '#16a34a', icon: '✅' },
          {
            label: 'IDP Médio',
            value: mediaIDP != null ? `${mediaIDP.toFixed(1).replace('.', ',')}%` : '—',
            color: idpColor(mediaIDP),
            icon: '📊',
          },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{icon}</span>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
            <p className="text-2xl font-black" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Cards dos engenheiros */}
      {filtrados.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
          <p className="text-sm">Nenhum engenheiro encontrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtrados.map(eng => (
            <div key={eng.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col">
              {/* Cabeçalho do card */}
              <div className="flex items-center gap-3 p-5 border-b border-gray-100">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white font-bold text-lg shrink-0">
                  {eng.nome.split(' ').map(n => n[0]).slice(0, 2).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 truncate">{eng.nome}</h3>
                  <p className="text-xs text-gray-500">{eng.cargo}</p>
                </div>
                {eng.obrasParalisadas > 0 && (
                  <span title={`${eng.obrasParalisadas} obra(s) paralisada(s)`}
                    className="text-amber-500">
                    <AlertTriangle size={15} />
                  </span>
                )}
              </div>

              {/* Contato */}
              {(eng.email || eng.telefone) && (
                <div className="px-5 py-3 space-y-1.5 border-b border-gray-100">
                  {eng.email && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Mail size={12} className="text-gray-400 shrink-0" />
                      <span className="truncate">{eng.email}</span>
                    </div>
                  )}
                  {eng.telefone && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Phone size={12} className="text-gray-400 shrink-0" />
                      <span>{eng.telefone}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Métricas de obras */}
              <div className="px-5 py-4 grid grid-cols-3 gap-3 border-b border-gray-100">
                <div className="text-center">
                  <div className="flex justify-center mb-1"><Clock size={13} className="text-amber-500" /></div>
                  <p className="text-xl font-black text-gray-800">{eng.obrasAtivas}</p>
                  <p className="text-[10px] text-gray-400">Ativas</p>
                </div>
                <div className="text-center">
                  <div className="flex justify-center mb-1"><CheckCircle size={13} className="text-green-500" /></div>
                  <p className="text-xl font-black text-gray-800">{eng.obrasConcluidas}</p>
                  <p className="text-[10px] text-gray-400">Concluídas</p>
                </div>
                <div className="text-center">
                  <div className="flex justify-center mb-1"><Award size={13} className="text-yellow-500" /></div>
                  <p className="text-xl font-black"
                    style={{ color: eng.taxaPontualidade != null ? pontualidadeColor(eng.taxaPontualidade) : '#9ca3af' }}>
                    {eng.taxaPontualidade != null ? `${eng.taxaPontualidade}%` : '—'}
                  </p>
                  <p className="text-[10px] text-gray-400">Pontual.</p>
                </div>
              </div>

              {/* Métricas extras */}
              <div className="px-5 py-3 space-y-2.5 flex-1">

                {/* Pontualidade gauge */}
                {eng.taxaPontualidade != null && (
                  <div>
                    <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                      <span>Taxa de pontualidade</span>
                      <span>{eng.taxaPontualidade}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-1.5 rounded-full transition-all"
                        style={{
                          width: `${eng.taxaPontualidade}%`,
                          backgroundColor: pontualidadeColor(eng.taxaPontualidade),
                        }} />
                    </div>
                  </div>
                )}

                {/* IDP médio */}
                {eng.idpMedio != null && (
                  <div>
                    <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                      <span className="flex items-center gap-1">
                        <TrendingUp size={9} /> IDP médio (em execução)
                      </span>
                      <span style={{ color: idpColor(eng.idpMedio) }} className="font-semibold">
                        {eng.idpMedio.toFixed(1).replace('.', ',')}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-1.5 rounded-full transition-all"
                        style={{
                          width: `${Math.min(eng.idpMedio, 100)}%`,
                          backgroundColor: idpColor(eng.idpMedio),
                        }} />
                    </div>
                  </div>
                )}

                {/* Avanço médio */}
                {eng.avancoMedio != null && (
                  <div>
                    <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                      <span className="flex items-center gap-1">
                        <BarChart2 size={9} /> Avanço médio (execução)
                      </span>
                      <span className="font-semibold text-blue-700">
                        {eng.avancoMedio.toFixed(1).replace('.', ',')}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-1.5 rounded-full transition-all bg-blue-500"
                        style={{ width: `${Math.min(eng.avancoMedio, 100)}%` }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Rodapé com valor */}
              {eng.valorAtivo > 0 && (
                <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 rounded-b-2xl">
                  <p className="text-[10px] text-gray-400">Valor em obras ativas</p>
                  <p className="text-sm font-bold text-blue-700">{fmtBRL(eng.valorAtivo)}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
