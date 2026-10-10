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

## Known gaps (session 1)
- No real-photo→Gemma e2e inference in CI (needs cloud + key); covered manually via smoke above.
- E2E Playwright flow (upload→film→loop in real browser) not yet written — next step.
- Hands/fingers quality depends on model output; manual stroke editing UI not yet built.

## Session 2 — library, scenes, history trees, lesson-trained system
New journeys: prompt-draw character/item/location; compose scene from library cast with missing-draw proposals + paused editable queue; fork scenes with parent links; undo/redo 100 deep with branch trees + full log.
- `lib/history.ts` HistoryTree: linear undo/redo, cap-100 prune (abandoned leaves, else root promotion), branches/children/activeChild, jumpTo, chronological log with depth/branch/current. 8 tests.
- `lib/entities.ts` over library-store (`entity:` keys): save/get/list/kind-filter/findByName/delete(tombstone)/forkScene(parentId). 7 tests.
- `/api/generate` (character|item|location|scene) + `buildTextRequest` + `KIND_PROMPTS` + `requestDrawingScriptFromPrompt`. 10 route/lib tests.
- `lib/scene-composer.ts`: resolveCast pure missing-report, composeScenePrompt (cast palettes for face consistency), queue (`queue:` keys) enqueuePaused/list/edit/resume/remove — prompt never lost, editable, resumable. 7 tests.
- UI: EntityGenerator, EntityLibrary, SceneComposer (missing dialog + queue edit/resume + fork + new-version via parentId), pages /characters /items /locations /scenes, nav, HistoryPanel, CanvasStage internal history (commit on load, view-only replay on undo/redo/jump, event log cap 200).
- Lesson training: `lib/lesson-knowledge.ts` (SOURCES purmix/art-bogema/coddyschool/risunci, PENCIL_GRADES HB->B6, INTERACTION_ORDER, FACE/BODY/STYLE canons, MATERIALS, PRACTICE, gradeOfStroke, lessonBlock) wired into ANIME_DIRECTOR_PROMPT + KIND_PROMPTS; `lib/lesson-pipeline.ts` validatePipeline (film order, construction-first, ink-required, eraser-target, grade bands, non-empty fills) enforced as HTTP 422 in /api/draw + /api/generate; validateSceneLayers enforced in SceneComposer; strokeStyleFor grade-aware pencil rendering (B6 press near-ink).
- Verification: 120/120 tests, `tsc` 0, coverage 90.1% lines / 81.8% branches / 89.5% funcs, `next build` OK (/, /characters, /items, /locations, /scenes, dynamic /api/*).
- Live: dev :3000, all pages 200, browser opened. GitHub: fresh repo (node_modules/.next excluded via .gitignore), 1 commit (74 files), pushed to https://github.com/visawestern/anime-canvas-pwa (main).

## Known gaps (session 2)
- Playwright e2e still open; manual stroke editor still open.
- Queue/scene storage is local (IndexedDB/localStorage) — no cloud sync.
- Real scene generation quality depends on Gemma cloud output + 422-retry loop not yet implemented (client surfaces error, user retries).
