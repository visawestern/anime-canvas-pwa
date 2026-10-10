import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EntityGenerator } from '@/components/EntityGenerator';

vi.mock('@/lib/entities', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/entities')>();
  return { ...mod, saveEntity: vi.fn(async (e: unknown) => ({ ...(e as object), id: 'character-1' })) };
});

import { saveEntity } from '@/lib/entities';

const script = {
  style: { palette: ['#fff'], linePencil: '#666', lineInk: '#111' },
  layers: ['a'],
  steps: [{ id: 1, kind: 'pencil', layer: 'a', strokes: [{ path: 'M0 0 L10 10' }] }],
  rig: { bones: [], morphTargets: [] },
  anim: { fps: 12, loop: 'x', dirtyLayers: [] },
};

describe('EntityGenerator (new character/item/location by prompt)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => script })) as never);
  });

  it('generates from prompt and saves entity with given name', async () => {
    render(<EntityGenerator kind="character" title="Новый персонаж" onSaved={() => {}} />);
    fireEvent.change(screen.getByLabelText(/имя/i), { target: { value: 'Ая' } });
    fireEvent.change(screen.getByLabelText(/промпт/i), { target: { value: 'девочка-волшебница' } });
    fireEvent.click(screen.getByRole('button', { name: /нарисовать/i }));
    await waitFor(() => expect(saveEntity).toHaveBeenCalled());
    expect(vi.mocked(saveEntity).mock.calls[0][0]).toMatchObject({ kind: 'character', name: 'Ая' });
    expect(screen.getByText(/сохранено/i)).toBeInTheDocument();
  });

  it('requires name and prompt (no empty generation)', async () => {
    render(<EntityGenerator kind="item" title="Новый предмет" onSaved={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /нарисовать/i }));
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByText(/имя и промпт/i)).toBeInTheDocument();
  });

  it('shows honest error when Ollama fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({ error: 'down' }) })) as never);
    render(<EntityGenerator kind="location" title="Новое место" onSaved={() => {}} />);
    fireEvent.change(screen.getByLabelText(/имя/i), { target: { value: 'Храм' } });
    fireEvent.change(screen.getByLabelText(/промпт/i), { target: { value: 'храм' } });
    fireEvent.click(screen.getByRole('button', { name: /нарисовать/i }));
    await waitFor(() => expect(screen.getByText(/down/i)).toBeInTheDocument());
    expect(saveEntity).not.toHaveBeenCalled();
  });

  it('template picker fills prompt and suggests a name', async () => {
    render(<EntityGenerator kind="character" title="Новый персонаж" onSaved={() => {}} />);
    fireEvent.change(screen.getByLabelText(/шаблон/i), { target: { value: 'character-shojo-heroine' } });
    expect((screen.getByLabelText(/промпт/i) as HTMLTextAreaElement).value).toContain('волшебница');
    expect((screen.getByLabelText(/имя/i) as HTMLInputElement).value).toBe('Ая');
  });
});
