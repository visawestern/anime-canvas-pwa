import type { DrawingScript } from './drawing-script-schema';
import { saveScript, loadScript, listScripts } from './library-store';

export type EntityKind = 'character' | 'item' | 'location' | 'scene';

export interface Entity {
  id: string;
  kind: EntityKind;
  name: string;
  script: DrawingScript;
  parentId?: string | null;
  locationId?: string | null;
  cast?: { characters: string[]; items: string[] };
  /** remix source reference id (e.g. 'anime-girl'), null when original */
  basedOn?: string | null;
  createdAt: number;
  updatedAt: number;
}

export type NewEntity = Omit<Entity, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

const PREFIX = 'entity:';

function key(id: string): string {
  return `${PREFIX}${id}`;
}

function uid(kind: EntityKind): string {
  return `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isEntity(v: unknown): v is Entity {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    (e.kind === 'character' || e.kind === 'item' || e.kind === 'location' || e.kind === 'scene') &&
    typeof e.name === 'string'
  );
}

/** Upsert entity into the offline library. Never invents ids for lookups — only for new saves. */
export async function saveEntity(input: NewEntity): Promise<Entity> {
  const now = Date.now();
  const existing = input.id ? await getEntity(input.id) : undefined;
  const entity: Entity = {
    ...input,
    id: input.id ?? uid(input.kind),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await saveScript(key(entity.id), entity);
  return entity;
}

export async function getEntity(id: string): Promise<Entity | undefined> {
  const v = await loadScript(key(id));
  return isEntity(v) ? v : undefined;
}

export async function listEntities(kind?: EntityKind): Promise<Entity[]> {
  const ids = await listScripts();
  const out: Entity[] = [];
  for (const sid of ids) {
    if (!sid.startsWith(PREFIX)) continue;
    const v = await loadScript(sid);
    if (isEntity(v) && (!kind || v.kind === kind)) out.push(v);
  }
  return out.sort((a, b) => a.createdAt - b.createdAt);
}

export async function findEntityByName(kind: EntityKind, name: string): Promise<Entity | undefined> {
  const all = await listEntities(kind);
  return all.find((e) => e.name === name);
}

export async function deleteEntity(id: string): Promise<void> {
  // library-store has no delete; overwrite with tombstone-free removal via fresh key?
  // Honest approach: store explicit null marker so getEntity returns undefined.
  await saveScript(key(id), null);
}

/** New scene from a scene: keeps script/cast/location, links parent, applies overrides. */
export async function forkScene(
  sceneId: string,
  overrides: { name: string; script?: DrawingScript; cast?: Entity['cast']; locationId?: string | null },
): Promise<Entity> {
  const src = await getEntity(sceneId);
  if (!src || src.kind !== 'scene') throw new Error(`scene not found: ${sceneId}`);
  return saveEntity({
    kind: 'scene',
    name: overrides.name,
    script: overrides.script ?? src.script,
    parentId: src.id,
    locationId: overrides.locationId !== undefined ? overrides.locationId : src.locationId,
    cast: overrides.cast ?? src.cast,
    basedOn: src.basedOn ?? null,
  });
}
