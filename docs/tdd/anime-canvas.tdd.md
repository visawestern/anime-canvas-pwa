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

## Session 3 — model schema-drift fix (live user error)
Symptom: `ollama unavailable: [70x invalid_type ...]` — Gemma returned style.palette/linePencil/lineInk as
objects, steps without id/path, bones without name/from/to, morphTargets as object, anim.loop boolean.
- `lib/script-normalize.ts`: repairs drift (palette object->array, {color}->string, d/points->path with
  SVG serialization, id from n/order/index, kind/type+layer defaults, joint/start/end->name/from/to,
  morphTargets->array, non-string loop->idle), drops geometry-less strokes only with recorded warnings,
  throws on non-objects. 4 tests.
- `exampleBlock()` in lesson-knowledge: fenced minimal example the model must copy EXACTLY; self-checked by
  test (embedded JSON validates against DrawingScriptSchema). Wired into ANIME_DIRECTOR_PROMPT + KIND_PROMPTS.
- `requestWithRepair` in ollama-server (MAX_TRIES=3): normalize->validate per attempt, repair message carries
  the concrete error list, transport errors throw immediately, final error is a bounded summary
  (`summarizeIssues`, 5 issues max). 3 retry tests.
- Routes map ZodError -> 422 with bounded summary (not 502 "unavailable"); clients already render data.error.
- Live proof (dev :3000, real gemma4:31b-cloud, kind=item): HTTP 200 first try, 0 normalize warnings —
  pencil(HB 1.2/0.5)x3 -> ink -> fill -> shade, palette array, item-template layers.
- Verification: 130/130 tests, `tsc` 0, coverage 90.6% lines / 81.6% branches / 90.5% funcs, `next build` OK.
- Commits 4eb4893 + buildinfo-ignore pushed to https://github.com/visawestern/anime-canvas-pwa (main).

## Session 4 — pipeline strictness fixes, template gallery, admin UI
User errors fixed:
- `shade without fills draws nothing` + grade near-miss 422s: renderer now draws hatching strokes of
  fill/shade steps (purmix shadowing); validator accepts shade/fill with strokes; eraser strokes exempt
  from grade bands; `snapStrokeToGrade` (tolerance w±0.3/o±0.15) + kind defaults (pencil->HB, ink->B6) in
  normalizer; pipeline validation moved inside server repair-retry (auto-repair, bounded messages);
  route 422 strings bounded (first 5 + count).
- Prompt template gallery (`lib/prompt-templates.ts`, 12 templates x3 per kind with example names + hints),
  pickers in EntityGenerator + SceneComposer. 5 gallery tests.
- Live verification per kind via real model: character 200/11 steps, item 200/8 (one transient non-JSON
  repaired on retry), location 200/8 with 3-plane layers, scene 200/13 with actor layers.
- Live-found bug fixed: model transliterates actor layers (actor_aya) — `validateSceneLayers` now matches
  via Russian transliteration variants (й->y/i). Test from live evidence.
- Admin UI (Vuexy-style, no new deps): dark sidebar + topbar + cards + badges + dialogs in globals.css,
  SideNav with active link, all components/pages restyled (labels/roles/testids preserved).
  Found by check: stale `.next` dev cache 500 on /scenes after prod build — fixed by clean dev restart.
- Verification: 148/148 tests, `tsc` 0, coverage 91.2% lines / 81.3% branches / 90.5% funcs, `next build` OK,
  all 5 pages serve admin shell (curl-checked markup).

## Session 5 — user-reported bugs: studio theme + silent generation
1. Studio theme "unchanged": markup DID carry the new theme (curl: section.card x2 + sidebar on /) — stale
  browser CSS. Added card-class regression guard (CanvasStage.test). Fix for user: hard refresh (Cmd+Shift+R).
2. "Нарисовать: получено N шагов, но рисунка нет": entity/scene pages never rendered anything — text-only
  status. Fixed with `EntityPreview` (plays the DrawingScript on its own canvas + replay button), wired into
  /characters /items /locations (onSaved now passes the script) and SceneComposer (preview after generation).
  3 preview tests + 1 composer preview test; SceneComposer.test mocks the player (jsdom has no 2d context).
- Regression test for the exact live step-11 failure (shade strokes o=0.4, no fills): normalize->schema->
  pipeline passes, no 422.
- Verification: 154/154 tests, `tsc` 0, coverage 90.4% lines / 81.6% branches / 90.6% funcs, `next build` OK.

## Session 6 — stale shell (SW cache-first), precache-all, EntityPreview live
User screenshot: unstyled old markup (Times, blue links, old nav) — root cause was our own SW v1
(cache-first `/`, worker bytes unchanged since creation so it never updated).
- SW v2: network-first navigations + cache fallback; v3: precache ALL pages upfront
  (/, /characters, /items, /locations, /scenes, manifest, both icons), updates always from network.
  4 shell tests (precache list asserted).
- EntityPreview shipped (bug 2 of session 5 was real: entity pages had no canvas at all).
- Live: clean dev restart, all 5 pages 200 with admin-shell, layout.css 200 with theme classes,
  sw.js serves v3. Stale `.next` 500 incident resolved via clean restart (never build over running dev).
- Verification: 156/156 tests, `tsc` 0, `next build` OK. Server handed to user terminal.

## Session 7 — live renderer crash (unsupported SVG command: 30)
User screenshot: generation saved ("Рин, 11 шагов") but preview died with
`unsupported SVG command in DrawingScript path: 30`. Root cause: old parser knew only M/L/C/Z;
live evidence (/tmp/live-*.json) shows the model emits A/Q/S too — skipped letters misaligned tokens
until a number landed in command slot. Duplicate "Рин" entries came from re-clicking after the crash.
- `svgPathToPoints` rewritten to full SVG: M/L/H/V/C/S/Q/T/A/Z, relative variants, implicit lineto,
  smooth reflection (S/T), arc endpoint parameterization (F.6.5). True garbage still throws honestly.
  8 parser tests incl. live A/Q/S shapes.
- Film resilience: every parse site wrapped — broken strokes skip with `onSkip` report, film finishes;
  CanvasStage + EntityPreview append "Пропущено битых штрихов: N" to status. 1 playback test.
- Verification: 163/163 tests, `tsc` 0, coverage 89.7% lines / 80.1% branches / 90% funcs, build OK.
  Pushed 5c4a7ff. User must restart their own dev server to pick it up (`npm run dev -- -p 3000`).

## Session 8 — logo skill, SVG-craft distillation, reference remix base
- Skill `kaankiziltug/logo-design-skill` compatibility-checked (Agent Skills format, Markdown+stdlib
  Python, OpenCode-named in README) and installed to `~/.config/opencode/skills/logo-design` (full,
  incl. 13MB reference library; audit script smoke-tested).
- Surbhi pencil-animation lesson analyzed: stroke-draw (dasharray/dashoffset + per-path ids/delays),
  CSS/`<animate>`/JS layers, Vivus.js, path hygiene. Note added as
  `references/svg-pencil-animation.md` in the installed skill + SKILL.md map row.
- `lib/path-surgery.ts`: RDP simplify + trimPoints; thumbnails render simplified (EntityThumb passes
  `{simplify: 1.5}`). 5 surgery tests.
- `lib/svg-craft.ts` distillation: 7 rules, svgCraftBlock wired into ALL generation prompts,
  auditCraft (anchors/micro/colors/near-miss angles/unclosed score 0-100) shown in generation statuses.
  8 craft tests.
- Reference remix base: Wikimedia `Anime_Girl.svg` (Niabot, CC BY 3.0 — remix legal with credit),
  checked into `public/reference/` + `lib/reference-scene.ts` (file-locked stats test, technique brief).
  SceneComposer "Изменить эталон по промпту": brief prepended to generation, scenes marked basedOn,
  base survives queue pause/resume. Entity.basedOn added, forkScene preserves it.
- Verification: 191/191 tests, `tsc` 0, coverage 89.8% lines / 80.5% branches / 90.4% funcs, build OK.

## Session 9 — dev console errors (hot-update blocked + full-reload warning)
User pasted Safari console: `hot-update.json ... access control checks` + Fast Refresh full-reload hint.
- Export audit: NO mixed component/value exports, NO class components in the codebase — the reload
  warning is fallout from the blocked HMR fetch, not our structure.
- SW v4: bypasses `.hot-update.*` and non-GET requests (dev HMR never intercepted); precache list intact.
- SwRegister is now production-only; in dev it unregisters stale workers on load, so the stuck v1/v3
  worker that served the old shell removes itself on next visit. 3 SwRegister tests + 1 shell test.
- Verification: 194/194 tests, `tsc` 0, coverage 89.8%/80.6%/90.4%, build OK. User must restart dev
  server once (`npm run dev -- -p 3000`) — then HMR works and the stale worker is gone.

## Session 10 — OmniSVG limits removed per user order
User: count/token caps from OmniSVG are useless — remove. Kept: coordinate precision, angles, craft.
- Deleted MAX_STEPS/MAX_STROKES_PER_STEP + both 'bloat' findings + compactness prompt rule.
- Inverted test now locks the new behavior (25 steps → no bloat finding); clean-audit fixture aligned
  to strokes-only; precision rule reworded (integers preferred, max 2 decimals).
- Verification: 208/208 tests, `tsc` 0, coverage 90.0% lines / 80.4% branches / 91.5% funcs, build OK.

## Session 11 — reference-style SVG film (user: draw like anime_girl_pencil.html)
Studied the file: real SVG DOM, `pathLength="1"` + `--dl/--d` dash write-on (Surbhi 1:1), fills forced
off, per-<g> SCHEDULE with sidebar/progress/clock/speed/replay.
- `lib/svg-film.ts`: scriptToSvg (one <g> per layer, unique path ids, fills as contours, grade
  widths, cumulative stagger), shiftLayerMarkup (translate accumulate, unknown layer throws). 5 tests.
- `SvgFilm`: svg + progress bar/clock/speed (playbackRate)/replay/layer list/nudge buttons per layer
  (character moves without redraw). 3 tests (incl. catching a real id-prefix bug).
- EntityPreview migrated from canvas to SVG film (same props); dependents updated.
- Verification: 216/216 tests, `tsc` 0, coverage 90.5%/80.1%/91%, build OK.

## Session 12 — two-phase film (user re-read the reference: fills DO exist)
Re-read found what was missed: EVERY path carries `--fl/--fd/--fo/--sc/--sso`; TOTAL=274s.
Phase 1 draws strokes (dashoffset), Phase 2 fades Gemma colors in (fillin) — user called it exactly.
- `scriptToSvg`: fills emitted with real color + `fill-opacity=0` + `class=fillin` + `--fl` after the
  whole stroke phase; schedule gains a fills entry (no nudge buttons); total covers the color phase.
- CSS: removed `fill:none !important` (it would kill colors forever); `.fillin` runs draw+fillin with
  two delays; `@keyframes svgf-fillin`.
- Prompts: lineArtBlock rewritten to two-phase (strokes-only Phase 1, CORRECT-color fillin Phase 2);
  example regained a colored fill step; audit 'fills' finding removed (fills legitimate again).
- Verification: 219/219 tests, `tsc` 0, coverage 90.6%/80.0%/91.0%, build OK.

## Session 13 — uniform speed + post-draw verification (user order)
- Uniform drawing speed: `--d` now proportional to parsed path length (260 units/s, zero-length dots
  pop instantly by design); unparseable paths fall back to the fixed beat. Long limbs no longer draw
  faster than short details. 2 timing tests.
- `verifyFilm(svg)`: re-checks the finished markup — path counts per layer, unparseable/degenerate/
  off-frame issues, empty film flag. `SvgFilm` shows the verdict line (`film-check` testid).
  4 verification tests + 1 component test.
- Verification: 231/231 tests, `tsc` 0, coverage 90.7%/80.5%/90.7%, build OK.

## Session 15 — katana references (user-supplied SVGs)
- Analyzed Katana-02.svg (173KB, 95 paths, Illustrator): 7 vertical katanas in a row (bbox-clustered
  strips); colors via gradients. Decomposed programmatically into 7 standalone SVGs
  (public/reference/katana/*.svg, 7–61KB) + inventory (bbox/paths/bytes).
- Katana.svg scene (2.8MB, katana with saya in a room) stored as drawing-example reference.
- `lib/katana-reference.ts`: pieces inventory (file-locked test), KATANA_BRIEF (tsuka/tsuba/blade/
  hamon/saya construction), remix prefix, scene caption.
- UI: KatanaGallery on items page (7 piece imgs + remix buttons feeding EntityGenerator preset +
  room-scene example); EntityGenerator `preset` prop. 5 UI tests.
- Verification: 260/260 tests, `tsc` 0, coverage 91.3%/81.5%/93.2%, build OK.

## Session 14 — parts decomposition, z-order panel, frame diff (user order)
- Schema: optional `step.part` (backward compatible).
- Prompts: PARTS_BLOCK in BASE + director (closed contours per component, back-to-front z-order,
  landscape→buildings→roads→actors, part naming).
- `scriptToSvg`: nested `<g data-part>` groups (readable latin ids via transliteration + collision
  suffix), `parts[]` schedule (z-order = paint order), shiftPartMarkup, highlightPartMarkup (red),
  diffParts (geometry compare minus labels; added/removed included).
- `verifyFilm` rewritten for nested groups (part blocks first, then plain layers).
- `SvgFilm`: parts panel (z# badges, select→red toggle, per-part nudge, progressive reveal, fills
  row w/o buttons); layer nudge replaced by part nudge.
- SceneComposer "Новая версия": diff vs parent in status (only changed parts re-saved next frame).
- Verification: 247/247 tests, `tsc` 0, coverage 91% lines / 81.2% branches, build OK.
