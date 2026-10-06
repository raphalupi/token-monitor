import { expect, test } from 'claude-code/testing'

import { fmtTokens, fmtUsd, hitOf } from './format'
import { statusText } from './register'
import type { CostState } from '../types'

test('fmtUsd keeps extra decimals under a dollar so a cheap turn is not $0.00', async () => {
  expect(fmtUsd(0.0032)).toBe('$0.0032')
  expect(fmtUsd(1.2)).toBe('$1.20')
  expect(fmtUsd(null)).toBe('-')
})

test('fmtTokens scales k/M the same way the ledger did', async () => {
  expect(fmtTokens(921_000)).toBe('921k')
  expect(fmtTokens(2_300)).toBe('2.3k')
  expect(fmtTokens(42)).toBe('42')
})

test('hitOf is the cache-read share of everything the turn read over', async () => {
  expect(hitOf(100, 9900, 0)).toBe(99)
  expect(hitOf(0, 0, 0)).toBeNull()
})

test('statusText before any turn shows only the session total', async () => {
  const state: CostState = { sessionUsd: 0.5475, lastTotal: 0.5475, lastTurn: null }
  expect(statusText(state)).toBe('$0.5475 session')
})

test('statusText with nothing known yet is undefined, clearing the line', async () => {
  const state: CostState = { sessionUsd: null, lastTotal: null, lastTurn: null }
  expect(statusText(state)).toBeUndefined()
})

test('statusText matches the token-ledger line shape after a turn', async () => {
  const state: CostState = {
    sessionUsd: 0.5475,
    lastTotal: 0.5475,
    lastTurn: {
      model: 'claude-sonnet-5',
      inTok: 921_000,
      outTok: 2_300,
      cacheRead: 0,
      cacheWrite: 0,
      usd: 0.2244,
    },
  }
  expect(statusText(state)).toBe(
    '$0.5475 session · last turn $0.2244 · 921k in / 2.3k out · cache 0%',
  )
})

test('statusText adds the cache hit rate once a turn served from cache', async () => {
  const state: CostState = {
    sessionUsd: 1.1,
    lastTotal: 1.1,
    lastTurn: { model: 'm', inTok: 100, outTok: 50, cacheRead: 9900, cacheWrite: 0, usd: 0.01 },
  }
  expect(statusText(state)).toBe('$1.10 session · last turn $0.0100 · 10k in / 50 out · cache 99%')
})
