import { useState } from 'react'
import { login } from '../lib/auth'

export default function LoginView({ perfilEsperado, onLogado }) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')

  function entrar(e) {
    e.preventDefault()
    const r = login(email, senha, perfilEsperado)
    if (!r.ok) return setErro(r.erro)
    setErro('')
    onLogado(r.usuario)
  }

  return (
    <div className="card max-w-sm w-full mx-auto">
      <div className="size-12 mx-auto rounded-2xl bg-brand-600 text-white flex items-center justify-center text-xl font-bold shadow-[0_4px_12px_rgb(39_69_228/0.35)] mb-4">A</div>
      <h2 className="text-xl font-bold text-slate-900 text-center">
        {perfilEsperado === 'rh' ? 'Acesso do RH' : 'Acesso do Recrutador'}
      </h2>
      <p className="text-sm text-slate-500 text-center mt-1 mb-6">Entre com seu e-mail e senha corporativos.</p>
      <form onSubmit={entrar} className="space-y-4 text-left">
        <label className="block">
          <span className="field-label">E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="voce@empresa.com"
            autoFocus
          />
        </label>
        <label className="block">
          <span className="field-label">Senha</span>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="input"
            placeholder="••••••••"
          />
        </label>
        {erro && <p className="alert-error">{erro}</p>}
        <button className="btn-primary w-full">
          Entrar
        </button>
      </form>
    </div>
  )
}
