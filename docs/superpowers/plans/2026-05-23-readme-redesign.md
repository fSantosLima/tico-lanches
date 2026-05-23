# README Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the default Next.js README with a comprehensive developer reference in pt-BR, including Mermaid diagrams and a complete local setup guide.

**Architecture:** Two files change — `README.md` (full rewrite) and `.env.example` (new file). No code changes. Work happens in `.worktrees/feature-readme` on branch `feature/readme`.

**Tech Stack:** Markdown, Mermaid (rendered by GitHub), Next.js 16, Prisma 7, NextAuth.js v4, Vitest

---

## Files

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `README.md` | Replace Next.js boilerplate with full developer README |
| Create | `.env.example` | Environment variable template for onboarding |
| Commit | `docs/superpowers/specs/2026-05-23-readme-design.md` | Spec doc written in brainstorm session, still untracked |

---

### Task 1: Commit the spec document

**Files:**
- Commit: `docs/superpowers/specs/2026-05-23-readme-design.md`

- [ ] **Step 1: Verify the spec file exists and is untracked**

```bash
git status docs/superpowers/specs/2026-05-23-readme-design.md
```

Expected output: `?? docs/superpowers/specs/2026-05-23-readme-design.md`

- [ ] **Step 2: Stage and commit the spec**

```bash
git add docs/superpowers/specs/2026-05-23-readme-design.md
git commit -m "docs: add README redesign spec"
```

Expected: commit succeeds, working tree clean for that file.

---

### Task 2: Create `.env.example`

**Files:**
- Create: `.env.example`

- [ ] **Step 1: Create the file**

Create `.env.example` with this exact content:

```bash
# Banco de dados PostgreSQL
DATABASE_URL="postgresql://postgres:senha@localhost:5432/lanches"

# NextAuth — gere um valor aleatório: openssl rand -base64 32
NEXTAUTH_SECRET="seu-secret-aqui"

# URL base da aplicação (sem barra no final)
NEXTAUTH_URL="http://localhost:3000"
```

- [ ] **Step 2: Verify it is not gitignored**

```bash
git check-ignore -v .env.example
```

Expected: no output (`.env.example` is NOT ignored — `.env*` glob in `.gitignore` covers `.env` and `.env.local` but not `.env.example` by Next.js convention).

> If it IS ignored, add a negation line to `.gitignore`:
> ```
> !.env.example
> ```
> and stage `.gitignore` together with `.env.example` in the next step.

- [ ] **Step 3: Stage and commit**

```bash
git add .env.example
git commit -m "chore: add .env.example for local setup onboarding"
```

---

### Task 3: Write the README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace README.md with the full content below**

Replace the entire content of `README.md` with:

````markdown
# Sistema de Gestão de Lanches

Ferramenta mobile-first para vendedores autônomos de lanches registrarem vendas com 1 toque e acompanharem o resultado financeiro do dia em tempo real.

O Sprint 1 cobre o fluxo principal: criar conta → cadastrar produtos → registrar vendas → ver total do dia.

---

## Tech Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 16 (App Router) |
| Linguagem | TypeScript |
| Estilização | Tailwind CSS |
| ORM | Prisma 7 |
| Banco de dados | PostgreSQL |
| Autenticação | NextAuth.js v4 (Credentials Provider) |
| Testes | Vitest + jsdom |

---

## Pré-requisitos

- Node.js >= 18
- npm >= 9
- Docker (para rodar o PostgreSQL localmente)

---

## Setup Local

**1. Instalar dependências**

```bash
npm install
```

**2. Configurar variáveis de ambiente**

```bash
cp .env.example .env
```

Edite `.env` com os valores reais:

```
DATABASE_URL="postgresql://postgres:123456@localhost:5432/lanches"
NEXTAUTH_SECRET="<string aleatória — gere com: openssl rand -base64 32>"
NEXTAUTH_URL="http://localhost:3000"
```

**3. Subir o PostgreSQL via Docker**

```bash
docker run --name lanches-db \
  -e POSTGRES_PASSWORD=123456 \
  -e POSTGRES_DB=lanches \
  -p 5432:5432 \
  -d postgres
```

**4. Rodar as migrations**

```bash
npx prisma migrate dev
```

**5. Iniciar o servidor de desenvolvimento**

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). Crie uma conta em `/register` e comece a usar.

---

## Arquitetura

Next.js App Router gerencia frontend e API no mesmo processo. O middleware protege rotas autenticadas antes de qualquer renderização.

```mermaid
flowchart LR
    Browser -->|request| Middleware["src/middleware.ts\n(withAuth)"]
    Middleware -->|autenticado| AppRouter["App Router"]
    Middleware -->|não autenticado| Login["/login"]
    AppRouter --> Dashboard["/dashboard"]
    AppRouter --> Products["/products"]
    AppRouter --> API["API Routes\n/api/*"]
    API --> Prisma["PrismaClient\nsrc/lib/prisma.ts"]
    Prisma --> DB[("PostgreSQL")]
```

- `src/middleware.ts` usa `withAuth` do NextAuth para proteger `/dashboard` e `/products`
- API Routes validam sessão via `getServerSession` antes de qualquer operação no banco
- O singleton do PrismaClient usa o driver adapter `@prisma/adapter-pg` (não a conexão TCP padrão)

---

## Modelo de Dados

```mermaid
erDiagram
    User {
        String id PK
        String email UK
        String name
        String password
        DateTime createdAt
    }
    Product {
        String id PK
        String name
        Float price
        Float cost
        String userId FK
        DateTime createdAt
    }
    Sale {
        String id PK
        String productId FK
        String userId FK
        Float value
        DateTime createdAt
    }

    User ||--o{ Product : "possui"
    User ||--o{ Sale : "registra"
    Product ||--o{ Sale : "é vendido em"
```

> `Sale.value` armazena o preço no momento da venda. Edições futuras em `Product.price` não afetam o histórico financeiro.

---

## API Endpoints

Todas as rotas (exceto `/api/auth/*` e `/api/register`) exigem sessão ativa e retornam `401` se não autenticado.

| Método | Rota | Descrição |
|--------|------|-----------|
| GET / POST | `/api/auth/[...nextauth]` | Handler NextAuth (login, logout, session) |
| POST | `/api/register` | Cria conta de usuário |
| GET | `/api/products` | Lista produtos do usuário autenticado |
| POST | `/api/products` | Cria produto (`name`, `price > 0`, `cost > 0`) |
| POST | `/api/sales` | Registra venda com snapshot do preço atual do produto |
| GET | `/api/sales/today` | Vendas do dia atual + total em reais |

---

## Autenticação

NextAuth.js com Credentials Provider (email + senha com bcrypt). Estratégia JWT — sem sessão armazenada no banco.

```mermaid
sequenceDiagram
    actor Usuário
    participant Login as /login
    participant NextAuth as NextAuth Handler
    participant DB as PostgreSQL

    Usuário->>Login: email + senha
    Login->>NextAuth: POST /api/auth/signin
    NextAuth->>DB: busca usuário por email
    DB-->>NextAuth: User { password: hash }
    NextAuth->>NextAuth: bcrypt.compare(senha, hash)
    alt credenciais válidas
        NextAuth-->>Login: JWT session cookie
        Login-->>Usuário: redirect → /dashboard
    else credenciais inválidas
        NextAuth-->>Login: erro de autenticação
    end
```

Rotas protegidas pelo middleware: `/dashboard`, `/products`. Usuários não autenticados são redirecionados para `/login`.

---

## Estrutura de Pastas

```
sistema-lanches/
├── prisma/
│   └── schema.prisma              # Modelos: User, Product, Sale
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/             # Página de login
│   │   │   └── register/          # Página de cadastro
│   │   ├── dashboard/
│   │   │   ├── page.tsx           # Botões de produto + total do dia
│   │   │   └── actions.ts         # Server Action: registerSale
│   │   ├── products/
│   │   │   ├── page.tsx           # Lista de produtos
│   │   │   └── new/page.tsx       # Formulário de criação
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── products/route.ts
│   │       ├── register/route.ts
│   │       └── sales/
│   │           ├── route.ts
│   │           └── today/route.ts
│   ├── lib/
│   │   ├── prisma.ts              # Singleton PrismaClient
│   │   ├── auth.ts                # Config NextAuth
│   │   └── totals.ts              # calcularTotalDia() — função pura
│   ├── middleware.ts               # withAuth — proteção de rotas
│   └── __tests__/
│       ├── setup.ts                # Mock global do Prisma
│       ├── api/
│       │   ├── products.test.ts
│       │   └── sales.test.ts
│       └── lib/
│           └── totals.test.ts
├── .env.example                    # Template de variáveis de ambiente
├── docs/
│   └── superpowers/
│       ├── specs/                  # Design docs de cada sprint
│       └── plans/                  # Planos de implementação
└── CLAUDE.md                       # Referência técnica para agentes de IA
```

---

## Testes

```bash
npm test                                                    # todos os testes
npm run test:watch                                          # modo watch
npx vitest run src/__tests__/lib/totals.test.ts            # arquivo específico
```

| Arquivo | O que cobre |
|---------|-------------|
| `api/products.test.ts` | GET (filtro por usuário) e POST (validação + criação) |
| `api/sales.test.ts` | POST (snapshot de preço) e GET /today (filtro de data + soma) |
| `lib/totals.test.ts` | `calcularTotalDia()` — função pura, sem mock |

O Prisma é mockado globalmente em `src/__tests__/setup.ts`. Nenhum teste requer banco de dados real.

---

## Roadmap

| Sprint | Status | Funcionalidades |
|--------|--------|----------------|
| Sprint 1 | ✅ Concluído | Login, cadastro, produtos, registro de vendas com 1 toque, total do dia |
| Sprint 2 | 🔜 Planejado | Controle de estoque, gestão de gastos, relatório de lucro diário/mensal, exportação PDF |

---

## Deploy

**1. Banco de dados** — criar instância no [Neon](https://neon.tech) ou Vercel Postgres e copiar a `DATABASE_URL`.

**2. Aplicação** — importar o repositório no [Vercel](https://vercel.com), configurar as variáveis de ambiente (`DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`) e fazer deploy.
````

- [ ] **Step 2: Verify the file looks correct**

```bash
wc -l README.md
```

Expected: ~175–200 lines.

```bash
grep "mermaid" README.md | wc -l
```

Expected: `3` (three Mermaid code blocks).

- [ ] **Step 3: Run tests to confirm nothing broke**

```bash
npm test
```

Expected: `22 passed (22)` — README is documentation only, no code changed.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README with architecture diagrams, setup guide, and roadmap"
```

---

### Task 4: Open a Pull Request

**Files:** none

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feature/readme
```

- [ ] **Step 2: Open PR**

```bash
gh pr create \
  --title "docs: rewrite README with full developer reference" \
  --body "$(cat <<'EOF'
## Summary

- Replaces the default Next.js README boilerplate with a complete developer reference in pt-BR
- Adds Mermaid diagrams for architecture, ER model, and auth flow
- Adds `.env.example` for onboarding
- Commits the README redesign spec from the brainstorm session

## Test plan

- [ ] Verify all 22 tests pass on CI
- [ ] Open the PR on GitHub and confirm Mermaid diagrams render correctly in the three code blocks (architecture flowchart, ER diagram, auth sequence diagram)
- [ ] Follow the Setup Local steps from scratch in a clean environment to verify they work end-to-end

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**Spec coverage check:**

| Spec section | Task |
|---|---|
| Sobre o projeto | Task 3 — README section 1 |
| Tech Stack | Task 3 — README section 2 |
| Pré-requisitos | Task 3 — README section 3 |
| Setup local (env + docker + migrate + dev) | Task 3 — README section 4 |
| Arquitetura (Mermaid flowchart) | Task 3 — README section 5 |
| Modelo de dados (Mermaid ER) | Task 3 — README section 6 |
| API Endpoints table | Task 3 — README section 7 |
| Autenticação (Mermaid sequence) | Task 3 — README section 8 |
| Estrutura de pastas | Task 3 — README section 9 |
| Testes | Task 3 — README section 10 |
| Roadmap | Task 3 — README section 11 |
| Deploy | Task 3 — README section 12 |
| `.env.example` (referenced in setup) | Task 2 |
| Spec doc untracked | Task 1 |

**Placeholder scan:** No TBD, no TODO, no vague steps. All steps include exact commands and complete file content. ✅

**Type/name consistency:** No code types involved — documentation only. ✅
