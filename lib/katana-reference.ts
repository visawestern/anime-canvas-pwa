/**
 * Katana drawing references (user-supplied):
 * - pack: Katana-02.svg decomposed into 7 standalone pieces (vertical blades + handle clusters)
 * - scene: Katana.svg — single katana with saya (sheath) in a room, drawing example
 * Pieces are remix bases for item generation (same pattern as the anime-girl reference).
 */
import pieces from './katana-pieces.json';

export interface KatanaPiece {
  id: string;
  file: string;
  bbox: [number, number, number, number];
  paths: number;
  bytes: number;
}

export const KATANA_PIECES: KatanaPiece[] = pieces as KatanaPiece[];

export const KATANA_SCENE = {
  file: '/reference/katana-scene.svg',
  caption: 'Пример рисовки: одиночная катана с ножнами (сая) в комнате',
} as const;

export const KATANA_REMIX_PREFIX = 'Сделай катану в духе эталона ';

export const KATANA_BRIEF = `Эталон пачки катан (7 вертикальных клинков, чистая векторная геометрия).
Конструкция катаны: tsuka (рукоять с оплёткой-ромбами, навершие-поммель), tsuba (круглая гарда),
blade (клинок: дол/fuller вдоль обуха, hamon — волнистая линия закалки у кромки),
saya (лакированные ножны), sageo (шнур с кистью). Ремикс: сохрани конструкцию частей и
вертикальную подачу, меняй материалы, палитру и гравировку по задаче пользователя ниже.`;
