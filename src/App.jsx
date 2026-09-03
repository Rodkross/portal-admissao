import { useEffect, useState } from 'react'
import { observarCandidatos, observarSessao, logoutFB, observarNotificacoes, marcarNotificacoesLidasFB, notificarFB, criarCandidatoFB, atualizarCandidatoFB, observarConfig, entrarAnonimoFB } from './lib/api'
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

function App() {
  const [db, setDb] = useState({ candidatos: [], notificacoes: [] })
  const [usuario, setUsuario] = useState(null) // null = carregando; false = deslogado
  const [carregando, setCarregando] = useState(true)
  const [authPronto, setAuthPronto] = useState(false)
  const [perfil, setPerfil] = useState('recrutador')
  const [mHash] = useState(() => location.hash.match(/^#\/acesso\/(\d+)/))
  const [hashAtual, setHashAtual] = useState(location.hash)
  const [sinoAberto, setSinoAberto] = useState(false)

  // Sessão (Firebase Auth)
  useEffect(() => {
    const unsub = observarSessao((u) => {
      setUsuario(u || false)
      setAuthPronto(true)
      setCarregando(false)
    })
    return unsub
  }, [])

  // Login anônimo para quem está na área do candidato
  useEffect(() => {
    if (hashAtual.startsWith('#/acesso/')) entrarAnonimoFB()
  }, [hashAtual])

  // Candidatos em tempo real (só após a sessão resolver, para não morrer por permissão)
  useEffect(() => {
    if (!authPronto) return
    const unsub = observarCandidatos((candidatos) => setDb((prev) => ({ ...prev, candidatos })))
    return unsub
  }, [authPronto])

  // Configuração geral (empresas, funções)
  useEffect(() => {
    if (!authPronto) return
    const unsub = observarConfig((config) => setDb((prev) => ({ ...prev, empresas: config.empresas || [], funcoes: config.funcoes || [] })))
    return unsub
  }, [authPronto])

  const chaveNotificacoes = usuario?.perfil === 'rh' ? 'rh' : usuario?.nome || ''

  // Notificações em tempo real (só para usuários internos)
  useEffect(() => {
    if (!usuario || !chaveNotificacoes) {
      const t = setTimeout(() => setDb((prev) => (prev.notificacoes?.length ? { ...prev, notificacoes: [] } : prev)))
      return () => clearTimeout(t)
    }
    const unsub = observarNotificacoes(chaveNotificacoes, (notificacoes) => setDb((prev) => ({ ...prev, notificacoes })))
    return unsub
  }, [usuario, chaveNotificacoes])

  useEffect(() => {
    const onChange = () => setHashAtual(location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const acessandoComoCandidato = !!mHash || hashAtual.startsWith('#/acesso/')
  const cpfAtivo = mHash?.[1] || hashAtual.match(/^#\/acesso\/(\d+)/)?.[1] || ''

  const abasPermitidas = usuario ? ABAS_INTERNAS.filter((a) => a.perfis.includes(usuario.perfil)) : []
  const abaAtiva = abasPermitidas.some((a) => a.id === perfil) ? perfil : abasPermitidas[0]?.id

  /** Cria uma notificação interna. `para`: 'rh', nome do recrutador ou CPF do candidato. */
  const notificar = (para, resumo, tipo = 'info') => notificarFB(para, resumo, tipo)

  const notificacoesDoUsuario = chaveNotificacoes
  const minhasNotificacoes = db.notificacoes || []
  const naoLidas = minhasNotificacoes.filter((n) => !n.lida).length
  const marcarLidas = () => marcarNotificacoesLidasFB(notificacoesDoUsuario)

  // Assinaturas compatíveis com as views: operam direto no Firestore.
  // setCandidatos: usado apenas pelo cadastro do recrutador (candidato novo).
  const setCandidatos = (lista) => {
    const novo = lista[lista.length - 1]
    if (novo && !db.candidatos.some((c) => c.id === novo.id)) criarCandidatoFB(novo)
  }
  const atualizarCandidato = (id, fn) => {
    const alvo = db.candidatos.find((c) => c.id === id)
    if (alvo) atualizarCandidatoFB(id, fn)
  }

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

              {/* Sino de notificações internas */}
              <div className="relative">
                <button
                  onClick={() => setSinoAberto((v) => !v)}
                  className="relative size-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-lg transition"
                  title="Notificações"
                >
                  🔔
                  {naoLidas > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {naoLidas > 9 ? '9+' : naoLidas}
                    </span>
                  )}
                </button>
                {sinoAberto && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setSinoAberto(false)} />
                    <div className="absolute right-0 mt-2 z-40 w-80 max-w-[90vw] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800">
                      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50">
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Notificações</span>
                        {naoLidas > 0 && (
                          <button onClick={marcarLidas} className="text-xs text-brand-600 font-semibold hover:underline">Marcar como lidas</button>
                        )}
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {minhasNotificacoes.length === 0 ? (
                          <p className="text-xs text-slate-400 text-center py-6">Nenhuma notificação por aqui.</p>
                        ) : (
                          minhasNotificacoes.slice(0, 30).map((n) => (
                            <div key={n.id} className={`px-4 py-2.5 border-b border-slate-50 text-left ${n.lida ? '' : 'bg-brand-50/50'}`}>
                              <p className="text-xs text-slate-700">{n.resumo}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">{new Date(n.data).toLocaleString('pt-BR')}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-white/10">
                <span className="size-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold">
                  {usuario.nome.charAt(0).toUpperCase()}
                </span>
                <div className="leading-tight">
                  <p className="text-xs font-semibold">{usuario.nome}</p>
                  <button onClick={async () => { await logoutFB(); setUsuario(false) }} className="text-[11px] text-slate-400 hover:text-white">Sair</button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-8">
        {acessandoComoCandidato ? (
          <CandidatoView db={db} cpf={cpfAtivo} atualizarCandidato={atualizarCandidato} notificar={notificar} />
        ) : carregando ? (
          <div className="py-20 text-center text-slate-400 text-sm">Carregando…</div>
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
          <RecrutadorView db={db} setCandidatos={setCandidatos} usuario={usuario} notificar={notificar} />
        ) : abaAtiva === 'rh' ? (
          <RhView db={db} atualizarCandidato={atualizarCandidato} notificar={notificar} />
        ) : abaAtiva === 'cadastros' ? (
          <CadastrosView db={db} usuarioAtual={usuario} />
        ) : null}
      </main>

      <footer className="max-w-5xl mx-auto w-full px-4 pb-8 pt-4 text-center text-xs text-slate-400">
        Portal de Admissão · Dados no Firebase (Firestore + Storage) · Região sugerida: southamerica-east1
      </footer>
    </div>
  )
}

export default App

