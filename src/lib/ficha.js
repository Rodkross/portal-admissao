import { jsPDF } from 'jspdf'
import { statusDocumentos } from './storage'

const statusLabel = { pendente: 'PENDENTE', aprovado: 'APROVADO', reprovado: 'REPROVADO' }

export function gerarFichaPDF(candidato) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210
  const M = 18

  doc.setFillColor(30, 64, 175)
  doc.rect(0, 0, W, 26, 'F')
  doc.setTextColor(255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('FICHA DE ADMISSÃO', M, 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Portal de Admissão — Documentação do Candidato', M, 19)
  let y = 36

  doc.setTextColor(30)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Dados do Candidato', M, y)
  y += 7

  const dados = [
    ['Nome completo', candidato.nome],
    ['CPF', candidato.cpf],
    ['Telefone', candidato.telefone],
    ['Sexo', candidato.sexo === 'M' ? 'Masculino' : 'Feminino'],
    ['Motociclista', candidato.motociclista ? 'Sim' : 'Não'],
    ['Cadastrado por (recrutador)', candidato.recrutador || '-'],
    ['Data do cadastro', candidato.criadoEm ? new Date(candidato.criadoEm).toLocaleString('pt-BR') : '-'],
  ]
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const larguraValor = W - M * 2 - 55
  for (const [label, value] of dados) {
    const linhasValor = doc.splitTextToSize(String(value || '-'), larguraValor)
    const alturaBloco = Math.max(linhasValor.length * 5, 6.5)
    doc.setTextColor(110)
    doc.text(`${label}:`, M, y)
    doc.setTextColor(30)
    doc.text(linhasValor, M + 55, y)
    y += alturaBloco
  }

  doc.setTextColor(30)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Documentação Enviada', M, y)
  y += 6

  // Resumo por informação exigida (resolvida via arquivos com tags)
  const status = statusDocumentos(candidato)
  doc.setFontSize(9.5)
  for (const s of status) {
    const envio = s.arquivo
    if (y > 250) { doc.addPage(); y = 22 }

    // pré-calcula as linhas para dimensionar o card dinamicamente
    const nomeDoc = doc.splitTextToSize(s.nome, W - M * 2 - 45)
    const temObs = !!envio?.observacao
    const linhasObs = temObs ? doc.splitTextToSize(`Observação do RH: ${envio.observacao}`, W - M * 2 - 8) : []
    const alturaCard = 10 + (nomeDoc.length - 1) * 4.5 + (envio ? 4.5 : 0) + (temObs ? 4 + linhasObs.length * 4 : 0)

    // borda do card
    doc.setDrawColor(200)
    doc.roundedRect(M, y - 4.5, W - M * 2, alturaCard, 1.5, 1.5)
    doc.setTextColor(30)
    doc.setFont('helvetica', 'bold')
    doc.text(nomeDoc, M + 3, y + 0.5)
    const cor = !envio ? [160, 160, 160] : s.status === 'aprovado' ? [22, 130, 60] : s.status === 'reprovado' ? [190, 40, 40] : [180, 130, 0]
    doc.setTextColor(...cor)
    doc.text(envio ? statusLabel[s.status] : 'NÃO ENVIADO', W - M - 3, y + 0.5, { align: 'right' })
    let yInterno = y + 0.5 + (nomeDoc.length - 1) * 4.5
    if (envio) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(120)
      yInterno += 4.5
      const linhaOrigem = doc.splitTextToSize(`Via: ${s.preenchidoPor} · enviado em ${new Date(s.enviadoEm).toLocaleString('pt-BR')}`, W - M * 2 - 6)
      doc.text(linhaOrigem, M + 3, yInterno)
      doc.setFontSize(9.5)
    }
    if (temObs) {
      y += 6 + (nomeDoc.length - 1) * 4.5 + 4.5
      if (y > 255) { doc.addPage(); y = 22 }
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8.5)
      doc.setTextColor(190, 40, 40)
      doc.text(linhasObs, M + 6, y)
      y += linhasObs.length * 4
      doc.setFontSize(9.5)
    }
    y += alturaCard + 1
  }

  if (y > 235) { doc.addPage(); y = 22 }
  y += 4
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(30)
  doc.text('Resumo', M, y)
  y += 7
  const total = status.length
  const enviados = status.filter((s) => s.arquivo).length
  const aprovados = status.filter((s) => s.status === 'aprovado').length
  const reprovados = status.filter((s) => s.status === 'reprovado').length
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const linhaResumo = doc.splitTextToSize(`Documentos exigidos: ${total}  |  Enviados: ${enviados}  |  Aprovados: ${aprovados}  |  Reprovados: ${reprovados}`, W - M * 2)
  doc.text(linhaResumo, M, y)
  y += linhaResumo.length * 5 + 5
  const situacao =
    reprovados > 0 ? 'PENDENTE DE CORREÇÃO (existem documentos reprovados)'
      : aprovados === total ? 'DOCUMENTAÇÃO COMPLETA E VALIDADA'
        : 'AGUARDANDO ENVIO/VALIDAÇÃO'
  doc.setFont('helvetica', 'bold')
  const linhasSituacao = doc.splitTextToSize(`Situação: ${situacao}`, W - M * 2)
  doc.text(linhasSituacao, M, y)

  doc.save(`ficha-admissao-${candidato.cpf}.pdf`)
}
