import { describe, it, expect } from 'vitest';
import { HistoryTree } from '@/lib/history';

describe('HistoryTree linear undo/redo', () => {
  it('commits and returns current state', () => {
    const h = new HistoryTree<string>('empty');
    h.commit('draw head', 'head');
    expect(h.state()).toBe('head');
    expect(h.size()).toBe(2);
  });

  it('undo/redo moves along the line', () => {
    const h = new HistoryTree<string>('empty');
    h.commit('a', 'A');
    h.commit('b', 'B');
    expect(h.undo()).toBe('A');
    expect(h.undo()).toBe('empty');
    expect(h.redo()).toBe('A');
    expect(h.redo()).toBe('B');
  });

  it('throws at root undo and at leaf redo (no silent no-op)', () => {
    const h = new HistoryTree<string>('empty');
    expect(() => h.undo()).toThrow();
    h.commit('a', 'A');
    expect(() => h.redo()).toThrow();
  });

  it('keeps 100 actions of depth (cap 100 nodes)', () => {
    const h = new HistoryTree<number>(0);
    for (let i = 1; i <= 105; i++) h.commit(`step ${i}`, i);
    expect(h.size()).toBeLessThanOrEqual(100);
    let n = 0;
    while (h.canUndo()) {
      h.undo();
      n++;
    }
    expect(n).toBeGreaterThanOrEqual(99);
  });
});

describe('HistoryTree branches (local github analog)', () => {
  it('undo 10 + 20 new commits keeps both trees reachable', () => {
    const h = new HistoryTree<string>('s0');
    for (let i = 1; i <= 30; i++) h.commit(`step ${i}`, `s${i}`);
    for (let i = 0; i < 10; i++) h.undo(); // back at s20
    expect(h.state()).toBe('s20');
    for (let i = 1; i <= 20; i++) h.commit(`alt ${i}`, `a${i}`);
    // branch point s20 now has 2 children
    const kids = h.childrenOf(h.findByLabel('step 20')!);
    expect(kids.map((k) => k.label)).toContain('step 21');
    expect(kids.map((k) => k.label)).toContain('alt 1');
    // old tree still reachable: jump back to first branch tip
    h.jumpTo(h.findByLabel('step 30')!);
    expect(h.state()).toBe('s30');
    // and back to the new branch tip
    h.jumpTo(h.findByLabel('alt 20')!);
    expect(h.state()).toBe('a20');
  });

  it('redo follows the last-active branch, explicit childId overrides', () => {
    const h = new HistoryTree<string>('s0');
    h.commit('v1', 'V1');
    h.undo();
    h.commit('v2', 'V2');
    h.undo(); // at s0, children: [v1, v2], active = v2
    expect(h.redo()).toBe('V2');
    h.undo();
    expect(h.redo(h.findByLabel('v1')!)).toBe('V1');
  });

  it('log is chronological with depth, branch and current marker', () => {
    const h = new HistoryTree<string>('s0');
    h.commit('one', 'S1');
    const log = h.log();
    expect(log.map((e) => e.label)).toEqual(['init', 'one']);
    expect(log[0].depth).toBe(0);
    expect(log[1].depth).toBe(1);
    expect(log[1].isCurrent).toBe(true);
    expect(log[0].isCurrent).toBe(false);
    expect(log[1].branch).toBe(0);
  });

  it('jumpTo unknown id throws', () => {
    const h = new HistoryTree<string>('s0');
    expect(() => h.jumpTo('nope')).toThrow();
  });
});
