import { useState } from 'react'
import { AlertTriangle, Clock, TrendingDown, Bell, CheckCircle, Filter, RefreshCw, Send } from 'lucide-react'
import { useObras } from '../contexts/ObrasContext'
import { useAlertas, type TipoAlerta, type Alerta } from '../hooks/useAlertas'
import EnviarAlertaModal from '../components/EnviarAlertaModal'

const TIPO_CONFIG: Record<TipoAlerta, { label: string; cor: string; bg: string; icon: React.ElementType }> = {
  paralisada:    { label: 'Paralisada',         cor: '#dc2626', bg: 'bg-red-50',    icon: AlertTriangle },
  prazo_vencido: { label: 'Prazo Vencido',       cor: '#dc2626', bg: 'bg-red-50',    icon: Clock },
  prazo_risco:   { label: 'Prazo em Risco',      cor: '#d97706', bg: 'bg-amber-50',  icon: Clock },
  idp_critico:   { label: 'IDP Crítico',         cor: '#dc2626', bg: 'bg-red-50',    icon: TrendingDown },
  idp_atencao:   { label: 'IDP em Atenção',      cor: '#d97706', bg: 'bg-amber-50',  icon: TrendingDown },
  sem_registro:  { label: 'Sem Registro Recente', cor: '#2563eb', bg: 'bg-blue-50',  icon: RefreshCw },
}

const SEV_CONFIG = {
  critico: { label: 'Crítico', dot: 'bg-red-500' },
  atencao: { label: 'Atenção', dot: 'bg-amber-500' },
  info:    { label: 'Info',    dot: 'bg-blue-400' },
}

export default function Alertas() {
  const { obras } = useObras()
  const alertas = useAlertas(obras)
  const [filtroTipo, setFiltroTipo] = useState<TipoAlerta | 'todos'>('todos')
  const [filtroSev, setFiltroSev] = useState<'todos' | 'critico' | 'atencao' | 'info'>('todos')
  const [alertaNotif, setAlertaNotif] = useState<Alerta | null>(null)

  const filtrados = alertas.filter(a =>
    (filtroTipo === 'todos' || a.tipo === filtroTipo) &&
    (filtroSev === 'todos' || a.severidade === filtroSev)
  )

  const criticos = alertas.filter(a => a.severidade === 'critico').length
  const atencao  = alertas.filter(a => a.severidade === 'atencao').length
  const info     = alertas.filter(a => a.severidade === 'info').length

  const contPorTipo = (tipo: TipoAlerta) => alertas.filter(a => a.tipo === tipo).length

  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Bell size={22} className="text-amber-500" />
          Alertas Automáticos
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Calculado em tempo real · {alertas.length} alerta{alertas.length !== 1 ? 's' : ''} ativos
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: alertas.length, color: '#6b7280', icon: Bell },
          { label: 'Críticos', value: criticos, color: '#dc2626', icon: AlertTriangle },
          { label: 'Atenção', value: atencao, color: '#d97706', icon: Clock },
          { label: 'Informativos', value: info, color: '#2563eb', icon: RefreshCw },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Icon size={15} style={{ color }} />
              <p className="text-xs text-gray-500">{label}</p>
            </div>
            <p className="text-3xl font-black" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {alertas.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
          <CheckCircle size={40} className="mx-auto mb-3 text-green-400" />
          <h3 className="font-bold text-gray-700 text-lg">Tudo certo!</h3>
          <p className="text-gray-400 text-sm mt-1">Nenhum alerta ativo no momento.</p>
        </div>
      )}

      {alertas.length > 0 && (
        <div className="flex flex-col md:flex-row gap-5">

          {/* Sidebar de filtros */}
          <div className="w-full md:w-52 flex-shrink-0 space-y-4">
            {/* Severidade */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Filter size={11} /> Severidade
              </p>
              {(['todos', 'critico', 'atencao', 'info'] as const).map(s => {
                const count = s === 'todos' ? alertas.length
                  : alertas.filter(a => a.severidade === s).length
                return (
                  <button key={s} onClick={() => setFiltroSev(s)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs mb-1 transition-colors ${
                      filtroSev === s ? 'bg-gray-100 font-semibold text-gray-800' : 'text-gray-500 hover:bg-gray-50'
                    }`}>
                    <div className="flex items-center gap-2">
                      {s !== 'todos' && <span className={`w-2 h-2 rounded-full ${SEV_CONFIG[s].dot}`} />}
                      {s === 'todos' ? 'Todos' : SEV_CONFIG[s].label}
                    </div>
                    <span className="font-bold">{count}</span>
                  </button>
                )
              })}
            </div>

            {/* Tipo */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Filter size={11} /> Tipo
              </p>
              <button onClick={() => setFiltroTipo('todos')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs mb-1 transition-colors ${
                  filtroTipo === 'todos' ? 'bg-gray-100 font-semibold text-gray-800' : 'text-gray-500 hover:bg-gray-50'
                }`}>
                <span>Todos</span>
                <span className="font-bold">{alertas.length}</span>
              </button>
              {(Object.keys(TIPO_CONFIG) as TipoAlerta[]).map(tipo => {
                const count = contPorTipo(tipo)
                if (count === 0) return null
                const cfg = TIPO_CONFIG[tipo]
                const Icon = cfg.icon
                return (
                  <button key={tipo} onClick={() => setFiltroTipo(tipo)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs mb-1 transition-colors ${
                      filtroTipo === tipo ? 'bg-gray-100 font-semibold text-gray-800' : 'text-gray-500 hover:bg-gray-50'
                    }`}>
                    <div className="flex items-center gap-2">
                      <Icon size={11} style={{ color: cfg.cor }} />
                      {cfg.label}
                    </div>
                    <span className="font-bold">{count}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Lista de alertas */}
          <div className="flex-1 space-y-3">
            {filtrados.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-400">
                <p className="text-sm">Nenhum alerta nesse filtro.</p>
              </div>
            ) : (
              filtrados.map(a => <AlertaCard key={a.id} alerta={a} onNotificar={setAlertaNotif} />)
            )}
          </div>
        </div>
      )}
    </div>

      {alertaNotif && (
        <EnviarAlertaModal alerta={alertaNotif} onClose={() => setAlertaNotif(null)} />
      )}
    </>
  )
}

function AlertaCard({ alerta, onNotificar }: { alerta: Alerta; onNotificar: (a: Alerta) => void }) {
  const cfg = TIPO_CONFIG[alerta.tipo]
  const sev = SEV_CONFIG[alerta.severidade]
  const Icon = cfg.icon

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
      <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
        <Icon size={18} style={{ color: cfg.cor }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-sm text-gray-800">{alerta.titulo}</span>
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            alerta.severidade === 'critico' ? 'bg-red-100 text-red-700' :
            alerta.severidade === 'atencao' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
            {sev.label}
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-0.5">{alerta.descricao}</p>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {alerta.obraEngenheiro && (
            <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
              👷 {alerta.obraEngenheiro}
            </span>
          )}
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
            alerta.obraStatus === 'Execução'   ? 'bg-blue-50 text-blue-600' :
            alerta.obraStatus === 'Paralisada' ? 'bg-gray-100 text-gray-500' :
            alerta.obraStatus === 'A Iniciar'  ? 'bg-amber-50 text-amber-600' :
            'bg-green-50 text-green-600'
          }`}>
            {alerta.obraStatus}
          </span>
        </div>
      </div>

      {/* Botão notificar */}
      <button
        onClick={() => onNotificar(alerta)}
        title="Enviar notificação sobre este alerta"
        className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-xl transition-colors self-center"
      >
        <Send size={13} />
        <span className="hidden sm:inline">Notificar</span>
      </button>
    </div>
  )
}
