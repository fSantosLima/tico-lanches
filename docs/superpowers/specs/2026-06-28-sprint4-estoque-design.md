# Sprint 4 — Controle de Estoque de Produtos Vendáveis

**Data:** 2026-06-28
**Status:** Design aprovado (aguardando revisão do spec escrito)

## Contexto

O sistema já controla faturamento (`Sale`), gastos operacionais (`Expense`) e o relatório de
lucro real (Sprint 3, em `main`). O próximo passo do backlog ("Fora de Escopo (Sprint 4+)" do
spec de relatórios) é **controle de estoque**.

"Estoque" abrange dois subsistemas distintos — **produtos vendáveis** e **insumos/ingredientes**.
Eles têm modelos de dados e fluxos diferentes, então foram decompostos em duas sprints:

- **Sprint 4 (este spec):** estoque dos **produtos vendáveis** (`Product`). Conecta direto ao
  modelo atual: a venda (`Sale`) já é a saída do estoque.
- **Sprint 5 (futuro):** estoque de **insumos/ingredientes** (entidade nova, entradas por compra;
  pode ganhar receita/ficha técnica ligando insumo → produto).

## Objetivo

Permitir ao usuário saber **quanto tem em estoque de cada produto vendável**, registrar
**entradas (reposições)** e ser **avisado quando o estoque está baixo**.

## Decisões de produto (confirmadas no brainstorming)

1. **Modelo "entradas + vendas como saída".** Uma entidade nova registra apenas *entradas*
   (reposições e saldo inicial). O saldo é derivado:
   `saldo = (soma das entradas) − (soma das vendas em Sale)`. Sem saída explícita e sem dupla
   contagem — a venda já é o registro de saída.
2. **Lançar venda NÃO bloqueia por falta de estoque.** O saldo pode ficar negativo; nesse caso
   é exibido como alerta (vermelho), mas a venda é sempre registrada. Lançamento é agregado de
   fim de dia; acoplar os dois fluxos complicaria sem ganho real.
3. **Editar/remover uma venda ajusta o saldo automaticamente**, porque o saldo é derivado de
   `Sale` em tempo de leitura.
4. **Alerta de estoque baixo com mínimo por produto**, exibido tanto na página de estoque quanto
   no dashboard.
5. **Status "baixo" quando `mínimo > 0` e `saldo ≤ mínimo`** (menor ou igual). Mínimo 0
   (default) **não** gera alerta de baixo — só saldo negativo alerta. Assim produtos que o
   usuário ainda não controla não poluem o dashboard; para alertar em saldo 0, basta definir
   mínimo ≥ 1.
6. **Estoque mínimo editável inline** na página de estoque (além de poder ser definido na
   criação do produto).

## Modelo de dados (migration Prisma)

### Nova entidade `StockEntry`

```prisma
model StockEntry {
  id        String   @id @default(uuid())
  productId String
  product   Product  @relation(fields: [productId], references: [id])
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  date      DateTime @db.Date
  quantity  Int
  note      String?
  createdAt DateTime @default(now())

  @@index([userId, date])
}
```

- `quantity` é inteiro (> 0). Saldo inicial é apenas a primeira entrada, opcionalmente com
  `note = "Saldo inicial"`. Não há tipo/enum de entrada — manter simples.
- Relações inversas adicionadas: `User.stockEntries StockEntry[]` e
  `Product.stockEntries StockEntry[]`.

### Campo novo em `Product`

```prisma
minStock Int @default(0)   // estoque mínimo para alerta
```

`@default(0)` cobre os produtos existentes sem necessidade de backfill (mínimo 0 ⇒ só alerta em
saldo negativo até o usuário definir um mínimo).

## Lógica pura — `src/lib/estoque.ts`

Função pura e auto-contida, no estilo de `src/lib/relatorio.ts` / `src/lib/totals.ts`
(sem acesso a banco; recebe arrays e devolve o agregado):

```ts
export interface EstoqueProductInput { id: string; name: string; minStock: number }
export interface EstoqueEntry { productId: string; quantity: number }
export interface EstoqueSale  { productId: string; quantity: number }

export type EstoqueStatus = 'ok' | 'baixo' | 'negativo'

export interface EstoqueProduto {
  productId: string
  nome: string
  entradas: number   // soma das entradas
  vendido: number    // soma das vendas (Sale.quantity)
  saldo: number      // entradas − vendido
  minimo: number     // minStock do produto
  status: EstoqueStatus
}

export function calcularEstoque(
  products: EstoqueProductInput[],
  entries: EstoqueEntry[],
  sales: EstoqueSale[],
): EstoqueProduto[]
```

Regras de `status`:
- `negativo` quando `saldo < 0`;
- senão `baixo` quando `minimo > 0 && saldo <= minimo`;
- senão `ok`.

Consequência do `minimo > 0`: um produto sem movimentação (saldo 0, mínimo 0) fica `ok`, não
`baixo` — não aparece no alerta até o usuário definir um mínimo ≥ 1.

Ordenação de saída: produtos em alerta primeiro (`negativo`, depois `baixo`), depois `ok`;
dentro do mesmo grupo, por nome. (Detalhe de apresentação — pode ser ajustado na implementação.)

## Telas e fluxo

### Nova rota `/estoque` (protegida)

- Lista cada produto com **saldo atual**, **estoque mínimo** e **badge de status**
  (verde "OK" / vermelho "Baixo" ou "Negativo").
- **Registrar entrada:** formulário com produto (select), quantidade (inteiro > 0), data
  (`DateInput`, ≤ hoje) e nota opcional. Server Action `registrarEntrada`.
- **Lista de entradas recentes** com botão **Remover** (Server Action `removerEntrada`).
- **Ajuste do mínimo inline** por produto (Server Action `definirEstoqueMinimo`).
- Segue o visual das páginas existentes (cards arredondados, dark mode, laranja de destaque).

### Dashboard

- Novo **card de alerta de estoque baixo**: lista os produtos com status `baixo`/`negativo`,
  com link para `/estoque`. **Só aparece quando há algum produto em alerta.**

### Criação de produto

- Campo opcional **"estoque mínimo"** (inteiro ≥ 0, default 0) em
  `src/app/(protected)/products/new/page.tsx` e no `POST /api/products`.

### Navegação e proteção

- **Sidebar:** novo link "Estoque" (`src/components/Sidebar.tsx`).
- **proxy.ts:** adicionar `/estoque` às rotas protegidas.

## Server Actions

Mesmo padrão de `src/app/(protected)/gastos/actions.ts` (`getServerSession` + validação +
`revalidatePath`):

- `registrarEntrada(prevState, formData)` → valida auth, produto pertence ao usuário,
  `quantity` inteiro > 0, `date` ≤ hoje. Cria `StockEntry`. Erro via `{ error }`.
- `removerEntrada(id)` → `deleteMany({ where: { id, userId } })`; lança se `count === 0`.
- `definirEstoqueMinimo(productId, minStock)` → valida auth + propriedade + inteiro ≥ 0;
  `updateMany({ where: { id, userId }, data: { minStock } })`.

Todas as queries incluem `userId: session.user.id`, conforme regra do projeto.

## Tratamento de erros

- Campos ausentes/ inválidos → mensagem de erro no formulário (`{ error }`), sem persistir.
- Produto inexistente ou de outro usuário → erro "não autorizado/encontrado" (escopo por
  `userId` no `where`).
- Saldo negativo **não é erro** — é exibido como alerta.

## Testes

Vitest com `jsdom`; Prisma mockado globalmente em `src/__tests__/setup.ts` (sem banco real):

- `src/__tests__/lib/estoque.test.ts` — `calcularEstoque`: lista vazia; só entradas; só vendas;
  saldo zero com `minStock = 0` (deve ser `ok`, não `baixo`); saldo negativo (deve ser
  `negativo` mesmo com `minStock = 0`); limite `saldo == minimo` com `minStock > 0` (deve ser
  `baixo`); `saldo == minimo - 1` (deve ser `baixo`); `saldo > minimo` (deve ser `ok`);
  múltiplos produtos; ordenação por status/nome; produto sem entradas nem vendas.
- `src/__tests__/.../estoque.actions.test.ts` — `registrarEntrada` / `removerEntrada` /
  `definirEstoqueMinimo`: auth ausente, validações (qtd ≤ 0, não inteiro, data futura,
  mínimo negativo), produto de outro usuário, e persistência feliz.

## Arquivos afetados (resumo)

- **Migration + schema:** `prisma/schema.prisma` (+ `StockEntry`, `Product.minStock`, relações).
- **Novo:** `src/lib/estoque.ts`, `src/app/(protected)/estoque/page.tsx`,
  `src/app/(protected)/estoque/actions.ts`, componentes de formulário/lista da página.
- **Editados:** `src/components/Sidebar.tsx`, `src/proxy.ts`,
  `src/app/(protected)/dashboard/page.tsx`, `src/app/(protected)/products/new/page.tsx`,
  `src/app/api/products/route.ts`.
- **Docs:** `README.md` (roadmap → Sprint 4), `CLAUDE.md` (nova rota/entidade).

## Fora de escopo (Sprint 5+)

- Estoque de **insumos/ingredientes** (Sprint 5).
- Receita / ficha técnica ligando insumo → produto.
- **Valoração de estoque** (saldo × custo do produto) como KPI.
- Relatório/histórico de movimentação de estoque.
- Exportação (PDF/CSV) do estoque.
- Bloquear o lançamento de vendas por falta de estoque.
