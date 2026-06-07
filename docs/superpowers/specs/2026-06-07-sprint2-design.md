# Sprint 2 — Seletor de Data + Gestão de Gastos

## Contexto

Sprint 1 entregou o fluxo principal completo: auth, produtos, lançamento por quantidade (−/+), dashboard com faturamento e lucro do dia + histórico dos últimos 7 dias.

Sprint 2 tem dois objetivos:

1. **Seletor de data no lançamento** — acabamento: o link "trocar data" em `/lancamento` está com `href="#"` desde o Sprint 1. Backend já suporta `?data=YYYY-MM-DD`; só falta o UI.
2. **Gestão de gastos** — feature principal: o vendedor compra suprimentos uma vez por semana (ingredientes, descartáveis, salgados prontos). Precisa registrar essas despesas de forma detalhada e consultá-las agrupadas por categoria com filtro de data. Gastos ficam numa tela própria, sem misturar com o faturamento diário do dashboard.

---

## Modelo de Dados

Novo model `Expense` adicionado ao schema Prisma. Nenhuma tabela existente é alterada.

```prisma
model Expense {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  date        DateTime @db.Date
  category    String   // "Ingredientes" | "Descartáveis" | "Salgados prontos" | "Outros"
  description String
  quantity    Float
  unit        String   // ex: "kg", "unidades", "pacotes"
  value       Float    // valor total pago
  createdAt   DateTime @default(now())
}
```

Sem `@@unique` — o mesmo tipo de item pode ser comprado em datas distintas. Remoção por `id`.

---

## Seletor de Data — `/lancamento`

**Problema:** `src/app/(protected)/lancamento/page.tsx:51` contém `<Link href="#">trocar data</Link>`.

**Solução:** novo Client Component `DatePicker` que substitui o link.

**Arquivo:** `src/app/(protected)/lancamento/DatePicker.tsx`

**Comportamento:**
- Clicar em "trocar data" exibe um `<input type="date">` inline (sem modal).
- `max` setado para hoje — datas futuras bloqueadas pelo browser.
- Se há query param `data` ativo, o input é pré-preenchido com esse valor.
- Ao selecionar uma data, chama `router.push('/lancamento?data=YYYY-MM-DD')`.
- O restante da página permanece Server Component; apenas esse controle é Client Component.

---

## Gestão de Gastos — `/gastos`

### Arquitetura

Página única com Server Component. Formulário de adição no topo; lista agrupada abaixo. Filtro de data via `<form method="GET">` (query params `?de=YYYY-MM-DD&ate=YYYY-MM-DD`).

**Novos arquivos:**
```
src/app/(protected)/gastos/
  page.tsx      # Server Component: filtro + formulário + lista
  actions.ts    # adicionarGasto, removerGasto
```

**Navegação:** adicionar "Gastos" como item no `src/components/Sidebar.tsx`.

### Formulário de Adição

Campos inline no topo da página:

| Campo | Tipo | Validação |
|---|---|---|
| Data | `<input type="date">` | obrigatório, ≤ hoje |
| Categoria | `<select>` | obrigatório |
| Descrição | `<input type="text">` | obrigatório |
| Quantidade | `<input type="number">` | obrigatório, > 0, aceita decimal |
| Unidade | `<input type="text">` | obrigatório (ex: kg, unidades) |
| Valor total | `<input type="number">` | obrigatório, > 0 |

Categorias disponíveis: `Ingredientes`, `Descartáveis`, `Salgados prontos`, `Outros`.

Ao submeter: Server Action `adicionarGasto` → `revalidatePath('/gastos')`. Erros de validação exibidos inline abaixo do campo correspondente.

### Filtro de Data

Dois campos `<input type="date">` (De / Até) submetidos via `<form method="GET">`.

Default quando não há query params: `de` = 1º dia do mês atual, `ate` = hoje.

### Lista Agrupada

Gastos agrupados por categoria. Ordem dos grupos: Ingredientes → Descartáveis → Salgados prontos → Outros. Dentro de cada grupo: itens em ordem cronológica decrescente. Cada item exibe data, descrição, quantidade + unidade, valor e botão "Remover".

```
Ingredientes                                  R$ 320,00
  12/06 · Frango · 3kg · R$ 90,00            [Remover]
  12/06 · Farinha · 5kg · R$ 40,00           [Remover]

Descartáveis                                  R$ 45,00
  10/06 · Embalagens · 100 unidades · R$ 45,00  [Remover]

Total do período                              R$ 365,00
```

Total por grupo e total geral do período exibidos. O botão "Remover" usa `<form action={...}>` com Server Action `removerGasto(id)`.

### Server Actions

**`adicionarGasto(formData)`**
- Valida sessão ativa.
- Valida todos os campos (obrigatoriedade, tipos, date ≤ hoje, value > 0, quantity > 0).
- Persiste `Expense` com `userId` da sessão.
- Chama `revalidatePath('/gastos')`.

**`removerGasto(id)`**
- Valida sessão ativa.
- Busca `Expense` pelo `id` — rejeita se não encontrado ou `userId` diferente da sessão.
- Deleta o registro.
- Chama `revalidatePath('/gastos')`.

---

## Testes (Vitest)

| Arquivo | O que cobre |
|---|---|
| `src/__tests__/actions/adicionarGasto.test.ts` | Sessão ausente retorna erro; campos obrigatórios ausentes retornam erro; data futura rejeitada; value ≤ 0 rejeitado; quantity ≤ 0 rejeitado; persiste corretamente com userId da sessão |
| `src/__tests__/actions/removerGasto.test.ts` | Sessão ausente retorna erro; id não encontrado retorna erro; userId diferente retorna erro (isolamento); deleta quando válido |

---

## Fora de Escopo (Sprint 3+)

- Relatórios cruzando faturamento vs. gastos (lucro real do período)
- Controle de estoque
- Exportação PDF
- Multi-usuários / SaaS
