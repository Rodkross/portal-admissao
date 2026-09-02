import { useRef, useState } from 'react'
import { docsPara, maskCPF, onlyDigits, statusDocumentos, documentosFaltantes, isDocDependente, newId } from '../lib/storage'
import FichaCandidato from './FichaCandidato'

const MAX_MB = 5

/** Reduz/comprime uma imagem grande via canvas para caber no localStorage. */
import { enviarArquivoFB, excluirArquivoFB } from '../lib/api'

function comprimirImagem(file, maxLado = 1600, qualidade = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const escala = Math.min(1, maxLado / Math.max(img.naturalWidth, img.naturalHeight))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.naturalWidth * escala)
        canvas.height = Math.round(img.naturalHeight * escala)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', qualidade))
      }
      img.onerror = () => reject(new Error('imagem ilegível'))
      img.src = String(reader.result)
    }
    reader.onerror = () => reject(new Error('falha ao ler arquivo'))
    reader.readAsDataURL(file)
  })
}

const ETAPAS = [
  { n: 1, titulo: 'Dados pessoais', desc: 'Complete sua ficha' },
  { n: 2, titulo: 'Documentos', desc: 'Envie as digitalizações' },
  { n: 3, titulo: 'Revisão e envio', desc: 'Confirme para o RH' },
]

function Stepper({ etapa, maxEtapa, irPara, docsObrigatoriosCompletos, bloqueadaNa3 }) {
  return (
    <div className="card text-left">
      <div className="flex items-center">
        {ETAPAS.map((e, i) => {
          const concluida = e.n < etapa
          const atual = e.n === etapa
          const acessivel = e.n === 3 ? (maxEtapa >= 3 && docsObrigatoriosCompletos && !bloqueadaNa3) : e.n <= maxEtapa
            return (
              <div key={e.n} className={`flex items-center ${i < ETAPAS.length - 1 ? 'flex-1' : ''}`}>
                <button
                  type="button"
                  disabled={!acessivel || atual}
                  onClick={() => acessivel && irPara(e.n)}
                  className={`flex items-center gap-2 shrink-0 ${acessivel && !atual ? 'cursor-pointer group' : 'cursor-default'}`}
                  title={acessivel ? (atual ? 'Etapa atual' : 'Voltar para esta etapa') : 'Conclua a etapa anterior primeiro'}
                >
                <span
                  className={`size-9 shrink-0 rounded-full flex items-center justify-center text-sm font-bold transition ${
                    atual
                      ? 'bg-brand-600 text-white shadow-[0_4px_12px_rgb(39_69_228/0.35)] ring-4 ring-brand-100'
                      : concluida
                        ? 'bg-emerald-500 text-white group-hover:bg-emerald-600'
                        : 'bg-slate-100 text-slate-400 border border-slate-200'
                  }`}
                >
                  {concluida ? '✓' : e.n}
                </span>
                <span className="hidden sm:block">
                  <span className={`block text-xs font-semibold leading-tight ${atual ? 'text-brand-700' : concluida ? 'text-emerald-700' : 'text-slate-400'}`}>{e.titulo}</span>
                  <span className="block text-[10px] text-slate-400 leading-tight">{e.desc}</span>
                </span>
              </button>
              {i < ETAPAS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 rounded ${e.n < etapa ? 'bg-emerald-400' : 'bg-slate-200'}`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function CandidatoView({ db, cpf, atualizarCandidato, notificar }) {
  const [digitado, setDigitado] = useState('')
  const [erro, setErro] = useState('')
  const [erroLocal, setErroLocal] = useState('')
  const arquivoRef = useRef(null)

  // derivado ANTES dos hooks (usado no estado da etapa)
  const cpfAlvo = cpf || onlyDigits(digitado)
  const candidato = db.candidatos.find((c) => c.cpf === cpfAlvo)

  // estado do modal de upload
  const [uploadAberto, setUploadAberto] = useState(false)
  const [arquivoPendente, setArquivoPendente] = useState(null) // File
  const [tagsSelecionadas, setTagsSelecionadas] = useState([])
  // modo correção: edita tags / troca / exclui um arquivo já enviado
  const [editando, setEditando] = useState(null) // arquivo existente
  const [trocarArquivo, setTrocarArquivo] = useState(false)
  // modal de envio ao RH (consentimento LGPD)
  const [envioAberto, setEnvioAberto] = useState(false)
  const [aceiteLgpd, setAceiteLgpd] = useState(false)
  const [aceiteVeracidade, setAceiteVeracidade] = useState(false)
  const [aceiteSalarioFamilia, setAceiteSalarioFamilia] = useState(false)
  // wizard: etapa atual e maior etapa liberada (persistidas no candidato)
  const [etapa, setEtapa] = useState(() => candidato?.etapa || 1)
  const [maxEtapa, setMaxEtapa] = useState(() => candidato?.etapa || 1)

  if (!candidato) {
    return (
      <div className="card max-w-md mx-auto text-center">
        <div className="size-12 mx-auto rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center text-2xl mb-4 ring-1 ring-brand-100">🔒</div>
        <h2 className="text-xl font-bold text-slate-900">Acesso do candidato</h2>
        <p className="text-sm text-slate-500 mt-1 mb-6">Digite o seu CPF para acessar o portal e enviar sua documentação.</p>
        <input
          value={maskCPF(digitado)}
          onChange={(e) => setDigitado(e.target.value)}
          placeholder="000.000.000-00"
          inputMode="numeric"
          className="input text-center text-lg tracking-[0.2em] font-medium"
        />
        {erro && <p className="alert-error mt-3">{erro}</p>}
        <button
          onClick={() => {
            const d = onlyDigits(digitado)
            if (d.length !== 11) return setErro('Digite os 11 dígitos do CPF.')
            if (!db.candidatos.some((c) => c.cpf === d)) return setErro('CPF não encontrado. Confirme com o recrutador se o link foi enviado.')
            setErro('')
          }}
          className="btn-primary w-full mt-4"
        >
          Entrar no portal
        </button>
      </div>
    )
  }

  const statusDocs = statusDocumentos(candidato)
  const avisosCandidato = (db.notificacoes || []).filter((n) => n.para === candidato.cpf)
  const avisosNaoLidos = avisosCandidato.filter((n) => !n.lida)
  const faltantes = documentosFaltantes(candidato)
  const exigidos = docsPara(candidato)
  const arquivos = candidato.arquivos || []

  const faltantesTitular = faltantes.filter((d) => !isDocDependente(d.docId))
  const faltantesDependentes = faltantes.filter((d) => isDocDependente(d.docId))
  const docsObrigatoriosCompletos = faltantesTitular.length === 0
  const temFilhosDeclarados = !!candidato.ficha?.temFilhos && (candidato.ficha?.dependentes?.length || 0) > 0
  const temDepPendentes = temFilhosDeclarados && faltantesDependentes.length > 0

  function irPara(n) {
    if (n === 3 && (!docsObrigatoriosCompletos || arquivos.length === 0)) return
    setEtapa(n)
    setMaxEtapa((m) => Math.max(m, n))
    atualizarCandidato(candidato.id, (c) => ({ ...c, etapa: n }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const aprovados = statusDocs.filter((d) => d.status === 'aprovado').length
  const reprovados = statusDocs.filter((d) => d.status === 'reprovado').length
  const enviados = statusDocs.filter((d) => d.arquivo).length
  const progresso = exigidos.length ? Math.round((enviados / exigidos.length) * 100) : 0

  // Se o RH reprovar algum documento após o envio, o painel volta automaticamente para a etapa de documentos
  const temReprovadoPosEnvio = !!candidato.envioRH && reprovados > 0
  const etapaEfetiva = temReprovadoPosEnvio ? 2 : etapa
  const podeReenviar = temReprovadoPosEnvio

  function abrirUpload(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_MB * 1024 * 1024) return setErroLocal(`Arquivo maior que ${MAX_MB} MB.`)
    setErroLocal('')
    setArquivoPendente(file)
    setTagsSelecionadas([])
    setUploadAberto(true)
  }

  function toggleTag(id) {
    setTagsSelecionadas((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]))
  }

  function abrirCorrecao(arq) {
    setEditando(arq)
    setArquivoPendente(null)
    setTrocarArquivo(false)
    setTagsSelecionadas(arq.tags || [])
    setErroLocal('')
    setUploadAberto(true)
  }
  void abrirCorrecao // (botão removido: o retorno à etapa 2 é automático quando o RH reprova)

  function fecharModal() {
    setUploadAberto(false)
    setEditando(null)
    setTrocarArquivo(false)
    setArquivoPendente(null)
    setTagsSelecionadas([])
    setErroLocal('')
  }

  function escolherTroca(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_MB * 1024 * 1024) return setErroLocal(`Arquivo maior que ${MAX_MB} MB.`)
    setErroLocal('')
    setArquivoPendente(file)
    setTrocarArquivo(false)
  }

  function excluirArquivo() {
    const alvo = editando
    atualizarCandidato(candidato.id, (c) => ({
      ...c,
      arquivos: (c.arquivos || []).filter((a) => a.id !== alvo.id),
    }))
    excluirArquivoFB(candidato.id, alvo.id, alvo.nomeArquivo)
    fecharModal()
  }

  async function salvarEdicao() {
    if (!tagsSelecionadas.length) return setErroLocal('Selecione pelo menos uma informação que este documento comprova.')
    const alvo = editando
    const substituto = arquivoPendente // File novo, se trocado
    const aplicar = async (novoCaminho) => {
      await atualizarCandidato(candidato.id, (c) => ({
        ...c,
        arquivos: (c.arquivos || []).map((a) =>
          a.id === alvo.id
            ? {
                ...a,
                ...(substituto
                  ? { nomeArquivo: substituto.name, tipo: substituto.type, tamanho: substituto.size, caminho: novoCaminho }
                  : {}),
                tags: tagsSelecionadas,
                // volta para análise do RH (mesmo que já estivesse aprovado/reprovado)
                status: 'pendente',
                observacao: '',
                enviadoEm: new Date().toISOString(),
              }
            : a,
        ),
      }))
      fecharModal()
    }
    try {
      if (substituto) {
        const blob = (substituto.size > 1.5 * 1024 * 1024 && substituto.type.startsWith('image/'))
          ? await (async () => { const d = await comprimirImagem(substituto); return fetch(d).then((r) => r.blob()) })()
          : substituto
        const caminho = await enviarArquivoFB(candidato.id, alvo.id, blob)
        // remove a versão antiga do Storage se o nome mudou
        if (alvo.nomeArquivo !== substituto.name) excluirArquivoFB(candidato.id, alvo.id, alvo.nomeArquivo)
        await aplicar(caminho)
      } else {
        await aplicar()
      }
    } catch {
      setErroLocal('Falha ao atualizar o arquivo. Tente novamente.')
    }
  }

  async function confirmarUpload() {
    if (!tagsSelecionadas.length) return setErroLocal('Selecione pelo menos uma informação que este documento comprova.')
    const file = arquivoPendente
    const salvar = async (blob) => {
      const arqId = newId('arq')
      let caminho = null
      try {
        caminho = await enviarArquivoFB(candidato.id, arqId, blob)
      } catch {
        return setErroLocal('Falha ao enviar o arquivo. Verifique sua conexão e tente de novo.')
      }
      await atualizarCandidato(candidato.id, (c) => ({
        ...c,
        arquivos: [
          ...(c.arquivos || []),
          {
            id: arqId,
            nomeArquivo: file.name,
            tipo: file.type,
            tamanho: file.size,
            caminho, // referência no Firebase Storage (não guardamos mais dataUrl)
            tags: tagsSelecionadas,
            status: 'pendente',
            observacao: '',
            enviadoEm: new Date().toISOString(),
          },
        ],
      }))
      notificar('rh', `📥 ${candidato.nome} enviou documento(s) para análise (${tagsSelecionadas.length} exigência(s)).`)
      if (candidato.recrutador) notificar(candidato.recrutador, `📥 ${candidato.nome} enviou documento(s) ao portal.`)
      setUploadAberto(false)
      setArquivoPendente(null)
      setTagsSelecionadas([])
      setErroLocal('')
    }
    // Imagens grandes são comprimidas; o arquivo final vai direto ao Storage.
    if (file.size > 1.5 * 1024 * 1024 && file.type.startsWith('image/')) {
      const blob = await comprimirImagem(file)
      const resp = await fetch(blob)
      await salvar(await resp.blob())
    } else {
      await salvar(file)
    }
  }

  const tagsDoArquivo = (arq) => (arq.tags || []).map((id) => exigidos.find((t) => t.id === id)?.nome || id)

  const emEdicao = uploadAberto && !!editando

  // Tags disponíveis para seleção:
  // - No envio novo: somente tags que ainda não foram cobertas por outro arquivo (ou cujo arquivo foi reprovado).
  // - Na correção: tags já associadas a este arquivo + tags livres que ainda não foram marcadas em outros arquivos.
  const tagsJaMarcadasPorOutros = new Set(
    arquivos
      .filter((a) => (!editando || a.id !== editando.id) && a.status !== 'reprovado')
      .flatMap((a) => a.tags || [])
  )
  const tagsParaExibir = exigidos.filter((t) => !tagsJaMarcadasPorOutros.has(t.id) || tagsSelecionadas.includes(t.id))

  // bloco compartilhado de seleção de tags (usado no envio novo e na correção)
  function renderSelecaoTags(onConfirm, labelBotao) {
    return (
      <>
        <p className="text-xs text-brand-700 bg-brand-50 border border-brand-100 rounded-lg p-2.5 mb-4">
          💡 Um único documento pode comprovar várias informações — ex.: o RG já traz o CPF. Marque todas que se aplicarem.
        </p>
        <div className="flex flex-wrap gap-2 mb-4">
          {tagsParaExibir.length === 0 ? (
            <p className="text-xs text-slate-500 italic">Todas as informações já foram comprovadas por documentos anteriores.</p>
          ) : (
            tagsParaExibir.map((t) => {
              const sel = tagsSelecionadas.includes(t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTag(t.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${sel ? 'bg-brand-600 text-white border-brand-600 shadow-sm' : 'bg-white text-slate-600 border-slate-300 hover:border-brand-400 hover:text-brand-700'}`}
                >
                  {sel ? '✓ ' : '+ '}{t.nome}
                </button>
              )
            })
          )}
        </div>
        {tagsSelecionadas.length > 0 && (
          <p className="alert-success mb-4">
            {faltantes.filter((f) => !tagsSelecionadas.includes(f.docId)).length === 0
              ? '🎉 Com isso, sua documentação fica completa!'
              : `Com isso, ainda falta(m): ${faltantes.filter((f) => !tagsSelecionadas.includes(f.docId)).map((f) => f.nome).join(', ')}`}
          </p>
        )}
        <div className="flex gap-2 justify-end">
          <button onClick={fecharModal} className="btn-outline">Cancelar</button>
          <button onClick={onConfirm} className="btn-primary" disabled={!tagsSelecionadas.length}>
            {labelBotao}
          </button>
        </div>
      </>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Cabeçalho + progresso */}
      <section className="card text-left">
        <div className="flex items-center gap-4">
          <div className="size-12 shrink-0 rounded-2xl bg-brand-600 text-white flex items-center justify-center text-xl font-bold shadow-[0_4px_12px_rgb(39_69_228/0.35)]">
            {candidato.nome.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900 truncate">Olá, {candidato.nome.split(' ')[0]}! 👋</h2>
            <p className="text-sm text-slate-500">Suba seus documentos e marque quais informações cada um comprova. PDF, JPG ou PNG (até {MAX_MB} MB).</p>
          </div>
        </div>
        <div className="mt-5">
          <div className="flex justify-between text-xs font-medium text-slate-500 mb-1.5">
            <span>Progresso da documentação</span>
            <span>{enviados}/{exigidos.length} comprovados · {aprovados} aprovados{reprovados ? ` · ${reprovados} reprovados` : ''}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700 transition-all duration-500" style={{ width: `${progresso}%` }} />
          </div>
        </div>
      </section>

      {/* ---------- Avisos do RH para o candidato ---------- */}
      {avisosCandidato.length > 0 && (
        <section className={`card text-left border ${avisosNaoLidos.length > 0 ? 'border-brand-300 bg-brand-50/40' : 'border-slate-200'}`}>
          <div className="flex items-center justify-between gap-3 mb-2">
            <h3 className="section-title !mb-0 flex items-center gap-2">
              🔔 Avisos do RH
              {avisosNaoLidos.length > 0 && (
                <span className="badge bg-rose-50 text-rose-700 ring-1 ring-rose-200">{avisosNaoLidos.length} novo(s)</span>
              )}
            </h3>
          </div>
          <div className="space-y-1.5">
            {avisosCandidato.slice(0, 5).map((n) => (
              <div key={n.id} className={`flex items-start justify-between gap-3 rounded-lg px-3 py-2 text-sm ${n.lida ? 'bg-slate-50 text-slate-500' : 'bg-white border border-brand-100 text-slate-800 font-medium'}`}>
                <span>{n.resumo}</span>
                <span className="text-[11px] text-slate-400 shrink-0">{new Date(n.data).toLocaleString('pt-BR')}</span>
              </div>
            ))}
          </div>
          {avisosNaoLidos.length > 0 && (
            <p className="text-[11px] text-slate-400 mt-2">Os avisos são gerados automaticamente quando o RH analisa seus documentos.</p>
          )}
        </section>
      )}

      {/* ---------- Documentação enviada e em análise: sem etapas, sem edição ---------- */}
      {candidato.envioRH && !temReprovadoPosEnvio ? (
        <section className="card text-center py-10">
          <div className="size-16 mx-auto rounded-full bg-emerald-50 ring-1 ring-emerald-200 flex items-center justify-center text-3xl mb-4">📨</div>
          <h2 className="text-xl font-bold text-slate-900">Documentação enviada com sucesso!</h2>
          <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto leading-relaxed">
            Obrigado! O nosso RH está fazendo a <strong>validação dos seus dados e da documentação enviada</strong>.
            Assim que a análise for concluída, nós entraremos em contato com você. 🍀
          </p>
          <p className="text-xs text-slate-400 mt-5">
            Enviado ao RH em {new Date(candidato.envioRH.em).toLocaleString('pt-BR')}
          </p>
        </section>
      ) : (
        <>
      <Stepper etapa={etapaEfetiva} maxEtapa={maxEtapa} irPara={irPara} docsObrigatoriosCompletos={docsObrigatoriosCompletos} bloqueadaNa3={temReprovadoPosEnvio} />

      {erroLocal && etapaEfetiva === 2 && <p className="alert-error">{erroLocal}</p>}

      {/* ---------- ETAPA 1: ficha de dados pessoais ---------- */}
      {etapaEfetiva === 1 && (
        <>
          <FichaCandidato key={candidato.id} candidato={candidato} atualizarCandidato={atualizarCandidato} onSalvo={() => irPara(2)} />
          <div className="flex justify-end">
            <button
              className="btn-primary"
              disabled={!candidato.ficha?.atualizadoEm}
              title={candidato.ficha?.atualizadoEm ? '' : 'Salve a ficha para continuar'}
              onClick={() => irPara(2)}
            >
              Continuar para documentos →
            </button>
          </div>
        </>
      )}

      {/* ---------- ETAPA 2: documentos ---------- */}
      {etapaEfetiva === 2 && (
        <>
      {/* Validações — resumo compacto acima do envio */}
      <section className="text-left">
        {temReprovadoPosEnvio && (
          <div className="p-3.5 mb-3 bg-rose-50 border border-rose-300 rounded-xl text-sm text-rose-900">
            <p className="font-bold">⚠️ O RH reprovou {reprovados} documento(s). Reenvie a versão corrigida e envie novamente.</p>
            {reprovados > 0 && (
              <p className="mt-1 text-xs text-rose-800">
                Reprovados: {statusDocs.filter((d) => d.status === 'reprovado').map((d) => d.nome + (d.observacao ? ` (${d.observacao})` : '')).join(', ')}
              </p>
            )}
          </div>
        )}
        <div className="flex items-center justify-between px-1 mb-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Validação da documentação</h3>
          {faltantes.length > 0 && (
            <span className="text-xs font-medium text-amber-700">{faltantes.length} faltando</span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {statusDocs.map((d) => (
            <span
              key={d.docId}
              title={
                d.status === 'reprovado'
                  ? `Reprovado${d.observacao ? ` — Obs. do RH: ${d.observacao}` : ''} — reenvie`
                  : d.arquivo
                    ? 'Aguardando validação do RH'
                    : 'Não enviado'
              }
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                d.status === 'aprovado'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : d.status === 'reprovado'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : d.arquivo
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-slate-50 text-slate-500 border-slate-200'
              }`}
            >
              {d.status === 'aprovado' && (
                <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5 shrink-0" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.704 5.29a1 1 0 0 1 .006 1.415l-7.2 7.3a1 1 0 0 1-1.427.006L3.29 9.29a1 1 0 1 1 1.42-1.41l4.079 4.079 6.5-6.59a1 1 0 0 1 1.415-.07Z" clipRule="evenodd" />
                </svg>
              )}
              {d.status === 'reprovado' && (
                <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5 shrink-0" aria-hidden="true">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              )}
              {!d.arquivo && d.status !== 'reprovado' && (
                <span className="size-2 rounded-full border border-current shrink-0" aria-hidden="true" />
              )}
              {d.arquivo && d.status !== 'aprovado' && d.status !== 'reprovado' && (
                <span className="size-2 rounded-full bg-current/60 shrink-0 animate-pulse" aria-hidden="true" />
              )}
              {d.nome}
            </span>
          ))}
        </div>
      </section>

      {/* Botão de upload */}
      <button onClick={() => arquivoRef.current?.click()} className="w-full border-2 border-dashed border-brand-300 bg-brand-50/50 hover:bg-brand-50 rounded-2xl py-8 flex flex-col items-center gap-2 transition group cursor-pointer">
        <span className="size-12 rounded-2xl bg-brand-600 text-white flex items-center justify-center text-2xl group-hover:scale-105 transition">📤</span>
        <span className="font-semibold text-slate-900">Enviar documento</span>
        <span className="text-xs text-slate-500">Clique para escolher o arquivo e depois marque o que ele comprova</span>
      </button>
      <input ref={arquivoRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={abrirUpload} />

      {/* Modal de tags (envio novo ou correção) */}
      {emEdicao ? (
        <div className="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={fecharModal}>
          <div className="card max-w-md w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="section-title">Corrigir documento</h3>
            <p className="section-sub mb-4">
              <strong className="text-slate-700">{arquivoPendente?.name || editando.nomeArquivo}</strong>
              {!arquivoPendente && <span className="text-slate-400"> (arquivo atual)</span>}
            </p>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <button type="button" onClick={() => setTrocarArquivo(true)} className="btn-outline btn-sm">
                🔄 Trocar arquivo
              </button>
              <button type="button" onClick={excluirArquivo} className="btn-outline btn-sm !text-rose-600 !border-rose-300 hover:!bg-rose-50">
                🗑 Excluir envio
              </button>
            </div>
            {trocarArquivo && (
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={escolherTroca}
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-brand-700 file:cursor-pointer mb-4"
              />
            )}
            {renderSelecaoTags(salvarEdicao, 'Salvar correção')}
          </div>
        </div>
      ) : uploadAberto && arquivoPendente && (
        <div className="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={fecharModal}>
          <div className="card max-w-md w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="section-title">O que este documento comprova?</h3>
            <p className="section-sub mb-4">
              <strong className="text-slate-700">{arquivoPendente.name}</strong>
            </p>
            {renderSelecaoTags(confirmarUpload, 'Enviar documento')}
          </div>
        </div>
      )}

      {/* Arquivos enviados */}
      {arquivos.length > 0 && (
        <section className="card text-left">
          <h3 className="section-title mb-3">Arquivos enviados ({arquivos.length})</h3>
          <div className="space-y-2">
            {arquivos.map((a) => (
              <div key={a.id} className="card-sm flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{tagsDoArquivo(a).join(', ') || 'Documento'}</p>
                  <p className="text-xs text-slate-500 truncate">{a.status === 'aprovado' ? 'Validado pelo RH' : a.status === 'reprovado' ? 'Aguardando correção' : 'Em análise pelo RH'}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`badge ${a.status === 'aprovado' ? 'badge-ok' : a.status === 'reprovado' ? 'badge-bad' : 'badge-warn'}`}>
                    {a.status === 'aprovado' ? '✔ OK' : a.status === 'reprovado' ? '✖ Reprovado' : '⏳ Em análise'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* navegação da etapa 2 */}
          <div className="flex justify-between items-center gap-3">
            <button onClick={() => irPara(1)} className="btn-outline">← Voltar</button>
            <div className="text-right">
              <button
                onClick={() => irPara(3)}
                className="btn-primary"
                disabled={!docsObrigatoriosCompletos || arquivos.length === 0}
                title={
                  !docsObrigatoriosCompletos
                    ? `Anexe todos os documentos obrigatórios para continuar (falta: ${faltantesTitular.map((f) => f.nome).join(', ')})`
                    : ''
                }
              >
                Revisar e enviar →
              </button>
              {!docsObrigatoriosCompletos && (
                <p className="text-[11px] text-amber-700 mt-1">
                  Falta anexar: {faltantesTitular.map((f) => f.nome).join(', ')}
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {/* ---------- ETAPA 3: revisão e envio ao RH ---------- */}
      {etapaEfetiva === 3 && (
        <>
      {/* Rodapé */}
      <section className="card">
        {candidato.envioRH ? (
          <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-left">
            <p className="font-bold text-emerald-900 text-sm">✅ Documentação enviada com sucesso!</p>
            <p className="text-emerald-800 text-sm mt-1">
              Aguarde a análise do RH — nós entraremos em contato!
            </p>
          </div>
        ) : faltantes.length === 0 ? (
          <p className="alert-success">✅ Toda a documentação está completa e pronta para envio ao RH!</p>
        ) : docsObrigatoriosCompletos && temDepPendentes ? (
          <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-left space-y-1.5 text-xs text-amber-900">
            <p className="font-bold text-amber-950 text-sm">Documentação principal completa!</p>
            <p>
              Você já pode enviar sua admissão. Documentos de dependentes pendentes ({faltantesDependentes.map((f) => f.nome).join(', ')}) não impedem o seu registro de admissão.
            </p>
            <p className="font-medium text-amber-950">
              ⚠️ Ao enviar sem anexar os documentos dos filhos, você será registrado sem o benefício do Salário-Família dos respectivos dependentes até a entrega dos documentos.
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-600 text-left">
            Ainda falta(m) <strong>{faltantes.length}</strong> documento(s) obrigatório(s): {faltantes.map((f) => f.nome).join(', ')}.
          </p>
        )}
        {temReprovadoPosEnvio && (
          <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-left text-sm text-rose-900">
            <p className="font-bold">⚠️ A análise do RH apontou pendências na sua documentação.</p>
            <p className="mt-1">
              Corrija os documentos marcados como <strong>reprovados</strong> na etapa de documentos e reenvie. Veja a observação do RH ao tocar em cada item.
            </p>
          </div>
        )}
        <button
          onClick={() => {
            setAceiteLgpd(false)
            setAceiteVeracidade(false)
            setAceiteSalarioFamilia(false)
            setEnvioAberto(true)
          }}
          className="btn-primary mt-3"
          disabled={(!!candidato.envioRH && !podeReenviar) || !docsObrigatoriosCompletos || arquivos.length === 0 || !candidato.ficha?.atualizadoEm}
          title={
            candidato.envioRH && !podeReenviar
              ? 'Documentação já enviada ao RH — aguarde a análise.'
              : !docsObrigatoriosCompletos
                ? `Anexe todos os documentos obrigatórios antes de enviar (falta: ${faltantesTitular.map((f) => f.nome).join(', ')})`
                : ''
            }
        >
          {candidato.envioRH && podeReenviar ? '📤 Reenviar documentação ao RH' : candidato.envioRH ? '✔ Documentação já enviada' : '📤 Enviar documentação ao RH'}
        </button>
        {!candidato.ficha?.atualizadoEm && (
          <p className="text-xs text-amber-700 mt-2">Preencha e salve sua ficha de dados pessoais antes de enviar ao RH.</p>
        )}
        {candidato.envioRH && (
          <p className="text-xs text-slate-500 mt-2">
            Último envio ao RH: {new Date(candidato.envioRH.em).toLocaleString('pt-BR')}
          </p>
        )}
          <div className="flex justify-start mt-4 pt-4 border-t border-slate-100">
            <button onClick={() => irPara(2)} className="btn-outline btn-sm">← Corrigir documentos</button>
          </div>
      </section>
        </>
      )}

      {/* Modal de envio ao RH — consentimento LGPD e ciência sobre dependentes */}
      {envioAberto && (
        <div className="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEnvioAberto(false)}>
          <div className="card max-w-md w-full max-h-[85vh] overflow-y-auto text-left" onClick={(e) => e.stopPropagation()}>
            <h3 className="section-title mb-2">Enviar documentação ao RH</h3>
            <p className="text-sm text-slate-600 mb-4">
              Ao enviar, os documentos anexados e seus dados cadastrais serão encaminhados ao setor de Recursos Humanos para análise e admissão.
            </p>

            {temDepPendentes && (
              <div className="text-xs text-amber-900 bg-amber-50 border border-amber-300 rounded-xl p-3.5 mb-4 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-base leading-none">⚠️</span>
                  <div>
                    <p className="font-bold text-amber-950">Atenção: Documentos de dependentes pendentes</p>
                    <p className="mt-1 leading-relaxed">
                      Você declarou dependente(s), mas <strong>não anexou toda a documentação comprobatória</strong> dos filhos ({faltantesDependentes.map((f) => f.nome).join(', ')}).
                    </p>
                    <p className="mt-1.5 leading-relaxed font-medium text-amber-950">
                      Os documentos de dependentes <strong>não impedem seu registro</strong> de admissão. No entanto, ao enviar sem esses documentos, você será registrado(a) <strong>sem o benefício do Salário-Família</strong> referente aos filhos sem comprovação até que a documentação seja entregue.
                    </p>
                  </div>
                </div>
                <label className="flex items-start gap-2 pt-2 border-t border-amber-200/80 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-amber-600"
                    checked={aceiteSalarioFamilia}
                    onChange={(e) => setAceiteSalarioFamilia(e.target.checked)}
                  />
                  <span className="font-semibold text-amber-950 text-[11px] leading-tight">
                    Estou ciente de que serei registrado(a) sem o Salário-Família dos dependentes que estão sem documentação.
                  </span>
                </label>
              </div>
            )}

            <div className="text-xs text-slate-700 bg-brand-50 border border-brand-100 rounded-lg p-3 mb-4">
              <p className="font-semibold text-brand-700 mb-1">Aviso de privacidade (LGPD — Lei nº 13.709/2018)</p>
              <p>
                Seus dados pessoais e documentos serão utilizados exclusivamente para fins de registro do vínculo
                trabalhista, incluindo admissão, eSocial, <strong>FGTS</strong>, <strong>INSS</strong> e demais
                situações trabalhistas previstas em lei. O tratamento é feito com sigilo, com acesso restrito ao RH,
                e os dados serão armazenados pelo prazo legal necessário.
              </p>
            </div>
            <label className="flex items-start gap-2 mb-3 cursor-pointer">
              <input type="checkbox" className="mt-0.5 size-4" checked={aceiteLgpd} onChange={(e) => setAceiteLgpd(e.target.checked)} />
              <span className="text-sm text-slate-700">
                Declaro que li e <strong>aceito o tratamento dos meus dados pessoais</strong> conforme o aviso de privacidade acima, para as finalidades descritas.
              </span>
            </label>
            <label className="flex items-start gap-2 mb-4 cursor-pointer">
              <input type="checkbox" className="mt-0.5 size-4" checked={aceiteVeracidade} onChange={(e) => setAceiteVeracidade(e.target.checked)} />
              <span className="text-sm text-slate-700">
                Confirmo que <strong>todos os dados e documentos prestados são verdadeiros</strong> e assumo total responsabilidade pela veracidade das informações.
              </span>
            </label>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEnvioAberto(false)} className="btn-outline">Cancelar</button>
              <button
                className="btn-primary"
                disabled={!aceiteLgpd || !aceiteVeracidade || (temDepPendentes && !aceiteSalarioFamilia)}
                onClick={() => {
                  atualizarCandidato(candidato.id, (c) => ({
                    ...c,
                    envioRH: {
                      em: new Date().toISOString(),
                      aceiteLgpd: true,
                      aceiteVeracidade: true,
                      aceiteSalarioFamilia: temDepPendentes ? true : undefined,
                    },
                  }))
                  notificar('rh', `📤 ${candidato.nome} enviou a documentação completa ao RH para validação.`)
                  if (candidato.recrutador) notificar(candidato.recrutador, `📤 ${candidato.nome} finalizou o envio da documentação ao RH.`)
                  setEnvioAberto(false)
                }}
              >
                Confirmar envio
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  )
}
