# Portal de Admissão

Aplicação web para documentação de novos colaboradores: recrutadores cadastram candidatos e enviam links de acesso via WhatsApp, o candidato sobe seus documentos pela página pública, e o RH valida a documentação e gera a ficha de admissão em PDF.

> ⚠️ **Projeto demo** — não há backend. Todos os dados (candidatos, usuários, arquivos) são armazenados no navegador via `localStorage`/`sessionStorage`. Em produção, substitua por uma API própria e integre a WhatsApp Business API.

## Funcionalidades

### Área interna (com login)

- **Recrutador** — cadastro de candidatos (com validação de CPF, máscaras de telefone/CEP), geração de link de acesso por CPF e envio do convite por WhatsApp.
- **Validação (RH)** — revisão dos documentos enviados por cada candidato, com aprovação/reprovação e observações. Documentos reprovados liberam novo envio pelo candidato.
  - **Somente a versão mais recente de cada documento entra na fila de análise** — reenvios substituem automaticamente os arquivos anteriores (reprovados ou não), que saem da tela e passam a constar apenas no histórico.
  - **Ordenação por prioridade**: candidatos com documentação enviada aguardando aprovação aparecem no topo, seguidos dos com exigência/pendência; aprovados por último.
  - **Histórico do processo** no modal do candidato: todos os envios, aprovações/rejeições (com observações) e comunicações registradas com o candidato.
  - As mensagens de exigências disparadas por WhatsApp a partir do portal são **registradas automaticamente no histórico de comunicações**.
- **Usuários (RH)** — criação e remoção de usuários internos com perfil `rh` ou `recrutador`.

### Área do candidato (pública, via link `#/acesso/<CPF>`)

- Preenchimento da ficha de admissão (dados pessoais, endereço, CTPS, PIS, Pix, banco, dados do contrato etc.).
- Upload de documentos com **tags**: um mesmo arquivo pode comprovar vários requisitos (ex.: RG que já traz o CPF).
- Lista de documentos exigidos calculada dinamicamente (PIS não é exigido no primeiro emprego; reservista apenas para homens; CNH e CRLV apenas para motociclistas).
- **Documentos de dependentes (filhos)**: ao informar filhos na ficha, são exigidos documentos adicionais conforme a idade de cada um:
  - **Até 6 anos** — Certidão de Nascimento ou RG, CPF do filho e Carteira de Vacinação (nome e vacinas);
  - **De 7 a 13 anos (menores de 14)** — Certidão ou RG, CPF do filho e Declaração de Escolaridade;
  - **Idade não informada** — Certidão ou RG e CPF do filho.
- Cálculo automático da idade do dependente a partir da data de nascimento (função `calcularIdade`).
- Acompanhamento do status de cada documento: `pendente`, `aprovado`, `reprovado`.

### Geração de PDF

O RH pode baixar a **Ficha de Admissão** em PDF (via `jsPDF`), contendo todos os dados da ficha, o resumo da documentação (enviados/aprovados/reprovados) e as imagens enviadas embutidas no arquivo.

## Perfis de acesso

| Perfil | Acesso |
|---|---|
| `recrutador` | Aba Recrutador (cadastro e convites) |
| `rh` | Abas Validação e Cadastros |

Usuário inicial (seed): **rh@empresa.com** / **admin123** (perfil RH). A sessão dura enquanto a aba do navegador estiver aberta (`sessionStorage`).

## Stack técnica

- [React 19](https://react.dev) + [Vite 8](https://vite.dev)
- [Tailwind CSS 4](https://tailwindcss.com) (plugin `@tailwindcss/vite`)
- [jsPDF](https://github.com/parallax/jsPDF) — geração da ficha em PDF
- [lucide-react](https://lucide.dev) — ícones
- ESLint 10 (`eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`)
- Roteamento simples por `location.hash` (sem react-router)

## Estrutura do projeto

```
├── index.html                  # HTML raiz
├── vite.config.js              # Configuração do Vite (React + Tailwind)
├── eslint.config.js            # Configuração do ESLint
├── public/
│   ├── favicon.svg
│   └── icons.svg
└── src/
    ├── main.jsx                # Bootstrap do React
    ├── App.jsx                 # Layout, abas e roteamento por hash
    ├── index.css / App.css     # Estilos (Tailwind + tema brand)
    ├── assets/
    └── lib/
    │   ├── auth.js             # Login/sessão/usuários (localStorage + sessionStorage)
    │   ├── storage.js          # Persistência, validação de CPF, máscaras, documentos exigidos
    │   └── ficha.js            # Linhas da ficha + geração do PDF (jsPDF)
    └── views/
        ├── LoginView.jsx       # Tela de login interno
        ├── RecrutadorView.jsx  # Cadastro de candidatos e convites via WhatsApp
        ├── CandidatoView.jsx   # Área pública do candidato (ficha + uploads)
        ├── RhView.jsx          # Painel de admissões e validação de documentos pelo RH
        ├── CadastrosView.jsx   # Gestão centralizada de empresas, funções e usuários internos
        └── FichaCandidato.jsx  # Visualização da ficha do candidato
```

## Requisitos

- Node.js 20+
- npm

## Como rodar

```bash
# instalar dependências
npm install

# ambiente de desenvolvimento (HMR)
npm run dev

# checagem de lint
npm run lint

# build de produção
npm run build

# pré-visualizar o build
npm run preview
```

## Modelo de dados (resumo)

- `candidato`: `{ id, nome, cpf, telefone, sexo, motociclista, recrutador, ficha: {..., temFilhos, dependentes: [{ id, nome, dataNascimento }] }, contrato: {...}, arquivos: [...], comunicacoes: [...] }`
- `arquivo`: `{ id, nomeArquivo, tipo, tamanho, dataUrl, tags: [docId], status, observacao, enviadoEm }`
- `comunicacao`: `{ id, data, tipo: 'whatsapp', resumo }`
- `usuário`: `{ id, nome, email, senha, perfil: 'rh'|'recrutador', criadoEm }`

Chaves de armazenamento no navegador:

| Chave | Conteúdo |
|---|---|
| `portal-admissao:v1` | Banco de candidatos (`localStorage`) |
| `portal-admissao:users:v1` | Usuários internos (`localStorage`) |
| `portal-admissao:session:v1` | Sessão ativa (`sessionStorage`) |

## Tipos de documento exigidos

| Documento | Condição |
|---|---|
| RG, CPF, Comprovante de Residência, Título de Eleitor | Sempre |
| PIS | Não é exigido se "primeiro emprego" |
| Certificado de Reservista | Apenas sexo masculino |
| CNH Categoria A e CRLV da motocicleta | Apenas motociclistas |
| Certidão de Nascimento/RG, CPF e Carteira de Vacinação do dependente | Filhos com até 6 anos |
| Certidão/RG, CPF e Declaração de Escolaridade do dependente | Filhos de 7 a 13 anos |
| Certidão/RG e CPF do dependente | Filho sem data de nascimento informada |

## Roadmap / melhorias para produção

- Backend com autenticação real (bcrypt/argon2 + tokens de sessão) e armazenamento de arquivos (S3 ou similar).
- Integração com a API oficial do WhatsApp Business para envio dos convites.
- Notificações e histórico de auditoria das validações.
