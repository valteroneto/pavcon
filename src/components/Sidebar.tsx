import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Building2, BarChart2, TrendingUp, CheckSquare,
  Users, Upload, ShieldCheck, Eye, Crown, MessageSquare, Bell,
  LogOut, Menu, X, ChevronRight, LifeBuoy, Map, ClipboardList,
  AlertTriangle, CalendarDays,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useObras } from '../contexts/ObrasContext'
import { useAlertas } from '../hooks/useAlertas'
import PavconLogo from './PavconLogo'
import NotificacoesBadge from './NotificacoesBadge'

const ORANGE = '#F5921D'

const navGroups = [
  {
    label: 'Análise e Desempenho',
    items: [
      { to: '/',            label: 'Dashboard',   icon: LayoutDashboard, adminOnly: false },
      { to: '/indicadores', label: 'Indicadores', icon: BarChart2,       adminOnly: false },
      { to: '/mapa',        label: 'Mapa',        icon: Map,             adminOnly: false },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { to: '/tabela',      label: 'Obras',            icon: Building2,    adminOnly: false },
      { to: '/engenheiros', label: 'Engenheiros',      icon: Users,        adminOnly: false },
      { to: '/projecoes',   label: 'Faturamento 2026', icon: TrendingUp,   adminOnly: false },
      { to: '/cronograma', label: 'Cronograma',        icon: CalendarDays, adminOnly: false },
      { to: '/importar',    label: 'Importar',         icon: Upload,       adminOnly: false },
    ],
  },
  {
    label: 'Monitoramento',
    items: [
      { to: '/alertas', label: 'Alertas', icon: AlertTriangle, adminOnly: false as const },
    ],
  },
  {
    label: 'Comunicações',
    items: [
      { to: '/aprovacoes',   label: 'Aprovações',   icon: CheckSquare,  adminOnly: false },
      { to: '/chat',         label: 'Chat',         icon: MessageSquare, adminOnly: false },
      { to: '/solicitacoes', label: 'Solicitações', icon: Bell,         adminOnly: false },
    ],
  },
  {
    label: 'Suporte',
    items: [
      { to: '/suporte',  label: 'Suporte',  icon: LifeBuoy,   adminOnly: false },
      { to: '/usuarios', label: 'Usuários', icon: ShieldCheck, adminOnly: true  },
    ],
  },
]

export default function Sidebar() {
  const { user, isAdmin, isSuperAdmin, logout } = useAuth()
  const { obras } = useObras()
  const alertas = useAlertas(obras)
  const criticos = alertas.filter(a => a.severidade === 'critico').length
  const [open, setOpen] = useState(false)
  const location = useLocation()

  const initials = user?.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() ?? '?'

  const visibleGroups = navGroups.map(g => ({
    ...g,
    items: g.items.filter(item => !item.adminOnly || isSuperAdmin),
  })).filter(g => g.items.length > 0)

  const NavItem = ({ to, label, icon: Icon, badge }: { to: string; label: string; icon: React.ElementType; badge?: number }) => {
    const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
    return (
      <NavLink
        to={to}
        onClick={() => setOpen(false)}
        className="flex items-center gap-3 rounded-lg text-sm font-medium transition-all"
        style={{
          padding: '7px 10px',
          color: isActive ? ORANGE : 'rgba(255,255,255,0.55)',
          background: isActive ? 'rgba(245,146,29,0.12)' : 'transparent',
          borderLeft: isActive ? `3px solid ${ORANGE}` : '3px solid transparent',
        }}
      >
        <Icon size={16} />
        <span className="flex-1">{label}</span>
        {badge !== undefined && badge > 0 && (
          <span className="text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
        {isActive && <ChevronRight size={12} style={{ color: ORANGE }} />}
      </NavLink>
    )
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Logo */}
      <div className="flex flex-col items-center gap-2 px-4 py-4 border-b border-white/10 flex-shrink-0">
        <div className="bg-white rounded-2xl shadow-lg flex items-center justify-center"
          style={{ width: '170px', height: '84px', padding: '10px 14px' }}>
          <PavconLogo size={120} />
        </div>
        <div className="text-[9px] font-bold tracking-widest text-center"
          style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.2em' }}>
          GESTÃO DE OBRAS
        </div>
      </div>

      {/* Nav com grupos */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-4">
        {visibleGroups.map(group => (
          <div key={group.label}>
            <p className="px-2 mb-1 text-[9px] font-bold uppercase tracking-widest"
              style={{ color: 'rgba(255,255,255,0.25)', letterSpacing: '0.15em' }}>
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(item => (
                <NavItem key={item.to} to={item.to} label={item.label} icon={item.icon}
                  badge={item.to === '/alertas' ? criticos : undefined} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5">
          {user?.avatar
            ? <img src={user.avatar} alt={user.name} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
            : <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                style={{ background: ORANGE }}>{initials}</div>}
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate flex items-center gap-1">
              {user?.name}
              {isSuperAdmin && <Crown size={9} style={{ color: ORANGE }} className="flex-shrink-0" />}
            </p>
            <p className={`text-[11px] flex items-center gap-1 ${isAdmin ? 'text-green-400' : 'text-yellow-400'}`}>
              {isAdmin ? <ShieldCheck size={9} /> : <Eye size={9} />}
              {user?.cargo ?? user?.role}
            </p>
          </div>
          <NotificacoesBadge />
          <button onClick={logout} title="Sair"
            className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* MOBILE topbar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-14"
        style={{ background: 'linear-gradient(135deg, #0f2557 0%, #1E3A8A 100%)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <button onClick={() => setOpen(true)} className="p-2 rounded-lg text-white/50 hover:text-white transition-colors">
          <Menu size={22} />
        </button>
        <div className="rounded-lg p-1 bg-white">
          <PavconLogo size={28} />
        </div>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
          style={{ background: ORANGE }}>{initials}</div>
      </div>

      {/* MOBILE drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-64 h-full shadow-2xl flex flex-col"
            style={{ background: 'linear-gradient(180deg, #0f2557 0%, #1E3A8A 100%)' }}>
            <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: ORANGE }} />
            <button onClick={() => setOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-white/40 hover:text-white transition-colors z-10">
              <X size={18} />
            </button>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* DESKTOP sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-60 z-30"
        style={{ background: 'linear-gradient(180deg, #0f2557 0%, #1E3A8A 100%)' }}>
        <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: ORANGE }} />
        <SidebarContent />
      </aside>
    </>
  )
}
