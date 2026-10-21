/** Converte decimais BRL de até duas casas em centavos sem usar ponto flutuante. */
export function parseBRLToCents(value: string): bigint {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) {
    throw new Error('O valor em BRL deve ter no máximo duas casas decimais.')
  }
  const [whole, fraction = ''] = value.split('.')
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
}

export function formatCentsAsBRL(cents: bigint): string {
  const whole = cents / 100n
  const fraction = String(cents % 100n).padStart(2, '0')
  return `R$ ${whole.toLocaleString('pt-BR')},${fraction}`
}

export function centsToDecimal(cents: bigint): string {
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`
}
