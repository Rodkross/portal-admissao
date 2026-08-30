import { useState } from 'react'
import { maskCPF, maskPhone, waLink, statusDocumentos, documentosFaltantes, docsPara } from '../lib/storage'
import { gerarFichaPDF } from '../lib/ficha'

function ArquivoPreview({ arquivo }) {
  const [mostrar, setMostrar] = useState(false)
  if (!arquivo) return null
  return (
    <div className="mt-2">
      {arquivo.dataUrl ? (
        <>
          <button onClick={() => setMostrar(!mostrar)} className="text-xs text-brand-600 font-medium hover:underline">
            {mostrar ? 'Ocultar pré-visualização' : '👁 Visualizar documento'}
          </button>
          {mostrar && (
            <div className="mt-2 border rounded-lg overflow-hidden max-h-72">
              {arquivo.tipo === 'application/pdf' ? (
                <iframe src={arquivo.dataUrl} title="Documento" className="w-full h-72" />
              ) : (
                <img src={arquivo.dataUrl} alt="Documento" className="max-h-72 object-contain" />
              )}
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
  const [obsAberta, setObsAberta] = useState(null) // { candidatoId, arquivoId }
  const [obsTexto, setObsTexto] = useState('')

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
      <section className="card">
        <h2 className="section-title mb-4">Validação de documentação</h2>
        {db.candidatos.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum candidato cadastrado.</p>
        ) : (
          <div className="space-y-2 text-left">
            {db.candidatos.map((c) => {
              const status = statusDocumentos(c)
              const aprovs = status.filter((d) => d.status === 'aprovado').length
              const reprovs = status.filter((d) => d.status === 'reprovado').length
              const faltam = status.filter((d) => !d.arquivo || d.status === 'reprovado').length
              return (
                <button
                  key={c.id}
                  onClick={() => setSelecionado(c.id)}
                  className={`w-full border rounded-xl p-3.5 flex justify-between items-center text-left transition ${selecionado === c.id ? 'border-brand-500 bg-brand-50/60 ring-1 ring-brand-200' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
                >
                  <span className="font-medium text-slate-800">{c.nome}</span>
                  <span className="text-xs text-slate-500">
                    <span className="text-emerald-700">✔{aprovs}</span> · <span className="text-amber-600">⏳{faltam}</span>{' '}
                    {reprovs > 0 && <span className="text-rose-600">· ✖{reprovs}</span>}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </section>

      {cand && (
        <section className="card text-left">
          <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">{cand.nome}</h3>
              <p className="text-sm text-slate-500">CPF {maskCPF(cand.cpf)} · {maskPhone(cand.telefone)} · {cand.sexo === 'M' ? 'Masculino' : 'Feminino'}{cand.motociclista ? ' · Motociclista' : ''}</p>
            </div>
            <div className="flex gap-2">
              <a href={waLink(cand.telefone, msgExigencias(cand))} target="_blank" rel="noreferrer" className="btn-wa btn-sm">
                📲 Disparar exigências no WhatsApp
              </a>
              <button onClick={() => gerarFichaPDF(cand)} className="btn-outline btn-sm">
                ⬇ Emitir ficha (PDF)
              </button>
            </div>
          </div>

          {/* Validação por ARQUIVO enviado (um arquivo pode cobrir vários docs) */}
          <h3 className="section-title px-1 mb-2">Arquivos enviados ({(cand.arquivos || []).length})</h3>
          <div className="space-y-3 mb-6">
            {(cand.arquivos || []).length === 0 && <p className="text-sm text-slate-400">Nenhum arquivo enviado ainda.</p>}
            {[...(cand.arquivos || [])].reverse().map((a) => {
              const nomesTags = (a.tags || []).map((id) => docsPara(cand).find((t) => t.id === id)?.nome || id)
              return (
                <div key={a.id} className="card-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{a.nomeArquivo}</p>
                      <p className="text-xs text-slate-500">
                        Comprova: {nomesTags.join(', ')} · enviado em {new Date(a.enviadoEm).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <span className={`badge ${a.status === 'aprovado' ? 'badge-ok' : a.status === 'reprovado' ? 'badge-bad' : 'badge-warn'}`}>
                      {a.status.toUpperCase()}
                    </span>
                  </div>

                  <ArquivoPreview arquivo={a} />

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
          <div className="grid sm:grid-cols-2 gap-2">
            {statusDocumentos(cand).map((d) => (
              <div key={d.docId} className="flex items-center justify-between gap-2 border border-slate-200 rounded-lg px-3 py-2 text-left bg-slate-50/50">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{d.nome}</p>
                  {d.arquivo && <p className="text-[11px] text-slate-400 truncate">via {d.preenchidoPor}</p>}
                </div>
                <span className={`badge ${d.arquivo ? (d.status === 'aprovado' ? 'badge-ok' : d.status === 'reprovado' ? 'badge-bad' : 'badge-warn') : 'badge-neutral'}`}>
                  {d.arquivo ? (d.status === 'aprovado' ? '✔ OK' : d.status === 'reprovado' ? '✖ Reprov.' : '⏳ Análise') : 'Falta'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
