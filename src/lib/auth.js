// Autenticação demo — usuários internos (RH e Recrutadores) com e-mail/senha.
// Em produção, use backend com hash bcrypt/argon2 e tokens de sessão.

const USERS_KEY = 'portal-admissao:users:v1'
const SESSION_KEY = 'portal-admissao:session:v1'

const SEED_RH = {
  id: 'user-rh-admin',
  nome: 'Administrador RH',
  email: 'rh@empresa.com',
  senha: btoa('rh@empresa.com:admin123'),
  perfil: 'rh',
  criadoEm: new Date().toISOString(),
}

function loadUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    if (raw) {
      const users = JSON.parse(raw)
      if (Array.isArray(users) && users.length) return users
    }
  } catch { /* ignore */ }
  localStorage.setItem(USERS_KEY, JSON.stringify([SEED_RH]))
  return [SEED_RH]
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

function hash(email, senha) {
  return btoa(`${email.toLowerCase()}:${senha}`)
}

export function login(email, senha, perfilEsperado) {
  const users = loadUsers()
  const user = users.find((u) => u.email.toLowerCase() === (email || '').trim().toLowerCase())
  if (!user) return { ok: false, erro: 'Usuário não encontrado.' }
  if (user.senha !== hash(email, senha)) return { ok: false, erro: 'Senha incorreta.' }
  if (perfilEsperado && user.perfil !== perfilEsperado) {
    return { ok: false, erro: `Esta conta é de ${user.perfil === 'rh' ? 'RH' : 'Recrutador'}. Selecione o acesso correto.` }
  }
  const sessao = { id: user.id, nome: user.nome, email: user.email, perfil: user.perfil }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessao))
  return { ok: true, usuario: sessao }
}

export function sessaoSalva() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return null
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY)
}

export function listarUsuarios() {
  return loadUsers()
}

export function criarUsuario({ nome, email, senha, perfil }, usuarioAtual) {
  const users = loadUsers()
  if (users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) {
    return { ok: false, erro: 'Já existe um usuário com este e-mail.' }
  }
  const novo = {
    id: `user-${Date.now().toString(36)}`,
    nome: nome.trim(),
    email: email.trim(),
    senha: hash(email, senha),
    perfil, // 'rh' | 'recrutador'
    criadoPor: usuarioAtual?.email || '-',
    criadoEm: new Date().toISOString(),
  }
  saveUsers([...users, novo])
  return { ok: true, usuario: novo }
}

export function removerUsuario(id, usuarioAtual) {
  const users = loadUsers()
  if (id === usuarioAtual?.id) return { ok: false, erro: 'Você não pode remover a si mesmo.' }
  saveUsers(users.filter((u) => u.id !== id))
  return { ok: true }
}
