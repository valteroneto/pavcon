import { createContext, useContext, useState, type ReactNode } from 'react'

export type Cargo =
  | 'Diretor'
  | 'Supervisor(a)'
  | 'Analista de engenharia'
  | 'Assistente de engenharia'
  | 'Auxiliar de engenharia'
  | 'Estagiário(a) de engenharia'

export const CARGOS: Cargo[] = [
  'Diretor',
  'Supervisor(a)',
  'Analista de engenharia',
  'Assistente de engenharia',
  'Auxiliar de engenharia',
  'Estagiário(a) de engenharia',
]

/** Qual alçada de aprovação cada cargo representa (undefined = sem poder) */
export const CARGO_ALCADA: Partial<Record<Cargo, 1 | 2 | 3>> = {
  'Analista de engenharia': 1,
  'Supervisor(a)': 2,
  'Diretor': 3,
}

export const ALCADA_LABEL: Record<1 | 2 | 3, string> = {
  1: '1ª Alçada — Analista de engenharia',
  2: '2ª Alçada — Supervisor(a)',
  3: '3ª Alçada — Diretor',
}

export interface User {
  id: string
  name: string
  email: string
  role: 'Administrador' | 'Visualizador'
  cargo: Cargo
  avatar?: string
  whatsapp?: string
  createdAt: string
}

interface StoredUser extends User {
  password: string
}

interface AuthContextType {
  user: User | null
  isAdmin: boolean
  isSuperAdmin: boolean
  allUsers: User[]
  login: (email: string, password: string) => { ok: boolean; error?: string }
  loginWithGoogle: (googleUser: Omit<User, 'id' | 'role' | 'createdAt'>) => void
  /** cargo é opcional — default: 'Assistente de engenharia' */
  register: (name: string, email: string, password: string, cargo?: Cargo) => { ok: boolean; error?: string }
  /** Cria usuário sem fazer login (uso pelo admin) */
  createUser: (name: string, email: string, password: string, cargo: Cargo, role: 'Administrador' | 'Visualizador') => { ok: boolean; error?: string }
  logout: () => void
  updateUserRole: (userId: string, role: 'Administrador' | 'Visualizador') => void
  updateUserCargo: (userId: string, cargo: Cargo) => void
  updateUserProfile: (userId: string, updates: { name?: string; avatar?: string }) => void
  resetPassword: (email: string, newPassword: string) => void
  emailExists: (email: string) => boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export const SUPER_ADMIN_EMAIL = 'valterobuenosaires@gmail.com'

const USERS_KEY   = 'pavcon_users'
const SESSION_KEY = 'pavcon_session'

const SEED_SUPER_ADMIN: StoredUser = {
  id: 'superadmin-fixed',
  name: 'Valtero Buenos Aires',
  email: SUPER_ADMIN_EMAIL,
  password: 'pavcon@2024',
  role: 'Administrador',
  cargo: 'Supervisor(a)',
  createdAt: '2024-01-01T00:00:00.000Z',
}

function getUsers(): StoredUser[] {
  try {
    const stored: StoredUser[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]')
    const hasSuperAdmin = stored.some(u => u.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase())
    if (!hasSuperAdmin) {
      const next = [SEED_SUPER_ADMIN, ...stored]
      localStorage.setItem(USERS_KEY, JSON.stringify(next))
      return next
    }
    // Super admin sempre usa os dados do seed como fonte da verdade (senha, cargo, role)
    const result = stored.map(u => {
      if (u.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
        return { ...u, password: SEED_SUPER_ADMIN.password, cargo: SEED_SUPER_ADMIN.cargo, role: SEED_SUPER_ADMIN.role }
      }
      return { ...u, cargo: u.cargo ?? ('Assistente de engenharia' as Cargo) }
    })
    localStorage.setItem(USERS_KEY, JSON.stringify(result))
    return result
  } catch {
    localStorage.setItem(USERS_KEY, JSON.stringify([SEED_SUPER_ADMIN]))
    return [SEED_SUPER_ADMIN]
  }
}

function saveUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

function getSession(): User | null {
  try {
    const u = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
    if (!u) return null
    // Super admin sempre usa o cargo definido no seed
    const cargo = u.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
      ? SEED_SUPER_ADMIN.cargo
      : (u.cargo ?? ('Assistente de engenharia' as Cargo))
    return { ...u, cargo }
  } catch { return null }
}

function resolveRole(email: string): 'Administrador' | 'Visualizador' {
  return email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
    ? 'Administrador'
    : 'Visualizador'
}

function makeId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getSession)
  const [users, setUsers] = useState<StoredUser[]>(getUsers)

  const persist = (next: StoredUser[]) => { saveUsers(next); setUsers(next) }

  const setSession = (u: User) => {
    setUser(u)
    localStorage.setItem(SESSION_KEY, JSON.stringify(u))
  }

  const isAdmin      = user?.role === 'Administrador'
  const isSuperAdmin = user?.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
  const allUsers: User[] = users.map(({ password: _p, ...u }) => u)

  const login = (email: string, password: string) => {
    const stored = users.find(u => u.email.toLowerCase() === email.toLowerCase())
    if (!stored) return { ok: false, error: 'E-mail não cadastrado.' }
    if (stored.password !== password) return { ok: false, error: 'Senha incorreta.' }
    const role = stored.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
      ? 'Administrador' : stored.role
    const u: User = {
      id: stored.id, name: stored.name, email: stored.email, role,
      cargo: stored.cargo ?? 'Assistente de engenharia',
      avatar: stored.avatar, createdAt: stored.createdAt,
    }
    setSession(u)
    return { ok: true }
  }

  const loginWithGoogle = (googleUser: Omit<User, 'id' | 'role' | 'createdAt'>) => {
    const existing = users.find(u => u.email.toLowerCase() === googleUser.email.toLowerCase())
    if (existing) {
      const role = existing.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
        ? 'Administrador' : existing.role
      setSession({ ...existing, role })
    } else {
      const role = resolveRole(googleUser.email)
      const newUser: StoredUser = {
        id: makeId(), name: googleUser.name, email: googleUser.email,
        avatar: googleUser.avatar, role,
        cargo: googleUser.cargo ?? 'Assistente de engenharia',
        password: '', createdAt: new Date().toISOString(),
      }
      persist([...users, newUser])
      setSession({ id: newUser.id, name: newUser.name, email: newUser.email, role, cargo: newUser.cargo, avatar: newUser.avatar, createdAt: newUser.createdAt })
    }
  }

  const register = (name: string, email: string, password: string, cargo: Cargo = 'Assistente de engenharia') => {
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase()))
      return { ok: false, error: 'Este e-mail já está cadastrado.' }
    const role = resolveRole(email)
    const newUser: StoredUser = { id: makeId(), name, email, password, role, cargo, createdAt: new Date().toISOString() }
    persist([...users, newUser])
    setSession({ id: newUser.id, name, email, role, cargo, createdAt: newUser.createdAt })
    return { ok: true }
  }

  const logout = () => { setUser(null); localStorage.removeItem(SESSION_KEY) }

  const updateUserRole = (userId: string, role: 'Administrador' | 'Visualizador') => {
    const next = users.map(u => u.id === userId ? { ...u, role } : u)
    persist(next)
    if (user?.id === userId) {
      const updated = { ...user, role }
      setUser(updated)
      localStorage.setItem(SESSION_KEY, JSON.stringify(updated))
    }
  }

  const updateUserCargo = (userId: string, cargo: Cargo) => {
    const next = users.map(u => u.id === userId ? { ...u, cargo } : u)
    persist(next)
    if (user?.id === userId) {
      const updated = { ...user, cargo }
      setUser(updated)
      localStorage.setItem(SESSION_KEY, JSON.stringify(updated))
    }
  }

  const createUser = (name: string, email: string, password: string, cargo: Cargo, role: 'Administrador' | 'Visualizador') => {
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase()))
      return { ok: false, error: 'Este e-mail já está cadastrado.' }
    const newUser: StoredUser = { id: makeId(), name, email, password, role, cargo, createdAt: new Date().toISOString() }
    persist([...users, newUser])
    return { ok: true }
  }

  const updateUserProfile = (userId: string, updates: { name?: string; avatar?: string }) => {
    const next = users.map(u => u.id === userId ? { ...u, ...updates } : u)
    persist(next)
    if (user?.id === userId) {
      const updated = { ...user, ...updates }
      setUser(updated)
      localStorage.setItem(SESSION_KEY, JSON.stringify(updated))
    }
  }

  const resetPassword = (email: string, newPassword: string) => {
    const next = users.map(u =>
      u.email.toLowerCase() === email.toLowerCase() ? { ...u, password: newPassword } : u
    )
    persist(next)
  }

  const emailExists = (email: string) =>
    users.some(u => u.email.toLowerCase() === email.toLowerCase())

  return (
    <AuthContext.Provider value={{
      user, isAdmin, isSuperAdmin, allUsers,
      login, loginWithGoogle, register, createUser, logout,
      updateUserRole, updateUserCargo, updateUserProfile, resetPassword, emailExists,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
