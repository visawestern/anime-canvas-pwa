import { describe, it, expect } from 'vitest';
import { buildChatRequest, parseModelJson } from '@/lib/ollama';

describe('ollama request builder', () => {
  it('builds chat request with base64 image and json format', () => {
    const req = buildChatRequest({ imageBase64: 'ABC123', prompt: 'draw', model: 'gemma4:31b-cloud' });
    expect(req.model).toBe('gemma4:31b-cloud');
    expect(req.format).toBe('json');
    expect(req.stream).toBe(false);
    expect(req.messages).toHaveLength(1);
    expect(req.messages[0].images).toEqual(['ABC123']);
    expect(req.messages[0].content).toContain('draw');
  });

  it('throws on empty image (no fake drawing)', () => {
    expect(() => buildChatRequest({ imageBase64: '', prompt: 'x', model: 'gemma4:31b-cloud' })).toThrow();
  });
});

describe('parseModelJson', () => {
  it('extracts JSON from fenced code block', () => {
    const raw = '```json\n{"a":1}\n```';
    expect(parseModelJson(raw)).toEqual({ a: 1 });
  });

  it('parses raw JSON', () => {
    expect(parseModelJson('{"a":2}')).toEqual({ a: 2 });
  });

  it('throws on non-JSON (never silently simplify)', () => {
    expect(() => parseModelJson('sorry, no json here')).toThrow();
  });
});
