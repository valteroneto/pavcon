import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ObrasProvider, useObras } from './contexts/ObrasContext'
import { useAlertas } from './hooks/useAlertas'
import { useNotificacoesAlertas } from './hooks/useNotificacoes'
import { AprovacoesProvider } from './contexts/AprovacoesContext'
import { FaturamentoProvider } from './contexts/FaturamentoContext'
import { AnexosProvider } from './contexts/AnexosContext'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import TabelaDetalhada from './pages/TabelaDetalhada'
import Engenheiros from './pages/Engenheiros'
import Indicadores from './pages/Indicadores'
import Projecoes2026 from './pages/Projecoes2026'
import Importar from './pages/Importar'
import Aprovacoes from './pages/Aprovacoes'
import Chat from './pages/Chat'
import Solicitacoes from './pages/Solicitacoes'
import Suporte from './pages/Suporte'
import PainelUsuarios from './pages/PainelUsuarios'
import Medicoes from './pages/Medicoes'
import Mapa from './pages/Mapa'
import Login from './pages/Login'
import RedefinirSenha from './pages/RedefinirSenha'
import Alertas from './pages/Alertas'
import Cronograma from './pages/Cronograma'

function NotificacoesWatcher() {
  const { obras } = useObras()
  const alertas = useAlertas(obras)
  useNotificacoesAlertas(alertas)
  return null
}

function AppRoutes() {
  const { user } = useAuth()

  // Rota pública — redefinição de senha (não requer login)
  if (window.location.pathname === '/redefinir-senha') {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/redefinir-senha" element={<RedefinirSenha />} />
        </Routes>
      </BrowserRouter>
    )
  }

  if (!user) return <Login />

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 flex">
        <Sidebar />
        <NotificacoesWatcher />
        <main className="flex-1 md:ml-60 pt-14 md:pt-0 min-h-screen">
          <div className="p-4 md:p-6 max-w-screen-2xl mx-auto">
            <Routes>
              {/* Análise e Desempenho */}
              <Route path="/"            element={<Dashboard />} />
              <Route path="/indicadores" element={<Indicadores />} />
              {/* Gestão */}
              <Route path="/tabela"      element={<TabelaDetalhada />} />
              <Route path="/engenheiros" element={<Engenheiros />} />
              <Route path="/projecoes"   element={<Projecoes2026 />} />
              <Route path="/medicoes"    element={<Medicoes />} />
              <Route path="/mapa"        element={<Mapa />} />
              <Route path="/importar"    element={<Importar />} />
              {/* Alertas */}
              <Route path="/alertas"     element={<Alertas />} />
              {/* Planejador */}
              <Route path="/cronograma"  element={<Cronograma />} />
              {/* Comunicações */}
              <Route path="/aprovacoes"   element={<Aprovacoes />} />
              <Route path="/chat"         element={<Chat />} />
              <Route path="/solicitacoes" element={<Solicitacoes />} />
              {/* Suporte */}
              <Route path="/suporte"  element={<Suporte />} />
              <Route path="/usuarios" element={<PainelUsuarios />} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ObrasProvider>
        <AprovacoesProvider>
          <FaturamentoProvider>
            <AnexosProvider>
              <AppRoutes />
            </AnexosProvider>
          </FaturamentoProvider>
        </AprovacoesProvider>
      </ObrasProvider>
    </AuthProvider>
  )
}
