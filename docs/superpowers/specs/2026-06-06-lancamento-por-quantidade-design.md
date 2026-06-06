# Lançamento por Quantidade — Design Spec

## Contexto

Após testes de usabilidade da Sprint 1, o usuário não se adaptou ao fluxo "1 toque = 1 venda em tempo real". O fluxo real de trabalho é: vender durante o dia (sem mexer no celular), sentar ao final do expediente e registrar tudo de uma vez por quantidade. O sistema deve suportar esse padrão, tanto no celular quanto no computador.

---

## Decisões de Design

### Padrão de entrada
Lista com botões **− / +** por produto. O número do meio é **tocável/editável** para digitar quantidades grandes diretamente (teclado numérico abre no celular). Validação: inteiro ≥ 0 obrigatório, sem decimais, sem negativos. Quantidade 0 significa "não vendeu" — não é gravada.

### Granularidade do registro
**1 linha por produto/dia** — não por unidade vendida. Salvar em 06/06 "12 X-Burguers" gera uma linha, não 12 linhas.

### Data do lançamento
Padrão: hoje. O usuário pode escolher uma data passada (esqueceu de lançar no dia). Datas futuras são bloqueadas.

### Edição posterior
Um dia já lançado pode ser reaberto e corrigido. Abrir o dia mostra as quantidades salvas; salvar de novo sobrescreve.

### Números exibidos
Faturamento (o que entrou) **e** lucro estimado (faturamento − custo), pois custo já é cadastrado nos produtos.

---

## Modelo de Dados

O modelo `Sale` existente é **substituído** pelo modelo agregado:

```prisma
model Sale {
  id        String   @id @default(uuid())
  productId String
  product   Product  @relation(fields: [productId], references: [id])
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  date      DateTime @db.Date
  quantity  Int
  unitPrice Float
  unitCost  Float
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, productId, date])
}
```

- `date`: apenas a data (sem hora), fuso do servidor.
- `quantity`: inteiro positivo ≥ 1 (0 é removido, não armazenado).
- `unitPrice` / `unitCost`: snapshot tirado **no momento de salvar** o dia — preços retroativos não alteram o histórico.
- `@@unique([userId, productId, date])`: permite `upsert`; reeditar o dia sobrescreve.

**Migração**: a tabela `Sale` é recriada do zero. Dados de vendas de teste da Sprint 1 serão descartados. Usuários e produtos não são afetados.

---

## Arquitetura de Telas

### Tela inicial — `/dashboard`

Substitui o dashboard atual (botões de produto):

- **Card de hoje** (topo): faturamento do dia + lucro estimado.
- **Botão primário**: "Lançar vendas de hoje" → navega para `/lancamento`.
- **Lista de dias anteriores**: cada linha mostra data, faturamento e lucro; toque abre `/lancamento?data=AAAA-MM-DD` para editar.

### Tela de lançamento — `/lancamento`

Nova rota. Parâmetro opcional `?data=AAAA-MM-DD` (ausente = hoje).

- **Barra de data**: exibe a data ativa; link "trocar data" abre um seletor de datas passadas.
- **Lista de produtos** (Client Component):
  - Um item por produto do usuário.
  - Controle: `[−] [quantidade editável] [+]`.
  - Se o dia já tiver lançamento salvo, os campos são pré-preenchidos com as quantidades existentes.
- **Totais ao vivo** (calculados no cliente conforme os números mudam):
  - Faturamento: `Σ quantidade × unitPrice`
  - Lucro estimado: `Σ quantidade × (product.price − product.cost)`
- **Botão "Salvar dia"**: chama a Server Action `salvarLancamento`.

---

## Server Action: `salvarLancamento`

```ts
// src/app/(protected)/lancamento/actions.ts
salvarLancamento(date: string, itens: { productId: string; quantity: number }[])
```

Para cada item recebido:
- `quantity > 0` → `upsert` com snapshot de `unitPrice` / `unitCost` do produto.
- `quantity === 0` → `deleteMany` (remove a linha se existir).

Valida no servidor:
- Sessão ativa.
- `date` não é data futura.
- Cada `quantity` é inteiro ≥ 0.
- Cada `productId` pertence ao `userId`.

Ao final: `revalidatePath('/dashboard')` e `revalidatePath('/lancamento')`.

---

## Cálculos — `src/lib/totals.ts`

`calcularTotalDia` é **substituída** por `calcularResumo`:

```ts
function calcularResumo(sales: { quantity: number; unitPrice: number; unitCost: number }[]): {
  faturamento: number
  lucro: number
}
```

- `faturamento = Σ quantity × unitPrice`
- `lucro = Σ quantity × (unitPrice − unitCost)`

Usada no servidor (dashboard) e replicada no cliente para exibir totais ao vivo sem round-trip.

---

## API REST

O endpoint `GET /api/sales/today` passa a retornar o formato novo:

```ts
{ sales: Sale[], faturamento: number, lucro: number }
```

`POST /api/sales` é removido (substituído pela Server Action).

---

## Testes (Vitest)

| Arquivo | O que cobre |
|---|---|
| `src/__tests__/lib/totals.test.ts` | `calcularResumo`: valores corretos, lista vazia, custo igual ao preço |
| `src/__tests__/actions/salvarLancamento.test.ts` | Auth, upsert com snapshot, quantity=0 remove, rejeita negativo/decimal/data futura, isolamento por userId |
| `src/__tests__/api/sales.test.ts` | `GET /api/sales/today` com novo formato |

---

## Fora de Escopo (Sprint 3+)

- Estoque
- Gastos
- Relatórios / exportação PDF
- Múltiplos usuários
