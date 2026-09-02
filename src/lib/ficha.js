import { jsPDF } from 'jspdf'
import { statusDocumentos, maskCPF, maskPhone, docsPara, calcularIdade, isMotociclista } from './storage'
import { urlArquivoFB } from './api'

const statusLabel = { pendente: 'PENDENTE', aprovado: 'APROVADO', reprovado: 'REPROVADO' }

/** Todas as linhas da ficha do candidato — fonte única usada no portal do RH e no PDF. */
export function fichaLinhas(c) {
  const f = c.ficha || {}
  const endereco = [f.logradouro, f.numero, f.complemento].filter(Boolean).join(', ')
  const cidadeUf = [f.cidade, f.uf].filter(Boolean).join(' / ')
  const depList = f.temFilhos && Array.isArray(f.dependentes) ? f.dependentes : []
  const filhosTexto =
    depList.length === 0
      ? 'Não possui'
      : depList
          .map((d, i) => {
            const idade = calcularIdade(d.dataNascimento)
            const idadeStr = idade !== null ? ` (${idade} ${idade === 1 ? 'ano' : 'anos'})` : ''
            const dataStr = d.dataNascimento ? new Date(`${d.dataNascimento}T00:00:00`).toLocaleDateString('pt-BR') : ''
            return `${i + 1}. ${d.nome || 'Sem nome'} — Nasc: ${dataStr || '—'}${idadeStr}`
          })
          .join('\n')

  const ct = c.contrato || {}
  const empresaNome = ct.empresa || c.empresa || 'A definir'
  const funcaoNome = ct.funcao || c.funcao || 'A definir'
  const ehHorista = ct.horista !== undefined ? ct.horista : c.horista

  const linhas = [
    ['Empresa de cadastro', empresaNome],
    ['Função', funcaoNome],
    ['Regime de trabalho', ehHorista ? 'Horista' : 'Mensalista'],
    ['Recrutador responsável', c.recrutador],
    ['Nome completo', c.nome],
    ['CPF', maskCPF(c.cpf)],
    ['Data de nascimento', f.dataNascimento ? new Date(`${f.dataNascimento}T00:00:00`).toLocaleDateString('pt-BR') : ''],
    ['Telefone (WhatsApp)', f.telefone ? maskPhone(f.telefone) : maskPhone(c.telefone)],
    ['Endereço', [endereco, f.bairro, cidadeUf].filter(Boolean).join(' — ')],
    ['Estado civil', f.estadoCivil],
    ['Escolaridade', f.escolaridade],
    ['Dependentes / Filhos', filhosTexto],
    ['RG', [f.rg, f.rgOrgao].filter(Boolean).join(' · ')],
    ['CTPS', f.ctpsTipo === 'digital' ? 'Digital' : (f.ctpsTipo ? `Física nº ${f.ctpsNumero || '-'}${f.ctpsSerie ? `, série ${f.ctpsSerie}` : ''}` : '')],
    ['Título de eleitor', f.tituloEleitor],
    ['PIS', f.primeiroEmprego ? 'Primeiro emprego (não possui)' : f.pis],
    ['Chave Pix', f.chavePix],
    ['Banco', f.banco],
  ]
  if (isMotociclista(c)) linhas.push(['CNH', [f.cnhNumero ? `nº ${f.cnhNumero}` : '', f.cnhCategoria ? `cat. ${f.cnhCategoria}` : ''].filter(Boolean).join(' · ')])
  if (c.sexo === 'M') linhas.push(['Certificado de reservista', f.reservista])
  if (ct.salario) linhas.push(['Salário', ct.salario])
  if (ct.horario) linhas.push(['Horário de trabalho', ct.horario])
  if (ct.folga) linhas.push(['Folga', ct.folga])
  if (ct.dataAdmissao) linhas.push(['Data de admissão', new Date(`${ct.dataAdmissao}T00:00:00`).toLocaleDateString('pt-BR')])
  return linhas.map(([k, v]) => [k, v || '—'])
}

/** Converte um dataUrl de imagem (ex.: webp) para JPEG via canvas, formato que o jsPDF embute. */
function converterParaJpeg(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d').drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/jpeg', 0.92))
    }
    img.onerror = reject
    img.src = dataUrl
  })
}

export async function gerarFichaPDF(candidato) {
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
  doc.text('Ficha do Candidato', M, y)
  y += 7

  const dados = fichaLinhas(candidato)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const larguraValor = W - M * 2 - 55
  for (const [label, value] of dados) {
    if (y > 255) { doc.addPage(); y = 22 }
    const linhasValor = doc.splitTextToSize(String(value || '-'), larguraValor)
    const alturaBloco = Math.max(linhasValor.length * 5, 6.5)
    doc.setTextColor(110)
    doc.text(`${label}:`, M, y)
    doc.setTextColor(30)
    doc.text(linhasValor, M + 55, y)
    y += alturaBloco
  }

  // Resumo consolidado da documentação
  const status = statusDocumentos(candidato)
  if (y > 235) { doc.addPage(); y = 22 }
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

  // ---------- Documentação Anexa (documentos digitalizados embutidos) ----------
  const arquivos = candidato.arquivos || []
  if (arquivos.length > 0) {
    doc.addPage()
    y = 22
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(30)
    doc.text(`Documentação Anexa (${arquivos.length})`, M, y)
    y += 8

    const larguraUtil = W - M * 2
    for (const arq of arquivos) {
      // rótulo do arquivo
      if (y > 265) { doc.addPage(); y = 22 }
      // (await permitido: gerarFichaPDF é async)
      const nomesTags = (arq.tags || []).map((id) => docsPara(candidato).find((t) => t.id === id)?.nome || id).join(', ')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5)
      doc.setTextColor(30)
      const rotulo = doc.splitTextToSize(nomesTags || 'Documento', larguraUtil - 30)
      doc.text(rotulo, M, y)
      doc.setTextColor(...(arq.status === 'aprovado' ? [22, 130, 60] : arq.status === 'reprovado' ? [190, 40, 40] : [180, 130, 0]))
      doc.text(statusLabel[arq.status] || arq.status, W - M, y, { align: 'right' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(120)
      doc.text(doc.splitTextToSize(`Enviado em ${new Date(arq.enviadoEm).toLocaleString('pt-BR')}`, larguraUtil), M, y + 4)
      y += 10

      // resolve a URL do documento (Firebase Storage) quando necessário
      let src = arq.dataUrl || null
      if (!src && arq.caminho) {
        try {
          src = await urlArquivoFB(arq.caminho)
        } catch { src = null }
      }
      if (src && /^https?:/i.test(src) && arq.tipo?.startsWith('image/')) {
        // converte a URL remota em dataURL para embutir no PDF
        try {
          const blob = await fetch(src).then((r) => r.blob())
          src = await new Promise((ok, falhou) => {
            const fr = new FileReader()
            fr.onload = () => ok(String(fr.result))
            fr.onerror = falhou
            fr.readAsDataURL(blob)
          })
        } catch { src = null }
      }

      // embute imagem (qualquer image/*) direto no PDF
      const ehImagem = src && /^data:image\//i.test(src)
      if (ehImagem) {
        try {
          // jsPDF só embute PNG/JPEG nativamente; converte outros formatos (webp etc.) via canvas
          let data = src
          if (!/^data:image\/(jpeg|jpg|png);/i.test(data)) {
            data = await converterParaJpeg(data)
          }
          const props = doc.getImageProperties(data)
          const alturaImg = Math.min((props.height / props.width) * larguraUtil, 160)
          const larguraImg = (props.width / props.height) * alturaImg
          if (y + alturaImg > 280) { doc.addPage(); y = 22 }
          doc.addImage(data, props.fileType === 'PNG' ? 'PNG' : 'JPEG', M + (larguraUtil - larguraImg) / 2, y, larguraImg, alturaImg)
          y += alturaImg + 10
        } catch {
          doc.setTextColor(190, 40, 40)
          doc.setFontSize(8.5)
          doc.text('(imagem ilegível — baixe o arquivo pelo portal)', M, y)
          doc.setTextColor(30)
          y += 8
        }
      } else {
        doc.setTextColor(160)
        doc.setFontSize(8.5)
        doc.text(src ? '(documento PDF anexado — baixe pelo portal para visualizar)' : '(visualização do arquivo indisponível; baixe pelo portal)', M, y)
        doc.setTextColor(30)
        y += 8
      }
      y += 4
    }
  }

  doc.save(`ficha-admissao-${candidato.cpf}.pdf`)
}
