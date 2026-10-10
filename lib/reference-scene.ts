/**
 * Default scene remix base: "Anime Girl" vector illustration by Niabot (2008),
 * Wikimedia Commons, licensed CC BY 3.0 (remix allowed WITH attribution) + GFDL 1.2+.
 * Source: https://ru.wikipedia.org/wiki/Файл:Anime_Girl.svg
 * File: public/reference/anime-girl.svg (checked in, 1052x744, 834 paths, 86 groups).
 * Technique notes come from the file description: dutch angle, deliberately retraced
 * outer contours, manga hair layering (hair behind huge eyes, brows over hair),
 * blue sky + blooming sakura background.
 */

export const REFERENCE_ID = 'anime-girl';

export interface ReferenceMeta {
  id: string;
  title: string;
  author: string;
  license: string;
  sourceUrl: string;
  fileUrl: string;
  width: number;
  height: number;
  paths: number;
  groups: number;
  palette: string[];
  techniques: string[];
}

export const REFERENCE_META: ReferenceMeta = {
  id: REFERENCE_ID,
  title: 'Anime Girl (Sythatia)',
  author: 'Niabot',
  license: 'CC BY 3.0',
  sourceUrl: 'https://ru.wikipedia.org/wiki/Файл:Anime_Girl.svg',
  fileUrl: '/reference/anime-girl.svg',
  width: 1052,
  height: 744,
  paths: 834,
  groups: 86,
  palette: ['#ff8719', '#feb039', '#c83901', '#2a882a', '#cbffcb', '#d6a488', '#efd7d2', '#4bb6ff'],
  techniques: [
    'dutch angle: diagonal composition, character along the long diagonal',
    'sharp deliberately retraced outer contours over soft interior shading',
    'manga hair layering: hair masses behind huge highlighted eyes, brows drawn over hair',
    'blue sky + blooming sakura background motif',
    'warm autumn palette with natural skin tones, 2-tone cel-like shading',
  ],
};

export const REFERENCE_REMIX_PREFIX = 'Измени эталон Anime Girl: ';

/** Prepended to the scene prompt when remixing the reference — the model redraws its look. */
export const REFERENCE_BRIEF = `Эталон Anime Girl (Niabot, CC BY 3.0, public/reference/anime-girl.svg) — дефолтный шаблон сцены.
Рисуй В ЕГО ДУХЕ, меняя по задаче пользователя ниже. Конструкция эталона:
- dutch angle (голландский угол): диагональная композиция, персонаж вдоль длинной диагонали;
- резкий deliberate retraced контур поверх мягкой внутренней штриховки;
- manga-укладка волос: массы волос ЗА огромными глазами с бликами, брови ПОВЕРХ волос;
- фон: голубое небо + цветущая сакура; тёплая осенняя палитра ${REFERENCE_META.palette.slice(0, 5).join(', ')} + кожа;
- полный рост, чистая векторная геометрия, замкнутые заливки.
Сохрани порядок слоёв уроков и слои actor_<имя> для каждого действующего лица.`;
