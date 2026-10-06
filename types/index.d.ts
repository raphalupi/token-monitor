export type Reading = { tokens: number; window: number; percent: number }

export type LastTurn = {
  model: string
  inTok: number
  outTok: number
  cacheRead: number
  cacheWrite: number
  /** Dollars this turn added to the session cost; null when unknown. */
  usd: number | null
}

export type CostState = {
  sessionUsd: number | null
  /** cost.usd as last read: the baseline the next turn's delta is taken from. */
  lastTotal: number | null
  lastTurn: LastTurn | null
}

declare module 'claude-code' {
  interface PluginState {
    'token-monitor': {
      readings: Reading[]
      cost: CostState
    }
  }
}
