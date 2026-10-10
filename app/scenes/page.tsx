import { SceneComposer } from '@/components/SceneComposer';

export default function ScenesPage() {
  return (
    <main>
      <h1>Сцены</h1>
      <p>Собери сцену из нарисованных персонажей и предметов. Недостающих предложат дорисовать, а промпт встанет на паузу — он не потеряется.</p>
      <SceneComposer />
    </main>
  );
}
