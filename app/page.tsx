import { CanvasStage } from '@/components/CanvasStage';

export default function Home() {
  return (
    <main>
      <h1>AnimeCanvas — живой карандаш</h1>
      <p>Загрузи фото: Gemma разберёт позу, Canvas нарисует аниме штрих за штрихом на одном холсте.</p>
      <CanvasStage />
    </main>
  );
}
