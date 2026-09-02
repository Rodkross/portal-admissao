import { useState } from 'react'
import { onlyDigits, maskCEP, maskCPF, maskPhone, statusDocumentos, calcularIdade, newId, isMotociclista } from '../lib/storage'

const ESCOLARIDADES = [
  'Fundamental incompleto', 'Fundamental completo', 'Médio incompleto', 'Médio completo',
  'Técnico incompleto', 'Técnico completo', 'Superior incompleto', 'Superior completo', 'Pós-graduação',
]
const ESTADOS_CIVIS = ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União estável']
const CNH_CATEGORIAS = ['A', 'B', 'AB', 'ACC']

const FICHA_VAZIA = {
  dataNascimento: '', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '',
  telefone: '', estadoCivil: '', ctpsTipo: '', ctpsNumero: '', ctpsSerie: '', rg: '', rgOrgao: '',
  tituloEleitor: '', pis: '', primeiroEmprego: false, chavePix: '', banco: '',
  cnhNumero: '', cnhCategoria: '', escolaridade: '',
  temFilhos: false,
  numFilhos: 0,
  dependentes: [],
}



export default function FichaCandidato({ candidato, atualizarCandidato, onSalvo }) {
  const [form, setForm] = useState(() => {
    const f = candidato.ficha || {}
    const deps = Array.isArray(f.dependentes) ? f.dependentes : []
    return {
      ...FICHA_VAZIA,
      nome: candidato.nome || '',
      telefone: f.telefone || candidato.telefone || '',
      ...f,
      temFilhos: f.temFilhos ?? (deps.length > 0),
      numFilhos: f.numFilhos ?? (deps.length || 0),
      dependentes: deps,
    }
  })
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [erroCep, setErroCep] = useState('')
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState('')

  const motociclista = isMotociclista(candidato)
  const homem = candidato.sexo === 'M'
  const status = statusDocumentos(candidato)
  const statusDe = (docId) => status.find((s) => s.docId === docId)

  function set(campo, valor) {
    setSalvo(false)
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  function handleTemFilhosChange(tem) {
    setSalvo(false)
    if (!tem) {
      setForm((f) => ({ ...f, temFilhos: false, numFilhos: 0, dependentes: [] }))
    } else {
      setForm((f) => {
        const deps = f.dependentes && f.dependentes.length > 0 ? f.dependentes : [{ id: newId('dep'), nome: '', dataNascimento: '' }]
        return { ...f, temFilhos: true, numFilhos: deps.length, dependentes: deps }
      })
    }
  }

  function handleNumFilhosChange(qtd) {
    setSalvo(false)
    const n = Math.max(1, Math.min(20, parseInt(qtd, 10) || 1))
    setForm((f) => {
      const atuais = [...(f.dependentes || [])]
      while (atuais.length < n) {
        atuais.push({ id: newId('dep'), nome: '', dataNascimento: '' })
      }
      return { ...f, numFilhos: n, dependentes: atuais.slice(0, n) }
    })
  }

  function adicionarFilho() {
    setSalvo(false)
    setForm((f) => {
      const novos = [...(f.dependentes || []), { id: newId('dep'), nome: '', dataNascimento: '' }]
      return { ...f, temFilhos: true, numFilhos: novos.length, dependentes: novos }
    })
  }

  function removerFilho(index) {
    setSalvo(false)
    setForm((f) => {
      const novos = (f.dependentes || []).filter((_, i) => i !== index)
      return {
        ...f,
        temFilhos: novos.length > 0,
        numFilhos: novos.length,
        dependentes: novos,
      }
    })
  }

  function atualizarFilho(index, campo, valor) {
    setSalvo(false)
    setForm((f) => {
      const novos = [...(f.dependentes || [])]
      novos[index] = { ...novos[index], [campo]: valor }
      return { ...f, dependentes: novos }
    })
  }

  async function buscarCep() {
    const cep = onlyDigits(form.cep)
    setErroCep('')
    if (cep.length !== 8) return setErroCep('CEP deve ter 8 dígitos.')
    setBuscandoCep(true)
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const j = await r.json()
      if (j.erro) throw new Error('erro')
      setForm((f) => ({ ...f, logradouro: j.logradouro || f.logradouro, bairro: j.bairro || f.bairro, cidade: j.localidade || f.cidade, uf: j.uf || f.uf }))
    } catch {
      setErroCep('CEP não encontrado — preencha o endereço manualmente.')
    } finally {
      setBuscandoCep(false)
    }
  }

  function salvar(e) {
    e.preventDefault()
    const f = form
    if (!f.nome?.trim()) return setErro('Informe o nome completo.')
    if (!f.dataNascimento) return setErro('Informe a data de nascimento.')
    if (onlyDigits(f.cep).length !== 8) return setErro('Informe um CEP válido.')
    if (!f.logradouro.trim() || !f.numero.trim() || !f.bairro.trim() || !f.cidade.trim() || !f.uf.trim()) return setErro('Complete o endereço (rua, número, bairro, cidade e UF).')
    if (onlyDigits(f.telefone).length < 10) return setErro('Telefone (WhatsApp) inválido.')
    if (!f.estadoCivil) return setErro('Selecione o estado civil.')
    if (!f.rg.trim()) return setErro('Informe o RG.')
    if (!f.tituloEleitor.trim()) return setErro('Informe o título de eleitor.')
    if (!f.ctpsTipo) return setErro('Selecione o tipo de CTPS (física ou digital).')
    if (f.ctpsTipo !== 'digital' && !f.ctpsNumero.trim()) return setErro('Informe o número da CTPS.')
    if (!f.primeiroEmprego && !f.pis.trim()) return setErro('Informe o PIS ou marque "primeiro emprego".')
    if (!f.escolaridade) return setErro('Selecione a escolaridade.')
    if (f.temFilhos) {
      if (!f.dependentes || f.dependentes.length === 0) {
        return setErro('Informe os dados dos filhos/dependentes.')
      }
      for (let i = 0; i < f.dependentes.length; i++) {
        const dep = f.dependentes[i]
        if (!dep.nome?.trim()) {
          return setErro(`Informe o nome completo do filho(a) ${i + 1}.`)
        }
        if (!dep.dataNascimento) {
          return setErro(`Informe a data de nascimento do filho(a) ${i + 1} (${dep.nome.trim()}).`)
        }
      }
    }
    if (motociclista && !f.cnhNumero.trim()) return setErro('Informe o número da CNH (motociclista).')
    if (motociclista && !f.cnhCategoria) return setErro('Informe a categoria da CNH.')
    setErro('')
    const up = (s) => (s || '').trim().toUpperCase()
    atualizarCandidato(candidato.id, (c) => ({
      ...c,
      nome: up(f.nome),
      telefone: onlyDigits(f.telefone),
      ficha: {
        ...f,
        nome: up(f.nome),
        logradouro: up(f.logradouro),
        numero: up(f.numero),
        complemento: up(f.complemento),
        bairro: up(f.bairro),
        cidade: up(f.cidade),
        rg: up(f.rg),
        rgOrgao: up(f.rgOrgao),
        ctpsNumero: up(f.ctpsNumero),
        ctpsSerie: up(f.ctpsSerie),
        tituloEleitor: up(f.tituloEleitor),
        pis: up(f.pis),
        chavePix: up(f.chavePix),
        banco: up(f.banco),
        cnhNumero: up(f.cnhNumero),
        reservista: up(f.reservista),
        dependentes: f.temFilhos
          ? f.dependentes.map((d) => ({ ...d, nome: up(d.nome) }))
          : [],
        atualizadoEm: new Date().toISOString(),
      },
    }))
    setSalvo(true)
    onSalvo?.()
  }

  return (
    <form onSubmit={salvar} className="card text-left space-y-4">
      {/* Destaque: função pretendida + recrutador responsável (empresa é restrita ao RH) */}
      <div className="rounded-xl border border-brand-200 bg-gradient-to-r from-brand-50 to-white p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-500">Função / Vaga</p>
          <p className="text-lg font-bold text-brand-700 truncate">
            {candidato.contrato?.funcao || candidato.funcao || 'A definir'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Recrutador responsável</p>
          <p className="text-sm font-semibold text-slate-800">👤 {candidato.recrutador || '—'}</p>
        </div>
      </div>
      <div>
        <h3 className="section-title">Dados pessoais</h3>
        <p className="section-sub">Complete sua ficha de admissão. Campos com <strong>*</strong> exigem também a digitalização do documento (aba de documentos).</p>
      </div>
      {erro && <p className="alert-error">{erro}</p>}
      {salvo && <p className="alert-success">✅ Ficha salva com sucesso.</p>}

      <div className="grid sm:grid-cols-2 gap-4 text-sm">
        <label className="sm:col-span-2">
          <span className="text-slate-600">Nome completo *</span>
          <input value={form.nome || ''} onChange={(e) => set('nome', e.target.value)} className="input" placeholder="Nome conforme documento" />
        </label>
        <label>
          <span className="text-slate-600">Data de nascimento *</span>
          <input type="date" value={form.dataNascimento} onChange={(e) => set('dataNascimento', e.target.value)} className="input" />
        </label>
        <label>
          <span className="text-slate-600">CPF</span>
          <input value={maskCPF(candidato.cpf)} readOnly disabled className="input bg-slate-100 text-slate-500" title="CPF informado pelo recrutador — é sua chave de acesso" />
        </label>
        <label>
          <span className="text-slate-600">CEP *</span>
          <div className="flex gap-2">
            <input value={maskCEP(form.cep)} onChange={(e) => set('cep', e.target.value)} onBlur={buscarCep} className="input" placeholder="00000-000" inputMode="numeric" />
            <button type="button" onClick={buscarCep} disabled={buscandoCep} className="btn-outline shrink-0">{buscandoCep ? '...' : '🔍'}</button>
          </div>
          {erroCep && <span className="text-xs text-amber-700">{erroCep}</span>}
        </label>
        <label>
          <span className="text-slate-600">Telefone (WhatsApp) *</span>
          <input value={maskPhone(form.telefone)} onChange={(e) => set('telefone', e.target.value)} className="input" placeholder="(11) 99999-9999" inputMode="tel" />
        </label>
        <label className="sm:col-span-2">
          <span className="text-slate-600">Logradouro *</span>
          <input value={form.logradouro} onChange={(e) => set('logradouro', e.target.value)} className="input" placeholder="Rua, avenida..." />
        </label>
        <label>
          <span className="text-slate-600">Número *</span>
          <input value={form.numero} onChange={(e) => set('numero', e.target.value)} className="input" />
        </label>
        <label>
          <span className="text-slate-600">Complemento</span>
          <input value={form.complemento} onChange={(e) => set('complemento', e.target.value)} className="input" />
        </label>
        <label>
          <span className="text-slate-600">Bairro *</span>
          <input value={form.bairro} onChange={(e) => set('bairro', e.target.value)} className="input" />
        </label>
        <label>
          <span className="text-slate-600">Cidade / UF *</span>
          <div className="flex gap-2">
            <input value={form.cidade} onChange={(e) => set('cidade', e.target.value)} className="input" />
            <input value={form.uf} onChange={(e) => set('uf', e.target.value.toUpperCase().slice(0, 2))} className="input w-20" placeholder="UF" />
          </div>
        </label>
        <label>
          <span className="text-slate-600">Estado civil *</span>
          <select value={form.estadoCivil} onChange={(e) => set('estadoCivil', e.target.value)} className="input">
            <option value="">Selecione...</option>
            {ESTADOS_CIVIS.map((ec) => <option key={ec} value={ec}>{ec}</option>)}
          </select>
        </label>
        <label>
          <span className="text-slate-600">Escolaridade *</span>
          <select value={form.escolaridade} onChange={(e) => set('escolaridade', e.target.value)} className="input">
            <option value="">Selecione...</option>
            {ESCOLARIDADES.map((esc) => <option key={esc} value={esc}>{esc}</option>)}
          </select>
        </label>
      </div>

      {/* Seção de Dependentes / Filhos */}
      <div className="border-t border-slate-100 pt-4 space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-800">Dependentes e Filhos</h4>
          <p className="text-xs text-slate-500">Informe se possui filhos para apuração do salário-família e documentação exigida.</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <label>
            <span className="text-slate-600">Possui filhos / dependentes? *</span>
            <select
              value={form.temFilhos ? 'sim' : 'nao'}
              onChange={(e) => handleTemFilhosChange(e.target.value === 'sim')}
              className="input"
            >
              <option value="nao">Não</option>
              <option value="sim">Sim</option>
            </select>
          </label>

          {form.temFilhos && (
            <label>
              <span className="text-slate-600">Quantidade de filhos *</span>
              <input
                type="number"
                min="1"
                max="20"
                value={form.numFilhos || (form.dependentes?.length || 1)}
                onChange={(e) => handleNumFilhosChange(e.target.value)}
                className="input"
              />
            </label>
          )}
        </div>

        {form.temFilhos && form.dependentes?.length > 0 && (
          <div className="space-y-3 pt-2">
            {form.dependentes.map((dep, idx) => {
              const idade = calcularIdade(dep.dataNascimento)
              return (
                <div key={dep.id || idx} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-slate-700">
                      Filho(a) {idx + 1} {dep.nome ? `— ${dep.nome}` : ''}
                    </span>
                    {form.dependentes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removerFilho(idx)}
                        className="text-xs text-rose-600 hover:text-rose-700 font-medium cursor-pointer"
                      >
                        ✕ Remover
                      </button>
                    )}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 text-sm">
                    <label>
                      <span className="text-slate-600">Nome completo do filho(a) *</span>
                      <input
                        value={dep.nome || ''}
                        onChange={(e) => atualizarFilho(idx, 'nome', e.target.value)}
                        className="input bg-white"
                        placeholder="Nome conforme documento"
                      />
                    </label>
                    <label>
                      <span className="text-slate-600">Data de nascimento *</span>
                      <input
                        type="date"
                        value={dep.dataNascimento || ''}
                        onChange={(e) => atualizarFilho(idx, 'dataNascimento', e.target.value)}
                        className="input bg-white"
                      />
                    </label>
                  </div>

                  {dep.dataNascimento && idade !== null && (
                    <div className="text-xs p-2.5 rounded-lg border bg-white flex items-start gap-2 text-slate-700">
                      <span className="text-base leading-none">{idade <= 6 ? '👶' : idade < 14 ? '🧒' : '🧑'}</span>
                      <div>
                        <p className="font-semibold text-slate-800">
                          Idade: {idade} {idade === 1 ? 'ano' : 'anos'}
                        </p>
                        <p className="text-slate-600 mt-0.5">
                          {idade <= 6 ? (
                            <>
                              <strong>Documentos exigidos na etapa seguinte:</strong> Certidão de Nascimento ou RG, CPF e Carteira de Vacinação (folha do nome e das vacinas).
                            </>
                          ) : idade < 14 ? (
                            <>
                              <strong>Documentos exigidos na etapa seguinte:</strong> Certidão ou RG, CPF e Declaração de Escolaridade (frequência escolar).
                            </>
                          ) : (
                            <>
                              <strong>Acima de 14 anos:</strong> Não é obrigatório o envio de comprovantes de dependente para admissão.
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            <div className="pt-1">
              <button
                type="button"
                onClick={adicionarFilho}
                className="btn-outline btn-sm"
              >
                + Adicionar outro filho
              </button>
            </div>
          </div>
        )}
      </div>

      <DocumentosSection form={form} set={set} motociclista={motociclista} homem={homem} statusDe={statusDe} />

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
        <p className="text-xs text-slate-400">{candidato.ficha?.atualizadoEm ? `Última atualização: ${new Date(candidato.ficha.atualizadoEm).toLocaleString('pt-BR')}` : 'Ficha ainda não enviada.'}</p>
        <button className="btn-primary">Salvar ficha</button>
      </div>
    </form>
  )
}

const badgeDoc = (statusDe, docId) => {
  const s = statusDe(docId)
  if (!s) return null
  const map = {
    aprovado: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: '✔ Documento aprovado' },
    reprovado: { cls: 'bg-rose-50 text-rose-700 border-rose-200', label: '✖ Documento reprovado — reenvie' },
    pendente: { cls: 'bg-amber-50 text-amber-700 border-amber-200', label: s.arquivo ? '⏳ Digitalização enviada' : null },
  }
  const m = map[s.status] || map.pendente
  if (!m.label) return { cls: 'bg-slate-50 text-slate-500 border-slate-200', label: '⚠ Digitalização pendente' }
  return m
}

function BadgeDoc({ statusDe, docId }) {
  const m = badgeDoc(statusDe, docId)
  if (!m) return null
  return <span className={`inline-block ml-2 rounded-full border px-2 py-0.5 text-[10px] font-medium ${m.cls}`}>{m.label}</span>
}

function DocumentosSection({ form, set, motociclista, homem, statusDe }) {
  const label = (txt, docId, obrigatorio = true) => (
    <span className="text-slate-600">
      {txt}{obrigatorio && ' *'}<BadgeDoc statusDe={statusDe} docId={docId} />
    </span>
  )
  return (
    <div className="grid sm:grid-cols-2 gap-4 text-sm border-t border-slate-100 pt-4">
      <label>
        {label('RG', 'rg')}
        <input value={form.rg} onChange={(e) => set('rg', e.target.value)} className="input" />
      </label>
      <label>
        <span className="text-slate-600">Órgão emissor / UF do RG</span>
        <input value={form.rgOrgao} onChange={(e) => set('rgOrgao', e.target.value)} className="input" placeholder="Ex.: SSP/SP" />
      </label>
      <label>
        {label('Título de eleitor', 'titulo')}
        <input value={form.tituloEleitor} onChange={(e) => set('tituloEleitor', onlyDigits(e.target.value))} className="input" inputMode="numeric" />
      </label>
      <label>
        <span className="text-slate-600">CTPS *</span>
        <select value={form.ctpsTipo} onChange={(e) => set('ctpsTipo', e.target.value)} className="input">
          <option value="">Tipo...</option>
          <option value="digital">Digital</option>
          <option value="fisica">Física</option>
        </select>
      </label>
      {form.ctpsTipo !== 'digital' && (
        <>
          <label>
            <span className="text-slate-600">Número da CTPS *</span>
            <input value={form.ctpsNumero} onChange={(e) => set('ctpsNumero', e.target.value)} className="input" />
          </label>
          <label>
            <span className="text-slate-600">Série da CTPS</span>
            <input value={form.ctpsSerie} onChange={(e) => set('ctpsSerie', e.target.value)} className="input" placeholder="Ex.: 0001" />
          </label>
        </>
      )}
      <label className="sm:col-span-2 flex items-start gap-2 cursor-pointer">
        <input type="checkbox" className="mt-0.5 size-4" checked={form.primeiroEmprego} onChange={(e) => set('primeiroEmprego', e.target.checked)} />
        <span className="text-slate-600">Este é o meu <strong>primeiro emprego</strong> (não possuo PIS — campo e digitalização dispensados)</span>
      </label>
      {!form.primeiroEmprego && (
        <label>
          {label('PIS', 'pis')}
          <input value={form.pis} onChange={(e) => set('pis', onlyDigits(e.target.value))} className="input" inputMode="numeric" />
        </label>
      )}
      <label>
        <span className="text-slate-600">Chave Pix</span>
        <input value={form.chavePix} onChange={(e) => set('chavePix', e.target.value)} className="input" placeholder="CPF, e-mail, telefone ou aleatória" />
      </label>
      <label>
        <span className="text-slate-600">Nome do banco</span>
        <input value={form.banco} onChange={(e) => set('banco', e.target.value)} className="input" placeholder="Ex.: Banco do Brasil" />
      </label>
      {motociclista && (
        <>
          <label>
            {label('Número da CNH', 'cnh')}
            <input value={form.cnhNumero} onChange={(e) => set('cnhNumero', onlyDigits(e.target.value))} className="input" inputMode="numeric" />
          </label>
          <label>
            {label('Categoria da CNH', 'cnh')}
            <select value={form.cnhCategoria} onChange={(e) => set('cnhCategoria', e.target.value)} className="input">
              <option value="">Selecione...</option>
              {CNH_CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </>
      )}
      {homem && (
        <label className="sm:col-span-2">
          {label('Certificado de reservista', 'reservista')}
          <input value={form.reservista} onChange={(e) => set('reservista', e.target.value)} className="input" placeholder="Número do certificado" />
        </label>
      )}
    </div>
  )
}
