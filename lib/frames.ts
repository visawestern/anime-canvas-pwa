import { saveScript, loadScript, listScripts } from './library-store';

export interface Frame {
  id: string;
  prevId: string | null;
  createdAt: number;
  /** full markup for base frames; null for diff frames */
  full: string | null;
  /** part-gid -> replacement block ('' = deleted part) */
  patches: Record<string, string>;
  changed: string[];
  bytes: number;
}

const PREFIX = 'frame:';

function key(id: string): string {
  return `${PREFIX}${id}`;
}

function uid(): string {
  return `fr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isFrame(v: unknown): v is Frame {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as Record<string, unknown>).id === 'string' &&
    typeof (v as Record<string, unknown>).patches === 'object'
  );
}

/** Split film markup into part blocks (top-level layer groups keep document order). */
function partBlocks(svg: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /<g id="([^"]+)" data-part="[^"]*"[^>]*>[\s\S]*?<\/g>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) {
    out.set(m[1], m[0]);
  }
  return out;
}

/**
 * Save an SVG frame. The first frame stores full markup; every next frame stores
 * ONLY the diff (changed part blocks) against the previous one. Recorded back so
 * the next frame can diff against it.
 */
export async function saveFrame(svg: string, prevId: string | null): Promise<Frame> {
  let patches: Record<string, string> = {};
  let changed: string[] = [];
  if (prevId !== null) {
    const base = await loadFrameSvg(prevId);
    const a = partBlocks(base);
    const b = partBlocks(svg);
    patches = {};
    changed = [];
    for (const [gid, block] of b) {
      if (a.get(gid) !== block) {
        patches[gid] = block;
        changed.push(gid);
      }
    }
    for (const gid of a.keys()) {
      if (!b.has(gid)) {
        patches[gid] = '';
        changed.push(gid);
      }
    }
  }
  const frame: Frame = {
    id: uid(),
    prevId,
    createdAt: Date.now(),
    full: prevId === null ? svg : null,
    patches,
    changed,
    bytes: 0,
  };
  frame.bytes = JSON.stringify(frame).length;
  await saveScript(key(frame.id), frame);
  return frame;
}

/** Resolve a frame (following the diff chain) back to full SVG markup. */
export async function loadFrameSvg(id: string): Promise<string> {
  const chain: Frame[] = [];
  const seen = new Set<string>();
  let cur: string | null = id;
  let hops = 0;
  while (cur !== null) {
    if (seen.has(cur) || hops++ > 100) throw new Error(`frame chain broken at ${cur}`);
    seen.add(cur);
    const v = await loadScript(key(cur));
    if (!isFrame(v)) throw new Error(`frame not found: ${cur}`);
    chain.unshift(v);
    cur = v.prevId;
  }
  const base = chain[0];
  if (!base || base.full === null) throw new Error(`frame chain has no base: ${id}`);
  let out = base.full;
  for (const f of chain.slice(1)) {
    for (const [gid, block] of Object.entries(f.patches)) {
      const re = new RegExp(`<g id="${gid}" data-part="[^"]*"[^>]*>[\\s\\S]*?<\\/g>`);
      if (block === '') {
        out = out.replace(re, '');
      } else if (re.test(out)) {
        out = out.replace(re, block);
      } else {
        // new part: append inside its layer is unknowable from the patch alone —
        // patches always carry full blocks, so a missing gid means a broken chain
        throw new Error(`frame patch target missing: ${gid}`);
      }
    }
  }
  return out;
}

export async function listFrames(): Promise<Frame[]> {
  const out: Frame[] = [];
  for (const sid of await listScripts()) {
    if (!sid.startsWith(PREFIX)) continue;
    const v = await loadScript(sid);
    if (isFrame(v)) out.push(v);
  }
  return out.sort((a, b) => a.createdAt - b.createdAt);
}
