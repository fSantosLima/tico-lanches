export function calcularTotalDia(sales: { value: number }[]): number {
  return sales.reduce((total, sale) => total + sale.value, 0)
}
