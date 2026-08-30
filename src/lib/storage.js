// Persistência em localStorage — demo sem backend.
// Em produção, troque por chamadas a uma API real.

const KEY = 'portal-admissao:v1'

export function loadDB() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { candidatos: [] }
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

// Lista de documentos exigidos. Condição define se é obrigatório para o candidato.
export const DOC_TIPOS = [
  { id: 'rg', nome: 'RG', obrigatorio: () => true },
  { id: 'cpf_doc', nome: 'CPF', obrigatorio: () => true },
  { id: 'comprovante', nome: 'Comprovante de Residência', obrigatorio: () => true },
  { id: 'titulo', nome: 'Título de Eleitor', obrigatorio: () => true },
  { id: 'pis', nome: 'PIS', obrigatorio: () => true },
  { id: 'reservista', nome: 'Certificado de Reservista', obrigatorio: (c) => c.sexo === 'M' },
  { id: 'cnh', nome: 'Habilitação Categoria A', obrigatorio: (c) => !!c.motociclista },
  { id: 'doc_moto', nome: 'Documento da Motocicleta (CRLV)', obrigatorio: (c) => !!c.motociclista },
]

export function docsPara(candidato) {
  return DOC_TIPOS.filter((t) => t.obrigatorio(candidato))
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
  return DOC_TIPOS.filter((t) => t.obrigatorio(candidato) && faltando.has(t.id))
}
