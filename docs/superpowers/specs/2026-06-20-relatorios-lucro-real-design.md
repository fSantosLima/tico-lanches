# Sprint 3 — Relatório de Lucro Real

## Contexto

Sprint 1 entregou o fluxo diário (faturamento + lucro estimado do dia). Sprint 2 entregou a gestão de gastos operacionais (`Expense`) com filtro por período e agrupamento por categoria.

Os dois lados — o que entra (`Sale`) e o que sai (`Expense`) — existem, mas hoje vivem em telas separadas. O vendedor não tem uma visão consolidada do **resultado de um período**: quanto faturou, quanto gastou de verdade, e quanto sobrou.

Sprint 3 entrega a tela **`/relatorios`**, que cruza faturamento × gastos reais e mostra o **lucro real do período**, com uma aba de resumo e uma aba de gráficos.

---

## Decisões de produto (definidas no brainstorming)

1. **Período:** presets rápidos (Esta semana / Este mês / Mês passado) + intervalo livre De/Até.
2. **Definição de lucro real:** `Lucro real = Faturamento − Gastos reais (Expense)`. **Não** desconta o `unitCost` do produto — esse continua sendo apenas a estimativa diária do dashboard. Evita dupla contagem.
3. **Local:** nova rota `/relatorios`, protegida, com item na sidebar.
4. **Layout da aba Resumo:** KPIs + gastos por categoria (mesmo padrão visual da tela de Gastos).
5. **Aba Gráficos:** rosca (gastos por categoria) + linha (lucro real **por semana**), usando **Recharts**.
6. **Agrupamento da linha:** por semana (combina com o ciclo de compras ~1×/semana e evita serrilhado).

---

## Modelo de Dados

**Nenhuma mudança de schema. Nenhuma migration.** `Sale` e `Expense` já contêm todos os campos necessários:

- `Sale`: `quantity`, `unitPrice`, `unitCost`, `date`, `userId`, `productId`
- `Expense`: `value`, `category`, `date`, `userId`

---

## Cálculo — `src/lib/relatorio.ts`

Função **pura, sem I/O**, no mesmo espírito de `src/lib/totals.ts` (`calcularResumo`). Recebe as listas já filtradas por usuário/período e devolve o relatório agregado.

```ts
type RelatorioInput = {
  sales: { quantity: number; unitPrice: number; date: Date }[];
  expenses: { value: number; category: string; date: Date }[];
  inicio: Date; // início do período (inclusive)
  fim: Date;    // fim do período (inclusive)
};

type Relatorio = {
  faturamento: number;        // Σ (quantity × unitPrice)
  gastos: number;             // Σ value
  lucroReal: number;          // faturamento − gastos
  margem: number;             // lucroReal / faturamento  (0 quando faturamento = 0)
  gastosPorCategoria: { categoria: string; total: number }[]; // ordenado por total desc
  lucroPorSemana: {           // uma entrada por semana do intervalo [inicio, fim]
    semanaInicio: Date;       // segunda-feira da semana
    faturamento: number;
    gastos: number;
    lucroReal: number;
  }[];
};

function calcularRelatorio(input: RelatorioInput): Relatorio;
```

**Regras de cálculo:**

- `faturamento`: soma de `quantity × unitPrice` de todas as vendas.
- `gastos`: soma de `value` de todas as despesas.
- `lucroReal`: `faturamento − gastos` (pode ser negativo).
- `margem`: `lucroReal / faturamento`; **retorna 0 quando `faturamento === 0`** (evita divisão por zero).
- `gastosPorCategoria`: agrupa despesas por `category`, soma `value`, ordena por total decrescente. Categorias sem gasto no período não aparecem.
- `lucroPorSemana`: usa `date-fns` (`startOfWeek` com `weekStartsOn: 1`, segunda-feira) para classificar cada venda/gasto. **Gera uma entrada para cada semana do intervalo `[inicio, fim]`, mesmo as sem movimento** (faturamento/gastos = 0), para a linha não ter buracos. Ordenado por data crescente.

A função é determinística e independente de fuso: as datas chegam normalizadas (apenas data, sem hora — `@db.Date`), consistente com o tratamento UTC já adotado no projeto.

---

## Período — `FiltroPeriodo.tsx` (client)

Barra no topo, compartilhada pelas duas abas:

- **Presets** (chips): Esta semana · Este mês · Mês passado.
- **Intervalo livre:** campos De / Até reusando o componente `DateInput` (react-datepicker pt-BR).
- O estado vive na **URL**: `?de=YYYY-MM-DD&ate=YYYY-MM-DD&tab=resumo|graficos`. Clicar num preset reescreve `de`/`ate`. Mesmo padrão de `/gastos` e `/lancamento`.
- **Default** ao abrir sem params: período = **este mês**, aba = **resumo**.

---

## Abas

Controladas pelo param `tab` (`resumo` | `graficos`), sem biblioteca de tabs — apenas dois links que reescrevem a URL e renderização condicional no Server Component. KPIs e filtro de período aparecem nas duas abas; só o miolo troca.

### Aba Resumo

- 4 cards de KPI: **Faturamento**, **Gastos**, **Lucro real**, **Margem %**.
- Lista de **gastos por categoria** (`gastosPorCategoria`), mesmo visual da tela de Gastos.
- Estado vazio: quando não há vendas nem gastos no período, mostra mensagem amigável ("Sem movimento neste período").

### Aba Gráficos (componentes client, Recharts)

- **GraficoRosca** — `PieChart` em formato donut sobre `gastosPorCategoria`. Legenda com categoria e valor. Estado vazio quando não há gastos.
- **GraficoLinha** — `LineChart` sobre `lucroPorSemana` (eixo X = semana, eixo Y = lucro real). Linha de referência no zero para evidenciar semanas no prejuízo. Estado vazio quando não há movimento.

---

## Componentes

| Arquivo | Tipo | Função |
|---|---|---|
| `app/(protected)/relatorios/page.tsx` | Server | Lê params, valida sessão, query Prisma (`Sale` + `Expense` por `userId` no intervalo), chama `calcularRelatorio`, renderiza aba ativa |
| `app/(protected)/relatorios/FiltroPeriodo.tsx` | Client | Presets + De/Até; atualiza a URL |
| `app/(protected)/relatorios/Tabs.tsx` | Client | Alterna Resumo/Gráficos via URL |
| `app/(protected)/relatorios/GraficoRosca.tsx` | Client | Recharts PieChart (donut) de gastos por categoria |
| `app/(protected)/relatorios/GraficoLinha.tsx` | Client | Recharts LineChart de lucro real por semana |
| `lib/relatorio.ts` | Pura | `calcularRelatorio` |

**Proteção de rota:** adicionar `/relatorios` ao matcher de `src/proxy.ts`. **Sidebar:** novo item "Relatórios" em `src/components/Sidebar.tsx`.

**Dependência nova:** `recharts` (e seu `date-fns`/`d3` internos). Único acréscimo ao `package.json`.

---

## Testes

> Requisito explícito desta sprint: **máxima cobertura de cenários**. A lógica de negócio inteira mora em `calcularRelatorio` (função pura), então é onde a cobertura precisa ser exaustiva. O Prisma continua mockado globalmente (`src/__tests__/setup.ts`); nenhum teste exige banco real.

### `src/__tests__/lib/relatorio.test.ts` — `calcularRelatorio`

**Faturamento e gastos:**
1. Listas vazias → faturamento 0, gastos 0, lucroReal 0, margem 0, arrays vazios.
2. Só vendas, sem gastos → faturamento correto, gastos 0, lucroReal = faturamento, margem 1.
3. Só gastos, sem vendas → faturamento 0, gastos correto, lucroReal negativo, margem 0.
4. Vendas e gastos juntos → faturamento, gastos e lucroReal corretos.
5. Faturamento somando múltiplos produtos com `quantity × unitPrice` distintos.

**Lucro real:**
6. Lucro real positivo (faturamento > gastos).
7. Lucro real **negativo** (gastos > faturamento) — não clampar em zero.
8. Lucro real exatamente zero (faturamento = gastos).

**Margem (cenários de divisão por zero):**
9. Faturamento = 0 e gastos > 0 → margem 0 (não `-Infinity`/`NaN`).
10. Faturamento = 0 e gastos = 0 → margem 0.
11. Margem fracionária correta (ex.: lucro 2850 / faturamento 4200 ≈ 0,678).
12. Margem negativa quando lucroReal < 0.

**Gastos por categoria:**
13. Várias categorias → agrupadas e somadas corretamente.
14. Mesma categoria em datas diferentes → somadas numa única entrada.
15. Ordenação por total **decrescente**.
16. Categoria sem gasto no período → ausente do array.
17. Categorias com acentuação/casing tratadas como vêm do banco (sem normalização extra).

**Lucro por semana (agrupamento temporal — área mais sensível):**
18. Todas as vendas/gastos numa única semana → uma entrada.
19. Período de várias semanas → uma entrada por semana, em ordem crescente.
20. Semana **sem movimento** no meio do intervalo → entrada presente com zeros (linha sem buraco).
21. Semana com venda mas sem gasto → gasto 0, lucroReal = faturamento.
22. Semana com gasto mas sem venda → faturamento 0, lucroReal negativo.
23. Limite de semana: venda no domingo vs. segunda caem em semanas distintas (`weekStartsOn: 1`).
24. `semanaInicio` sempre na segunda-feira da respectiva semana.
25. Soma dos `lucroReal` semanais == `lucroReal` total (consistência interna).
26. Intervalo de exatamente uma semana → uma entrada.
27. Intervalo que cruza virada de mês/ano → semanas contíguas corretas.

**Robustez:**
28. Vendas com `quantity` 0 não alteram faturamento.
29. Valores decimais (centavos) somados sem erro de arredondamento relevante.
30. `inicio`/`fim` no mesmo dia → um único dia agregado corretamente.

### Página `/relatorios` (se viável no padrão atual de testes)

Os testes de Server Component/page não fazem parte do padrão atual do projeto (hoje testa-se `lib/` e Server Actions/API). Mantemos o foco em `calcularRelatorio`. Caso a página exponha lógica de parsing de período, extrair essa lógica para uma função pura testável (ex.: `resolverPeriodo(searchParams)` com testes para cada preset, default e intervalo livre inválido).

### `resolverPeriodo` (se extraída)

31. Sem params → este mês.
32. Preset "esta semana" / "este mês" / "mês passado" → intervalos corretos.
33. `de`/`ate` válidos → usados como intervalo.
34. `de` > `ate` (invertido) → **troca os dois** (swap), nunca quebra.
35. Datas malformadas → cai no default sem quebrar.

---

## Fora de Escopo (Sprint 4+)

- Exportação PDF do relatório
- Gráfico de barras faturamento × gastos
- Controle de estoque
- Multi-usuários / SaaS
- Descontar `unitCost` do produto no lucro real (decisão de produto: lucro real = faturamento − gastos reais)
