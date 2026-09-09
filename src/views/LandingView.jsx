// Landing pública inspirada em designs wellness: cores calmas, cards neumórficos,
// vitrine de recursos, depoimentos e CTAs de acesso. Sem dependências externas.
const RECURSOS = [
  {
    emoji: '📄',
    titulo: 'Ficha digital de admissão',
    desc: 'O candidato preenche tudo online — dados pessoais, documentos e dependentes — sem papel e sem retrabalho.',
  },
  {
    emoji: '🔔',
    titulo: 'Notificações em tempo real',
    desc: 'Recrutadores e RH recebem avisos instantâneos a cada etapa concluída, direto do Firestore.',
  },
  {
    emoji: '✅',
    titulo: 'Validação pelo RH',
    desc: 'Checklist de documentos com status claro: aprovado, pendente ou recusado, tudo em um só lugar.',
  },
  {
    emoji: '🏢',
    titulo: 'Cadastros centralizados',
    desc: 'Empresas e funções organizadas pelo RH, com seleção fácil no momento do cadastro.',
  },
  {
    emoji: '🔗',
    titulo: 'Link seguro por CPF',
    desc: 'Envie o link pelo WhatsApp; o candidato acessa sua ficha sem criar conta, com login anônimo.',
  },
  {
    emoji: '📊',
    titulo: 'Visão de recrutador',
    desc: 'Acompanhe todos os candidatos em andamento com filtros e resumo em tempo real.',
  },
]

const DEPOIMENTOS = [
  {
    nome: 'Mariana L.',
    papel: 'Analista de RH',
    texto: 'A admissão que levava três dias hoje sai em uma tarde. O candidato envia tudo pelo celular e eu valido de casa.',
  },
  {
    nome: 'Carlos M.',
    papel: 'Recrutador',
    texto: 'As notificações em tempo real mudaram meu fluxo: sei exatamente quando cada documento chega, sem cobrar ninguém.',
  },
  {
    nome: 'Fernanda S.',
    papel: 'Candidata admitida',
    texto: 'Recebi o link no WhatsApp, preenchi em 15 minutos no ônibus e acompanhei o status. Sem fila, sem papelada.',
  },
]

function SeloNeo({ children }) {
  return (
    <span className="neo-inset inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-calm-700">
      {children}
    </span>
  )
}

export default function LandingView({ onEntrar }) {
  return (
    <div className="calm-page -my-8 -mx-4 px-4 pt-10 pb-16">
      <div className="max-w-5xl mx-auto space-y-20">
        {/* HERO */}
        <section className="text-center space-y-6 pt-6">
          <SeloNeo>🌿 Experiência leve de admissão</SeloNeo>

          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-calm-900 leading-tight">
            Documentação de novos colaboradores,
            <span className="block text-calm-500">sem estresse e sem papel.</span>
          </h1>
          <p className="max-w-2xl mx-auto text-slate-600 text-lg">
            Um portal tranquilo onde o candidato envia seus documentos e o RH valida tudo em tempo real —
            do primeiro contato ao dia um.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <button
              onClick={onEntrar}
              className="neo-btn px-6 py-3.5 text-sm font-bold text-calm-700 hover:text-calm-600 hover:scale-[1.02] active:neo-btn-active"
            >
              Entrar na plataforma →
            </button>
            <a
              href="#/acesso/"
              className="px-6 py-3.5 rounded-2xl bg-calm-600 text-white text-sm font-bold shadow-lg shadow-calm-600/30 hover:bg-calm-700 transition"
            >
              Sou candidato (usar meu CPF)
            </a>
          </div>

          {/* Mock neumórfico de progresso */}
          <div className="neo max-w-md mx-auto mt-10 p-6 text-left">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-bold text-calm-800">Admissão em andamento</p>
              <span className="text-xs font-semibold text-calm-500">78%</span>
            </div>
            <div className="neo-inset h-3 mb-5 overflow-hidden">
              <div className="h-full w-[78%] rounded-full bg-gradient-to-r from-calm-400 to-calm-600" />
            </div>
            <ul className="space-y-2 text-xs text-slate-600">
              <li>✅ Dados pessoais</li>
              <li>✅ Documentos enviados</li>
              <li>⏳ Validação do RH</li>
            </ul>
          </div>
        </section>

        {/* RECURSOS */}
        <section className="space-y-10">
          <div className="text-center space-y-2">
            <SeloNeo>✨ Recursos</SeloNeo>
            <h2 className="text-3xl font-black tracking-tight text-calm-900">Tudo o que sua admissão precisa</h2>
            <p className="text-slate-600 max-w-xl mx-auto">
              Desenhado para ser simples para o candidato e poderoso para o time de RH.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {RECURSOS.map((r) => (
              <div key={r.titulo} className="neo p-6 hover:scale-[1.015] transition-transform duration-200">
                <div className="neo-inset size-12 flex items-center justify-center text-2xl mb-4">{r.emoji}</div>
                <h3 className="font-bold text-calm-800 mb-1.5">{r.titulo}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{r.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* DEPOIMENTOS */}
        <section className="space-y-10">
          <div className="text-center space-y-2">
            <SeloNeo>💬 Depoimentos</SeloNeo>
            <h2 className="text-3xl font-black tracking-tight text-calm-900">Quem usa, recomenda</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {DEPOIMENTOS.map((d) => (
              <figure key={d.nome} className="neo p-6 flex flex-col gap-4">
                <p className="text-sm text-slate-700 leading-relaxed italic">“{d.texto}”</p>
                <figcaption className="flex items-center gap-3 mt-auto">
                  <span className="neo-inset size-10 flex items-center justify-center font-bold text-calm-600">
                    {d.nome.charAt(0)}
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-calm-800">{d.nome}</span>
                    <span className="block text-xs text-slate-500">{d.papel}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="neo p-10 text-center space-y-6">
          <h2 className="text-3xl font-black tracking-tight text-calm-900">
            Pronto para simplificar suas admissões?
          </h2>
          <p className="text-slate-600 max-w-lg mx-auto">
            Acesse com seu perfil de recrutador ou RH e comece agora — ou envie o link do candidato em segundos.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={onEntrar}
              className="px-6 py-3.5 rounded-2xl bg-calm-600 text-white text-sm font-bold shadow-lg shadow-calm-600/30 hover:bg-calm-700 transition"
            >
              Entrar agora
            </button>
            <a href="#/acesso/" className="neo-btn px-6 py-3.5 text-sm font-bold text-calm-700 active:neo-btn-active">
              Acessar como candidato
            </a>
          </div>
        </section>
      </div>
    </div>
  )
}
