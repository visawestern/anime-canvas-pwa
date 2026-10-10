/**
 * Lesson knowledge base distilled from full drawing guides:
 * - risunci.com (8-step anime guy, 12-step full body)
 * - purmix.net (kiss of Jellal & Erza: 9-step two-character interaction, pencil grades)
 * - art-bogema.ru (anime from zero: face/body canon, materials, practice)
 * - coddyschool.com (styles, proportions 6-7 heads / chibi 2-3, action line, highlights, hair masses)
 * Used to ground director prompts AND the pencil engine grade semantics.
 */

export interface LessonSource {
  site: string;
  url: string;
  topics: string[];
}

export const LESSON_SOURCES: LessonSource[] = [
  {
    site: 'risunci.com',
    url: 'https://risunci.com/risuem-anime/uchimsya-risovat-parnya-anime-karandashami/',
    topics: ['8-step anime guy', 'circle+chin head', 'near-arm perspective', 'inking then shading'],
  },
  {
    site: 'risunci.com',
    url: 'https://risunci.com/risuem-anime/risuem-telo-v-polnyj-rost/',
    topics: ['12-step full body', 'pose axis + joint skeleton', 'natural chest rule', 'elbow bump + fingers'],
  },
  {
    site: 'purmix.net',
    url: 'https://purmix.net/urok/kak_narisovat_poceluj_jelzy_i_zherara_iz_anime_skazka_o_hvoste_fei.html',
    topics: [
      '9-step kiss interaction (Jellal & Erza)',
      'both faces first, then per-character hair and clothes',
      'pencil grades HB/B/B2/B4/B6 pipeline',
      'B6 eyes + final contour, HB shadows, B/B2/B4 hatching',
    ],
  },
  {
    site: 'art-bogema.ru',
    url: 'https://art-bogema.ru/uncategorized/kak-nauchitsya-risovat-anime-karandashom/',
    topics: [
      'academic basics: pencil control, dense paper, eraser + kneaded eraser',
      'general forms before details, anatomy for movement',
      'face canon: pointed chin, low forehead, small nose/lips, wide-set big eyes, wide cheekbones',
      'eyes as compositional center, round, lower lid unfinished; body: wide hips, narrow waist, long legs',
      'clothes convey character and sit on the figure',
    ],
  },
  {
    site: 'coddyschool.com',
    url: 'https://coddyschool.com/blog/how-to-learn-to-draw-anime/',
    topics: [
      'styles: Ghibli classic / commercial / minimal / realistic; shonen/shojo/seinen/josei',
      'proportions: adult 6-7 heads tall, chibi 2-3 heads; eye guide at head middle',
      'action line + geometric skeleton; eyes mirror character (round=young, narrow=mature)',
      'eye highlights give life; hair as masses with own physics; daily sketchbook practice',
    ],
  },
];

export interface PencilGrade {
  grade: 'HB' | 'B' | 'B2' | 'B4' | 'B6';
  /** stroke width range in 0..512 viewBox units */
  w: [number, number];
  /** opacity range */
  o: [number, number];
  use: string;
}

/** Purmix pipeline: HB constructs, B-family hatches, B6 inks eyes and final contour. */
export const PENCIL_GRADES: PencilGrade[] = [  { grade: 'HB', w: [1.0, 1.4], o: [0.45, 0.6], use: 'construct: faces, hair contours, clothes shapes, HB shadows' },
  { grade: 'B', w: [1.3, 1.7], o: [0.6, 0.75], use: 'develop: hair hatching, clothes shading' },
  { grade: 'B2', w: [1.4, 1.8], o: [0.65, 0.8], use: 'develop: faces, clothes hatching' },
  { grade: 'B4', w: [1.6, 2.0], o: [0.7, 0.85], use: 'deepen: hair masses, clothes folds' },
  { grade: 'B6', w: [2.2, 2.8], o: [0.95, 1.0], use: 'contour: eyes, nose line, hair outline, final ink contour' },
];

/** Purmix two-character interaction order: faces together, then per-character passes. */
export const INTERACTION_ORDER: string[] = [
  'Both faces first (construction + eyes + mouth/nose) so the interaction reads immediately',
  'Hair of character 1, then hair of character 2 (separate layers)',
  'Clothes of character 1, then clothes of character 2 (separate layers)',
  'Shade both faces (HB shadow, B6 nose line, hatch neck), then hatch hair per character, then clothes',
  'Final B6 contour pass over the whole interaction',
];

/** art-bogema face canon. */
export const FACE_RULES: string[] = [
  'Pointed chin, low forehead, small nose and lips',
  'Eyes wide apart, bigger than mouth; wide cheekbones',
  'Build from ball + oval, then exaggerate',
  'Eyes are the compositional center: round (not almond), lower lid left unfinished',
  'Emotion lives in the eyes; always add highlights or the face looks dead',
];

/** art-bogema + coddyschool body canon. */
export const BODY_RULES: string[] = [
  'Adult 6-7 heads tall; chibi 2-3 heads tall',
  'Female: wide hips, narrow waist, legs exaggeratedly long vs torso',
  'Exaggerated shape, but movement follows classical anatomy',
  'Eye guide line at the middle of the head',
  'Clothes must convey character and sit on the figure, folds follow the body',
];

/** coddyschool style canon. */
export const STYLE_RULES: string[] = [
  'Start every pose with an action line: one dynamic curve carrying the movement',
  'Then a skeleton of simple geometric forms, then masses, then details',
  'Round big eyes = youth/innocence; narrow eyes = maturity/cunning',
  'Hair is drawn as masses, not strands; anime hair has its own physics, ignore gravity for flow',
  'Eye highlights are mandatory: they give the drawing life, never leave eyes flat',
  'Know the sub-style (shonen/shojo/seinen/josei, classic/commercial/minimal) and keep it consistent',
];

/** art-bogema + coddyschool materials: what the hand holds. Engine maps: paper -> canvas bg, grades -> w/o bands. */
export const MATERIALS: string[] = [
  'Dense paper (плотная бумага): holds layered hatching without tearing; engine paper base #f7f2e8',
  'Eraser + kneaded eraser (клячка): kneaded lifts graphite softly for highlights instead of scraping',
  'Pencil grades HB->B6 for construction->ink (see PENCIL_GRADES); soft pencils give delicate hair lines',
  'Liners and Copic markers (coddy): even ink lines and smooth gradient fills; digital equivalent is ink layer + flat fills',
  'Digital layers (Clip Studio Paint): construction / ink / fill / shade separated — same as cel layers',
];

/** coddyschool + art-bogema practice regimen: the main key to success. */
export const PRACTICE: string[] = [
  'Daily sketchbook (скетчбук): at least one drawing a day',
  'Pose challenges: draw one character in many poses via the action line',
  'Emotion challenges: one face, many emotions — eyes carry them',
  'Study the masters and analyse their style: Kishimoto (Naruto), Oda (One Piece), Miura (Berserk), CLAMP',
  'Draw deliberately: set a task per drawing and analyse the result (purmix advice)',
];

/** Compact brief appended to director prompts so Gemma draws by the lessons, not by guess. */
export function lessonBlock(): string {  const grades = PENCIL_GRADES.map((g) => `${g.grade}(w ${g.w[0]}-${g.w[1]}, o ${g.o[0]}-${g.o[1]}): ${g.use}`).join('; ');
  return [
    'LESSON CANON (risunci + purmix + art-bogema + coddyschool). Obey in every DrawingScript:',
    `Pencil grades: ${grades}. Set each stroke w/o inside its grade band.`,
    `Two-character interaction: ${INTERACTION_ORDER.join(' -> ')}.`,
    `Face: ${FACE_RULES.join('; ')}.`,
    `Body: ${BODY_RULES.join('; ')}.`,
    `Style: ${STYLE_RULES.join('; ')}.`,
  ].join('\n');
}

/** Map a stroke to its pencil grade by w/o bands. Undefined = outside every grade (impossible pencil). */
export function gradeOfStroke(s: { w?: number; o?: number }): PencilGrade | undefined {
  const w = s.w ?? 1.5;
  const o = s.o ?? 1;
  return PENCIL_GRADES.find((g) => w >= g.w[0] && w <= g.w[1] && o >= g.o[0] && o <= g.o[1]);
}

const W_TOL = 0.3;
const O_TOL = 0.15;

export interface SnappedStroke {
  w: number;
  o: number;
  grade: PencilGrade['grade'];
  snapped: boolean;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Snap near-miss w/o into the nearest grade band (live o=0.4 case).
 * Exact bands pass through untouched; garbage far from every band stays undefined.
 */
export function snapStrokeToGrade(w: number, o: number): SnappedStroke | undefined {
  const exact = gradeOfStroke({ w, o });
  if (exact) return { w, o, grade: exact.grade, snapped: false };
  let best: { g: PencilGrade; dw: number; do: number } | undefined;
  for (const g of PENCIL_GRADES) {
    const dw = w < g.w[0] ? g.w[0] - w : w > g.w[1] ? w - g.w[1] : 0;
    const doff = o < g.o[0] ? g.o[0] - o : o > g.o[1] ? o - g.o[1] : 0;
    if (dw <= W_TOL && doff <= O_TOL && (!best || dw + doff < best.dw + best.do)) {
      best = { g, dw, do: doff };
    }
  }
  if (!best) return undefined;
  return { w: clamp(w, best.g.w[0], best.g.w[1]), o: clamp(o, best.g.o[0], best.g.o[1]), grade: best.g.grade, snapped: true };
}

/**
 * Fenced minimal example the model must copy EXACTLY (key names and shapes).
 * Self-checked by test: the embedded JSON validates against DrawingScriptSchema.
 */
export function exampleBlock(): string {
  return `Copy this EXACT shape — key names, nesting and value types must match precisely
(style.palette is an ARRAY of strings, every step has a numeric id, every stroke has a string path,
every bone has name/from/to, morphTargets is an ARRAY, anim.loop is a STRING):

\`\`\`json
{"style":{"palette":["#2b3a8f","#fff5f7"],"linePencil":"#6b7280","lineInk":"#14121f"},"layers":["construction","ink","fill"],"steps":[{"id":1,"kind":"pencil","layer":"construction","label":"axis","strokes":[{"path":"M10 10 L40 40","w":1.2,"o":0.5}]},{"id":2,"kind":"ink","layer":"ink","strokes":[{"path":"M10 10 L40 40","w":2.4,"o":1}]},{"id":3,"kind":"fill","layer":"fill","fills":[{"path":"M0 0 L10 0 L10 10 Z","color":"#fff5f7"}]}],"rig":{"bones":[],"morphTargets":[]},"anim":{"fps":12,"loop":"idle","dirtyLayers":[]}}
\`\`\``;
}
