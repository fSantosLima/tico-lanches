# Sistema de Gestão de Lanches

Ferramenta mobile-first para vendedores autônomos de lanches lançarem as vendas do dia por quantidade e acompanharem faturamento e lucro estimado em tempo real.

O fluxo principal: criar conta → cadastrar produtos → lançar quantidades vendidas ao final do expediente → ver faturamento e lucro do dia.

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
| Date Picker | react-datepicker + date-fns (locale pt-BR) |
| Gráficos | Recharts |

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
    Browser -->|request| Proxy["src/proxy.ts\n(withAuth)"]
    Proxy -->|autenticado| AppRouter["App Router"]
    Proxy -->|não autenticado| Login["/login"]
    AppRouter --> Dashboard["/dashboard"]
    AppRouter --> Lancamento["/lancamento"]
    AppRouter --> Products["/products"]
    AppRouter --> Gastos["/gastos"]
    AppRouter --> Relatorios["/relatorios"]
    AppRouter --> API["API Routes\n/api/*"]
    API --> Prisma["PrismaClient\nsrc/lib/prisma.ts"]
    Prisma --> DB[("PostgreSQL")]
```

- `src/proxy.ts` usa `withAuth` do NextAuth para proteger `/dashboard`, `/products`, `/lancamento`, `/gastos` e `/relatorios`
- Server Actions (ex: `salvarLancamento`) validam sessão via `getServerSession` antes de qualquer operação
- O singleton do PrismaClient usa o driver adapter `@prisma/adapter-pg` (não a conexão TCP padrão)

---

## Modelo de Dados

```mermaid
erDiagram
    User {
        String id PK
        String email UK
        String name "opcional"
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
        DateTime date "apenas a data (sem hora)"
        Int quantity
        Float unitPrice
        Float unitCost
        DateTime createdAt
        DateTime updatedAt
    }
    Expense {
        String id PK
        String userId FK
        DateTime date "apenas a data (sem hora)"
        String category
        String description
        Float quantity
        String unit
        Float value
        DateTime createdAt
    }

    User ||--o{ Product : "possui"
    User ||--o{ Sale : "registra"
    User ||--o{ Expense : "registra"
    Product ||--o{ Sale : "é vendido em"
```

> `Sale` é um agregado por produto/dia — 1 linha por produto por data. `(userId, productId, date)` é único. `unitPrice` e `unitCost` são snapshots tirados no momento do lançamento; edições futuras de preço não afetam o histórico.
>
> `Expense` registra gastos operacionais (ingredientes, descartáveis, etc.) por data, com categoria, descrição, quantidade e valor.

---

## API Endpoints

Todas as rotas (exceto `/api/auth/*` e `/api/register`) exigem sessão ativa e retornam `401` se não autenticado.

| Método | Rota | Descrição |
|--------|------|-----------|
| GET / POST | `/api/auth/[...nextauth]` | Handler NextAuth (login, logout, session) |
| POST | `/api/register` | Cria conta de usuário |
| GET | `/api/products` | Lista produtos do usuário autenticado |
| POST | `/api/products` | Cria produto (`name`, `price > 0`, `cost > 0`) |
| GET | `/api/sales/today` | Vendas do dia atual + `{ faturamento, lucro }` |

> `POST /api/sales` foi removido. Lançamentos são feitos via Server Action `salvarLancamento` em `/lancamento/actions.ts`.

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

Rotas protegidas por `src/proxy.ts`: `/dashboard`, `/products`, `/lancamento`, `/gastos`, `/relatorios`. Usuários não autenticados são redirecionados para `/login`.

---

## Estrutura de Pastas

```
sistema-lanches/
├── prisma/
│   ├── schema.prisma              # Modelos: User, Product, Sale (agregado por dia)
│   └── migrations/                # Histórico de migrations SQL
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/             # Página de login
│   │   │   └── register/          # Página de cadastro
│   │   ├── (protected)/
│   │   │   ├── dashboard/
│   │   │   │   ├── page.tsx       # Card de hoje + botão lançar + dias anteriores
│   │   │   │   └── LogoutButton.tsx
│   │   │   ├── lancamento/
│   │   │   │   ├── page.tsx       # Server Component: carrega produtos e lançamentos do dia
│   │   │   │   ├── LancamentoForm.tsx  # Client Component: − / + com totais ao vivo
│   │   │   │   ├── DatePicker.tsx  # Client Component: seletor de data (react-datepicker, pt-BR)
│   │   │   │   └── actions.ts     # Server Action: salvarLancamento
│   │   │   ├── gastos/
│   │   │   │   ├── page.tsx       # Server Component: filtro, formulário e lista de gastos
│   │   │   │   └── actions.ts     # Server Actions: adicionarGasto, removerGasto
│   │   │   ├── relatorios/
│   │   │   │   ├── page.tsx       # Server Component: período, KPIs, abas Resumo/Gráficos
│   │   │   │   ├── FiltroPeriodo.tsx  # Client Component: presets + intervalo De/Até
│   │   │   │   ├── Tabs.tsx       # Abas Resumo / Gráficos (links na URL)
│   │   │   │   ├── GraficoRosca.tsx   # Client Component: rosca de gastos por categoria (Recharts)
│   │   │   │   └── GraficoLinha.tsx   # Client Component: linha de lucro real por semana (Recharts)
│   │   │   └── products/
│   │   │       ├── page.tsx       # Lista de produtos
│   │   │       └── new/page.tsx   # Formulário de criação
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── products/route.ts
│   │       ├── register/route.ts
│   │       └── sales/
│   │           ├── route.ts       # (tombstone — POST removido)
│   │           └── today/route.ts # GET: vendas do dia + faturamento + lucro
│   ├── components/
│   │   ├── Sidebar.tsx            # Navegação lateral
│   │   ├── ThemeToggle.tsx        # Botão claro/escuro
│   │   └── DateInput.tsx          # Client Component: input de data com react-datepicker (pt-BR)
│   ├── lib/
│   │   ├── prisma.ts              # Singleton PrismaClient (driver adapter pg)
│   │   ├── auth.ts                # Config NextAuth
│   │   ├── totals.ts              # calcularResumo() — faturamento + lucro
│   │   ├── periodo.ts             # resolverPeriodo() + intervaloPreset() — período do relatório
│   │   └── relatorio.ts           # calcularRelatorio() — faturamento × gastos, lucro real, por semana
│   ├── proxy.ts                   # withAuth — proteção de rotas
│   └── __tests__/
│       ├── setup.ts               # Mock global do Prisma
│       ├── actions/
│       │   ├── salvarLancamento.test.ts
│       │   ├── adicionarGasto.test.ts
│       │   └── removerGasto.test.ts
│       ├── api/
│       │   ├── products.test.ts
│       │   ├── sales.test.ts
│       │   └── register.test.ts
│       └── lib/
│           ├── totals.test.ts
│           ├── periodo.test.ts
│           └── relatorio.test.ts
├── .env.example                   # Template de variáveis de ambiente
├── docs/
│   └── superpowers/
│       ├── specs/                 # Design docs de cada sprint
│       └── plans/                 # Planos de implementação
└── CLAUDE.md                      # Referência técnica para agentes de IA
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
| `actions/salvarLancamento.test.ts` | Auth, upsert com snapshot, quantity=0 remove, validação de data futura/negativo/decimal, isolamento por userId |
| `actions/adicionarGasto.test.ts` | Auth, validação de data futura, valor/quantidade <= 0, campos ausentes, persistência com userId |
| `actions/removerGasto.test.ts` | Auth, gasto inexistente, gasto de outro usuário, deleção bem-sucedida |
| `api/products.test.ts` | GET (filtro por usuário) e POST (validação + criação) |
| `api/register.test.ts` | POST /api/register — criação de conta e validação de duplicatas |
| `api/sales.test.ts` | GET /api/sales/today — 401, faturamento+lucro calculados, zeros sem vendas |
| `lib/totals.test.ts` | `calcularResumo()` — lista vazia, faturamento, lucro, margem zero |
| `lib/periodo.test.ts` | `resolverPeriodo()` / `intervaloPreset()` — presets, default, intervalo invertido, datas inválidas/impossíveis, virada de ano |
| `lib/relatorio.test.ts` | `calcularRelatorio()` — faturamento/gastos, lucro real (incl. negativo/zero), margem (divisão por zero), gastos por categoria, agrupamento por semana (limites, semanas vazias, virada de mês), consistência |

O Prisma é mockado globalmente em `src/__tests__/setup.ts`. Nenhum teste requer banco de dados real. **76 testes, 9 arquivos.**

---

## Roadmap

| Sprint | Status | Funcionalidades |
|--------|--------|----------------|
| Sprint 1 | ✅ Concluído | Login, cadastro, produtos, lançamento por quantidade, faturamento + lucro do dia, dark mode, responsivo |
| Sprint 2 | ✅ Concluído | Seletor de data no lançamento (react-datepicker, pt-BR), gestão de gastos com filtro por período e agrupamento por categoria |
| Sprint 3 | ✅ Concluído | Relatório de lucro real em `/relatorios`: cruza faturamento × gastos reais por período (presets + intervalo livre), com aba Resumo (KPIs + gastos por categoria) e aba Gráficos (rosca + linha por semana, Recharts) |
| Sprint 4 | ✅ Concluído | Controle de estoque de produtos vendáveis em `/estoque`: saldo = entradas − vendas, registro de entradas/reposições, estoque mínimo por produto e alerta de estoque baixo no dashboard |
| Sprint 5 | ✅ Concluído | Insumos e ficha técnica: cadastro de insumos com unidade e custo, estoque de insumos (entradas de compra, saldo = entradas − consumo derivado das vendas), receita insumo→produto na página do produto, custo real por produto e alerta de insumos em falta no dashboard |

---

## Deploy

**1. Banco de dados** — criar instância no [Neon](https://neon.tech) ou Vercel Postgres e copiar a `DATABASE_URL`.

**2. Aplicação** — importar o repositório no [Vercel](https://vercel.com), configurar as variáveis de ambiente (`DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`) e fazer deploy.
