# token-monitor

A Claude Code plugin that adds a live context-window readout above the prompt, plus a pinned line with session cost, last turn's cost, tokens, and cache hit rate.

## What it shows

A band above the prompt:

```
↓  Low   12% of context   118k / 1M   last turns ▂▃▄▅▆▇   ▲ +4.2k last turn
$0.0842 session · last turn $0.0031 · 4.2k in / 890 out · cache 92%
```

- **Level + icon**: `Low` / `Med` / `High` / `Critical` / `Compact soon`, based on percent of the context window used.
- **Percent and raw tokens**: current usage against the window size.
- **Sparkline and trend**: how usage has moved over the last few turns (shown when the terminal is wide enough).
- **Cost line**: running session cost, the last turn's cost, input/output tokens, and cache hit rate.

## Install

```
/plugin marketplace add raphalupi/token-monitor
/plugin install token-monitor@token-monitor
```

## How it works

Reads `$.session.usage()` on `session.start` and `turn.complete`, keeps a short rolling history of context readings and a cost baseline in plugin state, and renders both into the `AbovePrompt` UI slot.

## License

MIT
