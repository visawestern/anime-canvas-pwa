import type { Entity } from './entities';
import { saveScript, loadScript, listScripts } from './library-store';

export interface SceneRequest {
  prompt: string;
  characters: string[];
  items: string[];
  location: string | null;
}

export interface LibraryIndex {
  characters: Set<string>;
  items: Set<string>;
  locations: Set<string>;
}

export interface MissingReport {
  characters: string[];
  items: string[];
  location: string | null;
}

export type QueuedStatus = 'paused' | 'ready';

export interface QueuedPrompt extends SceneRequest {
  id: string;
  status: QueuedStatus;
  createdAt: number;
  updatedAt: number;
}

/** Pure: who from the requested cast is not drawn yet (draw proposals). */
export function resolveCast(req: SceneRequest, lib: LibraryIndex): MissingReport {
  return {
    characters: req.characters.filter((n) => !lib.characters.has(n)),
    items: req.items.filter((n) => !lib.items.has(n)),
    location: req.location && !lib.locations.has(req.location) ? req.location : null,
  };
}

export function isComplete(missing: MissingReport): boolean {
  return missing.characters.length === 0 && missing.items.length === 0 && missing.location === null;
}

/** Enriched prompt for Gemma: scene action + cast looks (names + palettes) for face consistency. */
export function composeScenePrompt(
  req: SceneRequest,
  cast: { characters: Entity[]; items: Entity[]; location?: Entity | null },
): string {
  const lines = [`Scene action: ${req.prompt}`];
  for (const c of cast.characters) {
    lines.push(`Actor "${c.name}" (keep face/hair/outfit consistent), palette: ${(c.script?.style?.palette ?? []).join(', ')}`);
  }
  for (const i of cast.items) {
    lines.push(`Item "${i.name}", palette: ${(i.script?.style?.palette ?? []).join(', ')}`);
  }
  if (cast.location) lines.push(`Location "${cast.location.name}" as backdrop.`);
  else if (req.location) lines.push(`Location "${req.location}" (new backdrop, invent in-style).`);
  return lines.join('\n');
}

const PREFIX = 'queue:';

function qkey(id: string): string {
  return `${PREFIX}${id}`;
}

function isQueued(v: unknown): v is QueuedPrompt {
  return typeof v === 'object' && v !== null && typeof (v as Record<string, unknown>).id === 'string';
}

/** The current scene prompt is never lost: pause it into the queue while missing cast is drawn. */
export async function enqueuePaused(req: SceneRequest): Promise<QueuedPrompt> {
  const now = Date.now();
  const q: QueuedPrompt = {
    ...req,
    id: `qp-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    status: 'paused',
    createdAt: now,
    updatedAt: now,
  };
  await saveScript(qkey(q.id), q);
  return q;
}

export async function listQueue(): Promise<QueuedPrompt[]> {
  const out: QueuedPrompt[] = [];
  for (const sid of await listScripts()) {
    if (!sid.startsWith(PREFIX)) continue;
    const v = await loadScript(sid);
    if (isQueued(v)) out.push(v);
  }
  return out.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getQueued(id: string): Promise<QueuedPrompt | undefined> {
  const v = await loadScript(qkey(id));
  return isQueued(v) ? v : undefined;
}

/** Edit a paused prompt (text/cast) without losing its place in the queue. */
export async function editQueuedPrompt(
  id: string,
  patch: Partial<Pick<SceneRequest, 'prompt' | 'characters' | 'items' | 'location'>>,
): Promise<QueuedPrompt> {
  const q = await getQueued(id);
  if (!q) throw new Error(`queued prompt not found: ${id}`);
  const next: QueuedPrompt = { ...q, ...patch, status: 'paused', updatedAt: Date.now() };
  await saveScript(qkey(id), next);
  return next;
}

export type ResumeResult =
  | { status: 'ready'; request: SceneRequest }
  | { status: 'still-missing'; missing: MissingReport };

/** Re-check the cast; when complete the paused prompt becomes generatable (status ready). */
export async function resumeQueuedPrompt(id: string, lib: LibraryIndex): Promise<ResumeResult> {
  const q = await getQueued(id);
  if (!q) throw new Error(`queued prompt not found: ${id}`);
  const missing = resolveCast(q, lib);
  if (isComplete(missing)) {
    const ready: QueuedPrompt = { ...q, status: 'ready', updatedAt: Date.now() };
    await saveScript(qkey(id), ready);
    const { prompt, characters, items, location } = ready;
    return { status: 'ready', request: { prompt, characters, items, location } };
  }
  return { status: 'still-missing', missing };
}

export async function removeQueued(id: string): Promise<void> {
  await saveScript(qkey(id), null);
}
