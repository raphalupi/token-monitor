import type { Settings } from '../types'

export const STORE_KEY = 'settings'

export const ROWS: { key: keyof Settings; label: string }[] = [
  { key: 'context', label: 'Context line (percent, tokens, window)' },
  { key: 'trend', label: 'Sparkline and trend' },
  { key: 'session', label: 'Session cost' },
  { key: 'lastTurn', label: 'Last-turn cost' },
  { key: 'inOut', label: 'In / out tokens' },
  { key: 'cache', label: 'Cache hit rate' },
]

export const DEFAULTS: Settings = {
  context: true,
  trend: true,
  session: true,
  lastTurn: true,
  inOut: true,
  cache: true,
}

/** Reads what $.store held: unknown keys are ignored, anything not a boolean falls back to on. */
export function normalize(stored: unknown): Settings {
  const raw = stored && typeof stored === 'object' ? (stored as Record<string, unknown>) : {}
  const out = { ...DEFAULTS }
  for (const { key } of ROWS) if (typeof raw[key] === 'boolean') out[key] = raw[key] as boolean
  return out
}
