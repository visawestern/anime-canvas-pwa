/** Local "github analog": undo/redo (100 depth) with full branch trees + event log. */

export interface HistoryNode<T> {
  id: string;
  parentId: string | null;
  label: string;
  state: T;
  createdAt: number;
  children: string[];
  activeChild: string | null;
}

export interface LogEntry {
  seq: number;
  id: string;
  label: string;
  parentId: string | null;
  depth: number;
  /** index among parent's children: 0 = first/main line */
  branch: number;
  isCurrent: boolean;
}

const MAX_NODES = 100;

function clone<T>(v: T): T {
  return typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v));
}

export class HistoryTree<T> {
  private nodes = new Map<string, HistoryNode<T>>();
  private currentId: string;
  private seq = 0;

  constructor(initialState: T, initialLabel = 'init') {
    this.currentId = this.makeId();
    this.nodes.set(this.currentId, {
      id: this.currentId,
      parentId: null,
      label: initialLabel,
      state: clone(initialState),
      createdAt: Date.now(),
      children: [],
      activeChild: null,
    });
  }

  private makeId(): string {
    this.seq += 1;
    return `n${this.seq}`;
  }

  size(): number {
    return this.nodes.size;
  }

  current(): HistoryNode<T> {
    const n = this.nodes.get(this.currentId);
    if (!n) throw new Error('history corrupted: current node missing');
    return n;
  }

  state(): T {
    return clone(this.current().state);
  }

  commit(label: string, state: T): string {
    const parent = this.current();
    const id = this.makeId();
    this.nodes.set(id, {
      id,
      parentId: parent.id,
      label,
      state: clone(state),
      createdAt: Date.now(),
      children: [],
      activeChild: null,
    });
    parent.children.push(id);
    parent.activeChild = id;
    this.currentId = id;
    this.prune();
    return id;
  }

  canUndo(): boolean {
    return this.current().parentId !== null;
  }

  canRedo(): boolean {
    return this.current().children.length > 0;
  }

  undo(): T {
    const cur = this.current();
    if (!cur.parentId) throw new Error('nothing to undo (at root)');
    this.currentId = cur.parentId;
    return this.state();
  }

  redo(childId?: string): T {
    const cur = this.current();
    if (cur.children.length === 0) throw new Error('nothing to redo (at tip)');
    const next = childId ?? cur.activeChild ?? cur.children[cur.children.length - 1];
    if (!cur.children.includes(next)) throw new Error(`not a child branch of current node: ${childId}`);
    cur.activeChild = next;
    this.currentId = next;
    return this.state();
  }

  jumpTo(id: string): T {
    const node = this.nodes.get(id);
    if (!node) throw new Error(`unknown history node: ${id}`);
    // walk up marking active path so redo() follows the jumped-to line
    let cur: HistoryNode<T> | undefined = node;
    while (cur?.parentId) {
      const parent = this.nodes.get(cur.parentId);
      if (!parent) break;
      parent.activeChild = cur.id;
      cur = parent;
    }
    this.currentId = id;
    return this.state();
  }

  childrenOf(id: string): HistoryNode<T>[] {
    const node = this.nodes.get(id);
    if (!node) throw new Error(`unknown history node: ${id}`);
    return node.children.map((c) => {
      const n = this.nodes.get(c);
      if (!n) throw new Error('history corrupted: child missing');
      return n;
    });
  }

  findByLabel(label: string): string | undefined {
    for (const n of this.nodes.values()) if (n.label === label) return n.id;
    return undefined;
  }

  log(): LogEntry[] {
    const depthOf = (id: string): number => {
      let d = 0;
      let cur = this.nodes.get(id);
      while (cur?.parentId) {
        d++;
        cur = this.nodes.get(cur.parentId);
      }
      return d;
    };
    return [...this.nodes.values()]
      .sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1))
      .map((n) => {
        const parent = n.parentId ? this.nodes.get(n.parentId) : undefined;
        return {
          seq: Number(n.id.slice(1)),
          id: n.id,
          label: n.label,
          parentId: n.parentId,
          depth: depthOf(n.id),
          branch: parent ? parent.children.indexOf(n.id) : 0,
          isCurrent: n.id === this.currentId,
        };
      });
  }

  /** Keep ≤100 nodes: drop oldest node off the current line, reattaching its children. */
  private prune(): void {
    while (this.nodes.size > MAX_NODES) {
      const ancestors = new Set<string>();
      let cur: HistoryNode<T> | undefined = this.current();
      while (cur) {
        ancestors.add(cur.id);
        cur = cur.parentId ? this.nodes.get(cur.parentId) : undefined;
      }
      const victim = [...this.nodes.values()]
        .filter((n) => !ancestors.has(n.id))
        .sort((a, b) => a.createdAt - b.createdAt)[0];
      if (!victim) {
        // pure linear overflow: drop the root, promote its child
        const root = [...this.nodes.values()].find((n) => n.parentId === null);
        if (!root || root.children.length === 0) break;
        const heir = root.children[0];
        this.nodes.delete(root.id);
        const heirNode = this.nodes.get(heir);
        if (heirNode) heirNode.parentId = null;
        for (const sib of root.children.slice(1)) {
          const s = this.nodes.get(sib);
          if (s) s.parentId = null;
        }
        continue;
      }
      // reattach victim's children to victim's parent (or make them roots)
      for (const c of victim.children) {
        const child = this.nodes.get(c);
        if (!child) continue;
        child.parentId = victim.parentId;
        if (victim.parentId) {
          const parent = this.nodes.get(victim.parentId);
          if (parent && !parent.children.includes(c)) parent.children.push(c);
          if (parent?.activeChild === victim.id) parent.activeChild = c;
        }
      }
      if (victim.parentId) {
        const parent = this.nodes.get(victim.parentId);
        if (parent) parent.children = parent.children.filter((c) => c !== victim.id);
      }
      this.nodes.delete(victim.id);
    }
  }
}
