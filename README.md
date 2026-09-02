# Portal de Admissão

Aplicação web para documentação de novos colaboradores: recrutadores cadastram candidatos e enviam links de acesso via WhatsApp, o candidato sobe seus documentos pela página pública, e o RH valida a documentação e gera a ficha de admissão em PDF.

> ⚠️ **Backend: Firebase** — Auth (login interno), Firestore (candidatos, notificações, configurações) e Storage (documentos em bucket privado). Configure com o arquivo `.env` (copie `.env.example`) a partir de um projeto Firebase — recomenda-se região `southamerica-east1` (São Paulo) para adequação à LGPD.

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

Usuário inicial: crie o primeiro acesso no **Console do Firebase → Authentication → E-mail/senha** (ex.: `rh@empresa.com`), e depois em **Firestore → coleção `usuarios`**, crie um documento com ID igual ao **UID** do usuário criado contendo:

```json
{ "nome": "Administrador RH", "email": "rh@empresa.com", "perfil": "rh" }
```

Depois disso, os demais usuários (RH e recrutadores) podem ser criados pela aba **Cadastros → Usuários** dentro do portal.

## Setup do Firebase (uma vez)

1. Crie um projeto em [console.firebase.google.com](https://console.firebase.google.com) (região **southamerica-east1**).
2. Ative **Authentication → E-mail/senha**.
3. Crie o **Firestore** (modo produção) e o **Storage**.
4. Copie `.env.example` para `.env` e preencha com as credenciais do app Web (Configurações do projeto → Seus apps).
5. Publique as regras: `firebase deploy --only firestore:rules,storage` (ou cole o conteúdo de `firestore.rules`/`storage.rules` no Console).
6. Coleção inicial: `config/geral` com `{ "empresas": [...], "funcoes": [...] }` (opcional — o app funciona sem, e o RH cadastra pela aba Cadastros).

## Stack técnica

- [React 19](https://react.dev) + [Vite 8](https://vite.dev)
- [Firebase](https://firebase.google.com) — Auth (e-mail/senha), Firestore (tempo real) e Storage (documentos)
- [Tailwind CSS 4](https://tailwindcss.com) (plugin `@tailwindcss/vite`)
- [jsPDF](https://github.com/parallax/jsPDF) — geração da ficha em PDF
- ESLint 10 (`eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`)
- Roteamento simples por `location.hash` (sem react-router)

## Estrutura do projeto

```
├── index.html                  # HTML raiz
├── vite.config.js              # Configuração do Vite (React + Tailwind)
├── eslint.config.js            # Configuração do ESLint
├── .env.example                # Modelo das credenciais do Firebase
├── firestore.rules             # Regras de segurança do Firestore
├── storage.rules               # Regras de segurança do Storage
├── public/
│   ├── favicon.svg
│   └── icons.svg
└── src/
    ├── main.jsx                # Bootstrap do React
    ├── App.jsx                 # Layout, abas, notificações e roteamento por hash
    ├── index.css / App.css     # Estilos (Tailwind + tema brand)
    ├── assets/
    └── lib/
        ├── firebase.js         # Inicialização do Firebase (Auth/Firestore/Storage)
        ├── api.js              # Camada de dados: auth, candidatos, notificações, arquivos
        ├── auth.js             # [legado] auth em localStorage — desativado
        ├── storage.js          # Documentos exigidos, máscaras, validação de CPF
        └── ficha.js            # Linhas da ficha + geração do PDF (jsPDF)
    └── views/
        ├── LoginView.jsx       # Tela de login interno (Firebase Auth)
        ├── RecrutadorView.jsx  # Cadastro de candidatos e convites via WhatsApp
        ├── CandidatoView.jsx   # Área pública do candidato (ficha + uploads no Storage)
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
| (nenhuma obrigatória) | Sessão e dados agora vivem no Firebase; nada sensível fica no localStorage |

## Regras de segurança (resumo)

- `firestore.rules` — RH lê/escreve tudo; recrutador lê/escreve apenas candidatos onde `recrutador == nome dele`; acesso anônimo apenas ao próprio candidato por CPF (composição limitada); `usuarios` só é escrito pelo RH.
- `storage.rules` — documentos em `documentos/{candidatoId}/…` são privados: leitura para RH, recrutador dono e o próprio candidato; escrita apenas do dono.
- **Nota:** para regras mais rígidas em produção, migre a verificação de perfil para Custom Claims do Firebase Auth (via Admin SDK) e restrinja o acesso anônimo do candidato.

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

- Custom Claims no Firebase Auth (perfil `rh`/`recrutador` no token) para regras mais rígidas.
- Cloud Function para excluir a conta de login ao remover usuário no portal (requer Admin SDK).
- Integração com a API oficial do WhatsApp Business para envio dos convites.
- Auditoria completa (historia de todas as ações) em coleção dedicada.
