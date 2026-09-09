import { jsPDF } from 'jspdf'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { statusDocumentos, maskCPF, maskPhone, calcularIdade, isMotociclista } from './storage'
import { urlArquivoFB } from './api'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

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

/** Baixa uma URL remota e devolve um dataURL. Tenta fetch (precisa de CORS no Storage) e, se falhar, tenta via <img crossOrigin>. */
async function baixarComoDataUrl(url) {
  // 1ª tentativa: fetch (funciona se o bucket tiver CORS configurado — ver cors.json)
  try {
    const blob = await fetch(url, { mode: 'cors' }).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.blob()
    })
    return await new Promise((ok, falhou) => {
      const fr = new FileReader()
      fr.onload = () => ok(String(fr.result))
      fr.onerror = falhou
      fr.readAsDataURL(blob)
    })
  } catch { /* CORS/bloqueio — tenta via <img> */ }
  // 2ª tentativa: carrega como imagem com crossOrigin anônimo (o Storage geralmente responde com ACAO:* para getDownloadURL)
  return new Promise((ok, falhou) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        canvas.getContext('2d').drawImage(img, 0, 0)
        ok(canvas.toDataURL('image/jpeg', 0.92))
      } catch (e) { falhou(e) } // canvas contaminado → CORS realmente bloqueado
    }
    img.onerror = falhou
    img.src = url
  })
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

/** Baixa bytes crus de uma URL remota (usado para PDFs anexados no Storage). */
async function baixarBytes(url) {
  const resp = await fetch(url, { mode: 'cors' })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  return await resp.arrayBuffer()
}

/** Renderiza todas as páginas de um PDF (dataURL ou ArrayBuffer) como dataURLs JPEG. */
async function renderizarPaginasPdf(fonte) {
  const doc = fonte instanceof ArrayBuffer
    ? await pdfjsLib.getDocument({ data: fonte }).promise
    : await pdfjsLib.getDocument(fonte).promise
  const paginas = []
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    // escala para largura útil de ~1400px (boa qualidade sem estourar o tamanho do arquivo)
    const base = page.getViewport({ scale: 1 })
    const scale = Math.min(1400 / base.width, 3)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
    paginas.push(canvas.toDataURL('image/jpeg', 0.9))
  }
  return paginas
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

  // ---------- Documentação Anexa (somente documentos APROVADOS, digitalização embutida) ----------
  const arquivos = (candidato.arquivos || []).filter((a) => a.status === 'aprovado')
  if (arquivos.length > 0) {
    y = 22

    const larguraUtil = W - 10 // margens estreitas: documento ocupa quase toda a folha
    const alturaUtilFolha = 285 - 12 // área útil abaixo do topo (12mm)
    let primeira = false
    for (const arq of arquivos) {
      // cada documento começa em uma página nova, com seu título no topo
      if (!primeira) { doc.addPage() }
      primeira = false
      y = 22
      // digitalização do documento (sem rótulo/texto — apenas a imagem ocupando a folha)
      y = 12 // começa no topo da folha, maximizando a área da digitalização

      // resolve a URL do documento (Firebase Storage) quando necessário
      let src = arq.dataUrl || null
      if (!src && arq.caminho) {
        try {
          src = await urlArquivoFB(arq.caminho)
        } catch { src = null }
      }

      const ehTipoImagem = arq.tipo?.startsWith('image/')
      const ehTipoPdf = (arq.tipo || '').includes('pdf') || arq.nomeArquivo?.toLowerCase().endsWith('.pdf')

      /** Embute um dataURL de imagem ocupando a largura máxima da folha (mín. margens). */
      const embutirImagem = async (data, larguraMax = larguraUtil) => {
        if (!/^data:image\/(jpeg|jpg|png);/i.test(data)) data = await converterParaJpeg(data)
        const props = doc.getImageProperties(data)
        // largura máxima possível: se a altura resultante estourar a folha, limita pela altura
        let larguraImg = larguraMax
        let alturaImg = (props.height / props.width) * larguraImg
        if (alturaImg > alturaUtilFolha) {
          alturaImg = alturaUtilFolha
          larguraImg = (props.width / props.height) * alturaImg
        }
        if (y + alturaImg > 285) { doc.addPage(); y = 12 }
        doc.addImage(data, props.fileType === 'PNG' ? 'PNG' : 'JPEG', (W - larguraImg) / 2, y, larguraImg, alturaImg)
        y += alturaImg + 2
      }

      /** Nota no lugar do documento quando não foi possível embutir. */
      const notaFalha = (msg, cor = [160]) => {
        doc.setTextColor(...cor)
        doc.setFontSize(8.5)
        doc.text(doc.splitTextToSize(msg, larguraUtil), M, y)
        doc.setTextColor(30)
        y += 8
      }

      try {
        if (ehTipoImagem) {
          // imagem: baixa (dataURL ou URL remota) e embute
          let data = src
          if (data && /^https?:/i.test(data)) data = await baixarComoDataUrl(data)
          if (data && /^data:image\//i.test(data)) await embutirImagem(data)
          else notaFalha('(imagem não pôde ser embutida: acesso ao Storage bloqueado — aplique o cors.json ao bucket e gere o PDF novamente)', [190, 40, 40])
        } else if (ehTipoPdf) {
          // PDF anexado: baixa os bytes e renderiza cada página como imagem dentro da ficha
          let paginas = null
          if (src && /^data:application\/pdf/i.test(src)) {
            paginas = await renderizarPaginasPdf(src)
          } else if (src && /^https?:/i.test(src)) {
            const bytes = await baixarBytes(src)
            paginas = await renderizarPaginasPdf(bytes)
          }
          if (paginas && paginas.length) {
            for (const pag of paginas) await embutirImagem(pag)
          } else {
            notaFalha('(PDF não pôde ser embutido: acesso ao Storage bloqueado — aplique o cors.json ao bucket e gere o PDF novamente)', [190, 40, 40])
          }
        } else {
          notaFalha(src ? '(tipo de arquivo não suportado para embutir — baixe pelo portal)' : '(visualização do arquivo indisponível; baixe pelo portal)')
        }
      } catch {
        notaFalha('(falha ao renderizar o documento — baixe o arquivo pelo portal)', [190, 40, 40])
      }
      y += 4
    }
  }

  doc.save(`ficha-admissao-${candidato.cpf}.pdf`)
}
