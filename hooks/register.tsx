/* @jsxRuntime classic */
/* @jsx h */
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderElement, TurnCompleteInput } from 'claude-code'

import { fmtTokens, fmtUsd, hitOf, short } from './format'
import type { CostState, Reading } from '../types'

// Band above the prompt: a context-window readout, originally based on
// Arunjay's Token Weather, plus token-ledger's cost summary folded into the
// same row, instead of its own status line below the prompt. Cost is
// recomputed the same way as before (a session-total delta taken per
// finished turn). Both kept in $.state (not module variables) so a hot
// reload mid-session does not lose the reading history or the cost baseline.

const HISTORY = 12
const BARS = '▁▂▃▄▅▆▇█'
const LEVELS = [
  { upTo: 25, icon: '↓', word: 'Low', color: '#8BC34A' },
  { upTo: 50, icon: '↘', word: 'Med', color: '#CDDC39' },
  { upTo: 75, icon: '→', word: 'High', color: '#FFC107' },
  { upTo: 90, icon: '↗', word: 'Critical', color: '#FF5722' },
  { upTo: Infinity, icon: '↑', word: 'Compact soon', color: '#E91E63' },
] as const

const readings = atom({ plugin: 'token-monitor', key: 'readings' } as const, [] as Reading[])
const cost = atom({ plugin: 'token-monitor', key: 'cost' } as const, {
  sessionUsd: null,
  lastTotal: null,
  lastTurn: null,
} as CostState)

async function takeReading($: EngineInterface): Promise<void> {
  const { context } = await $.session.usage()
  if (!context?.window) return

  const tokens = context.tokens ?? 0
  const percent = context.percent ?? Math.round((tokens / context.window) * 100)

  await update($, readings, history =>
    [...history, { tokens, window: context.window, percent }].slice(-HISTORY),
  )
}

async function costOf($: EngineInterface): Promise<number | null> {
  try {
    return (await $.session.usage()).cost?.usd ?? null
  } catch {
    return null
  }
}

export function statusText(c: CostState): string | undefined {
  const parts: string[] = []
  if (c.sessionUsd !== null) parts.push(`${fmtUsd(c.sessionUsd)} session`)

  const last = c.lastTurn
  if (!last) return parts.length > 0 ? parts.join(' · ') : undefined

  if (last.usd !== null) parts.push(`last turn ${fmtUsd(last.usd)}`)

  // "in" here is everything the answer was read over - fresh input, cache
  // reads and cache writes - which is the figure the cache share is of.
  const readOver = last.inTok + last.cacheRead + last.cacheWrite
  parts.push(`${fmtTokens(readOver)} in / ${fmtTokens(last.outTok)} out`)

  const hit = hitOf(last.inTok, last.cacheRead, last.cacheWrite)
  if (hit !== null) parts.push(`cache ${hit}%`)

  return parts.join(' · ')
}

/** Prices the finished turn by what the session total moved since the last one. */
async function record($: EngineInterface, e: TurnCompleteInput): Promise<void> {
  const total = await costOf($)
  const usage = e.usage

  await update($, cost, current => {
    const lastTotal = total ?? current.lastTotal
    const sessionUsd = total ?? current.sessionUsd

    if (!usage) return { ...current, sessionUsd, lastTotal }

    const usd =
      total !== null && current.lastTotal !== null
        ? Math.max(0, total - current.lastTotal)
        : null

    return {
      sessionUsd,
      lastTotal,
      lastTurn: {
        model: usage.model,
        inTok: usage.input_tokens,
        outTok: usage.output_tokens,
        cacheRead: usage.cache_read_input_tokens,
        cacheWrite: usage.cache_creation_input_tokens,
        usd,
      },
    }
  })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)

    await takeReading($)

    const total = await costOf($)
    await update($, cost, current => ({ ...current, sessionUsd: total, lastTotal: total }))

    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)

    if (!e.agentId) {
      await takeReading($)
    }

    await record($, e)

    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const history = await read($, readings)
    if (e.props.hasSurvey || history.length === 0) {
      return next(e)
    }

    const c = await read($, cost)
    const { Box, Text } = $.ui.resolve(e)
    return band(Box, Text, history, e.props.bodyColumns, c) as RenderElement
  })
}

function band($Box: any, $Text: any, history: Reading[], columns: number, c: CostState) {
  const now = history[history.length - 1]
  const f = LEVELS.find(b => now.percent < b.upTo) ?? LEVELS[LEVELS.length - 1]
  const Box = $Box
  const Text = $Text
  const last = c.lastTurn
  const hasSession = c.sessionUsd !== null
  const hasLastUsd = !!last && last.usd !== null
  const hasInOut = !!last
  const readOver = last ? last.inTok + last.cacheRead + last.cacheWrite : 0
  const hit = last ? hitOf(last.inTok, last.cacheRead, last.cacheWrite) : null

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box flexDirection="row">
        <Text color={f.color} bold>
          {f.icon}  {f.word}
        </Text>
        <Text>  {now.percent}% of context</Text>
        <Text dimColor>
          {'  '}
          {short(now.tokens)} / {short(now.window)}
        </Text>
        {columns >= 60 && history.length > 1 ? (
          <Text dimColor>   last turns </Text>
        ) : null}
        {columns >= 60 && history.length > 1 ? (
          <Text color={f.color}>{sparkline(history)}</Text>
        ) : null}
        {columns >= 60 && history.length > 1 ? <Text dimColor>{trend(history)}</Text> : null}
      </Box>
      {hasSession || last ? (
        <Box flexDirection="row">
          {hasSession ? (
            <Text>
              <Text color="green">{fmtUsd(c.sessionUsd)}</Text> session
            </Text>
          ) : null}
          {hasLastUsd ? (
            <Text>
              {hasSession ? ' · ' : ''}last turn <Text color="green">{fmtUsd(last!.usd)}</Text>
            </Text>
          ) : null}
          {hasInOut ? (
            <Text>
              {hasSession || hasLastUsd ? ' · ' : ''}
              {fmtTokens(readOver)} in / {fmtTokens(last!.outTok)} out
            </Text>
          ) : null}
          {hit !== null ? <Text> · cache {hit}%</Text> : null}
        </Box>
      ) : null}
    </Box>
  )
}

function sparkline(history: Reading[]): string {
  const top = Math.max(...history.map(r => r.tokens), 1)
  return history.map(r => BARS[Math.floor((r.tokens / top) * (BARS.length - 1))]).join('')
}

function trend(history: Reading[]): string {
  const delta = history[history.length - 1].tokens - history[history.length - 2].tokens
  if (delta === 0) return '  steady'
  return delta > 0 ? `  ▲ +${short(delta)} last turn` : `  ▼ ${short(-delta)} last turn`
}
