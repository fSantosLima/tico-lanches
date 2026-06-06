export function calcularResumo(
  sales: { quantity: number; unitPrice: number; unitCost: number }[]
): { faturamento: number; lucro: number } {
  return sales.reduce(
    (acc, s) => ({
      faturamento: acc.faturamento + s.quantity * s.unitPrice,
      lucro: acc.lucro + s.quantity * (s.unitPrice - s.unitCost),
    }),
    { faturamento: 0, lucro: 0 }
  )
}
