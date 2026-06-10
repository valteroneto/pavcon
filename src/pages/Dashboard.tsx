import { useState, useMemo } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { engenheiros } from '../data/mockData'
import { useObras } from '../contexts/ObrasContext'
import type { StatusObra, Regiao } from '../types'
import { MultiSelect } from '../components/MultiSelect'

const STATUS_COLORS: Record<StatusObra, string> = {
  'A Iniciar':  '#f59e0b',
  'Execução':   '#2563eb',
  'Concluída':  '#16a34a',
  'Paralisada': '#9ca3af',
}

const REGIOES: Regiao[]      = ['Norte', 'Sul', 'Metropolitana', 'Centro-Oeste', 'Leste']
const STATUSES: StatusObra[] = ['A Iniciar', 'Execução', 'Concluída', 'Paralisada']
const ANOS = [2023, 2024, 2025, 2026]

export default function Dashboard() {
  const { obras } = useObras()

  const [filtroEngenheiro, setFiltroEngenheiro] = useState<string[]>([])
  const [filtroStatus, setFiltroStatus]         = useState<string[]>([])
  const [filtroRegiao, setFiltroRegiao]         = useState<string[]>([])
  const [filtroAno, setFiltroAno]               = useState<string[]>([])
  const [filtroEngenharia, setFiltroEngenharia] = useState<string[]>([])
  const [filtroInicioDe, setFiltroInicioDe]     = useState('')
  const [filtroInicioAte, setFiltroInicioAte]   = useState('')

  const limparFiltros = () => {
    setFiltroEngenheiro([]); setFiltroStatus([]); setFiltroRegiao([])
    setFiltroAno([]); setFiltroEngenharia([])
    setFiltroInicioDe(''); setFiltroInicioAte('')
  }

  const anosDisponiveis = useMemo(
    () => [...new Set(obras.map(o => String(o.ano)).filter(Boolean))].sort(),
    [obras]
  )
  const engenhariasDisponiveis = useMemo(
    () => [...new Set(obras.map(o => o.engenharia).filter(Boolean))].sort(),
    [obras]
  )
  const engenheirosDisponiveis = useMemo(
    () => [...new Set(obras.map(o => o.engenheiro).filter(Boolean))].sort(),
    [obras]
  )

  const filtradas = useMemo(() =>
    obras.filter(o =>
      (filtroEngenheiro.length === 0 || filtroEngenheiro.includes(o.engenheiro)) &&
      (filtroStatus.length === 0     || filtroStatus.includes(o.status)) &&
      (filtroRegiao.length === 0     || filtroRegiao.includes(o.regiao)) &&
      (filtroAno.length === 0        || filtroAno.includes(String(o.ano))) &&
      (filtroEngenharia.length === 0 || filtroEngenharia.includes(o.engenharia)) &&
      (!filtroInicioDe   || (o.dataInicio && o.dataInicio >= filtroInicioDe)) &&
      (!filtroInicioAte  || (o.dataInicio && o.dataInicio <= filtroInicioAte))
    ), [obras, filtroEngenheiro, filtroStatus, filtroRegiao, filtroAno, filtroEngenharia, filtroInicioDe, filtroInicioAte])

  const total          = filtradas.length
  const countByStatus  = (s: StatusObra) => filtradas.filter(o => o.status === s).length
  const pct            = (n: number) => total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '0%'
  const taxaConclusao  = total > 0 ? (countByStatus('Concluída') / total) * 100 : 0
  const regioes        = [...new Set(obras.map(o => o.regiao))]

  const statusData = STATUSES
    .map(s => ({ name: s, value: countByStatus(s) }))
    .filter(d => d.value > 0)

  const regiaoData = REGIOES
    .map(r => ({ name: r, value: filtradas.filter(o => o.regiao === r).length }))
    .filter(d => d.value > 0)

  const regiaoStatusData = REGIOES.map(r => {
    const ro = filtradas.filter(o => o.regiao === r)
    return {
      name: r,
      'Execução':   ro.filter(o => o.status === 'Execução').length,
      'A Iniciar':  ro.filter(o => o.status === 'A Iniciar').length,
      'Concluída':  ro.filter(o => o.status === 'Concluída').length,
      'Paralisada': ro.filter(o => o.status === 'Paralisada').length,
    }
  }).filter(d => Object.values(d).slice(1).some(v => Number(v) > 0))

  const engData = engenheiros.map(e => ({
    name: e.nome.split(' ')[0],
    Ativas: e.obrasAtivas,
    Concluídas: e.obrasConcluidas,
  }))

  return (
    <div className="space-y-5">

      {/* Summary Bar */}
      <div className="bg-white border border-gray-200 rounded-xl px-6 py-3 flex items-center gap-8">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-blue-700">{obras.length}</span>
          <span className="text-sm text-gray-500">obras na base</span>
        </div>
        <div className="w-px h-8 bg-gray-200" />
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-blue-700">{engenheiros.length}</span>
          <span className="text-sm text-gray-500">engenheiros</span>
        </div>
        <div className="w-px h-8 bg-gray-200" />
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-blue-700">{regioes.length}</span>
          <span className="text-sm text-gray-500">Regiões</span>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Engenharia</label>
            <MultiSelect
              placeholder="Todas"
              opcoes={engenhariasDisponiveis.map(uf => ({ value: uf, label: uf }))}
              selecionadas={filtroEngenharia}
              onChange={setFiltroEngenharia}
              mono
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Engenheiro</label>
            <MultiSelect
              placeholder="Todos"
              opcoes={engenheirosDisponiveis.map(e => ({ value: e, label: e }))}
              selecionadas={filtroEngenheiro}
              onChange={setFiltroEngenheiro}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Status</label>
            <MultiSelect
              placeholder="Todos"
              opcoes={STATUSES.map(s => ({ value: s, label: s }))}
              selecionadas={filtroStatus}
              onChange={setFiltroStatus}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Região</label>
            <MultiSelect
              placeholder="Todas"
              opcoes={REGIOES.map(r => ({ value: r, label: r }))}
              selecionadas={filtroRegiao}
              onChange={setFiltroRegiao}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Ano</label>
            <MultiSelect
              placeholder="Todos"
              opcoes={anosDisponiveis.map(a => ({ value: a, label: a }))}
              selecionadas={filtroAno}
              onChange={setFiltroAno}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Início de</label>
            <input type="date" value={filtroInicioDe} onChange={e => setFiltroInicioDe(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Início até</label>
            <input type="date" value={filtroInicioAte} onChange={e => setFiltroInicioAte(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
          </div>
          <button onClick={limparFiltros}
            className="px-4 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
            Limpar
          </button>
        </div>
      </div>

      {/* KPI Cards — Status */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Total de obras</p>
          <p className="text-3xl font-bold text-blue-700">{total}</p>
        </div>
        {STATUSES.map(s => {
          const count = countByStatus(s)
          const color = { 'A Iniciar': 'text-amber-600', 'Execução': 'text-blue-600', 'Concluída': 'text-green-600', 'Paralisada': 'text-gray-500' }[s]
          return (
            <div key={s} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">{s}</p>
              <p className={`text-3xl font-bold ${color}`}>{count}</p>
              <p className="text-xs text-gray-400 mt-0.5">{pct(count)}</p>
            </div>
          )
        })}
      </div>

      {/* KPI Cards — Indicadores */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Taxa de Conclusão', value: `${taxaConclusao.toFixed(0)}%`, sub: `${countByStatus('Concluída')} obras concluídas`, color: taxaConclusao >= 50 ? 'text-green-600' : 'text-amber-600' },
          { label: 'Em Execução', value: countByStatus('Execução'), sub: `${pct(countByStatus('Execução'))} do total`, color: 'text-blue-600' },
          { label: 'A Iniciar', value: countByStatus('A Iniciar'), sub: `${countByStatus('Paralisada')} paralisada(s)`, color: 'text-amber-600' },
          { label: 'Engenheiros Ativos', value: engenheiros.length, sub: `${regioes.length} regiões cobertas`, color: 'text-blue-700' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500 mb-2">{label}</p>
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-400 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Gráficos — linha 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Distribuição por Status</h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="45%" outerRadius={75} dataKey="value"
                  label={({ value }) => `${value}`} labelLine={false}>
                  {statusData.map(entry => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name as StatusObra]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend formatter={v => <span className="text-xs">{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-400 text-sm text-center pt-16">Nenhuma obra encontrada</p>}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Obras por Região</h3>
          {regiaoData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={regiaoData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={90} />
                <Tooltip />
                <Bar dataKey="value" name="Obras" fill="#2563eb" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-400 text-sm text-center pt-16">Nenhuma obra encontrada</p>}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-gray-700">Resumo por Status</h3>
          <div className="space-y-3 flex-1">
            {STATUSES.map(s => {
              const count   = countByStatus(s)
              const percent = total > 0 ? (count / total) * 100 : 0
              return (
                <div key={s}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">{s}</span>
                    <span className="font-medium text-gray-800">{count} ({percent.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full">
                    <div className="h-2 rounded-full transition-all"
                      style={{ width: `${percent}%`, backgroundColor: STATUS_COLORS[s] }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Gráficos — linha 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Status por Região</h3>
          {regiaoStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
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
          ) : <p className="text-gray-400 text-sm text-center pt-16">Nenhuma obra encontrada</p>}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Obras por Engenheiro — Ativas vs Concluídas</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={engData} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Ativas" fill="#2563eb" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Concluídas" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  )
}
