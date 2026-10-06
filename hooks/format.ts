// Numbers into the short strings the status line shows. Trimmed from
// token-ledger's format.ts: no table layout, since there is no /ledger pane here.

export function fmtTokens(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '-'
  if (n < 1000) return String(Math.round(n))
  if (n < 10000) return `${(n / 1000).toFixed(1)}k`
  if (n < 1e6) return `${Math.round(n / 1000)}k`
  return `${(n / 1e6).toFixed(1)}M`
}

/** Dollars, with enough decimals that a cheap turn is not shown as $0.00. */
export function fmtUsd(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '-'
  return n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(4)}`
}

/** cache_read over everything the request was answered from; null when nothing was. */
export function hitOf(inTok: number, read: number, write: number): number | null {
  const total = inTok + read + write
  return total > 0 ? Math.round((read / total) * 100) : null
}

export function short(n: number): string {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}k`
  return String(n)
}
