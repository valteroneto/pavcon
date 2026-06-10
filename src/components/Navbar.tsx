import { NavLink } from 'react-router-dom'
import { LogOut, ShieldCheck, Eye, Crown } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import PavconLogo from './PavconLogo'

const baseLinks = [
  { to: '/',             label: 'Dashboard'       },
  { to: '/indicadores',  label: 'Indicadores'     },
  { to: '/projecoes',    label: 'Faturamento 2026' },
  { to: '/tabela',       label: 'Tabela detalhada'},
  { to: '/engenheiros',  label: 'Engenheiros'     },
  { to: '/aprovacoes',   label: 'Aprovações'      },
  { to: '/importar',     label: 'Importar'        },
]

export default function Navbar() {
  const { user, isAdmin, isSuperAdmin, logout } = useAuth()
  const initials = user?.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() ?? '?'

  const links = [
    ...baseLinks,
    ...(isSuperAdmin ? [{ to: '/usuarios', label: 'Usuários' }] : []),
  ]

  return (
    <header className="text-white sticky top-0 z-50 shadow-lg" style={{ background: 'linear-gradient(135deg, #0f2557 0%, #1E3A8A 100%)' }}>
      {/* Faixa laranja fina no topo */}
      <div className="h-1 w-full" style={{ background: '#F5921D' }} />

      <div className="px-6 flex items-center justify-between h-14">
        {/* Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-white rounded-xl p-1 shadow-sm">
            <PavconLogo size={36} />
          </div>
          <div className="leading-tight">
            <span className="block" style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: '1.1rem', letterSpacing: '-0.5px' }}>
              <span style={{ color: '#F5921D' }}>pav</span><span className="text-white">con</span>
              <span className="text-white ml-1.5" style={{ fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.15em' }}>CONSTRUTORA</span>
            </span>
            <span className="text-blue-200 block" style={{ fontSize: '0.65rem', letterSpacing: '0.12em', opacity: 0.65 }}>GESTÃO DE OBRAS — SESA</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex items-center gap-0.5 overflow-x-auto">
          {links.map(({ to, label }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'text-white font-semibold border-b-2'
                    : 'text-blue-200 hover:text-white hover:bg-white/10'
                }`
              }
              style={({ isActive }) => isActive ? { borderColor: '#F5921D', backgroundColor: 'rgba(255,255,255,0.08)' } : {}}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User info */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-7 h-7 rounded-full object-cover ring-2 ring-orange-400" />
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ring-2 ring-orange-400"
                style={{ background: '#F5921D' }}>
                {initials}
              </div>
            )}
            <div className="leading-none">
              <span className="text-sm text-white font-medium flex items-center gap-1">
                {user?.name ?? 'Usuário'}
                {isSuperAdmin && <Crown size={11} style={{ color: '#F5921D' }} />}
              </span>
              <span className={`text-xs flex items-center gap-1 ${isAdmin ? 'text-green-300' : 'text-yellow-300'}`}>
                {isAdmin ? <ShieldCheck size={10} /> : <Eye size={10} />}
                {user?.role}
              </span>
            </div>
          </div>
          <button onClick={logout} title="Sair"
            className="p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-colors">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  )
}
