# TDD Evidence Report — AnimeCanvas PWA (живой карандаш + cel-анимация)

## Source
No `*.plan.md` file — user journeys derived during this TDD run from the plan-phase analysis
(risunci.com 8-step guy + 12-step full-body lessons, pngtree fantasy reference, gemma4:31b-cloud vision-in/text-out constraint).

## User journeys
1. As a user, I upload a photo so Gemma analyses the pose and returns drawing steps.
2. As a user, I watch pencil emulation (construction → ink → eraser → fill) play like a film on one canvas.
3. As a user, I press «Animate» so only moving layers redraw at 12 fps while static pixels are blitted.
4. As a user, I install the PWA and reopen saved scenes offline.

## Task report
- Skeleton + Vitest infra → RED (5 suites, missing modules) → GREEN after minimal libs. `npx vitest run`.
- Ollama proxy + schema + engines → 20/20 GREEN.
- Pencil renderer tokenizer bug (`M10` split) caught by RED test, fixed, 26/26.
- Playback + cel-loop + store → 30/30 → backfilled honest canvas-mock tests → 54/54.
- Coverage driven 49% → 88.3% lines / 80.8% branches / 84.2% funcs. `npm run test:coverage`.
- Types: `npx tsc --noEmit` exit 0. Build: `npm run build` OK (`/` 16.4 kB, `/api/draw` dynamic).
- Live smoke (dev :3107): POST without image → 400 `imageBase64 is required`; POST 8-byte PNG → 502 with real
  Ollama Cloud reply `invalid image data: unexpected EOF` — proves proxy→gemma4:31b-cloud wiring end-to-end.
  No OLLAMA_API_KEY in env; cloud access works via machine Ollama sign-in. Manifest serves.

## Guarantees
| # | Guarantee | Test | Type | Result |
|---|-----------|------|------|--------|
| 1 | Valid Gemma script parses; unknown kinds/empty steps/bad dirtyLayers/60fps rejected | drawing-script-schema.test.ts | unit | PASS |
| 2 | Chat request carries base64 image + json format; empty image throws; fenced/raw JSON parsed, non-JSON throws | ollama.test.ts | unit | PASS |
| 3 | Server returns fenced JSON as validated script; HTTP/daemon/schema failures throw honestly, never fake | ollama-server.test.ts | integration | PASS |
| 4 | POST /api/draw: 400 missing/malformed body, 200 script, 502 Ollama down | route.test.ts | integration | PASS |
| 5 | Stroke interpolation clamped; jitter bounded; 12fps = 83.33ms | pencil-engine.test.ts | unit | PASS |
| 6 | SVG M/L/C/Z parsed+sampled; Z closes; Q throws; frame throttle | pencil-renderer.test.ts | unit | PASS |
| 7 | Steps play strictly by id; eraser never blind-wipes; abort clean; null ctx throws | playback.test.ts | unit | PASS |
| 8 | Only dirty layers redraw; frame loop wraps; easeLoop 0→1→0; loop restores snapshot per frame | cel-engine/cel-loop/cel-default-layer.test.ts | unit | PASS |
| 9 | One canvas invariant; upload→film→steps list; server error shown; empty selection sends nothing; animate starts loop | CanvasStage tests | component | PASS |
| 10 | SW has install/fetch, skips /api; manifest installable; register called; scenes persist + survive quota/corruption | pwa-shell/library-store/SwRegister tests | unit | PASS |
| 11 | Director prompt encodes risunci order + JSON-only + dirty-layer rules | director-prompt.test.ts | unit | PASS |

## Known gaps
- No real-photo→Gemma e2e inference in CI (needs cloud + key); covered manually via smoke above.
- E2E Playwright flow (upload→film→loop in real browser) not yet written — next step.
- Hands/fingers quality depends on model output; manual stroke editing UI not yet built.
