import { useState } from 'react'
import { listarUsuarios, criarUsuario, removerUsuario } from '../lib/auth'

const usuariosIniciais = listarUsuarios()

export default function UsuariosView({ usuarioAtual, onAtualizarUsuarios }) {
  const [usuarios, setUsuarios] = useState(usuariosIniciais)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [perfil, setPerfil] = useState('recrutador')
  const [msg, setMsg] = useState(null) // { tipo: 'ok'|'erro', texto }

  function sincronizar() {
    setUsuarios(listarUsuarios())
    onAtualizarUsuarios?.()
  }

  function cadastrar(e) {
    e.preventDefault()
    if (!nome.trim()) return setMsg({ tipo: 'erro', texto: 'Informe o nome.' })
    if (!/^\S+@\S+\.\S+$/.test(email)) return setMsg({ tipo: 'erro', texto: 'E-mail inválido.' })
    if (senha.length < 6) return setMsg({ tipo: 'erro', texto: 'A senha deve ter ao menos 6 caracteres.' })
    const r = criarUsuario({ nome, email, senha, perfil }, usuarioAtual)
    if (!r.ok) return setMsg({ tipo: 'erro', texto: r.erro })
    setNome(''); setEmail(''); setSenha('')
    setMsg({ tipo: 'ok', texto: `${r.usuario.nome} cadastrado como ${r.usuario.perfil === 'rh' ? 'RH' : 'Recrutador'}.` })
    sincronizar()
  }

  function remover(u) {
    const r = removerUsuario(u.id, usuarioAtual)
    if (!r.ok) return setMsg({ tipo: 'erro', texto: r.erro })
    setMsg({ tipo: 'ok', texto: `${u.nome} removido.` })
    sincronizar()
  }

  return (
    <div className="space-y-6">
      <section className="card">
        <h2 className="section-title">Cadastrar usuário interno</h2>
        <p className="section-sub mb-4">Crie acessos de RH ou Recrutador (e-mail e senha).</p>
        <form onSubmit={cadastrar} className="grid sm:grid-cols-2 gap-4 text-left">
          <label className="sm:col-span-2 text-sm">
            <span className="text-slate-600">Nome *</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} className="input" placeholder="Nome completo" />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">E-mail *</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="nome@empresa.com" />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Senha * (mín. 6 caracteres)</span>
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} className="input" placeholder="••••••••" />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Perfil *</span>
            <select value={perfil} onChange={(e) => setPerfil(e.target.value)} className="input">
              <option value="recrutador">Recrutador</option>
              <option value="rh">RH</option>
            </select>
          </label>
          <div className="flex items-end">
            <button className="btn-primary">Cadastrar</button>
          </div>
        </form>
        {msg && <p className={`mt-3 ${msg.tipo === 'ok' ? 'alert-success' : 'alert-error'}`}>{msg.texto}</p>}
      </section>

      <section className="card">
        <h2 className="section-title mb-4">Usuários ({usuarios.length})</h2>
        <div className="space-y-2 text-left">
          {usuarios.map((u) => (
            <div key={u.id} className="card-sm flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-slate-800">
                  {u.nome}{' '}
                  <span className={`badge ${u.perfil === 'rh' ? 'badge-ok' : 'badge-neutral'}`}>
                    {u.perfil === 'rh' ? 'RH' : 'Recrutador'}
                  </span>
                </p>
                <p className="text-xs text-slate-500">{u.email}</p>
              </div>
              {u.id !== usuarioAtual.id && (
                <button onClick={() => remover(u)} className="btn-outline btn-sm !text-rose-600 !border-rose-200 hover:!bg-rose-50">
                  Remover
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
