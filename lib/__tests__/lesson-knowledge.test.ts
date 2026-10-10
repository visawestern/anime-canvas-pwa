import { describe, it, expect } from 'vitest';
import {
  LESSON_SOURCES,
  PENCIL_GRADES,
  INTERACTION_ORDER,
  FACE_RULES,
  BODY_RULES,
  STYLE_RULES,
  MATERIALS,
  PRACTICE,
  lessonBlock,
  exampleBlock,
  snapStrokeToGrade,
} from '@/lib/lesson-knowledge';
import { DrawingScriptSchema } from '@/lib/drawing-script-schema';

describe('lesson-knowledge (purmix + risunci + art-bogema + coddyschool)', () => {
  it('lists all four lesson sources with urls', () => {
    expect(LESSON_SOURCES.length).toBeGreaterThanOrEqual(4);
    for (const s of LESSON_SOURCES) {
      expect(s.url).toMatch(/^https?:\/\//);
      expect(s.topics.length).toBeGreaterThan(0);
    }
    const urls = LESSON_SOURCES.map((s) => s.url).join(' ');
    expect(urls).toContain('purmix.net');
    expect(urls).toContain('art-bogema.ru');
    expect(urls).toContain('coddyschool.com');
    expect(urls).toContain('risunci.com');
  });

  it('maps pencil grades to stroke semantics (HB construct, B6 final contour)', () => {
    const hb = PENCIL_GRADES.find((g) => g.grade === 'HB')!;
    const b6 = PENCIL_GRADES.find((g) => g.grade === 'B6')!;
    expect(hb.use).toMatch(/construct/i);
    expect(b6.use).toMatch(/contour|eyes/i);
    expect(b6.w[0]).toBeGreaterThan(hb.w[1]); // B6 bolder than HB
    expect(PENCIL_GRADES.map((g) => g.grade)).toEqual(['HB', 'B', 'B2', 'B4', 'B6']);
  });

  it('interaction order draws both faces before hair/clothes (purmix kiss lesson)', () => {
    expect(INTERACTION_ORDER[0]).toMatch(/both faces|оба лица/i);
    expect(INTERACTION_ORDER.join(' ')).toMatch(/hair.*clothes|волосы.*одежда/i);
  });

  it('encodes face/body/style canons (exaggeration + anatomy)', () => {
    expect(FACE_RULES.join(' ')).toMatch(/chin|подбородок/i);
    expect(BODY_RULES.join(' ')).toMatch(/6-7 heads|6–7|chibi|чиби/i);
    expect(STYLE_RULES.join(' ')).toMatch(/action line|линия действия/i);
    expect(STYLE_RULES.join(' ')).toMatch(/highlight|блик/i);
  });

  it('lessonBlock renders a compact prompt-ready brief', () => {
    const b = lessonBlock();
    expect(b).toContain('B6');
    expect(b).toContain('DrawingScript');
    expect(b.length).toBeGreaterThan(200);
  });

  it('covers materials (paper, erasers, liners) from art-bogema/coddyschool', () => {
    const text = MATERIALS.join(' ');
    expect(text).toMatch(/плотная бумага|dense paper/i);
    expect(text).toMatch(/клячк|kneaded/i);
    expect(text).toMatch(/liner|линер|copic/i);
  });

  it('covers practice regimen (sketchbook, challenges, masters)', () => {
    const text = PRACTICE.join(' ');
    expect(text).toMatch(/скетчбук|sketchbook/i);
    expect(text).toMatch(/поз|pose/i);
    expect(text).toMatch(/эмоц|emotion/i);
    expect(text).toMatch(/кисимото|kishimoto|ода|oda|миура|miura|clamp/i);
  });

  it('exampleBlock contains a fenced example that validates against the schema', () => {
    const block = exampleBlock();
    const fenced = block.match(/```json\s*([\s\S]*?)```/);
    expect(fenced).toBeTruthy();
    const parsed = JSON.parse(fenced![1]) as unknown;
    expect(() => DrawingScriptSchema.parse(parsed)).not.toThrow();
    expect(block).toMatch(/EXACT|точно/i);
  });

  it('example is strokes-only line art (no fill steps, like the reference)', () => {
    const block = exampleBlock();
    const fenced = block.match(/```json\s*([\s\S]*?)```/);
    const parsed = JSON.parse(fenced![1]) as { steps: { kind: string }[] };
    expect(parsed.steps.length).toBeGreaterThan(0);
    expect(parsed.steps.every((s) => s.kind !== 'fill')).toBe(true);
  });

  it('snapStrokeToGrade tolerates near-misses (live o=0.4 case)', () => {
    const a = snapStrokeToGrade(1.2, 0.4);
    expect(a?.grade).toBe('HB');
    expect(a?.snapped).toBe(true);
    expect(a?.o).toBeGreaterThanOrEqual(0.45);
    const b = snapStrokeToGrade(1.6, 0.5);
    expect(b).toBeTruthy();
    expect(b?.snapped).toBe(true);
  });

  it('snapStrokeToGrade leaves exact bands untouched', () => {
    expect(snapStrokeToGrade(1.2, 0.5)).toMatchObject({ w: 1.2, o: 0.5, snapped: false });
  });

  it('snapStrokeToGrade rejects garbage (w=9 stays undefined)', () => {
    expect(snapStrokeToGrade(9, 1)).toBeUndefined();
    expect(snapStrokeToGrade(1.2, 0.05)).toBeUndefined();
  });
});
