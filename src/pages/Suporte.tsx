import { LifeBuoy, BookOpen, MessageSquare, Mail, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

const faqs = [
  {
    q: 'Como alterar campos protegidos (Executivo, Venda, Data de Conclusão)?',
    a: 'Campos protegidos exigem aprovação em 3 alçadas: 1ª pelo Analista de engenharia, 2ª pelo Supervisor(a) e 3ª pelo Diretor. Solicite a alteração na tabela de obras e acompanhe em "Aprovações".',
  },
  {
    q: 'Como funciona o IDP (Índice de Desempenho de Prazo)?',
    a: 'IDP = (Velocidade Real / Velocidade Planejada) × 100. Verde ≥ 90%, amarelo ≥ 70%, vermelho < 70%. Velocidade Planejada = 100 / T.Prev (%/dia), Velocidade Real = Avanço% / T.Atual (%/dia).',
  },
  {
    q: 'Como enviar mensagem via WhatsApp para um colega?',
    a: 'Acesse "Chat", selecione o usuário, escreva a mensagem e clique em "WhatsApp". O sistema abre o WhatsApp Web com a mensagem pré-preenchida. O número precisa estar cadastrado no perfil do usuário.',
  },
  {
    q: 'Como importar dados de obras?',
    a: 'Acesse "Importar" no menu de Gestão. O sistema aceita arquivos Excel (.xlsx) no formato SIENGE. Os dados são validados antes de serem incorporados.',
  },
  {
    q: 'Esqueci minha senha. O que fazer?',
    a: 'Na tela de login, clique em "Esqueci minha senha", informe seu e-mail cadastrado e você receberá um link de redefinição com validade de 30 minutos.',
  },
  {
    q: 'Como alterar meu cargo ou nível de acesso?',
    a: 'Cargos e níveis de acesso são gerenciados pelo Super-Administrador no painel de Usuários. Entre em contato com o gestor do sistema.',
  },
]

function FAQ({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors">
        <span className="text-sm font-semibold text-gray-800 pr-4">{q}</span>
        {open ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm text-gray-600 border-t border-gray-100 pt-3 bg-gray-50">
          {a}
        </div>
      )}
    </div>
  )
}

export default function Suporte() {
  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #1e3a8a, #2563eb)' }}>
          <LifeBuoy size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Suporte</h1>
          <p className="text-xs text-gray-500">Documentação, dúvidas frequentes e contato</p>
        </div>
      </div>

      {/* Cards de acesso rápido */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: BookOpen,      color: '#2563eb', title: 'Documentação',    desc: 'Guias de uso do sistema' },
          { icon: MessageSquare, color: '#16a34a', title: 'Chat interno',     desc: 'Fale com sua equipe' },
          { icon: Mail,          color: '#d97706', title: 'E-mail de suporte', desc: 'suporte@pavcon.com.br' },
        ].map(({ icon: Icon, color, title, desc }) => (
          <div key={title} className="bg-white border border-gray-200 rounded-2xl p-5 flex items-start gap-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: color + '15' }}>
              <Icon size={18} style={{ color }} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* FAQ */}
      <div>
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">
          Perguntas frequentes
        </h2>
        <div className="space-y-2">
          {faqs.map(f => <FAQ key={f.q} q={f.q} a={f.a} />)}
        </div>
      </div>

      {/* Versão */}
      <div className="text-xs text-gray-400 pt-2">
        Pavcon Gestão de Obras · Versão 1.0 · {new Date().getFullYear()}
      </div>
    </div>
  )
}
