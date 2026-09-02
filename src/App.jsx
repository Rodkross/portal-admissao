import { useEffect, useState } from 'react'
import { loadDB, saveDB } from './lib/storage'
import { sessaoSalva, logout } from './lib/auth'
import RecrutadorView from './views/RecrutadorView'
import CandidatoView from './views/CandidatoView'
import RhView from './views/RhView'
import CadastrosView from './views/CadastrosView'
import LoginView from './views/LoginView'

// Abas internas (protegidas por login) e aba pública do candidato.
const ABAS_INTERNAS = [
  { id: 'recrutador', label: 'Recrutador', emoji: '🧑\u200d💼', perfis: ['recrutador'] },
  { id: 'rh', label: 'Admissões & Validação', emoji: '📋', perfis: ['rh'] },
  { id: 'cadastros', label: 'Cadastros', emoji: '🏢', perfis: ['rh'] },
]

// Migração: candidatos antigos foram gravados com recrutador fixo 'Recrutador'.
// Ao abrir o portal, o recrutador logado assume a autoria desses cadastros.
function carregarDbMigrado() {
  const db = loadDB()
  const usuario = sessaoSalva()
  if (!usuario || usuario.perfil !== 'recrutador') return db
  if (!db.candidatos?.some((c) => !c.recrutador || c.recrutador === 'Recrutador')) return db
  const migrado = {
    ...db,
    candidatos: db.candidatos.map((c) =>
      !c.recrutador || c.recrutador === 'Recrutador' ? { ...c, recrutador: usuario.nome } : c,
    ),
  }
  saveDB(migrado)
  return migrado
}

function App() {
  const [db, setDb] = useState(carregarDbMigrado)
  const [usuario, setUsuario] = useState(sessaoSalva)
  const [perfil, setPerfil] = useState('recrutador')
  const [mHash] = useState(() => location.hash.match(/^#\/acesso\/(\d+)/))
  const [hashAtual, setHashAtual] = useState(location.hash)

  useEffect(() => {
    const onChange = () => setHashAtual(location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const acessandoComoCandidato = !!mHash || hashAtual.startsWith('#/acesso/')
  const cpfAtivo = mHash?.[1] || hashAtual.match(/^#\/acesso\/(\d+)/)?.[1] || ''

  const abasPermitidas = usuario ? ABAS_INTERNAS.filter((a) => a.perfis.includes(usuario.perfil)) : []
  const abaAtiva = abasPermitidas.some((a) => a.id === perfil) ? perfil : abasPermitidas[0]?.id

  function atualizarDb(updater) {
    setDb((prev) => {
      const next = updater(prev)
      saveDB(next)
      return next
    })
  }

  const setCandidatos = (lista) => atualizarDb((prev) => ({ ...prev, candidatos: lista }))
  const atualizarCandidato = (id, fn) =>
    atualizarDb((prev) => ({ ...prev, candidatos: prev.candidatos.map((c) => (c.id === id ? fn(c) : c)) }))

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur text-white border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <a href="#/" className="flex items-center gap-3">
            <span className="size-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 flex items-center justify-center font-black shadow-[0_4px_12px_rgb(39_69_228/0.5)]">A</span>
            <span>
              <span className="block text-sm font-bold leading-tight">Portal de Admissão</span>
              <span className="block text-[11px] text-slate-400 leading-tight">Documentação de novos colaboradores</span>
            </span>
          </a>
          {acessandoComoCandidato ? (
            <a href="#/" className="text-sm text-slate-300 hover:text-white">Área interna →</a>
          ) : usuario ? (
            <div className="flex items-center gap-3">
              <nav className="flex gap-1 bg-white/5 rounded-xl p-1">
                {abasPermitidas.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setPerfil(a.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${abaAtiva === a.id ? 'bg-brand-600 text-white shadow-[0_1px_3px_rgb(0_0_0/0.4)]' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
                  >
                    {a.emoji} {a.label}
                  </button>
                ))}
              </nav>
              <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-white/10">
                <span className="size-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold">
                  {usuario.nome.charAt(0).toUpperCase()}
                </span>
                <div className="leading-tight">
                  <p className="text-xs font-semibold">{usuario.nome}</p>
                  <button onClick={() => { logout(); setUsuario(null) }} className="text-[11px] text-slate-400 hover:text-white">Sair</button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-8">
        {acessandoComoCandidato ? (
          <CandidatoView db={db} cpf={cpfAtivo} atualizarCandidato={atualizarCandidato} />
        ) : !usuario ? (
          <div className="max-w-sm mx-auto space-y-5">
            <div className="grid grid-cols-2 gap-2 bg-white rounded-xl border border-slate-200 p-1.5 shadow-[0_1px_2px_rgb(16_24_40/0.06)]">
              <button onClick={() => setPerfil('recrutador')} className={`py-2 rounded-lg text-sm font-semibold transition ${perfil === 'recrutador' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>{'🧑‍💼 Recrutador'}</button>
              <button onClick={() => setPerfil('rh')} className={`py-2 rounded-lg text-sm font-semibold transition ${perfil === 'rh' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>✅ RH</button>
            </div>
            <LoginView perfilEsperado={perfil} onLogado={setUsuario} />
            <p className="text-center text-xs text-slate-500">É candidato? Use o link recebido por WhatsApp ou <br /> <a href="#/acesso/" className="text-brand-600 font-medium hover:underline">acesse pelo seu CPF</a>.</p>
          </div>
        ) : abaAtiva === 'recrutador' ? (
          <RecrutadorView db={db} setCandidatos={setCandidatos} usuario={usuario} />
        ) : abaAtiva === 'rh' ? (
          <RhView db={db} atualizarCandidato={atualizarCandidato} />
        ) : abaAtiva === 'cadastros' ? (
          <CadastrosView db={db} atualizarDb={atualizarDb} usuarioAtual={usuario} />
        ) : null}
      </main>

      <footer className="max-w-5xl mx-auto w-full px-4 pb-8 pt-4 text-center text-xs text-slate-400">
        Portal de Admissão · Dados armazenados localmente (demo). Em produção: backend próprio + API WhatsApp Business.
      </footer>
    </div>
  )
}

export default App

