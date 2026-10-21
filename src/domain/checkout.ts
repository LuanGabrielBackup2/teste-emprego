import type { CheckoutBuyer, CheckoutQuote } from '@/contracts/order'
import { calculateCartQuote } from './cart'
import { centsToDecimal, parseBRLToCents } from './money-brl'
import type { CartLine } from '@/contracts/cart'

export function buildCheckoutQuote(lines: CartLine[], couponCode?: string, createdAt = new Date().toISOString()): CheckoutQuote {
  const quote = calculateCartQuote(lines, couponCode)
  const fingerprint = JSON.stringify({
    items: lines.map(({ nft, quantity }) => ({ id: nft.id, quantity, priceBRL: nft.priceBRL, available: nft.edition.available, version: nft.version })),
    couponCode,
    quote,
  })
  return {
    version: fingerprint,
    items: lines.map(({ nft, quantity }) => ({
      nftId: nft.id, name: nft.name, collection: nft.collection, creator: nft.creator,
      imageUrl: nft.imageUrl, quantity, priceBRL: nft.priceBRL,
      lineSubtotalBRL: centsToDecimal(parseBRLToCents(nft.priceBRL) * BigInt(quantity)),
      available: nft.edition.available, nftVersion: nft.version,
    })),
    quote,
    createdAt,
  }
}

export function validateCheckoutBuyer(buyer: CheckoutBuyer): Partial<Record<keyof CheckoutBuyer, string>> {
  const errors: Partial<Record<keyof CheckoutBuyer, string>> = {}
  if (buyer.name.trim().length < 3) errors.name = 'Informe seu nome completo.'
  if (!/^\S+@\S+\.\S+$/.test(buyer.email.trim())) errors.email = 'Informe um e-mail válido.'
  if (!isValidCpf(buyer.document)) errors.document = 'Informe um CPF válido com 11 dígitos.'
  return errors
}

function isValidCpf(value: string) {
  const digits = value.replace(/\D/g, '')
  if (digits.length !== 11 || /^([0-9])\1{10}$/.test(digits)) return false
  const calculateDigit = (length: number) => {
    const sum = digits.slice(0, length).split('').reduce((total, digit, index) => total + Number(digit) * (length + 1 - index), 0)
    const remainder = (sum * 10) % 11
    return remainder === 10 ? 0 : remainder
  }
  return calculateDigit(9) === Number(digits[9]) && calculateDigit(10) === Number(digits[10])
}

export function sameCheckoutQuote(expected: string, current: CheckoutQuote) {
  return expected === current.version
}
