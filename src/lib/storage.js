// Persistência em localStorage — demo sem backend.
// Em produção, troque por chamadas a uma API real.

const KEY = 'portal-admissao:v1'

export const DEFAULT_EMPRESAS = [
  'Logística & Entregas Brasil LTDA',
  'Express Distribuidora S/A',
  'Translog Soluções Urbanas',
]

export const DEFAULT_FUNCOES = [
  'Motoboy / Entregador',
  'Motorista Carreteiro',
  'Auxiliar de Logística',
  'Conferente de Carga',
  'Atendente de Suporte',
]

export function loadDB() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        candidatos: parsed.candidatos || [],
        empresas: Array.isArray(parsed.empresas) && parsed.empresas.length > 0 ? parsed.empresas : DEFAULT_EMPRESAS,
        funcoes: Array.isArray(parsed.funcoes) && parsed.funcoes.length > 0 ? parsed.funcoes : DEFAULT_FUNCOES,
      }
    }
  } catch { /* ignore */ }
  return {
    candidatos: [],
    empresas: DEFAULT_EMPRESAS,
    funcoes: DEFAULT_FUNCOES,
  }
}

export function saveDB(db) {
  localStorage.setItem(KEY, JSON.stringify(db))
}

export function onlyDigits(s) {
  return (s || '').replace(/\D/g, '')
}

export function isValidCPF(cpf) {
  cpf = onlyDigits(cpf)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i)
  let d1 = (sum * 10) % 11 % 10
  if (d1 !== Number(cpf[9])) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i)
  const d2 = (sum * 10) % 11 % 10
  return d2 === Number(cpf[10])
}

export function maskCPF(v) {
  const d = onlyDigits(v).slice(0, 11)
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
}

export function maskCEP(v) {
  const d = onlyDigits(v).slice(0, 8)
  return d.replace(/^(\d{5})(\d{1,3})$/, '$1-$2')
}

export function maskPhone(v) {
  const d = onlyDigits(v).slice(0, 11)
  if (d.length <= 10) {
    return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d{1,4})$/, '$1-$2')
  }
  return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2')
}

export function waLink(phone, text) {
  const d = onlyDigits(phone)
  const withCC = d.startsWith('55') ? d : '55' + d
  return `https://wa.me/${withCC}?text=${encodeURIComponent(text)}`
}

export function calcularIdade(dataNasc) {
  if (!dataNasc) return null
  const hoje = new Date()
  const nasc = new Date(`${dataNasc}T00:00:00`)
  if (isNaN(nasc.getTime())) return null
  let idade = hoje.getFullYear() - nasc.getFullYear()
  const m = hoje.getMonth() - nasc.getMonth()
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) {
    idade--
  }
  return Math.max(0, idade)
}

// Lista de documentos exigidos. Condição define se é obrigatório para o candidato.
export const DOC_TIPOS = [
  { id: 'rg', nome: 'RG', obrigatorio: () => true },
  { id: 'cpf_doc', nome: 'CPF', obrigatorio: () => true },
  { id: 'comprovante', nome: 'Comprovante de Residência', obrigatorio: () => true },
  { id: 'titulo', nome: 'Título de Eleitor', obrigatorio: () => true },
  { id: 'pis', nome: 'PIS', obrigatorio: (c) => !(c.ficha?.primeiroEmprego) },
  { id: 'reservista', nome: 'Certificado de Reservista', obrigatorio: (c) => c.sexo === 'M' },
  { id: 'cnh', nome: 'Habilitação Categoria A', obrigatorio: (c) => !!c.motociclista },
  { id: 'doc_moto', nome: 'Documento da Motocicleta (CRLV)', obrigatorio: (c) => !!c.motociclista },
]

export function docsPara(candidato) {
  const base = DOC_TIPOS.filter((t) => t.obrigatorio(candidato))
  const f = candidato?.ficha || {}
  if (!f.temFilhos || !Array.isArray(f.dependentes) || f.dependentes.length === 0) {
    return base
  }

  const docsDep = []
  f.dependentes.forEach((dep, i) => {
    const depId = dep.id || `f${i + 1}`
    const primeiroNome = dep.nome?.trim() ? dep.nome.trim().split(' ')[0] : `Filho(a) ${i + 1}`
    const idade = calcularIdade(dep.dataNascimento)
    const idadeLabel = idade !== null ? ` (${idade} ${idade === 1 ? 'ano' : 'anos'})` : ''

    if (idade !== null && idade <= 6) {
      // Filhos até 6 anos: certidão de nascimento ou RG, CPF e carteira de vacinação (nome e vacinas)
      docsDep.push(
        { id: `dep_${depId}_certidao_rg`, nome: `Certidão de Nascimento ou RG — ${primeiroNome}${idadeLabel}`, obrigatorio: () => true },
        { id: `dep_${depId}_cpf`, nome: `CPF — ${primeiroNome}`, obrigatorio: () => true },
        { id: `dep_${depId}_vacinacao`, nome: `Carteira de Vacinação — ${primeiroNome} (nome e vacinas)`, obrigatorio: () => true },
      )
    } else if (idade !== null && idade >= 7 && idade < 14) {
      // Filhos de 7 a 14 incompletos: certidão ou RG, CPF e doc de escolaridade
      docsDep.push(
        { id: `dep_${depId}_certidao_rg`, nome: `Certidão ou RG — ${primeiroNome}${idadeLabel}`, obrigatorio: () => true },
        { id: `dep_${depId}_cpf`, nome: `CPF — ${primeiroNome}`, obrigatorio: () => true },
        { id: `dep_${depId}_escolaridade`, nome: `Declaração de Escolaridade — ${primeiroNome}`, obrigatorio: () => true },
      )
    } else if (idade === null && dep.nome?.trim()) {
      docsDep.push(
        { id: `dep_${depId}_certidao_rg`, nome: `Certidão ou RG — ${primeiroNome}`, obrigatorio: () => true },
        { id: `dep_${depId}_cpf`, nome: `CPF — ${primeiroNome}`, obrigatorio: () => true },
      )
    }
  })

  return [...base, ...docsDep]
}

export const STATUS_DOC = { pendente: 'pendente', aprovado: 'aprovado', reprovado: 'reprovado' }

// ---- Modelo de arquivos com tags ----
// candidato.arquivos = [{ id, nomeArquivo, tipo, tamanho, dataUrl, tags: ['rg','cpf'], status, observacao, enviadoEm }]
// Um arquivo pode comprovar vários requisitos (ex.: RG que já traz CPF).

let seq = 0
export function newId(prefix) {
  seq += 1
  return `${prefix}-${Date.now().toString(36)}${seq}`
}

export function isDocDependente(docId) {
  return typeof docId === 'string' && docId.startsWith('dep_')
}

/** Resolve a situação de cada documento exigido a partir dos arquivos enviados (com tags). */
export function statusDocumentos(candidato) {
  const exigidos = docsPara(candidato)
  const arquivos = candidato.arquivos || []
  const docs = {} // docId -> { docId, nome, arquivo, status, observacao, enviadoEm, preenchidoPor }
  for (const t of exigidos) {
    docs[t.id] = { docId: t.id, nome: t.nome, arquivo: null, status: 'pendente', observacao: '', enviadoEm: null, preenchidoPor: null }
  }
  // arquivos mais recentes primeiro (reenvio sobrescreve)
  const ordenados = [...arquivos].sort((a, b) => new Date(b.enviadoEm) - new Date(a.enviadoEm))
  for (const arq of ordenados) {
    for (const tag of arq.tags || []) {
      const doc = docs[tag]
      if (!doc || doc.arquivo) continue
      doc.arquivo = arq
      doc.status = arq.status // pendente | aprovado | reprovado
      doc.observacao = arq.observacao || ''
      doc.enviadoEm = arq.enviadoEm
      doc.preenchidoPor = arq.nomeArquivo
    }
  }
  return exigidos.map((t) => docs[t.id])
}

/** Requisitos ainda não comprovados por nenhum arquivo. */
export function documentosFaltantes(candidato) {
  return statusDocumentos(candidato).filter((d) => !d.arquivo).map((d) => ({ docId: d.docId, nome: d.nome }))
}

/** Tags que ainda valem a pena numa próxima subida (nenhum arquivo aprovado/pendente as cobre). */
export function tagsDisponiveis(candidato) {
  const status = statusDocumentos(candidato)
  const faltando = new Set(status.filter((d) => !d.arquivo || d.status === 'reprovado').map((d) => d.docId))
  return docsPara(candidato).filter((t) => faltando.has(t.id))
}
