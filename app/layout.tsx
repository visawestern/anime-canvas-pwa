import type { Metadata, Viewport } from 'next';
import { SwRegister } from '@/components/SwRegister';
import './globals.css';

export const metadata: Metadata = {
  title: 'AnimeCanvas PWA — живой карандаш',
  description: 'Gemma vision анализирует фото, Canvas рисует аниме штрих за штрихом и анимирует только движущиеся слои.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'AnimeCanvas' },
};

export const viewport: Viewport = { themeColor: '#14121f', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <SwRegister />
        <nav aria-label="Разделы" style={{ display: 'flex', gap: 12, padding: '12px 24px' }}>
          <a href="/">Студия</a>
          <a href="/characters">Персонажи</a>
          <a href="/items">Предметы</a>
          <a href="/locations">Места</a>
          <a href="/scenes">Сцены</a>
        </nav>
        {children}
      </body>
    </html>
  );
}
