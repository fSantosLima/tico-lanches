# Sprint 5 — Insumos, Estoque de Insumos e Ficha Técnica

**Data:** 2026-07-12
**Status:** Design aprovado (aguardando revisão do spec escrito)

## Contexto

O sistema já controla faturamento (`Sale`), gastos operacionais (`Expense`), lucro real
(Sprint 3) e estoque dos **produtos vendáveis** (Sprint 4, já em `main` via PR #8). O
próximo passo do backlog é o segundo subsistema de estoque previsto no spec da Sprint 4:
**insumos/ingredientes**.

Diferente dos produtos — cuja saída é a própria venda (`Sale`) — insumos não são vendidos
diretamente. A saída de insumo é o **consumo derivado da receita** (ficha técnica): ao vender
um produto, consomem-se os insumos que o compõem, na proporção definida pela receita.

## Objetivo

Permitir ao usuário:
1. **Cadastrar insumos** (nome, unidade de medida, custo unitário, estoque mínimo).
2. **Registrar entradas por compra** e ver o **saldo físico** de cada insumo, com alerta de
   estoque baixo — espelhando o fluxo da Sprint 4.
3. **Montar a ficha técnica** de cada produto (quais insumos e em que quantidade), de modo que
   o **consumo de insumo seja derivado automaticamente das vendas**.
4. Ver o **custo real por produto** derivado da receita (informativo), ao lado do custo manual.

## Decisões de produto (confirmadas no brainstorming)

1. **Escopo:** cadastro + estoque de insumos **e** ficha técnica com consumo derivado, tudo
   numa sprint.
2. **Entrada de insumo é só quantidade física.** A compra **não** carrega valor financeiro nem
   entra no lucro real — o dinheiro continua sendo lançado em **Gastos** (categoria
   `Ingredientes`), como hoje. Isso evita dupla contagem e mantém o relatório da Sprint 3
   intacto.
3. **Custo unitário do insumo é um campo próprio** (`Insumo.cost`), definido no cadastro e
   editável. Serve apenas para calcular o **custo real por produto**.
4. **Custo real por produto é informativo.** É exibido na página do produto ao lado do custo
   manual (`Product.cost`), **sem** sobrescrevê-lo e **sem** entrar no relatório de lucro real.
   `Product.cost` continua sendo o snapshot manual usado em `Sale.unitCost`.
5. **Saldo derivado em tempo de leitura** (mesmo modelo da Sprint 4): não há tabela de saldo
   materializado. `saldo do insumo = Σ entradas − Σ consumo derivado`. Consequência: editar ou
   remover uma venda ajusta o consumo (e o saldo) automaticamente.
6. **Sem baixa/desperdício manual nesta sprint.** O saldo é puramente `entradas − consumo
   derivado`; correções são feitas removendo uma entrada.
7. **Sem conversão de unidades.** A quantidade na receita é sempre expressa **na unidade do
   insumo** (insumo em `kg` ⇒ receita em `kg`).
8. **Alerta de estoque baixo** com a **mesma regra da Sprint 4**: `negativo` se saldo < 0;
   `baixo` se `mínimo > 0 && saldo ≤ mínimo`; senão `ok`. Mínimo 0 (default) **não** gera
   alerta de baixo (só saldo negativo alerta).
9. **Ficha técnica fica na página do produto** (nova rota de detalhe `/products/[id]`).
10. **Dashboard ganha um card separado** "Insumos em falta" (além do card de estoque de
    produtos da Sprint 4), aparecendo só quando houver insumo em alerta.

## Modelo de dados (migration Prisma)

Três entidades novas, todas escopadas a `userId`.

### `Insumo`

```prisma
model Insumo {
  id          String        @id @default(uuid())
  name        String
  unit        String        // unidade de medida: un, g, kg, ml, L
  cost        Float         // custo por unidade (informativo, p/ custo real)
  minStock    Float         @default(0)
  userId      String
  user        User          @relation(fields: [userId], references: [id])
  entries     InsumoEntry[]
  recipeItems RecipeItem[]
  createdAt   DateTime      @default(now())
}
```

### `InsumoEntry` (entrada de compra — só física)

```prisma
model InsumoEntry {
  id        String   @id @default(uuid())
  insumoId  String
  insumo    Insumo   @relation(fields: [insumoId], references: [id])
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  date      DateTime @db.Date
  quantity  Float
  note      String?
  createdAt DateTime @default(now())

  @@index([userId, date])
}
```

Espelha `StockEntry`, mas `quantity` é `Float` (ex.: 0,15 kg; 1,5 L) e **não** carrega valor.

### `RecipeItem` (item da ficha técnica de um produto)

```prisma
model RecipeItem {
  id        String   @id @default(uuid())
  productId String
  product   Product  @relation(fields: [productId], references: [id])
  insumoId  String
  insumo    Insumo   @relation(fields: [insumoId], references: [id])
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  quantity  Float    // consumo do insumo por unidade de produto
  createdAt DateTime @default(now())

  @@unique([productId, insumoId]) // cada insumo aparece uma vez por produto
}
```

### Relações inversas adicionadas

- `User`: `insumos Insumo[]`, `insumoEntries InsumoEntry[]`, `recipeItems RecipeItem[]`.
- `Product`: `recipeItems RecipeItem[]`.

Nenhum backfill necessário — entidades novas, produtos existentes simplesmente não têm receita
(consumo 0) até o usuário montar a ficha.

## Lógica pura — `src/lib/insumos.ts`

Funções puras e auto-contidas (sem acesso a banco; recebem arrays e devolvem o agregado), no
estilo de `src/lib/estoque.ts` / `src/lib/relatorio.ts`.

```ts
import { EstoqueStatus } from './stockStatus' // 'ok' | 'baixo' | 'negativo' (tipo movido p/ o helper)

export interface InsumoInput { id: string; name: string; unit: string; cost: number; minStock: number }
export interface InsumoEntradaInput { insumoId: string; quantity: number }
export interface ReceitaItemInput { productId: string; insumoId: string; quantity: number }
export interface VendaInput { productId: string; quantity: number }

export interface InsumoSaldo {
  insumoId: string
  nome: string
  unidade: string
  entradas: number   // soma das entradas
  consumido: number  // Σ (venda.quantity × quantidade do insumo na receita do produto)
  saldo: number      // entradas − consumido
  minimo: number
  status: EstoqueStatus
}

export function calcularEstoqueInsumos(
  insumos: InsumoInput[],
  entradas: InsumoEntradaInput[],
  receitas: ReceitaItemInput[],
  vendas: VendaInput[],
): InsumoSaldo[]

export interface CustoRealItem {
  insumoId: string
  nome: string
  unidade: string
  quantidade: number    // quantidade na receita
  custoUnitario: number // Insumo.cost
  subtotal: number      // quantidade × custoUnitario
}

export interface CustoRealProduto {
  productId: string
  custoReal: number        // Σ subtotais
  itens: CustoRealItem[]
}

export function calcularCustoReal(
  productId: string,
  itensReceita: ReceitaItemInput[],
  insumosPorId: Map<string, InsumoInput>,
): CustoRealProduto
```

**Consumo derivado** (`calcularEstoqueInsumos`): para cada venda `(productId, quantity)`,
somam-se, para cada `RecipeItem` daquele produto, `quantity × recipeItem.quantity` ao
`consumido` do insumo correspondente. Produtos sem receita consomem 0.

**Regra de `status`** (idêntica à Sprint 4): `negativo` se `saldo < 0`; senão `baixo` se
`minimo > 0 && saldo <= minimo`; senão `ok`. A regra (3 linhas) e o tipo `EstoqueStatus` são
**extraídos para um helper compartilhado** `src/lib/stockStatus.ts`
(`export type EstoqueStatus` + `statusEstoque(saldo, minimo)`), passando a ser usados tanto por
`estoque.ts` quanto por `insumos.ts`, sem duplicar a regra. `estoque.ts` é ajustado para
importar do helper em vez de declarar `statusDe`/`EstoqueStatus` localmente.

**Ordenação:** alerta primeiro (`negativo` → `baixo` → `ok`), depois por nome (pt-BR).

**Margem real** (`preço − custoReal`) é calculada na tela do produto; não precisa de campo.

## Telas e fluxo

### Nova rota `/insumos` (protegida) — espelha `/estoque`

- **Lista** de insumos com **saldo atual**, unidade, **estoque mínimo** e **badge de status**
  (verde "OK" / vermelho "Baixo" ou "Negativo").
- **Registrar entrada (compra):** insumo (select), quantidade (`Float` > 0), data (`DateInput`,
  ≤ hoje) e nota opcional. Server Action `registrarEntradaInsumo`.
- **Entradas recentes** com botão **Remover** (Server Action `removerEntradaInsumo`).
- **Editar mínimo e custo inline** por insumo (Server Actions `definirMinimoInsumo` e
  `definirCustoInsumo`) — o custo alimenta o custo real dos produtos.
- Segue o visual das páginas existentes (cards arredondados, dark mode, laranja de destaque).

### Nova rota `/insumos/new` (protegida)

- Formulário de **cadastro de insumo**: nome, unidade (**select** de opções comuns:
  `un`, `g`, `kg`, `ml`, `L`), custo (R$ ≥ 0) e estoque mínimo (≥ 0, default 0). Server Action
  `criarInsumo`. Espelha `/products/new` no visual (mas via Server Action, não `fetch`).

### Nova rota `/products/[id]` (protegida) — detalhe do produto + ficha técnica

- Cabeçalho com dados do produto (nome, preço, custo manual).
- Seção **"Ficha técnica"**: lista dos itens da receita (insumo, quantidade, unidade); adicionar
  item (select de insumo + quantidade > 0) e remover item. Server Actions
  `adicionarItemReceita`, `removerItemReceita`.
- Seção **"Custo real"**: custo real derivado (`calcularCustoReal`) + **margem real**
  (`preço − custo real`), exibidos ao lado do custo manual. **Informativo**, não sobrescreve
  `Product.cost`.
- Na lista `/products`, cada produto vira **link** para `/products/[id]`.

### Dashboard

- Novo **card "Insumos em falta"** (separado do card de estoque de produtos da Sprint 4):
  lista os insumos com status `baixo`/`negativo`, com link para `/insumos`. **Só aparece quando
  há algum insumo em alerta.**

### Navegação e proteção

- **Sidebar:** novo link "Insumos" (`src/components/Sidebar.tsx`), após "Estoque".
- **`proxy.ts`:** adicionar `/insumos` às rotas protegidas. (`/products/[id]` já é coberto pela
  proteção de `/products`.)

## Server Actions

Mesmo padrão de `src/app/(protected)/estoque/actions.ts` (`getServerSession` + validação +
`revalidatePath`); todas as queries incluem `userId: session.user.id`. Formulários retornam
`{ error }`; ações de remoção lançam erro.

- `criarInsumo(prevState, formData)` — valida auth, nome não vazio, `unit` na lista permitida,
  `cost ≥ 0`, `minStock ≥ 0`. Cria `Insumo`.
- `registrarEntradaInsumo(prevState, formData)` — valida auth, insumo pertence ao usuário,
  `quantity` (Float) > 0, `date` ≤ hoje, nota opcional. Cria `InsumoEntry`.
- `removerEntradaInsumo(id)` — `deleteMany({ where: { id, userId } })`; lança se `count === 0`.
- `definirMinimoInsumo(insumoId, formData)` — `minStock ≥ 0`; `updateMany` escopado.
- `definirCustoInsumo(insumoId, formData)` — `cost ≥ 0`; `updateMany` escopado.
- `adicionarItemReceita(prevState, formData)` — valida auth, produto **e** insumo pertencem ao
  usuário, `quantity` > 0; rejeita insumo duplicado na receita (`@@unique`). Cria `RecipeItem`.
- `removerItemReceita(id)` — `deleteMany({ where: { id, userId } })`; lança se `count === 0`.

**Revalidação:** entradas de insumo e mudanças de receita alteram saldo/consumo e custo real —
`revalidatePath` de `/insumos`, `/dashboard` e (para receita/custo) `/products/[id]` conforme o
que muda.

## Tratamento de erros

- Campos ausentes/inválidos → `{ error }` no formulário, sem persistir.
- Insumo/produto inexistente ou de outro usuário → erro "não encontrado" (escopo por `userId`
  no `where`).
- Insumo duplicado na receita de um produto → erro (garantido também por `@@unique`).
- Saldo negativo **não é erro** — é exibido como alerta.
- Sem conversão de unidade: a quantidade da receita é interpretada na unidade do insumo.

## Testes

Vitest com `jsdom`; Prisma mockado globalmente em `src/__tests__/setup.ts` (sem banco real):

- `src/__tests__/lib/insumos.test.ts` — `calcularEstoqueInsumos`: lista vazia; só entradas
  (consumo 0); consumo derivado de 1 produto/1 insumo; insumo usado em vários produtos; produto
  com vários insumos; saldo negativo (status `negativo` mesmo com mínimo 0); limite
  `saldo == mínimo` com `mínimo > 0` (deve ser `baixo`); `saldo == 0` com `mínimo == 0` (deve
  ser `ok`); venda de produto sem receita (consumo 0); ordenação por status/nome.
  `calcularCustoReal`: produto sem receita (custo 0); vários itens (soma dos subtotais); reflete
  o `cost` do insumo; detalhamento por item correto.
- `src/__tests__/actions/insumos.test.ts` — cada Server Action: auth ausente; validações
  (quantidade ≤ 0, custo/mínimo negativos, unidade inválida, data futura); recurso de outro
  usuário; insumo duplicado na receita; e caminho feliz (persistência).

## Arquivos afetados (resumo)

- **Migration + schema:** `prisma/schema.prisma` (+ `Insumo`, `InsumoEntry`, `RecipeItem`;
  relações inversas em `User` e `Product`).
- **Novo (lógica):** `src/lib/insumos.ts`; `src/lib/stockStatus.ts` (helper de status extraído,
  reusado por `estoque.ts`).
- **Novo (telas):** `src/app/(protected)/insumos/page.tsx`,
  `src/app/(protected)/insumos/new/page.tsx`, `src/app/(protected)/insumos/actions.ts` e
  componentes de formulário/lista; `src/app/(protected)/products/[id]/page.tsx` +
  componentes/actions da ficha técnica (`src/app/(protected)/products/[id]/actions.ts`).
- **Editados:** `src/components/Sidebar.tsx`, `src/proxy.ts`,
  `src/app/(protected)/dashboard/page.tsx` (card de insumos),
  `src/app/(protected)/products/page.tsx` (link para o detalhe),
  `src/lib/estoque.ts` (usar o helper de status compartilhado).
- **Docs:** `README.md` (roadmap → Sprint 5), `CLAUDE.md` (novas rotas/entidades/actions).

## Branch

Sprint 4 **já foi mergeada** na `main` remota (PR #8, `132efcd`). A `main` local está atrás.
No passo seguinte a este design:

```bash
git checkout main
git pull origin main                 # traz a Sprint 4 (estoque) para a main local
git checkout -b feature/sprint5-insumos
```

Assim a branch nasce com o card de estoque de produtos e o link "Estoque" da sidebar já
presentes, sem sobreposição com a Sprint 5.

## Fora de escopo (Sprint 6+)

- Baixa/desperdício manual de insumo (perda, validade).
- Conversão de unidades (comprar em `kg`, receita em `g`).
- Valor financeiro da compra de insumo entrando no lucro real (continua em Gastos).
- Custo real substituindo `Product.cost` ou entrando no relatório de lucro real.
- Histórico/relatório de movimentação de insumos e exportação (PDF/CSV).
- Bloquear o lançamento de vendas por falta de insumo.
