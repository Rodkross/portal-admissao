import { useEffect, useState } from 'react'
import { maskCPF, maskPhone, waLink, statusDocumentos, documentosFaltantes, docsPara, onlyDigits, isMotociclista } from '../lib/storage'
import { gerarFichaPDF, fichaLinhas } from '../lib/ficha'

const CONTRATO_VAZIO = { empresa: '', funcao: '', horista: false, salario: '', horario: '', folga: '', dataAdmissao: '' }

function ContratoForm({ cand, db, atualizarCandidato }) {
  const [form, setForm] = useState(() => ({
    ...CONTRATO_VAZIO,
    empresa: cand.contrato?.empresa || cand.empresa || '',
    funcao: cand.contrato?.funcao || cand.funcao || '',
    horista: cand.contrato?.horista !== undefined ? cand.contrato.horista : !!cand.horista,
    ...(cand.contrato || {}),
  }))
  const [salvo, setSalvo] = useState(false)
  // remontado via key={cand.id} no pai — sem necessidade de sincronizar por efeito

  const empresas = db?.empresas || []
  const funcoes = db?.funcoes || []

  const set = (campo, valor) => { setSalvo(false); setForm((f) => ({ ...f, [campo]: valor })) }

  function salvar() {
    const up = (s) => (s || '').trim().toUpperCase()
    atualizarCandidato(cand.id, (c) => ({
      ...c,
      empresa: up(form.empresa),
      funcao: up(form.funcao),
      horista: !!form.horista,
      contrato: {
        ...form,
        empresa: up(form.empresa),
        funcao: up(form.funcao),
        salario: up(form.salario),
        horario: up(form.horario),
        folga: up(form.folga),
        horista: !!form.horista,
        atualizadoEm: new Date().toISOString(),
      },
    }))
    setSalvo(true)
  }

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3 text-sm">
        <label>
          <span className="text-slate-600">Empresa *</span>
          {empresas.length > 0 ? (
            <select
              value={form.empresa}
              onChange={(e) => set('empresa', e.target.value)}
              className="input"
            >
              <option value="">Selecione a empresa</option>
              {empresas.map((emp) => (
                <option key={emp} value={emp}>{emp}</option>
              ))}
            </select>
          ) : (
            <input
              value={form.empresa}
              onChange={(e) => set('empresa', e.target.value)}
              className="input"
              placeholder="Razão social ou nome fantasia"
            />
          )}
        </label>

        <label>
          <span className="text-slate-600">Função *</span>
          {funcoes.length > 0 ? (
            <select
              value={form.funcao}
              onChange={(e) => set('funcao', e.target.value)}
              className="input"
            >
              <option value="">Selecione a função</option>
              {funcoes.map((fnc) => (
                <option key={fnc} value={fnc}>{fnc}</option>
              ))}
            </select>
          ) : (
            <input
              value={form.funcao}
              onChange={(e) => set('funcao', e.target.value)}
              className="input"
              placeholder="Ex.: Motoboy"
            />
          )}
        </label>

        <label>
          <span className="text-slate-600">Regime de Contratação *</span>
          <select
            value={form.horista ? 'sim' : 'nao'}
            onChange={(e) => set('horista', e.target.value === 'sim')}
            className="input font-medium"
          >
            <option value="nao">📅 Mensalista</option>
            <option value="sim">⏰ Horista (Remuneração por hora)</option>
          </select>
        </label>

        <label>
          <span className="text-slate-600">Salário / Valor da hora *</span>
          <input
            type="text"
            value={form.salario}
            onChange={(e) => set('salario', e.target.value)}
            className="input"
            placeholder={form.horista ? 'Ex.: R$ 12,50 / hora' : 'Ex.: R$ 2.500,00'}
          />
        </label>

        <label>
          <span className="text-slate-600">Horário de trabalho *</span>
          <input
            type="text"
            value={form.horario}
            onChange={(e) => set('horario', e.target.value)}
            className="input"
            placeholder="Ex.: Seg a Sex, 08h às 17h"
          />
        </label>

        <label>
          <span className="text-slate-600">Folga *</span>
          <input
            type="text"
            value={form.folga}
            onChange={(e) => set('folga', e.target.value)}
            className="input"
            placeholder="Ex.: Domingo e feriados"
          />
        </label>

        <label className="sm:col-span-2">
          <span className="text-slate-600">Data de admissão *</span>
          <input
            type="date"
            value={form.dataAdmissao}
            onChange={(e) => set('dataAdmissao', e.target.value)}
            className="input"
          />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={salvar}
          className="btn-primary btn-sm"
          disabled={!form.empresa.trim() || !form.funcao.trim() || !form.salario.trim() || !form.horario.trim() || !form.folga.trim() || !form.dataAdmissao}
        >
          Salvar dados contratuais
        </button>
        {salvo && <span className="text-xs text-emerald-700 font-medium">✅ Salvo</span>}
        {cand.contrato?.atualizadoEm && !salvo && (
          <span className="text-xs text-slate-400">Última atualização: {new Date(cand.contrato.atualizadoEm).toLocaleString('pt-BR')}</span>
        )}
      </div>
    </div>
  )
}

function ArquivoPreview({ arquivo, nomeTagPorId }) {
  const [modalAberto, setModalAberto] = useState(false)
  if (!arquivo) return null

  return (
    <div className="mt-2">
      {arquivo.dataUrl ? (
        <>
          <button
            type="button"
            onClick={() => setModalAberto(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 border border-brand-200 px-3 py-1.5 rounded-lg transition cursor-pointer"
          >
            <span>🔍</span> Visualizar documento completo
          </button>

          {modalAberto && (
            <div
              className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
              onClick={() => setModalAberto(false)}
            >
              <div
                className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full h-[90vh] flex flex-col overflow-hidden text-left border border-slate-200"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Cabeçalho do Modal */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50 shrink-0">
                  <div className="min-w-0 pr-4">
                    <h3 className="font-bold text-slate-900 text-base truncate flex items-center gap-2">
                      <span>📄</span> {(arquivo.tags || []).map((id) => nomeTagPorId(id)).join(', ') || 'Documento'}
                    </h3>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      Enviado em {new Date(arquivo.enviadoEm).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={arquivo.dataUrl}
                      download={arquivo.nomeArquivo}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-outline btn-sm !text-xs !py-1 !px-2.5 flex items-center gap-1"
                    >
                      <span>⬇</span> Baixar
                    </a>
                    <button
                      type="button"
                      onClick={() => setModalAberto(false)}
                      className="btn-outline btn-sm !text-xs !py-1 !px-2.5 font-bold hover:bg-slate-200"
                      title="Fechar"
                    >
                      ✕ Fechar
                    </button>
                  </div>
                </div>

                {/* Conteúdo do Documento em tela cheia/ampla */}
                <div className="flex-1 overflow-auto bg-slate-900/5 flex items-center justify-center p-2 sm:p-4">
                  {arquivo.tipo === 'application/pdf' ? (
                    <iframe
                      src={arquivo.dataUrl}
                      title={arquivo.nomeArquivo}
                      className="w-full h-full rounded-xl border border-slate-200 bg-white"
                    />
                  ) : (
                    <img
                      src={arquivo.dataUrl}
                      alt={arquivo.nomeArquivo}
                      className="max-w-full max-h-[82vh] object-contain rounded-xl shadow-md bg-white border border-slate-200"
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-slate-400">Arquivo grande — visualização indisponível nesta demo ({arquivo.nomeArquivo}).</p>
      )}
    </div>
  )
}

export default function RhView({ db, atualizarCandidato }) {
  const [selecionado, setSelecionado] = useState(null)
  const [filtro, setFiltro] = useState('todos') // 'todos' | 'aprovado' | 'reprovado' | 'andamento'
  const [busca, setBusca] = useState('')

  const [obsAberta, setObsAberta] = useState(null) // { candidatoId, arquivoId }
  const [obsTexto, setObsTexto] = useState('')
  const [previewAprovado, setPreviewAprovado] = useState(null) // { arquivo, cand } — duplo clique no resumo

  // Fecha o modal de análise com a tecla Esc
  useEffect(() => {
    if (!selecionado) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (obsAberta) {
          setObsAberta(null)
          setObsTexto('')
        } else {
          setSelecionado(null)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selecionado, obsAberta])

  function getStatusCandidato(c) {
    const st = statusDocumentos(c)
    if (st.length > 0 && st.every((d) => d.status === 'aprovado')) return 'aprovado'
    if (st.some((d) => d.status === 'reprovado')) return 'reprovado'
    // documentação completa enviada, mas ainda pendente de análise do RH
    const faltando = st.filter((d) => !d.arquivo)
    if (st.length > 0 && faltando.length === 0 && st.some((d) => d.status === 'pendente')) return 'doc_enviada'
    return 'andamento'
  }

  const todosCandidatos = db.candidatos || []
  const totalAprovados = todosCandidatos.filter((c) => getStatusCandidato(c) === 'aprovado').length
  const totalReprovados = todosCandidatos.filter((c) => getStatusCandidato(c) === 'reprovado').length
  const totalDocEnviada = todosCandidatos.filter((c) => getStatusCandidato(c) === 'doc_enviada').length
  const totalAndamento = todosCandidatos.filter((c) => getStatusCandidato(c) === 'andamento').length

  const candidatosExibidos = todosCandidatos
    .slice()
    .reverse()
    .filter((c) => {
      if (filtro !== 'todos' && getStatusCandidato(c) !== filtro) return false
      if (busca.trim()) {
        const termo = busca.trim().toLowerCase()
        const termoDigitos = onlyDigits(termo)
        const nomeMatch = (c.nome || '').toLowerCase().includes(termo)
        const empresaMatch = (c.contrato?.empresa || c.empresa || '').toLowerCase().includes(termo)
        const funcaoMatch = (c.contrato?.funcao || c.funcao || '').toLowerCase().includes(termo)
        const recrutadorMatch = (c.recrutador || '').toLowerCase().includes(termo)
        const cpfMatch = termoDigitos.length > 0 && (c.cpf || '').includes(termoDigitos)
        return nomeMatch || empresaMatch || funcaoMatch || recrutadorMatch || cpfMatch
      }
      return true
    })

  function decidir(candidato, arquivoId, status) {
    if (status === 'reprovado') {
      setObsAberta({ candidatoId: candidato.id, arquivoId })
      setObsTexto('')
      return
    }
    aplicar(candidato, arquivoId, status, '')
  }

  function aplicar(candidato, arquivoId, status, observacao) {
    atualizarCandidato(candidato.id, (c) => ({
      ...c,
      arquivos: (c.arquivos || []).map((a) => (a.id === arquivoId ? { ...a, status, observacao } : a)),
    }))
    setObsAberta(null)
    setObsTexto('')
  }

  function confirmarReprovacao() {
    if (!obsTexto.trim()) return
    aplicar(
      db.candidatos.find((c) => c.id === obsAberta.candidatoId),
      obsAberta.arquivoId,
      'reprovado',
      obsTexto.trim(),
    )
  }

  function msgExigencias(c) {
    const faltando = documentosFaltantes(c)
    const status = statusDocumentos(c)
    const reprovs = status.filter((d) => d.status === 'reprovado')
    let msg = `Olá ${c.nome.split(' ')[0]}! Atualização da sua documentação de admissão:\n`
    if (reprovs.length) {
      msg += '\nInformações com documento reprovado (corrija e reenvie):\n'
      msg += reprovs.map((d) => `• ${d.nome}: ${d.observacao || 'reprovado'}`).join('\n')
    }
    if (faltando.length) {
      msg += '\n\nInformações ainda não comprovadas:\n'
      msg += faltando.map((f) => `• ${f.nome}`).join('\n')
    }
    if (!reprovs.length && !faltando.length) msg += '\nTudo certo! Sua documentação foi validada. 🎉'
    else msg += `\n\nAcesse o portal para enviar: ${location.origin}${location.pathname}#/acesso/${c.cpf}`
    return msg
  }

  const cand = db.candidatos.find((c) => c.id === selecionado)

  return (
    <div className="space-y-6">
      {/* Topo do RH */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Panorama de Admissões & Validação</h1>
          <p className="text-sm text-slate-500">
            Acompanhe a entrega de documentos, valide as informações e emita as fichas de admissão.
          </p>
        </div>
      </div>

      {/* Painel de Métricas (Panorama) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => setFiltro('todos')}
          className={`card text-left transition p-4 sm:p-5 flex flex-col justify-between cursor-pointer ${
            filtro === 'todos' ? 'ring-2 ring-brand-500 bg-brand-50/40 border-brand-300' : 'hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Candidatos</span>
            <span className="text-lg">👥</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900">{todosCandidatos.length}</p>
          <p className="text-xs text-slate-500 mt-1">Total em admissão</p>
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
          <p className="text-xs text-slate-500 mt-1">Prontos para admissão</p>
        </button>

        <button
          type="button"
          onClick={() => setFiltro('reprovado')}
          className={`card text-left transition p-4 sm:p-5 flex flex-col justify-between cursor-pointer ${
            filtro === 'reprovado' ? 'ring-2 ring-rose-500 bg-rose-50/40 border-rose-300' : 'hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-rose-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Com Exigência</span>
            <span className="text-lg">⚠️</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-rose-700">{totalReprovados}</p>
          <p className="text-xs text-slate-500 mt-1">Aguardando correção</p>
        </button>

        <button
          type="button"
          onClick={() => setFiltro('doc_enviada')}
          className={`card text-left transition p-4 sm:p-5 flex flex-col justify-between cursor-pointer ${
            filtro === 'doc_enviada' ? 'ring-2 ring-sky-500 bg-sky-50/40 border-sky-300' : 'hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-sky-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Doc. Enviada</span>
            <span className="text-lg">📥</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-sky-700">{totalDocEnviada}</p>
          <p className="text-xs text-slate-500 mt-1">Pendente de análise</p>
        </button>

        <button
          type="button"
          onClick={() => setFiltro('andamento')}
          className={`card text-left transition p-4 sm:p-5 flex flex-col justify-between cursor-pointer ${
            filtro === 'andamento' ? 'ring-2 ring-amber-500 bg-amber-50/40 border-amber-300' : 'hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Em Andamento</span>
            <span className="text-lg">⏳</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-amber-700">{totalAndamento}</p>
          <p className="text-xs text-slate-500 mt-1">Envio pendente / incompleto</p>
        </button>
      </div>

      {/* Lista de Candidatos para Validação */}
      <section className="card text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="section-title">
              {filtro === 'todos' && `Candidatos em Admissão (${candidatosExibidos.length})`}
              {filtro === 'aprovado' && `Candidatos Aprovados (${candidatosExibidos.length})`}
              {filtro === 'reprovado' && `Candidatos com Exigência (${candidatosExibidos.length})`}
              {filtro === 'doc_enviada' && `Candidatos com Documentação Enviada — Pendente de Análise (${candidatosExibidos.length})`}
              {filtro === 'andamento' && `Candidatos com Documentação em Andamento (${candidatosExibidos.length})`}
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
                    Busca: &quot;{busca}&quot; ✕
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
              placeholder="Buscar por nome, CPF ou cargo..."
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
              {todosCandidatos.length === 0
                ? 'Nenhum candidato cadastrado no portal ainda.'
                : busca.trim()
                  ? `Nenhum candidato encontrado com o termo "${busca}".`
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
          </div>
        ) : (
          <div className="space-y-2">
            {candidatosExibidos.map((c) => {
              const status = statusDocumentos(c)
              const aprovs = status.filter((d) => d.status === 'aprovado').length
              const reprovs = status.filter((d) => d.status === 'reprovado').length
              const faltam = status.filter((d) => !d.arquivo).length
              const emAnalise = status.filter((d) => d.arquivo && d.status === 'pendente').length
              const stGeral = getStatusCandidato(c)
              const isSelected = selecionado === c.id

              return (
                <button
                  key={c.id}
                  onClick={() => setSelecionado((prev) => (prev === c.id ? null : c.id))}
                  className={`w-full border rounded-xl p-3.5 flex flex-wrap sm:flex-nowrap justify-between items-center text-left transition gap-3 ${
                    isSelected
                      ? 'border-brand-500 bg-brand-50/70 ring-2 ring-brand-300 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900">{c.nome}</span>
                      {stGeral === 'aprovado' && <span className="badge badge-ok">✔ Aprovado</span>}
                      {stGeral === 'reprovado' && <span className="badge badge-bad">✖ Com Exigência</span>}
                      {stGeral === 'doc_enviada' && <span className="badge bg-sky-50 text-sky-700 ring-1 ring-sky-200">📥 Doc. Enviada</span>}
                      {stGeral === 'andamento' && <span className="badge badge-warn">⏳ Em Andamento</span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      CPF {maskCPF(c.cpf)} · <span className="font-medium text-slate-700">{c.contrato?.empresa || c.empresa || 'Empresa não informada'}</span> · {c.contrato?.funcao || c.funcao || 'Função não informada'} ({(c.contrato?.horista ?? c.horista) ? 'Horista' : 'Mensalista'}) · Recrutador: {c.recrutador || '—'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs shrink-0">
                    <span className="text-emerald-700 font-semibold">✔ {aprovs} OK</span>
                    {emAnalise > 0 && <span className="text-amber-600 font-medium">· ⏳ {emAnalise} em análise</span>}
                    {faltam > 0 && <span className="text-slate-400">· 📄 {faltam} faltam</span>}
                    {reprovs > 0 && <span className="text-rose-600 font-bold">· ✖ {reprovs}</span>}
                    <span className="ml-2 text-slate-400">{isSelected ? '▼' : '▶'}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* Modal do Candidato Selecionado — análise em tela ajustável */}
      {cand && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
          onClick={() => setSelecionado(null)}
        >
        <section
          className="bg-white rounded-2xl border-2 border-brand-300 shadow-2xl w-full max-w-5xl h-[94vh] flex flex-col text-left overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-wrap justify-between items-start gap-3 p-5 border-b border-slate-200 bg-slate-50 shrink-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-slate-900 truncate">{cand.nome}</h3>
                {cand.ficha?.atualizadoEm && <span className="badge badge-ok">Ficha enviada</span>}
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                CPF {maskCPF(cand.cpf)} · {maskPhone(cand.telefone)} · {cand.sexo === 'M' ? 'Masculino' : 'Feminino'}{isMotociclista(cand) ? ' · 🏍 Motociclista' : ''} · Recrutador: <strong>{cand.recrutador || '—'}</strong>
              </p>
              <p className="text-sm mt-1.5 flex items-center gap-2 flex-wrap">
                <span className="text-slate-500 font-medium">Empresa:</span>
                {(cand.contrato?.empresa || cand.empresa)
                  ? <span className="font-semibold text-brand-700">{cand.contrato?.empresa || cand.empresa}</span>
                  : <span className="text-amber-700">não informada</span>}
                <span className="text-slate-300">|</span>
                <span className="text-slate-500 font-medium">Função:</span>
                <span className="font-semibold text-slate-800">{cand.contrato?.funcao || cand.funcao || 'não informada'}</span>
                <span className="badge badge-neutral text-[10px]">
                  {(cand.contrato?.horista ?? cand.horista) ? '⏰ Horista' : '📅 Mensalista'}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <a href={waLink(cand.telefone, msgExigencias(cand))} target="_blank" rel="noreferrer" className="btn-wa btn-sm">
                📲 Disparar exigências no WhatsApp
              </a>
              <button onClick={() => gerarFichaPDF(cand)} className="btn-outline btn-sm">
                ⬇ Baixar ficha + documentação (PDF)
              </button>
              <button onClick={() => setSelecionado(null)} className="btn-outline btn-sm font-bold hover:bg-slate-200" title="Fechar (Esc)">
                ✕ Fechar
              </button>
            </div>
          </div>

          {/* Conteúdo rolável do modal */}
          <div className="flex-1 overflow-y-auto p-5">

          {/* Ficha completa do candidato — visualização antes do download */}
          <div className="mt-6">
            <h3 className="section-title px-1 mb-2">Ficha do candidato</h3>
            {!cand.ficha?.atualizadoEm && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-3">
                O candidato ainda não preencheu/enviou a ficha de dados pessoais no portal dele.
              </p>
            )}
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 mb-6 text-sm">
              {fichaLinhas(cand).map(([rotulo, valor]) => (
                <div key={rotulo} className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-1">
                  <span className="text-xs text-slate-400 shrink-0">{rotulo}</span>
                  <span className="text-sm text-slate-800 font-medium text-right break-words min-w-0 whitespace-pre-line">{valor}</span>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-1 sm:col-span-2">
                <span className="text-xs text-slate-400 shrink-0">Ficha atualizada em</span>
                <span className="text-sm text-slate-800 font-medium">{cand.ficha?.atualizadoEm ? new Date(cand.ficha.atualizadoEm).toLocaleString('pt-BR') : '—'}</span>
              </div>
            </div>
          </div>

          {/* Dados contratuais — função, salário, horário, folga, admissão */}
          <h3 className="section-title px-1 mb-2">Dados contratuais</h3>
          <div className="card-sm mb-6">
            <ContratoForm key={cand.id} cand={cand} db={db} atualizarCandidato={atualizarCandidato} />
          </div>

          {/* Validação por ARQUIVO enviado (um arquivo pode cobrir vários docs) — aprovados saem da lista */}
          <h3 className="section-title px-1 mb-2">Arquivos enviados ({(cand.arquivos || []).length})</h3>
          <div className="space-y-3 mb-6">
            {(() => {
              const pendentes = (cand.arquivos || []).filter((a) => a.status !== 'aprovado')
              if ((cand.arquivos || []).length === 0) return <p className="text-sm text-slate-400">Nenhum arquivo enviado ainda.</p>
              if (pendentes.length === 0) return <p className="text-sm text-emerald-700">✅ Todos os arquivos enviados já foram aprovados — veja a situação no resumo abaixo.</p>
              return null
            })()}
            {[...(cand.arquivos || [])].filter((a) => a.status !== 'aprovado').reverse().map((a) => {
              const nomesTags = (a.tags || []).map((id) => docsPara(cand).find((t) => t.id === id)?.nome || id)
              return (
                <div key={a.id} className="card-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{nomesTags.join(', ') || 'Documento'}</p>
                      <p className="text-xs text-slate-500">
                        Enviado em {new Date(a.enviadoEm).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <span className={`badge ${a.status === 'aprovado' ? 'badge-ok' : a.status === 'reprovado' ? 'badge-bad' : 'badge-warn'}`}>
                      {a.status.toUpperCase()}
                    </span>
                  </div>

                  <ArquivoPreview arquivo={a} nomeTagPorId={(id) => docsPara(cand).find((t) => t.id === id)?.nome || id} />

                  {a.status === 'reprovado' && a.observacao && (
                    <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2 mt-2">Observação: {a.observacao}</p>
                  )}

                  {obsAberta?.arquivoId === a.id && obsAberta?.candidatoId === cand.id ? (
                    <div className="mt-3 bg-rose-50 border border-rose-200 rounded-xl p-3">
                      <label className="text-xs font-semibold text-rose-700">Observação da reprovação (obrigatória) *</label>
                      <textarea
                        value={obsTexto}
                        onChange={(e) => setObsTexto(e.target.value)}
                        rows={2}
                        placeholder="Ex.: RG com foto ilegível, reenvie com melhor qualidade."
                        className="input mt-1"
                      />
                      <div className="flex gap-2 mt-2">
                        <button onClick={confirmarReprovacao} className="btn-danger btn-sm">Confirmar reprovação</button>
                        <button onClick={() => setObsAberta(null)} className="btn-outline btn-sm">Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    a.status !== 'aprovado' && (
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => decidir(cand, a.id, 'aprovado')} className="btn-success btn-sm">✔ Aprovar</button>
                        <button onClick={() => decidir(cand, a.id, 'reprovado')} className="btn-danger btn-sm">✖ Reprovar</button>
                      </div>
                    )
                  )}
                </div>
              )
            })}
          </div>

          {/* Resumo por informação exigida */}
          <h3 className="section-title px-1 mb-2">Situação por informação exigida</h3>
          <p className="text-[11px] text-slate-400 px-1 mb-2">💡 Itens aprovados saem da lista acima. Dê duplo clique em um item aprovado para rever o documento.</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {statusDocumentos(cand).map((d) => (
              <div
                key={d.docId}
                onDoubleClick={d.arquivo && d.status === 'aprovado' ? () => setPreviewAprovado({ arquivo: d.arquivo, cand }) : undefined}
                title={d.arquivo && d.status === 'aprovado' ? 'Duplo clique para visualizar o documento' : undefined}
                className={`flex items-center justify-between gap-2 border rounded-lg px-3 py-2 text-left bg-slate-50/50 ${
                  d.arquivo && d.status === 'aprovado' ? 'cursor-pointer border-emerald-200 hover:bg-emerald-50/60 select-none' : 'border-slate-200'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{d.nome}</p>
                  {d.arquivo && (
                    <p className="text-[11px] text-slate-400 truncate">
                      Enviado em {d.enviadoEm ? new Date(d.enviadoEm).toLocaleDateString('pt-BR') : '—'}
                    </p>
                  )}
                </div>
                <span className={`badge ${d.arquivo ? (d.status === 'aprovado' ? 'badge-ok' : d.status === 'reprovado' ? 'badge-bad' : 'badge-warn') : 'badge-neutral'}`}>
                  {d.arquivo ? (d.status === 'aprovado' ? '✔ OK' : d.status === 'reprovado' ? '✖ Reprov.' : '⏳ Análise') : 'Falta'}
                </span>
              </div>
            ))}
          </div>
          </div>
        </section>
        </div>
      )}

      {/* Modal de visualização de documento aprovado (duplo clique no resumo) */}
      {previewAprovado && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4" onClick={() => setPreviewAprovado(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full h-[90vh] flex flex-col overflow-hidden text-left border border-slate-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50 shrink-0">
              <div className="min-w-0 pr-4">
                <h3 className="font-bold text-slate-900 text-base truncate flex items-center gap-2">
                  <span>📄</span> {(previewAprovado.arquivo.tags || []).map((id) => docsPara(previewAprovado.cand).find((t) => t.id === id)?.nome || id).join(', ') || 'Documento'}
                  <span className="badge badge-ok">✔ Aprovado</span>
                </h3>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  Enviado em {new Date(previewAprovado.arquivo.enviadoEm).toLocaleString('pt-BR')}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a href={previewAprovado.arquivo.dataUrl} download={previewAprovado.arquivo.nomeArquivo} target="_blank" rel="noreferrer" className="btn-outline btn-sm !text-xs !py-1 !px-2.5 flex items-center gap-1">
                  <span>⬇</span> Baixar
                </a>
                <button type="button" onClick={() => setPreviewAprovado(null)} className="btn-outline btn-sm !text-xs !py-1 !px-2.5 font-bold hover:bg-slate-200">✕ Fechar</button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-slate-900/5 flex items-center justify-center p-2 sm:p-4">
              {previewAprovado.arquivo.tipo === 'application/pdf' ? (
                <iframe src={previewAprovado.arquivo.dataUrl} title="Documento aprovado" className="w-full h-full rounded-xl border border-slate-200 bg-white" />
              ) : (
                <img src={previewAprovado.arquivo.dataUrl} alt={previewAprovado.arquivo.nomeArquivo} className="max-w-full max-h-[82vh] object-contain rounded-xl shadow-md bg-white border border-slate-200" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
