import { CheckCircle, XCircle, Clock, ShieldCheck, Lock, History } from 'lucide-react'
import { useAprovacoes, CAMPO_LABELS, type Aprovacao } from '../contexts/AprovacoesContext'
import { useObras } from '../contexts/ObrasContext'
import { useAuth, SUPER_ADMIN_EMAIL } from '../contexts/AuthContext'

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const fmtVal = (campo: string, val: string | number) => {
  if (campo === 'conclusaoPrevista')
    return val ? new Date(String(val) + 'T00:00:00').toLocaleDateString('pt-BR') : '—'
  return typeof val === 'number'
    ? val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
    : String(val)
}

function StatusBadge({ a }: { a: Aprovacao }) {
  if (a.status === 'aprovado')
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200"><CheckCircle size={11} /> Aprovado</span>
  if (a.status === 'rejeitado')
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200"><XCircle size={11} /> Rejeitado</span>
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200"><Clock size={11} /> Pendente</span>
}

export default function Aprovacoes() {
  const { aprovacoes, aprovar, rejeitar } = useAprovacoes()
  const { updateObra } = useObras()
  const { user } = useAuth()

  const pendentes  = aprovacoes.filter(a => a.status === 'pendente')
  const resolvidas = aprovacoes.filter(a => a.status !== 'pendente')

  const souValtero = user?.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
  const NIVEL_VALTERO: 1 | 2 | 3 = 2

  const handleAprovar = (a: Aprovacao) => {
    if (!souValtero) return
    const resultado = aprovar(a.id, user!.name, user!.cargo, NIVEL_VALTERO)
    if (resultado.status === 'aprovado') {
      updateObra(resultado.obraId, { [resultado.campo]: resultado.valorNovo } as Record<string, unknown>)
    }
  }

  const handleRejeitar = (a: Aprovacao) => {
    if (!souValtero) return
    rejeitar(a.id, user!.name)
  }

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #1e3a8a, #2563eb)' }}>
          <ShieldCheck size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Aprovações</h1>
          <p className="text-xs text-gray-500">
            Campos protegidos: <strong>Data Prev. Conclusão</strong>, <strong>Executivo (R$)</strong> e <strong>Venda (R$)</strong>
          </p>
        </div>
      </div>

      {/* Pendentes */}
      <div>
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Clock size={13} className="text-amber-500" /> Pendentes ({pendentes.length})
        </h2>

        {pendentes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center shadow-sm">
            <CheckCircle size={36} className="mx-auto text-green-200 mb-3" />
            <p className="text-sm text-gray-400">Nenhuma solicitação pendente.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendentes.map(a => (
              <div key={a.id} className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">

                {/* Cabeçalho do card */}
                <div className="flex items-center justify-between px-5 py-3 bg-amber-50 border-b border-amber-100">
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusBadge a={a} />
                    <span className="text-sm font-semibold text-gray-800 truncate">{a.obraLabel}</span>
                    <span className="text-xs text-gray-400 whitespace-nowrap">· {CAMPO_LABELS[a.campo]}</span>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap ml-3 shrink-0">{fmtDate(a.dataSolicitacao)}</span>
                </div>

                {/* Corpo */}
                <div className="px-5 py-4 flex items-center justify-between gap-6 flex-wrap">

                  {/* Alteração + Justificativa */}
                  <div className="flex flex-col gap-2 min-w-0">
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-[10px] text-gray-400 mb-1">ATUAL</p>
                        <p className="text-sm font-semibold text-red-500 line-through">{fmtVal(a.campo, a.valorAtual)}</p>
                      </div>
                      <span className="text-gray-300 text-xl">→</span>
                      <div className="text-center">
                        <p className="text-[10px] text-gray-400 mb-1">NOVO</p>
                        <p className="text-sm font-bold text-green-700">{fmtVal(a.campo, a.valorNovo)}</p>
                      </div>
                      <p className="text-xs text-gray-400 ml-2">por <strong>{a.solicitante}</strong></p>
                    </div>
                    {a.justificativa && (
                      <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 max-w-md">
                        <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-wide mb-0.5">Justificativa</p>
                        <p className="text-xs text-gray-700 leading-snug">{a.justificativa}</p>
                      </div>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-2 shrink-0">
                    {souValtero ? (
                      <>
                        <button onClick={() => handleRejeitar(a)}
                          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 rounded-xl transition-colors">
                          <XCircle size={14} /> Rejeitar
                        </button>
                        <button onClick={() => handleAprovar(a)}
                          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-xl transition-colors"
                          style={{ background: '#16a34a' }}>
                          <CheckCircle size={14} /> Aprovar
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 border border-gray-200 px-3 py-2 rounded-xl">
                        <Lock size={12} /> Somente Váltero pode aprovar
                      </div>
                    )}
                  </div>

                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Histórico */}
      {resolvidas.length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <History size={13} className="text-gray-400" /> Histórico ({resolvidas.length})
          </h2>
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Obra', 'Campo', 'De', 'Para', 'Justificativa', 'Aprovado por', 'Status', 'Data'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {resolvidas.slice().reverse().map(a => (
                  <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800 max-w-[160px]">
                      <div className="truncate" title={a.obraLabel}>{a.obraLabel}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{CAMPO_LABELS[a.campo]}</td>
                    <td className="px-4 py-3 text-red-500 line-through whitespace-nowrap">{fmtVal(a.campo, a.valorAtual)}</td>
                    <td className="px-4 py-3 text-green-700 font-semibold whitespace-nowrap">{fmtVal(a.campo, a.valorNovo)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[180px]">
                      <div className="truncate" title={a.justificativa || '—'}>{a.justificativa || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{a.alcadas.map(al => al.nome).join(', ') || '—'}</td>
                    <td className="px-4 py-3"><StatusBadge a={a} /></td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{a.dataResolucao ? fmtDate(a.dataResolucao) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  )
}
