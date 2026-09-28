# Brag plan — Bharat AI Office

**What it is:** You write one project brief; an office of 11 AI agents plans it, builds it, and commits real files — and you watch them do it in a live 3D office.
**Who it's for:** builders who want a whole AI team on a task, and want to *see* the team work instead of reading logs.
**What sets it apart:** it's not a chat window — it's an office. Nova hands out work, employees walk to each other's desks to talk, and the output is real git commits.
**Most impressive claim:** 11 AI employees, one brief, real commits.
**Visual hook:** the chat-style composer typing a real brief, then 11 employee cards snapping to "Working".
**Real UI shown:** the redesigned brief composer (incl. its real "Sending…" state), the roster with real portraits/roles/colors, a live capture of the 3D office running the real bakery brief, the dashboard's "Recent deliveries" card with its real "View diff" interaction.
**Tone:** `default` — punchy, playful, clean. Landscape 1920×1080, 30fps, 20s.
**Share caption:** see share-copy.txt.

## Visual identity
The app's own tokens: void `#06090D`, surface `#0A0F16`, line `#1D2836`, ink `#E6EDF3`, violet `#8B7CF6` (primary), cyan `#2FE6D2` (live/working), Bharat tricolor dots (saffron `#FF9933` / white / india-green `#138808`), the 11 agent identity colors from `shared/src/roster.ts`. Inter (self-hosted, same file the app ships) + system mono.

## Music
120 BPM (one bar = 2s, so every scene is exactly two bars), A minor, Am–F–C–G. Hook is pad + pluck only; the kick lands on the reveal. All SFX are pitched into A minor pentatonic and sit under the music.

## Storyboard (20.0s)
| # | Time | Scene | On screen |
|---|---|---|---|
| 1 | 0.0–4.0 | Hook | "You write **one brief.**" → composer types the real bakery brief → "Send to Nova" pressed → "Sending…" |
| 2 | 4.0–8.0 | Reveal | "11 AI employees pick it up." → 11 roster cards pop in one by one → statuses flip Idle → Working |
| 3 | 8.0–12.0 | Highlight: the office | "Watch them work in a live 3D office." → real live capture, slow push-in, ring on Simran "WORKING" |
| 4 | 12.0–16.0 | Highlight: the output | "Real files. Real commits." → Recent deliveries → cursor clicks "View diff" → diff unfolds |
| 5 | 16.0–20.0 | Punchline / outro | Tricolor dots + "Bharat AI Office" → "One brief. A whole AI office." → the live URL, 11 portraits |

Transitions dip through the background (old out, then new in) — no double exposures.
