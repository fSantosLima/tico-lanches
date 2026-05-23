# Sistema de Gestão de Lanches — Sprint 1 Design

## Contexto

Vendedores autônomos de lanches (persona: vendedor ambulante em bicicleta, baixa familiaridade com tecnologia) perdem controle financeiro e cometem erros manuais sem uma ferramenta adequada. Este sistema resolve o problema central: registrar vendas de forma rápida e ver o resultado do dia imediatamente.

O Sprint 1 entrega o fluxo principal validável: login → cadastrar produtos → registrar vendas com 1 toque → ver total do dia. Estoque, gastos, relatórios e exportação PDF ficam para o Sprint 2.

---

## Decisões de Arquitetura

- **Next.js 14 (App Router)** — frontend + API Routes no mesmo projeto. Elimina a necessidade de backend separado.
- **Tailwind CSS** — estilização mobile-first.
- **PostgreSQL + Prisma** — banco relacional com ORM tipado.
- **NextAuth.js com Credentials Provider** — autenticação com email e senha (bcrypt). Sem OAuth externo.
- **Deploy:** Vercel (app) + Neon ou Vercel Postgres (banco gerenciado).
- **Testes unitários:** Vitest testando lógica de API e funções de cálculo. Sem testes de componentes React no Sprint 1.

---

## Estrutura de Pastas

```
src/
  app/
    (auth)/
      login/page.tsx
      register/page.tsx
    dashboard/page.tsx
    products/
      page.tsx
      new/page.tsx
    api/
      auth/[...nextauth]/route.ts
      products/route.ts
      sales/route.ts
      sales/today/route.ts
  lib/
    prisma.ts        # singleton do PrismaClient
    auth.ts          # configuração do NextAuth
  __tests__/
    api/products.test.ts
    api/sales.test.ts
    lib/totals.test.ts
```

---

## Modelo de Dados (Prisma)

```prisma
model User {
  id        String    @id @default(uuid())
  email     String    @unique
  name      String?
  password  String    // bcrypt hash
  products  Product[]
  sales     Sale[]
  createdAt DateTime  @default(now())
}

model Product {
  id        String   @id @default(uuid())
  name      String
  price     Float    // preço de venda
  cost      Float    // custo de produção
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  sales     Sale[]
  createdAt DateTime @default(now())
}

model Sale {
  id        String   @id @default(uuid())
  productId String
  product   Product  @relation(fields: [productId], references: [id])
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  value     Float    // snapshot do preço no momento da venda
  createdAt DateTime @default(now())
}
```

`Sale.value` armazena o preço no momento da venda para que edições futuras no produto não alterem o histórico financeiro.

---

## Páginas

| Rota | Descrição |
|---|---|
| `/login` | Formulário email + senha. Redireciona para `/dashboard` após autenticação. |
| `/register` | Criação de conta. Redireciona para `/login`. |
| `/dashboard` | Tela principal: total do dia no topo, botões grandes por produto. |
| `/products` | Lista de produtos do usuário com link para criar novo. |
| `/products/new` | Formulário: nome, preço de venda, custo. |

---

## API Routes

| Endpoint | Método | Comportamento |
|---|---|---|
| `/api/auth/[...nextauth]` | GET/POST | Handler NextAuth (login, logout, session). |
| `/api/products` | GET | Retorna produtos do usuário autenticado. |
| `/api/products` | POST | Cria produto. Valida: `price > 0`, `cost > 0`, `name` obrigatório. |
| `/api/sales` | POST | Registra venda. Grava `value` como snapshot do preço atual do produto. |
| `/api/sales/today` | GET | Retorna vendas do dia atual + soma total em reais. |

Todas as rotas (exceto auth) exigem sessão ativa. Retornam 401 se não autenticado.

---

## Fluxo Principal — Registrar Venda

1. Usuário abre `/dashboard` → Next.js carrega produtos via `GET /api/products`.
2. Usuário toca no botão de um produto.
3. Frontend chama `POST /api/sales` com `{ productId }`.
4. API valida sessão, busca preço atual do produto, persiste `Sale` com `value` = preço.
5. Dashboard revalida e atualiza o total do dia via **Server Action** com `revalidatePath('/dashboard')`.

---

## Tratamento de Erros

| Situação | Comportamento |
|---|---|
| Produto sem preço cadastrado | Botão desabilitado no dashboard |
| Falha na API ao registrar venda | Toast de erro, venda não contabilizada |
| Sessão expirada | Redirect automático para `/login` |
| Campos inválidos no formulário | Mensagem de erro inline no campo |

---

## Testes Unitários (Vitest)

- `products.test.ts` — testa `GET /api/products` (lista filtrada por usuário) e `POST /api/products` (validação de campos e criação).
- `sales.test.ts` — testa `POST /api/sales` (snapshot de preço) e `GET /api/sales/today` (filtro por data e soma de totais).
- `totals.test.ts` — testa função pura `calcularTotalDia(sales[])` que soma `value` das vendas.

Prisma é mockado nos testes de API para isolamento. A função `calcularTotalDia` é testada sem mock (é pura).

---

## Fora do Escopo (Sprint 2+)

- Controle de estoque
- Gestão de gastos
- Relatórios de lucro diário/mensal
- Exportação PDF
- Multi-usuários / SaaS
