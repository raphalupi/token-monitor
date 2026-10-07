# token-monitor

A Claude Code plugin that adds a live context-window readout above the prompt, plus a pinned line with session cost, last turn's cost, tokens, and cache hit rate.

## What it shows

A band above the prompt:

```
↓  Low   12% of context   118k / 1M   last turns ▂▃▄▅▆▇   ▲ +4.2k last turn
$0.0842 session · last turn $0.0031 · 4.2k in / 890 out · cache 92%
```

Each piece of the band can be shown or hidden on its own:

- **Context line**: the level and icon (`Low` / `Med` / `High` / `Critical` / `Compact soon`), the percent of the context window used, and raw tokens against the window size.
- **Sparkline and trend**: how usage has moved over the last few turns (shown when the terminal is wide enough).
- **Session cost**: the running cost of the session.
- **Last-turn cost**: what the most recent turn cost.
- **In / out tokens**: input and output tokens of the last turn.
- **Cache hit rate**: the share of the last turn that was served from cache.

## Choose what to show

Run `/token-monitor` to open a settings pane with one row per piece above. Press a row to toggle it, and the band above the prompt updates at once. Your choices are saved across sessions, and every row is on by default.

## Install

```
/plugin marketplace add raphalupi/token-monitor
/plugin install token-monitor@token-monitor
```

## How it works

Reads `$.session.usage()` on `session.start` and `turn.complete`, keeps a short rolling history of context readings and a cost baseline in plugin state, and renders both into the `AbovePrompt` UI slot. The `/token-monitor` pane is a `Pane` whose toggles are stored with `$.store`.

## Credits

Inspired by [Getting Started with Claude Code Mods](https://claude.dev/blog/getting-started-with-claude-code-mods/), which is also a good guide if you want to build your own.

## License

MIT
