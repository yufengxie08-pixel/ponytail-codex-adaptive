# Codex Adaptive Mode

Ponytail's Codex adapter uses a small always-on core and routes each prompt to a quality profile. The adapter is intentionally conservative for creative work: an uncertain prompt receives the quality-first profile.

## Project override

Put `.ponytail.json` at the project root, or `.codex/ponytail.json` inside the project:

```json
{
  "profile": "game"
}
```

Valid profiles are `auto`, `game`, `visual`, `engineering`, and `quality`. A project profile overrides the global `profile` or `defaultProfile` in `~/.config/ponytail/config.json` (or the platform equivalent). Set `PONYTAIL_PROFILE` for a global default when no project override exists.

Natural-language overrides also work for one prompt, for example: "按游戏模式处理，但不要牺牲动画和手感。"

The SessionStart hook injects only the core. The UserPromptSubmit hook adds the selected profile, and subagents receive only the core unless their host supplies a task prompt. This avoids repeating the full ruleset in every child context.
