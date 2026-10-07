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

export type Settings = {
  context: boolean
  trend: boolean
  session: boolean
  lastTurn: boolean
  inOut: boolean
  cache: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'token-monitor': {
      readings: Reading[]
      cost: CostState
      settings: Settings
    }
  }
}
