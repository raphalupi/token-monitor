/* @jsxRuntime classic */
/* @jsx h */
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderElement, TurnCompleteInput } from 'claude-code'

import { fmtTokens, fmtUsd, hitOf, short } from './format'
import { DEFAULTS, ROWS, STORE_KEY, normalize } from './settings'
import type { CostState, Reading, Settings } from '../types'

// Band above the prompt: a context-window readout, originally based on
// Arunjay's Token Weather, plus token-ledger's cost summary folded into the
// same row, instead of its own status line below the prompt. Cost is
// recomputed the same way as before (a session-total delta taken per
// finished turn). Both kept in $.state (not module variables) so a hot
// reload mid-session does not lose the reading history or the cost baseline.

const PANE = 'token-monitor'
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

const settings = atom({ plugin: 'token-monitor', key: 'settings' } as const, DEFAULTS as Settings)

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

    await $.command.register({
      name: 'token-monitor',
      description: 'Choose which rows the token monitor shows',
    })
    const stored = normalize(await $.store.get(STORE_KEY))
    await update($, settings, () => stored)

    await takeReading($)

    const total = await costOf($)
    await update($, cost, current => ({ ...current, sessionUsd: total, lastTotal: total }))

    return result
  })

  on('command.run', { command: 'token-monitor' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Token monitor' })

    return { text: 'Token monitor settings opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const s = await read($, settings)

    const flip = async (key: keyof Settings) => {
      const next = await update($, settings, current => ({ ...current, [key]: !current[key] }))
      await $.store.set(STORE_KEY, next)
    }

    return (
      <Box flexDirection="column">
        <Text dimColor>Press a row to show or hide it. The band above the prompt updates at once.</Text>
        {ROWS.map(row => (
          <Button
            key={row.key}
            label={`${s[row.key] ? '[x]' : '[ ]'} ${row.label}`}
            onPress={() => flip(row.key)}
          />
        ))}
      </Box>
    )
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
    const s = await read($, settings)
    const { Box, Text } = $.ui.resolve(e)
    return (band(Box, Text, history, e.props.bodyColumns, c, s) ?? next(e)) as RenderElement
  })
}

function band($Box: any, $Text: any, history: Reading[], columns: number, c: CostState, s: Settings) {
  const now = history[history.length - 1]
  const f = LEVELS.find(b => now.percent < b.upTo) ?? LEVELS[LEVELS.length - 1]
  const Box = $Box
  const Text = $Text
  const last = c.lastTurn
  const showTrend = s.trend && columns >= 60 && history.length > 1
  const readOver = last ? last.inTok + last.cacheRead + last.cacheWrite : 0
  const hit = last ? hitOf(last.inTok, last.cacheRead, last.cacheWrite) : null

  const parts: any[] = []
  if (s.session && c.sessionUsd !== null) {
    parts.push(
      <Text>
        <Text color="green">{fmtUsd(c.sessionUsd)}</Text> session
      </Text>,
    )
  }
  if (s.lastTurn && last && last.usd !== null) {
    parts.push(
      <Text>
        last turn <Text color="green">{fmtUsd(last.usd)}</Text>
      </Text>,
    )
  }
  if (s.inOut && last) {
    parts.push(
      <Text>
        {fmtTokens(readOver)} in / {fmtTokens(last.outTok)} out
      </Text>,
    )
  }
  if (s.cache && hit !== null) parts.push(<Text>cache {hit}%</Text>)

  const top = s.context || showTrend
  if (!top && parts.length === 0) return null

  return (
    <Box flexDirection="column" paddingX={1}>
      {top ? (
        <Box flexDirection="row">
          {s.context ? (
            <Text color={f.color} bold>
              {f.icon}  {f.word}
            </Text>
          ) : null}
          {s.context ? <Text>  {now.percent}% of context</Text> : null}
          {s.context ? (
            <Text dimColor>
              {'  '}
              {short(now.tokens)} / {short(now.window)}
            </Text>
          ) : null}
          {showTrend ? <Text dimColor>{s.context ? '   ' : ''}last turns </Text> : null}
          {showTrend ? <Text color={f.color}>{sparkline(history)}</Text> : null}
          {showTrend ? <Text dimColor>{trend(history)}</Text> : null}
        </Box>
      ) : null}
      {parts.length > 0 ? (
        <Box flexDirection="row">
          {parts.map((part, n) => (
            <Text key={n}>
              {n > 0 ? ' · ' : ''}
              {part}
            </Text>
          ))}
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
