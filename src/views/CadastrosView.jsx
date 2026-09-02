import { useState } from 'react'
import { listarUsuarios, criarUsuario, removerUsuario } from '../lib/auth'

export default function CadastrosView({ db, atualizarDb, usuarioAtual }) {
  const [abaAtiva, setAbaAtiva] = useState('empresas') // 'empresas' | 'funcoes' | 'usuarios'

  // --- Estado Empresas ---
  const [novaEmpresa, setNovaEmpresa] = useState('')
  const [msgEmpresa, setMsgEmpresa] = useState(null)
  const empresas = db?.empresas || []

  // --- Estado Funções ---
  const [novaFuncao, setNovaFuncao] = useState('')
  const [msgFuncao, setMsgFuncao] = useState(null)
  const funcoes = db?.funcoes || []

  // --- Estado Usuários ---
  const [usuarios, setUsuarios] = useState(listarUsuarios)
  const [nomeUsuario, setNomeUsuario] = useState('')
  const [emailUsuario, setEmailUsuario] = useState('')
  const [senhaUsuario, setSenhaUsuario] = useState('')
  const [perfilUsuario, setPerfilUsuario] = useState('recrutador')
  const [msgUsuario, setMsgUsuario] = useState(null)

  // Handlers Empresas
  function addEmpresa(e) {
    e.preventDefault()
    const nome = novaEmpresa.trim()
    if (!nome) return setMsgEmpresa({ tipo: 'erro', texto: 'Informe o nome da empresa.' })
    if (empresas.some((emp) => emp.toLowerCase() === nome.toLowerCase())) {
      return setMsgEmpresa({ tipo: 'erro', texto: 'Essa empresa já está cadastrada.' })
    }
    atualizarDb?.((prev) => ({
      ...prev,
      empresas: [...(prev.empresas || []), nome],
    }))
    setNovaEmpresa('')
    setMsgEmpresa({ tipo: 'ok', texto: `Empresa "${nome}" cadastrada com sucesso.` })
  }

  function deletarEmpresa(emp) {
    if (empresas.length <= 1) {
      return setMsgEmpresa({ tipo: 'erro', texto: 'É necessário manter ao menos uma empresa cadastrada.' })
    }
    atualizarDb?.((prev) => ({
      ...prev,
      empresas: (prev.empresas || []).filter((item) => item !== emp),
    }))
    setMsgEmpresa({ tipo: 'ok', texto: `Empresa "${emp}" removida.` })
  }

  // Handlers Funções
  function addFuncao(e) {
    e.preventDefault()
    const nome = novaFuncao.trim()
    if (!nome) return setMsgFuncao({ tipo: 'erro', texto: 'Informe o nome da função.' })
    if (funcoes.some((fnc) => fnc.toLowerCase() === nome.toLowerCase())) {
      return setMsgFuncao({ tipo: 'erro', texto: 'Essa função já está cadastrada.' })
    }
    atualizarDb?.((prev) => ({
      ...prev,
      funcoes: [...(prev.funcoes || []), nome],
    }))
    setNovaFuncao('')
    setMsgFuncao({ tipo: 'ok', texto: `Função "${nome}" cadastrada com sucesso.` })
  }

  function deletarFuncao(fnc) {
    if (funcoes.length <= 1) {
      return setMsgFuncao({ tipo: 'erro', texto: 'É necessário manter ao menos uma função cadastrada.' })
    }
    atualizarDb?.((prev) => ({
      ...prev,
      funcoes: (prev.funcoes || []).filter((item) => item !== fnc),
    }))
    setMsgFuncao({ tipo: 'ok', texto: `Função "${fnc}" removida.` })
  }

  // Handlers Usuários
  function sincronizarUsuarios() {
    setUsuarios(listarUsuarios())
  }

  function addUsuario(e) {
    e.preventDefault()
    if (!nomeUsuario.trim()) return setMsgUsuario({ tipo: 'erro', texto: 'Informe o nome do usuário.' })
    if (!/^\S+@\S+\.\S+$/.test(emailUsuario)) return setMsgUsuario({ tipo: 'erro', texto: 'E-mail inválido.' })
    if (senhaUsuario.length < 6) return setMsgUsuario({ tipo: 'erro', texto: 'A senha deve ter ao menos 6 caracteres.' })

    const r = criarUsuario({ nome: nomeUsuario.trim().toUpperCase(), email: emailUsuario.trim().toLowerCase(), senha: senhaUsuario, perfil: perfilUsuario }, usuarioAtual)
    if (!r.ok) return setMsgUsuario({ tipo: 'erro', texto: r.erro })

    setNomeUsuario('')
    setEmailUsuario('')
    setSenhaUsuario('')
    setMsgUsuario({ tipo: 'ok', texto: `Usuário ${r.usuario.nome} cadastrado com perfil ${r.usuario.perfil === 'rh' ? 'RH' : 'Recrutador'}.` })
    sincronizarUsuarios()
  }

  function deletarUsuario(u) {
    const r = removerUsuario(u.id, usuarioAtual)
    if (!r.ok) return setMsgUsuario({ tipo: 'erro', texto: r.erro })
    setMsgUsuario({ tipo: 'ok', texto: `Usuário ${u.nome} removido.` })
    sincronizarUsuarios()
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Central de Cadastros</h1>
          <p className="text-sm text-slate-500">
            Gerencie as empresas, funções e acessos de usuários do sistema.
          </p>
        </div>
      </div>

      {/* Navegação por Sub-abas */}
      <div className="flex gap-2 p-1.5 bg-slate-200/70 rounded-xl max-w-fit">
        <button
          type="button"
          onClick={() => setAbaAtiva('empresas')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${abaAtiva === 'empresas' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
        >
          <span>🏢</span> Empresas ({empresas.length})
        </button>
        <button
          type="button"
          onClick={() => setAbaAtiva('funcoes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${abaAtiva === 'funcoes' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
        >
          <span>💼</span> Funções ({funcoes.length})
        </button>
        <button
          type="button"
          onClick={() => setAbaAtiva('usuarios')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${abaAtiva === 'usuarios' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
        >
          <span>👥</span> Usuários ({usuarios.length})
        </button>
      </div>

      {/* --- ABA EMPRESAS --- */}
      {abaAtiva === 'empresas' && (
        <div className="space-y-6 text-left">
          <section className="card">
            <h2 className="section-title mb-1">Cadastrar Nova Empresa</h2>
            <p className="section-sub mb-4">
              Empresas cadastradas aqui estarão disponíveis para os recrutadores selecionarem no momento do cadastro.
            </p>
            <form onSubmit={addEmpresa} className="flex flex-col sm:flex-row gap-3">
              <input
                value={novaEmpresa}
                onChange={(e) => { setNovaEmpresa(e.target.value); setMsgEmpresa(null) }}
                className="input flex-1"
                placeholder="Ex.: Distribuidora & Logística Express LTDA"
                autoFocus
              />
              <button type="submit" className="btn-primary shrink-0">
                ➕ Adicionar empresa
              </button>
            </form>
            {msgEmpresa && (
              <p className={`mt-3 ${msgEmpresa.tipo === 'ok' ? 'alert-success' : 'alert-error'}`}>
                {msgEmpresa.texto}
              </p>
            )}
          </section>

          <section className="card">
            <h2 className="section-title mb-4">Empresas Cadastradas ({empresas.length})</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {empresas.map((emp) => (
                <div
                  key={emp}
                  className="card-sm flex items-center justify-between gap-3 border border-slate-200 hover:border-slate-300 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl shrink-0">🏢</span>
                    <p className="font-semibold text-slate-800 truncate">{emp}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deletarEmpresa(emp)}
                    className="btn-outline btn-sm !text-rose-600 !border-rose-200 hover:!bg-rose-50 shrink-0"
                    title="Remover empresa"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* --- ABA FUNÇÕES --- */}
      {abaAtiva === 'funcoes' && (
        <div className="space-y-6 text-left">
          <section className="card">
            <h2 className="section-title mb-1">Cadastrar Nova Função / Cargo</h2>
            <p className="section-sub mb-4">
              Funções cadastradas aqui estarão disponíveis para os recrutadores e serão visíveis no portal do candidato.
            </p>
            <form onSubmit={addFuncao} className="flex flex-col sm:flex-row gap-3">
              <input
                value={novaFuncao}
                onChange={(e) => { setNovaFuncao(e.target.value); setMsgFuncao(null) }}
                className="input flex-1"
                placeholder="Ex.: Auxiliar de Expedição"
                autoFocus
              />
              <button type="submit" className="btn-primary shrink-0">
                ➕ Adicionar função
              </button>
            </form>
            {msgFuncao && (
              <p className={`mt-3 ${msgFuncao.tipo === 'ok' ? 'alert-success' : 'alert-error'}`}>
                {msgFuncao.texto}
              </p>
            )}
          </section>

          <section className="card">
            <h2 className="section-title mb-4">Funções Cadastradas ({funcoes.length})</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {funcoes.map((fnc) => (
                <div
                  key={fnc}
                  className="card-sm flex items-center justify-between gap-3 border border-slate-200 hover:border-slate-300 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl shrink-0">💼</span>
                    <p className="font-semibold text-slate-800 truncate">{fnc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deletarFuncao(fnc)}
                    className="btn-outline btn-sm !text-rose-600 !border-rose-200 hover:!bg-rose-50 shrink-0"
                    title="Remover função"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* --- ABA USUÁRIOS --- */}
      {abaAtiva === 'usuarios' && (
        <div className="space-y-6 text-left">
          <section className="card">
            <h2 className="section-title mb-1">Cadastrar Usuário Interno</h2>
            <p className="section-sub mb-4">
              Crie acessos internos para o portal (perfil RH ou Recrutador).
            </p>
            <form onSubmit={addUsuario} className="grid sm:grid-cols-2 gap-4">
              <label className="sm:col-span-2 text-sm">
                <span className="text-slate-600">Nome completo *</span>
                <input
                  value={nomeUsuario}
                  onChange={(e) => setNomeUsuario(e.target.value)}
                  className="input"
                  placeholder="Ex.: Carlos Mendes"
                />
              </label>
              <label className="text-sm">
                <span className="text-slate-600">E-mail de acesso *</span>
                <input
                  type="email"
                  value={emailUsuario}
                  onChange={(e) => setEmailUsuario(e.target.value)}
                  className="input"
                  placeholder="carlos@empresa.com"
                />
              </label>
              <label className="text-sm">
                <span className="text-slate-600">Senha de acesso * (mín. 6 caracteres)</span>
                <input
                  type="password"
                  value={senhaUsuario}
                  onChange={(e) => setSenhaUsuario(e.target.value)}
                  className="input"
                  placeholder="••••••••"
                />
              </label>
              <label className="text-sm">
                <span className="text-slate-600">Perfil de Acesso *</span>
                <select
                  value={perfilUsuario}
                  onChange={(e) => setPerfilUsuario(e.target.value)}
                  className="input"
                >
                  <option value="recrutador">🧑‍💼 Recrutador</option>
                  <option value="rh">✅ RH (Administrador)</option>
                </select>
              </label>
              <div className="flex items-end">
                <button type="submit" className="btn-primary w-full sm:w-auto">
                  ➕ Cadastrar usuário
                </button>
              </div>
            </form>
            {msgUsuario && (
              <p className={`mt-3 ${msgUsuario.tipo === 'ok' ? 'alert-success' : 'alert-error'}`}>
                {msgUsuario.texto}
              </p>
            )}
          </section>

          <section className="card">
            <h2 className="section-title mb-4">Usuários Cadastrados ({usuarios.length})</h2>
            <div className="space-y-2">
              {usuarios.map((u) => (
                <div key={u.id} className="card-sm flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-800">
                      {u.nome}{' '}
                      <span className={`badge ${u.perfil === 'rh' ? 'badge-ok' : 'badge-neutral'}`}>
                        {u.perfil === 'rh' ? 'RH' : 'Recrutador'}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </div>
                  {u.id !== usuarioAtual?.id && (
                    <button
                      type="button"
                      onClick={() => deletarUsuario(u)}
                      className="btn-outline btn-sm !text-rose-600 !border-rose-200 hover:!bg-rose-50"
                    >
                      Remover
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
