'use client';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Студия', icon: '◉' },
  { href: '/characters', label: 'Персонажи', icon: '◍' },
  { href: '/items', label: 'Предметы', icon: '⬔' },
  { href: '/locations', label: 'Места', icon: '⛰' },
  { href: '/scenes', label: 'Сцены', icon: '▣' },
];

/** Admin sidebar navigation (active link highlighted). */
export function SideNav({ active }: { active?: string }) {
  const pathname = usePathname();
  const current = active ?? pathname;
  return (
    <aside className="sidebar" aria-label="Разделы">
      <div className="brand">
        Anime<span>Canvas</span>
      </div>
      {LINKS.map((l) => (
        <a key={l.href} href={l.href} className={current === l.href ? 'nav-link active' : 'nav-link'}>
          <span aria-hidden="true">{l.icon}</span> {l.label}
        </a>
      ))}
      <div className="nav-hint">Gemma рисует · Canvas показывает каждый штрих</div>
    </aside>
  );
}
