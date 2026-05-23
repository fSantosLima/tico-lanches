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
