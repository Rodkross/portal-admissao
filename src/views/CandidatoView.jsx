import { useRef, useState } from 'react'
import { docsPara, maskCPF, onlyDigits, statusDocumentos, documentosFaltantes, newId } from '../lib/storage'

const MAX_MB = 5

export default function CandidatoView({ db, cpf, atualizarCandidato }) {
  const [digitado, setDigitado] = useState('')
  const [erro, setErro] = useState('')
  const [erroLocal, setErroLocal] = useState('')
  const arquivoRef = useRef(null)

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

  const cpfAlvo = cpf || onlyDigits(digitado)
  const candidato = db.candidatos.find((c) => c.cpf === cpfAlvo)

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
  const faltantes = documentosFaltantes(candidato)
  const exigidos = docsPara(candidato)
  const arquivos = candidato.arquivos || []

  const aprovados = statusDocs.filter((d) => d.status === 'aprovado').length
  const reprovados = statusDocs.filter((d) => d.status === 'reprovado').length
  const enviados = statusDocs.filter((d) => d.arquivo).length
  const progresso = exigidos.length ? Math.round((enviados / exigidos.length) * 100) : 0

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
    fecharModal()
  }

  function salvarEdicao() {
    if (!tagsSelecionadas.length) return setErroLocal('Selecione pelo menos uma informação que este documento comprova.')
    const alvo = editando
    const substituto = arquivoPendente // File novo, se trocado
    const aplicar = (dataUrl) => {
      atualizarCandidato(candidato.id, (c) => ({
        ...c,
        arquivos: (c.arquivos || []).map((a) =>
          a.id === alvo.id
            ? {
                ...a,
                ...(substituto
                  ? { nomeArquivo: substituto.name, tipo: substituto.type, tamanho: substituto.size, dataUrl }
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
    if (substituto && substituto.size > 1.5 * 1024 * 1024) {
      aplicar(null) // arquivos grandes: só metadados (demo com localStorage)
    } else if (substituto) {
      const reader = new FileReader()
      reader.onload = () => aplicar(String(reader.result))
      reader.readAsDataURL(substituto)
    } else {
      aplicar()
    }
  }

  function confirmarUpload() {
    if (!tagsSelecionadas.length) return setErroLocal('Selecione pelo menos uma informação que este documento comprova.')
    const file = arquivoPendente
    const salvar = (dataUrl) => {
      atualizarCandidato(candidato.id, (c) => ({
        ...c,
        arquivos: [
          ...(c.arquivos || []),
          {
            id: newId('arq'),
            nomeArquivo: file.name,
            tipo: file.type,
            tamanho: file.size,
            dataUrl,
            tags: tagsSelecionadas,
            status: 'pendente',
            observacao: '',
            enviadoEm: new Date().toISOString(),
          },
        ],
      }))
      setUploadAberto(false)
      setArquivoPendente(null)
      setTagsSelecionadas([])
      setErroLocal('')
    }
    if (file.size > 1.5 * 1024 * 1024) {
      salvar(null) // arquivos grandes: só metadados (demo com localStorage)
    } else {
      const reader = new FileReader()
      reader.onload = () => salvar(String(reader.result))
      reader.readAsDataURL(file)
    }
  }

  const tagsDoArquivo = (arq) => (arq.tags || []).map((id) => exigidos.find((t) => t.id === id)?.nome || id)

  const emEdicao = uploadAberto && !!editando

  // bloco compartilhado de seleção de tags (usado no envio novo e na correção)
  function renderSelecaoTags(onConfirm, labelBotao) {
    return (
      <>
        <p className="text-xs text-brand-700 bg-brand-50 border border-brand-100 rounded-lg p-2.5 mb-4">
          💡 Um único documento pode comprovar várias informações — ex.: o RG já traz o CPF. Marque todas que se aplicarem.
        </p>
        <div className="flex flex-wrap gap-2 mb-4">
          {exigidos.map((t) => {
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
          })}
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

      {erroLocal && <p className="alert-error">{erroLocal}</p>}

      {/* Validações — resumo compacto acima do envio */}
      <section className="text-left">
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
                  <p className="text-sm font-medium text-slate-800 truncate">{a.nomeArquivo}</p>
                  <p className="text-xs text-slate-500 truncate">Comprova: {tagsDoArquivo(a).join(', ')}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`badge ${a.status === 'aprovado' ? 'badge-ok' : a.status === 'reprovado' ? 'badge-bad' : 'badge-warn'}`}>
                    {a.status === 'aprovado' ? '✔ OK' : a.status === 'reprovado' ? '✖ Reprovado' : '⏳ Em análise'}
                  </span>
                  <button
                    type="button"
                    onClick={() => abrirCorrecao(a)}
                    title="Editar tags, trocar arquivo ou excluir"
                    className="text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline cursor-pointer"
                  >
                    Corrigir
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Rodapé */}
      <section className="card">
        {faltantes.length === 0 ? (
          <p className="alert-success">✅ Documentação completa! O RH irá validar em breve.</p>
        ) : (
          <p className="text-sm text-slate-600">
            Ainda falta(m) <strong>{faltantes.length}</strong> informação(ões): {faltantes.map((f) => f.nome).join(', ')}.
            <br />
            Dica: um documento que já contenha essa informação pode cobrir mais de um item de uma vez.
          </p>
        )}
        <button
          onClick={() => { setAceiteLgpd(false); setAceiteVeracidade(false); setEnvioAberto(true) }}
          className="btn-primary mt-3"
          disabled={arquivos.length === 0}
        >
          📤 Enviar documentação ao RH
        </button>
        {candidato.envioRH && (
          <p className="text-xs text-slate-500 mt-2">
            Último envio ao RH: {new Date(candidato.envioRH.em).toLocaleString('pt-BR')}
          </p>
        )}
      </section>

      {/* Modal de envio ao RH — consentimento LGPD */}
      {envioAberto && (
        <div className="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEnvioAberto(false)}>
          <div className="card max-w-md w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="section-title mb-2">Enviar documentação ao RH</h3>
            <p className="text-sm text-slate-600 mb-4">
              Ao enviar, os documentos anexados e seus dados cadastrais serão encaminhados ao setor de Recursos Humanos para análise.
            </p>
            <div className="text-sm text-slate-700 bg-brand-50 border border-brand-100 rounded-lg p-3 mb-4">
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
                disabled={!aceiteLgpd || !aceiteVeracidade}
                onClick={() => {
                  atualizarCandidato(candidato.id, (c) => ({
                    ...c,
                    envioRH: { em: new Date().toISOString(), aceiteLgpd: true, aceiteVeracidade: true },
                  }))
                  setEnvioAberto(false)
                }}
              >
                Confirmar envio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
