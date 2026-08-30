import { useState } from 'react'
import { DOC_TIPOS, docsPara, maskCPF, maskPhone, isValidCPF, newId, onlyDigits, waLink } from '../lib/storage'

export default function RecrutadorView({ db, setCandidatos }) {
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [telefone, setTelefone] = useState('')
  const [sexo, setSexo] = useState('M')
  const [motociclista, setMotociclista] = useState(false)
  const [erro, setErro] = useState('')

  function enviar(e) {
    e.preventDefault()
    const d = onlyDigits(cpf)
    if (!nome.trim()) return setErro('Informe o nome completo.')
    if (!isValidCPF(d)) return setErro('CPF inválido.')
    if (onlyDigits(telefone).length < 10) return setErro('Telefone inválido.')
    if (db.candidatos.some((c) => c.cpf === d)) return setErro('Já existe um candidato com este CPF.')
    const candidato = {
      id: newId('cand'),
      nome: nome.trim(),
      cpf: d,
      telefone: onlyDigits(telefone),
      sexo,
      motociclista,
      recrutador: 'Recrutador',
      criadoEm: new Date().toISOString(),
      documentos: {},
    }
    setCandidatos([...db.candidatos, candidato])
    setNome(''); setCpf(''); setTelefone(''); setMotociclista(false)
    setErro('')
    navigator.clipboard?.writeText(`${location.origin}${location.pathname}#/acesso/${d}`).catch(() => { })
  }

  const linkAcesso = (c) => `${location.origin}${location.pathname}#/acesso/${c.cpf}`
  const msgConvite = (c) =>
    `Olá ${c.nome.split(' ')[0]}! Bem-vindo(a)! Para concluir sua admissão, acesse o portal e envie seus documentos: ${linkAcesso(c)}\n\nSeu acesso é o seu CPF (${c.cpf}).\nDocumentos necessários: ${docsPara(c).map((t) => t.nome).join(', ')}.`
  const msgExigencias = (c) => {
    const reprovs = Object.entries(c.documentos || {}).filter(([, v]) => v.status === 'reprovado')
    const base = `Olá ${c.nome.split(' ')[0]}! Sobre sua documentação de admissão:`
    if (reprovs.length === 0) return base + '\nTodos os documentos foram enviados e estão aguardando validação. Acompanhe no portal: ' + linkAcesso(c)
    return base + '\n' + reprovs.map(([id, v]) => `• ${DOC_TIPOS.find((t) => t.id === id)?.nome}: ${v.observacao || 'documento reprovado'}`).join('\n') + `\n\nCorrija e reenvie pelo portal: ${linkAcesso(c)}`
  }

  const aberto = db.candidatos[db.candidatos.length - 1]

  return (
    <div className="space-y-6">
      <section className="card">
        <h2 className="section-title">Cadastrar entrevistado</h2>
        <p className="section-sub mb-4">Preencha os dados coletados na entrevista e dispare o link de acesso ao candidato.</p>
        <form onSubmit={enviar} className="grid sm:grid-cols-2 gap-4 text-left">
          <label className="sm:col-span-2 text-sm">
            <span className="text-slate-600">Nome completo *</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} className="input" placeholder="Ex.: Maria Souza da Silva" />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">CPF *</span>
            <input value={maskCPF(cpf)} onChange={(e) => setCpf(e.target.value)} className="input" placeholder="000.000.000-00" inputMode="numeric" />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Telefone (WhatsApp) *</span>
            <input value={maskPhone(telefone)} onChange={(e) => setTelefone(e.target.value)} className="input" placeholder="(11) 99999-9999" inputMode="tel" />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Sexo *</span>
            <select value={sexo} onChange={(e) => setSexo(e.target.value)} className="input">
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
            </select>
          </label>
          <label className="text-sm flex items-center gap-2 mt-6">
            <input type="checkbox" checked={motociclista} onChange={(e) => setMotociclista(e.target.checked)} className="size-4" />
            <span className="text-slate-600">Motociclista (exige CNH A + CRLV da moto)</span>
          </label>
          {erro && <p className="sm:col-span-2 text-sm text-red-600 font-medium">{erro}</p>}
          <div className="sm:col-span-2">
            <button className="btn-primary">Cadastrar e gerar link</button>
          </div>
        </form>
      </section>

      {aberto && (
        <section className="card text-left">
          <h2 className="text-lg font-bold text-slate-800 mb-2">Candidato recém-cadastrado</h2>
          <p className="text-sm text-slate-600 mb-3">{aberto.nome} — CPF {maskCPF(aberto.cpf)}</p>
          <div className="flex flex-wrap gap-3">
            <a href={waLink(aberto.telefone, msgConvite(aberto))} target="_blank" rel="noreferrer" className="btn-wa">
              📲 Disparar convite no WhatsApp
            </a>
            <button onClick={() => navigator.clipboard?.writeText(linkAcesso(aberto))} className="btn-outline">Copiar link de acesso</button>
          </div>
          <code className="block mt-3 text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 break-all text-slate-600">{linkAcesso(aberto)}</code>
        </section>
      )}

      <section className="card">
        <h2 className="section-title mb-4">Candidatos ({db.candidatos.length})</h2>
        {db.candidatos.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum candidato cadastrado ainda.</p>
        ) : (
          <div className="space-y-3">
            {db.candidatos.slice().reverse().map((c) => {
              const exigidos = docsPara(c)
              const env = c.documentos || {}
              const aprovs = exigidos.filter((t) => env[t.id]?.status === 'aprovado').length
              const reprovs = exigidos.filter((t) => env[t.id]?.status === 'reprovado').length
              return (
                <div key={c.id} className="card-sm flex flex-wrap items-center gap-3 justify-between text-left">
                  <div>
                    <p className="font-semibold text-slate-800">{c.nome}</p>
                    <p className="text-xs text-slate-500">CPF {maskCPF(c.cpf)} · {maskPhone(c.telefone)} · {exigidos.length} documentos exigidos</p>
                    <p className="text-xs mt-1">
                      <span className="text-green-700">✔ {aprovs} aprovados</span> · <span className="text-amber-600">⏳ {exigidos.filter((t) => !env[t.id] || env[t.id].status === 'pendente').length} pendentes</span>{' '}
                      {reprovs > 0 && <span className="text-red-600">· ✖ {reprovs} reprovados</span>}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {reprovs > 0 && (
                      <a href={waLink(c.telefone, msgExigencias(c))} target="_blank" rel="noreferrer" className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-3 py-2 rounded-lg">
                        📲 Enviar exigências
                      </a>
                    )}
                    <button onClick={() => navigator.clipboard?.writeText(linkAcesso(c))} className="btn-outline btn-sm">Copiar link</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

