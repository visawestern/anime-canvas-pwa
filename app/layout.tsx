import type { Metadata, Viewport } from 'next';
import { SwRegister } from '@/components/SwRegister';
import { SideNav } from '@/components/SideNav';
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
        <div className="admin-shell">
          <SideNav />
          <div className="main-col">
            <div className="topbar">AnimeCanvas — живой карандаш</div>
            <div className="content">{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}
