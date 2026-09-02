import { useState } from 'react'
import {
  docsPara,
  maskCPF,
  maskPhone,
  isValidCPF,
  newId,
  onlyDigits,
  waLink,
  statusDocumentos,
  documentosFaltantes,
  isMotociclista,
} from '../lib/storage'

const ORDEM_PRIORIDADE = { reprovado: 0, andamento: 1, aprovado: 2 }

export default function RecrutadorView({ db, setCandidatos, usuario }) {
  const [modalAberto, setModalAberto] = useState(false)
  const [filtro, setFiltro] = useState('todos') // 'todos' | 'aprovado' | 'reprovado' | 'andamento'
  const [busca, setBusca] = useState('')

  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [telefone, setTelefone] = useState('')
  const [sexo, setSexo] = useState('M')
  const [motociclista, setMotociclista] = useState(false)
  const [empresa, setEmpresa] = useState('')
  const [funcao, setFuncao] = useState('')
  const [horista, setHorista] = useState(false)
  const [erro, setErro] = useState('')

  const empresasDisponiveis = db.empresas || []
  const funcoesDisponiveis = db.funcoes || []

  function abrirModal() {
    setNome('')
    setCpf('')
    setTelefone('')
    setSexo('M')
    setMotociclista(false)
    setEmpresa(db.empresas?.[0] || '')
    setFuncao(db.funcoes?.[0] || '')
    setHorista(false)
    setErro('')
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setErro('')
  }

  function enviar(e) {
    e.preventDefault()
    const d = onlyDigits(cpf)
    if (!nome.trim()) return setErro('Informe o nome completo.')
    if (!isValidCPF(d)) return setErro('CPF inválido.')
    if (onlyDigits(telefone).length < 10) return setErro('Telefone inválido.')
    if (!empresa.trim() && empresasDisponiveis.length > 0) return setErro('Selecione a empresa.')
    if (!funcao.trim() && funcoesDisponiveis.length > 0) return setErro('Selecione a função.')
    if (db.candidatos.some((c) => c.cpf === d)) return setErro('Já existe um candidato com este CPF.')

    const up = (s) => (s || '').trim().toUpperCase()
    const empresaFinal = up(empresa) || empresasDisponiveis[0] || 'Empresa Geral'
    const funcaoFinal = up(funcao) || funcoesDisponiveis[0] || 'Geral'
    const ehMoto = isMotociclista({ funcao: funcaoFinal, motociclista })

    const candidato = {
      id: newId('cand'),
      nome: up(nome),
      cpf: d,
      telefone: onlyDigits(telefone),
      sexo,
      motociclista: ehMoto,
      empresa: empresaFinal,
      funcao: funcaoFinal,
      horista: !!horista,
      contrato: {
        empresa: empresaFinal,
        funcao: funcaoFinal,
        horista: !!horista,
      },
      recrutador: usuario?.nome || 'Recrutador',
      criadoEm: new Date().toISOString(),
      documentos: {},
    }
    setCandidatos([...db.candidatos, candidato])
    setNome(''); setCpf(''); setTelefone(''); setMotociclista(false)
    setErro('')
    setModalAberto(false)
  }

  const linkAcesso = (c) => `${location.origin}${location.pathname}#/acesso/${c.cpf}`
  const msgConvite = (c) =>
    `Olá ${c.nome.split(' ')[0]}! Bem-vindo(a)! Para concluir sua admissão, acesse o portal e envie seus documentos: ${linkAcesso(c)}\n\nSeu acesso é o seu CPF (${c.cpf}).\nDocumentos necessários: ${docsPara(c).map((t) => t.nome).join(', ')}.`

  const msgExigencias = (c) => {
    const faltando = documentosFaltantes(c)
    const status = statusDocumentos(c)
    const reprovs = status.filter((d) => d.status === 'reprovado')
    let msg = `Olá ${c.nome.split(' ')[0]}! Sobre sua documentação de admissão:\n`
    if (reprovs.length) {
      msg += '\nDocumentos reprovados (corrija e reenvie pelo portal):\n'
      msg += reprovs.map((d) => `• ${d.nome}: ${d.observacao || 'documento reprovado'}`).join('\n')
    }
    if (faltando.length) {
      msg += '\n\nDocumentos ainda não enviados:\n'
      msg += faltando.map((f) => `• ${f.nome}`).join('\n')
    }
    msg += `\n\nAcesse o portal para enviar: ${linkAcesso(c)}`
    return msg
  }

  // Cada recrutador só visualiza os candidatos que ele mesmo encaminhou.
  const meusCandidatos = db.candidatos.filter((c) => c.recrutador === (usuario?.nome || ''))

  function getStatusCandidato(c) {
    const st = statusDocumentos(c)
    if (st.length > 0 && st.every((d) => d.status === 'aprovado')) return 'aprovado'
    if (st.some((d) => d.status === 'reprovado')) return 'reprovado'
    return 'andamento'
  }

  const totalAprovados = meusCandidatos.filter((c) => getStatusCandidato(c) === 'aprovado').length
  const totalReprovados = meusCandidatos.filter((c) => getStatusCandidato(c) === 'reprovado').length
  const totalAndamento = meusCandidatos.filter((c) => getStatusCandidato(c) === 'andamento').length

  const candidatosExibidos = meusCandidatos
    .slice()
    .reverse()
    .sort((a, b) => (ORDEM_PRIORIDADE[getStatusCandidato(a)] ?? 9) - (ORDEM_PRIORIDADE[getStatusCandidato(b)] ?? 9))
    .filter((c) => {
      if (filtro !== 'todos' && getStatusCandidato(c) !== filtro) return false
      if (busca.trim()) {
        const termo = busca.trim().toLowerCase()
        const termoDigitos = onlyDigits(termo)
        const nomeMatch = (c.nome || '').toLowerCase().includes(termo)
        const cpfMatch = termoDigitos.length > 0 && (c.cpf || '').includes(termoDigitos)
        return nomeMatch || cpfMatch
      }
      return true
    })

  return (
    <div className="space-y-6">
      {/* Topo com Ação Principal */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Painel do Recrutador</h1>
          <p className="text-sm text-slate-500">Acompanhe a evolução das admissões e envie convites por WhatsApp.</p>
        </div>
        <button onClick={abrirModal} className="btn-primary flex items-center gap-2">
          <span>➕</span> Cadastrar novo funcionário
        </button>
      </div>

      {/* Painel de Métricas / Indicadores */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => setFiltro('todos')}
          className={`card text-left transition p-4 sm:p-5 flex flex-col justify-between cursor-pointer ${
            filtro === 'todos' ? 'ring-2 ring-brand-500 bg-brand-50/40 border-brand-300' : 'hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Cadastrados</span>
            <span className="text-lg">👥</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900">{meusCandidatos.length}</p>
          <p className="text-xs text-slate-500 mt-1">Total de cadastrados</p>
        </button>

        <button
          type="button"
          onClick={() => setFiltro('aprovado')}
          className={`card text-left transition p-4 sm:p-5 flex flex-col justify-between cursor-pointer ${
            filtro === 'aprovado' ? 'ring-2 ring-emerald-500 bg-emerald-50/40 border-emerald-300' : 'hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Aprovados</span>
            <span className="text-lg">✅</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-emerald-700">{totalAprovados}</p>
          <p className="text-xs text-slate-500 mt-1">Documentos 100% OK</p>
        </button>

        <button
          type="button"
          onClick={() => setFiltro('reprovado')}
          className={`card text-left transition p-4 sm:p-5 flex flex-col justify-between cursor-pointer ${
            filtro === 'reprovado' ? 'ring-2 ring-rose-500 bg-rose-50/40 border-rose-300' : 'hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-rose-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Reprovados</span>
            <span className="text-lg">⚠️</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-rose-700">{totalReprovados}</p>
          <p className="text-xs text-slate-500 mt-1">Exigem correção</p>
        </button>

        <button
          type="button"
          onClick={() => setFiltro('andamento')}
          className={`card text-left transition p-4 sm:p-5 flex flex-col justify-between cursor-pointer ${
            filtro === 'andamento' ? 'ring-2 ring-amber-500 bg-amber-50/40 border-amber-300' : 'hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Em andamento</span>
            <span className="text-lg">⏳</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-amber-700">{totalAndamento}</p>
          <p className="text-xs text-slate-500 mt-1">Aguardando envio/análise</p>
        </button>
      </div>

      {/* Lista de Candidatos */}
      <section className="card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="section-title">
              {filtro === 'todos' && `Candidatos cadastrados (${candidatosExibidos.length})`}
              {filtro === 'aprovado' && `Candidatos Aprovados (${candidatosExibidos.length})`}
              {filtro === 'reprovado' && `Candidatos Reprovados / Com pendência (${candidatosExibidos.length})`}
              {filtro === 'andamento' && `Candidatos com documentação em andamento (${candidatosExibidos.length})`}
            </h2>
            {(filtro !== 'todos' || busca.trim()) && (
              <p className="section-sub flex items-center gap-2 flex-wrap mt-0.5">
                <span>Filtros ativos:</span>
                {filtro !== 'todos' && (
                  <button
                    type="button"
                    onClick={() => setFiltro('todos')}
                    className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline font-medium"
                  >
                    Status: {filtro} ✕
                  </button>
                )}
                {busca.trim() && (
                  <button
                    type="button"
                    onClick={() => setBusca('')}
                    className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline font-medium"
                  >
                    Nome: &quot;{busca}&quot; ✕
                  </button>
                )}
              </p>
            )}
          </div>

          <div className="relative w-full sm:w-72">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
              🔍
            </span>
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar candidato por nome..."
              className="input pl-9 pr-8 py-2 text-sm w-full"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca('')}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
                title="Limpar busca"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {candidatosExibidos.length === 0 ? (
          <div className="py-8 text-center text-slate-500">
            <p className="text-sm">
              {meusCandidatos.length === 0
                ? 'Nenhum candidato cadastrado por você ainda.'
                : busca.trim()
                  ? `Nenhum candidato encontrado com o nome "${busca}".`
                  : 'Nenhum candidato com o status selecionado.'}
            </p>
            {busca.trim() && (
              <button
                type="button"
                onClick={() => setBusca('')}
                className="btn-outline btn-sm mt-3"
              >
                Limpar busca
              </button>
            )}
            {meusCandidatos.length === 0 && !busca.trim() && (
              <button onClick={abrirModal} className="btn-primary mt-3 text-xs">
                Cadastrar primeiro funcionário
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {candidatosExibidos.map((c) => {
              const exigidos = docsPara(c)
              const st = statusDocumentos(c)
              const aprovs = st.filter((d) => d.status === 'aprovado').length
              const reprovs = st.filter((d) => d.status === 'reprovado').length
              const faltam = st.filter((d) => !d.arquivo).length
              const emAnalise = st.filter((d) => d.arquivo && d.status === 'pendente').length
              const stGeral = getStatusCandidato(c)

              return (
                <div key={c.id} className="card-sm flex flex-wrap items-center gap-3 justify-between text-left">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-800">{c.nome}</p>
                      {stGeral === 'aprovado' && <span className="badge badge-ok">✔ Aprovado</span>}
                      {stGeral === 'reprovado' && <span className="badge badge-bad">✖ Reprovado</span>}
                      {stGeral === 'andamento' && <span className="badge badge-warn">⏳ Em andamento</span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      CPF {maskCPF(c.cpf)} · {maskPhone(c.telefone)} · <span className="font-medium text-slate-700">{c.contrato?.funcao || c.funcao || 'Função a definir'}</span>{' '}
                      <span className="text-slate-500">({(c.contrato?.horista ?? c.horista) ? '⏰ Horista' : '📅 Mensalista'})</span> · {c.contrato?.empresa || c.empresa || 'Empresa a definir'} · {exigidos.length} docs
                    </p>
                    <p className="text-xs mt-1">
                      <span className="text-green-700">✔ {aprovs} aprovados</span>
                      {emAnalise > 0 && <span className="text-amber-600"> · ⏳ {emAnalise} em análise</span>}
                      {faltam > 0 && <span className="text-slate-500"> · 📄 {faltam} a enviar</span>}
                      {reprovs > 0 && <span className="text-red-600 font-semibold"> · ✖ {reprovs} reprovados</span>}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {reprovs > 0 && (
                      <a href={waLink(c.telefone, msgExigencias(c))} target="_blank" rel="noreferrer" className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-3 py-2 rounded-lg">
                        📲 Enviar exigências
                      </a>
                    )}
                    <a href={waLink(c.telefone, msgConvite(c))} target="_blank" rel="noreferrer" className="btn-wa btn-sm">
                      📲 Disparar convite no WhatsApp
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Modal de Cadastro de Novo Funcionário */}
      {modalAberto && (
        <div className="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={fecharModal}>
          <div className="card max-w-lg w-full max-h-[90vh] overflow-y-auto text-left shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Cadastrar novo funcionário</h2>
                <p className="text-xs text-slate-500">Preencha os dados coletados na entrevista para gerar o acesso.</p>
              </div>
              <button
                type="button"
                onClick={fecharModal}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 rounded-lg hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={enviar} className="grid sm:grid-cols-2 gap-4">
              <label className="sm:col-span-2 text-sm">
                <span className="text-slate-600">Nome completo *</span>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="input"
                  placeholder="Ex.: Maria Souza da Silva"
                  autoFocus
                />
              </label>
              <label className="text-sm">
                <span className="text-slate-600">CPF *</span>
                <input
                  value={maskCPF(cpf)}
                  onChange={(e) => setCpf(e.target.value)}
                  className="input"
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                />
              </label>
              <label className="text-sm">
                <span className="text-slate-600">Telefone (WhatsApp) *</span>
                <input
                  value={maskPhone(telefone)}
                  onChange={(e) => setTelefone(e.target.value)}
                  className="input"
                  placeholder="(11) 99999-9999"
                  inputMode="tel"
                />
              </label>
              <label className="text-sm">
                <span className="text-slate-600">Sexo *</span>
                <select value={sexo} onChange={(e) => setSexo(e.target.value)} className="input">
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                </select>
              </label>

              <label className="text-sm">
                <span className="text-slate-600">Empresa *</span>
                {empresasDisponiveis.length > 0 ? (
                  <select value={empresa} onChange={(e) => setEmpresa(e.target.value)} className="input">
                    {empresasDisponiveis.map((emp) => (
                      <option key={emp} value={emp}>{emp}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={empresa}
                    onChange={(e) => setEmpresa(e.target.value)}
                    className="input"
                    placeholder="Nome da empresa"
                  />
                )}
              </label>

              <label className="text-sm">
                <span className="text-slate-600">Função / Cargo *</span>
                {funcoesDisponiveis.length > 0 ? (
                  <select value={funcao} onChange={(e) => setFuncao(e.target.value)} className="input">
                    {funcoesDisponiveis.map((fnc) => (
                      <option key={fnc} value={fnc}>{fnc}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={funcao}
                    onChange={(e) => setFuncao(e.target.value)}
                    className="input"
                    placeholder="Nome da função"
                  />
                )}
              </label>

              <label className="text-sm">
                <span className="text-slate-600">Tipo de Contratação *</span>
                <select
                  value={horista ? 'sim' : 'nao'}
                  onChange={(e) => setHorista(e.target.value === 'sim')}
                  className="input font-medium"
                >
                  <option value="nao">📅 Mensalista</option>
                  <option value="sim">⏰ Horista (Remuneração por hora)</option>
                </select>
              </label>

              {isMotociclista({ funcao, motociclista }) && (
                <div className="sm:col-span-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-center gap-2">
                  <span>🏍️</span>
                  <span><strong>Função de Motociclista/Entregador:</strong> exigirá envio de CNH Categoria A e documento da moto (CRLV).</span>
                </div>
              )}
              {erro && <p className="sm:col-span-2 text-sm text-red-600 font-medium">{erro}</p>}
              <div className="sm:col-span-2 flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={fecharModal} className="btn-outline">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Cadastrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

